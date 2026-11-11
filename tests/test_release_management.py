"""Release-only management never rewrites a signed artifact or removes its file."""
from contextlib import contextmanager

import pytest

from ota_server.db import Database
from ota_server.service import Problem


def update(h, release, body):
    return h.client.patch(f"/api/admin/releases/{release['id']}", headers=h.headers, json=body)


def withdraw(h, release):
    result = h.admin_post(f"releases/{release['id']}/withdraw")
    assert result.status_code == 200, result.text


def delete(h, release, **body):
    return h.admin_post(f"releases/{release['id']}/delete", body)


def listed(h):
    result = h.client.get("/api/admin/releases")
    assert result.status_code == 200
    return result.json()


def test_edit_notes_only_for_one_release_keeps_artifact_and_signature(h):
    first, second = h.publish(), h.publish()
    artifact = h.db.one("SELECT * FROM artifacts")
    blob = h.svc.blob(artifact["sha256"]).read_bytes()
    assert all(row["notes"] == artifact["notes"] for row in listed(h))
    result = update(h, first, {"notes": "修订这一次发布的说明"})
    assert result.status_code == 200
    rows = {row["id"]: row for row in listed(h)}
    assert rows[first["id"]]["notes"] == "修订这一次发布的说明"
    assert rows[second["id"]]["notes"] == artifact["notes"]
    assert rows[first["id"]]["active"] == 0 and rows[second["id"]]["active"] == 1
    assert h.db.one("SELECT * FROM artifacts") == artifact
    assert h.svc.blob(artifact["sha256"]).read_bytes() == blob
    assert h.db.one("SELECT * FROM audit WHERE action='release.updated'")["object_id"] == first["id"]


def test_clear_notes_explicitly_does_not_fall_back_to_artifact(h):
    release = h.publish()
    assert update(h, release, {"notes": "first"}).status_code == 200
    assert update(h, release, {"notes": ""}).status_code == 200
    assert listed(h)[0]["notes"] == ""
    assert h.db.one("SELECT notes FROM artifacts")["notes"] == "测试说明"


@pytest.mark.parametrize("notes", [None, "", "独立发布说明", "字" * 2000])
def test_optional_publish_notes_preserve_legacy_and_accept_limit(h, notes):
    artifact = h.upload().json()
    result = h.admin_post("releases", {"artifact_id": artifact["id"], "channel": "beta", "notes": notes})
    assert result.status_code == 200, result.text
    assert listed(h)[0]["notes"] == ("测试说明" if notes is None else notes)
    assert h.db.one("SELECT notes FROM artifacts")["notes"] == "测试说明"


@pytest.mark.parametrize("notes", [123, ["bad"], "x" * 2001])
def test_invalid_publish_notes_do_not_create_release(h, notes):
    artifact = h.upload().json()
    result = h.admin_post("releases", {"artifact_id": artifact["id"], "channel": "stable", "notes": notes})
    assert result.status_code == 422
    assert not listed(h)


@pytest.mark.parametrize("body", [{}, {"notes": None}, {"notes": 42}, {"notes": "x" * 2001},
    {"notes": "new", "channel": "beta"}, {"notes": "new", "artifact_id": "0" * 32},
    {"notes": "new", "version": "V9.0.0"}, {"notes": "new", "seq": 100},
    {"notes": "new", "active": False}, {"notes": "new", "sha256": "0" * 64}])
def test_only_explicit_valid_notes_editable(h, body):
    release = h.publish()
    original = h.db.one("SELECT * FROM releases WHERE id=?", (release["id"],))
    assert update(h, release, body).status_code == 422
    assert h.db.one("SELECT * FROM releases WHERE id=?", (release["id"],)) == original
    assert not h.db.rows("SELECT * FROM release_notes")


def test_active_release_requires_withdrawal_before_delete(h):
    release = h.publish()
    assert listed(h)[0]["attempt_count"] == 0
    result = delete(h, release)
    assert result.status_code == 409 and "先撤回" in result.json()["error"]
    assert not h.db.rows("SELECT * FROM deleted_releases")
    assert h.svc.overview()["active_releases"] == 1
    withdraw(h, release)
    assert delete(h, release).status_code == 200
    assert listed(h) == []
    assert h.svc.overview()["active_releases"] == 0


@pytest.mark.parametrize("state", ["created", "downloading", "pending_boot", "confirmed", "failed", "rolled_back"])
def test_any_attempt_history_blocks_release_deletion(h, state):
    release, device = h.publish(), h.make_device()
    attempt = h.attempt(device, release).json()
    with h.db.transaction() as conn:
        conn.execute("UPDATE attempts SET state=? WHERE id=?", (state, attempt["id"]))
    withdraw(h, release)
    result = delete(h, release)
    assert result.status_code == 409 and "1 条升级记录" in result.json()["error"]
    assert listed(h)[0]["attempt_count"] == 1
    assert not h.db.rows("SELECT * FROM deleted_releases")
    assert h.client.get("/api/admin/attempts").json()[0]["state"] == state


