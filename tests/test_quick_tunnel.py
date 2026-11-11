"""Public launcher checks use temporary files and fake credentials only."""
from contextlib import nullcontext
import hashlib
import io
import json
from pathlib import Path
import socket
import sqlite3
import sys

import pytest
from fastapi.testclient import TestClient

from ota_server import quick_tunnel as tunnel
from ota_server.app import create_app
from ota_server.config import Settings


@pytest.mark.parametrize("line, expected", [
    ("| https://clear-forest-cloud.trycloudflare.com |", "https://clear-forest-cloud.trycloudflare.com"),
    ("https://one.trycloudflare.com\n", "https://one.trycloudflare.com"),
    ("https://one.trycloudflare.com.attacker.example", None),
    ("http://one.trycloudflare.com", None),
    ("https://trycloudflare.com", None),
    ("https://one.trycloudflare.com@attacker.example", None),
    ('failed to request quick Tunnel: Post "https://api.trycloudflare.com/tunnel": context deadline exceeded', None),
    ('2026-10-24T13:02:53Z INF | https://clear-forest-cloud.trycloudflare.com   |', 'https://clear-forest-cloud.trycloudflare.com'),
    ('https://api.trycloudflare.com', None),
])
def test_only_accept_assigned_https_origin(line, expected):
    assert tunnel.tunnel_url(line) == expected


def configure_cache(monkeypatch, tmp_path):
    monkeypatch.setattr(tunnel, "CACHE", tmp_path)
    monkeypatch.setattr(tunnel.platform, "system", lambda: "Windows")
    monkeypatch.setattr(tunnel.platform, "machine", lambda: "AMD64")
    monkeypatch.setattr(tunnel, "SHA256", hashlib.sha256(b"verified fixture binary").hexdigest())


class DownloadOpener:
    def __init__(self, function):
        self.open = function


def test_download_verified_before_it_becomes_executable(monkeypatch, tmp_path):
    configure_cache(monkeypatch, tmp_path)
    calls = []

    def download(request, timeout):
        calls.append(request.full_url)
        return io.BytesIO(b"verified fixture binary")

    monkeypatch.setattr(tunnel, "build_opener", lambda *args: DownloadOpener(download))
    binary = tunnel.ensure_cloudflared()
    assert binary.read_bytes() == b"verified fixture binary"
    assert tunnel.ensure_cloudflared() == binary
    assert calls == [tunnel.DOWNLOAD]  # Verified cache reused without network.
    assert not list(tmp_path.rglob("*.download"))


def test_bad_download_is_removed_and_never_published(monkeypatch, tmp_path):
    configure_cache(monkeypatch, tmp_path)
    monkeypatch.setattr(tunnel, "build_opener", lambda *args: DownloadOpener(lambda *a, **k: io.BytesIO(b"tampered")))
    with pytest.raises(ValueError, match="校验失败"):
        tunnel.ensure_cloudflared()
    assert not list(tmp_path.rglob("*.exe"))
    assert not list(tmp_path.rglob("*.download"))


def test_tampered_cache_is_not_run_or_silently_replaced(monkeypatch, tmp_path):
    configure_cache(monkeypatch, tmp_path)
    binary = tmp_path / "cloudflared" / tunnel.VERSION / tunnel.ASSET
    binary.parent.mkdir(parents=True)
    binary.write_bytes(b"tampered")
    with pytest.raises(ValueError, match="摘要不匹配"):
        tunnel.ensure_cloudflared()
    assert binary.read_bytes() == b"tampered"


def test_public_child_has_exact_origin_no_lan_or_init_password(monkeypatch, tmp_path):
    monkeypatch.setenv("OTA_PUBLIC_URL", "http://127.0.0.1:8000")
    monkeypatch.setenv("OTA_LAN_HTTP_HOST", "192.168.1.20")
    monkeypatch.setenv("FORWARDED_ALLOW_IPS", "*")
    monkeypatch.setenv("OTA_ADMIN_PASSWORD", "fixture-only-password")
    result = tunnel.child_env("https://clear-forest.trycloudflare.com", tmp_path)
    assert result["OTA_PUBLIC_URL"] == "https://clear-forest.trycloudflare.com"
    assert result["OTA_LAN_HTTP_HOST"] == ""
    assert result["FORWARDED_ALLOW_IPS"] == "127.0.0.1"
    assert "OTA_ADMIN_PASSWORD" not in result
    assert result["OTA_DATA_DIR"] == str(tmp_path)


