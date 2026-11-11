import json
from pathlib import Path
import sys
from types import SimpleNamespace
from unittest.mock import Mock

import pytest

if sys.platform != "win32":
    pytest.skip("Windows desktop launcher", allow_module_level=True)

from ota_server import desktop_tunnel as desktop


def test_old_ready_file_and_reused_pid_do_not_advertise_a_url(tmp_path, monkeypatch):
    state = tmp_path / "quick-tunnel.json"
    state.write_text(json.dumps(dict(status="ready", url="https://old-name.trycloudflare.com",
                                     pid=42, started_at="2025-01-01T00:00:00+00:00")))
    monkeypatch.setattr(desktop.qt, "STATE", state)
    process = Mock()
    process.cwd.return_value = str(desktop.qt.ROOT)
    process.cmdline.return_value = ["python", "-m", "ota_server.desktop_tunnel", "serve"]
    process.create_time.return_value = 2000000000
    monkeypatch.setattr(desktop.psutil, "Process", lambda pid: process)
    assert desktop.owner_state() == {}


def test_existing_verified_origin_is_reused(monkeypatch):
    origin = "https://one-test.trycloudflare.com"
    monkeypatch.setattr(desktop, "owner_state", lambda: dict(status="ready", url=origin))
    monkeypatch.setattr(desktop, "start_worker", lambda: pytest.fail("started a second worker"))
    probe = Mock()
    monkeypatch.setattr(desktop.qt, "probe_origin", probe)
    assert desktop.connect() == origin
    probe.assert_called_once_with(origin)
    probe.side_effect = ValueError("验证失败")
    with pytest.raises(ValueError, match="验证失败"):
        desktop.connect()


@pytest.mark.parametrize("reason", ["foreign_project", "custom_origin", "upgrade_busy", "worker_failed"])
def test_handover_only_stops_owned_idle_local_and_recovers_on_failure(reason, monkeypatch):
    proc = Mock()
    proc.exe.return_value = str(desktop.PYTHON)
    proc.cwd.return_value = str(desktop.qt.ROOT if reason != "foreign_project" else Path("C:/another"))
    proc.cmdline.return_value = ["python", "-m", "ota_server", "serve", "--port", "8000"]
    proc.environ.return_value = {"OTA_PUBLIC_URL":"https://another.invalid"} if reason == "custom_origin" else {}
    proc.net_connections.return_value = []
    listener = SimpleNamespace(laddr=SimpleNamespace(ip="127.0.0.1"), pid=123)
    monkeypatch.setattr(desktop, "listeners", lambda: [] if proc.terminate.called else [listener])
    monkeypatch.setattr(desktop.psutil, "Process", lambda pid: proc)
    monkeypatch.setattr(desktop, "check_idle", Mock(side_effect=ValueError("busy") if reason=="upgrade_busy" else None))
    restore = Mock()
    monkeypatch.setattr(desktop.subprocess, "Popen", restore)
    with pytest.raises(ValueError):
        with desktop.LocalHandover(desktop.qt.ROOT / "data") as handover:
            handover.release_local()
            raise ValueError("simulated tunnel startup failure")
    if reason == "worker_failed":
        proc.terminate.assert_called_once()
        assert restore.call_args.args[0] == [str(desktop.PYTHON), "-m", "ota_server", "serve", "--port", "8000"]
    else:
        proc.terminate.assert_not_called()
        restore.assert_not_called()
