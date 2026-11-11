"""Durable, authenticated device commands. No commands are pushed to a socket.

Only queued/claimed commands expire. A device persists execution before acting;
an expired lease re-delivers the same ID, never creates another action.
"""
import time

from .security import canonical
from .service import Problem, uid

OPEN = ("queued", "claimed", "executing")
TERMINAL = ("succeeded", "failed", "expired")
LEASE_SECONDS = 120


def public(conn, row):
    if row is None:
        return None
    result = {name: row[name] for name in ("id", "device_id", "kind", "status", "created_at",
              "updated_at", "expires_at", "release_id", "sha256", "error")}
    attempt = conn.execute("SELECT attempt_id FROM command_attempts WHERE command_id=?", (row["id"],)).fetchone()
    result["attempt_id"] = attempt[0] if attempt else None
    return result


def expire(conn, device_id, now):
    conn.execute("""UPDATE remote_commands SET status='expired',updated_at=?,error=?
        WHERE device_id=? AND status IN ('queued','claimed') AND expires_at<=?""",
        (now, "指令已过期，设备未开始执行", device_id, now))


def capability(conn, device_id, version, now):
    conn.execute("""INSERT INTO device_remote_state(device_id,commands_version,updated) VALUES(?,?,?)
        ON CONFLICT(device_id) DO UPDATE SET commands_version=excluded.commands_version,updated=excluded.updated""",
        (device_id, version, now))


def active_release(service, device):
    found = service.db.one("SELECT id FROM releases WHERE target_id=? AND channel=? AND active=1",
                           (device["target_id"], device["channel"]))
    if not found:
        return None
    try:
        release = service.release(found["id"])
        if service.db.one("SELECT 1 FROM pruned_artifacts WHERE artifact_id=?", (release["artifact_id"],)):
            return None
        state, _ = service._inspect_firmware(release)
        return release if state == "available" else None
    except Problem as exc:
        if exc.status == 404:
            return None
        raise


def create(service, device_id, data):
    now, payload = int(time.time()), canonical(data.model_dump()).decode()
    with service._blob_lock, service.db.transaction() as conn:
        device = conn.execute("""SELECT d.*,a.revoked FROM devices d JOIN agents a ON d.agent_id=a.id
                                 WHERE d.id=?""", (device_id,)).fetchone()
        if not device:
            raise Problem(404, "设备不存在")
        # The administrator's retry always returns the original fixed target,
        # even if publication, device state or support changed in the meantime.
        expire(conn, device_id, now)
        old = conn.execute("SELECT * FROM remote_commands WHERE device_id=? AND request_id=?",
                           (device_id, data.request_id)).fetchone()
        if old:
            if old["request_payload"] != payload:
                raise Problem(409, "同一请求标识不能用于不同指令")
            return public(conn, old)
        if device["revoked"]:
            raise Problem(409, "设备凭据已停用，请先恢复设备连接")
        supported = conn.execute("SELECT commands_version FROM device_remote_state WHERE device_id=?", (device_id,)).fetchone()
        if not supported or supported[0] != 1:
            raise Problem(409, "请先升级设备固件，当前设备尚未支持远程指令")
        if conn.execute("SELECT 1 FROM remote_commands WHERE device_id=? AND status IN ('queued','claimed','executing')",
                        (device_id,)).fetchone():
            raise Problem(409, "设备已有未完成指令，请等待执行结果")
        if conn.execute("SELECT 1 FROM attempts WHERE device_id=? AND state NOT IN ('confirmed','failed','rolled_back')",
                        (device_id,)).fetchone():
            raise Problem(409, "设备正在升级，请等待启动确认或失败回报")
        release = None
        if data.kind == "ota.install":
            release = active_release(service, device)
            if release is None:
                raise Problem(409, "此设备通道没有可用的已发布固件")
            if data.expected_release_id is not None and (release["id"] != data.expected_release_id
                                                        or release["sha256"] != data.expected_sha256):
                raise Problem(409, "发布已变化，请重新确认要安装的固件")
            service.verify_blob(release)
            if device["current_sha256"] == release["sha256"]:
                raise Problem(409, "设备已安装此固件，无需重复升级")
        identity = uid()
        conn.execute("""INSERT INTO remote_commands(id,device_id,request_id,request_payload,kind,status,
            release_id,sha256,created_at,updated_at,expires_at) VALUES(?,?,?,?,?,'queued',?,?,?,?,?)""",
            (identity, device_id, data.request_id, payload, data.kind, release["id"] if release else None,
             release["sha256"] if release else None, now, now, now + data.ttl_seconds))
        service.audit(conn, "command.created", identity)
        return public(conn, conn.execute("SELECT * FROM remote_commands WHERE id=?", (identity,)).fetchone())


