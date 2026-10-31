"""Write outputs/whatsapp_output.json, gmail_output.json, drive_output.json.

The organiser shares the exact JSON schemas in the access guide. When they arrive, change only the
`*_payload` functions below; everything upstream stays the same.
"""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone

from . import db
from .config import settings
from .connectors import drive, gmail, whatsapp
from .analysis.gmail_triage import find_unanswered


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def whatsapp_payload(conn: sqlite3.Connection) -> dict:
    interp = db.load_analysis(conn, "wa_interpretation")
    groups = []
    for g in whatsapp.load_groups(conn):
        groups.append({
            "group_id": g["group_id"],
            "group_name": g["name"],
            "participants": [{"name": p["name"], "number": p["wa_id"]} for p in g["participants"]],
            "messages": [{"message_id": m["message_id"], "sender_name": m["sender_name"], "sender_number": m["sender_id"],
                          "timestamp": m["sent_at"], "type": m["type"], "text": m["text"]} for m in g["messages"]],
            "interpretation": interp.get(g["group_id"], {}),
        })
    return {"generated_at": _now(), "selected_groups": [x["name"] or x["id"] for x in settings.selected_groups()],
            "groups": groups}


def gmail_payload(conn: sqlite3.Connection) -> dict:
    emails = gmail.load_emails(conn)
    teams = db.load_analysis(conn, "email_team")
    atts = db.load_analysis(conn, "email_attachment")
    unanswered = find_unanswered(emails)
    return {
        "generated_at": _now(),
        "reference_date": settings.reference_date.date().isoformat(),
        "emails": [{
            "message_id": e["message_id"], "thread_id": e["thread_id"], "from": e["from_addr"],
            "subject": e["subject"], "date": e["sent_at"],
            "classification": teams.get(e["message_id"], {}).get("team"),
            "classification_reason": teams.get(e["message_id"], {}).get("reason"),
            "important_attachment": atts.get(e["message_id"], {}).get("flagged", False),
            "attachment_flags": atts.get(e["message_id"], {}).get("attachments", []),
        } for e in emails],
        "unanswered": unanswered,
        "important_attachments": [
            {"message_id": mid, "subject": next((e["subject"] for e in emails if e["message_id"] == mid), ""), **a}
            for mid, r in atts.items() for a in r.get("attachments", [])
        ],
    }


def drive_payload(conn: sqlite3.Connection) -> dict:
    cats = db.load_analysis(conn, "drive_category")
    return {"generated_at": _now(), "documents": [{
        "file_id": d["file_id"], "name": d["name"], "mime_type": d["mime_type"], "url": d["web_url"],
        "category": cats.get(d["file_id"], {}).get("category"),
        "reason": cats.get(d["file_id"], {}).get("reason"),
        "extraction_error": d["extract_error"],
    } for d in drive.load_documents(conn)]}


def write_all(conn: sqlite3.Connection) -> list[str]:
    settings.output_dir.mkdir(parents=True, exist_ok=True)
    written = []
    for name, fn in (("whatsapp_output.json", whatsapp_payload), ("gmail_output.json", gmail_payload),
                     ("drive_output.json", drive_payload)):
        path = settings.output_dir / name
        path.write_text(json.dumps(fn(conn), indent=2, ensure_ascii=False), encoding="utf-8")
        written.append(str(path))
    return written
