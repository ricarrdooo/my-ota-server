from contextlib import asynccontextmanager
import hashlib
import hmac
import json
import mimetypes
import os
from pathlib import Path
import secrets
import sqlite3
import time
from urllib.parse import urlsplit

from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import FileResponse, HTMLResponse, JSONResponse, RedirectResponse, Response
from fastapi.staticfiles import StaticFiles
from fastapi.templating import Jinja2Templates
from starlette.middleware.trustedhost import TrustedHostMiddleware

from .adapters import ADAPTERS
from .config import Settings
from .lan import LanHttpGuard
from .db import Database
from . import commands
from .models import UpgradeFailure
from .timeline import upgrade_timeline
from .models import (ArtifactDeleteInput, AttemptInput, ChannelInput, CommandClaim, CommandEvent, CommandInput, Compatibility, DeviceInput, Digest, EventInput,
                     GatewayInput, Heartbeat, KeyInput, Model, NameUpdate, ProductInput, ProductUpdate,
                     ReleaseInput, ReleaseUpdate, TargetInput, TargetUpdate)
from .security import RateLimiter, load_json, opaque_token, password_valid, token_digest
from .service import Problem, Service, fingerprint, profile, uid

ROOT = Path(__file__).parent


class LeasedFileResponse(FileResponse):
    def __init__(self, *args, on_finished, **kwargs):
        super().__init__(*args, **kwargs)
        self.on_finished = on_finished

    async def __call__(self, scope, receive, send):
        # Keep the pin through ordinary file reads, not just a path-send handoff.
        scope = dict(scope, extensions={key: value for key, value in scope.get("extensions", {}).items()
                                       if key != "http.response.pathsend"})
        try:
            return await super().__call__(scope, receive, send)
        finally:
            self.on_finished()


class BodyLimit:
    def __init__(self, app, upload_limit):
        self.app, self.upload_limit = app, upload_limit

    async def __call__(self, scope, receive, send):
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        limit = self.upload_limit + 65536 if scope["path"] == "/api/admin/artifacts" else 65536
        headers = dict(scope.get("headers", []))
        try:
            length = int(headers.get(b"content-length", b"0"))
        except ValueError:
            return await JSONResponse({"error": "Content-Length 无效"}, 400)(scope, receive, send)
        if length < 0 or length > limit:
            return await JSONResponse({"error": "请求体超过上限"}, 413)(scope, receive, send)
        total = 0

        async def bounded_receive():
            nonlocal total
            message = await receive()
            total += len(message.get("body", b""))
            if total > limit:
                raise HTTPException(413, "请求体超过上限")
            return message

        await self.app(scope, bounded_receive, send)


