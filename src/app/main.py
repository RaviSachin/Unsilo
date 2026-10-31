"""Unsilo API + web UI. Run from src/: uvicorn app.main:app --port 8000, then open http://localhost:8000"""
import json
import logging
from urllib.parse import quote

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import FileResponse, JSONResponse, PlainTextResponse, RedirectResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import analyse, ask, export, google, settings, views, whatsapp
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
for problem in settings.setup_problems() + ([{"text": google.connection_problem()}] if google.connection_problem() else []):
    log.warning("setup: %s", problem["text"])


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    """Show the cause in the UI instead of a bare 500; the full traceback still goes to the terminal."""
    log.exception("Unhandled error on %s", request.url.path)
    return JSONResponse(status_code=500, content={"detail": f"Server error: {type(exc).__name__}: {exc}"})
WEB = settings.ROOT / "web"
DIST = settings.ROOT / "frontend" / "dist"  # React build (npm run build); the classic UI stays at /classic
app.include_router(views.router)


WEBHOOK = {"last": None, "result": None, "calls": 0}  # in-memory, for the setup panel only
WEBHOOK_TUNNEL: dict = {}  # last tunnel URL tested from the UI


def _webhook_note() -> dict:
    if not WEBHOOK["calls"]:
        return {"source": "whatsapp", "text": "No WhatsApp webhook call has reached this server since it started. "
                "Meta is not calling the tunnel yet: publish the app (Live mode), switch on 'Subscribe webhooks' "
                "for the WhatsApp account, subscribe the 'messages' field, and keep cloudflared running."}
    return {"source": "whatsapp", "text": f"Last webhook call at {WEBHOOK['last']} UTC: {WEBHOOK['result']} "
            f"({WEBHOOK['calls']} calls since start)."}


def _setup() -> list[dict]:
    problems = settings.setup_problems()
    if not db.conn.execute("SELECT COUNT(*) FROM wa_messages").fetchone()[0]:
        problems.append(_webhook_note())
    reason = google.connection_problem()
    if reason:
        problems.insert(0, {"source": "gmail", "text": reason})
    return problems


