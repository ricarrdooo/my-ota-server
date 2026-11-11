"""Own one temporary Cloudflare tunnel and one loopback-only OTA process.

This is a Windows convenience launcher, not another application worker. Nothing
in this module changes authentication, origins, cookies or firmware verification.
"""
import argparse
from contextlib import contextmanager, nullcontext
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import platform
import queue
import re
import signal
import socket
import sqlite3
import subprocess
import sys
import threading
import time
from urllib.error import HTTPError, URLError
from urllib.parse import urlsplit
from urllib.request import ProxyHandler, Request, build_opener
import urllib.request as http_request
import uuid


ROOT = Path(__file__).resolve().parents[1]
CACHE = ROOT / ".cache"
STATE = CACHE / "quick-tunnel.json"
STOP = CACHE / "quick-tunnel.stop"
VERSION = "2026.10.3"
ASSET = "cloudflared-windows-amd64.exe"
SHA256 = "76b2805253d0d6ffacb092a7acfbee99e7af6917835c0c5410e23f3ef5052da2"
DOWNLOAD = f"https://github.com/cloudflare/cloudflared/releases/download/{VERSION}/{ASSET}"
URL_PATTERN = re.compile(r"https://[a-z0-9]+(?:-[a-z0-9]+)*\.trycloudflare\.com")


def tunnel_url(line):
    # Accept the announced box line (or a bare origin), not API URLs that
    # happen to appear in connection errors or diagnostic messages.
    candidate = line.strip()
    if "|" in candidate:
        parts = candidate.rsplit("|", 2)
        if len(parts) != 3 or parts[-1].strip():
            return None
        candidate = parts[-2].strip()
    if URL_PATTERN.fullmatch(candidate) and urlsplit(candidate).hostname not in ("api.trycloudflare.com", "www.trycloudflare.com"):
        return candidate
    return None


def network_proxies():
    # urllib's Windows fallback is skipped when NO_PROXY is the only proxy
    # environment variable. Merge the enabled system proxies explicitly while
    # respecting even an explicitly empty HTTP(S)_PROXY environment setting.
    result = dict(http_request.getproxies())
    if sys.platform == "win32":
        system = http_request.getproxies_registry()
        environment_keys = {key.lower() for key in os.environ}
        for scheme in ("http", "https"):
            if scheme not in result and scheme + "_proxy" not in environment_keys and system.get(scheme):
                result[scheme] = system[scheme]
    return result


def network_env():
    result = os.environ.copy()
    for scheme, proxy in network_proxies().items():
        if scheme in ("http", "https") and proxy:
            result.setdefault(scheme.upper() + "_PROXY", proxy)
    return result


