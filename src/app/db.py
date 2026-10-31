"""SQLite. `records` + `records_fts` hold everything searchable; the other tables feed the output files."""
import json
import sqlite3
from datetime import datetime
from pathlib import Path

from .settings import DATABASE_PATH

SCHEMA = """
CREATE TABLE IF NOT EXISTS wa_raw (id INTEGER PRIMARY KEY AUTOINCREMENT, received_at TEXT, group_id TEXT, payload TEXT);
CREATE TABLE IF NOT EXISTS wa_messages (
    message_id TEXT PRIMARY KEY, group_id TEXT, group_name TEXT, sender_id TEXT, sender_name TEXT,
    sent_at TEXT, type TEXT, text TEXT);
CREATE TABLE IF NOT EXISTS wa_participants (group_id TEXT, wa_id TEXT, name TEXT, PRIMARY KEY (group_id, wa_id));
CREATE TABLE IF NOT EXISTS emails (
    id TEXT PRIMARY KEY, thread_id TEXT, from_addr TEXT, from_name TEXT, to_addrs TEXT, subject TEXT,
    body TEXT, sent_at TEXT, labels TEXT, attachments TEXT);
CREATE TABLE IF NOT EXISTS documents (
    id TEXT PRIMARY KEY, name TEXT, mime_type TEXT, modified_at TEXT, url TEXT, text TEXT, error TEXT);
CREATE TABLE IF NOT EXISTS results (kind TEXT, item_id TEXT, data TEXT, PRIMARY KEY (kind, item_id));
CREATE TABLE IF NOT EXISTS records (
    source_id TEXT PRIMARY KEY, source TEXT, title TEXT, body TEXT, sender TEXT, url TEXT, occurred_at TEXT, tags TEXT);
CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(source_id UNINDEXED, title, body, sender, tags,
    tokenize = 'porter unicode61');
"""



def index(source_id: str, source: str, title: str, body: str, sender: str = "", url: str = "",
          occurred_at: str = "", tags: str = "") -> None:
    """Add or replace one searchable record. Call conn.commit() after a batch."""
    conn.execute("INSERT OR REPLACE INTO records VALUES (?,?,?,?,?,?,?,?)",
                 (source_id, source, title, body, sender, url, occurred_at, tags))
    conn.execute("DELETE FROM records_fts WHERE source_id = ?", (source_id,))
    conn.execute("INSERT INTO records_fts VALUES (?,?,?,?,?)", (source_id, title, body, sender, tags))


def add_tags(source_id: str, tags: str) -> None:
    row = conn.execute("SELECT * FROM records WHERE source_id = ?", (source_id,)).fetchone()
    if row:
        index(row["source_id"], row["source"], row["title"], row["body"], row["sender"], row["url"],
              row["occurred_at"], tags)


def save_result(kind: str, item_id: str, data: dict) -> None:
    conn.execute("INSERT OR REPLACE INTO results VALUES (?,?,?)", (kind, item_id, json.dumps(data)))


def results(kind: str) -> dict[str, dict]:
    rows = conn.execute("SELECT item_id, data FROM results WHERE kind = ?", (kind,)).fetchall()
    return {r["item_id"]: json.loads(r["data"]) for r in rows}


def _columns(c: sqlite3.Connection, table: str) -> list[str]:
    return [r[1] for r in c.execute(f"PRAGMA table_info({table})")]


def _outdated(path: str) -> bool:
    """True when the file was made by an older build (same table name, different columns)."""
    if not Path(path).exists():
        return False
    fresh = sqlite3.connect(":memory:")
    fresh.executescript(SCHEMA)
    old = sqlite3.connect(path)
    try:
        tables = [r[0] for r in fresh.execute("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'records_fts%'")]
        return any(_columns(old, t) and _columns(old, t) != _columns(fresh, t) for t in tables)
    finally:
        old.close()
        fresh.close()


def _carry_over_whatsapp(old_path: Path) -> None:
    """Copy WhatsApp messages of selected groups from an older database (nothing else is kept)."""
    from .settings import selected_groups

    wanted = selected_groups()
    old = sqlite3.connect(old_path)
    old.row_factory = sqlite3.Row
    try:
        names = {r["group_id"]: r["name"] for r in old.execute("SELECT group_id, name FROM wa_groups")} \
            if _columns(old, "wa_groups") else {}
        cols = set(_columns(old, "wa_messages"))
        if not {"message_id", "group_id", "text"} <= cols:
            return
        for m in old.execute("SELECT * FROM wa_messages"):
            m = dict(m)
            gid, gname = m["group_id"], m.get("group_name") or names.get(m["group_id"])
            if not any(gid == g.get("id") or (gname or "").lower() == (g.get("name") or "").lower() for g in wanted):
                continue
            conn.execute("INSERT OR IGNORE INTO wa_messages VALUES (?,?,?,?,?,?,?,?)",
                         (m["message_id"], gid, gname, m.get("sender_id"), m.get("sender_name"), m.get("sent_at"),
                          m.get("type") or "text", m["text"]))
            index(f"whatsapp:{m['message_id']}", "whatsapp", f"WhatsApp: {gname or gid}", m["text"] or "",
                  f"{m.get('sender_name') or ''} ({m.get('sender_id')})", "", m.get("sent_at") or "")
        conn.commit()
    finally:
        old.close()


Path(DATABASE_PATH).parent.mkdir(parents=True, exist_ok=True)
_moved = None
if _outdated(DATABASE_PATH):
    # Keep the old file instead of deleting it, and start a clean database.
    _moved = Path(DATABASE_PATH).with_name(f"{Path(DATABASE_PATH).stem}.old-{datetime.now():%Y%m%d-%H%M%S}.db")
    Path(DATABASE_PATH).rename(_moved)
    print(f"Database {DATABASE_PATH} came from an older build; moved it to {_moved.name} and started fresh.")
conn = sqlite3.connect(DATABASE_PATH, check_same_thread=False)
conn.row_factory = sqlite3.Row
conn.executescript(SCHEMA)
if _moved:
    _carry_over_whatsapp(_moved)
