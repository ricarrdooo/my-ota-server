"""The dashboard must detect an old running backend before offering writes.

All sessions, databases and credentials here are disposable pytest fixtures.
LAN checks use ASGI transport addresses, not a real listener or user's server.
"""
import pytest
from fastapi.testclient import TestClient

from ota_server.app import create_app
from ota_server.config import Settings


CAPABILITIES = "/api/admin/capabilities"
FEATURES = {"release_management", "artifact_deletion", "metadata_management", "firmware_state", "remote_commands"}
LAN_IP = "192.168.10.187"
LOCAL_URL = "http://127.0.0.1:8000"


def assert_contract(response):
    assert response.status_code == 200, response.text
    value = response.json()
    assert type(value["contract"]) is int and value["contract"] == 2
    assert isinstance(value["features"], list)
    assert set(value["features"]) == FEATURES
    assert len(value["features"]) == len(FEATURES)
    assert response.headers["cache-control"] == "no-store"


def test_capabilities_requires_admin_session_not_device_bearer(h):
    device = h.make_device()
    with TestClient(h.app) as client:
        for headers in ({}, h.auth(device)):
            response = client.get(CAPABILITIES, headers=headers)
            assert response.status_code == 401
            assert "登录" in response.json()["error"]
            assert response.headers["cache-control"] == "no-store"


def test_authenticated_capabilities_get_needs_no_csrf_and_is_read_only(h):
    before_audit = h.db.rows("SELECT * FROM audit ORDER BY id")
    before_session = h.db.rows("SELECT * FROM sessions ORDER BY digest")
    # Deliberately do not send h.headers: a read-only handshake needs no CSRF.
    assert_contract(h.client.get(CAPABILITIES))
    assert_contract(h.client.get(CAPABILITIES, headers={"X-CSRF-Token": "irrelevant-for-get"}))
    assert h.db.rows("SELECT * FROM audit ORDER BY id") == before_audit
    assert h.db.rows("SELECT * FROM sessions ORDER BY digest") == before_session


def test_expired_admin_session_cannot_read_capabilities(h):
    with h.db.transaction() as conn:
        conn.execute("UPDATE sessions SET expires=0")
    response = h.client.get(CAPABILITIES)
    assert response.status_code == 401
    assert response.headers["cache-control"] == "no-store"


@pytest.mark.parametrize("peer", [("192.168.10.88", 49152), ("127.0.0.1", 49152)])
@pytest.mark.parametrize("method", ["GET", "POST", "HEAD", "OPTIONS"])
def test_lan_listener_cannot_expose_admin_capabilities_even_with_valid_cookie(h, peer, method):
    app = create_app(Settings(h.settings.data_dir, LOCAL_URL, lan_http_host=LAN_IP))
    session_cookie = h.client.cookies.get("ota_session")
    with TestClient(app, base_url=f"http://{LAN_IP}:8000", client=peer) as client:
        response = client.request(method, CAPABILITIES,
                                  headers={"Cookie": f"ota_session={session_cookie}", **h.headers})
        assert response.status_code == 403
        assert "set-cookie" not in response.headers


def test_actual_loopback_admin_can_read_capabilities_with_lan_mode_enabled(h):
    app = create_app(Settings(h.settings.data_dir, LOCAL_URL, lan_http_host=LAN_IP))
    with TestClient(app, base_url=LOCAL_URL, client=("127.0.0.1", 49152)) as client:
        assert client.get(CAPABILITIES).status_code == 401
        response = client.get(CAPABILITIES,
                              headers={"Cookie": f"ota_session={h.client.cookies.get('ota_session')}"})
        assert_contract(response)


def test_missing_management_record_404_is_distinguishable_from_missing_route(h):
    missing_record = h.admin_post("releases/missing-release-test/delete", {})
    assert missing_record.status_code == 404
    assert missing_record.json() == {"error": "发布不存在或已删除"}
    missing_route = h.client.get("/api/admin/nonexistent-capability-route-test")
    assert missing_route.status_code == 404
    assert missing_route.json() == {"detail": "Not Found"}
