"""Manual deletion tests touch temporary Harness data, never real storage."""
from contextlib import contextmanager
from pathlib import Path
import os
import time

import pytest

from conftest import raw_fixture
from ota_server.models import TargetInput
from ota_server.service import Problem


def seed(h, count=8, shared=False):
    items = []
    for i in range(count):
        data = raw_fixture()[:-1] + bytes([0 if shared else i])
        response = h.upload(data=data, version=f"V1.0.{i}")
        assert response.status_code == 200, response.text
        identity = response.json()["id"]
        with h.db.transaction() as conn:
            conn.execute("UPDATE artifacts SET created=? WHERE id=?", (1000 + i, identity))
        items.append(dict(h.db.one("SELECT * FROM artifacts WHERE id=?", (identity,)), data=data))
    return items


def preview(h, item):
    response = h.client.get(f"/api/admin/artifacts/{item['id']}/deletion")
    assert response.status_code == 200, response.text
    return response.json()


def execute(h, plan, identity=None):
    identity = identity or plan["artifact"]["id"]
    return h.admin_post(f"artifacts/{identity}/delete", {"preview_token": plan["preview_token"]})


def publish(h, item):
    response = h.admin_post("releases", {"artifact_id": item["id"], "channel": "stable"})
    assert response.status_code == 200, response.text
    return response.json()


def test_only_selected_newest_deleted_after_confirmation_no_five_rule(h):
    items = seed(h)
    plan = preview(h, items[-1])
    assert plan["can_delete"] and plan["artifact"]["id"] == items[-1]["id"]
    assert plan["recoverable_bytes"] == 256
    assert len(list((h.settings.data_dir / "firmware").glob("*.bin"))) == 8
    assert not h.db.rows("SELECT * FROM pruned_artifacts")
    result = execute(h, plan)
    assert result.status_code == 200, result.text
    assert result.json()["freed_bytes"] == 256 and result.json()["deleted_files"] == 1
    assert not result.json()["warnings"]
    assert len(h.db.rows("SELECT * FROM artifacts")) == 8
    assert len(h.db.rows("SELECT * FROM pruned_artifacts")) == 1
    assert len(h.client.get("/api/admin/artifacts").json()) == 7
    for item in items[:-1]:
        assert h.svc.blob(item["sha256"]).read_bytes() == item["data"]


def test_can_manually_delete_all_unused_including_last_firmware(h):
    items = seed(h, count=3)
    for item in items:
        assert execute(h, preview(h, item)).status_code == 200
    assert h.client.get("/api/admin/artifacts").json() == []
    assert not list((h.settings.data_dir / "firmware").glob("*.bin"))
    repeat = execute(h, preview(h, items[-1]))
    assert repeat.json()["archived_count"] == repeat.json()["freed_bytes"] == 0


def test_active_release_cannot_be_deleted_even_with_its_fresh_token(h):
    item = seed(h, count=1)[0]
    publish(h, item)
    plan = preview(h, item)
    assert not plan["can_delete"] and "活动发布" in plan["reasons"][0]
    assert execute(h, plan).status_code == 409
    assert not h.db.rows("SELECT * FROM pruned_artifacts")
    assert h.svc.blob(item["sha256"]).exists()


def test_nonterminal_attempt_protected_even_after_authorization_expired(h):
    item = seed(h, count=1)[0]
    release = publish(h, item)
    device = h.make_device()
    attempt = h.attempt(device, release).json()
    h.admin_post(f"releases/{release['id']}/withdraw")
    with h.db.transaction() as conn:
        conn.execute("UPDATE attempts SET created=? WHERE id=?", (time.time() - 900000, attempt["id"]))
    plan = preview(h, item)
    assert not plan["can_delete"]
    assert execute(h, plan).status_code == 409


def test_recent_terminal_attempt_protected_until_ttl_history_kept(h):
    item = seed(h, count=1)[0]
    release = publish(h, item)
    device = h.make_device()
    attempt = h.attempt(device, release).json()
    h.admin_post(f"releases/{release['id']}/withdraw")
    with h.db.transaction() as conn:
        conn.execute("UPDATE attempts SET state='failed' WHERE id=?", (attempt["id"],))
    assert not preview(h, item)["can_delete"]
    with h.db.transaction() as conn:
        conn.execute("UPDATE attempts SET created=? WHERE id=?", (time.time() - 86401, attempt["id"]))
    assert execute(h, preview(h, item)).status_code == 200
    assert h.client.get("/api/admin/attempts").json()[0]["state"] == "failed"
    assert h.client.get("/api/admin/releases").json()[0]["pruned_at"]
    assert h.admin_post("releases", {"artifact_id": item["id"], "channel": "stable"}).status_code == 410