def listing(service, device_id):
    with service._blob_lock, service.db.transaction() as conn:
        device = conn.execute("SELECT * FROM devices WHERE id=?", (device_id,)).fetchone()
        if device is None:
            raise Problem(404, "设备不存在")
        expire(conn, device_id, int(time.time()))
        rows = conn.execute("SELECT * FROM remote_commands WHERE device_id=? ORDER BY created_at DESC,rowid DESC LIMIT 100",
                            (device_id,)).fetchall()
        release = active_release(service, device)
        diagnostic = conn.execute("SELECT * FROM last_upgrade_failure WHERE device_id=?", (device_id,)).fetchone()
        return {"commands": [public(conn, row) for row in rows],
                "last_upgrade_failure": dict(diagnostic) if diagnostic else None,
                "available_release": {name: release[name] for name in ("id", "version", "sha256")} if release else None}


def decorate_devices(service, devices):
    with service.db.transaction() as conn:
        now = int(time.time())
        for device in devices:
            expire(conn, device["id"], now)
            supported = conn.execute("SELECT commands_version FROM device_remote_state WHERE device_id=?", (device["id"],)).fetchone()
            device["remote_commands_version"] = supported[0] if supported else 0
            latest = conn.execute("SELECT * FROM remote_commands WHERE device_id=? ORDER BY created_at DESC,rowid DESC LIMIT 1",
                                  (device["id"],)).fetchone()
            device["latest_command"] = public(conn, latest)
    return devices


def claim(service, agent, data):
    device = service.device(agent, data.device_id)
    now = int(time.time())
    with service._blob_lock, service.db.transaction() as conn:
        capability(conn, device["id"], 1, now)
        conn.execute("UPDATE devices SET last_seen=? WHERE id=?", (now, device["id"]))
        expire(conn, device["id"], now)
        row = conn.execute("SELECT * FROM remote_commands WHERE device_id=? AND status IN ('queued','claimed','executing')",
                           (device["id"],)).fetchone()
        if row is None or row["lease_until"] > now:
            return {"command": None}
        if row["status"] != "executing" and row["kind"] == "ota.install":
            current = active_release(service, device)
            if not current or current["id"] != row["release_id"] or current["sha256"] != row["sha256"]:
                conn.execute("UPDATE remote_commands SET status='failed',error=?,updated_at=? WHERE id=?",
                             ("发布已变化或文件不可用，请重新下发升级", now, row["id"]))
                return {"command": None}
        status = "claimed" if row["status"] == "queued" else row["status"]
        conn.execute("UPDATE remote_commands SET status=?,lease_until=?,updated_at=? WHERE id=?",
                     (status, now + LEASE_SECONDS, now, row["id"]))
        return {"command": public(conn, conn.execute("SELECT * FROM remote_commands WHERE id=?", (row["id"],)).fetchone())}


