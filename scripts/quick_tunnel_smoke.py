"""Opt-in live tunnel smoke with a disposable DB, never production credentials."""
import argparse
import json
import os
from pathlib import Path
import secrets
import socket
import subprocess
import sys
import tempfile
import time

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from ota_server.config import Settings
from ota_server.db import Database
from ota_server.security import PASSWORDS
from ota_server.quick_tunnel import ROOT, STATE, STOP


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--protocol', choices=('http2', 'quic', 'auto'), default='http2')
    args = parser.parse_args()
    if STATE.exists() and json.loads(STATE.read_text(encoding='utf-8')).get('status') in ('starting', 'ready'):
        raise SystemExit('Another launcher may be running; smoke refused.')
    with tempfile.TemporaryDirectory(prefix='ota-tunnel-smoke-') as directory:
        data = Path(directory)
        db = Database(Settings(data))
        with db.transaction() as connection:
            connection.execute('INSERT INTO admins VALUES(1,?,?)',
                               ('smoke-admin', PASSWORDS.hash(secrets.token_urlsafe(32))))
        with socket.socket() as probe:
            probe.bind(('127.0.0.1', 0))
            port = probe.getsockname()[1]
        environment = os.environ.copy()
        environment.update(PYTHONIOENCODING='utf-8', OTA_DATA_DIR=str(data))
        logfile = ROOT / '.cache/tunnel-smoke.log'
        with logfile.open('w', encoding='utf-8') as output:
            child = subprocess.Popen([sys.executable, '-B', '-m', 'ota_server.quick_tunnel', '--port', str(port),
                                      '--startup-timeout', '90', '--protocol', args.protocol],
                                     cwd=ROOT, env=environment, stdout=output, stderr=subprocess.STDOUT)
            try:
                deadline = time.monotonic() + 200
                while time.monotonic() < deadline:
                    if child.poll() is not None:
                        raise RuntimeError(logfile.read_text(encoding='utf-8'))
                    if STATE.is_file():
                        state = json.loads(STATE.read_text(encoding='utf-8'))
                        if state.get('port') == port and state.get('status') == 'ready':
                            print('Public smoke passed: health=200, secure login=200, admin without login=401.', flush=True)
                            break
                    time.sleep(2)
                else:
                    raise RuntimeError('Isolated tunnel startup timed out.')
            finally:
                state = json.loads(STATE.read_text(encoding='utf-8')) if STATE.is_file() else {}
                if state.get('port') == port and state.get('status') in ('starting', 'ready'):
                    STOP.write_text('stop\n', encoding='ascii')
                try:
                    child.wait(timeout=65)
                except subprocess.TimeoutExpired:
                    subprocess.run(['taskkill', '/PID', str(child.pid), '/T', '/F'], capture_output=True)
                    child.wait(timeout=10)
            print('Isolated backend and tunnel stopped; existing port 8000 was untouched.', flush=True)


if __name__ == '__main__':
    main()
