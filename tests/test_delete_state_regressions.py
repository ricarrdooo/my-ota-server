"""Regression coverage uses isolated test data, never production storage."""
from pathlib import Path
import os
import time

import pytest

from conftest import raw_fixture
from ota_server.models import TargetInput
from ota_server.service import Problem


def release_rows(h):
    response = h.client.get("/api/admin/releases")
    assert response.status_code == 200, response.text
    return {row["id"]: row for row in response.json()}


def publish(h, artifact_id):
    response = h.admin_post("releases", {"artifact_id": artifact_id, "channel": "stable"})
    assert response.status_code == 200, response.text
    return response.json()


def withdraw(h, release_id):
    response = h.admin_post(f"releases/{release_id}/withdraw")
    assert response.status_code == 200, response.text


def delete_artifact(h, artifact_id):
    preview = h.client.get(f"/api/admin/artifacts/{artifact_id}/deletion")
    assert preview.status_code == 200, preview.text
    response = h.admin_post(f"artifacts/{artifact_id}/delete", {"preview_token": preview.json()["preview_token"]})
    assert response.status_code == 200, response.text
    return response.json()


def test_deleted_artifact_marks_every_associated_release_and_each_remains_deletable(h):
    artifact = h.upload(version="87f29f2-dirty").json()
    releases = [publish(h, artifact["id"]) for _ in range(3)]
    withdraw(h, releases[-1]["id"])
    delete_artifact(h, artifact["id"])
    rows = release_rows(h)
    assert len(rows) == 3
    assert all(row["artifact_id"] == artifact["id"] and row["pruned_at"] is not None for row in rows.values())
    assert all(row["firmware_state"] == "deleted" and not row["can_publish"] for row in rows.values())
    assert all(row["can_delete"] and row["delete_block_reasons"] == [] for row in rows.values())
    for release in releases:
        response = h.admin_post(f"releases/{release['id']}/delete", {})
        assert response.status_code == 200, response.text
    assert release_rows(h) == {}
    assert h.db.one("SELECT COUNT(*) AS n FROM releases")["n"] == 3


def test_same_version_different_sha_is_not_the_same_deleted_firmware(h):
    version = "87f29f2-dirty"
    first = h.upload(version=version).json()
    second = h.upload(version=version, data=raw_fixture()[:-1] + b"x").json()
    assert first["id"] != second["id"]
    first_release = publish(h, first["id"])
    second_release = publish(h, second["id"])
    delete_artifact(h, first["id"])
    rows = release_rows(h)
    assert rows[first_release["id"]]["pruned_at"] is not None
    assert rows[second_release["id"]]["pruned_at"] is None
    assert rows[first_release["id"]]["sha256"] != rows[second_release["id"]]["sha256"]
    assert rows[first_release["id"]]["version"] == rows[second_release["id"]]["version"]
    assert rows[first_release["id"]]["firmware_state"] == "deleted"
    assert rows[second_release["id"]]["firmware_state"] == "available"
    assert rows[second_release["id"]]["can_publish"]
    h.svc.verify_blob(h.db.one("SELECT * FROM artifacts WHERE id=?", (second["id"],)))


def test_same_version_sha_different_target_preserves_other_artifact_and_file(h):
    first = h.upload(version="V1.0.0").json()
    first_release = publish(h, first["id"])
    withdraw(h, first_release["id"])
    value = {key: h.target[key] for key in TargetInput.model_fields}
    value.update(id="second-target", name="第二款硬件")
    h.target = h.svc.add_target(TargetInput(**value))
    second = h.upload(version="V1.0.0").json()
    second_release = publish(h, second["id"])
    result = delete_artifact(h, first["id"])
    assert result["shared_file_retained"] and result["deleted_files"] == 0
    rows = release_rows(h)
    assert rows[first_release["id"]]["firmware_state"] == "deleted"
    assert rows[second_release["id"]]["firmware_state"] == "available"
    assert rows[first_release["id"]]["sha256"] == rows[second_release["id"]]["sha256"]
    assert rows[first_release["id"]]["target_id"] != rows[second_release["id"]]["target_id"]


