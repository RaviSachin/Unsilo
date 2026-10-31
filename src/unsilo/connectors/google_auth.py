"""Google OAuth (authorization code flow) with state validation and token refresh.

Only gmail.readonly and drive.readonly are ever requested. The token is stored in data/ (gitignored).
"""
from __future__ import annotations

import json
import secrets

from google.auth.transport.requests import Request
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow

from ..config import GOOGLE_SCOPES, settings

_pending: dict[str, str] = {}  # state -> PKCE code verifier, for the one sign-in in flight


def _client_config() -> dict:
    if not settings.google_client_id or not settings.google_client_secret:
        raise RuntimeError("GOOGLE_CLIENT_ID / GOOGLE_CLIENT_SECRET are not set in .env")
    return {
        "web": {
            "client_id": settings.google_client_id,
            "client_secret": settings.google_client_secret,
            "auth_uri": "https://accounts.google.com/o/oauth2/auth",
            "token_uri": "https://oauth2.googleapis.com/token",
            "redirect_uris": [settings.google_redirect_uri],
        }
    }


def authorization_url() -> str:
    state = secrets.token_urlsafe(24)
    flow = Flow.from_client_config(_client_config(), scopes=GOOGLE_SCOPES, state=state)
    flow.redirect_uri = settings.google_redirect_uri
    url, _ = flow.authorization_url(access_type="offline", prompt="consent", include_granted_scopes="false")
    _pending[state] = flow.code_verifier or ""
    return url


def handle_callback(code: str, state: str) -> Credentials:
    if state not in _pending:
        raise PermissionError("OAuth state mismatch: start the sign-in again")
    verifier = _pending.pop(state)
    flow = Flow.from_client_config(_client_config(), scopes=GOOGLE_SCOPES, state=state)
    flow.redirect_uri = settings.google_redirect_uri
    if verifier:
        flow.code_verifier = verifier
    flow.fetch_token(code=code)
    creds = flow.credentials
    granted = set(creds.granted_scopes or creds.scopes or [])
    extra = granted - set(GOOGLE_SCOPES)
    if extra:
        raise PermissionError(f"Unexpected scopes granted: {sorted(extra)}")
    _save(creds)
    return creds


def _save(creds: Credentials) -> None:
    settings.token_path.parent.mkdir(parents=True, exist_ok=True)
    settings.token_path.write_text(creds.to_json(), encoding="utf-8")


def load_credentials() -> Credentials | None:
    """Returns valid credentials, refreshing the access token if it expired. None if not signed in."""
    if not settings.token_path.exists():
        return None
    info = json.loads(settings.token_path.read_text(encoding="utf-8"))
    creds = Credentials.from_authorized_user_info(info, GOOGLE_SCOPES)
    if creds.expired and creds.refresh_token:
        creds.refresh(Request())
        _save(creds)
    return creds


def is_connected() -> bool:
    try:
        return load_credentials() is not None
    except Exception:
        return False
