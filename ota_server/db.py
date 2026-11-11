from contextlib import closing, contextmanager
import sqlite3

SCHEMA = """
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT NOT NULL);
INSERT OR IGNORE INTO meta VALUES ('schema_version','1');
CREATE TABLE IF NOT EXISTS admins (
 id INTEGER PRIMARY KEY CHECK(id=1), username TEXT NOT NULL UNIQUE, password_hash TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS sessions (
 digest TEXT PRIMARY KEY, csrf TEXT NOT NULL, expires REAL NOT NULL);
CREATE TABLE IF NOT EXISTS products (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, description TEXT NOT NULL DEFAULT '', created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS signing_keys (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), name TEXT NOT NULL,
 pem TEXT NOT NULL, revoked INTEGER NOT NULL DEFAULT 0, created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS targets (
 id TEXT PRIMARY KEY, product_id TEXT NOT NULL REFERENCES products(id), name TEXT NOT NULL,
 adapter TEXT NOT NULL, mcu TEXT NOT NULL, hw_revision TEXT NOT NULL, layout_id TEXT NOT NULL,
 max_size INTEGER NOT NULL, key_id TEXT NOT NULL REFERENCES signing_keys(id),
 min_bootloader TEXT NOT NULL, capabilities TEXT NOT NULL, config TEXT NOT NULL, created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS agents (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, kind TEXT NOT NULL CHECK(kind IN ('device','gateway')),
 token_hash TEXT NOT NULL UNIQUE, revoked INTEGER NOT NULL DEFAULT 0, created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS devices (
 id TEXT PRIMARY KEY, name TEXT NOT NULL, target_id TEXT NOT NULL REFERENCES targets(id),
 agent_id TEXT NOT NULL REFERENCES agents(id), channel TEXT NOT NULL,
 current_version TEXT, current_sha256 TEXT, last_seen REAL, created REAL NOT NULL);
CREATE TABLE IF NOT EXISTS artifacts (
 id TEXT PRIMARY KEY, target_id TEXT NOT NULL REFERENCES targets(id), version TEXT NOT NULL,
 sha256 TEXT NOT NULL, size INTEGER NOT NULL, manifest TEXT NOT NULL, signature TEXT NOT NULL,
 key_id TEXT NOT NULL REFERENCES signing_keys(id), details TEXT NOT NULL, notes TEXT NOT NULL,
 created REAL NOT NULL, UNIQUE(target_id,sha256,manifest));
CREATE TABLE IF NOT EXISTS releases (
 id TEXT PRIMARY KEY, artifact_id TEXT NOT NULL REFERENCES artifacts(id),
 target_id TEXT NOT NULL REFERENCES targets(id), channel TEXT NOT NULL, seq INTEGER NOT NULL,
 active INTEGER NOT NULL DEFAULT 1, created REAL NOT NULL,
 UNIQUE(target_id,channel,seq));
CREATE TABLE IF NOT EXISTS release_notes (
 release_id TEXT PRIMARY KEY REFERENCES releases(id), notes TEXT NOT NULL, updated REAL NOT NULL);
CREATE TABLE IF NOT EXISTS deleted_releases (
 release_id TEXT PRIMARY KEY REFERENCES releases(id), deleted_at REAL NOT NULL);
CREATE TABLE IF NOT EXISTS pruned_artifacts (
 artifact_id TEXT PRIMARY KEY REFERENCES artifacts(id), pruned_at REAL NOT NULL);
CREATE UNIQUE INDEX IF NOT EXISTS one_active_release ON releases(target_id,channel) WHERE active=1;
CREATE TABLE IF NOT EXISTS attempts (
 id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id),
 release_id TEXT NOT NULL REFERENCES releases(id), request_id TEXT NOT NULL,
 state TEXT NOT NULL DEFAULT 'created', progress INTEGER NOT NULL DEFAULT 0,
 last_seq INTEGER NOT NULL DEFAULT 0, error TEXT NOT NULL DEFAULT '',
 created REAL NOT NULL, updated REAL NOT NULL, UNIQUE(device_id,request_id));
CREATE TABLE IF NOT EXISTS events (
 attempt_id TEXT NOT NULL REFERENCES attempts(id), seq INTEGER NOT NULL,
 payload TEXT NOT NULL, created REAL NOT NULL, PRIMARY KEY(attempt_id,seq));
CREATE TABLE IF NOT EXISTS device_remote_state (
 device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
 commands_version INTEGER NOT NULL DEFAULT 0, updated REAL NOT NULL);
CREATE TABLE IF NOT EXISTS remote_commands (
 id TEXT PRIMARY KEY, device_id TEXT NOT NULL REFERENCES devices(id),
 request_id TEXT NOT NULL, request_payload TEXT NOT NULL,
 kind TEXT NOT NULL CHECK(kind IN ('ota.install','device.restart')),
 status TEXT NOT NULL CHECK(status IN ('queued','claimed','executing','succeeded','failed','expired')),
 release_id TEXT REFERENCES releases(id), sha256 TEXT,
 created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, expires_at INTEGER NOT NULL,
 lease_until INTEGER NOT NULL DEFAULT 0, executing_boot_id TEXT,
 error TEXT NOT NULL DEFAULT '', UNIQUE(device_id,request_id));
CREATE UNIQUE INDEX IF NOT EXISTS one_pending_command ON remote_commands(device_id)
 WHERE status IN ('queued','claimed','executing');
CREATE TABLE IF NOT EXISTS command_attempts (
 command_id TEXT PRIMARY KEY REFERENCES remote_commands(id),
 attempt_id TEXT NOT NULL UNIQUE REFERENCES attempts(id));
CREATE TABLE IF NOT EXISTS command_steps (
 command_id TEXT NOT NULL REFERENCES remote_commands(id) ON DELETE CASCADE,
 status TEXT NOT NULL, received REAL NOT NULL, PRIMARY KEY(command_id,status));
CREATE TRIGGER IF NOT EXISTS record_command_step AFTER UPDATE OF status ON remote_commands
 WHEN NEW.status != OLD.status AND NEW.kind='ota.install'
 BEGIN
 INSERT OR IGNORE INTO command_steps VALUES(NEW.id,NEW.status,NEW.updated_at);
 END;
CREATE TABLE IF NOT EXISTS last_upgrade_failure (
 device_id TEXT PRIMARY KEY REFERENCES devices(id) ON DELETE CASCADE,
 report_id TEXT NOT NULL, stage TEXT NOT NULL, error_code TEXT NOT NULL,
 http_status INTEGER NOT NULL, progress INTEGER NOT NULL, occurred INTEGER NOT NULL,
 received REAL NOT NULL);
CREATE TABLE IF NOT EXISTS audit (
 id INTEGER PRIMARY KEY AUTOINCREMENT, action TEXT NOT NULL, object_id TEXT NOT NULL,
 created REAL NOT NULL);
"""


class Database:
    def __init__(self, settings):
        self.directory = settings.data_dir
        self.directory.mkdir(parents=True, exist_ok=True)
        (self.directory / "firmware").mkdir(exist_ok=True)
        (self.directory / "staging").mkdir(exist_ok=True)
        self.path = self.directory / "ota.sqlite3"
        with closing(self.connect()) as conn:
            conn.execute("PRAGMA journal_mode=WAL")
            conn.executescript(SCHEMA)
            if conn.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()[0] != "1":
                raise RuntimeError("数据库版本不受支持，请先执行数据迁移")

    def connect(self):
        conn = sqlite3.connect(self.path, timeout=15)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA foreign_keys=ON")
        conn.execute("PRAGMA busy_timeout=15000")
        return conn

    @contextmanager
    def transaction(self):
        conn = self.connect()
        try:
            conn.execute("BEGIN IMMEDIATE")
            yield conn
            conn.commit()
        except BaseException:
            conn.rollback()
            raise
        finally:
            conn.close()

    def rows(self, sql, params=()):
        conn = self.connect()
        try:
            return [dict(row) for row in conn.execute(sql, params)]
        finally:
            conn.close()

    def one(self, sql, params=()):
        rows = self.rows(sql, params)
        return rows[0] if rows else None
