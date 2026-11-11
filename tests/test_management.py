"""CRUD display metadata without mutating signed hardware identities/history."""
import pytest

from ota_server.models import ProductInput
from ota_server.service import fingerprint, profile


def patch(h, collection, identity, data, **kwargs):
    return h.client.patch(f"/api/admin/{collection}/{identity}", json=data, headers=h.headers, **kwargs)


def delete(h, collection, identity, **body):
    return h.admin_post(f"{collection}/{identity}/delete", body)


def identities(h):
    gateway = h.admin_post("gateways", {"name": "Gateway"}).json()
    device = h.make_device()
    return {"products": h.target["product_id"], "targets": h.target["id"],
            "keys": h.target["key_id"], "devices": device["id"], "gateways": gateway["id"]}


def test_product_name_and_description_edit_keep_identity_and_hardware_profile(h):
    original = profile(h.target)
    result = patch(h, "products", h.target["product_id"], {"name": "新名称", "description": "新说明"})
    assert result.status_code == 200
    row = h.db.one("SELECT * FROM products WHERE id=?", (h.target["product_id"],))
    assert row["name"] == "新名称" and row["description"] == "新说明"
    assert profile(h.svc.target(h.target["id"])) == original


def test_target_rename_preserves_signature_fingerprint_and_existing_firmware(h):
    artifact = h.upload().json()
    original = fingerprint(h.target)
    result = patch(h, "targets", h.target["id"], {"name": "改名后的型号"})
    assert result.status_code == 200
    target = h.svc.target(h.target["id"])
    assert target["name"] == "改名后的型号" and fingerprint(target) == original
    assert h.client.get(f"/api/admin/targets/{target['id']}/profile").json()["target_fingerprint"] == original
    assert h.admin_post("releases", {"artifact_id": artifact["id"], "channel": "stable"}).status_code == 200
    assert h.upload(version="V1.0.1").status_code == 200


@pytest.mark.parametrize("field,value", [("mcu", "ESP32"), ("product_id", "other-product"),
    ("layout_id", "new-layout"), ("key_id", "0" * 64), ("max_size", 999999),
    ("config", {}), ("adapter", "esp-idf-app"), ("id", "renamed-id"),
    ("capabilities", []), ("hw_revision", "2.0"), ("min_bootloader", "2.0.0")])
def test_target_compatibility_fields_cannot_be_overwritten(h, field, value):
    assert patch(h, "targets", h.target["id"], {"name": "new", field: value}).status_code == 422
    assert fingerprint(h.svc.target(h.target["id"])) == fingerprint(h.target)


def test_product_referenced_by_hardware_or_keys_cannot_delete(h):
    result = delete(h, "products", h.target["product_id"])
    assert result.status_code == 409 and "硬件型号" in result.json()["error"] and "签名公钥" in result.json()["error"]
    assert h.db.one("SELECT id FROM products WHERE id=?", (h.target["product_id"],))


def test_unused_target_then_key_then_product_can_be_explicitly_deleted(h):
    for collection, identity in [("targets", h.target["id"]), ("keys", h.target["key_id"]), ("products", h.target["product_id"])]:
        assert delete(h, collection, identity).status_code == 200
        assert delete(h, collection, identity).status_code == 404
    catalog = h.client.get("/api/admin/catalog").json()
    assert not catalog["products"] and not catalog["targets"] and not catalog["keys"]
    assert len(h.db.rows("SELECT * FROM audit WHERE action LIKE '%.deleted'")) == 3


@pytest.mark.parametrize("dependency", ["device", "artifact", "deleted-artifact"])
def test_target_references_block_deletion_including_preserved_history(h, dependency):
    if dependency == "device":
        h.make_device()
    else:
        item = h.upload().json()
        if dependency == "deleted-artifact":
            plan = h.svc.artifact_delete_preview(item["id"])
            h.svc.delete_artifact(item["id"], plan["preview_token"])
    assert delete(h, "targets", h.target["id"]).status_code == 409
    assert delete(h, "keys", h.target["key_id"]).status_code == 409


