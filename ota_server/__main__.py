import argparse
from dataclasses import replace
import base64
import getpass
import hashlib
import json
import os
from pathlib import Path
import shutil
import sqlite3

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa

from .adapters import validate_image
from .config import Settings
from .db import Database
from .models import Manifest
from .security import PASSWORDS, canonical, key_fingerprint, load_json
from .service import fingerprint


def pack(profile_value, data, private_key, version=None):
    target = profile_value["target"]
    if profile_value.get("schema_version") != 1 or fingerprint(target) != profile_value["target_fingerprint"]:
        raise ValueError("目标配置指纹不匹配")
    if key_fingerprint(private_key.public_key()) != target["key_id"]:
        raise ValueError("私钥与此目标公钥不匹配")
    if len(data) > target["max_size"]:
        raise ValueError("固件超过此型号允许的最大长度")
    details = validate_image(data, target["adapter"], target["config"])
    native = details.get("native_version")
    version = version or native
    if not version or native and version != native:
        raise ValueError("请使用镜像内置版本；原始 Cortex-M bin 需要显式 --version")
    value = Manifest(schema_version=1, product_id=target["product_id"], target_id=target["id"],
                     target_fingerprint=fingerprint(target), component="app", mcu=target["mcu"],
                     hw_revision=target["hw_revision"], layout_id=target["layout_id"], image_format=target["adapter"],
                     version=version, size=len(data), sha256=hashlib.sha256(data).hexdigest(), key_id=target["key_id"],
                     signature_algorithm="rsa-pss-sha256", min_bootloader_version=target["min_bootloader"],
                     required_capabilities=sorted(target["capabilities"])).model_dump()
    signature = private_key.sign(canonical(value), padding.PSS(mgf=padding.MGF1(hashes.SHA256()), salt_length=32), hashes.SHA256())
    return value, base64.b64encode(signature).decode("ascii")


