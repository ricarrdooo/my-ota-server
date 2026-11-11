from concurrent.futures import ThreadPoolExecutor
import hashlib
import json
import re
import sqlite3
import time

from fastapi.testclient import TestClient
import pytest

from ota_server.models import KeyInput, ReleaseInput, TargetInput
from ota_server.security import canonical, token_digest
from ota_server.service import profile, fingerprint
from ota_server.__main__ import pack
from conftest import raw_fixture


def test_signed_release_download_and_confirm(h):
    device, release = h.make_device(), h.publish()
    result = h.check(device)
    assert result.status_code == 200
    offer = result.json()
    assert offer["update_available"] and offer["manifest"]["target_id"] == h.target["id"]
    attempt = h.attempt(device, release).json()
    url = offer["download_path"]
    downloaded = h.client.get(url, params={"attempt_id": attempt["id"]}, headers=h.auth(device))
    assert downloaded.status_code == 200 and downloaded.content == raw_fixture()
    assert int(downloaded.headers["content-length"]) == len(raw_fixture())
    assert downloaded.headers["x-firmware-sha256"] == offer["manifest"]["sha256"]
    phases = ["downloading", "downloaded", "validating", "installing", "pending_boot"]
    for seq, state in enumerate(phases, 1):
        result = h.client.post(f"/api/v1/ota/attempts/{attempt['id']}/events", headers=h.auth(device), json={"seq": seq, "state": state})
        assert result.status_code == 200, result.text
    assert h.db.one("SELECT state FROM attempts")["state"] == "pending_boot"
    wrong = {"seq": 6, "state": "confirmed", "version": "wrong", "sha256": "0" * 64}
    assert h.client.post(f"/api/v1/ota/attempts/{attempt['id']}/events", headers=h.auth(device), json=wrong).status_code == 409
    good = dict(wrong, version=offer["manifest"]["version"], sha256=offer["manifest"]["sha256"])
    assert h.client.post(f"/api/v1/ota/attempts/{attempt['id']}/events", headers=h.auth(device), json=good).status_code == 200
    assert h.db.one("SELECT state FROM attempts")["state"] == "confirmed"
    assert not h.check(device, current_sha256=offer["manifest"]["sha256"]).json()["update_available"]


def test_upload_tampering_wrong_key_truncation_and_dedup(h):
    assert h.upload(manifest_changes={"version": "2.0.0"}).status_code == 400
    assert h.upload(manifest_changes={"target_id": "another-target"}).status_code == 404
    assert h.upload(manifest_changes={"size": 500}).status_code == 400
    assert h.upload(signature="AA==").status_code == 400
    first, second = h.upload(), h.upload()
    assert first.status_code == second.status_code == 200
    assert second.json()["duplicate"] and first.json()["id"] == second.json()["id"]
    assert len(h.db.rows("SELECT id FROM artifacts")) == 1
    assert not list((h.settings.data_dir / "staging").iterdir())


def test_bad_native_image_is_rejected_even_with_valid_manifest_signature(h):
    data = bytearray(raw_fixture())
    data[4:8] = bytes(4)
    from cryptography.hazmat.primitives import hashes
    from cryptography.hazmat.primitives.asymmetric import padding
    import base64
    value, _ = pack({"schema_version": 1, "target": profile(h.target), "target_fingerprint": fingerprint(h.target)}, raw_fixture(), h.key, "1.0.0")
    value["sha256"] = hashlib.sha256(data).hexdigest()
    sig = base64.b64encode(h.key.sign(canonical(value), padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32), hashes.SHA256()))
    result = h.client.post("/api/admin/artifacts", headers=h.headers, files={"firmware": ("evil.bin", bytes(data)), "manifest": ("manifest.json", canonical(value)), "signature": ("signature.txt", sig)})
    assert result.status_code == 400 and "复位向量" in result.text
    assert not h.db.rows("SELECT id FROM artifacts")


def test_auth_csrf_origin_host_and_no_secrets_in_listings(h):
    stranger = TestClient(h.app)
    assert stranger.get("/api/admin/catalog").status_code == 401
    assert stranger.post("/api/admin/artifacts", content=b"not multipart").status_code == 401
    assert h.client.post("/api/admin/products", json={"id": "aa", "name": "aa"}).status_code == 403
    assert h.client.post("/api/admin/products", headers=dict(h.headers, Origin="https://evil.example"), json={"id": "aa", "name": "aa"}).status_code == 403
    assert h.client.get("/", headers={"Host": "evil.example"}).status_code == 400
    device = h.make_device()
    assert device["token"] not in h.client.get("/api/admin/devices").text
    assert device["token"] not in h.client.get("/api/admin/catalog").text
    assert h.client.get("/api/v1/ota/check").status_code in (401, 422)
    assert h.client.get("/static/app.js").headers["content-security-policy"].find("unsafe-inline") == -1