def create_app(settings=None):
    settings = settings or Settings.from_env()
    db = Database(settings)
    service = Service(db, settings)
    limiter = RateLimiter()
    templates = Jinja2Templates(directory=str(ROOT / "templates"))
    app = FastAPI(title="OTA Station", version="0.1.0", docs_url=None, redoc_url=None, openapi_url=None)
    app.state.db, app.state.service, app.state.settings = db, service, settings
    host = urlsplit(settings.public_url).hostname
    hosts = [host] if settings.secure_cookie else list({host, "localhost", "127.0.0.1"})
    if settings.lan_http_host:
        hosts.append(settings.lan_http_host)
    app.add_middleware(TrustedHostMiddleware, allowed_hosts=hosts, www_redirect=False)
    app.add_middleware(BodyLimit, upload_limit=settings.max_upload)
    if settings.lan_http_host:
        app.add_middleware(LanHttpGuard, host=settings.lan_http_host,
                           port=urlsplit(settings.public_url).port or 80)
    # Windows registry MIME mappings may label .js text/plain. Keep nosniff enabled.
    mimetypes.add_type("text/javascript", ".js")
    mimetypes.add_type("text/javascript", ".mjs")
    mimetypes.add_type("text/css", ".css")
    app.mount("/static", StaticFiles(directory=str(ROOT / "static")), name="static")

    def check_origin(request):
        origin = request.headers.get("origin")
        allowed = {settings.public_url}
        if not settings.secure_cookie:
            allowed.add(str(request.base_url).rstrip("/"))
        if origin and origin not in allowed:
            raise Problem(403, "请求来源不匹配")

    def current_session(request):
        cookie = request.cookies.get("ota_session", "")
        if not cookie or len(cookie) > 128:
            return None
        return db.one("SELECT * FROM sessions WHERE digest=? AND expires>?", (token_digest(cookie), time.time()))

    def admin(request: Request):
        session = current_session(request)
        if not session:
            raise Problem(401, "登录已失效，请重新登录")
        if request.method not in ("GET", "HEAD", "OPTIONS"):
            check_origin(request)
            supplied = request.headers.get("x-csrf-token", "")
            if not hmac.compare_digest(supplied.encode(), session["csrf"].encode()):
                raise Problem(403, "页面验证已失效，请刷新后重试")
        return session

    def agent(request: Request):
        auth = request.headers.get("authorization", "")
        if not auth.startswith("Bearer ") or len(auth) > 160:
            raise Problem(401, "设备凭据无效")
        found = db.one("SELECT id,name,kind FROM agents WHERE token_hash=? AND revoked=0", (token_digest(auth[7:]),))
        if not found:
            raise Problem(401, "设备凭据无效或已停用")
        if not limiter.allow("agent:" + found["id"], 300, 60):
            raise Problem(429, "设备请求过于频繁")
        return found

    @app.middleware("http")
    async def security_headers(request, call_next):
        response = await call_next(request)
        response.headers.update({"X-Content-Type-Options": "nosniff", "X-Frame-Options": "DENY",
                                 "Referrer-Policy": "same-origin", "Cache-Control": "no-store",
                                 "Content-Security-Policy": "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'"})
        return response

    @app.exception_handler(Problem)
    async def problem_handler(_request, exc):
        return JSONResponse({"error": exc.message}, exc.status)

    @app.exception_handler(RequestValidationError)
    async def validation_handler(_request, exc):
        # Never echo body values: tokens, PEM contents and filenames can be sensitive.
        fields = [".".join(str(v) for v in item["loc"]) for item in exc.errors()][:8]
        return JSONResponse({"error": "参数格式不正确，请检查：" + ", ".join(fields)}, 422)

    @app.exception_handler(sqlite3.IntegrityError)
    async def integrity_handler(_request, _exc):
        return JSONResponse({"error": "标识重复或关联记录不存在"}, 409)

    @app.exception_handler(OSError)
    async def storage_handler(_request, _exc):
        return JSONResponse({"error": "存储暂不可用，请检查可用空间、权限或恢复备份"}, 503)

    @app.exception_handler(sqlite3.OperationalError)
    async def database_handler(_request, _exc):
        return JSONResponse({"error": "数据库暂不可用，请检查空间、权限或稍后重试"}, 503)

    @app.get("/healthz")
    def health():
        db.one("SELECT 1")
        return {"status": "ok", "version": "0.1.0"}

    @app.get("/favicon.ico", include_in_schema=False)
    def favicon():
        return Response(status_code=204)

    @app.get("/login", response_class=HTMLResponse)
    def login_page(request: Request):
        if current_session(request):
            return RedirectResponse("/", 303)
        nonce = opaque_token()
        response = templates.TemplateResponse(request=request, name="login.html", context={
            "csrf": nonce, "initialized": bool(db.one("SELECT id FROM admins")), "error": ""})
        response.set_cookie("ota_login", nonce, max_age=900, httponly=True, secure=settings.secure_cookie, samesite="strict")
        return response

    @app.post("/login")
    async def login(request: Request):
        check_origin(request)
        form = await request.form(max_files=0, max_fields=4)
        nonce = request.cookies.get("ota_login", "")
        if not nonce or not hmac.compare_digest(str(form.get("csrf", "")).encode(), nonce.encode()):
            raise Problem(403, "登录页面已过期，请重新打开")
        username, password = str(form.get("username", "")), str(form.get("password", ""))
        ip = request.client.host if request.client else "unknown"
        if not limiter.allow("login:" + ip, 5, 300):
            raise Problem(429, "登录尝试过多，请 5 分钟后重试")
        account = db.one("SELECT * FROM admins WHERE id=1")
        if not account:
            raise Problem(503, "请先在终端运行 python -m ota_server init 创建管理员")
        valid = len(password) <= 256 and password_valid(account["password_hash"], password)
        if not valid or not hmac.compare_digest(account["username"].encode(), username.encode()):
            response = templates.TemplateResponse(request=request, name="login.html", context={
                "csrf": nonce, "initialized": True, "error": "用户名或密码不正确"}, status_code=401)
            return response
        token, csrf = opaque_token(), opaque_token()
        with db.transaction() as conn:
            conn.execute("DELETE FROM sessions WHERE expires<?", (time.time(),))
            conn.execute("INSERT INTO sessions VALUES(?,?,?)", (token_digest(token), csrf, time.time() + settings.session_hours * 3600))
        response = RedirectResponse("/", 303)
        response.set_cookie("ota_session", token, max_age=settings.session_hours * 3600,
                            httponly=True, secure=settings.secure_cookie, samesite="strict")
        response.delete_cookie("ota_login")
        return response

    @app.post("/api/admin/logout")
    def logout(session=Depends(admin)):
        with db.transaction() as conn:
            conn.execute("DELETE FROM sessions WHERE digest=?", (session["digest"],))
        response = JSONResponse({"ok": True})
        response.delete_cookie("ota_session")
        return response

    @app.get("/", response_class=HTMLResponse)
    def dashboard(request: Request):
        session = current_session(request)
        if not session:
            return RedirectResponse("/login", 303)
        return templates.TemplateResponse(request=request, name="index.html", context={"csrf": session["csrf"]})

    @app.get("/api/admin/overview")
    def overview(_session=Depends(admin)):
        return service.overview()

    @app.get("/api/admin/capabilities")
    def capabilities(_session=Depends(admin)):
        # This describes the running Python process, not files served from disk.
        # Newly edited static resources must not assume old workers have reloaded.
        return {"contract": 2, "features": ["release_management", "artifact_deletion",
                                            "metadata_management", "firmware_state", "remote_commands"]}

    @app.get("/api/admin/catalog")
    def catalog(_session=Depends(admin)):
        return {"products": db.rows("SELECT * FROM products ORDER BY created DESC"),
                "targets": [service.target(row["id"]) for row in db.rows("SELECT id FROM targets ORDER BY created DESC")],
                "keys": db.rows("SELECT id,product_id,name,pem,revoked,created FROM signing_keys ORDER BY created DESC"),
                "gateways": db.rows("SELECT id,name,revoked FROM agents WHERE kind='gateway' ORDER BY created DESC"),
                "adapters": ADAPTERS}

    @app.post("/api/admin/products")
    def add_product(data: ProductInput, _session=Depends(admin)):
        return service.add_product(data)

    @app.patch("/api/admin/products/{identity}")
    def update_product(identity: str, data: ProductUpdate, _session=Depends(admin)):
        return service.update_metadata("products", identity, data)

    @app.patch("/api/admin/targets/{identity}")
    def update_target(identity: str, data: TargetUpdate, _session=Depends(admin)):
        return service.update_metadata("targets", identity, data)

    @app.patch("/api/admin/keys/{identity}")
    def update_key(identity: str, data: NameUpdate, _session=Depends(admin)):
        return service.update_metadata("keys", identity, data)

    @app.patch("/api/admin/devices/{identity}")
    def update_device(identity: str, data: NameUpdate, _session=Depends(admin)):
        return service.update_metadata("devices", identity, data)

    @app.patch("/api/admin/gateways/{identity}")
    def update_gateway(identity: str, data: NameUpdate, _session=Depends(admin)):
        return service.update_metadata("gateways", identity, data)

    # Delete only unused records. Referenced records/history are never cascaded.
    @app.post("/api/admin/products/{identity}/delete")
    def delete_product(identity: str, _data: Model, _session=Depends(admin)):
        return service.delete_metadata("products", identity)

    @app.post("/api/admin/targets/{identity}/delete")
    def delete_target(identity: str, _data: Model, _session=Depends(admin)):
        return service.delete_metadata("targets", identity)

    @app.post("/api/admin/keys/{identity}/delete")
    def delete_key(identity: str, _data: Model, _session=Depends(admin)):
        return service.delete_metadata("keys", identity)

    @app.post("/api/admin/devices/{identity}/delete")
    def delete_device(identity: str, _data: Model, _session=Depends(admin)):
        return service.delete_metadata("devices", identity)

    @app.post("/api/admin/gateways/{identity}/delete")
    def delete_gateway(identity: str, _data: Model, _session=Depends(admin)):
        return service.delete_metadata("gateways", identity)

    @app.post("/api/admin/keys")
    def add_key(data: KeyInput, _session=Depends(admin)):
        return service.add_key(data)

    @app.post("/api/admin/keys/{key_id}/revoke")
    def revoke_key(key_id: str, _session=Depends(admin)):
        with db.transaction() as conn:
            if not conn.execute("UPDATE signing_keys SET revoked=1 WHERE id=?", (key_id,)).rowcount:
                raise Problem(404, "签名公钥不存在")
            conn.execute("UPDATE releases SET active=0 WHERE artifact_id IN (SELECT id FROM artifacts WHERE key_id=?)", (key_id,))
            service.audit(conn, "key.revoked", key_id)
        return {"ok": True}

    @app.post("/api/admin/targets")
    def add_target(data: TargetInput, _session=Depends(admin)):
        return service.add_target(data)

    @app.get("/api/admin/targets/{target_id}/profile")
    def export_profile(target_id: str, _session=Depends(admin)):
        target = service.target(target_id)
        key = db.one("SELECT pem,revoked FROM signing_keys WHERE id=?", (target["key_id"],))
        if key["revoked"]:
            raise Problem(409, "该目标公钥已吊销，请创建使用新公钥的目标配置")
        return {"schema_version": 1, "target": profile(target), "target_fingerprint": fingerprint(target), "public_key_pem": key["pem"]}

    @app.get("/api/admin/devices")
    def devices(_session=Depends(admin)):
        return commands.decorate_devices(service, db.rows("""SELECT d.*,t.name AS target_name,a.kind AS agent_kind,a.revoked FROM devices d
          JOIN targets t ON d.target_id=t.id JOIN agents a ON d.agent_id=a.id ORDER BY d.created DESC"""))

    @app.post("/api/admin/devices/{device_id}/commands")
    def create_command(device_id: str, data: CommandInput, _session=Depends(admin)):
        return commands.create(service, device_id, data)

    @app.get("/api/admin/devices/{device_id}/commands")
    def list_commands(device_id: str, _session=Depends(admin)):
        return commands.listing(service, device_id)

    @app.post("/api/admin/devices")
    def add_device(data: DeviceInput, _session=Depends(admin)):
        return service.add_device(data)

    @app.get("/api/admin/commands/{command_id}/timeline")
    def command_timeline(command_id: str, _session=Depends(admin)):
        return upgrade_timeline(db, command_id=command_id)

    @app.get("/api/admin/attempts/{attempt_id}/timeline")
    def attempt_timeline(attempt_id: str, _session=Depends(admin)):
        return upgrade_timeline(db, attempt_id=attempt_id)

    @app.post("/api/admin/gateways")
    def add_gateway(data: GatewayInput, _session=Depends(admin)):
        return service.add_gateway(data)

    @app.post("/api/admin/agents/{agent_id}/revoke")
    def revoke_agent(agent_id: str, _session=Depends(admin)):
        with db.transaction() as conn:
            if not conn.execute("UPDATE agents SET revoked=1 WHERE id=?", (agent_id,)).rowcount:
                raise Problem(404, "设备或网关凭据不存在")
            service.audit(conn, "agent.revoked", agent_id)
        return {"ok": True}

    @app.post("/api/admin/agents/{agent_id}/rotate")
    def rotate_agent(agent_id: str, _session=Depends(admin)):
        token = opaque_token()
        with db.transaction() as conn:
            if not conn.execute("UPDATE agents SET token_hash=?,revoked=0 WHERE id=?", (token_digest(token), agent_id)).rowcount:
                raise Problem(404, "设备或网关凭据不存在")
            service.audit(conn, "agent.rotated", agent_id)
        return {"id": agent_id, "token": token}

    @app.post("/api/admin/devices/{device_id}/channel")
    def change_channel(device_id: str, data: ChannelInput, _session=Depends(admin)):
        with db.transaction() as conn:
            if not conn.execute("UPDATE devices SET channel=? WHERE id=?", (data.channel, device_id)).rowcount:
                raise Problem(404, "设备不存在")
        return {"ok": True}

    @app.get("/api/admin/artifacts")
    def artifacts(_session=Depends(admin)):
        return service.list_artifacts()

    @app.get("/api/admin/artifacts/{artifact_id}")
    def artifact_details(artifact_id: str, _session=Depends(admin)):
        return service.get_artifact(artifact_id)

    @app.get("/api/admin/artifacts/{artifact_id}/deletion")
    def artifact_delete_preview(artifact_id: str, _session=Depends(admin)):
        return service.artifact_delete_preview(artifact_id)

    @app.post("/api/admin/artifacts/{artifact_id}/delete")
    def delete_artifact(artifact_id: str, data: ArtifactDeleteInput, _session=Depends(admin)):
        return service.delete_artifact(artifact_id, data.preview_token)

    @app.post("/api/admin/artifacts")
    async def upload(request: Request, _session=Depends(admin)):
        staged = settings.data_dir / "staging" / (uid() + ".part")
        try:
            async with request.form(max_files=3, max_fields=2, max_part_size=65536) as form:
                firmware, manifest, signature = form.get("firmware"), form.get("manifest"), form.get("signature")
                if not all(hasattr(value, "read") for value in (firmware, manifest, signature)):
                    raise Problem(400, "请选择固件、manifest.json 和 signature.txt 三个文件")
                raw = await manifest.read(16385)
                sig = (await signature.read(1025)).decode("ascii").strip()
                if len(raw) > 16384 or len(sig) > 1024:
                    raise Problem(400, "清单或签名文件过大")
                try:
                    parsed = load_json(raw)
                except (ValueError, UnicodeError) as exc:
                    raise Problem(400, "固件清单 JSON 无效") from exc
                total = 0
                with staged.open("xb") as output:
                    while chunk := await firmware.read(65536):
                        total += len(chunk)
                        if total > settings.max_upload:
                            raise Problem(413, "固件超过全局上传上限")
                        output.write(chunk)
                    output.flush()
                    os.fsync(output.fileno())
                notes = str(form.get("notes", ""))
                if len(notes) > 2000:
                    raise Problem(400, "更新说明最多 2000 字")
                return service.upload(parsed, sig, staged, notes)
        except UnicodeError as exc:
            raise Problem(400, "签名文件需为 ASCII/Base64 文本") from exc
        finally:
            staged.unlink(missing_ok=True)

    @app.get("/api/admin/releases")
    def releases(_session=Depends(admin)):
        return service.list_releases()

    @app.patch("/api/admin/releases/{release_id}")
    def update_release(release_id: str, data: ReleaseUpdate, _session=Depends(admin)):
        return service.update_release(release_id, data)

    @app.post("/api/admin/releases/{release_id}/delete")
    def delete_release(release_id: str, _data: Model, _session=Depends(admin)):
        return service.delete_release(release_id)

    @app.post("/api/admin/releases")
    def publish(data: ReleaseInput, _session=Depends(admin)):
        return service.publish(data)

    @app.post("/api/admin/releases/{release_id}/withdraw")
    def withdraw(release_id: str, _session=Depends(admin)):
        with db.transaction() as conn:
            if not conn.execute("""UPDATE releases SET active=0 WHERE id=? AND NOT EXISTS
                (SELECT 1 FROM deleted_releases d WHERE d.release_id=releases.id)""", (release_id,)).rowcount:
                raise Problem(404, "发布不存在")
            service.audit(conn, "release.withdrawn", release_id)
        return {"ok": True}

    @app.get("/api/admin/attempts")
    def attempts(_session=Depends(admin)):
        return db.rows("""SELECT x.*,d.name AS device_name,a.version,t.name AS target_name FROM attempts x
          JOIN devices d ON x.device_id=d.id JOIN releases r ON x.release_id=r.id
          JOIN artifacts a ON r.artifact_id=a.id JOIN targets t ON r.target_id=t.id ORDER BY x.updated DESC LIMIT 500""")

    @app.get("/api/admin/attempts/{attempt_id}/events")
    def events(attempt_id: str, _session=Depends(admin)):
        return db.rows("SELECT seq,payload,created FROM events WHERE attempt_id=? ORDER BY seq", (attempt_id,))

    @app.get("/api/v1/ota/check")
    def check(device_id: str, target_id: str, layout_id: str, bootloader_version: str,
              capabilities: str = "staging,app_confirm", protocol_version: int = 1,
              current_sha256: Digest | None = None, identity=Depends(agent)):
        try:
            info = Compatibility(device_id=device_id, target_id=target_id, layout_id=layout_id,
                                 bootloader_version=bootloader_version, capabilities=capabilities.split(","),
                                 protocol_version=protocol_version)
        except ValueError as exc:
            raise Problem(400, "设备协议版本或兼容参数不正确") from exc
        return service.check(identity, info, current_sha256)

    @app.post("/api/v1/ota/attempts")
    def attempt(data: AttemptInput, identity=Depends(agent)):
        return service.create_attempt(identity, data)

    @app.get("/api/v1/ota/releases/{release_id}/firmware")
    def download(release_id: str, attempt_id: str, identity=Depends(agent)):
        path, release = service.pin_download(identity, release_id, attempt_id)
        try:
            return LeasedFileResponse(path, media_type="application/octet-stream", filename="firmware.bin",
                                      headers={"X-Firmware-SHA256": release["sha256"]},
                                      on_finished=lambda: service.unpin_download(release["sha256"]))
        except BaseException:
            service.unpin_download(release["sha256"])
            raise

    @app.post("/api/v1/devices/heartbeat")
    def heartbeat(data: Heartbeat, identity=Depends(agent)):
        return {**service.heartbeat(identity, data), "accepts_upgrade_failure": True}

    @app.post("/api/v1/devices/upgrade-failure")
    def upgrade_failure(data: UpgradeFailure, identity=Depends(agent)):
        service.device(identity, data.device_id)
        with db.transaction() as conn:
            conn.execute("""INSERT INTO last_upgrade_failure
                (device_id, report_id, stage, error_code, http_status, progress, occurred, received)
                VALUES (:device_id,:report_id,:stage,:error_code,:http_status,:progress,:occurred,:received)
                ON CONFLICT(device_id) DO UPDATE SET report_id=excluded.report_id, stage=excluded.stage,
                error_code=excluded.error_code,http_status=excluded.http_status,progress=excluded.progress,
                occurred=excluded.occurred,received=excluded.received
                WHERE last_upgrade_failure.report_id != excluded.report_id""",
                {**data.model_dump(), "received": time.time()})
        return {"ok": True,"report_id":data.report_id}

    @app.post("/api/v1/devices/commands/claim")
    def claim_command(data: CommandClaim, identity=Depends(agent)):
        return commands.claim(service, identity, data)

    @app.post("/api/v1/devices/commands/{command_id}/events")
    def report_command(command_id: str, data: CommandEvent, identity=Depends(agent)):
        return commands.report(service, identity, command_id, data)

    @app.post("/api/v1/ota/attempts/{attempt_id}/events")
    def event(attempt_id: str, data: EventInput, identity=Depends(agent)):
        return service.event(identity, attempt_id, data)

    return app