@pytest.mark.skipif(sys.platform != "win32", reason="Windows proxy registry")
def test_no_proxy_only_still_honors_enabled_windows_proxy(monkeypatch):
    for key in list(tunnel.os.environ):
        if key.lower() in ('http_proxy', 'https_proxy', 'all_proxy', 'no_proxy'):
            monkeypatch.delenv(key)
    monkeypatch.setenv('NO_PROXY', 'localhost,127.0.0.1')
    monkeypatch.setattr(tunnel.http_request, 'getproxies', lambda: {'no': 'localhost,127.0.0.1'})
    monkeypatch.setattr(tunnel.http_request, 'getproxies_registry', lambda: {'http': 'http://127.0.0.1:10808', 'https': 'http://127.0.0.1:10808'})
    values=tunnel.network_proxies()
    assert values['no']=='localhost,127.0.0.1'
    assert values['https']=='http://127.0.0.1:10808'
    assert tunnel.network_env()['HTTPS_PROXY']=='http://127.0.0.1:10808'


@pytest.mark.skipif(sys.platform != "win32", reason="Windows proxy registry")
def test_system_proxy_does_not_override_explicit_environment(monkeypatch):
    monkeypatch.setenv('HTTPS_PROXY', '')
    monkeypatch.setattr(tunnel.http_request, 'getproxies', lambda: {'http': 'http://explicit.example:8080'})
    monkeypatch.setattr(tunnel.http_request, 'getproxies_registry', lambda: {'http': 'http://127.0.0.1:10808', 'https': 'http://127.0.0.1:10808'})
    values=tunnel.network_proxies()
    assert values['http']=='http://explicit.example:8080'
    assert 'https' not in values
    assert tunnel.network_env()['HTTPS_PROXY']==''


def test_loopback_checks_bypass_all_proxies(monkeypatch):
    captured=[]
    monkeypatch.setattr(tunnel, 'network_proxies', lambda: pytest.fail('Loopback must not consult proxy settings'))

    class Response(io.BytesIO):
        status=200
        headers={}

    def opener(handler):
        captured.append(handler.proxies)
        return DownloadOpener(lambda *a, **k: Response(b'ok'))

    monkeypatch.setattr(tunnel, 'build_opener', opener)
    assert tunnel.read_response('http://127.0.0.1:8000/healthz', local=True)[0]==200
    assert captured==[{}]


@pytest.mark.skipif(sys.platform != "win32", reason="Windows launcher lock")
def test_launcher_lock_rejects_second_owner_and_is_reusable(monkeypatch, tmp_path):
    monkeypatch.setattr(tunnel, "CACHE", tmp_path)
    with tunnel.launcher_lock():
        with pytest.raises(ValueError, match="已有公网启动器"):
            with tunnel.launcher_lock():
                pytest.fail("Second launcher unexpectedly acquired the lock")
    with tunnel.launcher_lock():
        pass


def test_uninitialized_database_is_not_exposed_or_modified(tmp_path):
    database = tmp_path / "ota.sqlite3"
    with sqlite3.connect(database) as connection:
        connection.execute("CREATE TABLE admins(id INTEGER)")
    before = database.read_bytes()
    with pytest.raises(ValueError, match="尚未初始化"):
        tunnel.check_local(tmp_path, 8000)
    assert database.read_bytes() == before


def test_busy_port_refuses_duplicate_backend(h):
    with socket.socket() as occupied:
        occupied.bind(("127.0.0.1", 0))
        occupied.listen()
        with pytest.raises(ValueError, match="端口 .* 已被占用"):
            tunnel.check_local(h.settings.data_dir, occupied.getsockname()[1])