def test_login_rate_limit_and_expired_session(h):
    c = TestClient(h.app)
    html = c.get("/login").text
    nonce = re.search(r'name="csrf" value="([^"]+)"', html)[1]
    assert c.post("/login", data={"username": "admin", "password": "wrong", "csrf": "wrong"}).status_code == 403
    for _ in range(4):
        assert c.post("/login", data={"username": "admin", "password": "wrong", "csrf": nonce}).status_code == 401
    # Existing harness login used the same test client IP's first slot.
    assert c.post("/login", data={"username": "admin", "password": "wrong", "csrf": nonce}).status_code == 429
    with h.db.transaction() as conn:
        conn.execute("UPDATE sessions SET expires=0")
    assert h.client.get("/api/admin/catalog").status_code == 401


def test_devices_cannot_cross_read_and_gateway_scope(h):
    one, two, release = h.make_device(), h.make_device(), h.publish()
    info = h.compat(two)
    info["capabilities"] = "staging,app_confirm"
    assert h.client.get("/api/v1/ota/check", params=info, headers=h.auth(one)).status_code == 404
    attempt = h.attempt(two, release).json()
    assert h.client.get(f"/api/v1/ota/releases/{release['id']}/firmware", params={"attempt_id": attempt["id"]}, headers=h.auth(one)).status_code == 404
    gateway = h.admin_post("gateways", {"name": "串口网关"}).json()
    child = h.make_device(gateway)
    assert child["token"] is None
    child["token"] = gateway["token"]
    assert h.check(child).status_code == 200
    gateway["id"] = one["id"]
    assert h.check(gateway, target_id=h.target["id"]).status_code == 404


def test_device_revoke_rotate_and_signing_key_revoke(h):
    device, release = h.make_device(), h.publish()
    attempt = h.attempt(device, release).json()
    assert h.admin_post("agents/" + device["agent_id"] + "/revoke").status_code == 200
    assert h.check(device).status_code == 401
    new = h.admin_post("agents/" + device["agent_id"] + "/rotate").json()
    assert h.check(device).status_code == 401
    device["token"] = new["token"]
    assert h.check(device).status_code == 200
    assert h.admin_post("keys/" + h.target["key_id"] + "/revoke").status_code == 200
    stopped = h.check(device)
    assert stopped.status_code == 200 and not stopped.json()["update_available"]
    assert not h.db.rows("SELECT id FROM releases WHERE active=1")
    assert h.client.get(f"/api/v1/ota/releases/{release['id']}/firmware", params={"attempt_id": attempt["id"]}, headers=h.auth(device)).status_code == 404


@pytest.mark.parametrize("changes", [{"target_id": "other-target"}, {"layout_id": "wrong-layout"},
    {"bootloader_version": "0.0.1"}, {"capabilities": "staging"}, {"protocol_version": 2}])
def test_capabilities_and_compatibility_are_enforced(h, changes):
    device = h.make_device()
    assert h.check(device, **changes).status_code in (400, 409)


def test_publication_pinned_during_replacement_and_withdrawal(h):
    device, first = h.make_device(), h.publish()
    attempt = h.attempt(device, first).json()
    second = h.publish(version="2.0.0", data=raw_fixture(512))
    assert h.check(device).json()["release_id"] == second["id"]
    result = h.client.get(f"/api/v1/ota/releases/{first['id']}/firmware", params={"attempt_id": attempt["id"]}, headers=h.auth(device))
    assert result.content == raw_fixture()
    assert h.attempt(device, first, "new-request").status_code == 409
    assert h.admin_post("releases/" + second["id"] + "/withdraw").status_code == 200
    assert not h.check(device).json()["update_available"]
    assert h.attempt(device, first).json()["id"] == attempt["id"]  # Idempotent retry remains pinned.


def test_event_order_duplicates_and_terminal_state(h):
    device, release = h.make_device(), h.publish()
    attempt = h.attempt(device, release).json()
    url = f"/api/v1/ota/attempts/{attempt['id']}/events"
    send = lambda obj: h.client.post(url, headers=h.auth(device), json=obj)
    assert send({"seq": 1, "state": "confirmed"}).status_code == 409
    event = {"seq": 3, "state": "downloading", "progress": 20}
    assert send(event).status_code == 200
    assert send(event).json()["duplicate"]
    assert send(dict(event, progress=30)).status_code == 409
    assert send({"seq": 2, "state": "downloading", "progress": 10}).status_code == 200
    assert h.db.one("SELECT progress FROM attempts")["progress"] == 20
    assert send({"seq": 4, "state": "failed", "error": "断网"}).status_code == 200
    assert send({"seq": 5, "state": "downloading"}).status_code == 409
    assert h.db.one("SELECT state FROM attempts")["state"] == "failed"