@pytest.mark.parametrize("change", ["publish", "attempt", "download", "shared-reference", "file"])
def test_stale_preview_rechecks_selected_artifact_and_references(h, change):
    item = seed(h, count=1)[0]
    plan = preview(h, item)
    if change in ("publish", "attempt"):
        release = publish(h, item)
        if change == "attempt":
            h.attempt(h.make_device(), release)
            h.admin_post(f"releases/{release['id']}/withdraw")
    elif change == "download":
        h.svc._downloads[item["sha256"]] = 1
    elif change == "shared-reference":
        assert h.upload(data=item["data"], version="V9.0.0").status_code == 200
    else:
        path = h.svc.blob(item["sha256"])
        stat = path.stat()
        os.utime(path, ns=(stat.st_atime_ns, stat.st_mtime_ns + 1000000))
    assert execute(h, plan).status_code == 409
    assert not h.db.rows("SELECT * FROM pruned_artifacts")
    assert h.svc.blob(item["sha256"]).exists()


def test_unrelated_upload_does_not_expand_or_invalidate_selection(h):
    items = seed(h, count=2)
    plan = preview(h, items[0])
    uploaded = h.upload(data=raw_fixture()[:-1] + b"z", version="V9.0.0").json()
    assert execute(h, plan).status_code == 200
    assert {row["id"] for row in h.client.get("/api/admin/artifacts").json()} == {items[1]["id"], uploaded["id"]}


def test_confirmation_token_cannot_be_used_for_another_artifact(h):
    items = seed(h, count=2)
    assert execute(h, preview(h, items[0]), items[1]["id"]).status_code == 409
    assert not h.db.rows("SELECT * FROM pruned_artifacts")


def test_shared_file_deleted_only_after_last_live_reference(h):
    items = seed(h, count=3, shared=True)
    for item in items[:-1]:
        plan = preview(h, item)
        assert plan["shared_references"] and not plan["recoverable_bytes"]
        assert execute(h, plan).json()["shared_file_retained"] is True
        assert h.svc.blob(item["sha256"]).exists()
    with pytest.raises(Problem, match="已清理|已删除"):
        h.svc.verify_blob(items[0])
    h.svc.verify_blob(items[-1])
    result = execute(h, preview(h, items[-1])).json()
    assert result["freed_bytes"] == 256 and not result["shared_file_retained"]


def test_other_hardware_shared_reference_also_protects_file(h):
    item = seed(h, count=1)[0]
    value = {key: h.target[key] for key in TargetInput.model_fields}
    value.update(id="another-target", name="Another target")
    h.target = h.svc.add_target(TargetInput(**value))
    other = seed(h, count=1)[0]
    assert item["sha256"] == other["sha256"]
    assert execute(h, preview(h, item)).json()["freed_bytes"] == 0
    h.svc.verify_blob(other)


def test_reupload_restores_deleted_artifact(h):
    item = seed(h, count=1)[0]
    assert execute(h, preview(h, item)).status_code == 200
    result = h.upload(data=item["data"], version=item["version"])
    assert result.status_code == 200 and result.json()["restored"] is True
    assert result.json()["id"] == item["id"]
    assert len(h.client.get("/api/admin/artifacts").json()) == 1
    release = publish(h, item)
    assert h.db.one("SELECT artifact_id FROM releases WHERE id=?", (release["id"],))["artifact_id"] == item["id"]


def test_failed_commit_never_unlinks_files(h, monkeypatch):
    item = seed(h, count=1)[0]
    plan = preview(h, item)
    original = h.db.transaction

    @contextmanager
    def fail_commit():
        with original() as conn:
            yield conn
            raise RuntimeError("injected before commit")

    monkeypatch.setattr(h.db, "transaction", fail_commit)
    with pytest.raises(RuntimeError):
        h.svc.delete_artifact(item["id"], plan["preview_token"])
    assert not h.db.rows("SELECT * FROM pruned_artifacts")
    assert h.svc.blob(item["sha256"]).exists()


def test_unlink_failure_stays_visible_as_pending_and_can_retry(h, monkeypatch):
    item = seed(h, count=1)[0]
    expected = h.svc.blob(item["sha256"])
    original = Path.unlink

    def fail_one(path, *args, **kwargs):
        if path == expected:
            raise PermissionError("injected open-file failure")
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "unlink", fail_one)
    result = execute(h, preview(h, item)).json()
    assert result["archived_count"] == 1 and result["deleted_files"] == 0 and len(result["warnings"]) == 1
    pending = h.client.get("/api/admin/artifacts").json()
    assert len(pending) == 1 and pending[0]["deletion_pending"] and pending[0]["pruned_at"]
    monkeypatch.setattr(Path, "unlink", original)
    retry = execute(h, preview(h, item)).json()
    assert retry["archived_count"] == 0 and retry["deleted_files"] == 1
    assert h.client.get("/api/admin/artifacts").json() == []


