"""Google Drive connector (drive.readonly). Lists files and extracts their text.

Google Docs -> exported as text/plain, Sheets -> CSV (first sheet) and also XLSX for all sheets,
PDF / Word / Excel -> downloaded and parsed locally. Only files.list / get / export are called.
"""
from __future__ import annotations

import io
import logging
import sqlite3

from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from .. import db
from ..config import settings
from ..extract import XLSX, extract_text
from . import google_auth

log = logging.getLogger(__name__)

GDOC = "application/vnd.google-apps.document"
GSHEET = "application/vnd.google-apps.spreadsheet"
GSLIDES = "application/vnd.google-apps.presentation"
FOLDER = "application/vnd.google-apps.folder"


def _service():
    creds = google_auth.load_credentials()
    if creds is None:
        raise RuntimeError("Google is not connected: open /api/oauth/google/start first")
    return build("drive", "v3", credentials=creds, cache_discovery=False)


def _list(svc, folder_id: str | None) -> list[dict]:
    """All non-trashed files, walking sub-folders when a folder is given."""
    fields = "nextPageToken, files(id, name, mimeType, modifiedTime, webViewLink, size)"
    out, queue = [], [folder_id] if folder_id else [None]
    while queue:
        parent = queue.pop()
        q = "trashed = false" + (f" and '{parent}' in parents" if parent else "")
        token = None
        while True:
            page = svc.files().list(q=q, fields=fields, pageSize=200, pageToken=token,
                                    supportsAllDrives=True, includeItemsFromAllDrives=True).execute()
            for f in page.get("files", []):
                if f["mimeType"] == FOLDER:
                    if parent:  # only recurse when scoped to a folder
                        queue.append(f["id"])
                else:
                    out.append(f)
            token = page.get("nextPageToken")
            if not token:
                break
    return out


def _download(request) -> bytes:
    buf = io.BytesIO()
    downloader = MediaIoBaseDownload(buf, request)
    done = False
    while not done:
        _, done = downloader.next_chunk()
    return buf.getvalue()


def _file_text(svc, f: dict) -> str:
    mime = f["mimeType"]
    if mime == GDOC:
        return _download(svc.files().export_media(fileId=f["id"], mimeType="text/plain")).decode("utf-8", "replace")
    if mime == GSHEET:
        return extract_text(_download(svc.files().export_media(fileId=f["id"], mimeType=XLSX)), XLSX)
    if mime == GSLIDES:
        return _download(svc.files().export_media(fileId=f["id"], mimeType="text/plain")).decode("utf-8", "replace")
    return extract_text(_download(svc.files().get_media(fileId=f["id"], supportsAllDrives=True)), mime, f["name"])


def fetch_all() -> list[dict]:
    svc = _service()
    docs = []
    for f in _list(svc, settings.drive_folder_id or None):
        doc = {"file_id": f["id"], "name": f["name"], "mime_type": f["mimeType"],
               "modified_at": f.get("modifiedTime", ""), "web_url": f.get("webViewLink", ""),
               "text": "", "extract_error": None}
        try:
            doc["text"] = _file_text(svc, f)
        except Exception as exc:
            doc["extract_error"] = f"{type(exc).__name__}: {exc}"[:300]
        docs.append(doc)
    return docs


def store(conn: sqlite3.Connection, docs: list[dict]) -> int:
    with db.tx(conn):
        for d in docs:
            conn.execute(
                """INSERT INTO documents (file_id, name, mime_type, modified_at, web_url, text, extract_error)
                   VALUES (?,?,?,?,?,?,?)
                   ON CONFLICT(file_id) DO UPDATE SET name=excluded.name, text=excluded.text,
                     modified_at=excluded.modified_at, extract_error=excluded.extract_error""",
                (d["file_id"], d["name"], d["mime_type"], d["modified_at"], d["web_url"], d["text"], d["extract_error"]),
            )
            db.upsert_record(
                conn, provider="drive", external_id=d["file_id"], title=d["name"], body=d["text"] or "",
                source_url=d["web_url"], occurred_at=d["modified_at"], extra={"mime_type": d["mime_type"]},
            )
    return len(docs)


def load_documents(conn: sqlite3.Connection) -> list[dict]:
    return [dict(r) for r in conn.execute("SELECT * FROM documents ORDER BY name").fetchall()]
