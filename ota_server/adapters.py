"""Pure, bounded image validators. Uploaded bytes are never executed or imported."""
import hashlib
import struct

ADAPTERS = {
    "esp-idf-app": "ESP-IDF 应用镜像",
    "mcuboot-image": "MCUboot 镜像（未加密、单应用）",
    "raw-cortexm": "Cortex-M 原始 bin（向量表检查）",
}


def _need(condition, message):
    if not condition:
        raise ValueError(message)


def _text(data):
    return data.split(b"\0", 1)[0].decode("utf-8", errors="strict")


def esp_image(data, config):
    _need(len(data) >= 288 and data[0] == 0xE9, "不是 ESP-IDF 应用镜像")
    count, chip = data[1], struct.unpack_from("<H", data, 12)[0]
    _need(1 <= count <= 16 and chip == config["chip_id"], "ESP 芯片型号或段数不匹配")
    _need(struct.unpack_from("<I", data, 28)[0] >= 256, "ESP 首段缺少完整应用描述符")
    _need(struct.unpack_from("<I", data, 32)[0] == 0xABCD5432, "不是应用 bin：请勿上传 bootloader 或合并烧录包")
    version, project = _text(data[48:80]), _text(data[80:112])
    _need(project == config["project_name"], "ESP 应用项目名称不匹配")
    pos, checksum = 24, 0xEF
    for _ in range(count):
        _need(pos + 8 <= len(data), "ESP 段头被截断")
        _address, size = struct.unpack_from("<II", data, pos)
        pos += 8
        _need(size % 4 == 0 and pos + size <= len(data), "ESP 段长度错误或文件被截断")
        for byte in data[pos:pos + size]:
            checksum ^= byte
        pos += size
    checksum_pos = pos + 15 - pos % 16
    _need(checksum_pos < len(data) and data[checksum_pos] == checksum, "ESP 镜像校验和不正确")
    _need(all(byte == 0 for byte in data[pos:checksum_pos]), "ESP 校验前填充不正确")
    end = checksum_pos + 1
    _need(data[23] == 1, "ESP 镜像必须包含追加的 SHA-256")
    _need(end + 32 == len(data), "ESP 镜像被截断或有不支持的尾部；首版使用外置签名清单")
    _need(hashlib.sha256(data[:end]).digest() == data[end:end + 32], "ESP 内置 SHA-256 不正确")
    return {"chip_id": chip, "native_version": version, "project": project,
            "app_elf_sha256": data[176:208].hex(), "segments": count}


def mcuboot_image(data, config):
    _need(len(data) >= 40, "MCUboot 镜像过短")
    magic, load, header, protected, size, flags = struct.unpack_from("<IIHHII", data)
    _need(magic == 0x96F3B83D and header >= 32, "MCUboot 头部错误")
    _need(flags == 0, "首版不支持加密、压缩、RAM-load 或多镜像 MCUboot 标志")
    _need(header == config["header_size"] and load == config.get("load_address", 0), "MCUboot 布局不匹配")
    body_end = header + size
    _need(body_end <= len(data), "MCUboot 应用被截断")
    digest_end = body_end + protected
    if protected:
        _need(body_end + 4 <= len(data), "MCUboot 受保护 TLV 缺失")
        marker, length = struct.unpack_from("<HH", data, body_end)
        _need(marker == 0x6908 and length == protected and digest_end <= len(data), "MCUboot 受保护 TLV 不正确")
        _parse_tlvs(data, body_end + 4, digest_end)
    _need(digest_end + 4 <= len(data), "MCUboot 哈希 TLV 缺失")
    marker, length = struct.unpack_from("<HH", data, digest_end)
    tlv_end = digest_end + length
    _need(marker == 0x6907 and length >= 4 and tlv_end <= len(data), "MCUboot TLV 被截断")
    tlvs = _parse_tlvs(data, digest_end + 4, tlv_end)
    digests = [value for kind, value in tlvs if kind == 0x10]
    _need(len(digests) == 1 and digests[0] == hashlib.sha256(data[:digest_end]).digest(), "MCUboot SHA-256 不正确")
    _need(all(byte == 0xFF for byte in data[tlv_end:]), "MCUboot 存在不支持的尾部")
    major, minor, revision, build = struct.unpack_from("<BBHI", data, 20)
    return {"native_version": f"{major}.{minor}.{revision}+{build}", "image_size": size,
            "header_size": header, "native_signature_checked": False}


def _parse_tlvs(data, pos, end):
    values = []
    while pos < end:
        _need(pos + 4 <= end, "MCUboot TLV 头不完整")
        kind, length = struct.unpack_from("<HH", data, pos)
        pos += 4
        _need(pos + length <= end, "MCUboot TLV 越界")
        values.append((kind, data[pos:pos + length]))
        pos += length
    return values


def raw_cortexm(data, config):
    _need(len(data) >= 8 and len(data) % 4 == 0, "Cortex-M bin 长度错误")
    stack, reset = struct.unpack_from("<II", data)
    base = config["app_address"]
    _need(config["ram_start"] < stack <= config["ram_start"] + config["ram_size"] and stack % 8 == 0,
          "Cortex-M 初始栈指针不在目标 RAM 范围内")
    _need(reset & 1 and base <= (reset & ~1) < base + len(data), "Cortex-M 复位向量不在目标应用区域")
    return {"app_address": base, "initial_stack": stack, "reset_handler": reset}


def validate_image(data, adapter, config):
    validators = {"esp-idf-app": esp_image, "mcuboot-image": mcuboot_image, "raw-cortexm": raw_cortexm}
    if adapter not in validators:
        raise ValueError("镜像适配器尚未支持")
    try:
        return validators[adapter](data, config)
    except (KeyError, struct.error, UnicodeError) as exc:
        raise ValueError("镜像格式或适配器配置错误") from exc
