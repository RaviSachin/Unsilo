"""Sync + analyse orchestration shared by the API and the CLI. Each run is logged in sync_runs."""
from __future__ import annotations

import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

from . import db
from .analysis import drive_classify, gmail_triage, whatsapp_interpret
from .config import ROOT, settings
from .connectors import drive, gmail, whatsapp

FIXTURES = ROOT / "fixtures"


def _start(conn, provider: str) -> int:
    cur = conn.execute("INSERT INTO sync_runs (provider, status, started_at) VALUES (?, 'running', ?)",
                       (provider, datetime.now(timezone.utc).isoformat()))
    conn.commit()
    return cur.lastrowid


def _finish(conn, run_id: int, status: str, count: int = 0, error: str | None = None) -> None:
    conn.execute("UPDATE sync_runs SET status=?, imported_count=?, error=?, finished_at=? WHERE id=?",
                 (status, count, error, datetime.now(timezone.utc).isoformat(), run_id))
    conn.commit()


def sync(conn: sqlite3.Connection, provider: str) -> dict:
    run_id = _start(conn, provider)
    try:
        if provider == "gmail":
            count = gmail.store(conn, gmail.fetch_all())
        elif provider == "drive":
            count = drive.store(conn, drive.fetch_all())
        else:
            raise ValueError(f"unknown provider {provider} (WhatsApp arrives by webhook, it is not pulled)")
        _finish(conn, run_id, "ok", count)
        return {"run_id": run_id, "status": "ok", "imported": count}
    except Exception as exc:
        _finish(conn, run_id, "error", error=f"{type(exc).__name__}: {exc}"[:500])
        raise


def analyse(conn: sqlite3.Connection, which: set[str] | None = None) -> dict:
    which = which or {"gmail", "drive", "whatsapp"}
    out = {}
    if "gmail" in which:
        r = gmail_triage.run(conn, gmail.load_emails(conn))
        out["gmail"] = {"emails": len(r["teams"]), "unanswered": len(r["unanswered"]),
                        "flagged_attachments": sum(1 for v in r["attachments"].values() if v["flagged"])}
    if "drive" in which:
        out["drive"] = {"documents": len(drive_classify.run(conn, drive.load_documents(conn)))}
    if "whatsapp" in which:
        out["whatsapp"] = {"groups": len(whatsapp_interpret.run(conn, whatsapp.load_groups(conn)))}
    return out


def apply_fixture_meta(conn: sqlite3.Connection) -> None:
    """When the database holds practice data, use its reference date unless .env sets one."""
    settings.reference_date_raw = settings.reference_date_raw or (db.kv_get(conn, "fixture_reference_date") or "")
    settings.sandbox_email = settings.sandbox_email or (db.kv_get(conn, "fixture_sandbox_email") or "")


def load_fixtures(conn: sqlite3.Connection, folder: Path = FIXTURES) -> dict:
    """Practice data that runs the whole pipeline offline. Clearly synthetic; never shown as live."""
    meta_file = folder / "meta.json"
    if meta_file.exists():  # fixture dates only make sense against their own reference date
        fixture_meta = json.loads(meta_file.read_text(encoding="utf-8"))
        db.kv_set(conn, "fixture_reference_date", fixture_meta["reference_date"])
        db.kv_set(conn, "fixture_sandbox_email", fixture_meta["sandbox_email"])
        apply_fixture_meta(conn)
    emails = json.loads((folder / "gmail.json").read_text(encoding="utf-8"))
    docs = json.loads((folder / "drive.json").read_text(encoding="utf-8"))
    gf = whatsapp.GroupFilter()
    wa = {"stored": 0, "dropped": 0}
    for line in (folder / "whatsapp_webhooks.jsonl").read_text(encoding="utf-8").splitlines():
        if line.strip():
            r = whatsapp.ingest(conn, json.loads(line), gf)
            wa["stored"] += r["stored"]
            wa["dropped"] += r["dropped"]
    meta = folder / "whatsapp_groups.json"
    if meta.exists():
        whatsapp.load_participants_file(conn, json.loads(meta.read_text(encoding="utf-8")), gf)
    return {"emails": gmail.store(conn, emails), "documents": drive.store(conn, docs), "whatsapp": wa}
