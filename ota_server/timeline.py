"""One read snapshot of a command and the attempt actually bound to it."""
import json
from contextlib import closing

from .service import Problem


def upgrade_timeline(db, *, command_id=None, attempt_id=None):
    with closing(db.connect()) as conn:
        conn.execute("BEGIN")
        if command_id:
            link = conn.execute("SELECT attempt_id FROM command_attempts WHERE command_id=?", (command_id,)).fetchone()
            attempt_id = link[0] if link else None
        else:
            link = conn.execute("SELECT command_id FROM command_attempts WHERE attempt_id=?", (attempt_id,)).fetchone()
            command_id = link[0] if link else None
        command = conn.execute("SELECT * FROM remote_commands WHERE id=? AND kind='ota.install'", (command_id,)).fetchone()
        attempt = conn.execute("SELECT * FROM attempts WHERE id=?", (attempt_id,)).fetchone()
        if not (command or attempt):
            raise Problem(404, "未找到升级记录")
        steps = []
        def add(stage, received, progress=None, error=""):
            steps.append(dict(stage=stage, received=received, progress=progress, error=error))

        if command:
            add("queued", command["created_at"])
            for row in conn.execute("""SELECT status,received FROM command_steps WHERE command_id=?
                    AND status IN ('claimed','executing') ORDER BY rowid""", (command_id,)):
                add(row["status"], row["received"])
            # Older databases have only the most recently observed status.
            if command["status"] in ("claimed","executing") and steps[-1]["stage"] != command["status"]:
                add(command["status"], command["updated_at"])
        if attempt:
            add("created", attempt["created"])
            for row in conn.execute("SELECT payload,created FROM events WHERE attempt_id=? ORDER BY seq", (attempt_id,)):
                event = json.loads(row["payload"])
                add(event["state"], row["created"], event.get("progress"), event.get("error",""))
        if command and command["status"] in ("expired","succeeded","failed"):
            if steps[-1]["stage"] not in ("confirmed","rolled_back","failed"):
                add(command["status"], command["updated_at"], error=command["error"])
        terminal = (attempt and attempt["state"] in ("confirmed","rolled_back","failed")
                    or command and command["status"] in ("succeeded","expired","failed"))
        return dict(command_id=command_id, attempt_id=attempt_id, terminal=bool(terminal), steps=steps)
