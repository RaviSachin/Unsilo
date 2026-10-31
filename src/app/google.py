"""Google OAuth (read-only scopes) + Gmail and Drive connectors. Only list/get/export calls: nothing is modified."""
import base64
import json
import os
import re
import secrets
from datetime import datetime, timezone
from email.utils import getaddresses, parseaddr, parsedate_to_datetime

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseDownload

from . import db, settings
from .db import conn
from .extract import DOCX, PDF, XLSX, to_text

os.environ.setdefault("OAUTHLIB_RELAX_TOKEN_SCOPE", "1")  # Google may list scopes in another order
STATE_FILE = settings.TOKEN_FILE.parent / "oauth_state.json"  # on disk, so a --reload between start and callback is fine


def _load_states() -> dict[str, str]:
    try:
        return json.loads(STATE_FILE.read_text(encoding="utf-8"))
    except (OSError, ValueError):
        return {}


def _save_states(states: dict[str, str]) -> None:
    STATE_FILE.parent.mkdir(parents=True, exist_ok=True)
    STATE_FILE.write_text(json.dumps(dict(list(states.items())[-10:])), encoding="utf-8")


# --- OAuth ---------------------------------------------------------------------------------------

def _flow(state: str | None = None) -> Flow:
    if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET):
        raise RuntimeError("Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env (an API key can't read Gmail)")
    config = {"web": {"client_id": settings.GOOGLE_CLIENT_ID, "client_secret": settings.GOOGLE_CLIENT_SECRET,
                      "auth_uri": "https://accounts.google.com/o/oauth2/auth",
                      "token_uri": "https://oauth2.googleapis.com/token",
                      "redirect_uris": [settings.GOOGLE_REDIRECT_URI]}}
    flow = Flow.from_client_config(config, scopes=settings.GOOGLE_SCOPES, state=state)
    flow.redirect_uri = settings.GOOGLE_REDIRECT_URI
    return flow


def auth_url() -> str:
    state = secrets.token_urlsafe(24)
    flow = _flow(state)
    url, _ = flow.authorization_url(access_type="offline", prompt="consent")
    states = _load_states()
    states[state] = flow.code_verifier or ""
    _save_states(states)
    return url


def finish_auth(code: str, state: str) -> None:
    states = _load_states()
    if state not in states:
        raise PermissionError("Sign-in state did not match. Click Connect Google again.")
    flow = _flow(state)
    if states[state]:
        flow.code_verifier = states[state]
    del states[state]
    _save_states(states)
    flow.fetch_token(code=code)
    extra = set(flow.credentials.granted_scopes or []) - set(settings.GOOGLE_SCOPES)
    if extra:
        raise PermissionError(f"Unexpected scopes granted: {sorted(extra)}")
    settings.TOKEN_FILE.parent.mkdir(parents=True, exist_ok=True)
    settings.TOKEN_FILE.write_text(flow.credentials.to_json(), encoding="utf-8")


