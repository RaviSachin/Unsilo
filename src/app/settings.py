"""Every setting comes from .env. Nothing secret is written in code."""
import json
import os
from datetime import date, datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env", override=True)  # .env wins over stale shell variables


def env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


# Only these two scopes are allowed by the rules.
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]
GOOGLE_CLIENT_ID = env("GOOGLE_CLIENT_ID")
GOOGLE_CLIENT_SECRET = env("GOOGLE_CLIENT_SECRET")
GOOGLE_REDIRECT_URI = env("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/oauth/google/callback")
SANDBOX_EMAIL = env("SANDBOX_EMAIL").lower()
DRIVE_API_KEY = env("DRIVE_API_KEY")


def _folder_id(raw: str) -> str:
    """Accepts a bare folder id or a full Drive link (…/folders/<id>?usp=sharing or …?id=<id>)."""
    import re

    m = re.search(r"/folders/([\w-]+)", raw) or re.search(r"[?&]id=([\w-]+)", raw)
    return m.group(1) if m else raw


DRIVE_FOLDER_ID = _folder_id(env("DRIVE_FOLDER_ID"))

WHATSAPP_VERIFY_TOKEN = env("WHATSAPP_VERIFY_TOKEN")
META_APP_SECRET = env("META_APP_SECRET")
REQUIRE_SIGNATURE = env("WHATSAPP_REQUIRE_SIGNATURE", "true").lower() == "true"
SELECTED_GROUPS_FILE = ROOT / env("SELECTED_GROUPS_FILE", "config/selected_groups.json")
# Testing only: the Meta test number gets 1:1 chats, never group messages. When true, direct chats are
# kept as one pseudo-group "Direct messages (test)". Keep false on judging day.
ALLOW_DIRECT = env("WHATSAPP_ALLOW_DIRECT", "false").lower() == "true"
DIRECT_GROUP = {"id": "direct", "name": "Direct messages (test)"}

LLM_PROVIDER = env("LLM_PROVIDER", "gemini").lower()
GEMINI_API_KEY = env("GEMINI_API_KEY")
GEMINI_MODELS = [m.strip() for m in env("GEMINI_MODEL", "gemini-3.5-flash,gemini-3.5-flash-lite,gemini-flash-latest").split(",") if m.strip()]

UNANSWERED_DAYS = int(env("UNANSWERED_DAYS", "5"))
DATABASE_PATH = str(ROOT / env("DATABASE_PATH", "data/unsilo.db"))
OUTPUT_DIR = ROOT / env("OUTPUT_DIR", "outputs")
TOKEN_FILE = ROOT / "data" / "google_token.json"


def reference_date() -> datetime:
    """End of the reference day (announced at kickoff), or now."""
    raw = env("REFERENCE_DATE")
    if raw:
        d = date.fromisoformat(raw)
        return datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=timezone.utc)
    return datetime.now(timezone.utc)


def selected_groups() -> list[dict]:
    """Groups from config/selected_groups.json (a missing or broken file means no real groups), plus the
    "Direct messages (test)" pseudo-group when WHATSAPP_ALLOW_DIRECT=true."""
    data = {}
    if SELECTED_GROUPS_FILE.exists():
        try:
            data = json.loads(SELECTED_GROUPS_FILE.read_text(encoding="utf-8")) or {}
        except ValueError:
            data = {}
    out = [g if isinstance(g, dict) else {"id": None, "name": g} for g in data.get("selected_groups", [])]
    out = [g for g in out if "PUT_GROUP" not in f"{g.get('id')}{g.get('name')}"]  # placeholders match nothing
    return out + ([DIRECT_GROUP] if ALLOW_DIRECT else [])


def real_groups() -> list[dict]:
    return [g for g in selected_groups() if g is not DIRECT_GROUP]


def ai_enabled() -> bool:
    return LLM_PROVIDER == "gemini" and bool(GEMINI_API_KEY)


def setup_problems() -> list[dict]:
    """What still blocks each source, in plain words for the UI and the startup log."""
    out = []
    if GOOGLE_CLIENT_ID and not GOOGLE_CLIENT_SECRET:
        out.append({"source": "gmail", "text": "GOOGLE_CLIENT_SECRET is empty. Copy the Client secret from Google Cloud "
                    "(Clients, Web client 1) into .env, so the Connect Google button appears."})
    elif not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET):
        out.append({"source": "gmail", "text": "Gmail needs GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET (an OAuth client). "
                    "Google does not accept API keys for Gmail, so GMAIL_API_KEY cannot be used."})
    if not (GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET) and not (DRIVE_API_KEY and DRIVE_FOLDER_ID):
        out.append({"source": "drive", "text": "Drive needs Connect Google, or DRIVE_API_KEY plus DRIVE_FOLDER_ID "
                    "(a folder shared as Anyone with the link)." + (" DRIVE_FOLDER_ID is empty." if DRIVE_API_KEY else "")})
    if not real_groups():
        out.append({"source": "whatsapp", "text": "config/selected_groups.json has no real group yet, so group messages are dropped. "
                    "Put the group id or name there" + (". Direct chats are kept for testing (WHATSAPP_ALLOW_DIRECT=true)."
                    if ALLOW_DIRECT else ", or set WHATSAPP_ALLOW_DIRECT=true to test with 1:1 chats to the test number.")})
    if not WHATSAPP_VERIFY_TOKEN:
        out.append({"source": "whatsapp", "text": "WHATSAPP_VERIFY_TOKEN is empty, so Meta cannot verify the webhook URL."})
    if not META_APP_SECRET and REQUIRE_SIGNATURE:
        out.append({"source": "whatsapp", "text": "META_APP_SECRET is empty, so every webhook POST is rejected (401). "
                    "Copy it from Meta app > App settings > Basic > App secret."})
    if not ai_enabled():
        out.append({"source": "ai", "text": "No GEMINI_API_KEY: labels use keyword rules and answers list records only."})
    if not env("REFERENCE_DATE"):
        out.append({"source": "dates", "text": "REFERENCE_DATE is empty, so today is used for 'unanswered 5+ days'."})
    if GOOGLE_CLIENT_ID and not SANDBOX_EMAIL:
        out.append({"source": "gmail", "text": "SANDBOX_EMAIL is empty. Set it to the Gmail address you connect, "
                    "so emails sent from it count as replies for 'unanswered 5+ days'."})
    return out
