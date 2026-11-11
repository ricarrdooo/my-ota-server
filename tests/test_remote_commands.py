"""Remote command protocol against disposable SQLite databases and fixtures."""
from concurrent.futures import ThreadPoolExecutor
import time
import uuid

import pytest
from fastapi.testclient import TestClient

from conftest import raw_fixture
from ota_server.app import create_app
from ota_server.config import Settings
from ota_server.models import CommandInput
from ota_server import commands


BOOT = "1" * 32
REBOOT = "2" * 32


def claim(h, device, boot=BOOT):
    return h.client.post("/api/v1/devices/commands/claim", headers=h.auth(device),
        json={"device_id": device["id"], "boot_id": boot, "remote_commands_version": 1})


def supported(h):
    device = h.make_device()
    assert claim(h, device).json() == {"command": None}
    return device


def create(h, device, kind="device.restart", **changes):
    body = dict(kind=kind, request_id=uuid.uuid4().hex, ttl_seconds=900)
    body.update(changes)
    return h.admin_post(f"devices/{device['id']}/commands", body)


def report(h, device, command, status, boot=BOOT, **changes):
    return h.client.post(f"/api/v1/devices/commands/{command['id']}/events", headers=h.auth(device),
        json=dict(device_id=device["id"], boot_id=boot, status=status, **changes))


def state(h, command):
    return h.db.one("SELECT * FROM remote_commands WHERE id=?", (command["id"],))


def test_restart_persistence_success_boot_proof_and_terminal_idempotency(h):
    device = supported(h)
    cmd = create(h, device).json()
    assert cmd["status"] == "queued" and cmd["release_id"] is None
    assert cmd["expires_at"] - cmd["created_at"] == 900
    assert claim(h, device).json()["command"]["id"] == cmd["id"]
    assert claim(h, device).json()["command"] is None
    assert report(h, device, cmd, "succeeded", boot=REBOOT).status_code == 409
    assert report(h, device, cmd, "executing").status_code == 200
    assert report(h, device, cmd, "executing").json()["status"] == "executing"
    assert report(h, device, cmd, "executing", boot=REBOOT).status_code == 409
    assert report(h, device, cmd, "succeeded").status_code == 409
    # Recreate the backend over the same isolated database, preserving leases.
    app = create_app(h.settings)
    with TestClient(app) as client:
        response = client.post(f"/api/v1/devices/commands/{cmd['id']}/events", headers=h.auth(device),
            json=dict(device_id=device["id"], boot_id=REBOOT, status="succeeded"))
        assert response.status_code == 200 and response.json()["status"] == "succeeded"
    assert report(h, device, cmd, "succeeded", boot=REBOOT).json()["duplicate"]
    assert report(h, device, cmd, "failed", error="late failure").json()["status"] == "succeeded"
    assert claim(h, device).json()["command"] is None


def test_admin_request_retries_return_original_and_only_one_open_command(h):
    device = supported(h)
    request_id = uuid.uuid4().hex
    one = create(h, device, request_id=request_id)
    retry = create(h, device, request_id=request_id)
    assert one.status_code == retry.status_code == 200 and one.json() == retry.json()
    assert create(h, device).status_code == 409
    assert create(h, device, kind="ota.install", request_id=request_id).status_code == 409
    cmd = one.json()
    claim(h, device)
    report(h, device, cmd, "failed", error="local NVS unavailable")
    assert create(h, device, request_id=request_id).json()["status"] == "failed"
    assert len(h.db.rows("SELECT id FROM remote_commands")) == 1
    assert create(h, device).status_code == 200


def test_concurrent_administrator_create_is_serialized(h):
    device = supported(h)
    data = CommandInput(kind="device.restart", request_id=uuid.uuid4().hex)
    with ThreadPoolExecutor(max_workers=4) as pool:
        values = list(pool.map(lambda _: commands.create(h.svc, device["id"], data), range(4)))
    assert len({value["id"] for value in values}) == 1
    assert len(h.db.rows("SELECT id FROM remote_commands")) == 1


@pytest.mark.parametrize("status", ["queued", "claimed"])
def test_expired_unstarted_command_never_executes(h, status):
    device = supported(h)
    cmd = create(h, device).json()
    with h.db.transaction() as conn:
        conn.execute("UPDATE remote_commands SET status=?,expires_at=0", (status,))
    assert claim(h, device).json()["command"] is None
    assert state(h, cmd)["status"] == "expired"
    assert report(h, device, cmd, "executing").json()["status"] == "expired"
    assert report(h, device, cmd, "succeeded", boot=REBOOT).json()["status"] == "expired"
    assert create(h, device).status_code == 200


