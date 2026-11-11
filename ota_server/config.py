from dataclasses import dataclass
from ipaddress import IPv4Address, IPv4Network
import os
from pathlib import Path
from urllib.parse import urlsplit


PRIVATE_NETWORKS = tuple(IPv4Network(value) for value in ("10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16"))


def private_ipv4(value):
    """RFC1918 only: ipaddress.is_private also accepts unrelated reserved ranges."""
    try:
        address = IPv4Address(value)
        return str(address) == value and any(address in network for network in PRIVATE_NETWORKS)
    except (ValueError, TypeError):
        return False


@dataclass(frozen=True)
class Settings:
    data_dir: Path
    public_url: str = "http://127.0.0.1:8000"
    max_upload: int = 32 * 1024 * 1024
    session_hours: int = 8
    lan_http_host: str = ""

    def __post_init__(self):
        object.__setattr__(self, "data_dir", Path(self.data_dir).resolve())
        object.__setattr__(self, "public_url", self.public_url.rstrip("/"))
        url = urlsplit(self.public_url)
        if (url.scheme not in ("http", "https") or not url.hostname or url.username
                or url.password or url.path or url.query or url.fragment):
            raise ValueError("OTA_PUBLIC_URL 必须是无路径的 http(s) 地址")
        if url.scheme == "http" and url.hostname not in ("localhost", "127.0.0.1", "::1", "testserver"):
            raise ValueError("公网部署必须使用 HTTPS；HTTP 仅供本机开发")
        try:
            port = url.port
        except ValueError as exc:
            raise ValueError("OTA_PUBLIC_URL 端口无效") from exc
        if port is not None and not 1 <= port <= 65535:
            raise ValueError("OTA_PUBLIC_URL 端口无效")
        if self.lan_http_host:
            if not private_ipv4(self.lan_http_host):
                raise ValueError("OTA_LAN_HTTP_HOST 必须是本机 RFC1918 私网 IPv4，不允许域名、公网、回环或通配地址")
            if url.scheme != "http" or url.hostname not in ("localhost", "127.0.0.1"):
                raise ValueError("局域网 HTTP 调试仅搭配本机 HTTP 管理后台；公网 HTTPS 不得同时启用")
        if not 1024 <= self.max_upload <= 128 * 1024 * 1024:
            raise ValueError("全局上传上限必须在 1 KiB～128 MiB 之间")

    @property
    def secure_cookie(self):
        return self.public_url.startswith("https://")

    @classmethod
    def from_env(cls):
        return cls(Path(os.environ.get("OTA_DATA_DIR", "data")),
                   os.environ.get("OTA_PUBLIC_URL", "http://127.0.0.1:8000"),
                   int(os.environ.get("OTA_MAX_UPLOAD_BYTES", 32 * 1024 * 1024)),
                   lan_http_host=os.environ.get("OTA_LAN_HTTP_HOST", ""))
