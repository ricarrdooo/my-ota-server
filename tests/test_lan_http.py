"""Private HTTP is opt-in and may expose device APIs, never the admin UI.

All databases and generated credentials in this module belong to pytest's
temporary fixtures. ASGI transport addresses model listeners and peers; there
are no real network listeners or device heartbeats in these tests.
"""
import hashlib
import logging
import re

import pytest
from fastapi.testclient import TestClient
from starlette.websockets import WebSocketDisconnect

from ota_server.app import create_app
from ota_server.config import Settings
from ota_server.lan import serve_lan
from conftest import raw_fixture


LAN_IP = "192.168.10.187"
LAN_URL = f"http://{LAN_IP}:8000"
LOCAL_URL = "http://127.0.0.1:8000"
DEVICE_PEER = ("192.168.10.88", 49152)


@pytest.fixture
def lan_app(h):
    # Reuse only the temporary fixture's database, not the user's server data.
    return create_app(Settings(h.settings.data_dir, LOCAL_URL, lan_http_host=LAN_IP))


def test_lan_debug_defaults_to_disabled(tmp_path, monkeypatch):
    assert Settings(tmp_path).lan_http_host == ""
    monkeypatch.setenv("OTA_DATA_DIR", str(tmp_path / "env-data"))
    monkeypatch.setenv("OTA_PUBLIC_URL", LOCAL_URL)
    monkeypatch.delenv("OTA_LAN_HTTP_HOST", raising=False)
    assert Settings.from_env().lan_http_host == ""
    monkeypatch.setenv("OTA_LAN_HTTP_HOST", LAN_IP)
    settings = Settings.from_env()
    assert settings.lan_http_host == LAN_IP
    assert settings.public_url == LOCAL_URL
    assert not settings.secure_cookie


@pytest.mark.parametrize("host", [
    "10.0.0.1", "10.255.255.254", "172.16.0.1", "172.31.255.254",
    "192.168.0.1", "192.168.255.254",
])
def test_lan_setting_accepts_rfc1918_ipv4_only(tmp_path, host):
    assert Settings(tmp_path, LOCAL_URL, lan_http_host=host).lan_http_host == host


@pytest.mark.parametrize("host", [
    "0.0.0.0", "127.0.0.1", "localhost", "ota.example.com", "8.8.8.8",
    "100.64.0.1", "169.254.1.1", "192.0.2.1", "198.18.0.1", "224.0.0.1",
    "172.15.255.254", "172.32.0.1", "192.169.0.1", "::1", "fc00::1",
    "::ffff:192.168.10.187", "192.168.010.187", "192.168.10.187:8000",
    "http://192.168.10.187", "192.168.10.187/", " 192.168.10.187", "192.168.10.187 ",
])
def test_invalid_lan_setting_is_rejected(tmp_path, host):
    with pytest.raises(ValueError):
        Settings(tmp_path, LOCAL_URL, lan_http_host=host)


@pytest.mark.parametrize("public_url", [
    "https://ota.example.com", "https://127.0.0.1:8000", LAN_URL,
    "http://0.0.0.0:8000", "http://ota.example.com:8000",
    "http://testserver", "http://[::1]:8000",
    "http://admin:password@127.0.0.1:8000", "http://127.0.0.1:8000/api",
    "http://127.0.0.1:8000?debug=1", "http://127.0.0.1:8000#debug",
    "http://127.0.0.1:0", "http://127.0.0.1:65536",
])
def test_debug_cannot_replace_local_admin_origin_or_mix_with_https(tmp_path, public_url):
    with pytest.raises(ValueError):
        Settings(tmp_path, public_url, lan_http_host=LAN_IP)


def test_localhost_admin_origin_remains_supported(tmp_path):
    settings = Settings(tmp_path, "http://localhost:8000", lan_http_host=LAN_IP)
    assert settings.public_url == "http://localhost:8000"


