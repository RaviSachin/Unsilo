"""WhatsApp Business Cloud API connector (official webhooks only, no WhatsApp Web automation).

Flow: Meta / organiser POSTs webhook -> verify X-Hub-Signature-256 -> find the group of each message
-> DROP anything not in selected_groups (never stored, never logged) -> store raw + parsed message.

The exact field that carries the group id may differ in the organiser's payloads. All lookups go through
`group_id_of()`; adjust it there on event day if the access guide says otherwise.
"""
from __future__ import annotations

import hashlib
import hmac
import json
import logging
import sqlite3
from datetime import datetime, timezone

from .. import db
from ..config import settings

log = logging.getLogger(__name__)


def verify_signature(raw_body: bytes, header: str | None) -> bool:
    if not settings.meta_app_secret:
        return not settings.whatsapp_require_signature
    if not header or not header.startswith("sha256="):
        return False
    expected = hmac.new(settings.meta_app_secret.encode(), raw_body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, header.removeprefix("sha256="))


class GroupFilter:
    """Allow-list from config/selected_groups.json, matched by id or exact name."""

    def __init__(self, groups: list[dict] | None = None):
        groups = settings.selected_groups() if groups is None else groups
        self.ids = {g["id"] for g in groups if g.get("id")}
        self.names = {g["name"].strip().lower() for g in groups if g.get("name")}
        self.name_by_id = {g["id"]: g.get("name") for g in groups if g.get("id")}

    def allows(self, group_id: str | None, group_name: str | None = None) -> bool:
        if group_id and group_id in self.ids:
            return True
        return bool(group_name and group_name.strip().lower() in self.names)


def group_id_of(message: dict, value: dict) -> str | None:
    """Where the group id may live in a Cloud API payload (checked in order)."""
    for candidate in (
        message.get("group_id"),
        (message.get("group") or {}).get("id"),
        (message.get("context") or {}).get("group_id"),
        value.get("group_id"),
        (value.get("metadata") or {}).get("group_id"),
    ):
        if candidate:
            return str(candidate)
    return None


def group_name_of(message: dict, value: dict) -> str | None:
    return (message.get("group") or {}).get("subject") or (message.get("group") or {}).get("name") or value.get("group_name")


def message_text(m: dict) -> str:
    t = m.get("type", "text")
    if t == "text":
        return (m.get("text") or {}).get("body", "")
    if t in {"image", "video", "document", "audio", "sticker"}:
        media = m.get(t) or {}
        label = media.get("caption") or media.get("filename") or ""
        return f"[{t}] {label}".strip()
    if t == "location":
        loc = m.get("location") or {}
        return f"[location] {loc.get('name', '')} {loc.get('address', '')} ({loc.get('latitude')}, {loc.get('longitude')})".strip()
    if t == "reaction":
        return f"[reaction {(m.get('reaction') or {}).get('emoji', '')}]"
    if t == "button":
        return (m.get("button") or {}).get("text", "")
    if t == "interactive":
        inter = m.get("interactive") or {}
        reply = inter.get("button_reply") or inter.get("list_reply") or {}
        return reply.get("title", "")
    return f"[{t}]"


