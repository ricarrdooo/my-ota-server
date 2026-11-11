"""Delete only an explicitly selected artifact after a fresh confirmation.

Historical metadata stays intact. Commit its tombstone before unlinking, so a
database rollback cannot leave a live artifact without its firmware file.
"""
import hashlib
import hmac
import stat
import time

from .security import canonical
from .service import Problem


def safe_blob(service, digest):
    path = service.blob(digest)
    base = (service.settings.data_dir / "firmware").resolve()
    try:
        if path.is_symlink() or path.resolve().parent != base:
            raise Problem(409, "固件存储包含异常链接或路径，操作已停止")
    except OSError as exc:
        raise Problem(503, "固件存储暂不可读，操作已停止，请检查服务器存储") from exc
    return path


def snapshot(service, conn, artifact_id):
    found = conn.execute("""SELECT a.id,a.target_id,a.version,a.sha256,a.size,
        t.name AS target_name,p.pruned_at FROM artifacts a JOIN targets t ON a.target_id=t.id
        LEFT JOIN pruned_artifacts p ON p.artifact_id=a.id WHERE a.id=?""", (artifact_id,)).fetchone()
    if found is None:
        raise Problem(404, "固件不存在")
    artifact = dict(found)
    reasons = []
    if conn.execute("SELECT 1 FROM releases WHERE artifact_id=? AND active=1", (artifact_id,)).fetchone():
        reasons.append("活动发布：请先在版本发布页撤回")
    # Download authorizations survive terminal events until their 24-hour TTL.
    if conn.execute("""SELECT 1 FROM attempts x JOIN releases r ON x.release_id=r.id
        WHERE r.artifact_id=? AND (x.state NOT IN ('confirmed','failed','rolled_back')
        OR x.created>=?) LIMIT 1""", (artifact_id, time.time() - 86400)).fetchone():
        reasons.append("升级中或下载授权未过期")
    if service._downloads.get(artifact["sha256"], 0):
        reasons.append("正在下载")
    if conn.execute("""SELECT 1 FROM remote_commands c JOIN releases r ON c.release_id=r.id
        WHERE r.artifact_id=? AND (c.status='executing' OR
        (c.status IN ('queued','claimed') AND c.expires_at>?)) LIMIT 1""",
        (artifact_id, int(time.time()))).fetchone():
        reasons.append("设备有待执行或执行中的升级指令")
    references = [dict(row) for row in conn.execute("""SELECT a.id,p.pruned_at FROM artifacts a
        LEFT JOIN pruned_artifacts p ON p.artifact_id=a.id WHERE a.sha256=? ORDER BY a.id""",
        (artifact["sha256"],))]
    shared = sum(row["id"] != artifact_id and row["pruned_at"] is None for row in references)
    file_state = None
    storage_error = None
    try:
        path = safe_blob(service, artifact["sha256"])
        file_stat = path.stat()
        if not stat.S_ISREG(file_stat.st_mode):
            storage_error = "固件存储路径不是普通文件，请检查服务器存储"
        else:
            file_state = {"size": file_stat.st_size, "mtime_ns": file_stat.st_mtime_ns,
                          "ctime_ns": file_stat.st_ctime_ns, "dev": file_stat.st_dev, "ino": file_stat.st_ino}
            inspected_state, inspected_message = service._inspect_firmware(artifact)
            if inspected_state == "storage_error":
                storage_error = inspected_message
    except FileNotFoundError:
        pass
    except OSError:
        storage_error = "固件存储暂不可读，请检查服务器存储后重试"
    except Problem as exc:
        if exc.status != 503:
            raise
        storage_error = exc.message
    if storage_error:
        reasons.append(storage_error)
    allowed = not reasons
    reclaim = file_state["size"] if file_state and not shared and allowed else 0
    token_data = {"artifact": artifact, "references": references, "reasons": reasons, "file": file_state}
    return {"artifact": artifact, "can_delete": allowed, "reasons": reasons,
            "shared_references": shared, "recoverable_bytes": reclaim,
            "file": file_state, "storage_error": storage_error,
            "preview_token": hashlib.sha256(canonical(token_data)).hexdigest()}


def preview(service, artifact_id):
    with service._blob_lock, service.db.transaction() as conn:
        return snapshot(service, conn, artifact_id)


def delete(service, artifact_id, preview_token):
    with service._blob_lock:
        with service.db.transaction() as conn:
            plan = snapshot(service, conn, artifact_id)
            if not plan["can_delete"]:
                raise Problem(409, "不能删除：" + "；".join(plan["reasons"]))
            if not hmac.compare_digest(plan["preview_token"], preview_token):
                raise Problem(409, "固件或使用状态已变化，请重新打开删除窗口后确认")
            archived = int(plan["artifact"]["pruned_at"] is None)
            if archived:
                conn.execute("INSERT INTO pruned_artifacts VALUES(?,?)", (artifact_id, time.time()))
                service.audit(conn, "artifact.deleted", artifact_id)
        # No sweep: only this selected SHA, and only without other live refs.
        freed, deleted, warnings = 0, 0, []
        if plan["file"] is not None and not plan["shared_references"]:
            try:
                path = safe_blob(service, plan["artifact"]["sha256"])
                if path.exists():
                    file_stat = path.stat()
                    current = {"size": file_stat.st_size, "mtime_ns": file_stat.st_mtime_ns,
                               "ctime_ns": file_stat.st_ctime_ns, "dev": file_stat.st_dev, "ino": file_stat.st_ino}
                    if not stat.S_ISREG(file_stat.st_mode) or current != plan["file"]:
                        raise OSError("file changed after confirmation")
                    path.unlink()
                    freed, deleted = file_stat.st_size, 1
            except (OSError, Problem):
                warnings.append("文件暂未释放，请在固件库中点击该版本的‘重试删除文件’；历史记录已保留")
        return {"artifact_id": artifact_id, "archived_count": archived,
                "deleted_files": deleted, "freed_bytes": freed,
                "shared_file_retained": bool(plan["shared_references"]), "warnings": warnings}