def test_malformed_and_oversize_uploads_leave_no_partial_files(h):
    response = h.client.post("/api/admin/artifacts", headers=h.headers, files={"firmware": ("f.bin", b"x"), "manifest": ("m.json", b'{"size":1,"size":2}'), "signature": ("s.txt", b"AA==")})
    assert response.status_code == 400
    response = h.client.post("/api/admin/artifacts", headers={**h.headers, "Content-Length": str(100 * 1024 * 1024)}, content=b"x")
    assert response.status_code == 413
    assert not list((h.settings.data_dir / "staging").iterdir())


def test_storage_corruption_blocks_release_and_download(h):
    device, release = h.make_device(), h.publish()
    attempt = h.attempt(device, release).json()
    artifact = h.db.one("SELECT * FROM artifacts")
    h.svc.blob(artifact["sha256"]).write_bytes(b"corrupted")
    assert h.admin_post("releases", {"artifact_id": artifact["id"], "channel": "beta"}).status_code == 503
    assert h.client.get(f"/api/v1/ota/releases/{release['id']}/firmware", params={"attempt_id": attempt["id"]}, headers=h.auth(device)).status_code == 503


def test_concurrent_publish_has_single_active_and_monotonic_sequences(h):
    artifact = h.upload().json()["id"]
    with ThreadPoolExecutor(max_workers=4) as pool:
        results = list(pool.map(lambda _: h.svc.publish(ReleaseInput(artifact_id=artifact, channel="stable")), range(6)))
    assert sorted(result["seq"] for result in results) == list(range(1, 7))
    assert len(h.db.rows("SELECT id FROM releases WHERE active=1")) == 1


def test_database_failure_does_not_replace_active_release(h):
    h.publish()
    with h.db.transaction() as conn:
        conn.execute("CREATE TRIGGER block_new_artifact BEFORE INSERT ON artifacts BEGIN SELECT RAISE(ABORT,'test failure'); END")
    assert h.upload(version="2.0.0", data=raw_fixture(512)).status_code == 409
    assert len(h.db.rows("SELECT id FROM releases WHERE active=1")) == 1
    assert len(h.db.rows("SELECT id FROM artifacts")) == 1
    assert not list((h.settings.data_dir / "staging").iterdir())


def test_unicode_login_is_rejected_without_internal_error(h):
    h.client.cookies.clear()
    import re
    nonce = re.search(r'name="csrf" value="([^"]+)"', h.client.get("/login").text)[1]
    response = h.client.post("/login", data={"csrf": nonce, "username": "管理员", "password": "Test-password-2026"})
    assert response.status_code == 401
    response = h.client.post("/login", data={"csrf": "不正确", "username": "admin", "password": "wrong"})
    assert response.status_code == 403


def test_revoked_agents_are_not_counted_online(h):
    device = h.make_device()
    response = h.client.post("/api/v1/devices/heartbeat", headers=h.auth(device), json={"device_id": device["id"], "version": "1.0.0", "sha256": "0" * 64})
    assert response.status_code == 200
    assert h.svc.overview()["online_devices"] == 1
    h.admin_post("agents/" + device["agent_id"] + "/revoke")
    assert h.svc.overview()["online_devices"] == 0


def test_rollback_requires_declared_capability(h):
    device, release = h.make_device(), h.publish()
    attempt = h.attempt(device, release).json()
    url = f"/api/v1/ota/attempts/{attempt['id']}/events"
    for seq, state in enumerate(("downloading", "downloaded", "validating", "installing", "pending_boot"), 1):
        assert h.client.post(url, headers=h.auth(device), json={"seq": seq, "state": state}).status_code == 200
    assert h.client.post(url, headers=h.auth(device), json={"seq": 6, "state": "rolled_back"}).status_code == 409


def test_storage_error_is_safe_and_retryable(h, monkeypatch):
    def unavailable(_):
        raise OSError("sensitive-system-path")
    monkeypatch.setattr(h.svc, "add_product", unavailable)
    response = h.admin_post("products", {"id": "safe-product", "name": "Test"})
    assert response.status_code == 503 and "sensitive-system-path" not in response.text


def test_static_assets_have_executable_mime_and_safe_referrer(h):
    javascript = h.client.get("/static/app.js")
    assert javascript.headers["content-type"].split(";")[0] == "text/javascript"
    assert javascript.headers["x-content-type-options"] == "nosniff"
    assert h.client.get("/static/app.css").headers["content-type"].startswith("text/css")
    # no-referrer turns the Origin of non-CORS browser form POSTs into null.
    assert h.client.get("/login").headers["referrer-policy"] == "same-origin"
    assert h.client.get("/favicon.ico").status_code == 204
