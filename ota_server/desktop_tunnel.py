"""Start or reattach to the project's Windows Quick Tunnel from the desktop EXE."""
from contextlib import closing
from datetime import datetime
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import time
import uuid

import psutil

from . import quick_tunnel as qt


PORT = 8000
PYTHON = qt.ROOT / ".venv/Scripts/python.exe"


def listeners():
    return [c for c in psutil.net_connections("tcp")
            if c.status == psutil.CONN_LISTEN and c.laddr.port == PORT]


def owner_state():
    """A saved ready URL can survive a reboot. Require the live project launcher."""
    try:
        state = json.loads(qt.STATE.read_text(encoding="utf-8"))
        proc = psutil.Process(state["pid"])
        argv = proc.cmdline()
        if (Path(proc.cwd()).resolve() == qt.ROOT and len(argv) >= 3 and argv[1] == "-m"
                and argv[2] in ("ota_server.desktop_tunnel", "ota_server.quick_tunnel")
                and proc.create_time() <= datetime.fromisoformat(state["started_at"]).timestamp() + 1):
            return state
    except (OSError, ValueError, KeyError, TypeError, psutil.Error):
        pass
    return {}


def check_idle(data_dir):
    with closing(sqlite3.connect((data_dir / "ota.sqlite3").as_uri() + "?mode=ro", uri=True)) as db:
        active = db.execute("""SELECT 1 FROM attempts WHERE state NOT IN ('confirmed','failed','rolled_back')
            AND updated >= ? LIMIT 1""", (time.time() - 300,)).fetchone()
        pending = db.execute("""SELECT 1 FROM remote_commands WHERE kind='ota.install'
            AND status IN ('claimed','executing','queued') AND expires_at >= ? LIMIT 1""", (time.time(),)).fetchone()
    if active or pending:
        raise ValueError("设备有正在进行或等待执行的升级，请在升级结束后重试。")


class LocalHandover:
    def __init__(self, data_dir):
        self.data_dir = data_dir
        self.restore_env = None

    def __enter__(self):
        return self

    def release_local(self):
        sockets = listeners()
        if not sockets:
            return
        refusal = "8000 端口由其他服务占用。请先关闭占用该端口的服务。"
        if len(sockets) != 1 or sockets[0].laddr.ip != "127.0.0.1" or not sockets[0].pid:
            raise ValueError(refusal)
        proc = psutil.Process(sockets[0].pid)
        parent = proc.parent()
        if (Path(proc.cwd()).resolve() != qt.ROOT or
                (Path(proc.exe()) != PYTHON and (not parent or Path(parent.exe()) != PYTHON)) or
                proc.cmdline()[1:] not in (["-m", "ota_server", "serve"],
                                          ["-m", "ota_server", "serve", "--port", str(PORT)])):
            raise ValueError(refusal)
        env = proc.environ()
        if ((qt.ROOT / env.get("OTA_DATA_DIR", "data")).resolve() != self.data_dir or
                env.get("OTA_PUBLIC_URL", "http://127.0.0.1:8000") != "http://127.0.0.1:8000" or
                env.get("OTA_LAN_HTTP_HOST")):
            raise ValueError("现有后台使用了其他地址或数据目录，请手动结束该后台后重试。")
        # Wait out an idle browser keep-alive and avoid cutting an ongoing file transfer.
        for _ in range(9):
            if not any(c.status == psutil.CONN_ESTABLISHED and c.laddr.port == PORT
                       for c in proc.net_connections("tcp")):
                break
            time.sleep(1)
        else:
            raise ValueError("本机后台仍有正在使用的连接，请稍后重试。")
        check_idle(self.data_dir)
        env.pop("OTA_ADMIN_PASSWORD", None)
        proc.terminate()  # psutil checks process identity before termination.
        self.restore_env = env
        proc.wait(10)

    def __exit__(self, *_):
        if self.restore_env is not None and not listeners():
            subprocess.Popen([str(PYTHON), "-m", "ota_server", "serve", "--port", str(PORT)],
                             cwd=qt.ROOT, env=self.restore_env, creationflags=subprocess.CREATE_NO_WINDOW,
                             stdin=subprocess.DEVNULL, stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)


def start_worker():
    logs = qt.CACHE / "quick-tunnel"
    logs.mkdir(parents=True, exist_ok=True)
    log = logs / ("desktop-" + uuid.uuid4().hex[:12] + ".log")
    with log.open("xb") as out:
        worker = subprocess.Popen([str(PYTHON), "-m", "ota_server.desktop_tunnel", "serve"],
                                  cwd=qt.ROOT, env=dict(os.environ, PYTHONIOENCODING="utf-8"),
                                  stdin=subprocess.DEVNULL, stdout=out, stderr=out,
                                  creationflags=subprocess.CREATE_NO_WINDOW)
    return worker, log


def connect():
    state = owner_state()
    worker, log = (None, None) if state.get("status") in ("starting","ready") else start_worker()
    deadline = time.monotonic() + 320
    while time.monotonic() < deadline:
        state = owner_state()
        status = state.get("status")
        if status == "ready":
            origin = qt.tunnel_url(state.get("url") or "")
            if not origin:
                raise ValueError("公网地址格式无效。")
            qt.probe_origin(origin)
            return origin
        if status == "error":
            raise ValueError(state.get("error") or "隧道启动失败。")
        if status != "starting" and (worker is None or worker.poll() is not None):
            if log:
                lines = log.read_text(encoding="utf-8", errors="replace").splitlines()
                raise ValueError(lines[-1] if lines else "启动失败，请查看 " + str(log))
            raise ValueError("公网服务已停止，可点击重试。")
        time.sleep(.6)
    raise ValueError("仍未通过公网验证，请检查网络，然后重试。")


def main():
    data_dir = (qt.ROOT / os.environ.get("OTA_DATA_DIR", "data")).resolve()
    action = sys.argv[1] if len(sys.argv) > 1 else "connect"
    if action == "serve":
        qt.run_tunnel(qt.ensure_cloudflared(), data_dir, PORT, "auto", 120, LocalHandover(data_dir))
    elif action == "connect":
        print(connect(), flush=True)
    elif action == "stop":
        state = owner_state()
        if state.get("status") in ("starting","ready"):
            check_idle(data_dir)
            qt.STOP.write_text("stop\n", encoding="ascii")
            deadline = time.monotonic() + 50
            while owner_state().get("status") in ("starting","ready") and time.monotonic() < deadline:
                time.sleep(.4)
            if owner_state().get("status") in ("starting","ready"):
                raise ValueError("停止请求已发送，后台仍在退出。")
    else:
        raise ValueError("未知操作。")


if __name__ == "__main__":
    try:
        main()
    except (OSError, ValueError, psutil.Error, sqlite3.Error, subprocess.SubprocessError) as exc:
        sys.exit(str(exc))