def test_expired_lease_redelivers_same_command_without_repeating_action(h):
    device = supported(h)
    cmd = create(h, device).json()
    assert claim(h, device).json()["command"]["id"] == cmd["id"]
    report(h, device, cmd, "executing")
    with h.db.transaction() as conn:
        conn.execute("UPDATE remote_commands SET lease_until=0,expires_at=0")
    # Execution may finish after its start deadline. A changed boot cannot
    # acquire another executing permission, but can report its reboot result.
    again = claim(h, device, boot=REBOOT).json()["command"]
    assert again["id"] == cmd["id"] and again["status"] == "executing"
    assert report(h, device, cmd, "executing", boot=REBOOT).status_code == 409
    assert report(h, device, cmd, "succeeded", boot=REBOOT).json()["status"] == "succeeded"


def test_command_routes_auth_scope_and_validation(h):
    one, two = supported(h), supported(h)
    cmd = create(h, one).json()
    assert h.client.post(f"/api/admin/devices/{one['id']}/commands", json={"kind": "device.restart", "request_id": "1"*32}).status_code == 403
    with TestClient(h.app) as stranger:
        assert stranger.get(f"/api/admin/devices/{one['id']}/commands").status_code == 401
        assert stranger.post("/api/v1/devices/commands/claim", json={"device_id":one["id"],"boot_id":BOOT,"remote_commands_version":1}).status_code == 401
    wrong = dict(two, id=one["id"])
    assert claim(h, wrong).status_code == 404
    assert report(h, two, cmd, "failed").status_code == 404
    assert create(h, one, ttl_seconds=0).status_code == 422
    assert create(h, one, kind="shell.run").status_code == 422
    assert create(h, one, request_id="unbounded identifier").status_code == 422
    assert h.client.post("/api/v1/devices/commands/claim", headers=h.auth(one), json={"device_id":one["id"],"boot_id":"bad","remote_commands_version":1}).status_code == 422
    h.admin_post(f"agents/{one['agent_id']}/revoke")
    assert claim(h, one).status_code == 401


def test_support_registration_old_heartbeat_and_admin_summary(h):
    device = h.make_device()
    assert create(h, device).status_code == 409
    hb = dict(device_id=device["id"], version="V1.0.7", sha256="a"*64, remote_commands_version=1)
    assert h.client.post("/api/v1/devices/heartbeat", headers=h.auth(device), json=hb).status_code == 200
    cmd = create(h, device).json()
    listing = h.client.get("/api/admin/devices").json()[0]
    assert listing["remote_commands_version"] == 1 and listing["latest_command"]["id"] == cmd["id"]
    assert device["token"] not in str(listing)
    hb.pop("remote_commands_version")
    assert h.client.post("/api/v1/devices/heartbeat", headers=h.auth(device), json=hb).status_code == 200
    assert h.client.get("/api/admin/devices").json()[0]["remote_commands_version"] == 0


def test_upgrade_command_binds_published_identity_and_checks_confirmation(h):
    device = supported(h)
    release = h.publish()
    offered = h.check(device).json()
    cmd = create(h, device, "ota.install", expected_release_id=release["id"], expected_sha256=offered["manifest"]["sha256"]).json()
    assert cmd["release_id"] == release["id"] and cmd["sha256"] == offered["manifest"]["sha256"]
    listed = h.client.get(f"/api/admin/devices/{device['id']}/commands").json()
    assert listed["available_release"]["id"] == release["id"] and listed["commands"][0]["id"] == cmd["id"]
    claim(h, device)
    assert report(h, device, cmd, "executing").status_code == 200
    body = dict(h.compat(device), release_id=release["id"], request_id=cmd["id"], command_id=cmd["id"])
    path = "/api/v1/ota/attempts"
    response = h.client.post(path, headers=h.auth(device), json=body)
    assert response.status_code == 200, response.text
    attempt = response.json()
    assert h.client.post(path, headers=h.auth(device), json=body).json()["id"] == attempt["id"]
    assert report(h, device, cmd, "succeeded", sha256=cmd["sha256"]).status_code == 409
    assert h.client.get(offered["download_path"], params={"attempt_id":attempt["id"]}, headers=h.auth(device)).content == raw_fixture()
    states = ["downloading", "downloaded", "validating", "installing", "pending_boot", "confirmed"]
    for seq, phase in enumerate(states, 1):
        event = dict(seq=seq, state=phase)
        if phase == "confirmed": event.update(version=offered["manifest"]["version"], sha256=cmd["sha256"])
        response = h.client.post(f"/api/v1/ota/attempts/{attempt['id']}/events", headers=h.auth(device),json=event)
        assert response.status_code == 200,response.text
    assert state(h, cmd)["status"] == "succeeded"
    command_timeline = h.client.get(f"/api/admin/commands/{cmd['id']}/timeline").json()
    attempt_timeline = h.client.get(f"/api/admin/attempts/{attempt['id']}/timeline").json()
    assert command_timeline == attempt_timeline
    assert command_timeline["terminal"] is True
    assert [step["stage"] for step in command_timeline["steps"]] == ["queued","claimed","executing","created",*states]
    assert report(h, device, cmd, "succeeded", sha256=cmd["sha256"]).json()["duplicate"]
    assert create(h, device, "ota.install").status_code == 409  # Already installed.


