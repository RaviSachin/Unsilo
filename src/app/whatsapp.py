"""WhatsApp Cloud API webhook (official API only): verify signature, keep only selected groups, store."""
import hashlib
import hmac
import json
from datetime import datetime, timezone

from . import db, settings
from .db import conn


def signature_ok(body: bytes, header: str | None) -> bool:
    if not settings.META_APP_SECRET:
        return not settings.REQUIRE_SIGNATURE
    if not header or not header.startswith("sha256="):
        return False
    digest = hmac.new(settings.META_APP_SECRET.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(digest, header[7:])


def _group_of(msg: dict, value: dict) -> tuple[str | None, str | None]:
    # Adjust here once the organiser confirms where the group id lives.
    group = msg.get("group") or {}
    gid = msg.get("group_id") or group.get("id") or value.get("group_id") or (msg.get("context") or {}).get("group_id")
    name = group.get("subject") or group.get("name") or value.get("group_name")
    if not gid and not name and settings.ALLOW_DIRECT:
        return settings.DIRECT_GROUP["id"], settings.DIRECT_GROUP["name"]
    return gid, name


def selected(gid: str | None, name: str | None) -> dict | None:
    for g in settings.selected_groups():
        if (gid and gid == g.get("id")) or (name and name.strip().lower() == (g.get("name") or "").strip().lower()):
            return g
    return None


def _text(msg: dict) -> str:
    kind = msg.get("type", "text")
    if kind == "text":
        return (msg.get("text") or {}).get("body", "")
    if kind == "reaction":
        return f"[reaction {(msg.get('reaction') or {}).get('emoji', '')}]"
    if kind == "interactive":
        reply = (msg.get("interactive") or {}).get("button_reply") or (msg.get("interactive") or {}).get("list_reply") or {}
        return reply.get("title", "")
    media = msg.get(kind) or {}
    return f"[{kind}] {media.get('caption') or media.get('filename') or ''}".strip()


def _participant(gid: str, wa_id: str | None, name: str | None) -> None:
    if wa_id:
        conn.execute("INSERT INTO wa_participants VALUES (?,?,?) ON CONFLICT(group_id, wa_id) "
                     "DO UPDATE SET name = COALESCE(excluded.name, wa_participants.name)", (gid, wa_id, name))


def ingest(payload: dict) -> dict:
    stored = dropped = direct_dropped = 0
    now = datetime.now(timezone.utc).isoformat()
    for entry in payload.get("entry", []):
        for change in entry.get("changes", []):
            value = change.get("value") or {}
            names = {c.get("wa_id"): (c.get("profile") or {}).get("name") for c in value.get("contacts", [])}
            for g in value.get("groups", []) or []:  # participant updates, if the organiser sends them
                cfg = selected(g.get("group_id") or g.get("id"), g.get("subject"))
                if cfg:
                    gid = g.get("group_id") or g.get("id") or cfg.get("id")
                    for p in (g.get("participants") or []) + (g.get("added_participants") or []):
                        _participant(gid, p.get("wa_id"), p.get("name"))
            for msg in value.get("messages", []):
                gid, gname = _group_of(msg, value)
                cfg = selected(gid, gname)
                if not cfg:
                    dropped += 1  # not selected: never stored, never logged
                    direct_dropped += not (gid or gname)  # 1:1 chat (no group at all), counted for debugging
                    continue
                gid, gname = gid or cfg.get("id") or f"name:{gname}", gname or cfg.get("name")
                conn.execute("INSERT INTO wa_raw (received_at, group_id, payload) VALUES (?,?,?)",
                             (now, gid, json.dumps(msg)))
                sent_at = datetime.fromtimestamp(int(msg.get("timestamp", 0)), timezone.utc).isoformat()
                sender = names.get(msg.get("from"))
                text = _text(msg)
                conn.execute("INSERT OR IGNORE INTO wa_messages VALUES (?,?,?,?,?,?,?,?)",
                             (msg["id"], gid, gname, msg.get("from"), sender, sent_at, msg.get("type", "text"), text))
                _participant(gid, msg.get("from"), sender)
                db.index(f"whatsapp:{msg['id']}", "whatsapp", f"WhatsApp: {gname or gid}", text,
                         f"{sender or ''} ({msg.get('from')})", "", sent_at)
                stored += 1
    conn.commit()
    return {"stored": stored, "dropped": dropped, "direct_dropped": direct_dropped}


def load_participants(data) -> int:
    """Organiser group metadata: [{"group_id"|"id", "name", "participants": [{"wa_id"|"phone", "name"}]}]."""
    groups = data.get("groups", data) if isinstance(data, dict) else data
    n = 0
    for g in groups:
        cfg = selected(g.get("group_id") or g.get("id"), g.get("name") or g.get("subject"))
        if not cfg:
            continue
        gid = g.get("group_id") or g.get("id") or cfg.get("id")
        for p in g.get("participants", []):
            _participant(gid, p.get("wa_id") or p.get("phone") or p.get("number"), p.get("name"))
        n += 1
    conn.commit()
    return n


def groups() -> list[dict]:
    """Every selected group with its participants and messages."""
    out = []
    for g in settings.selected_groups():
        rows = conn.execute("SELECT * FROM wa_messages WHERE group_id = ? OR (group_name IS NOT NULL AND lower(group_name) = lower(?)) "
                            "ORDER BY sent_at", (g.get("id") or "", g.get("name") or "")).fetchall()
        gid = g.get("id") or (rows[0]["group_id"] if rows else f"name:{g.get('name')}")
        parts = conn.execute("SELECT wa_id, name FROM wa_participants WHERE group_id = ? ORDER BY name", (gid,)).fetchall()
        out.append({"group_id": gid, "name": g.get("name") or (rows[0]["group_name"] if rows else gid),
                    "participants": [dict(p) for p in parts], "messages": [dict(r) for r in rows]})
    return out