def credentials() -> Credentials | None:
    if not settings.TOKEN_FILE.exists():
        return None
    creds = Credentials.from_authorized_user_info(json.loads(settings.TOKEN_FILE.read_text()), settings.GOOGLE_SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        settings.TOKEN_FILE.write_text(creds.to_json(), encoding="utf-8")
    return creds


def connection_problem() -> str | None:
    """Why Google shows as off, in plain words (None when connected)."""
    if not (settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET):
        return None  # settings.setup_problems() already explains this
    if not settings.TOKEN_FILE.exists():
        return "Google is not connected yet. Open Sources and click Connect Google, then Sync Gmail / Sync Drive."
    try:
        creds = credentials()
    except Exception as exc:
        return (f"The saved Google sign-in no longer works ({type(exc).__name__}: {str(exc)[:120]}). "
                "Open Sources and click Connect Google again.")
    if creds is None or (creds.expired and not creds.refresh_token):
        return "The saved Google sign-in has expired. Open Sources and click Connect Google again."
    return None


def connected() -> bool:
    return settings.TOKEN_FILE.exists() and connection_problem() is None


# --- Gmail ---------------------------------------------------------------------------------------

def _decode(data: str) -> str:
    return base64.urlsafe_b64decode(data + "=" * (-len(data) % 4)).decode("utf-8", "replace")


def _parts(part: dict):
    yield part
    for child in part.get("parts") or []:
        yield from _parts(child)


def _strip_html(html: str) -> str:
    html = re.sub(r"(?is)<(script|style).*?</\1>", " ", html)
    html = re.sub(r"(?i)<br\s*/?>|</p>", "\n", html)
    return re.sub(r"[ \t]+", " ", re.sub(r"<[^>]+>", " ", html)).strip()


def sync_gmail(limit: int = 2000) -> int:
    creds = credentials()
    if not creds:
        raise RuntimeError("Google is not connected. Click 'Connect Google' first.")
    gm = build("gmail", "v1", credentials=creds, cache_discovery=False)
    ids, req = [], gm.users().messages().list(userId="me", maxResults=500)
    while req is not None and len(ids) < limit:
        page = req.execute()
        ids += [m["id"] for m in page.get("messages", [])]
        req = gm.users().messages().list_next(req, page)

    for mid in ids[:limit]:
        msg = gm.users().messages().get(userId="me", id=mid, format="full").execute()
        payload = msg.get("payload", {})
        h = {x["name"].lower(): x["value"] for x in payload.get("headers", [])}
        from_name, from_addr = parseaddr(h.get("from", ""))
        plain, html, atts = [], [], []
        for p in _parts(payload):
            body, mime, fname = p.get("body") or {}, p.get("mimeType", ""), p.get("filename") or ""
            if fname:
                text = ""
                if body.get("attachmentId") and body.get("size", 0) < 8_000_000:
                    try:
                        raw = gm.users().messages().attachments().get(userId="me", messageId=mid,
                                                                       id=body["attachmentId"]).execute()
                        text = to_text(base64.urlsafe_b64decode(raw["data"]), mime, fname)[:3000]
                    except Exception:
                        text = ""  # images and unknown types: the filename is still judged
                atts.append({"filename": fname, "mime_type": mime, "text": text})
            elif mime == "text/plain" and body.get("data"):
                plain.append(_decode(body["data"]))
            elif mime == "text/html" and body.get("data"):
                html.append(_decode(body["data"]))
        text = ("\n".join(plain) or _strip_html("\n".join(html)) or msg.get("snippet", "")).strip()
        try:
            sent = parsedate_to_datetime(h["date"]).astimezone(timezone.utc).isoformat()
        except Exception:
            sent = datetime.fromtimestamp(int(msg.get("internalDate", 0)) / 1000, timezone.utc).isoformat()
        to = [a.lower() for _, a in getaddresses([h.get("to", ""), h.get("cc", "")]) if a]
        conn.execute("INSERT OR REPLACE INTO emails VALUES (?,?,?,?,?,?,?,?,?,?)",
                     (mid, msg.get("threadId", mid), from_addr.lower(), from_name, json.dumps(to),
                      h.get("subject", "(no subject)"), text, sent, json.dumps(msg.get("labelIds", [])), json.dumps(atts)))
        names = ", ".join(a["filename"] for a in atts)
        db.index(f"gmail:{mid}", "gmail", h.get("subject", "(no subject)"),
                 text + (f"\nAttachments: {names}" if names else ""), f"{from_name} <{from_addr}>",
                 f"https://mail.google.com/mail/u/0/#all/{mid}", sent)
    conn.commit()
    return len(ids[:limit])


def emails() -> list[dict]:
    out = []
    for r in conn.execute("SELECT * FROM emails ORDER BY sent_at").fetchall():
        e = dict(r)
        e["to"], e["labels"], e["attachments"] = json.loads(e.pop("to_addrs")), json.loads(e["labels"]), json.loads(e["attachments"])
        out.append(e)
    return out


# --- Drive ---------------------------------------------------------------------------------------

def drive_mode() -> str:
    return "oauth" if connected() else ("api_key" if settings.DRIVE_API_KEY else "none")


def _drive():
    creds = credentials()
    if creds:
        return build("drive", "v3", credentials=creds, cache_discovery=False)
    if settings.DRIVE_API_KEY and settings.DRIVE_FOLDER_ID:
        return build("drive", "v3", developerKey=settings.DRIVE_API_KEY, cache_discovery=False)
    raise RuntimeError("Connect Google, or set DRIVE_API_KEY + DRIVE_FOLDER_ID (public folder)")


def _download(request) -> bytes:
    import io
    buf, done = io.BytesIO(), False
    dl = MediaIoBaseDownload(buf, request)
    while not done:
        _, done = dl.next_chunk()
    return buf.getvalue()


READABLE = {PDF, DOCX, XLSX, "text/plain", "text/csv", "text/markdown", "application/json"}
MAX_BYTES = 25 * 1024 * 1024


def _doc_text(dv, f: dict) -> str:
    """Text of Docs, Sheets, Slides, PDF, Word, Excel, CSV and text files. Others (videos, images) are kept by name only."""
    mime = f["mimeType"]
    if mime.startswith("application/vnd.google-apps.") and mime.split(".")[-1] not in ("document", "presentation", "spreadsheet"):
        return ""
    if not mime.startswith("application/vnd.google-apps.") and (mime not in READABLE or int(f.get("size") or 0) > MAX_BYTES):
        return ""
    if mime in ("application/vnd.google-apps.document", "application/vnd.google-apps.presentation"):
        return _download(dv.files().export_media(fileId=f["id"], mimeType="text/plain")).decode("utf-8", "replace")
    if mime == "application/vnd.google-apps.spreadsheet":
        return to_text(_download(dv.files().export_media(fileId=f["id"], mimeType=XLSX)), XLSX)
    return to_text(_download(dv.files().get_media(fileId=f["id"], supportsAllDrives=True)), mime, f["name"])


def sync_drive() -> int:
    dv = _drive()
    folders = [settings.DRIVE_FOLDER_ID] if settings.DRIVE_FOLDER_ID else [None]
    files = []
    while folders:
        parent = folders.pop()
        q = "trashed = false" + (f" and '{parent}' in parents" if parent else "")
        token = None
        while True:
            page = dv.files().list(q=q, pageSize=200, pageToken=token, supportsAllDrives=True,
                                   includeItemsFromAllDrives=True,
                                   fields="nextPageToken, files(id, name, mimeType, size, modifiedTime, webViewLink)").execute()
            for f in page.get("files", []):
                if f["mimeType"] == "application/vnd.google-apps.folder":
                    if parent:
                        folders.append(f["id"])
                else:
                    files.append(f)
            token = page.get("nextPageToken")
            if not token:
                break
    for f in files:
        text, error = "", None
        try:
            text = _doc_text(dv, f)
        except Exception as exc:
            error = f"{type(exc).__name__}: {exc}"[:200]
        conn.execute("INSERT OR REPLACE INTO documents VALUES (?,?,?,?,?,?,?)",
                     (f["id"], f["name"], f["mimeType"], f.get("modifiedTime", ""), f.get("webViewLink", ""), text, error))
        db.index(f"drive:{f['id']}", "drive", f["name"], text, "", f.get("webViewLink", ""), f.get("modifiedTime", ""))
    conn.commit()
    return len(files)


def documents() -> list[dict]:
    return [dict(r) for r in conn.execute("SELECT * FROM documents ORDER BY name").fetchall()]
