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
    if not SELECTED_GROUPS_FILE.exists():
        return []
    data = json.loads(SELECTED_GROUPS_FILE.read_text(encoding="utf-8"))
    return [g if isinstance(g, dict) else {"id": None, "name": g} for g in data.get("selected_groups", [])]


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
    groups = selected_groups()
    if not groups or all("PUT_GROUP" in f"{g.get('id')}{g.get('name')}" for g in groups):
        out.append({"source": "whatsapp", "text": "config/selected_groups.json still has the placeholder. "
                    "Put the real group id or name there, or every WhatsApp message is dropped."})
    if not (WHATSAPP_VERIFY_TOKEN and META_APP_SECRET):
        out.append({"source": "whatsapp", "text": "Set WHATSAPP_VERIFY_TOKEN and META_APP_SECRET for the webhook."})
    if not ai_enabled():
        out.append({"source": "ai", "text": "No GEMINI_API_KEY: labels use keyword rules and answers list records only."})
    if not env("REFERENCE_DATE"):
        out.append({"source": "dates", "text": "REFERENCE_DATE is empty, so today is used for 'unanswered 5+ days'."})
    return out
