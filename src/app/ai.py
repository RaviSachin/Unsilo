"""Gemini over REST. json() returns a dict matching the schema, or None (then callers use keyword rules)."""
import json
import logging

import httpx

from . import settings

log = logging.getLogger(__name__)
URL = "https://generativelanguage.googleapis.com/v1beta/models/{}:generateContent"


def json_call(system: str, prompt: str, schema: dict, max_tokens: int = 8000) -> dict | None:
    if not settings.ai_enabled():
        return None
    body = {
        "systemInstruction": {"parts": [{"text": system}]},
        "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        "generationConfig": {"maxOutputTokens": max_tokens, "temperature": 0,
                             "responseMimeType": "application/json", "responseJsonSchema": schema,
                             "thinkingConfig": {"thinkingLevel": "low"}},
    }
    for model in settings.GEMINI_MODELS:
        try:
            r = httpx.post(URL.format(model), json=body, timeout=60,
                           headers={"x-goog-api-key": settings.GEMINI_API_KEY})
            if r.status_code == 400 and "thinking" in r.text.lower():  # model without thinking levels
                body["generationConfig"].pop("thinkingConfig", None)
                r = httpx.post(URL.format(model), json=body, timeout=60,
                               headers={"x-goog-api-key": settings.GEMINI_API_KEY})
        except httpx.HTTPError as exc:
            log.warning("Gemini %s unreachable: %s", model, type(exc).__name__)
            continue
        if r.status_code != 200:
            log.warning("Gemini %s returned %s", model, r.status_code)  # busy, quota or bad model: try the next
            continue
        try:
            parts = r.json()["candidates"][0]["content"]["parts"]
            return json.loads("".join(p.get("text", "") for p in parts if not p.get("thought")))
        except (KeyError, IndexError, ValueError):
            log.warning("Gemini %s gave an unreadable answer", model)
    return None


def obj(props: dict, required: list[str] | None = None) -> dict:
    """Small helper for JSON schemas."""
    return {"type": "object", "properties": props, "required": required or list(props), "additionalProperties": False}


STR = {"type": "string"}
STRS = {"type": "array", "items": STR}
