import json
import sqlite3
import sys

import pytest
from cryptography.hazmat.primitives import serialization

from ota_server import __main__ as cli
from ota_server.app import create_app
from ota_server.config import Settings
from ota_server.security import password_valid, verify_manifest
from ota_server.service import fingerprint, profile
from conftest import raw_fixture


def invoke(monkeypatch, *args):
    monkeypatch.setattr(sys, "argv", ["ota_server", *map(str, args)])
    cli.main()


def test_init_reset_and_session_invalidation(tmp_path, monkeypatch):
    monkeypatch.setenv("OTA_DATA_DIR", str(tmp_path / "data"))
    monkeypatch.setenv("OTA_PUBLIC_URL", "http://127.0.0.1:8000")
    monkeypatch.setenv("OTA_ADMIN_PASSWORD", "Cli-test-password-2026")
    invoke(monkeypatch, "init")
    app = create_app(Settings.from_env())
    assert password_valid(app.state.db.one("SELECT password_hash FROM admins")["password_hash"], "Cli-test-password-2026")
    with pytest.raises(SystemExit) as e:
        invoke(monkeypatch, "init")
    assert e.value.code == 1
    with app.state.db.transaction() as conn:
        conn.execute("INSERT INTO sessions VALUES('fake','fake',9999999999)")
    monkeypatch.setenv("OTA_ADMIN_PASSWORD", "New-cli-password-2026")
    invoke(monkeypatch, "reset-admin", "--username", "operator")
    account = app.state.db.one("SELECT * FROM admins")
    assert account["username"] == "operator" and password_valid(account["password_hash"], "New-cli-password-2026")
    assert not app.state.db.rows("SELECT * FROM sessions")


def test_encrypted_keygen_and_pack_cli(tmp_path, monkeypatch):
    monkeypatch.setattr(cli.getpass, "getpass", lambda _: "Private-test-password")
    keys = tmp_path / "keys"
    invoke(monkeypatch, "keygen", "--output", keys)
    encrypted = (keys / "private.pem").read_bytes()
    assert b"BEGIN ENCRYPTED PRIVATE KEY" in encrypted
    key = serialization.load_pem_private_key(encrypted, b"Private-test-password")
    from conftest import Harness
    harness = Harness(tmp_path / "h", key)
    try:
        exported = {"schema_version": 1, "target": profile(harness.target), "target_fingerprint": fingerprint(harness.target)}
        config, firmware, output = tmp_path / "profile.json", tmp_path / "app.bin", tmp_path / "bundle"
        config.write_text(json.dumps(exported), encoding="utf-8")
        firmware.write_bytes(raw_fixture())
        args = ("pack", "--profile", config, "--firmware", firmware, "--private-key", keys / "private.pem", "--output", output, "--version", "2.0.0")
        invoke(monkeypatch, *args)
        manifest = json.loads((output / "manifest.json").read_text())
        verify_manifest(manifest, (output / "signature.txt").read_text().strip(), (keys / "public.pem").read_text())
        assert manifest["version"] == "2.0.0"
        with pytest.raises(SystemExit):
            invoke(monkeypatch, *args)  # Never overwrite signatures or keys.
        with pytest.raises(SystemExit):
            invoke(monkeypatch, "keygen", "--output", keys)
    finally:
        harness.client.close()


def test_backup_and_clean_restore(h, tmp_path, monkeypatch):
    h.publish()
    monkeypatch.setenv("OTA_DATA_DIR", str(h.settings.data_dir))
    monkeypatch.setenv("OTA_PUBLIC_URL", "http://testserver")
    snapshot = tmp_path / "snapshot"
    invoke(monkeypatch, "backup", "--output", snapshot)
    source = h.db.one("SELECT * FROM artifacts")
    assert (snapshot / "firmware" / (source["sha256"] + ".bin")).read_bytes() == raw_fixture()
    conn = sqlite3.connect(snapshot / "ota.sqlite3")
    try:
        assert conn.execute("PRAGMA integrity_check").fetchone()[0] == "ok"
        assert conn.execute("SELECT COUNT(*) FROM releases WHERE active=1").fetchone()[0] == 1
    finally:
        conn.close()
    restored = create_app(Settings(snapshot, "http://testserver"))
    assert restored.state.service.verify_blob(source).read_bytes() == raw_fixture()
    with pytest.raises(SystemExit):
        invoke(monkeypatch, "backup", "--output", snapshot)


def test_serve_external_plain_http_is_rejected(tmp_path, monkeypatch):
    monkeypatch.setenv("OTA_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OTA_PUBLIC_URL", "http://127.0.0.1:8000")
    with pytest.raises(SystemExit) as e:
        invoke(monkeypatch, "serve", "--host", "0.0.0.0")
    assert e.value.code == 1
