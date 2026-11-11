"""Read-only device protocol example: verify the update manifest, never install.

Run from the project root: python -m examples.check_update --help
OTA_DEVICE_TOKEN must be provided in the environment, never as a command argument.
"""
import argparse
import os
from pathlib import Path
from urllib.error import HTTPError
from urllib.parse import urlencode, urlsplit
from urllib.request import HTTPRedirectHandler, Request, build_opener

from ota_server.config import Settings
from ota_server.models import Manifest, version_tuple
from ota_server.security import key_fingerprint, load_json, public_key, verify_manifest
from ota_server.service import fingerprint


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        # urllib forwards Authorization on redirects by default; refuse before sending.
        return None


def validate_offer(offer, exported, bootloader_version):
    if offer.get("schema_version") != 1:
        raise ValueError("不支持的服务端协议版本")
    if not offer.get("update_available"):
        return None
    manifest = Manifest.model_validate(offer["manifest"]).model_dump()
    target = exported["target"]
    if exported.get("schema_version") != 1 or exported["target_fingerprint"] != fingerprint(target):
        raise ValueError("本机可信配置指纹不匹配")
    if key_fingerprint(public_key(exported["public_key_pem"])) != target["key_id"]:
        raise ValueError("本机可信公钥与配置不匹配")
    verify_manifest(manifest, offer["signature"], exported["public_key_pem"])
    expected = {"product_id": target["product_id"], "target_id": target["id"],
                "target_fingerprint": fingerprint(target), "mcu": target["mcu"],
                "hw_revision": target["hw_revision"], "layout_id": target["layout_id"],
                "image_format": target["adapter"], "key_id": target["key_id"],
                "min_bootloader_version": target["min_bootloader"],
                "required_capabilities": sorted(target["capabilities"])}
    if any(manifest[name] != value for name, value in expected.items()):
        raise ValueError("已签名固件不属于此可信硬件配置")
    if manifest["size"] > target["max_size"] or version_tuple(bootloader_version) < version_tuple(manifest["min_bootloader_version"]):
        raise ValueError("镜像容量或 Bootloader 版本不兼容")
    return manifest


def main():
    parser = argparse.ArgumentParser(description="只检查并验签更新清单：不下载、不上报成功、不烧录")
    parser.add_argument("--server", required=True, help="HTTPS 源站；localhost 允许 HTTP")
    parser.add_argument("--profile", required=True, type=Path, help="可信预置的后台导出配置")
    parser.add_argument("--device-id", required=True)
    parser.add_argument("--bootloader-version", required=True)
    parser.add_argument("--current-sha256")
    args = parser.parse_args()
    try:
        # Reuse the same HTTPS / origin validation as the service.
        settings = Settings(Path("unused"), args.server.rstrip("/"))
        token = os.environ.get("OTA_DEVICE_TOKEN")
        if not token:
            raise ValueError("请在环境变量 OTA_DEVICE_TOKEN 中提供设备/网关密钥")
        exported = load_json(args.profile.read_bytes())
        target = exported["target"]
        query = {"device_id": args.device_id, "protocol_version": 1, "target_id": target["id"],
                 "layout_id": target["layout_id"], "bootloader_version": args.bootloader_version,
                 "capabilities": ",".join(target["capabilities"])}
        if args.current_sha256:
            query["current_sha256"] = args.current_sha256
        request = Request(settings.public_url + "/api/v1/ota/check?" + urlencode(query), headers={"Authorization": "Bearer " + token})
        with build_opener(NoRedirect()).open(request, timeout=15) as response:
            # Never follow firmware URLs or log Authorization headers.
            if urlsplit(response.url).netloc != urlsplit(settings.public_url).netloc:
                raise ValueError("服务器重定向到其他源站")
            raw = response.read(65537)
        if len(raw) > 65536:
            raise ValueError("响应清单过大")
        offer = load_json(raw)
        manifest = validate_offer(offer, exported, args.bootloader_version)
        if manifest:
            print(f"清单验签通过：{manifest['version']}，{manifest['size']} 字节，SHA-256 {manifest['sha256']}")
            print("未下载或安装。完整安装协议见 docs/protocol.md。")
        else:
            print("当前没有需要安装的新发布。")
    except HTTPError as exc:
        parser.exit(1, f"请求失败，HTTP {exc.code}；未打印设备凭据。\n")
    except (ValueError, OSError, KeyError) as exc:
        parser.exit(1, f"检查失败: {exc}\n")


if __name__ == "__main__":
    main()
