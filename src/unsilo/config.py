"""All settings come from environment variables (.env). Nothing secret lives in code."""
from __future__ import annotations

import json
import os
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path

from dotenv import load_dotenv

ROOT = Path(__file__).resolve().parents[2]
load_dotenv(ROOT / ".env")

# The only two Google scopes the rules allow. Do not add more.
GOOGLE_SCOPES = [
    "https://www.googleapis.com/auth/gmail.readonly",
    "https://www.googleapis.com/auth/drive.readonly",
]


def _env(name: str, default: str = "") -> str:
    return os.getenv(name, default).strip()


@dataclass
class Settings:
    google_client_id: str = field(default_factory=lambda: _env("GOOGLE_CLIENT_ID"))
    google_client_secret: str = field(default_factory=lambda: _env("GOOGLE_CLIENT_SECRET"))
    google_redirect_uri: str = field(
        default_factory=lambda: _env("GOOGLE_REDIRECT_URI", "http://localhost:8000/api/oauth/google/callback")
    )
    drive_folder_id: str = field(default_factory=lambda: _env("DRIVE_FOLDER_ID"))
    sandbox_email: str = field(default_factory=lambda: _env("SANDBOX_EMAIL").lower())

    whatsapp_verify_token: str = field(default_factory=lambda: _env("WHATSAPP_VERIFY_TOKEN"))
    meta_app_secret: str = field(default_factory=lambda: _env("META_APP_SECRET"))
    whatsapp_require_signature: bool = field(
        default_factory=lambda: _env("WHATSAPP_REQUIRE_SIGNATURE", "true").lower() == "true"
    )
    selected_groups_file: Path = field(
        default_factory=lambda: ROOT / _env("SELECTED_GROUPS_FILE", "config/selected_groups.json")
    )

    llm_provider: str = field(default_factory=lambda: _env("LLM_PROVIDER", "anthropic").lower())
    anthropic_model: str = field(default_factory=lambda: _env("ANTHROPIC_MODEL", "claude-opus-5-5"))
    openai_model: str = field(default_factory=lambda: _env("OPENAI_MODEL", "gpt-5.1"))

    reference_date_raw: str = field(default_factory=lambda: _env("REFERENCE_DATE"))
    unanswered_days: int = field(default_factory=lambda: int(_env("UNANSWERED_DAYS", "5")))
    database_path: Path = field(default_factory=lambda: ROOT / _env("DATABASE_PATH", "data/unsilo.db"))
    output_dir: Path = field(default_factory=lambda: ROOT / _env("OUTPUT_DIR", "outputs"))
    token_path: Path = field(default_factory=lambda: ROOT / "data" / "google_token.json")

    @property
    def reference_date(self) -> datetime:
        """End of the reference day in UTC. Kickoff announces it; default is now."""
        if self.reference_date_raw:
            d = date.fromisoformat(self.reference_date_raw)
            return datetime(d.year, d.month, d.day, 23, 59, 59, tzinfo=timezone.utc)
        return datetime.now(timezone.utc)

    def selected_groups(self) -> list[dict]:
        """Returns [{"id": ..., "name": ...}]. Plain strings in the file are treated as names."""
        if not self.selected_groups_file.exists():
            return []
        raw = json.loads(self.selected_groups_file.read_text(encoding="utf-8"))
        items = raw.get("selected_groups", raw) if isinstance(raw, dict) else raw
        groups = []
        for item in items:
            if isinstance(item, str):
                groups.append({"id": None, "name": item})
            else:
                groups.append({"id": item.get("id"), "name": item.get("name")})
        return groups


settings = Settings()
