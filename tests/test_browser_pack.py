import base64
import hashlib
import json
from pathlib import Path
import shutil
import subprocess

import pytest
from cryptography.hazmat.primitives import serialization
from cryptography.hazmat.primitives.asymmetric import rsa

from ota_server.__main__ import pack
from ota_server.models import TargetInput
from ota_server.security import canonical, key_fingerprint, verify_manifest
from ota_server.service import fingerprint, profile
from conftest import raw_fixture, esp_fixture, mcuboot_fixture

NODE = shutil.which("node")
ROOT = Path(__file__).resolve().parents[1]
pytestmark = pytest.mark.skipif(NODE is None, reason="Node required for independent Web Crypto cross-check")


def bridge(value):
    result = subprocess.run([NODE, str(ROOT / "tests" / "pack_bridge.mjs")], input=json.dumps(value),
                            encoding="utf-8", capture_output=True, timeout=30, cwd=ROOT)
    assert result.returncode == 0, result.stderr
    assert "PRIVATE KEY" not in result.stdout and "Test-local-password" not in result.stdout
    return json.loads(result.stdout)


def exported(key, adapter="raw-cortexm", **changes):
    configs={"raw-cortexm":{"app_address":0x08008000,"ram_start":0x20000000,"ram_size":65536},
             "esp-idf-app":{"chip_id":9,"project_name":"00_BASIC"},
             "mcuboot-image":{"header_size":32}}
    target=TargetInput(id="browser-test-v1",product_id="test-product",name="Test",adapter=adapter,
        mcu="测试主控😀",hw_revision="1.0",layout_id="test-layout",max_size=262144,
        key_id=key_fingerprint(key.public_key()),config=configs[adapter]).model_dump()
    target.update(changes)
    target["capabilities"]=sorted(target["capabilities"])
    return {"schema_version":1,"target":profile(target),"target_fingerprint":fingerprint(target)}


def request(key, adapter="raw-cortexm", encrypted=True, pkcs1=False, data=None, **changes):
    value={"profile":exported(key,adapter),"firmware":base64.b64encode(data if data is not None else
        {"raw-cortexm":raw_fixture,"esp-idf-app":esp_fixture,"mcuboot-image":mcuboot_fixture}[adapter]()).decode(),
        "pem":key.private_bytes(serialization.Encoding.PEM,
            serialization.PrivateFormat.TraditionalOpenSSL if pkcs1 else serialization.PrivateFormat.PKCS8,
            serialization.BestAvailableEncryption(b"Test-local-password") if encrypted else serialization.NoEncryption()).decode(),
        "password":"Test-local-password","version":"1.0.0" if adapter=="raw-cortexm" else None}
    value.update(changes)
    return value


@pytest.mark.parametrize("adapter",["raw-cortexm","esp-idf-app","mcuboot-image"])
def test_browser_package_matches_python_and_signature_verifies(signing_key,adapter):
    value=request(signing_key,adapter)
    output=bridge(value)
    assert "error" not in output,output
    result=output["result"]
    data=base64.b64decode(value["firmware"])
    expected,_=pack(value["profile"],data,signing_key,value["version"])
    assert result["manifest"] == expected
    pem=signing_key.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    verify_manifest(result["manifest"],result["signature"],pem)
    assert result["manifest"]["sha256"] == hashlib.sha256(data).hexdigest()


@pytest.mark.parametrize("pkcs1",[False,True])
def test_unencrypted_rsa_keys_supported_without_password(signing_key,pkcs1):
    assert "result" in bridge(request(signing_key,encrypted=False,pkcs1=pkcs1,password=""))


def test_wrong_password_rejected_locally(signing_key):
    result=bridge(request(signing_key,password="incorrect"))
    assert "error" in result and "密码" in result["error"]