def main():
    parser = argparse.ArgumentParser(description="OTA Station 管理、离线签名与服务工具")
    commands = parser.add_subparsers(dest="command", required=True)
    init = commands.add_parser("init", help="创建唯一管理员（交互输入密码）")
    init.add_argument("--username", default="admin")
    reset = commands.add_parser("reset-admin", help="本机重置管理员密码并注销全部会话")
    reset.add_argument("--username", default="admin")
    serve = commands.add_parser("serve", help="启动服务，本机默认 127.0.0.1:8000")
    serve.add_argument("--host", default="127.0.0.1")
    serve.add_argument("--port", type=int, default=8000)
    serve.add_argument("--lan-http-host", help="显式开启仅设备接口的私网 HTTP 调试：填写本机 RFC1918 IPv4；管理后台仍限本机")
    keys = commands.add_parser("keygen", help="在本机生成密码保护的 RSA-3072 签名私钥与公钥")
    keys.add_argument("--output", type=Path, required=True)
    signing = commands.add_parser("pack", help="离线验证固件并签名兼容清单，不上传任何文件")
    signing.add_argument("--profile", type=Path, required=True)
    signing.add_argument("--firmware", type=Path, required=True)
    signing.add_argument("--private-key", type=Path, required=True)
    signing.add_argument("--output", type=Path, required=True)
    signing.add_argument("--version", help="默认读取镜像版本；raw-cortexm 必填")
    backup = commands.add_parser("backup", help="备份一致数据库快照及其引用的固件")
    backup.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    try:
        if args.command in ("init", "reset-admin"):
            if not args.username or len(args.username) > 80 or not args.username.isascii():
                raise ValueError("管理员用户名需为 1～80 个 ASCII 字符")
            db = Database(Settings.from_env())
            if args.command == "init" and db.one("SELECT id FROM admins"):
                raise ValueError("管理员已存在；需要修改时使用 reset-admin")
            password = os.environ.get("OTA_ADMIN_PASSWORD")
            if password is None:
                password = getpass.getpass("管理员密码（至少 12 个字符）: ")
                if password != getpass.getpass("再次输入: "):
                    raise ValueError("两次密码不一致")
            if not 12 <= len(password) <= 256:
                raise ValueError("管理员密码长度需为 12～256")
            with db.transaction() as conn:
                conn.execute("INSERT INTO admins VALUES(1,?,?) ON CONFLICT(id) DO UPDATE SET username=excluded.username,password_hash=excluded.password_hash",
                             (args.username, PASSWORDS.hash(password)))
                conn.execute("DELETE FROM sessions")
            print("管理员已配置；请打开服务地址登录。密码未记录到日志。")
        elif args.command == "serve":
            import uvicorn
            from .app import create_app
            settings = Settings.from_env()
            if args.lan_http_host is not None:
                if not args.lan_http_host:
                    raise ValueError("--lan-http-host 需要填写本机私网 IPv4")
                settings = replace(settings, lan_http_host=args.lan_http_host)
            if settings.lan_http_host:
                if args.host not in ("127.0.0.1", "localhost"):
                    raise ValueError("局域网调试请保留 --host 默认值；程序仅绑定回环和指定的私网 IP")
                from .lan import serve_lan
                serve_lan(create_app(settings), settings, args.port)
            elif args.host not in ("127.0.0.1", "localhost", "::1") and not settings.secure_cookie:
                raise ValueError("监听外部地址前请配置 HTTPS OTA_PUBLIC_URL，并使用 HTTPS 反向代理")
            else:
                uvicorn.run(create_app(settings), host=args.host, port=args.port, access_log=False,
                            proxy_headers=True, forwarded_allow_ips=os.environ.get("FORWARDED_ALLOW_IPS", "127.0.0.1"))
        elif args.command == "keygen":
            if (args.output / "private.pem").exists() or (args.output / "public.pem").exists():
                raise ValueError("目标目录已存在密钥；不会覆盖")
            password = getpass.getpass("私钥保护密码（至少 8 个字符）: ")
            if len(password) < 8 or password != getpass.getpass("再次输入: "):
                raise ValueError("密码长度不足或两次输入不一致")
            key = rsa.generate_private_key(public_exponent=65537, key_size=3072)
            args.output.mkdir(parents=True, exist_ok=True)
            private_path = args.output / "private.pem"
            with private_path.open("xb") as stream:
                stream.write(key.private_bytes(serialization.Encoding.PEM, serialization.PrivateFormat.PKCS8,
                                               serialization.BestAvailableEncryption(password.encode())))
            private_path.chmod(0o600)
            with (args.output / "public.pem").open("xb") as stream:
                stream.write(key.public_key().public_bytes(serialization.Encoding.PEM, serialization.PublicFormat.SubjectPublicKeyInfo))
            print("已生成 private.pem 与 public.pem。仅将公钥添加到后台，离线备份私钥。")
        elif args.command == "pack":
            if (args.output / "manifest.json").exists() or (args.output / "signature.txt").exists():
                raise ValueError("输出目录已有清单/签名，请使用新的版本目录")
            key_data = args.private_key.read_bytes()
            try:
                key = serialization.load_pem_private_key(key_data, password=None)
            except TypeError:
                key = serialization.load_pem_private_key(key_data, password=getpass.getpass("私钥保护密码: ").encode())
            if not isinstance(key, rsa.RSAPrivateKey):
                raise ValueError("首版仅支持 RSA 签名密钥")
            value, signature = pack(load_json(args.profile.read_bytes()), args.firmware.read_bytes(), key, args.version)
            args.output.mkdir(parents=True, exist_ok=True)
            with (args.output / "manifest.json").open("x", encoding="utf-8") as stream:
                stream.write(json.dumps(value, indent=2, ensure_ascii=True) + "\n")
            with (args.output / "signature.txt").open("x", encoding="ascii") as stream:
                stream.write(signature + "\n")
            print(f"已验证并签名版本 {value['version']}。上传原固件、manifest.json、signature.txt。")
        elif args.command == "backup":
            if args.output.exists():
                raise ValueError("备份输出必须是尚不存在的新目录")
            db = Database(Settings.from_env())
            args.output.mkdir(parents=True)
            destination = sqlite3.connect(args.output / "ota.sqlite3")
            source = db.connect()
            try:
                source.backup(destination)
                referenced = destination.execute("""SELECT DISTINCT a.sha256 FROM artifacts a
                    LEFT JOIN pruned_artifacts p ON p.artifact_id=a.id WHERE p.artifact_id IS NULL""").fetchall()
            finally:
                source.close()
                destination.close()
            (args.output / "firmware").mkdir()
            for (digest,) in referenced:
                original = db.directory / "firmware" / (digest + ".bin")
                if hashlib.sha256(original.read_bytes()).hexdigest() != digest:
                    raise ValueError("源固件损坏，备份未完成")
                shutil.copy2(original, args.output / "firmware" / original.name)
            print("数据库及引用固件已备份。备份含凭据哈希和管理员数据，请妥善保管。")
    except (ValueError, OSError, KeyError) as exc:
        parser.exit(1, f"操作失败: {exc}\n")


if __name__ == "__main__":
    main()
