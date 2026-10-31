"""One small wrapper around the LLM so the rest of the code never cares which provider is used.

`json_call(system, user, schema)` returns a dict that matches `schema`, or None when no LLM is
configured or the call fails. Every caller has a rule-based fallback for None, so the pipeline
always produces output even with no key or no network.
"""
from __future__ import annotations

import json
import logging
import os

from .config import settings

log = logging.getLogger(__name__)

_client = None


def provider() -> str:
    p = settings.llm_provider
    if p == "anthropic" and not os.getenv("ANTHROPIC_API_KEY"):
        return "none"
    if p == "openai" and not os.getenv("OPENAI_API_KEY"):
        return "none"
    return p if p in {"anthropic", "openai"} else "none"


def _get_client():
    global _client
    if _client is None:
        if provider() == "anthropic":
            import anthropic

            _client = anthropic.Anthropic()
        elif provider() == "openai":
            import openai

            _client = openai.OpenAI()
    return _client


def json_call(system: str, user: str, schema: dict, *, effort: str = "low", max_tokens: int = 4000) -> dict | None:
    p = provider()
    if p == "none":
        return None
    try:
        if p == "anthropic":
            return _anthropic_json(system, user, schema, effort, max_tokens)
        return _openai_json(system, user, schema, max_tokens)
    except Exception as exc:  # never let one bad call stop a whole sync
        log.warning("LLM call failed (%s): %s", p, type(exc).__name__)
        return None


def _anthropic_json(system: str, user: str, schema: dict, effort: str, max_tokens: int) -> dict | None:
    client = _get_client()
    response = client.messages.create(
        model=settings.anthropic_model,
        max_tokens=max_tokens,
        system=system,
        messages=[{"role": "user", "content": user}],
        output_config={"effort": effort, "format": {"type": "json_schema", "schema": schema}},
        # If a safety classifier declines, the API retries on Anthropic's recommended fallback model.
        extra_headers={"anthropic-beta": "server-side-fallback-2026-07-01"},
        extra_body={"fallbacks": "default"},
    )
    if response.stop_reason == "refusal":
        log.warning("LLM declined the request")
        return None
    text = next((b.text for b in response.content if b.type == "text"), None)
    return json.loads(text) if text else None


def _openai_json(system: str, user: str, schema: dict, max_tokens: int) -> dict | None:
    client = _get_client()
    response = client.chat.completions.create(
        model=settings.openai_model,
        max_completion_tokens=max_tokens,
        messages=[{"role": "system", "content": system}, {"role": "user", "content": user}],
        response_format={"type": "json_schema", "json_schema": {"name": "result", "schema": schema, "strict": True}},
    )
    text = response.choices[0].message.content
    return json.loads(text) if text else None