def ingest(conn: sqlite3.Connection, payload: dict, gf: GroupFilter | None = None) -> dict:
    """Process one webhook payload. Returns counts only (no message content is logged)."""
    gf = gf or GroupFilter()
    stored = dropped = 0
    now = datetime.now(timezone.utc).isoformat()
    with db.tx(conn):
        for entry in payload.get("entry", []):
            for change in entry.get("changes", []):
                value = change.get("value", {}) or {}
                names = {c.get("wa_id"): (c.get("profile") or {}).get("name") for c in value.get("contacts", [])}

                for g in value.get("groups", []) or []:  # group metadata / participant updates
                    gid = g.get("group_id") or g.get("id")
                    if gf.allows(gid, g.get("subject")):
                        _upsert_group(conn, gid, g.get("subject") or gf.name_by_id.get(gid))
                        for p in g.get("participants", []) + g.get("added_participants", []):
                            _upsert_participant(conn, gid, p.get("wa_id") or p.get("input"), p.get("name"))

                for m in value.get("messages", []) or []:
                    gid, gname = group_id_of(m, value), group_name_of(m, value)
                    if not gf.allows(gid, gname):
                        dropped += 1
                        continue
                    gid = gid or f"name:{gname}"
                    conn.execute(
                        "INSERT INTO wa_raw_events (received_at, group_id, payload) VALUES (?,?,?)",
                        (now, gid, json.dumps(m)),
                    )
                    _store_message(conn, gid, gname or gf.name_by_id.get(gid), m, names.get(m.get("from")))
                    stored += 1
    return {"stored": stored, "dropped": dropped}


def _upsert_group(conn, gid: str, name: str | None) -> None:
    conn.execute(
        "INSERT INTO wa_groups (group_id, name) VALUES (?,?) "
        "ON CONFLICT(group_id) DO UPDATE SET name = COALESCE(excluded.name, wa_groups.name)",
        (gid, name),
    )


def _upsert_participant(conn, gid: str, wa_id: str | None, name: str | None) -> None:
    if not wa_id:
        return
    conn.execute(
        "INSERT INTO wa_participants (group_id, wa_id, name) VALUES (?,?,?) "
        "ON CONFLICT(group_id, wa_id) DO UPDATE SET name = COALESCE(excluded.name, wa_participants.name)",
        (gid, wa_id, name),
    )


def _store_message(conn, gid: str, gname: str | None, m: dict, sender_name: str | None) -> None:
    _upsert_group(conn, gid, gname)
    _upsert_participant(conn, gid, m.get("from"), sender_name)
    sent_at = datetime.fromtimestamp(int(m.get("timestamp", 0)), timezone.utc).isoformat()
    text = message_text(m)
    conn.execute(
        "INSERT OR IGNORE INTO wa_messages (message_id, group_id, sender_id, sender_name, sent_at, type, text) "
        "VALUES (?,?,?,?,?,?,?)",
        (m["id"], gid, m.get("from"), sender_name, sent_at, m.get("type", "text"), text),
    )
    db.upsert_record(
        conn, provider="whatsapp", external_id=m["id"], title=f"WhatsApp: {gname or gid}", body=text,
        sender=f"{sender_name or ''} ({m.get('from')})", occurred_at=sent_at, extra={"group_id": gid},
    )


def load_participants_file(conn: sqlite3.Connection, data: dict | list, gf: GroupFilter | None = None) -> int:
    """Organiser-provided group metadata: [{"group_id", "name", "participants": [{"wa_id", "name"}]}]."""
    gf = gf or GroupFilter()
    groups = data.get("groups", data) if isinstance(data, dict) else data
    n = 0
    with db.tx(conn):
        for g in groups:
            gid = g.get("group_id") or g.get("id")
            if not gf.allows(gid, g.get("name") or g.get("subject")):
                continue
            _upsert_group(conn, gid, g.get("name") or g.get("subject"))
            for p in g.get("participants", []):
                _upsert_participant(conn, gid, p.get("wa_id") or p.get("phone"), p.get("name"))
            n += 1
    return n


def load_groups(conn: sqlite3.Connection) -> list[dict]:
    out = []
    for g in conn.execute("SELECT * FROM wa_groups ORDER BY name").fetchall():
        parts = conn.execute("SELECT wa_id, name FROM wa_participants WHERE group_id = ? ORDER BY name",
                             (g["group_id"],)).fetchall()
        msgs = conn.execute("SELECT * FROM wa_messages WHERE group_id = ? ORDER BY sent_at",
                            (g["group_id"],)).fetchall()
        out.append({"group_id": g["group_id"], "name": g["name"],
                    "participants": [dict(p) for p in parts], "messages": [dict(m) for m in msgs]})
    return out
