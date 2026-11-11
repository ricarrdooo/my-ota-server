import hashlib
import json
import os
from pathlib import Path
import sqlite3
import time
import uuid
import threading
import stat
from collections import OrderedDict
from functools import wraps

from .adapters import validate_image
from .models import Manifest, version_tuple
from .security import canonical, key_fingerprint, opaque_token, public_key, token_digest, verify_manifest


class Problem(Exception):
    def __init__(self, status, message):
        self.status, self.message = status, message


def uid():
    return uuid.uuid4().hex


def unpack_target(row):
    return dict(row, config=json.loads(row["config"]), capabilities=json.loads(row["capabilities"]))


def profile(target):
    return {name: target[name] for name in ("id", "product_id", "adapter", "mcu", "hw_revision", "layout_id",
                                           "max_size", "key_id", "min_bootloader", "capabilities", "config")}


def fingerprint(target):
    return hashlib.sha256(canonical(profile(target))).hexdigest()


TRANSITIONS = {
    "created": {"downloading", "failed"},
    "downloading": {"downloading", "downloaded", "failed"},
    "downloaded": {"transferring", "validating", "failed"},
    "transferring": {"transferring", "validating", "failed"},
    "validating": {"installing", "failed"},
    "installing": {"pending_boot", "failed"},
    "pending_boot": {"confirmed", "rolled_back", "failed"},
    "confirmed": set(), "failed": set(), "rolled_back": set(),
}

# Static table/column definitions only, never identifiers from request bodies.
MANAGED = {
    "products": ("产品", [("targets", "product_id", "硬件型号"), ("signing_keys", "product_id", "签名公钥")]),
    "targets": ("硬件型号", [("devices", "target_id", "设备"), ("artifacts", "target_id", "固件及历史"),
                          ("releases", "target_id", "发布记录")]),
    "keys": ("签名公钥", [("targets", "key_id", "硬件型号"), ("artifacts", "key_id", "固件及历史")]),
    "devices": ("设备", [("attempts", "device_id", "升级记录"), ("remote_commands", "device_id", "远程指令记录")]),
    "gateways": ("网关", [("devices", "agent_id", "授权子设备")]),
}


def serialized_blobs(function):
    @wraps(function)
    def locked(self, *args, **kwargs):
        with self._blob_lock:
            return function(self, *args, **kwargs)
    return locked