def test_real_download_pin_blocks_delete_until_stream_closed(h):
    item = seed(h, count=1)[0]
    release = publish(h, item)
    device = h.make_device()
    attempt = h.attempt(device, release).json()
    agent = h.db.one("SELECT * FROM agents WHERE id=?", (device["agent_id"],))
    h.svc.pin_download(agent, release["id"], attempt["id"])
    h.admin_post(f"releases/{release['id']}/withdraw")
    with h.db.transaction() as conn:
        conn.execute("UPDATE attempts SET state='failed',created=? WHERE id=?", (time.time() - 86401, attempt["id"]))
    assert not preview(h, item)["can_delete"]
    h.svc.unpin_download(item["sha256"])
    assert preview(h, item)["can_delete"]


@pytest.mark.parametrize("range_header", [None, "bytes=0-31", "bytes=999999-1000000"])
def test_http_download_always_releases_pin(h, range_header):
    release = h.publish()
    device = h.make_device()
    attempt = h.attempt(device, release).json()
    headers = h.auth(device)
    if range_header:
        headers["Range"] = range_header
    h.client.get(f"/api/v1/ota/releases/{release['id']}/firmware", params={"attempt_id": attempt["id"]}, headers=headers)
    assert not h.svc._downloads


def test_path_escape_rejected_and_unknown_files_never_swept(h, monkeypatch):
    item = seed(h, count=1)[0]
    outside = h.settings.data_dir.parent / "do-not-delete.bin"
    outside.write_bytes(b"unrelated test data")
    unknown = h.settings.data_dir / "firmware" / "unknown.bin"
    unknown.write_bytes(b"unindexed data")
    original = h.svc.blob
    monkeypatch.setattr(h.svc, "blob", lambda _digest: outside)
    with pytest.raises(Problem, match="异常链接或路径"):
        h.svc.artifact_delete_preview(item["id"])
    assert not h.db.rows("SELECT * FROM pruned_artifacts")
    monkeypatch.setattr(h.svc, "blob", original)
    assert execute(h, preview(h, item)).status_code == 200
    assert outside.read_bytes() == b"unrelated test data" and unknown.read_bytes() == b"unindexed data"


def test_manual_routes_auth_csrf_exact_schema_and_old_bulk_routes_removed(h):
    item = seed(h, count=1)[0]
    plan = preview(h, item)
    url = f"/api/admin/artifacts/{item['id']}/delete"
    assert h.client.post(url, json={"preview_token": plan["preview_token"]}).status_code == 403
    assert h.admin_post(f"artifacts/{item['id']}/delete", {"preview_token": "0" * 64, "force": True}).status_code == 422
    assert h.client.get("/api/admin/artifacts/retention").status_code == 404
    assert h.admin_post("artifacts/retention/cleanup", {"preview_token": "0" * 64}).status_code == 404
    assert h.client.get("/api/admin/artifacts/missing/deletion").status_code == 404
    assert h.admin_post("artifacts/missing/delete", {"preview_token": "0" * 64}).status_code == 404
    h.client.cookies.clear()
    assert h.client.get(f"/api/admin/artifacts/{item['id']}/deletion").status_code == 401
    assert h.client.post(url, json={"preview_token": plan["preview_token"]}).status_code == 401


def test_revoked_key_does_not_prevent_removing_unused_firmware(h):
    item = seed(h, count=1)[0]
    h.admin_post(f"keys/{h.target['key_id']}/revoke")
    assert execute(h, preview(h, item)).status_code == 200


def test_backup_after_manual_delete_retains_history(h, tmp_path, monkeypatch):
    import sqlite3
    import sys
    from ota_server import __main__ as cli
    items = seed(h)
    assert execute(h, preview(h, items[-1])).status_code == 200
    output = tmp_path / "backup"
    monkeypatch.setenv("OTA_DATA_DIR", str(h.settings.data_dir))
    monkeypatch.setenv("OTA_PUBLIC_URL", "http://testserver")
    monkeypatch.setattr(sys, "argv", ["ota_server", "backup", "--output", str(output)])
    cli.main()
    assert len(list((output / "firmware").glob("*.bin"))) == 7
    with sqlite3.connect(output / "ota.sqlite3") as conn:
        assert conn.execute("SELECT COUNT(*) FROM artifacts").fetchone()[0] == 8
        assert conn.execute("SELECT COUNT(*) FROM pruned_artifacts").fetchone()[0] == 1