@pytest.mark.parametrize("condition", ["missing", "corrupt", "wrong-size"])
def test_physical_file_failure_is_consistent_without_a_tombstone(h, condition):
    first = h.upload(version="V1.0.0").json()
    second = h.upload(version="V1.0.1").json()
    releases = [publish(h, first["id"]), publish(h, first["id"]), publish(h, second["id"])]
    withdraw(h, releases[-1]["id"])
    artifact = h.db.one("SELECT * FROM artifacts WHERE id=?", (first["id"],))
    path = h.svc.blob(artifact["sha256"])
    assert all(row["firmware_state"] == "available" for row in release_rows(h).values())
    if condition == "missing":
        path.unlink()
    else:
        path.write_bytes(raw_fixture()[:-1] + (b"x" if condition == "corrupt" else b"xx"))
    expected = "missing" if condition == "missing" else "corrupt"
    rows = release_rows(h)
    assert all(row["firmware_state"] == expected and not row["can_publish"] for row in rows.values())
    assert all(row["pruned_at"] is None and row["publish_block_reasons"] for row in rows.values())
    artifacts = h.client.get("/api/admin/artifacts").json()
    assert len(artifacts) == 2
    assert all(row["firmware_state"] == expected and not row["can_publish"] for row in artifacts)
    assert not h.db.rows("SELECT * FROM pruned_artifacts")
    response = h.admin_post("releases", {"artifact_id": first["id"], "channel": "stable"})
    assert response.status_code == 503
    # Release metadata remains manageable; deleting it does not modify blobs.
    response = h.admin_post(f"releases/{releases[0]['id']}/delete", {})
    assert response.status_code == 200, response.text


@pytest.mark.parametrize("error", [PermissionError, OSError])
def test_storage_errors_are_not_reported_as_deleted_and_never_archive(h, monkeypatch, error):
    artifact_id = h.upload().json()["id"]
    release = publish(h, artifact_id)
    withdraw(h, release["id"])
    artifact = h.db.one("SELECT * FROM artifacts WHERE id=?", (artifact_id,))
    expected = h.svc.blob(artifact["sha256"])
    original = Path.stat

    def fail_stat(path, *args, **kwargs):
        if path == expected:
            raise error("injected storage failure")
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "stat", fail_stat)
    row = release_rows(h)[release["id"]]
    assert row["firmware_state"] == "storage_error" and not row["can_publish"]
    assert row["pruned_at"] is None and row["can_delete"]  # Metadata-only deletion is separate.
    artifacts = h.client.get("/api/admin/artifacts").json()
    assert artifacts[0]["firmware_state"] == "storage_error"
    preview = h.client.get(f"/api/admin/artifacts/{artifact_id}/deletion")
    assert preview.status_code == 200, preview.text
    plan = preview.json()
    assert not plan["can_delete"] and plan["storage_error"]
    response = h.admin_post(f"artifacts/{artifact_id}/delete", {"preview_token": plan["preview_token"]})
    assert response.status_code == 409 and not h.db.rows("SELECT * FROM pruned_artifacts")
    with pytest.raises(Problem, match="存储"):
        h.svc.verify_blob(artifact)
    monkeypatch.setattr(Path, "stat", original)
    assert expected.read_bytes() == raw_fixture()


def test_read_failure_with_readable_metadata_does_not_archive_firmware(h, monkeypatch):
    artifact_id = h.upload().json()["id"]
    artifact = h.db.one("SELECT * FROM artifacts WHERE id=?", (artifact_id,))
    expected = h.svc.blob(artifact["sha256"])
    original = Path.open

    def fail_open(path, *args, **kwargs):
        if path == expected:
            raise PermissionError("injected read failure")
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", fail_open)
    row = h.svc.get_artifact(artifact_id)
    assert row["firmware_state"] == "storage_error" and not row["can_publish"]
    plan = h.svc.artifact_delete_preview(artifact_id)
    assert not plan["can_delete"] and plan["storage_error"]
    with pytest.raises(Problem, match="不能删除"):
        h.svc.delete_artifact(artifact_id, plan["preview_token"])
    assert not h.db.rows("SELECT * FROM pruned_artifacts")
    monkeypatch.setattr(Path, "open", original)
    assert expected.read_bytes() == raw_fixture()


def test_one_inspection_per_sha_and_cache_used_only_for_lists(h, monkeypatch):
    first = h.upload(version="V1.0.0").json()
    second = h.upload(version="V1.0.1").json()
    publish(h, first["id"])
    publish(h, second["id"])
    artifact = h.db.one("SELECT * FROM artifacts WHERE id=?", (first["id"],))
    expected = h.svc.blob(artifact["sha256"])
    original = Path.open
    reads = []

    def count_open(path, *args, **kwargs):
        if path == expected and (args[0] if args else kwargs.get("mode")) == "rb":
            reads.append(path)
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", count_open)
    assert all(row["firmware_state"] == "available" for row in release_rows(h).values())
    assert len(reads) == 1
    h.client.get("/api/admin/artifacts")
    release_rows(h)
    assert len(reads) == 1
    h.svc.verify_blob(artifact)
    assert len(reads) == 2  # Authoritative validation does not trust the cache.
    before = expected.stat()
    expected.write_bytes(raw_fixture()[:-1] + b"x")
    os.utime(expected, ns=(before.st_atime_ns, before.st_mtime_ns + 1000000))
    assert all(row["firmware_state"] == "corrupt" for row in release_rows(h).values())
    assert len(reads) == 3