@pytest.mark.parametrize("phase", ["created", "pending_boot"])
def test_failed_or_rollback_attempt_completes_command_even_from_old_firmware(h, phase):
    device, release = supported(h), h.publish()
    cmd = create(h, device, "ota.install").json()
    claim(h, device);report(h, device, cmd, "executing")
    body = dict(h.compat(device), release_id=release["id"], request_id=cmd["id"], command_id=cmd["id"])
    attempt = h.client.post("/api/v1/ota/attempts", headers=h.auth(device), json=body).json()
    # An old baseline after native rollback knows only its persisted attempt,
    # not the new command protocol, so terminal OTA events must settle it.
    with h.db.transaction() as conn: conn.execute("UPDATE attempts SET state=? WHERE id=?", (phase, attempt["id"]))
    response = h.client.post(f"/api/v1/ota/attempts/{attempt['id']}/events", headers=h.auth(device),
                             json={"seq":1,"state":"failed","error":"Rolled back to previous firmware"})
    assert response.status_code == 200
    assert state(h, cmd)["status"] == "failed" and "Rolled back" in state(h, cmd)["error"]


def test_changed_release_never_silently_installs_another_target(h):
    device = supported(h)
    first = h.publish()
    cmd = create(h, device, "ota.install").json()
    h.publish(data=raw_fixture(512), version="1.0.1")
    assert claim(h, device).json()["command"] is None
    assert state(h, cmd)["status"] == "failed"
    assert create(h, device, "ota.install", expected_release_id=first["id"], expected_sha256=cmd["sha256"]).status_code == 409
    # Commands cannot bind an attempt to a newly published replacement either.
    assert report(h, device, cmd, "executing").json()["status"] == "failed"


def test_attempt_cannot_change_or_cross_bind_command(h):
    device, other = supported(h), supported(h)
    release = h.publish()
    cmd = create(h, device, "ota.install").json()
    claim(h, device);report(h, device, cmd, "executing")
    body = dict(h.compat(other),release_id=release["id"],request_id=cmd["id"],command_id=cmd["id"])
    assert h.client.post("/api/v1/ota/attempts", headers=h.auth(other),json=body).status_code==404
    body.update(h.compat(device))
    r=h.client.post("/api/v1/ota/attempts",headers=h.auth(device),json=body)
    assert r.status_code==200
    body.pop("command_id")
    assert h.client.post("/api/v1/ota/attempts",headers=h.auth(device),json=body).status_code==409
    assert len(h.db.rows("SELECT id FROM attempts")) == 1


def test_restart_blocked_during_unfinished_manual_ota_and_metadata_keeps_history(h):
    device, release = supported(h), h.publish()
    assert h.attempt(device, release).status_code == 200
    assert create(h, device).status_code == 409


def test_missing_unpublished_corrupt_or_pruned_firmware_cannot_be_queued(h):
    device = supported(h)
    assert create(h, device, "ota.install").status_code == 409
    h.publish()
    release=h.check(device).json()
    h.svc.blob(release["manifest"]["sha256"]).write_bytes(b"corrupt")
    assert create(h, device, "ota.install").status_code == 409