def test_authenticated_lan_heartbeat_check_download_and_events(lan_app, h):
    device, release = h.make_device(), h.publish()
    digest = hashlib.sha256(raw_fixture()).hexdigest()
    with TestClient(lan_app, base_url=LAN_URL, client=DEVICE_PEER) as client:
        assert client.get("/healthz").json()["status"] == "ok"
        heartbeat = client.post("/api/v1/devices/heartbeat", headers=h.auth(device), json={
            "device_id": device["id"], "version": "1.0.0", "sha256": digest,
        })
        assert heartbeat.status_code == 200, heartbeat.text
        row = h.db.one("SELECT current_version,current_sha256,last_seen FROM devices WHERE id=?", (device["id"],))
        assert row["current_version"] == "1.0.0"
        assert row["current_sha256"] == digest
        assert row["last_seen"] > 0
        assert h.svc.overview()["online_devices"] == 1

        info = h.compat(device)
        params = dict(info, capabilities=",".join(info["capabilities"]))
        checked = client.get("/api/v1/ota/check", params=params, headers=h.auth(device))
        assert checked.status_code == 200, checked.text
        offer = checked.json()
        assert offer["update_available"] and offer["release_id"] == release["id"]
        assert not client.get("/api/v1/ota/check", params=dict(params, current_sha256=digest),
                              headers=h.auth(device)).json()["update_available"]

        attempt = client.post("/api/v1/ota/attempts", headers=h.auth(device), json=dict(
            info, release_id=release["id"], request_id="lan-test-attempt-0001"))
        assert attempt.status_code == 200, attempt.text
        attempt_id = attempt.json()["id"]
        downloaded = client.get(offer["download_path"], params={"attempt_id": attempt_id}, headers=h.auth(device))
        assert downloaded.status_code == 200
        assert downloaded.content == raw_fixture()
        assert downloaded.headers["x-firmware-sha256"] == digest

        phases = ("downloading", "downloaded", "validating", "installing", "pending_boot", "confirmed")
        for seq, state in enumerate(phases, 1):
            payload = {"seq": seq, "state": state, "progress": 100}
            if state == "confirmed":
                payload.update(version="1.0.0", sha256=digest)
            event = client.post(f"/api/v1/ota/attempts/{attempt_id}/events", headers=h.auth(device), json=payload)
            assert event.status_code == 200, event.text
        assert h.db.one("SELECT state FROM attempts WHERE id=?", (attempt_id,))["state"] == "confirmed"


@pytest.mark.parametrize("headers", [{}, {"Authorization": "Bearer invalid-test-only-token"}])
def test_lan_device_routes_still_require_real_device_credentials(lan_app, h, headers):
    device = h.make_device()
    with TestClient(lan_app, base_url=LAN_URL, client=DEVICE_PEER) as client:
        assert client.get("/api/v1/ota/check", params={
            **h.compat(device), "capabilities": "staging,app_confirm",
        }, headers=headers).status_code == 401
        assert client.post("/api/v1/devices/heartbeat", headers=headers, json={
            "device_id": device["id"], "version": "1.0.0", "sha256": "0" * 64,
        }).status_code == 401
        assert client.post("/api/v1/ota/attempts", headers=headers, json={}).status_code == 401
        assert client.get("/api/v1/ota/releases/test-release-0001/firmware", headers=headers,
                          params={"attempt_id": "test-attempt-0001"}).status_code == 401
        assert client.post("/api/v1/ota/attempts/test-attempt-0001/events", headers=headers,
                           json={"seq": 1, "state": "downloading"}).status_code == 401


@pytest.mark.parametrize("path", [
    "/", "/login", "/static/app.js", "/static/pack-ui.mjs", "/static/pack-core.mjs",
    "/api/admin/catalog", "/api/admin/devices", "/api/admin/artifacts", "/api/admin/logout",
    "/api/v1/not-a-device-api", "/api/v1/ota/check/", "/api/v1/ota/attempts/short/events",
    "/healthz/", "/docs", "/openapi.json", "/favicon.ico",
])
def test_lan_listener_never_exposes_admin_or_unlisted_routes(lan_app, path):
    # Host-only checks are insufficient: even a local peer on the LAN listener
    # must not obtain management pages, cookies, scripts or administrative APIs.
    for peer in (DEVICE_PEER, ("127.0.0.1", 49152)):
        with TestClient(lan_app, base_url=LAN_URL, client=peer) as client:
            for verb in ("GET", "POST", "HEAD", "OPTIONS"):
                response = client.request(verb, path, follow_redirects=False)
                assert response.status_code == 403, (verb, path, peer, response.text)
                assert "set-cookie" not in response.headers


@pytest.mark.parametrize("verb,path", [
    ("POST", "/healthz"), ("HEAD", "/healthz"), ("POST", "/api/v1/ota/check"),
    ("GET", "/api/v1/ota/attempts"), ("GET", "/api/v1/devices/heartbeat"),
    ("POST", "/api/v1/ota/releases/test-release-0001/firmware"),
    ("GET", "/api/v1/ota/attempts/test-attempt-0001/events"),
])
def test_lan_route_allowlist_checks_http_method(lan_app, verb, path):
    with TestClient(lan_app, base_url=LAN_URL, client=DEVICE_PEER) as client:
        assert client.request(verb, path).status_code == 403