def test_delete_selected_release_only_keeps_firmware_and_sequence_high_water(h):
    first, second = h.publish(), h.publish()
    artifact = h.db.one("SELECT * FROM artifacts")
    path = h.svc.blob(artifact["sha256"])
    firmware = path.read_bytes()
    withdraw(h, second)
    assert delete(h, second).status_code == 200
    assert [row["id"] for row in listed(h)] == [first["id"]]
    third = h.publish()
    assert third["seq"] == second["seq"] + 1
    withdraw(h, third)
    assert delete(h, first).status_code == 200
    assert delete(h, third).status_code == 200
    assert not listed(h)
    fourth = h.publish()
    assert fourth["seq"] == third["seq"] + 1
    beta = h.admin_post("releases", {"artifact_id": artifact["id"], "channel": "beta"}).json()
    assert beta["seq"] == 1
    assert path.read_bytes() == firmware and not h.db.rows("SELECT * FROM pruned_artifacts")
    assert h.db.one("SELECT COUNT(*) AS n FROM releases")["n"] == 5
    assert h.db.one("SELECT COUNT(*) AS n FROM audit WHERE action='release.deleted'")["n"] == 3


def test_deleted_release_cannot_edit_withdraw_delete_or_start_attempt(h):
    release, device = h.publish(), h.make_device()
    withdraw(h, release)
    assert delete(h, release).status_code == 200
    assert delete(h, release).status_code == 404
    assert update(h, release, {"notes": "restore by mistake"}).status_code == 404
    assert h.admin_post(f"releases/{release['id']}/withdraw").status_code == 404
    assert h.attempt(device, release).status_code == 404
    with pytest.raises(Problem, match="发布不存在"):
        h.svc.release(release["id"])
    assert h.check(device).json()["update_available"] is False


@pytest.mark.parametrize("condition", ["revoked-key", "deleted-file"])
def test_unused_withdrawn_release_manageable_even_without_available_firmware(h, condition):
    release = h.publish()
    withdraw(h, release)
    if condition == "revoked-key":
        h.admin_post(f"keys/{h.target['key_id']}/revoke")
    else:
        artifact_id = h.db.one("SELECT artifact_id FROM releases WHERE id=?", (release["id"],))["artifact_id"]
        plan = h.svc.artifact_delete_preview(artifact_id)
        h.svc.delete_artifact(artifact_id, plan["preview_token"])
    assert update(h, release, {"notes": "仍可编辑发布说明"}).status_code == 200
    assert delete(h, release).status_code == 200


def test_failed_commit_does_not_hide_release_or_alter_firmware(h, monkeypatch):
    release = h.publish()
    withdraw(h, release)
    original = h.db.transaction

    @contextmanager
    def fail_commit():
        with original() as conn:
            yield conn
            raise RuntimeError("injected before commit")

    monkeypatch.setattr(h.db, "transaction", fail_commit)
    with pytest.raises(RuntimeError):
        h.svc.delete_release(release["id"])
    assert not h.db.rows("SELECT * FROM deleted_releases")
    assert listed(h)[0]["id"] == release["id"]
    assert h.svc.blob(listed(h)[0]["sha256"]).is_file()


def test_schema_upgrade_is_additive_and_idempotent_for_old_release(h):
    release = h.publish()
    with h.db.transaction() as conn:
        conn.execute("DROP TABLE release_notes")
        conn.execute("DROP TABLE deleted_releases")
    Database(h.settings)
    Database(h.settings)
    assert listed(h)[0]["notes"] == "测试说明"
    assert update(h, release, {"notes": "after upgrade"}).status_code == 200
    withdraw(h, release)
    assert delete(h, release).status_code == 200


def test_release_management_auth_csrf_origin_and_exact_delete_body(h):
    release = h.publish()
    url = f"/api/admin/releases/{release['id']}"
    assert h.client.patch(url, json={"notes": "new"}).status_code == 403
    assert h.client.post(url + "/delete", json={}).status_code == 403
    for method, path, data in [("PATCH", url, {"notes": "new"}), ("POST", url + "/delete", {})]:
        result = h.client.request(method, path, json=data, headers=dict(h.headers, Origin="https://evil.example"))
        assert result.status_code == 403
    assert delete(h, release, force=True).status_code == 422
    assert update(h, {"id": "missing"}, {"notes": "new"}).status_code == 404
    assert delete(h, {"id": "missing"}).status_code == 404
    h.client.cookies.clear()
    assert h.client.patch(url, json={"notes": "new"}).status_code == 401
    assert h.client.post(url + "/delete", json={}).status_code == 401


def test_backup_preserves_deleted_sequence_and_release_notes(h, tmp_path, monkeypatch):
    import sqlite3
    import sys
    from ota_server import __main__ as cli
    release = h.publish()
    assert update(h, release, {"notes": "保留审计说明"}).status_code == 200
    withdraw(h, release)
    assert delete(h, release).status_code == 200
    output = tmp_path / "backup"
    monkeypatch.setenv("OTA_DATA_DIR", str(h.settings.data_dir))
    monkeypatch.setenv("OTA_PUBLIC_URL", "http://testserver")
    monkeypatch.setattr(sys, "argv", ["ota_server", "backup", "--output", str(output)])
    cli.main()
    with sqlite3.connect(output / "ota.sqlite3") as conn:
        assert conn.execute("SELECT seq FROM releases WHERE id=?", (release["id"],)).fetchone()[0] == release["seq"]
        assert conn.execute("SELECT notes FROM release_notes").fetchone()[0] == "保留审计说明"
        assert conn.execute("SELECT COUNT(*) FROM deleted_releases").fetchone()[0] == 1
    assert len(list((output / "firmware").glob("*.bin"))) == 1