def test_pending_install_pins_its_artifact_until_command_finishes(h):
    device=supported(h)
    release=h.publish()
    cmd=create(h,device,"ota.install").json()
    artifact_id=h.svc.release(release["id"])["artifact_id"]
    assert h.admin_post(f"releases/{release['id']}/withdraw").status_code==200
    preview=h.svc.artifact_delete_preview(artifact_id)
    assert not preview["can_delete"] and any("指令" in x for x in preview["reasons"])
    assert claim(h,device).json()["command"] is None  # Withdrawn target fails before execution.
    assert state(h,cmd)["status"]=="failed"
    assert h.svc.artifact_delete_preview(artifact_id)["can_delete"]


def test_additive_schema_upgrade_preserves_existing_devices_and_credentials(h):
    device = h.make_device()
    with h.db.transaction() as conn:
        conn.execute("DROP TABLE command_attempts")
        conn.execute("DROP TABLE remote_commands")
        conn.execute("DROP TABLE device_remote_state")
    app = create_app(h.settings)
    assert app.state.db.one("SELECT agent_id FROM devices WHERE id=?",(device["id"],))["agent_id"]==device["agent_id"]
    with TestClient(app) as client:
        res=client.post("/api/v1/devices/commands/claim",headers=h.auth(device),
                        json={"device_id":device["id"],"boot_id":BOOT,"remote_commands_version":1})
        assert res.status_code==200 and res.json()=={"command":None}


def test_lan_command_routes_keep_device_auth_and_never_expose_admin(h):
    device=supported(h)
    cmd=create(h,device).json()
    app=create_app(Settings(h.settings.data_dir,"http://127.0.0.1:8000",lan_http_host="192.168.10.187"))
    with TestClient(app,base_url="http://192.168.10.187:8000",client=("192.168.10.88",49152)) as client:
        body={"device_id":device["id"],"boot_id":BOOT,"remote_commands_version":1}
        path="/api/v1/devices/commands/claim"
        assert client.post(path,json=body).status_code==401
        assert client.post(path,json=body,headers=h.auth(device)).json()["command"]["id"]==cmd["id"]
        event=dict(device_id=device["id"],boot_id=BOOT,status="executing")
        assert client.post(f"/api/v1/devices/commands/{cmd['id']}/events",json=event,headers=h.auth(device)).status_code==200
        assert client.get(f"/api/admin/devices/{device['id']}/commands").status_code==403


def test_device_metadata_cannot_delete_command_history(h):
    device=supported(h)
    cmd=create(h,device).json()
    claim(h,device);report(h,device,cmd,"failed",error="device unavailable")
    response=h.admin_post(f"devices/{device['id']}/delete",{})
    assert response.status_code==409 and "远程指令" in response.text


def test_early_failure_timeline_and_diagnostic_replay(h):
    device=supported(h)
    h.publish()
    cmd=create(h,device,"ota.install").json()
    url=f"/api/admin/commands/{cmd['id']}/timeline"
    assert [s["stage"] for s in h.client.get(url).json()["steps"]] == ["queued"]
    claim(h,device)
    report(h,device,cmd,"executing")
    report(h,device,cmd,"failed",error="manifest request failed: ESP_ERR_TIMEOUT (HTTP 0)")
    value=h.client.get(url).json()
    assert value["attempt_id"] is None and value["terminal"]
    assert [s["stage"] for s in value["steps"]] == ["queued","claimed","executing","failed"]
    payload=dict(device_id=device["id"],report_id="f"*32,stage="manifest request",error_code="ESP_ERR_TIMEOUT",
                 http_status=0,progress=0,occurred=0)
    report_url="/api/v1/devices/upgrade-failure"
    other=h.make_device()
    assert h.client.post(report_url,headers=h.auth(other),json=payload).status_code in (403,404)
    assert h.client.post(report_url,headers=h.auth(device),json=payload).json()["report_id"]==payload["report_id"]
    history=f"/api/admin/devices/{device['id']}/commands"
    first=h.client.get(history).json()["last_upgrade_failure"]
    assert first["http_status"]==0 and first["stage"]=="manifest request"
    assert h.client.post(report_url,headers=h.auth(device),json=payload).status_code==200
    assert h.client.get(history).json()["last_upgrade_failure"]==first
    assert not h.client.get(f"/api/admin/devices/{other['id']}/commands").json()["last_upgrade_failure"]
    # Existing installations do not have claim/execute timestamps for past jobs.
    with h.db.transaction() as conn:
        conn.execute("DELETE FROM command_steps WHERE command_id=?", (cmd["id"],))
    assert [s["stage"] for s in h.client.get(url).json()["steps"]] == ["queued","failed"]
