"""Isolated localhost-only browser fixture. NEVER runs against real server data."""
import json
import hashlib
from pathlib import Path
import socket
import struct
import sys
import re

import uvicorn
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from ota_server.__main__ import pack
from ota_server.app import create_app
from ota_server.config import Settings
from ota_server.models import TargetInput
from ota_server.security import PASSWORDS, key_fingerprint
from ota_server.service import fingerprint, profile
from conftest import esp_fixture


directory = Path(sys.argv[1]).resolve()
directory.mkdir(parents=True, exist_ok=True)
sock = socket.socket()
sock.bind(("127.0.0.1", 0))
base = f"http://127.0.0.1:{sock.getsockname()[1]}"
app = create_app(Settings(directory / "data", base))
with app.state.db.transaction() as conn:
    conn.execute("INSERT INTO admins VALUES(1,?,?)", ("admin", PASSWORDS.hash("Test-password-2026")))
key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
private_pem = key.private_bytes(serialization.Encoding.PEM,serialization.PrivateFormat.PKCS8,
    serialization.BestAvailableEncryption('Browser-local-test-口令-2026'.encode()))
(directory / "private.pem").write_bytes(private_pem)
plain_pem = key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption())
(directory / "plain-private.pem").write_bytes(plain_pem)
other_key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
other_private_pem = other_key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
    serialization.NoEncryption())
(directory / "other-private.pem").write_bytes(other_private_pem)
other_public_pem = other_key.public_key().public_bytes(serialization.Encoding.PEM,
    serialization.PublicFormat.SubjectPublicKeyInfo).decode()
audits = []


@app.middleware("http")
async def audit_test_upload(request, call_next):
    if request.url.path == "/api/admin/artifacts" and request.method == "POST":
        body = await request.body()
        audits.append({"fields":sorted(x.decode() for x in re.findall(br'Content-Disposition: form-data; name="([^"]+)"',body)),
                       "private_seen":any(pem.strip() in body or pem.splitlines()[1] in body
                           for pem in (private_pem, plain_pem, other_private_pem)),
                       "password_seen":'Browser-local-test-口令-2026'.encode() in body})
    return await call_next(request)


@app.get("/qa/security-audit")
def security_audit():
    return {"uploads":audits}


public_pem = key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo).decode()
target = TargetInput(id="qa-stm32-v1", name="STM32 浏览器测试板", product_id="qa-product",
    adapter="raw-cortexm", mcu="STM32F407VG", hw_revision="1.0", layout_id="app-layout-v1",
    max_size=262144, key_id=key_fingerprint(key.public_key()),
    config={"app_address": 0x08008000, "ram_start": 0x20000000, "ram_size": 65536}).model_dump()
target["capabilities"] = sorted(target["capabilities"])
export = {"schema_version": 1, "target": profile(target), "target_fingerprint": fingerprint(target)}
data = struct.pack("<II", 0x20010000, 0x08008009) + bytes(248)
manifest, signature = pack(export, data, key, "1.0.0")
(directory / "firmware.bin").write_bytes(data)
(directory / "manifest.json").write_text(json.dumps(manifest), encoding="utf-8")
(directory / "signature.txt").write_text(signature, encoding="ascii")
changed = data[:-1] + b"\x01"
(directory / "changed.bin").write_bytes(changed)
for index in range(7):
    (directory / f"retention-{index}.bin").write_bytes(data[:-1] + bytes([index + 10]))
esp_target = TargetInput(id="qa-esp32-v1", name="ESP32-S3 桌面伴侣", product_id="qa-product",
    adapter="esp-idf-app", mcu="ESP32-S3", hw_revision="1.0", layout_id="ota-3m-v1",max_size=3145728,
    key_id=target["key_id"],config={"chip_id":9,"project_name":"00_BASIC"}).model_dump()
esp_data = esp_fixture(version="V1.0.0")
(directory / "esp-app.bin").write_bytes(esp_data)
print("QA_READY " + json.dumps({"base": base, "directory": str(directory), "pem": public_pem, "target": target,
    "other_pem":other_public_pem,"other_key_id":key_fingerprint(other_key.public_key()),
    "esp_target":esp_target,"esp_version":"V1.0.0","esp_sha256":hashlib.sha256(esp_data).hexdigest()}), flush=True)
uvicorn.Server(uvicorn.Config(app, host="127.0.0.1", port=sock.getsockname()[1], access_log=False, log_level="warning")).run(sockets=[sock])