def test_real_public_origin_has_secure_login_and_protected_admin(h, monkeypatch):
    origin = "https://clear-forest.trycloudflare.com"
    app = create_app(Settings(h.settings.data_dir, origin))
    with TestClient(app, base_url=origin) as client:
        def response(url, **kwargs):
            result = client.get(url.replace("http://127.0.0.1:8000", origin))
            return result.status_code, result.headers, result.content

        monkeypatch.setattr(tunnel, "read_response", response)
        tunnel.probe_origin(origin)
        tunnel.probe_origin(origin, "http://127.0.0.1:8000")
        assert client.get('/login', headers={"Host": "other.trycloudflare.com"}).status_code == 400
        assert client.post('/login', headers={"Origin": "https://other.trycloudflare.com"}).status_code == 403


def test_readiness_rejects_unprotected_admin(monkeypatch):
    def response(url, **kwargs):
        if url.endswith("/healthz"):
            return 200, {}, b'{"status":"ok"}'
        if url.endswith("/login"):
            return 200, {"Set-Cookie": "ota_login=fake; Secure; HttpOnly; SameSite=Strict"}, b'name="csrf"'
        return 200, {}, b'{}'

    monkeypatch.setattr(tunnel, "read_response", response)
    with pytest.raises(ValueError, match="鉴权检查"):
        tunnel.probe_origin("https://clear-forest.trycloudflare.com")


@pytest.mark.skipif(sys.platform != "win32", reason="Windows process lifecycle")
def test_cancel_during_startup_stops_both_owned_children(monkeypatch, tmp_path):
    monkeypatch.setattr(tunnel, "CACHE", tmp_path)
    monkeypatch.setattr(tunnel, "STATE", tmp_path / "state.json")
    monkeypatch.setattr(tunnel, "STOP", tmp_path / "stop")
    monkeypatch.setattr(tunnel, "launcher_lock", nullcontext)
    monkeypatch.setattr(tunnel, "check_local", lambda *args: None)
    children, stopped = [], []

    class Child:
        def __init__(self, args, **kwargs):
            children.append(self)
            self.stdout = io.StringIO("| https://clear-forest.trycloudflare.com |\n")

        def poll(self):
            return None

    def cancel(*args):
        raise KeyboardInterrupt()

    monkeypatch.setattr(tunnel.subprocess, "Popen", Child)
    monkeypatch.setattr(tunnel, "stop_child", stopped.append)
    monkeypatch.setattr(tunnel, "probe_origin", cancel)
    with pytest.raises(KeyboardInterrupt):
        tunnel.run_tunnel(Path("fixture.exe"), tmp_path, 8000, "http2", 10)
    assert len(children) == 2 and stopped == children[::-1]
    assert json.loads(tunnel.STATE.read_text(encoding="utf-8"))["status"] == "stopped"


@pytest.mark.skipif(sys.platform != "win32", reason="Windows process lifecycle")
def test_cleanup_attempts_both_children_when_one_stop_fails(monkeypatch, tmp_path):
    monkeypatch.setattr(tunnel, "CACHE", tmp_path)
    monkeypatch.setattr(tunnel, "STATE", tmp_path / "state.json")
    monkeypatch.setattr(tunnel, "STOP", tmp_path / "stop")
    monkeypatch.setattr(tunnel, "launcher_lock", nullcontext)
    monkeypatch.setattr(tunnel, "check_local", lambda *args: None)
    stopped = []

    class Child:
        def __init__(self, args, **kwargs):
            self.stdout = io.StringIO("https://clear-forest.trycloudflare.com\n")

        def poll(self):
            return None

    def stop(child):
        stopped.append(child)
        if len(stopped) == 1:
            raise OSError("fixture cleanup failure")

    monkeypatch.setattr(tunnel.subprocess, "Popen", Child)
    monkeypatch.setattr(tunnel, "stop_child", stop)
    monkeypatch.setattr(tunnel, "probe_origin", lambda *args: (_ for _ in ()).throw(KeyboardInterrupt()))
    with pytest.raises(KeyboardInterrupt):
        tunnel.run_tunnel(Path("fixture.exe"), tmp_path, 8000, "http2", 10)
    assert len(stopped) == 2
    assert json.loads(tunnel.STATE.read_text(encoding="utf-8"))["status"] == "error"
