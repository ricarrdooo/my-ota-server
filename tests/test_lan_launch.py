"""Launcher tests do not bind real sockets or touch production data."""
import socket

import pytest
import uvicorn

from ota_server.config import Settings
from ota_server.lan import serve_lan
from ota_server import __main__ as cli


class FakeSocket:
    def __init__(self):
        self.closed = False
        self.bound = None

    def setsockopt(self, *args):
        pass

    def bind(self, address):
        self.bound = address

    def setblocking(self, value):
        assert value is False

    def close(self):
        self.closed = True


def test_lan_binds_two_exact_addresses_and_disables_proxy_headers(tmp_path, monkeypatch):
    settings = Settings(tmp_path, lan_http_host="192.168.10.187")
    sockets, captured = [], {}

    def factory(*args):
        assert args == (socket.AF_INET, socket.SOCK_STREAM)
        value = FakeSocket()
        sockets.append(value)
        return value

    def configuration(app, **kwargs):
        captured.update(kwargs)
        assert app == "test-app"
        return "test-config"

    class Server:
        def __init__(self, config):
            assert config == "test-config"

        def run(self, *, sockets):
            assert [value.bound for value in sockets] == [("127.0.0.1", 8000), ("192.168.10.187", 8000)]

    monkeypatch.setattr(socket, "socket", factory)
    monkeypatch.setattr(uvicorn, "Config", configuration)
    monkeypatch.setattr(uvicorn, "Server", Server)
    monkeypatch.setenv("FORWARDED_ALLOW_IPS", "*")
    serve_lan("test-app", settings, 8000)
    assert captured["proxy_headers"] is False
    assert captured["access_log"] is False
    assert captured["host"] == "127.0.0.1"
    assert all(value.closed for value in sockets)


def test_lan_bind_failure_closes_all_sockets(tmp_path, monkeypatch):
    settings = Settings(tmp_path, lan_http_host="192.168.10.187")
    sockets = []

    def factory(*_):
        value = FakeSocket()
        if sockets:
            def failure(_):
                raise OSError("test bind failure")
            value.bind = failure
        sockets.append(value)
        return value

    monkeypatch.setattr(socket, "socket", factory)
    with pytest.raises(OSError):
        serve_lan("test-app", settings, 8000)
    assert len(sockets) == 2 and all(value.closed for value in sockets)


@pytest.mark.parametrize("port", [0, 8001, 65536])
def test_lan_listen_port_must_match_local_admin_origin(tmp_path, port):
    with pytest.raises(ValueError):
        serve_lan("test-app", Settings(tmp_path, lan_http_host="192.168.10.187"), port)


def test_cli_lan_flag_uses_restricted_launcher(tmp_path, monkeypatch):
    import sys
    from ota_server import lan
    monkeypatch.setenv("OTA_DATA_DIR", str(tmp_path))
    monkeypatch.setenv("OTA_PUBLIC_URL", "http://127.0.0.1:8000")
    monkeypatch.delenv("OTA_LAN_HTTP_HOST", raising=False)
    monkeypatch.setattr(sys, "argv", ["ota_server", "serve", "--lan-http-host", "192.168.10.187"])
    captured = {}
    monkeypatch.setattr(lan, "serve_lan", lambda app, settings, port: captured.update(settings=settings, port=port))
    cli.main()
    assert captured["settings"].lan_http_host == "192.168.10.187"
    assert captured["port"] == 8000
