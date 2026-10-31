"""SQLite storage. One `records` table holds every searchable item from all three sources,
plus source-specific tables for what the output JSON files need.

Every record has a stable `source_id` (e.g. "gmail:18c2f...", "drive:1AbC...", "whatsapp:wamid.HBg...")
which is what answers cite.
"""
from __future__ import annotations

import json
import sqlite3
from contextlib import contextmanager
from pathlib import Path
from typing import Iterator

from .config import settings

SCHEMA = """
CREATE TABLE IF NOT EXISTS records (
    source_id   TEXT PRIMARY KEY,           -- what answers cite
    provider    TEXT NOT NULL,              -- gmail | drive | whatsapp
    external_id TEXT NOT NULL,
    title       TEXT,
    body        TEXT,
    sender      TEXT,
    source_url  TEXT,
    occurred_at TEXT,                       -- ISO 8601 UTC
    labels      TEXT,                       -- analysis results folded in, so search can find them
    extra       TEXT                        -- JSON blob of provider-specific fields
);

-- Search index over records (BM25 ranking built into SQLite)
CREATE VIRTUAL TABLE IF NOT EXISTS records_fts USING fts5(
    source_id UNINDEXED, title, body, sender, labels, tokenize = 'porter unicode61'
);

CREATE TABLE IF NOT EXISTS emails (
    message_id    TEXT PRIMARY KEY,
    thread_id     TEXT,
    from_addr     TEXT,
    from_name     TEXT,
    to_addrs      TEXT,                     -- JSON list
    cc_addrs      TEXT,                     -- JSON list
    subject       TEXT,
    body          TEXT,
    sent_at       TEXT,
    label_ids     TEXT,                     -- JSON list (Gmail system labels, read only)
    attachments   TEXT                      -- JSON list of {filename, mime_type, size, text}
);

CREATE TABLE IF NOT EXISTS documents (
    file_id       TEXT PRIMARY KEY,
    name          TEXT,
    mime_type     TEXT,
    modified_at   TEXT,
    web_url       TEXT,
    text          TEXT,
    extract_error TEXT
);

CREATE TABLE IF NOT EXISTS wa_groups (
    group_id   TEXT PRIMARY KEY,
    name       TEXT
);

CREATE TABLE IF NOT EXISTS wa_participants (
    group_id   TEXT,
    wa_id      TEXT,                        -- phone number in international format
    name       TEXT,
    PRIMARY KEY (group_id, wa_id)
);

CREATE TABLE IF NOT EXISTS wa_messages (
    message_id TEXT PRIMARY KEY,            -- wamid, unique, so replays never duplicate
    group_id   TEXT,
    sender_id  TEXT,
    sender_name TEXT,
    sent_at    TEXT,
    type       TEXT,
    text       TEXT
);

-- Raw webhook payloads for SELECTED groups only, so nothing is lost if parsing has a bug.
CREATE TABLE IF NOT EXISTS wa_raw_events (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    received_at TEXT,
    group_id    TEXT,
    payload     TEXT
);

-- Analysis results, keyed by the item they describe
CREATE TABLE IF NOT EXISTS analysis (
    kind       TEXT,                        -- email_team | email_attachment | drive_category | wa_interpretation
    item_id    TEXT,
    result     TEXT,                        -- JSON
    PRIMARY KEY (kind, item_id)
);

-- Small settings store (e.g. the practice fixtures' reference date)
CREATE TABLE IF NOT EXISTS kv (key TEXT PRIMARY KEY, value TEXT);

CREATE TABLE IF NOT EXISTS sync_runs (
    id             INTEGER PRIMARY KEY AUTOINCREMENT,
    provider       TEXT,
    status         TEXT,
    imported_count INTEGER DEFAULT 0,
    error          TEXT,
    started_at     TEXT,
    finished_at    TEXT
);
"""


def connect(path: Path | None = None) -> sqlite3.Connection:
    path = path or settings.database_path
    path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(path, check_same_thread=False)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.executescript(SCHEMA)
    return conn


_conn: sqlite3.Connection | None = None


def get_conn() -> sqlite3.Connection:
    global _conn
    if _conn is None:
        _conn = connect()
    return _conn


def set_conn(conn: sqlite3.Connection) -> None:
    """Used by tests to point everything at a temporary database."""
    global _conn
    _conn = conn


@contextmanager
def tx(conn: sqlite3.Connection | None = None) -> Iterator[sqlite3.Connection]:
    conn = conn or get_conn()
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise


def upsert_record(
    conn: sqlite3.Connection,
    *,
    provider: str,
    external_id: str,
    title: str,
    body: str,
    sender: str = "",
    source_url: str = "",
    occurred_at: str = "",
    labels: str = "",
    extra: dict | None = None,
) -> str:
    source_id = f"{provider}:{external_id}"
    conn.execute(
        """INSERT INTO records (source_id, provider, external_id, title, body, sender, source_url, occurred_at, labels, extra)
           VALUES (?,?,?,?,?,?,?,?,?,?)
           ON CONFLICT(source_id) DO UPDATE SET title=excluded.title, body=excluded.body, sender=excluded.sender,
             source_url=excluded.source_url, occurred_at=excluded.occurred_at, labels=excluded.labels, extra=excluded.extra""",
        (source_id, provider, external_id, title, body, sender, source_url, occurred_at, labels,
         json.dumps(extra or {})),
    )
    conn.execute("DELETE FROM records_fts WHERE source_id = ?", (source_id,))
    conn.execute(
        "INSERT INTO records_fts (source_id, title, body, sender, labels) VALUES (?,?,?,?,?)",
        (source_id, title, body, sender, labels),
    )
    return source_id


def set_labels(conn: sqlite3.Connection, source_id: str, labels: str) -> None:
    """Fold analysis results into the search index (e.g. "team:sales unanswered:7d")."""
    conn.execute("UPDATE records SET labels = ? WHERE source_id = ?", (labels, source_id))
    row = conn.execute("SELECT title, body, sender FROM records WHERE source_id = ?", (source_id,)).fetchone()
    if row:
        conn.execute("DELETE FROM records_fts WHERE source_id = ?", (source_id,))
        conn.execute(
            "INSERT INTO records_fts (source_id, title, body, sender, labels) VALUES (?,?,?,?,?)",
            (source_id, row["title"], row["body"], row["sender"], labels),
        )


def save_analysis(conn: sqlite3.Connection, kind: str, item_id: str, result: dict) -> None:
    conn.execute(
        "INSERT INTO analysis (kind, item_id, result) VALUES (?,?,?) "
        "ON CONFLICT(kind, item_id) DO UPDATE SET result = excluded.result",
        (kind, item_id, json.dumps(result)),
    )


def load_analysis(conn: sqlite3.Connection, kind: str) -> dict[str, dict]:
    rows = conn.execute("SELECT item_id, result FROM analysis WHERE kind = ?", (kind,)).fetchall()
    return {r["item_id"]: json.loads(r["result"]) for r in rows}


def kv_set(conn: sqlite3.Connection, key: str, value: str) -> None:
    conn.execute("INSERT INTO kv (key, value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value",
                 (key, value))
    conn.commit()


def kv_get(conn: sqlite3.Connection, key: str) -> str | None:
    row = conn.execute("SELECT value FROM kv WHERE key = ?", (key,)).fetchone()
    return row["value"] if row else None