@pytest.mark.parametrize("peer", [
    "8.8.8.8", "100.64.0.1", "169.254.1.1", "192.0.2.1", "172.32.0.1",
    "fc00::1234", "::ffff:192.168.10.88", "testclient",
])
def test_non_private_network_peers_are_rejected(lan_app, peer):
    with TestClient(lan_app, base_url=LAN_URL, client=(peer, 49152)) as client:
        assert client.get("/healthz").status_code == 403
        assert client.get("/api/v1/ota/check").status_code == 403


@pytest.mark.parametrize("host", [
    "localhost:8000", "127.0.0.1:8000", "ota.example.com:8000", "8.8.8.8:8000",
    "[::1]:8000", "192.168.10.187", "192.168.10.187:8001", "192.168.10.188:8000",
    "192.168.10.187:08000", "user@192.168.10.187:8000",
])
def test_lan_host_header_must_match_actual_private_listener(lan_app, host):
    with TestClient(lan_app, base_url=LAN_URL, client=DEVICE_PEER) as client:
        assert client.get("/healthz", headers={"Host": host}).status_code == 403
        assert client.get("/login", headers={"Host": host}).status_code == 403


@pytest.mark.parametrize("listener", [
    "http://0.0.0.0:8000", "http://192.168.10.188:8000", "http://192.168.10.187:8001",
    "http://ota.example.com:8000", "http://8.8.8.8:8000", "http://[::1]:8000",
])
def test_forged_host_cannot_fix_wrong_actual_listener_address_or_port(lan_app, listener):
    with TestClient(lan_app, base_url=listener, client=DEVICE_PEER) as client:
        assert client.get("/healthz", headers={"Host": f"{LAN_IP}:8000"}).status_code == 403


@pytest.mark.parametrize("fake_headers", [
    {"Host": "127.0.0.1:8000"},
    {"Host": "localhost:8000", "X-Forwarded-For": "127.0.0.1", "X-Forwarded-Host": "localhost:8000"},
    {"Host": "127.0.0.1:8000", "Forwarded": 'for=127.0.0.1;host="127.0.0.1:8000";proto=https'},
    {"X-Forwarded-For": "127.0.0.1", "X-Forwarded-Host": "127.0.0.1:8000", "X-Forwarded-Proto": "https"},
])
def test_host_and_proxy_headers_never_elevate_lan_client_to_admin(lan_app, fake_headers):
    with TestClient(lan_app, base_url=LAN_URL, client=DEVICE_PEER) as client:
        assert client.get("/login", headers=fake_headers).status_code == 403
        assert client.get("/api/admin/catalog", headers=fake_headers).status_code == 403
    # Nor does talking to the loopback listener help when the transport peer
    # itself is not loopback (e.g. a misconfigured forwarder or test transport).
    with TestClient(lan_app, base_url=LOCAL_URL, client=DEVICE_PEER) as client:
        assert client.get("/login", headers=fake_headers).status_code == 403


def test_proxy_headers_cannot_make_public_peer_private(lan_app):
    with TestClient(lan_app, base_url=LAN_URL, client=("8.8.8.8", 49152)) as client:
        assert client.get("/healthz", headers={
            "X-Forwarded-For": DEVICE_PEER[0], "X-Real-IP": DEVICE_PEER[0],
            "Forwarded": f"for={DEVICE_PEER[0]}",
        }).status_code == 403


def test_missing_or_duplicate_host_is_rejected(lan_app):
    async def without_host(scope, receive, send):
        # TestClient synthesizes Host from the URL. Strip it at the actual ASGI
        # boundary to model a malformed transport request, not a normal client.
        if scope["type"] == "http":
            scope = dict(scope, headers=[(key, value) for key, value in scope["headers"] if key.lower() != b"host"])
        return await lan_app(scope, receive, send)

    with TestClient(without_host, base_url=LAN_URL, client=DEVICE_PEER) as client:
        assert client.get("/healthz").status_code == 403
    with TestClient(lan_app, base_url=LAN_URL, client=DEVICE_PEER) as client:
        assert client.get("/healthz", headers=[("Host", f"{LAN_IP}:8000"),
                                               ("Host", "127.0.0.1:8000")]).status_code == 403


@pytest.mark.parametrize("origin", [
    "https://evil.example", "null", "http://localhost:8000", "http://127.0.0.1:8000",
    f"https://{LAN_IP}:8000", f"http://{LAN_IP}:8001",
])
def test_lan_rejects_cross_origin_requests_even_with_valid_bearer(lan_app, h, origin):
    device = h.make_device()
    with TestClient(lan_app, base_url=LAN_URL, client=DEVICE_PEER) as client:
        response = client.post("/api/v1/devices/heartbeat", headers={**h.auth(device), "Origin": origin}, json={
            "device_id": device["id"], "version": "1.0.0", "sha256": "0" * 64,
        })
        assert response.status_code == 403
        assert h.db.one("SELECT last_seen FROM devices WHERE id=?", (device["id"],))["last_seen"] is None