class Service:
    def __init__(self, db, settings):
        self.db, self.settings = db, settings
        # The service is deliberately single-process. Serialize file creation,
        # publication and reclamation; pin actual HTTP streams until completion.
        self._blob_lock = threading.RLock()
        self._downloads = {}
        # Admin lists refresh frequently. Cache only their content inspection,
        # never the authoritative verification before publication/download.
        self._firmware_checks = OrderedDict()

    def target(self, target_id):
        row = self.db.one("SELECT * FROM targets WHERE id=?", (target_id,))
        if not row:
            raise Problem(404, "硬件型号不存在")
        return unpack_target(row)

    def device(self, agent, device_id):
        row = self.db.one("SELECT * FROM devices WHERE id=? AND agent_id=?", (device_id, agent["id"]))
        if not row:
            raise Problem(404, "设备不存在或未授权")
        return row

    def blob(self, digest):
        # Digests come only from validated manifests/database, not arbitrary paths.
        if len(digest) != 64 or any(c not in "0123456789abcdef" for c in digest):
            raise Problem(500, "固件存储索引错误")
        return self.settings.data_dir / "firmware" / (digest + ".bin")

    def audit(self, conn, action, object_id):
        conn.execute("INSERT INTO audit(action,object_id,created) VALUES(?,?,?)", (action, object_id, time.time()))

    def add_product(self, data):
        with self.db.transaction() as conn:
            conn.execute("INSERT INTO products VALUES(?,?,?,?)", (data.id, data.name, data.description, time.time()))
            self.audit(conn, "product.created", data.id)
        return data.model_dump()

    def update_metadata(self, kind, identity, data):
        label, _ = MANAGED[kind]
        table = {"keys": "signing_keys", "gateways": "agents"}.get(kind, kind)
        where = "id=? AND kind='gateway'" if kind == "gateways" else "id=?"
        values = data.model_dump()
        assignments = "name=?,description=?" if kind == "products" else "name=?"
        fields = (values["name"], values["description"]) if kind == "products" else (values["name"],)
        with self.db.transaction() as conn:
            if not conn.execute(f"UPDATE {table} SET {assignments} WHERE {where}", (*fields, identity)).rowcount:
                raise Problem(404, label + "不存在")
            # Direct devices have a separate credential identity; keep its label in sync.
            if kind == "devices":
                conn.execute("UPDATE agents SET name=? WHERE kind='device' AND id=(SELECT agent_id FROM devices WHERE id=?)",
                             (values["name"], identity))
            self.audit(conn, kind + ".updated", identity)
        return dict(id=identity, **values)

    @serialized_blobs
    def delete_metadata(self, kind, identity):
        label, dependencies = MANAGED[kind]
        table = {"keys": "signing_keys", "gateways": "agents"}.get(kind, kind)
        where = "id=? AND kind='gateway'" if kind == "gateways" else "id=?"
        with self.db.transaction() as conn:
            row = conn.execute(f"SELECT * FROM {table} WHERE {where}", (identity,)).fetchone()
            if row is None:
                raise Problem(404, label + "不存在")
            used = []
            for related, column, description in dependencies:
                count = conn.execute(f"SELECT COUNT(*) FROM {related} WHERE {column}=?", (identity,)).fetchone()[0]
                if count:
                    used.append(f"{count} 条{description}")
            if used:
                raise Problem(409, label + "仍关联" + "、".join(used) + "，不能删除；不会级联删除关联数据")
            conn.execute(f"DELETE FROM {table} WHERE {where}", (identity,))
            if kind == "devices":
                conn.execute("DELETE FROM agents WHERE id=? AND kind='device'", (row["agent_id"],))
            self.audit(conn, kind + ".deleted", identity)
        return {"ok": True, "id": identity}

    def add_key(self, data):
        try:
            key = public_key(data.pem)
            key_id = key_fingerprint(key)
        except (ValueError, TypeError, UnicodeError) as exc:
            raise Problem(400, "请输入有效的 RSA-3072/4096 公钥 PEM，不能上传私钥") from exc
        with self.db.transaction() as conn:
            conn.execute("INSERT INTO signing_keys(id,product_id,name,pem,created) VALUES(?,?,?,?,?)",
                         (key_id, data.product_id, data.name, data.pem, time.time()))
            self.audit(conn, "key.created", key_id)
        return {"id": key_id, "name": data.name}

    def add_target(self, data):
        key = self.db.one("SELECT * FROM signing_keys WHERE id=? AND product_id=? AND revoked=0", (data.key_id, data.product_id))
        if not key:
            raise Problem(400, "请选择属于此产品且未吊销的签名公钥")
        if data.max_size > self.settings.max_upload:
            raise Problem(400, "硬件容量超过服务全局上传上限")
        with self.db.transaction() as conn:
            conn.execute("INSERT INTO targets VALUES(?,?,?,?,?,?,?,?,?,?,?,?,?)",
                         (data.id, data.product_id, data.name, data.adapter, data.mcu, data.hw_revision,
                          data.layout_id, data.max_size, data.key_id, data.min_bootloader,
                          canonical(sorted(data.capabilities)).decode(), canonical(data.config).decode(), time.time()))
            self.audit(conn, "target.created", data.id)
        return self.target(data.id)

    def add_gateway(self, data):
        identity, token = uid(), opaque_token()
        with self.db.transaction() as conn:
            conn.execute("INSERT INTO agents(id,name,kind,token_hash,created) VALUES(?,?,?,?,?)",
                         (identity, data.name, "gateway", token_digest(token), time.time()))
            self.audit(conn, "gateway.created", identity)
        return {"id": identity, "token": token, "kind": "gateway"}

    def add_device(self, data):
        self.target(data.target_id)
        identity, token = uid(), None
        with self.db.transaction() as conn:
            if data.gateway_id:
                gateway = conn.execute("SELECT * FROM agents WHERE id=? AND kind='gateway' AND revoked=0", (data.gateway_id,)).fetchone()
                if not gateway:
                    raise Problem(400, "网关不存在或已停用")
                agent_id = data.gateway_id
            else:
                agent_id, token = uid(), opaque_token()
                conn.execute("INSERT INTO agents(id,name,kind,token_hash,created) VALUES(?,?,?,?,?)",
                             (agent_id, data.name, "device", token_digest(token), time.time()))
            conn.execute("INSERT INTO devices(id,name,target_id,agent_id,channel,created) VALUES(?,?,?,?,?,?)",
                         (identity, data.name, data.target_id, agent_id, data.channel, time.time()))
            self.audit(conn, "device.created", identity)
        return {"id": identity, "agent_id": agent_id, "token": token, "gateway_id": data.gateway_id}

    @serialized_blobs
    def upload(self, manifest_value, signature, staged, notes):
        try:
            manifest = Manifest.model_validate(manifest_value)
        except ValueError as exc:
            raise Problem(400, "签名清单字段不完整或格式错误") from exc
        target = self.target(manifest.target_id)
        key = self.db.one("SELECT * FROM signing_keys WHERE id=? AND revoked=0", (target["key_id"],))
        if not key:
            raise Problem(400, "目标签名公钥已吊销")
        expected = {
            "product_id": target["product_id"], "target_fingerprint": fingerprint(target),
            "mcu": target["mcu"], "hw_revision": target["hw_revision"], "layout_id": target["layout_id"],
            "image_format": target["adapter"], "key_id": target["key_id"],
            "min_bootloader_version": target["min_bootloader"], "required_capabilities": sorted(target["capabilities"]),
        }
        value = manifest.model_dump()
        if any(value[name] != expected_value for name, expected_value in expected.items()):
            raise Problem(400, "清单与硬件配置不匹配，请重新导出目标配置后签名")
        if manifest.size > target["max_size"] or Path(staged).stat().st_size != manifest.size:
            raise Problem(400, "文件大小与清单不符或超过硬件容量")
        data = Path(staged).read_bytes()  # Bounded above by both the request and target limits.
        if hashlib.sha256(data).hexdigest() != manifest.sha256:
            raise Problem(400, "固件文件 SHA-256 与签名清单不符")
        try:
            verify_manifest(value, signature, key["pem"])
            details = validate_image(data, target["adapter"], target["config"])
        except ValueError as exc:
            raise Problem(400, str(exc)) from exc
        if "native_version" in details and details["native_version"] != manifest.version:
            raise Problem(400, "清单版本必须与镜像内置版本一致")
        identity = uid()
        # A crash after the atomic rename can only leave an unreferenced complete blob.
        # The existing published artifact is never overwritten, even for identical uploads.
        with self.db.transaction() as conn:
            old = conn.execute("SELECT id FROM artifacts WHERE target_id=? AND sha256=? AND manifest=?",
                               (target["id"], manifest.sha256, canonical(value).decode())).fetchone()
            blob = self.blob(manifest.sha256)
            if blob.exists():
                if hashlib.sha256(blob.read_bytes()).hexdigest() != manifest.sha256:
                    raise Problem(409, "已有固件存储校验失败，请恢复备份")
            else:
                Path(staged).replace(blob)
            if old:
                restored = conn.execute("DELETE FROM pruned_artifacts WHERE artifact_id=?", (old["id"],)).rowcount > 0
                if restored:
                    conn.execute("UPDATE artifacts SET created=? WHERE id=?", (time.time(), old["id"]))
                    self.audit(conn, "artifact.restored", old["id"])
                return {"id": old["id"], "duplicate": True, "restored": restored}
            conn.execute("INSERT INTO artifacts VALUES(?,?,?,?,?,?,?,?,?,?,?)",
                         (identity, target["id"], manifest.version, manifest.sha256, manifest.size,
                          canonical(value).decode(), signature, manifest.key_id, canonical(details).decode(), notes, time.time()))
            self.audit(conn, "artifact.uploaded", identity)
        return {"id": identity, "duplicate": False}

    @serialized_blobs
    def publish(self, data):
        artifact = self.db.one("SELECT a.*,k.revoked FROM artifacts a JOIN signing_keys k ON a.key_id=k.id WHERE a.id=?", (data.artifact_id,))
        if not artifact or artifact["revoked"]:
            raise Problem(400, "固件不存在或签名公钥已吊销")
        self.verify_blob(artifact)
        identity = uid()
        with self.db.transaction() as conn:
            if not conn.execute("SELECT id FROM signing_keys WHERE id=? AND revoked=0", (artifact["key_id"],)).fetchone():
                raise Problem(409, "签名公钥已吊销，发布已停止")
            seq = conn.execute("SELECT COALESCE(MAX(seq),0)+1 FROM releases WHERE target_id=? AND channel=?",
                               (artifact["target_id"], data.channel)).fetchone()[0]
            conn.execute("UPDATE releases SET active=0 WHERE target_id=? AND channel=?", (artifact["target_id"], data.channel))
            conn.execute("INSERT INTO releases VALUES(?,?,?,?,?,?,?)", (identity, artifact["id"], artifact["target_id"], data.channel, seq, 1, time.time()))
            if data.notes is not None:
                conn.execute("INSERT INTO release_notes VALUES(?,?,?)", (identity, data.notes, time.time()))
            self.audit(conn, "release.published", identity)
        return {"id": identity, "seq": seq}

    @serialized_blobs
    def list_releases(self):
        rows = self.db.rows("""SELECT r.*,a.version,a.sha256,a.size,COALESCE(n.notes,a.notes) AS notes,
            t.name AS target_name,p.pruned_at,k.revoked AS key_revoked,
            (SELECT COUNT(*) FROM attempts x WHERE x.release_id=r.id) AS attempt_count
            FROM releases r JOIN artifacts a ON r.artifact_id=a.id JOIN targets t ON r.target_id=t.id
            JOIN signing_keys k ON a.key_id=k.id LEFT JOIN pruned_artifacts p ON p.artifact_id=a.id
            LEFT JOIN release_notes n ON n.release_id=r.id LEFT JOIN deleted_releases d ON d.release_id=r.id
            WHERE d.release_id IS NULL ORDER BY r.created DESC,r.id DESC LIMIT 500""")
        inspected = {}
        for row in rows:
            self._decorate_firmware(row, inspected)
            row["delete_block_reasons"] = self._release_delete_reasons(row)
            row["can_delete"] = not row["delete_block_reasons"]
        return rows

    @staticmethod
    def _release_delete_reasons(release):
        reasons = []
        if release["active"]:
            reasons.append("仍是活动发布，请先撤回")
        if release["attempt_count"]:
            reasons.append(f"已有 {release['attempt_count']} 条升级记录，需保留历史")
        return reasons

    def update_release(self, release_id, data):
        with self.db.transaction() as conn:
            if not conn.execute("""SELECT id FROM releases WHERE id=? AND NOT EXISTS
                (SELECT 1 FROM deleted_releases d WHERE d.release_id=releases.id)""", (release_id,)).fetchone():
                raise Problem(404, "发布不存在或已删除")
            conn.execute("""INSERT INTO release_notes VALUES(?,?,?) ON CONFLICT(release_id)
                DO UPDATE SET notes=excluded.notes,updated=excluded.updated""", (release_id, data.notes, time.time()))
            self.audit(conn, "release.updated", release_id)
        return {"id": release_id, "notes": data.notes}

    def delete_release(self, release_id):
        with self.db.transaction() as conn:
            release = conn.execute("""SELECT * FROM releases WHERE id=? AND NOT EXISTS
                (SELECT 1 FROM deleted_releases d WHERE d.release_id=releases.id)""", (release_id,)).fetchone()
            if release is None:
                raise Problem(404, "发布不存在或已删除")
            count = conn.execute("SELECT COUNT(*) FROM attempts WHERE release_id=?", (release_id,)).fetchone()[0]
            reasons = self._release_delete_reasons(dict(release, attempt_count=count))
            if reasons:
                raise Problem(409, "不能删除发布：" + "；".join(reasons))
            # Hide the record, but retain its sequence high-water mark. Removing
            # the MAX(seq) row would let a later publication reuse that sequence.
            conn.execute("INSERT INTO deleted_releases VALUES(?,?)", (release_id, time.time()))
            self.audit(conn, "release.deleted", release_id)
        return {"ok": True, "id": release_id}

    @serialized_blobs
    def verify_blob(self, artifact):
        artifact_id = artifact.get("artifact_id", artifact["id"])
        if self.db.one("SELECT artifact_id FROM pruned_artifacts WHERE artifact_id=?", (artifact_id,)):
            raise Problem(410, "固件文件已删除，请重新上传原固件后再发布")
        from .retention import safe_blob
        try:
            path = safe_blob(self, artifact["sha256"])
            if (not path.is_file() or path.stat().st_size != artifact["size"]
                    or hashlib.sha256(path.read_bytes()).hexdigest() != artifact["sha256"]):
                raise Problem(503, "固件文件缺失或损坏，发布/下载已停止")
        except OSError as exc:
            raise Problem(503, "固件存储暂不可读，发布/下载已停止，请检查服务器存储") from exc
        return path

    @staticmethod
    def _file_fingerprint(value):
        return (value.st_dev, value.st_ino, value.st_size, value.st_mtime_ns, value.st_ctime_ns)

    def _inspect_firmware(self, artifact):
        """Return an admin display state, without changing files or metadata."""
        from .retention import safe_blob
        try:
            path = safe_blob(self, artifact["sha256"])
            before = path.stat()
            if not stat.S_ISREG(before.st_mode):
                return "storage_error", "固件存储路径异常，请检查服务器存储"
            if before.st_size != artifact["size"]:
                return "corrupt", "固件文件大小异常，发布/下载已停止，请恢复原固件"
            identity = (artifact["sha256"], self._file_fingerprint(before))
            digest = self._firmware_checks.get(identity)
            if digest is None:
                checksum = hashlib.sha256()
                with path.open("rb") as source:
                    while chunk := source.read(1024 * 1024):
                        checksum.update(chunk)
                after = path.stat()
                if self._file_fingerprint(before) != self._file_fingerprint(after):
                    return "storage_error", "固件文件检查期间发生变化，请刷新后重试"
                digest = checksum.hexdigest()
                self._firmware_checks[identity] = digest
                while len(self._firmware_checks) > 512:
                    self._firmware_checks.popitem(last=False)
            else:
                self._firmware_checks.move_to_end(identity)
            if digest != artifact["sha256"]:
                return "corrupt", "固件文件 SHA-256 校验失败，发布/下载已停止，请恢复原固件"
            return "available", "固件文件可用"
        except FileNotFoundError:
            return "missing", "固件文件缺失，请重新上传原固件或恢复备份"
        except (OSError, Problem):
            return "storage_error", "固件存储暂不可读或路径异常，请检查服务器存储"

    def _decorate_firmware(self, row, inspected):
        # A version label is not an identity. A tombstone belongs to one
        # artifact; physical integrity belongs to its SHA-addressed blob.
        if row["pruned_at"] is not None:
            state, message = "deleted", "固件文件已删除，请重新上传原固件后再发布"
        else:
            identity = (row["sha256"], row["size"])
            if identity not in inspected:
                inspected[identity] = self._inspect_firmware(row)
            state, message = inspected[identity]
        reasons = []
        if state != "available":
            reasons.append(message)
        if row["key_revoked"]:
            reasons.append("签名公钥已吊销，不能发布")
        row.update(firmware_state=state, firmware_message=message,
                   can_publish=not reasons, publish_block_reasons=reasons)

    def release(self, release_id):
        row = self.db.one("""SELECT r.*,a.version,a.sha256,a.size,a.manifest,a.signature,a.key_id,k.revoked
          FROM releases r JOIN artifacts a ON r.artifact_id=a.id JOIN signing_keys k ON a.key_id=k.id
          WHERE r.id=? AND NOT EXISTS (SELECT 1 FROM deleted_releases d WHERE d.release_id=r.id)""", (release_id,))
        if not row or row["revoked"]:
            raise Problem(404, "发布不存在或签名公钥已吊销")
        return row

    def compatible(self, device, info):
        target = self.target(device["target_id"])
        if info.target_id != target["id"] or info.layout_id != target["layout_id"]:
            raise Problem(409, "设备产品、目标或布局与登记信息不匹配")
        if version_tuple(info.bootloader_version) < version_tuple(target["min_bootloader"]):
            raise Problem(409, "Bootloader 版本低于此目标要求")
        if not set(target["capabilities"]) <= set(info.capabilities):
            raise Problem(409, "设备缺少此目标要求的升级能力")
        return target

    def check(self, agent, info, current_sha256=None):
        device = self.device(agent, info.device_id)
        self.compatible(device, info)
        current = self.db.one("SELECT id FROM releases WHERE target_id=? AND channel=? AND active=1",
                              (device["target_id"], device["channel"]))
        if not current:
            return {"schema_version": 1, "update_available": False, "reason": "no_release"}
        release = self.release(current["id"])
        # Only the complete installed artifact digest suppresses an update.
        # Versions / ELF hashes / cached heartbeats are not substitutes. Unknown
        # digests intentionally offer the release so the client can verify it.
        if current_sha256 == release["sha256"]:
            return {"schema_version": 1, "update_available": False, "reason": "up_to_date"}
        return {"schema_version": 1, "update_available": True, "release_id": release["id"], "release_seq": release["seq"],
                "manifest": json.loads(release["manifest"]), "signature": release["signature"],
                "download_path": f"/api/v1/ota/releases/{release['id']}/firmware"}

    def create_attempt(self, agent, info):
        device = self.device(agent, info.device_id)
        self.compatible(device, info)
        release = self.release(info.release_id)
        if release["target_id"] != device["target_id"] or release["channel"] != device["channel"]:
            raise Problem(404, "该设备无权安装此发布")
        with self.db.transaction() as conn:
            old = conn.execute("SELECT * FROM attempts WHERE device_id=? AND request_id=?", (device["id"], info.request_id)).fetchone()
            if old:
                if old["release_id"] != info.release_id:
                    raise Problem(409, "同一 request_id 不能用于不同发布")
                from .commands import bind_attempt
                bind_attempt(conn, info, release, old)
                return dict(old)
            if not conn.execute("SELECT active FROM releases WHERE id=?", (release["id"],)).fetchone()[0]:
                raise Problem(409, "发布已撤回，请重新检查版本")
            identity, now = uid(), time.time()
            conn.execute("INSERT INTO attempts(id,device_id,release_id,request_id,created,updated) VALUES(?,?,?,?,?,?)",
                         (identity, device["id"], release["id"], info.request_id, now, now))
            attempt = dict(conn.execute("SELECT * FROM attempts WHERE id=?", (identity,)).fetchone())
            from .commands import bind_attempt
            bind_attempt(conn, info, release, attempt)
            return attempt

    def download(self, agent, release_id, attempt_id):
        attempt = self.db.one("SELECT * FROM attempts WHERE id=? AND release_id=?", (attempt_id, release_id))
        if not attempt:
            raise Problem(404, "升级尝试不存在")
        self.device(agent, attempt["device_id"])
        if time.time() - attempt["created"] > 86400:
            raise Problem(410, "下载授权已过期，请重新检查并创建升级尝试")
        release = self.release(release_id)
        return self.verify_blob(release), release

    @serialized_blobs
    def pin_download(self, agent, release_id, attempt_id):
        path, release = self.download(agent, release_id, attempt_id)
        digest = release["sha256"]
        self._downloads[digest] = self._downloads.get(digest, 0) + 1
        return path, release

    @serialized_blobs
    def unpin_download(self, digest):
        count = self._downloads.get(digest, 0)
        if count <= 1:
            self._downloads.pop(digest, None)
        else:
            self._downloads[digest] = count - 1

    def artifact_delete_preview(self, artifact_id):
        from .retention import preview
        return preview(self, artifact_id)

    def delete_artifact(self, artifact_id, preview_token):
        from .retention import delete
        return delete(self, artifact_id, preview_token)

    @serialized_blobs
    def get_artifact(self, artifact_id):
        row = self.db.one("""SELECT a.id,a.target_id,a.version,a.sha256,a.size,a.notes,a.created,
            t.name AS target_name,k.revoked AS key_revoked,p.pruned_at FROM artifacts a
            JOIN targets t ON a.target_id=t.id JOIN signing_keys k ON a.key_id=k.id
            LEFT JOIN pruned_artifacts p ON p.artifact_id=a.id WHERE a.id=?""", (artifact_id,))
        if row is None:
            raise Problem(404, "固件不存在")
        row["deletion_pending"] = False
        if row["pruned_at"] is not None:
            shared = self.db.one("""SELECT a.id FROM artifacts a LEFT JOIN pruned_artifacts p
                ON p.artifact_id=a.id WHERE a.sha256=? AND p.artifact_id IS NULL LIMIT 1""", (row["sha256"],))
            if not shared:
                state, _ = self._inspect_firmware(row)
                row["deletion_pending"] = state != "missing"
        self._decorate_firmware(row, {})
        return row

    @serialized_blobs
    def list_artifacts(self):
        rows = self.db.rows("""SELECT a.id,a.target_id,a.version,a.sha256,a.size,a.notes,a.created,
            t.name AS target_name,k.revoked AS key_revoked,p.pruned_at FROM artifacts a
            JOIN targets t ON a.target_id=t.id JOIN signing_keys k ON a.key_id=k.id
            LEFT JOIN pruned_artifacts p ON p.artifact_id=a.id ORDER BY a.created DESC,a.id DESC""")
        live = {row["sha256"] for row in rows if row["pruned_at"] is None}
        visible = []
        inspected = {}
        for row in rows:
            row["deletion_pending"] = False
            if row["pruned_at"] is not None and row["sha256"] not in live:
                state, _ = self._inspect_firmware(row)
                # Unknown/unsafe storage must stay visible for diagnosis. Never
                # confuse permission or I/O errors with a completed deletion.
                row["deletion_pending"] = state != "missing"
            if row["pruned_at"] is None or row["deletion_pending"]:
                self._decorate_firmware(row, inspected)
                visible.append(row)
                if len(visible) == 500:
                    break
        return visible

    def heartbeat(self, agent, data):
        self.device(agent, data.device_id)
        with self.db.transaction() as conn:
            conn.execute("UPDATE devices SET current_version=?,current_sha256=?,last_seen=? WHERE id=?",
                         (data.version, data.sha256, time.time(), data.device_id))
            from .commands import capability
            capability(conn, data.device_id, data.remote_commands_version, time.time())
        return {"ok": True}

    def event(self, agent, attempt_id, data):
        payload = canonical(data.model_dump()).decode()
        with self.db.transaction() as conn:
            attempt = conn.execute("SELECT * FROM attempts WHERE id=?", (attempt_id,)).fetchone()
            if not attempt:
                raise Problem(404, "升级尝试不存在")
            device = conn.execute("SELECT * FROM devices WHERE id=? AND agent_id=?", (attempt["device_id"], agent["id"])).fetchone()
            if not device:
                raise Problem(404, "设备未授权")
            old = conn.execute("SELECT payload FROM events WHERE attempt_id=? AND seq=?", (attempt_id, data.seq)).fetchone()
            if old:
                if old["payload"] != payload:
                    raise Problem(409, "此事件序号已被其他内容使用")
                return {"ok": True, "duplicate": True}
            if data.seq > attempt["last_seq"]:
                if data.state not in TRANSITIONS[attempt["state"]]:
                    raise Problem(409, "升级状态转换不合法")
                if data.state == "rolled_back":
                    target = conn.execute("SELECT capabilities FROM targets WHERE id=?", (device["target_id"],)).fetchone()
                    if "rollback" not in json.loads(target["capabilities"]):
                        raise Problem(409, "此目标未声明已实现自动回滚")
                if data.state == "confirmed":
                    release = conn.execute("SELECT a.version,a.sha256 FROM releases r JOIN artifacts a ON r.artifact_id=a.id WHERE r.id=?", (attempt["release_id"],)).fetchone()
                    if data.version != release["version"] or data.sha256 != release["sha256"]:
                        raise Problem(409, "启动确认版本或哈希与本次发布不符")
                    conn.execute("UPDATE devices SET current_version=?,current_sha256=?,last_seen=? WHERE id=?",
                                 (data.version, data.sha256, time.time(), device["id"]))
                conn.execute("UPDATE attempts SET state=?,progress=?,last_seq=?,error=?,updated=? WHERE id=?",
                             (data.state, 100 if data.state == "confirmed" else data.progress, data.seq, data.error, time.time(), attempt_id))
                from .commands import finish_attempt
                finish_attempt(conn, attempt_id, data.state, data.error)
            conn.execute("INSERT INTO events VALUES(?,?,?,?)", (attempt_id, data.seq, payload, time.time()))
        return {"ok": True, "duplicate": False}

    def _storage_usage(self):
        total, warning = 0, False
        try:
            with os.scandir(self.settings.data_dir / "firmware") as entries:
                for entry in entries:
                    if not entry.name.endswith(".bin"):
                        continue
                    try:
                        value = entry.stat(follow_symlinks=False)
                        if entry.is_symlink() or not stat.S_ISREG(value.st_mode):
                            warning = True
                            continue
                        # Opening without reading checks actual accessibility;
                        # no content hashing or external-link traversal here.
                        with Path(entry.path).open("rb"):
                            pass
                        total += value.st_size
                    except OSError:
                        warning = True
        except OSError:
            warning = True
        return total, warning

    @serialized_blobs
    def overview(self):
        storage_bytes, storage_warning = self._storage_usage()
        return {"products": self.db.one("SELECT COUNT(*) AS n FROM products")["n"],
                "targets": self.db.one("SELECT COUNT(*) AS n FROM targets")["n"],
                "online_devices": self.db.one("SELECT COUNT(*) AS n FROM devices d JOIN agents a ON d.agent_id=a.id WHERE a.revoked=0 AND d.last_seen>?", (time.time() - 180,))["n"],
                "devices": self.db.one("SELECT COUNT(*) AS n FROM devices")["n"],
                "active_releases": self.db.one("SELECT COUNT(*) AS n FROM releases WHERE active=1")["n"],
                "pending_attempts": self.db.one("SELECT COUNT(*) AS n FROM attempts WHERE state NOT IN ('confirmed','failed','rolled_back')")["n"],
                "storage_bytes": storage_bytes, "storage_warning": storage_warning,
                "now": time.time()}
