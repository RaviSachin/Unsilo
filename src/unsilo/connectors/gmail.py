"""Gmail connector (gmail.readonly). Reads every message, parses headers, body and attachments.

Read-only by design: only users.messages.list / get and users.messages.attachments.get are called.
"""
from __future__ import annotations

import base64
import json
import logging
import sqlite3
from email.utils import getaddresses, parseaddr, parsedate_to_datetime
from datetime import timezone

from googleapiclient.discovery import build

from .. import db
from ..extract import extract_text
from . import google_auth

log = logging.getLogger(__name__)

MAX_ATTACHMENT_BYTES = 8 * 1024 * 1024


def _service():
    creds = google_auth.load_credentials()
    if creds is None:
        raise RuntimeError("Google is not connected: open /api/oauth/google/start first")
    return build("gmail", "v1", credentials=creds, cache_discovery=False)


def fetch_all(max_messages: int = 2000) -> list[dict]:
    """Returns normalized email dicts (same shape as fixtures/gmail.json)."""
    svc = _service()
    ids: list[str] = []
    request = svc.users().messages().list(userId="me", maxResults=500, includeSpamTrash=False)
    while request is not None and len(ids) < max_messages:
        page = request.execute()
        ids += [m["id"] for m in page.get("messages", [])]
        request = svc.users().messages().list_next(request, page)

    emails = []
    for mid in ids[:max_messages]:
        msg = svc.users().messages().get(userId="me", id=mid, format="full").execute()
        emails.append(normalize(msg, fetch_attachment=lambda att_id, m=mid: _attachment(svc, m, att_id)))
    return emails


def _attachment(svc, message_id: str, attachment_id: str) -> bytes:
    att = svc.users().messages().attachments().get(userId="me", messageId=message_id, id=attachment_id).execute()
    return base64.urlsafe_b64decode(att["data"])


def _decode(data: str) -> str:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", errors="replace")


def _walk(part: dict):
    yield part
    for child in part.get("parts", []) or []:
        yield from _walk(child)


def normalize(msg: dict, fetch_attachment=None) -> dict:
    """Gmail API message resource -> flat dict."""
    payload = msg.get("payload", {})
    headers = {h["name"].lower(): h["value"] for h in payload.get("headers", [])}
    from_name, from_addr = parseaddr(headers.get("from", ""))

    plain, html, attachments = [], [], []
    for part in _walk(payload):
        body = part.get("body", {}) or {}
        filename = part.get("filename") or ""
        mime = part.get("mimeType", "")
        if filename:
            text = ""
            if fetch_attachment and body.get("attachmentId") and body.get("size", 0) <= MAX_ATTACHMENT_BYTES:
                try:
                    text = extract_text(fetch_attachment(body["attachmentId"]), mime, filename)
                except Exception:
                    text = ""  # unsupported type (images etc.): the filename alone still gets judged
            attachments.append({"filename": filename, "mime_type": mime, "size": body.get("size", 0), "text": text})
        elif mime == "text/plain" and body.get("data"):
            plain.append(_decode(body["data"]))
        elif mime == "text/html" and body.get("data"):
            html.append(_decode(body["data"]))

    text = "\n".join(plain) or _strip_html("\n".join(html)) or msg.get("snippet", "")
    try:
        sent_at = parsedate_to_datetime(headers["date"]).astimezone(timezone.utc).isoformat()
    except Exception:
        from datetime import datetime

        sent_at = datetime.fromtimestamp(int(msg.get("internalDate", 0)) / 1000, timezone.utc).isoformat()

    return {
        "message_id": msg["id"],
        "thread_id": msg.get("threadId", msg["id"]),
        "from_addr": from_addr.lower(),
        "from_name": from_name,
        "to": [a.lower() for _, a in getaddresses([headers.get("to", "")]) if a],
        "cc": [a.lower() for _, a in getaddresses([headers.get("cc", "")]) if a],
        "subject": headers.get("subject", "(no subject)"),
        "body": text.strip(),
        "sent_at": sent_at,
        "label_ids": msg.get("labelIds", []),
        "attachments": attachments,
    }


def _strip_html(html: str) -> str:
    import re

    text = re.sub(r"(?is)<(script|style).*?</\1>", " ", html)
    text = re.sub(r"(?s)<br\s*/?>|</p>", "\n", text)
    text = re.sub(r"(?s)<[^>]+>", " ", text)
    return re.sub(r"[ \t]+", " ", text).strip()


def store(conn: sqlite3.Connection, emails: list[dict]) -> int:
    with db.tx(conn):
        for e in emails:
            conn.execute(
                """INSERT INTO emails (message_id, thread_id, from_addr, from_name, to_addrs, cc_addrs, subject, body,
                                       sent_at, label_ids, attachments)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?)
                   ON CONFLICT(message_id) DO UPDATE SET body=excluded.body, attachments=excluded.attachments,
                     label_ids=excluded.label_ids""",
                (e["message_id"], e["thread_id"], e["from_addr"], e["from_name"], json.dumps(e["to"]),
                 json.dumps(e["cc"]), e["subject"], e["body"], e["sent_at"], json.dumps(e["label_ids"]),
                 json.dumps(e["attachments"])),
            )
            att_names = ", ".join(a["filename"] for a in e["attachments"])
            body = e["body"] + (f"\n\nAttachments: {att_names}" if att_names else "")
            db.upsert_record(
                conn,
                provider="gmail",
                external_id=e["message_id"],
                title=e["subject"],
                body=body,
                sender=f'{e["from_name"]} <{e["from_addr"]}>',
                source_url=f'https://mail.google.com/mail/u/0/#all/{e["message_id"]}',
                occurred_at=e["sent_at"],
                extra={"thread_id": e["thread_id"], "to": e["to"]},
            )
    return len(emails)


def load_emails(conn: sqlite3.Connection) -> list[dict]:
    rows = conn.execute("SELECT * FROM emails ORDER BY sent_at").fetchall()
    return [
        {
            "message_id": r["message_id"], "thread_id": r["thread_id"], "from_addr": r["from_addr"],
            "from_name": r["from_name"], "to": json.loads(r["to_addrs"]), "cc": json.loads(r["cc_addrs"]),
            "subject": r["subject"], "body": r["body"], "sent_at": r["sent_at"],
            "label_ids": json.loads(r["label_ids"]), "attachments": json.loads(r["attachments"]),
        }
        for r in rows
    ]
