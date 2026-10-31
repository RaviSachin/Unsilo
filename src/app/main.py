"""Unsilo API + web UI. Run from src/: uvicorn app.main:app --port 8000, then open http://localhost:8000"""
import json
import logging
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import analyse, ask, export, google, settings, whatsapp
from . import db
from .db import conn

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(name)s: %(message)s")
log = logging.getLogger("unsilo")
app = FastAPI(title="Unsilo")

# One readable summary in the terminal at startup (names only, never values).
log.info("AI: %s | Google OAuth: %s | Drive: %s | selected groups: %d",
         "gemini" if settings.ai_enabled() else "keyword rules",
         "configured" if settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET else "missing",
         google.drive_mode(), len(settings.selected_groups()))
for problem in settings.setup_problems():
    log.warning("setup: %s", problem["text"])


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    """Show the cause in the UI instead of a bare 500; the full traceback still goes to the terminal."""
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": f"Server error: {type(exc).__name__}: {exc}"})
WEB = settings.ROOT / "web"


@app.get("/api/health")
def health():
    count = lambda sql: conn.execute(sql).fetchone()[0]  # noqa: E731
    return {"ok": True, "ai": "gemini" if settings.ai_enabled() else "keyword rules",
            "google_configured": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
            "google_connected": google.connected(), "drive_mode": google.drive_mode(),
            "selected_groups": len(settings.selected_groups()),
            "reference_date": settings.reference_date().date().isoformat(), "setup": settings.setup_problems(),
            "counts": {"emails": count("SELECT COUNT(*) FROM emails"), "documents": count("SELECT COUNT(*) FROM documents"),
                       "whatsapp_messages": count("SELECT COUNT(*) FROM wa_messages")}}


# --- Google --------------------------------------------------------------------------------------

@app.get("/api/oauth/google/start")
def oauth_start():
    try:
        return RedirectResponse(google.auth_url())
    except RuntimeError as exc:
        raise HTTPException(400, str(exc))


@app.get("/api/oauth/google/callback")
def oauth_callback(code: str = "", state: str = "", error: str = ""):
    if error or not code:
        return RedirectResponse(f"/?google_error={quote(error or 'no code returned')}")
    try:
        google.finish_auth(code, state)
    except Exception as exc:  # show the reason on the page instead of a bare error
        log.warning("Google sign-in failed: %s", exc)
        return RedirectResponse(f"/?google_error={quote(str(exc)[:200])}")
    return RedirectResponse("/?google=connected")


@app.post("/api/sync/{source}")
def sync(source: str):
    try:
        if source == "gmail":
            n = google.sync_gmail()
            analyse.analyse_gmail()
        elif source == "drive":
            n = google.sync_drive()
            analyse.analyse_drive()
        else:
            raise HTTPException(404, "Use gmail or drive (WhatsApp arrives by webhook)")
    except RuntimeError as exc:
        raise HTTPException(409, str(exc))
    return {"source": source, "imported": n}


@app.post("/api/analyse")
def analyse_all():
    return analyse.analyse_all()


# --- Ask + outputs -------------------------------------------------------------------------------

class Question(BaseModel):
    question: str


@app.post("/api/ask")
def ask_route(body: Question):
    if not body.question.strip():
        raise HTTPException(400, "Question is empty")
    return ask.answer(body.question.strip())


OUTPUTS = {"whatsapp": export.whatsapp_output, "gmail": export.gmail_output, "drive": export.drive_output}


@app.get("/api/outputs/{name}")
def output(name: str):
    if name not in OUTPUTS:
        raise HTTPException(404, "Use whatsapp, gmail or drive")
    return OUTPUTS[name]()


@app.post("/api/export")
def export_all():
    analyse.analyse_all()
    return {"written": export.write_all()}


# --- WhatsApp ------------------------------------------------------------------------------------

@app.get("/api/webhooks/whatsapp")
def verify(mode: str = Query("", alias="hub.mode"), token: str = Query("", alias="hub.verify_token"),
           challenge: str = Query("", alias="hub.challenge")):
    if mode == "subscribe" and token and token == settings.WHATSAPP_VERIFY_TOKEN:
        return PlainTextResponse(challenge)
    raise HTTPException(403, "verification failed (a plain browser visit is expected to fail)")


@app.post("/api/webhooks/whatsapp")
async def receive(request: Request):
    body = await request.body()
    if not whatsapp.signature_ok(body, request.headers.get("x-hub-signature-256")):
        raise HTTPException(401, "bad signature")
    try:
        payload = json.loads(body)
    except ValueError:
        raise HTTPException(400, "not JSON")
    result = whatsapp.ingest(payload)
    log.info("whatsapp webhook stored=%s dropped=%s", result["stored"], result["dropped"])  # counts only
    return {"ok": True}


@app.get("/api/whatsapp/groups")
def wa_groups():
    interp = db.results("wa_interpretation")
    return [{**g, "interpretation": interp.get(g["group_id"], {})} for g in whatsapp.groups()]


@app.post("/api/whatsapp/participants")
async def wa_participants(request: Request):
    """Organiser group metadata (participants list)."""
    return {"groups_loaded": whatsapp.load_participants(await request.json())}


# --- Web UI --------------------------------------------------------------------------------------



@app.middleware("http")
async def no_stale_ui(request: Request, call_next):
    """Always serve the latest UI files, so an old app.js is never mixed with a new backend."""
    response = await call_next(request)
    if request.url.path == "/" or request.url.path.startswith("/static/"):
        response.headers["Cache-Control"] = "no-store"
    return response


app.mount("/static", StaticFiles(directory=WEB), name="static")


@app.get("/")
def home():
    return FileResponse(WEB / "index.html")