def report(service, agent, identity, data):
    service.device(agent, data.device_id)
    now = int(time.time())
    with service.db.transaction() as conn:
        expire(conn, data.device_id, now)
        row = conn.execute("SELECT * FROM remote_commands WHERE id=? AND device_id=?", (identity, data.device_id)).fetchone()
        if row is None:
            raise Problem(404, "指令不存在或设备未授权")
        # Terminal ACK retries never reopen a command or overwrite its outcome.
        if row["status"] in TERMINAL:
            return {"ok": True, "status": row["status"], "duplicate": True}
        mapping = conn.execute("SELECT attempt_id FROM command_attempts WHERE command_id=?", (identity,)).fetchone()
        if data.attempt_id is not None and (not mapping or mapping[0] != data.attempt_id):
            raise Problem(409, "升级记录不属于此指令")
        if data.status == "executing":
            if row["status"] not in ("claimed", "executing"):
                raise Problem(409, "指令尚未被领取")
            if row["executing_boot_id"] and row["executing_boot_id"] != data.boot_id:
                raise Problem(409, "此指令已在其他启动中执行，不能再次执行")
            conn.execute("UPDATE remote_commands SET status='executing',executing_boot_id=?,updated_at=? WHERE id=?",
                         (data.boot_id, now, identity))
        else:
            if row["status"] not in ("claimed", "executing"):
                raise Problem(409, "指令尚未被领取")
            if data.status == "succeeded":
                if row["status"] != "executing":
                    raise Problem(409, "尚未开始执行，不能确认成功")
                if row["kind"] == "device.restart" and data.boot_id == row["executing_boot_id"]:
                    raise Problem(409, "设备尚未完成重启，不能确认成功")
                if row["kind"] == "ota.install" and data.sha256 != row["sha256"]:
                    raise Problem(409, "已安装固件摘要与指令不匹配")
                if row["kind"] == "ota.install" and mapping:
                    # If an attempt exists, only native boot confirmation may
                    # settle it; a command report cannot bypass that journal.
                    attempt = conn.execute("SELECT state FROM attempts WHERE id=?", (mapping[0],)).fetchone()
                    if not attempt or attempt[0] != "confirmed":
                        raise Problem(409, "升级尚未完成启动确认")
            conn.execute("UPDATE remote_commands SET status=?,error=?,updated_at=? WHERE id=?",
                         (data.status, data.error if data.status == "failed" else "", now, identity))
        return {"ok": True, "status": data.status, "duplicate": False}


def bind_attempt(conn, info, release, attempt):
    """Called in the attempt transaction, before its durable creation/return."""
    old = conn.execute("SELECT command_id FROM command_attempts WHERE attempt_id=?", (attempt["id"],)).fetchone()
    if old and old[0] != info.command_id:
        raise Problem(409, "同一升级请求不能更换远程指令")
    if info.command_id is None:
        return
    command = conn.execute("SELECT * FROM remote_commands WHERE id=? AND device_id=?", (info.command_id, info.device_id)).fetchone()
    if not command:
        raise Problem(404, "远程升级指令不存在或未授权")
    if command["kind"] != "ota.install" or command["release_id"] != info.release_id or command["sha256"] != release["sha256"]:
        raise Problem(409, "升级目标与远程指令不匹配")
    linked = conn.execute("SELECT attempt_id FROM command_attempts WHERE command_id=?", (info.command_id,)).fetchone()
    if linked:
        if linked[0] != attempt["id"]:
            raise Problem(409, "远程指令已经关联其他升级请求")
        return
    if command["status"] != "executing":
        raise Problem(409, "远程指令尚未获准执行或已经结束")
    conn.execute("INSERT INTO command_attempts(command_id,attempt_id) VALUES(?,?)", (info.command_id, attempt["id"]))


def finish_attempt(conn, attempt_id, state, error):
    if state not in ("confirmed", "failed", "rolled_back"):
        return
    conn.execute("""UPDATE remote_commands SET status=?,error=?,updated_at=?
        WHERE id=(SELECT command_id FROM command_attempts WHERE attempt_id=?)
        AND status IN ('claimed','executing')""",
        ("succeeded" if state == "confirmed" else "failed", "" if state == "confirmed" else error,
         int(time.time()), attempt_id))
