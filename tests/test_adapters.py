from pathlib import Path
import hashlib
import struct
import pytest

from ota_server.adapters import validate_image
from ota_server.config import Settings
from ota_server.models import TargetInput
from conftest import esp_fixture, raw_fixture, mcuboot_fixture


def test_esp_valid_and_wrong_chip():
    config = {"chip_id": 9, "project_name": "00_BASIC"}
    assert validate_image(esp_fixture(), "esp-idf-app", config)["native_version"] == "1.2.3"
    with pytest.raises(ValueError):
        validate_image(esp_fixture(chip=5), "esp-idf-app", config)


@pytest.mark.parametrize("offset", [0, 1, 12, 32, 60, 200, 290, -1])
def test_esp_corruption(offset):
    data = bytearray(esp_fixture())
    data[offset] ^= 0xFF
    with pytest.raises(ValueError):
        validate_image(data, "esp-idf-app", {"chip_id": 9, "project_name": "00_BASIC"})


def test_existing_esp32_firmware_readonly():
    path = Path(__file__).resolve().parents[2] / "00_BASIC" / "build" / "00_BASIC.bin"
    if not path.exists():
        pytest.skip("当前环境没有既有 ESP32 构建产物")
    result = validate_image(path.read_bytes(), "esp-idf-app", {"chip_id": 9, "project_name": "00_BASIC"})
    assert result["project"] == "00_BASIC" and len(result["app_elf_sha256"]) == 64


def test_raw_cortexm_vectors_and_bounds():
    config = {"app_address": 0x08008000, "ram_start": 0x20000000, "ram_size": 65536}
    assert validate_image(raw_fixture(), "raw-cortexm", config)["app_address"] == 0x08008000
    for stack, reset in ((0, 0x08008009), (0x20010001, 0x08008009), (0x20010000, 0x08000001), (0x20010000, 0x08008008)):
        with pytest.raises(ValueError):
            validate_image(struct.pack("<II", stack, reset) + bytes(248), "raw-cortexm", config)


def test_mcuboot_native_hash_and_unsupported_flags():
    data = mcuboot_fixture()
    assert validate_image(data, "mcuboot-image", {"header_size": 32})["native_version"] == "1.2.3+4"
    corrupted = bytearray(data)
    corrupted[40] = 1
    with pytest.raises(ValueError):
        validate_image(corrupted, "mcuboot-image", {"header_size": 32})
    corrupted = bytearray(data)
    corrupted[16] = 4
    with pytest.raises(ValueError):
        validate_image(corrupted, "mcuboot-image", {"header_size": 32})


def test_no_unsupported_adapter_fallback():
    with pytest.raises(ValueError):
        validate_image(raw_fixture(), "any-bin", {})


def test_http_public_configuration_is_rejected(tmp_path):
    with pytest.raises(ValueError):
        Settings(tmp_path, "http://ota.example.com")
    assert Settings(tmp_path, "https://ota.example.com").secure_cookie