def write_state(**value):
    CACHE.mkdir(exist_ok=True)
    temporary = STATE.with_suffix(".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, indent=2), encoding="utf-8")
    temporary.replace(STATE)


@contextmanager
def launcher_lock():
    import msvcrt
    CACHE.mkdir(exist_ok=True)
    with (CACHE / "quick-tunnel.lock").open("a+b") as handle:
        handle.seek(0, 2)
        if not handle.tell():
            handle.write(b"0")
            handle.flush()
        handle.seek(0)
        try:
            msvcrt.locking(handle.fileno(), msvcrt.LK_NBLCK, 1)
        except OSError as exc:
            raise ValueError("已有公网启动器运行。请先运行 scripts/stop-public.ps1，不要重复启动。") from exc
        try:
            yield
        finally:
            handle.seek(0)
            msvcrt.locking(handle.fileno(), msvcrt.LK_UNLCK, 1)


def ensure_cloudflared():
    if platform.system() != "Windows" or platform.machine().upper() not in ("AMD64", "X86_64"):
        raise ValueError("此启动器的便携下载目前支持 Windows x64。")
    binary = CACHE / "cloudflared" / VERSION / ASSET
    if binary.is_file():
        with binary.open("rb") as existing:
            digest = hashlib.file_digest(existing, "sha256").hexdigest()
        if digest != SHA256:
            raise ValueError(f"cloudflared 摘要不匹配，拒绝执行。请移除这个文件后重试：{binary}")
        return binary
    binary.parent.mkdir(parents=True, exist_ok=True)
    temporary = binary.with_suffix(f".{uuid.uuid4().hex}.download")
    print(f"正在下载 Cloudflare 官方便携版 {VERSION}（约 53 MiB），不安装系统服务…", flush=True)
    digest = hashlib.sha256()
    try:
        request = Request(DOWNLOAD, headers={"User-Agent": "OTA-Station-Quick-Tunnel"})
        opener = build_opener(ProxyHandler(network_proxies()))
        with opener.open(request, timeout=45) as response, temporary.open("xb") as output:
            while chunk := response.read(1024 * 1024):
                digest.update(chunk)
                output.write(chunk)
        if digest.hexdigest() != SHA256:
            raise ValueError("cloudflared 下载校验失败，未执行下载文件。")
        temporary.replace(binary)
    finally:
        temporary.unlink(missing_ok=True)
    print("cloudflared SHA-256 校验通过。", flush=True)
    return binary


def check_data(data_dir):
    if not (ROOT / "ota_server/static/admin/admin.js").is_file():
        raise ValueError("缺少前端资源，请先运行 scripts/build-ui.ps1。")
    database = data_dir / "ota.sqlite3"
    if not database.is_file():
        raise ValueError("未找到现有数据库。请先使用本机模式初始化管理员，再开放公网。")
    connection = sqlite3.connect(database.as_uri() + "?mode=ro", uri=True)
    try:
        if not connection.execute("SELECT 1 FROM admins LIMIT 1").fetchone():
            raise ValueError("尚未初始化管理员。请先使用本机模式完成初始化。")
    finally:
        connection.close()


def check_local(data_dir, port):
    check_data(data_dir)
    try:
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as probe:
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                probe.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            probe.bind(("127.0.0.1", port))
    except OSError as exc:
        raise ValueError(f"端口 {port} 已被占用。请先在原终端 Ctrl+C 停止本机 OTA 后台；不要同时运行两个后台。") from exc


def child_env(origin, data_dir):
    result = os.environ.copy()
    result.update(OTA_PUBLIC_URL=origin, OTA_DATA_DIR=str(data_dir), OTA_LAN_HTTP_HOST="",
                  FORWARDED_ALLOW_IPS="127.0.0.1", PYTHONIOENCODING="utf-8")
    # An initialization password is never needed by a serving process.
    result.pop("OTA_ADMIN_PASSWORD", None)
    return result


def read_response(url, *, local=False, host=None):
    headers = {"Cache-Control": "no-cache", "User-Agent": "OTA-Station-Readiness"}
    if host:
        headers["Host"] = host
    opener = build_opener(ProxyHandler({} if local else network_proxies()))
    request = Request(url, headers=headers)
    try:
        with opener.open(request, timeout=8) as response:
            return response.status, response.headers, response.read(1024 * 1024)
    except HTTPError as exc:
        return exc.code, exc.headers, exc.read(65536)


def probe_origin(origin, local_base=None):
    base = local_base or origin
    kwargs = {"local": bool(local_base), "host": urlsplit(origin).netloc if local_base else None}
    status, _, body = read_response(base + "/healthz", **kwargs)
    if status != 200 or json.loads(body).get("status") != "ok":
        raise ValueError(f"健康检查未通过（HTTP {status}）。")
    status, headers, body = read_response(base + "/login", **kwargs)
    cookie = headers.get("Set-Cookie", "").lower()
    if (status != 200 or b'name="csrf"' not in body or "secure" not in cookie
            or "httponly" not in cookie or "samesite=strict" not in cookie):
        raise ValueError("HTTPS 登录页或安全 Cookie 检查未通过。")
    status, _, _ = read_response(base + "/api/admin/overview", **kwargs)
    if status != 401:
        raise ValueError(f"管理员接口鉴权检查未通过（HTTP {status}）。")


def stop_child(process):
    if process is None or process.poll() is not None:
        return
    try:
        process.send_signal(signal.CTRL_BREAK_EVENT)
        process.wait(timeout=10)
    except (OSError, subprocess.TimeoutExpired):
        # Windows venv launchers spawn another Python. Stop only the tree that
        # this launcher created; never enumerate/terminate unrelated Python jobs.
        if process.poll() is None:
            subprocess.run(["taskkill", "/PID", str(process.pid), "/T", "/F"],
                           stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
                           creationflags=subprocess.CREATE_NO_WINDOW, timeout=15, check=False)
            process.wait(timeout=5)


def run_tunnel(binary, data_dir, port, protocol, timeout, handover=None):
    with launcher_lock(), (handover if handover is not None else nullcontext()):
        if handover is not None:
            check_data(data_dir)
            handover.release_local()
        check_local(data_dir, port)
        STOP.unlink(missing_ok=True)
        run_dir = CACHE / "quick-tunnel" / (datetime.now().strftime("%Y%m%d-%H%M%S-") + uuid.uuid4().hex[:6])
        run_dir.mkdir(parents=True)
        # Override discovery without modifying ~/.cloudflared or using a user's
        # named-tunnel credentials. An empty config still selects Quick Tunnel.
        config = run_dir / "cloudflared.yml"
        config.write_text("{}\n", encoding="utf-8")
        origin = None
        tunnel = app = None
        records = queue.Queue(maxsize=4)
        reader = None
        started = datetime.now(timezone.utc).isoformat()
        values = dict(url=None, port=port, pid=os.getpid(), started_at=started, log_dir=str(run_dir))
        write_state(status="starting", **values)
        flags = subprocess.CREATE_NEW_PROCESS_GROUP
        if handover is not None:
            flags |= subprocess.CREATE_NO_WINDOW
        try:
            command = [str(binary), "tunnel", "--config", str(config), "--no-autoupdate", "--url",
                       f"http://127.0.0.1:{port}", "--protocol", protocol, "--edge-ip-version", "4",
                       "--metrics", "127.0.0.1:0"]
            tunnel = subprocess.Popen(command, stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
                                      text=True, encoding="utf-8", errors="replace", cwd=ROOT,
                                      creationflags=flags, env=network_env())

            def collect():
                with (run_dir / "cloudflared.log").open("w", encoding="utf-8") as log:
                    for line in tunnel.stdout:
                        log.write(line)
                        log.flush()
                        if tunnel_url(line):
                            try:
                                records.put_nowait(line)
                            except queue.Full:
                                pass

            reader = threading.Thread(target=collect, daemon=True)
            reader.start()
            deadline = time.monotonic() + timeout
            while not origin:
                if STOP.exists():
                    return
                if tunnel.poll() is not None or time.monotonic() >= deadline:
                    raise ValueError(f"未取得临时地址，请查看 {run_dir / 'cloudflared.log'}。")
                try:
                    origin = tunnel_url(records.get(timeout=0.5))
                except queue.Empty:
                    pass
            values["url"] = origin
            write_state(status="starting", **values)
            print(f"已取得临时地址：{origin}，正在检查连接…", flush=True)
            with (run_dir / "app.log").open("w", encoding="utf-8") as log:
                app = subprocess.Popen([sys.executable, "-m", "ota_server", "serve", "--host", "127.0.0.1",
                                        "--port", str(port)], cwd=ROOT, env=child_env(origin, data_dir),
                                       stdout=log, stderr=subprocess.STDOUT, creationflags=flags)
                deadline = time.monotonic() + timeout
                last_error = None
                while time.monotonic() < deadline:
                    if STOP.exists():
                        return
                    if app.poll() is not None or tunnel.poll() is not None:
                        raise ValueError(f"后台或隧道已退出，请查看日志目录 {run_dir}。")
                    try:
                        probe_origin(origin, f"http://127.0.0.1:{port}")
                        probe_origin(origin)
                        break
                    except (OSError, URLError, ValueError) as exc:
                        last_error = exc
                        time.sleep(2)
                else:
                    raise ValueError(f"公网就绪检查超时：{last_error}；日志目录：{run_dir}")
                write_state(status="ready", **values)
                print(f"PUBLIC_URL={origin}\n公网健康检查、HTTPS 登录页及管理员鉴权均通过。\n"
                      "请使用原管理员账户登录。停止：scripts/stop-public.ps1 或 Ctrl+C。\n"
                      "临时地址随隧道重建变化；设备 OTA 地址也需同步更新。", flush=True)
                while not STOP.exists():
                    if app.poll() is not None or tunnel.poll() is not None:
                        raise ValueError(f"后台或隧道意外退出，请查看 {run_dir}。")
                    time.sleep(1)
        except BaseException as exc:
            write_state(status="stopped" if isinstance(exc, KeyboardInterrupt) else "error",
                        error="操作已中止" if isinstance(exc, KeyboardInterrupt) else str(exc), **values)
            raise
        finally:
            cleanup_errors = []
            for process in (app, tunnel):
                try:
                    stop_child(process)
                except (OSError, subprocess.SubprocessError) as exc:
                    cleanup_errors.append(str(exc))
            if reader:
                reader.join(timeout=2)
            if cleanup_errors:
                write_state(status="error", error="停止子进程失败：" + "; ".join(cleanup_errors), **values)
                print("停止子进程失败，请检查日志和监听端口。", file=sys.stderr)
            elif STATE.exists() and json.loads(STATE.read_text(encoding="utf-8")).get("status") != "error":
                write_state(status="stopped", **values)
            STOP.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description="免费 Cloudflare 临时 HTTPS 入口（Windows x64）")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--data-dir", type=Path, default=Path(os.environ.get("OTA_DATA_DIR", str(ROOT / "data"))))
    parser.add_argument("--protocol", choices=("http2", "quic", "auto"), default="auto")
    parser.add_argument("--startup-timeout", type=int, default=120)
    parser.add_argument("--prepare-only", action="store_true", help="只下载并校验便携工具，不开放服务")
    parser.add_argument("--stop", action="store_true", help="请求本启动器停止自己的后台和隧道")
    args = parser.parse_args()
    try:
        if args.stop:
            if not STATE.is_file() or json.loads(STATE.read_text(encoding="utf-8")).get("status") not in ("starting", "ready"):
                print("当前没有已记录的运行中公网启动器。")
                return
            STOP.write_text("stop\n", encoding="ascii")
            print("已请求停止公网启动器；只停止它创建的后台和隧道。")
            return
        if not 1024 <= args.port <= 65535 or not 10 <= args.startup_timeout <= 300:
            raise ValueError("端口范围为 1024～65535，就绪等待范围为 10～300 秒。")
        if not args.prepare_only:
            check_local(args.data_dir.resolve(), args.port)
        binary = ensure_cloudflared()
        if args.prepare_only:
            print(f"便携工具已准备：{binary}")
            return
        run_tunnel(binary, args.data_dir.resolve(), args.port, args.protocol, args.startup_timeout)
    except KeyboardInterrupt:
        print("公网后台和隧道已停止。")
    except (ValueError, OSError, sqlite3.Error) as exc:
        parser.exit(1, f"启动失败：{exc}\n")


if __name__ == "__main__":
    main()