def test_rsa4096_browser_signature_verified_by_python():
    key=rsa.generate_private_key(public_exponent=65537,key_size=4096)
    result=bridge(request(key))["result"]
    public=key.public_key().public_bytes(serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    verify_manifest(result["manifest"],result["signature"],public)


def test_invalid_private_pem_fails_closed(signing_key):
    value=request(signing_key,pem="-----BEGIN PRIVATE KEY-----\nAQID\n-----END PRIVATE KEY-----")
    assert "error" in bridge(value)
    value=request(signing_key)
    value["pem"]=value["pem"].replace("ENCRYPTED PRIVATE KEY","PUBLIC KEY")
    assert "private.pem" in bridge(value)["error"]


def test_wrong_key_and_profile_fingerprint_rejected(signing_key):
    value=request(signing_key)
    value["profile"]=exported(signing_key,key_id="0"*64)
    assert "私钥不属于" in bridge(value)["error"]
    value=request(signing_key)
    value["profile"]["target"]["mcu"]="different"
    assert "指纹" in bridge(value)["error"]


def test_capacity_vectors_native_hash_and_version_rejected(signing_key):
    bad=raw_fixture()[:4]+bytes(4)+raw_fixture()[8:]
    assert "复位向量" in bridge(request(signing_key,data=bad))["error"]
    assert "容量" in bridge(request(signing_key,data=raw_fixture(262148)))["error"]
    bad=esp_fixture()[:-1]+b"\xff"
    assert "SHA-256" in bridge(request(signing_key,"esp-idf-app",data=bad))["error"]
    assert "版本" in bridge(request(signing_key,"esp-idf-app",version="2.0.0"))["error"]


def test_python_canonicalization_including_unicode_and_control_characters():
    value={"z":"温度😀\x7f\n\t\\\"","a":["蓝",1,True,None],"nested":{"mcu":"ESP32-S3","adapter":"esp-idf-app"}}
    assert bridge({"canonical":value})["canonical"].encode("ascii") == canonical(value)


def test_browser_package_accepted_by_real_upload_api(h):
    value=request(h.key)
    value["profile"]={"schema_version":1,"target":profile(h.target),"target_fingerprint":fingerprint(h.target)}
    result=bridge(value)["result"]
    response=h.client.post("/api/admin/artifacts",headers=h.headers,files={
        "firmware":("firmware.bin",base64.b64decode(value["firmware"])),
        "manifest":("manifest.json",json.dumps(result["manifest"])),
        "signature":("signature.txt",result["signature"])})
    assert response.status_code==200,response.text
    assert not h.db.rows("SELECT * FROM releases")  # Signing/upload never publishes implicitly.


def cached_request(key, adapter="raw-cortexm", **changes):
    value=request(key,adapter,**changes)
    value["profile"]["public_key_pem"]=key.public_key().public_bytes(
        serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    value["useCryptoKey"]=True
    return value


@pytest.mark.parametrize("adapter",["raw-cortexm","esp-idf-app","mcuboot-image"])
def test_saved_nonextractable_key_signs_and_verifies_after_structured_clone(signing_key,adapter):
    value=cached_request(signing_key,adapter,cloneKey=True)
    result=bridge(value)["result"]
    expected,_=pack(value["profile"],base64.b64decode(value["firmware"]),signing_key,value["version"])
    assert result["manifest"]==expected
    verify_manifest(result["manifest"],result["signature"],value["profile"]["public_key_pem"])


def test_saved_key_cannot_be_reused_under_wrong_hardware_key(signing_key):
    different=rsa.generate_private_key(public_exponent=65537,key_size=3072)
    value=cached_request(signing_key)
    # Import is valid for its original public key, but a stale UI/cache returns it
    # for another target. Final verification must prevent uploading that package.
    value["profile"]=cached_request(different)["profile"]
    value["importKeyId"]=key_fingerprint(signing_key.public_key())
    assert "不属于所选硬件型号" in bridge(value)["error"]


def test_saved_key_requires_matching_public_key_in_profile(signing_key):
    value=cached_request(signing_key)
    del value["profile"]["public_key_pem"]
    assert "缺少签名公钥" in bridge(value)["error"]
    different=rsa.generate_private_key(public_exponent=65537,key_size=3072)
    value=cached_request(signing_key)
    value["profile"]["public_key_pem"]=different.public_key().public_bytes(
        serialization.Encoding.PEM,serialization.PublicFormat.SubjectPublicKeyInfo).decode()
    assert "公钥指纹" in bridge(value)["error"]
    value["profile"]["public_key_pem"]="not a public key"
    assert "公钥格式" in bridge(value)["error"]


@pytest.mark.parametrize("variant",["null","plain","public","extractable","hash","algorithm","usages"])
def test_saved_key_rejects_unsafe_or_unexpected_crypto_key_shape(signing_key,variant):
    value=cached_request(signing_key,encrypted=False,keyVariant=variant)
    assert "本机签名密钥无效" in bridge(value)["error"]


def test_saved_key_rejects_small_rsa_modulus():
    key=rsa.generate_private_key(public_exponent=65537,key_size=2048)
    # This bypasses importSigningKey only to test createPackage's key guard.
    value=cached_request(key,encrypted=False,keyVariant="small")
    assert "本机签名密钥无效" in bridge(value)["error"]