@app.get("/api/health")
def health():
    count = lambda sql: conn.execute(sql).fetchone()[0]  # noqa: E731
    return {"ok": True, "ai": "gemini" if settings.ai_enabled() else "keyword rules",
            "google_configured": bool(settings.GOOGLE_CLIENT_ID and settings.GOOGLE_CLIENT_SECRET),
            "google_connected": google.connected(), "drive_mode": google.drive_mode(),
            "selected_groups": len(settings.selected_groups()),
            "reference_date": settings.reference_date().date().isoformat(), "setup": _setup(),
            "webhook": {**WEBHOOK, "tunnel": WEBHOOK_TUNNEL.get("base")},
            "whatsapp_direct": settings.ALLOW_DIRECT,
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
    from datetime import datetime, timezone
    WEBHOOK.update(calls=WEBHOOK["calls"] + 1, last=datetime.now(timezone.utc).strftime("%H:%M:%S"),
                   result="rejected, bad signature (check META_APP_SECRET)")
    if not whatsapp.signature_ok(body, request.headers.get("x-hub-signature-256")):
        log.warning("whatsapp webhook rejected: bad or missing signature. Check META_APP_SECRET is this app's App secret.")
        raise HTTPException(401, "bad signature")
    WEBHOOK["result"] = "signature ok, but the body was not JSON"
    try:
        payload = json.loads(body)
    except ValueError:
        raise HTTPException(400, "not JSON")
    result = whatsapp.ingest(payload)
    statuses = sum(len((c.get("value") or {}).get("statuses", [])) for e in payload.get("entry", []) for c in e.get("changes", []))
    WEBHOOK["result"] = (f"stored {result['stored']}, dropped {result['dropped']} "
                         f"(direct chats {result['direct_dropped']}), status updates {statuses}")
    log.info("whatsapp webhook stored=%s dropped=%s (direct chats=%s)", result["stored"], result["dropped"],
             result["direct_dropped"])  # counts only
    if result["direct_dropped"]:
        log.info("direct (1:1) chats are dropped; set WHATSAPP_ALLOW_DIRECT=true to keep them while testing")
    return {"ok": True}


class TunnelTest(BaseModel):
    base: str


@app.post("/api/webhooks/self-test")
def webhook_self_test(body: TunnelTest):
    """Calls our own webhook through the public tunnel exactly like Meta does: verify handshake, then a signed message."""
    import hashlib
    import hmac
    import time

    import httpx

    base = body.base.strip().rstrip("/")
    for suffix in ("/api/webhooks/whatsapp", "/api/webhooks", "/api"):
        if base.endswith(suffix):
            base = base[: -len(suffix)]
    if not base.startswith("https://"):
        raise HTTPException(400, "Paste the https:// tunnel URL that cloudflared printed (not localhost).")
    url = f"{base}/api/webhooks/whatsapp"
    WEBHOOK_TUNNEL["base"] = base
    steps = []

    def step(name: str, ok: bool, detail: str = "") -> None:
        steps.append({"name": name, "ok": ok, "detail": detail})

    step("WHATSAPP_VERIFY_TOKEN set", bool(settings.WHATSAPP_VERIFY_TOKEN), "" if settings.WHATSAPP_VERIFY_TOKEN else "add it to .env")
    step("META_APP_SECRET set", bool(settings.META_APP_SECRET), "" if settings.META_APP_SECRET else "add it to .env, every Meta POST is rejected without it")
    try:
        r = httpx.get(url, params={"hub.mode": "subscribe", "hub.verify_token": settings.WHATSAPP_VERIFY_TOKEN, "hub.challenge": "unsilo42"}, timeout=20)
        step("Tunnel reaches this server (verify handshake)", r.status_code == 200 and r.text == "unsilo42",
             "" if r.status_code == 200 else f"HTTP {r.status_code}: is cloudflared running and pointing at port 8000?")
    except httpx.HTTPError as exc:
        step("Tunnel reaches this server (verify handshake)", False, f"{type(exc).__name__}: tunnel URL wrong or cloudflared stopped")
        return {"url": url, "ok": False, "steps": steps}

    real = settings.real_groups()
    stamp = str(int(time.time()))
    msg = {"from": "910000000000", "id": f"wamid.selftest.{stamp}", "timestamp": stamp, "type": "text",
           "text": {"body": "Unsilo self-test: the webhook is working."}}
    if real:  # pretend it came from the first selected group so it is kept even with direct chats off
        msg["group_id"] = real[0].get("id") or ""
        if not msg["group_id"]:
            msg["group"] = {"subject": real[0].get("name")}
    payload = {"object": "whatsapp_business_account", "entry": [{"id": "SELFTEST", "changes": [{"field": "messages", "value": {
        "messaging_product": "whatsapp", "contacts": [{"profile": {"name": "Unsilo self-test"}, "wa_id": "910000000000"}],
        "messages": [msg]}}]}]}
    raw = json.dumps(payload).encode()
    sig = "sha256=" + hmac.new(settings.META_APP_SECRET.encode(), raw, hashlib.sha256).hexdigest()
    before = conn.execute("SELECT COUNT(*) FROM wa_messages").fetchone()[0]
    try:
        r = httpx.post(url, content=raw, headers={"Content-Type": "application/json", "X-Hub-Signature-256": sig}, timeout=20)
        step("Signed message accepted", r.status_code == 200,
             "" if r.status_code == 200 else ("401: META_APP_SECRET mismatch" if r.status_code == 401 else f"HTTP {r.status_code}"))
    except httpx.HTTPError as exc:
        step("Signed message accepted", False, type(exc).__name__)
    after = conn.execute("SELECT COUNT(*) FROM wa_messages").fetchone()[0]
    step("Message stored", after > before, "" if after > before else
         "dropped: add your group to config/selected_groups.json, or set WHATSAPP_ALLOW_DIRECT=true for testing")
    if after > before:
        analyse.analyse_whatsapp()
    ok = all(s["ok"] for s in steps)
    step("Next: Meta → WhatsApp → Configuration", ok, f"Callback URL {url}, then Verify and save, and subscribe the 'messages' field")
    return {"url": url, "ok": ok, "steps": steps}


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
if (DIST / "assets").exists():
    app.mount("/assets", StaticFiles(directory=DIST / "assets"), name="assets")


@app.get("/privacy")
@app.get("/terms")
@app.get("/data-deletion")
def legal():
    """Privacy policy, terms and data-deletion page for the Meta app settings (one page, three anchors)."""
    return FileResponse(WEB / "legal.html")


@app.get("/classic")
def classic():
    return FileResponse(WEB / "index.html")


@app.get("/")
def home(mode: str = Query("", alias="hub.mode"), token: str = Query("", alias="hub.verify_token"),
         challenge: str = Query("", alias="hub.challenge")):
    # Safety net: if Meta was given only the bare tunnel URL, answer its verification here too.
    if mode:
        log.info("Meta verification hit '/', the callback URL is missing /api/webhooks/whatsapp (handled anyway)")
        return verify(mode, token, challenge)
    return FileResponse(DIST / "index.html" if (DIST / "index.html").exists() else WEB / "index.html")


@app.post("/")
async def receive_at_root(request: Request):
    """Same safety net for message events posted to the bare tunnel URL."""
    return await receive(request)


@app.get("/{path:path}")
def spa(path: str):
    """React Router pages (/ask, /gmail, ...) and files in the build root (favicon, logo)."""
    if path.startswith("api/") or not (DIST / "index.html").exists():
        raise HTTPException(404, "Not found")
    file = (DIST / path).resolve()
    if file.is_file() and DIST.resolve() in file.parents:
        return FileResponse(file)
    return FileResponse(DIST / "index.html")