def test_lan_accepts_own_origin_but_not_duplicate_origins(lan_app):
    with TestClient(lan_app, base_url=LAN_URL, client=DEVICE_PEER) as client:
        assert client.get("/healthz", headers={"Origin": LAN_URL}).status_code == 200
        assert client.get("/healthz", headers=[("Origin", LAN_URL), ("Origin", LAN_URL)]).status_code == 403


def test_lan_websockets_are_not_an_alternate_route_to_admin(lan_app):
    with TestClient(lan_app, base_url=LAN_URL, client=DEVICE_PEER) as client:
        with pytest.raises(WebSocketDisconnect) as error:
            with client.websocket_connect(f"ws://{LAN_IP}:8000/login"):
                pytest.fail("LAN websocket unexpectedly accepted")
        assert error.value.code == 1008


def test_actual_loopback_admin_still_logs_in_and_loads_signing_ui(lan_app):
    with TestClient(lan_app, base_url=LOCAL_URL, client=("127.0.0.1", 49152)) as client:
        login_page = client.get("/login")
        assert login_page.status_code == 200
        nonce = re.search(r'name="csrf" value="([^"]+)"', login_page.text)[1]
        logged_in = client.post("/login", data={
            "username": "admin", "password": "Test-password-2026", "csrf": nonce,
        })
        assert logged_in.status_code == 200
        assert 'name="csrf-token"' in logged_in.text
        assert client.get("/api/admin/catalog").status_code == 200
        # Browser WebCrypto signing is supported on localhost/127.0.0.1; the
        # signing scripts must remain accessible there, not on the LAN socket.
        for path in ("/static/app.js", "/static/pack-ui.mjs", "/static/pack-core.mjs"):
            script = client.get(path)
            assert script.status_code == 200, path
            assert script.headers["content-type"].split(";")[0] == "text/javascript"
        assert client.get("/healthz", headers={"Host": "localhost:8000"}).status_code == 200
        assert client.get("/healthz", headers={"Host": "localhost:8001"}).status_code == 403
        assert client.get("/healthz", headers={"Host": f"{LAN_IP}:8000"}).status_code == 403


def test_lan_logs_report_reachability_without_query_token_or_body(lan_app, h, caplog):
    device = h.make_device()
    with caplog.at_level(logging.INFO, logger="uvicorn.error"):
        with TestClient(lan_app, base_url=LAN_URL, client=DEVICE_PEER) as client:
            response = client.post("/api/v1/devices/heartbeat?secret=test-query-secret", headers=h.auth(device), json={
                "device_id": device["id"], "version": "private-body-marker", "sha256": "0" * 64,
            })
            assert response.status_code == 200
    logged = "\n".join(record.getMessage() for record in caplog.records if record.name == "uvicorn.error")
    assert "LAN OTA" in logged and DEVICE_PEER[0] in logged
    assert "/api/v1/devices/heartbeat" in logged and "status=200" in logged
    assert device["token"] not in logged
    assert "test-query-secret" not in logged and "private-body-marker" not in logged


def test_dual_listener_launcher_disables_forwarded_trust_and_closes_sockets(tmp_path, monkeypatch):
    import ota_server.lan as lan
    import uvicorn

    sockets, configurations = [], []

    class FakeSocket:
        def __init__(self, *_):
            self.closed = False
            sockets.append(self)

        def setsockopt(self, *_):
            pass

        def bind(self, address):
            self.address = address

        def setblocking(self, value):
            assert value is False

        def close(self):
            self.closed = True

    class FakeServer:
        def __init__(self, config):
            configurations.append(config)

        def run(self, *, sockets):
            assert [item.address for item in sockets] == [("127.0.0.1", 8000), (LAN_IP, 8000)]

    monkeypatch.setattr(lan.socket, "socket", FakeSocket)
    monkeypatch.setattr(uvicorn, "Server", FakeServer)
    serve_lan(object(), Settings(tmp_path, LOCAL_URL, lan_http_host=LAN_IP), 8000)
    assert len(sockets) == 2 and all(item.closed for item in sockets)
    assert len(configurations) == 1
    assert configurations[0].proxy_headers is False
    assert configurations[0].access_log is False  # Custom log omits secret query strings.
    with pytest.raises(ValueError):
        serve_lan(object(), Settings(tmp_path, LOCAL_URL, lan_http_host=LAN_IP), 8001)
    assert len(sockets) == 2  # Wrong port is rejected before opening any socket.