def test_delete_empty_product_only_does_not_affect_other_products(h):
    h.svc.add_product(ProductInput(id="empty-product", name="Empty"))
    assert delete(h, "products", "empty-product").status_code == 200
    assert h.db.one("SELECT * FROM products WHERE id=?", (h.target["product_id"],))


def test_device_rename_syncs_direct_agent_but_not_shared_gateway(h):
    device = h.make_device()
    assert patch(h, "devices", device["id"], {"name": "直连设备新名"}).status_code == 200
    assert h.db.one("SELECT name FROM agents WHERE id=?", (device["agent_id"],))["name"] == "直连设备新名"
    gateway = h.admin_post("gateways", {"name": "Gateway"}).json()
    child = h.make_device(gateway)
    assert patch(h, "devices", child["id"], {"name": "子设备新名"}).status_code == 200
    assert h.db.one("SELECT name FROM agents WHERE id=?", (gateway["id"],))["name"] == "Gateway"
    assert patch(h, "gateways", gateway["id"], {"name": "新网关"}).status_code == 200


def test_delete_direct_device_removes_only_its_credential(h):
    device, other = h.make_device(), h.make_device()
    assert delete(h, "devices", device["id"]).status_code == 200
    assert not h.db.one("SELECT id FROM agents WHERE id=?", (device["agent_id"],))
    assert h.check(device).status_code == 401
    assert h.check(other).status_code == 200


def test_device_with_attempt_history_cannot_delete(h):
    release, device = h.publish(), h.make_device()
    h.attempt(device, release)
    response = delete(h, "devices", device["id"])
    assert response.status_code == 409 and "升级记录" in response.json()["error"]
    assert h.check(device).status_code == 200


def test_delete_gateway_requires_children_removed_and_never_deletes_shared_agent(h):
    gateway = h.admin_post("gateways", {"name": "Gateway"}).json()
    child = h.make_device(gateway)
    assert delete(h, "gateways", gateway["id"]).status_code == 409
    assert delete(h, "devices", child["id"]).status_code == 200
    assert h.db.one("SELECT id FROM agents WHERE id=?", (gateway["id"],))
    assert delete(h, "gateways", gateway["id"]).status_code == 200
    assert not h.db.one("SELECT id FROM agents WHERE id=?", (gateway["id"],))


def test_gateway_routes_never_modify_or_delete_direct_device_agent(h):
    device = h.make_device()
    assert patch(h, "gateways", device["agent_id"], {"name": "wrong"}).status_code == 404
    assert delete(h, "gateways", device["agent_id"]).status_code == 404
    assert h.check(device).status_code == 200


@pytest.mark.parametrize("collection", ["products", "targets", "keys", "devices", "gateways"])
def test_management_mutations_require_auth_csrf_origin_and_strict_schema(h, collection):
    identity = identities(h)[collection]
    url = f"/api/admin/{collection}/{identity}"
    assert h.client.patch(url, json={"name": "new"}).status_code == 403
    assert h.client.post(url + "/delete", json={}).status_code == 403
    assert h.client.patch(url, headers=dict(h.headers, Origin="https://evil.example"), json={"name": "new"}).status_code == 403
    assert patch(h, collection, identity, {"name": "new", "id": "cannot-change"}).status_code == 422
    assert delete(h, collection, identity, cascade=True).status_code == 422
    h.client.cookies.clear()
    assert h.client.patch(url, json={"name": "new"}).status_code == 401
    assert h.client.post(url + "/delete", json={}).status_code == 401


@pytest.mark.parametrize("collection", ["products", "targets", "keys", "devices", "gateways"])
def test_unknown_records_and_empty_or_long_names_rejected(h, collection):
    identity = identities(h)[collection]
    assert patch(h, collection, "missing", {"name": "new"}).status_code == 404
    assert delete(h, collection, "missing").status_code == 404
    assert patch(h, collection, identity, {"name": ""}).status_code == 422
    assert patch(h, collection, identity, {"name": "x" * 101}).status_code == 422