@pytest.mark.parametrize("state", ["created", "confirmed", "failed", "rolled_back"])
def test_release_delete_capability_matches_strict_history_guard(h, state):
    release, device = h.publish(), h.make_device()
    row = release_rows(h)[release["id"]]
    assert not row["can_delete"] and "先撤回" in row["delete_block_reasons"][0]
    attempt = h.attempt(device, release).json()
    with h.db.transaction() as conn:
        conn.execute("UPDATE attempts SET state=?,created=? WHERE id=?", (state, time.time() - 900000, attempt["id"]))
    withdraw(h, release["id"])
    row = release_rows(h)[release["id"]]
    assert not row["can_delete"] and "1 条升级记录" in row["delete_block_reasons"][0]
    response = h.admin_post(f"releases/{release['id']}/delete", {})
    assert response.status_code == 409
    assert not h.db.rows("SELECT * FROM deleted_releases")


def test_get_artifact_returns_exact_metadata_and_deleted_state(h):
    first = h.upload(version="V1.0.0").json()
    second = h.upload(version="V1.0.0", data=raw_fixture()[:-1] + b"x").json()
    row = h.svc.get_artifact(first["id"])
    listed = {row["id"]: row for row in h.svc.list_artifacts()}
    assert row == listed[first["id"]]
    assert row["id"] != second["id"] and row["can_publish"]
    delete_artifact(h, first["id"])
    row = h.svc.get_artifact(first["id"])
    assert row["firmware_state"] == "deleted" and not row["can_publish"]
    assert not row["deletion_pending"] and row["publish_block_reasons"]
    assert h.svc.get_artifact(second["id"])["can_publish"]
    with pytest.raises(Problem, match="固件不存在") as exc:
        h.svc.get_artifact("not-present")
    assert exc.value.status == 404


def test_get_artifact_does_not_depend_on_recent_list_limit(h, monkeypatch):
    artifact = h.upload().json()
    monkeypatch.setattr(h.svc, "list_artifacts", lambda: [])
    assert h.svc.get_artifact(artifact["id"])["id"] == artifact["id"]


def test_overview_storage_failure_returns_known_size_and_warning(h, monkeypatch):
    first = h.upload().json()
    assert h.upload(data=raw_fixture()[:-1] + b"x").status_code == 200
    normal = h.svc.overview()
    assert normal["storage_bytes"] == 512 and normal["storage_warning"] is False
    artifact = h.db.one("SELECT * FROM artifacts WHERE id=?", (first["id"],))
    expected = h.svc.blob(artifact["sha256"])
    original = Path.open

    def fail_open(path, *args, **kwargs):
        if path == expected:
            raise PermissionError("injected storage failure")
        return original(path, *args, **kwargs)

    monkeypatch.setattr(Path, "open", fail_open)
    response = h.client.get("/api/admin/overview")
    assert response.status_code == 200, response.text
    result = response.json()
    assert result["storage_bytes"] == 256 and result["storage_warning"] is True
    assert result["products"] == result["targets"] == 1


def test_overview_unreadable_directory_is_not_a_silent_zero(h, monkeypatch):
    h.upload()
    expected = h.settings.data_dir / "firmware"
    original = os.scandir

    def fail_scandir(path):
        if Path(path) == expected:
            raise PermissionError("injected directory permission failure")
        return original(path)

    monkeypatch.setattr(os, "scandir", fail_scandir)
    result = h.svc.overview()
    assert result["storage_bytes"] == 0 and result["storage_warning"] is True


def test_overview_ignores_nonregular_bins_and_marks_partial_statistics(h):
    h.upload()
    (h.settings.data_dir / "firmware" / "not-a-file.bin").mkdir()
    (h.settings.data_dir / "firmware" / "irrelevant.txt").write_bytes(b"text")
    result = h.svc.overview()
    assert result["storage_bytes"] == 256 and result["storage_warning"] is True
