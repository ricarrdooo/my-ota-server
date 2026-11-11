import base64
import hashlib
import re
import struct

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa
from fastapi.testclient import TestClient

from ota_server.app import create_app
from ota_server.config import Settings
from ota_server.models import KeyInput, ProductInput, TargetInput
from ota_server.security import PASSWORDS, canonical
from ota_server.__main__ import pack
from ota_server.service import fingerprint, profile


def esp_fixture(version="1.2.3", chip=9):
    header = bytearray(24)
    header[0], header[1], header[23] = 0xE9, 1, 1
    struct.pack_into("<H", header, 12, chip)
    payload = bytearray(256)
    struct.pack_into("<I", payload, 0, 0xABCD5432)
    payload[16:16 + len(version)] = version.encode()
    payload[48:56] = b"00_BASIC"
    result = header + struct.pack("<II", 0x3C000020, len(payload)) + payload
    checksum = 0xEF
    for value in payload:
        checksum ^= value
    result += bytes(15 - len(result) % 16) + bytes([checksum])
    result += hashlib.sha256(result).digest()
    return bytes(result)


def raw_fixture(size=256):
    return struct.pack("<II", 0x20010000, 0x08008009) + bytes(size - 8)


def mcuboot_fixture():
    header = struct.pack("<IIHHIIBBHII", 0x96F3B83D, 0, 32, 0, 256, 0, 1, 2, 3, 4, 0)
    body = header + bytes(256)
    return body + struct.pack("<HHHH", 0x6907, 40, 0x10, 32) + hashlib.sha256(body).digest()


@pytest.fixture(scope="session")
def signing_key():
    return rsa.generate_private_key(public_exponent=65537, key_size=3072)


class Harness:
    def __init__(self, tmp_path, key):
        self.settings = Settings(tmp_path / "data", "http://testserver")
        self.app = create_app(self.settings)
        self.db, self.svc, self.key = self.app.state.db, self.app.state.service, key
        with self.db.transaction() as conn:
            conn.execute("INSERT INTO admins VALUES(1,?,?)", ("admin", PASSWORDS.hash("Test-password-2026")))
        self.client = TestClient(self.app)
        html = self.client.get("/login").text
        nonce = re.search(r'name="csrf" value="([^"]+)"', html)[1]
        response = self.client.post("/login", data={"username": "admin", "password": "Test-password-2026", "csrf": nonce})
        assert response.status_code == 200
        self.csrf = re.search(r'name="csrf-token" content="([^"]+)"', response.text)[1]
        self.headers = {"X-CSRF-Token": self.csrf}
        self.svc.add_product(ProductInput(id="test-product", name="测试产品"))
        pem = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
        key_id = self.svc.add_key(KeyInput(product_id="test-product", name="测试公钥", pem=pem))["id"]
        self.target = self.svc.add_target(TargetInput(id="test-target", product_id="test-product", name="测试 STM32",
            adapter="raw-cortexm", mcu="STM32F407VG", hw_revision="1.0", layout_id="app-layout-v1",
            max_size=262144, key_id=key_id, config={"app_address": 0x08008000, "ram_start": 0x20000000, "ram_size": 65536}))

    def admin_post(self, path, body=None, **kwargs):
        return self.client.post("/api/admin/" + path, headers=self.headers, json=body, **kwargs)

    def make_device(self, gateway=None):
        body = {"name": "测试设备", "target_id": self.target["id"]}
        if gateway:
            body["gateway_id"] = gateway["id"]
        result = self.admin_post("devices", body)
        assert result.status_code == 200, result.text
        return result.json()

    def upload(self, data=None, version="1.0.0", manifest_changes=None, signature=None):
        data = data if data is not None else raw_fixture()
        value, sig = pack({"schema_version": 1, "target": profile(self.target), "target_fingerprint": fingerprint(self.target)}, data, self.key, version)
        if manifest_changes:
            value.update(manifest_changes)
        return self.client.post("/api/admin/artifacts", headers=self.headers, files={
            "firmware": ("firmware.bin", data, "application/octet-stream"),
            "manifest": ("manifest.json", canonical(value), "application/json"),
            "signature": ("signature.txt", signature or sig, "text/plain")}, data={"notes": "测试说明"})

    def publish(self, **kwargs):
        result = self.upload(**kwargs)
        assert result.status_code == 200, result.text
        artifact = result.json()["id"]
        response = self.admin_post("releases", {"artifact_id": artifact, "channel": "stable"})
        assert response.status_code == 200, response.text
        return response.json()

    def compat(self, device):
        return {"device_id": device["id"], "protocol_version": 1, "target_id": self.target["id"],
                "layout_id": self.target["layout_id"], "bootloader_version": "0.1.0", "capabilities": ["staging", "app_confirm"]}

    def auth(self, device):
        return {"Authorization": "Bearer " + device["token"]}

    def check(self, device, **changes):
        info = self.compat(device)
        info["capabilities"] = ",".join(info["capabilities"])
        info.update(changes)
        return self.client.get("/api/v1/ota/check", params=info, headers=self.auth(device))

    def attempt(self, device, release, request_id="request-0001"):
        return self.client.post("/api/v1/ota/attempts", headers=self.auth(device),
                                json=dict(self.compat(device), release_id=release["id"], request_id=request_id))


@pytest.fixture
def h(tmp_path, signing_key):
    harness = Harness(tmp_path, signing_key)
    yield harness
    harness.client.close()
