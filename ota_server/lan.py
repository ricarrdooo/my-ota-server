"""Explicit, device-only plaintext LAN debugging. Disabled in normal deployments."""
from ipaddress import ip_address
import logging
import re
import socket
from urllib.parse import urlsplit

from fastapi.responses import JSONResponse

from .config import private_ipv4

LOGGER = logging.getLogger("uvicorn.error")
DEVICE_ROUTES = (
    ("GET", re.compile(r"/api/v1/ota/check")),
    ("POST", re.compile(r"/api/v1/ota/attempts")),
    ("POST", re.compile(r"/api/v1/devices/heartbeat")),
    ("POST", re.compile(r"/api/v1/devices/commands/claim")),
    ("POST", re.compile(r"/api/v1/devices/commands/[0-9a-f]{32}/events")),
    ("GET", re.compile(r"/api/v1/ota/releases/[A-Za-z0-9_-]{10,40}/firmware")),
    ("POST", re.compile(r"/api/v1/ota/attempts/[A-Za-z0-9_-]{10,40}/events")),
)


def loopback(value):
    try:
        return ip_address(value).is_loopback
    except (ValueError, TypeError):
        return False


def host_matches(headers, hostnames, port):
    values = [value for name, value in headers if name.lower() == b"host"]
    if len(values) != 1:
        return False
    try:
        authority = values[0].decode("ascii")
        allowed = {f"{hostname}:{port}" for hostname in hostnames}
        if port == 80:
            allowed.update(hostnames)
        return authority.lower() in allowed
    except (UnicodeError, ValueError):
        return False


class LanHttpGuard:
    """Uses actual transport addresses, never Host/X-Forwarded-* to grant admin access.

    The LAN launcher disables Uvicorn proxy headers. If a caller instead mounts this
    app behind another ASGI server, it must likewise preserve real scope addresses.
    """
    def __init__(self, app, host, port):
        self.app, self.host, self.port = app, host, port

    async def __call__(self, scope, receive, send):
        if scope["type"] == "websocket":
            return await send({"type": "websocket.close", "code": 1008})
        if scope["type"] != "http":
            return await self.app(scope, receive, send)
        client, server = scope.get("client") or ("", 0), scope.get("server") or ("", 0)
        peer, listener = client[0], server[0]
        headers = scope.get("headers", [])
        local_admin = (server[1] == self.port and loopback(peer) and loopback(listener)
                       and host_matches(headers, {"localhost", "127.0.0.1"}, self.port))
        if local_admin:
            return await self.app(scope, receive, send)
        path, method = scope["path"], scope["method"]
        origins = [value for name, value in headers if name.lower() == b"origin"]
        allowed_origins = {f"http://{self.host}:{self.port}".encode("ascii")}
        if self.port == 80:
            allowed_origins.add(f"http://{self.host}".encode("ascii"))
        origin_valid = not origins or (len(origins) == 1 and origins[0] in allowed_origins)
        permitted_route = ((path == "/healthz" and method == "GET") or
                           any(method == verb and pattern.fullmatch(path) for verb, pattern in DEVICE_ROUTES))
        permitted = (server[1] == self.port and listener == self.host
                     and (private_ipv4(peer) or loopback(peer))
                     and host_matches(headers, {self.host}, self.port) and origin_valid and permitted_route)
        if not permitted:
            return await JSONResponse({"error": "LAN debug exposes device APIs only; open the admin console on this PC at 127.0.0.1"}, 403)(scope, receive, send)

        async def logged_send(message):
            if message["type"] == "http.response.start" and path != "/healthz":
                # No query strings, headers, credentials or request/response bodies.
                LOGGER.info("LAN OTA peer=%s method=%s path=%r status=%d", peer, method, path, message["status"])
            await send(message)

        await self.app(scope, receive, logged_send)


def serve_lan(app, settings, port):
    """Keep the safe localhost admin URL; bind only that IP and one explicit LAN IP."""
    import uvicorn
    if not private_ipv4(settings.lan_http_host):
        raise ValueError("局域网调试必须显式指定本机 RFC1918 私网 IPv4")
    expected = urlsplit(settings.public_url).port or 80
    if not 1 <= port <= 65535 or port != expected:
        raise ValueError("局域网调试端口必须与 OTA_PUBLIC_URL 的端口相同")
    sockets = []
    try:
        for host in ("127.0.0.1", settings.lan_http_host):
            connection = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sockets.append(connection)
            if hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
                connection.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
            else:
                connection.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
            connection.bind((host, port))
            connection.setblocking(False)
        config = uvicorn.Config(app, host="127.0.0.1", port=port,
                                proxy_headers=False, access_log=False)
        LOGGER.warning("LAN HTTP DEBUG: device credentials travel unencrypted; trusted private networks only")
        LOGGER.info("Admin console: http://127.0.0.1:%d ; device API: http://%s:%d",
                    port, settings.lan_http_host, port)
        uvicorn.Server(config).run(sockets=sockets)
    finally:
        for connection in sockets:
            connection.close()
