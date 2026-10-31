"""FastAPI app. Run: uvicorn unsilo.api:app --reload --port 8000 (from src/), docs at /docs."""
from __future__ import annotations

import json
import logging

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import PlainTextResponse, RedirectResponse
from pydantic import BaseModel

from . import db, export, llm, pipeline
from .config import settings
from .connectors import google_auth, whatsapp
from .query.answer import ask

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("unsilo")

app = FastAPI(title="Unsilo API", version="0.1.0")
pipeline.apply_fixture_meta(db.get_conn())
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])


@app.get("/api/health")
def health():
    return {"ok": True, "llm": llm.provider(), "google_connected": google_auth.is_connected(),
            "selected_groups": len(settings.selected_groups())}


@app.get("/api/connections")
def connections():
    conn = db.get_conn()

    def count(sql: str) -> int:
        return conn.execute(sql).fetchone()[0]

    def last(provider: str):
        r = conn.execute("SELECT * FROM sync_runs WHERE provider=? ORDER BY id DESC LIMIT 1", (provider,)).fetchone()
        return dict(r) if r else None

    return [
        {"provider": "gmail", "connected": google_auth.is_connected(), "records": count("SELECT COUNT(*) FROM emails"),
         "last_sync": last("gmail")},
        {"provider": "drive", "connected": google_auth.is_connected(),
         "records": count("SELECT COUNT(*) FROM documents"), "last_sync": last("drive")},
        {"provider": "whatsapp", "connected": True, "records": count("SELECT COUNT(*) FROM wa_messages"),
         "groups": count("SELECT COUNT(*) FROM wa_groups")},
    ]


@app.get("/api/records")
def records(provider: str | None = None, q: str | None = None, limit: int = Query(50, le=500)):
    conn = db.get_conn()
    if q:
        from .query.retrieve import search

        hits, _ = search(conn, q, limit=limit)
        return [h.__dict__ for h in hits if not provider or h.provider == provider]
    sql, args = "SELECT source_id, provider, title, sender, occurred_at, source_url, labels FROM records", []
    if provider:
        sql += " WHERE provider = ?"
        args.append(provider)
    sql += " ORDER BY occurred_at DESC LIMIT ?"
    return [dict(r) for r in conn.execute(sql, (*args, limit)).fetchall()]


class AskBody(BaseModel):
    question: str


@app.post("/api/ask")
def ask_endpoint(body: AskBody):
    if not body.question.strip():
        raise HTTPException(400, "Question is empty")
    return ask(db.get_conn(), body.question.strip())


# --- Google OAuth -------------------------------------------------------------------------------

@app.get("/api/oauth/google/start")
def oauth_start():
    return RedirectResponse(google_auth.authorization_url())


@app.get("/api/oauth/google/callback")
def oauth_callback(code: str, state: str):
    try:
        google_auth.handle_callback(code, state)
    except PermissionError as exc:
        raise HTTPException(400, str(exc))
    return PlainTextResponse("Google connected (read-only). You can close this tab.")


# --- Sync / analysis / outputs ------------------------------------------------------------------

@app.post("/api/connections/{provider}/sync")
def sync(provider: str):
    conn = db.get_conn()
    try:
        result = pipeline.sync(conn, provider)
    except ValueError as exc:
        raise HTTPException(400, str(exc))
    except RuntimeError as exc:
        raise HTTPException(409, str(exc))
    result["analysis"] = pipeline.analyse(conn, {provider})
    return result


@app.get("/api/sync-runs/{run_id}")
def sync_run(run_id: int):
    r = db.get_conn().execute("SELECT * FROM sync_runs WHERE id = ?", (run_id,)).fetchone()
    if not r:
        raise HTTPException(404, "No such run")
    return dict(r)


@app.post("/api/analyse")
def analyse():
    return pipeline.analyse(db.get_conn())


@app.post("/api/export")
def export_outputs():
    conn = db.get_conn()
    pipeline.analyse(conn)
    return {"written": export.write_all(conn)}


@app.get("/api/outputs/{name}")
def outputs(name: str):
    fns = {"whatsapp": export.whatsapp_payload, "gmail": export.gmail_payload, "drive": export.drive_payload}
    if name not in fns:
        raise HTTPException(404, "Use whatsapp, gmail or drive")
    return fns[name](db.get_conn())


# --- WhatsApp webhook ---------------------------------------------------------------------------

@app.get("/api/webhooks/whatsapp")
def whatsapp_verify(mode: str = Query(alias="hub.mode", default=""),
                    token: str = Query(alias="hub.verify_token", default=""),
                    challenge: str = Query(alias="hub.challenge", default="")):
    if mode == "subscribe" and settings.whatsapp_verify_token and token == settings.whatsapp_verify_token:
        return PlainTextResponse(challenge)
    raise HTTPException(403, "Verification failed")


@app.post("/api/webhooks/whatsapp")
async def whatsapp_event(request: Request):
    raw = await request.body()
    if not whatsapp.verify_signature(raw, request.headers.get("x-hub-signature-256")):
        raise HTTPException(401, "Bad signature")
    try:
        payload = json.loads(raw)
    except json.JSONDecodeError:
        raise HTTPException(400, "Body is not JSON")
    result = whatsapp.ingest(db.get_conn(), payload)
    log.info("whatsapp webhook: stored=%s dropped=%s", result["stored"], result["dropped"])  # counts only
    return {"ok": True}


@app.post("/api/whatsapp/groups")
async def whatsapp_groups(request: Request):
    """Organiser-provided group metadata (participants)."""
    return {"groups_loaded": whatsapp.load_participants_file(db.get_conn(), await request.json())}
