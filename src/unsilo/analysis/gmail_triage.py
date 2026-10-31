"""Task 2: team classification, unanswered mail (5+ days), business-critical attachments."""
from __future__ import annotations

import sqlite3
from datetime import datetime

from .. import db, llm
from ..config import settings
from . import rules

TEAMS = ["sales", "marketing", "other"]
BATCH = 12

SYSTEM = (
    "You label emails for an Indian equipment-rental company. For each email choose exactly one team:\n"
    "- sales: customer enquiries, quotations, rental bookings, orders, pricing, negotiations, deliveries, "
    "customer payments and invoices tied to a deal.\n"
    "- marketing: campaigns, social media, brand, events, newsletters, ads, agencies, content.\n"
    "- other: HR, IT, internal admin, vendors unrelated to selling, system notifications, spam.\n"
    "Give a short reason that quotes the deciding words."
)

TEAM_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "team": {"type": "string", "enum": TEAMS},
                    "reason": {"type": "string"},
                },
                "required": ["id", "team", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}


def _email_brief(e: dict) -> str:
    atts = ", ".join(a["filename"] for a in e["attachments"]) or "none"
    return (f'<email id="{e["message_id"]}">\nFrom: {e["from_name"]} <{e["from_addr"]}>\n'
            f'Subject: {e["subject"]}\nAttachments: {atts}\n{e["body"][:1500]}\n</email>')


def classify_teams(emails: list[dict]) -> dict[str, dict]:
    results: dict[str, dict] = {}
    for i in range(0, len(emails), BATCH):
        chunk = emails[i:i + BATCH]
        out = llm.json_call(SYSTEM, "\n\n".join(_email_brief(e) for e in chunk), TEAM_SCHEMA)
        for item in (out or {}).get("items", []):
            results[item["id"]] = {"team": item["team"], "reason": item["reason"], "method": "llm"}
    for e in emails:  # rule fallback for anything the LLM skipped
        if e["message_id"] not in results:
            text = f'{e["subject"]} {e["body"]} {" ".join(a["filename"] for a in e["attachments"])}'
            if rules.is_automated(e["from_addr"]):
                team, reason = "other", f'automated sender {e["from_addr"]}'
            else:
                team, hits = rules.best_label(text, rules.EMAIL_TEAMS, "other")
                reason = f'keywords: {", ".join(hits)}' if hits else "no sales or marketing signals"
            results[e["message_id"]] = {"team": team, "reason": reason, "method": "rules"}
    return results


def _is_ours(addr: str) -> bool:
    return bool(settings.sandbox_email) and addr.lower() == settings.sandbox_email


def find_unanswered(emails: list[dict], reference: datetime | None = None, days: int | None = None) -> list[dict]:
    """Inbound emails with no later message from the sandbox account in the same thread, aged >= `days`."""
    reference = reference or settings.reference_date
    days = settings.unanswered_days if days is None else days
    by_thread: dict[str, list[dict]] = {}
    for e in emails:
        by_thread.setdefault(e["thread_id"], []).append(e)

    out = []
    for e in emails:
        if _is_ours(e["from_addr"]) or "SENT" in e["label_ids"] or "DRAFT" in e["label_ids"]:
            continue
        sent = datetime.fromisoformat(e["sent_at"])
        if sent > reference:
            continue
        replied = any(
            (_is_ours(o["from_addr"]) or "SENT" in o["label_ids"]) and datetime.fromisoformat(o["sent_at"]) > sent
            for o in by_thread[e["thread_id"]]
        )
        age = (reference - sent).days
        if not replied and age >= days:
            out.append({"message_id": e["message_id"], "thread_id": e["thread_id"], "from": e["from_addr"],
                        "subject": e["subject"], "received_at": e["sent_at"], "days_without_reply": age})
    return sorted(out, key=lambda x: -x["days_without_reply"])


ATT_SYSTEM = (
    "Decide whether each email attachment is business-critical. Critical kinds: invoice, purchase order, "
    "quotation, contract, KYC/verification document (PAN, Aadhaar, GST, ID, certificates). Logos, signatures, "
    "photos, brochures and newsletters are not critical. Reason must name the evidence (filename or content)."
)

ATT_SCHEMA = {
    "type": "object",
    "properties": {
        "items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "critical": {"type": "boolean"},
                    "kind": {"type": "string", "enum": ["invoice", "purchase order", "quotation", "contract",
                                                        "KYC/verification", "none"]},
                    "reason": {"type": "string"},
                },
                "required": ["id", "critical", "kind", "reason"],
                "additionalProperties": False,
            },
        }
    },
    "required": ["items"],
    "additionalProperties": False,
}


def flag_attachments(emails: list[dict]) -> dict[str, dict]:
    """Per email: {"flagged": bool, "attachments": [{filename, kind, reason}]}."""
    candidates = [(e, a) for e in emails for a in e["attachments"]]
    llm_verdicts: dict[str, dict] = {}
    for i in range(0, len(candidates), BATCH):
        chunk = candidates[i:i + BATCH]
        prompt = "\n\n".join(
            f'<attachment id="{e["message_id"]}|{a["filename"]}">\nEmail subject: {e["subject"]}\n'
            f'Filename: {a["filename"]} ({a["mime_type"]})\nContent start: {a.get("text", "")[:800]}\n</attachment>'
            for e, a in chunk
        )
        out = llm.json_call(ATT_SYSTEM, prompt, ATT_SCHEMA)
        for item in (out or {}).get("items", []):
            llm_verdicts[item["id"]] = item

    results: dict[str, dict] = {}
    for e in emails:
        flagged = []
        for a in e["attachments"]:
            v = llm_verdicts.get(f'{e["message_id"]}|{a["filename"]}')
            if v is not None:
                if v["critical"]:
                    flagged.append({"filename": a["filename"], "kind": v["kind"], "reason": v["reason"]})
                continue
            kind, evidence = rules.attachment_kind(a["filename"], a.get("text", ""))
            if kind:
                flagged.append({"filename": a["filename"], "kind": kind,
                                "reason": f"Looks like a {kind}: {evidence}."})
        results[e["message_id"]] = {"flagged": bool(flagged), "attachments": flagged}
    return results


def run(conn: sqlite3.Connection, emails: list[dict]) -> dict:
    teams = classify_teams(emails)
    unanswered = find_unanswered(emails)
    attachments = flag_attachments(emails)
    pending = {u["message_id"]: u["days_without_reply"] for u in unanswered}
    with db.tx(conn):
        for e in emails:
            mid = e["message_id"]
            db.save_analysis(conn, "email_team", mid, teams[mid])
            db.save_analysis(conn, "email_attachment", mid, attachments[mid])
            labels = [f'team {teams[mid]["team"]}', f'{teams[mid]["team"]} email']
            if mid in pending:
                labels.append(f"unanswered pending reply no reply for {pending[mid]} days")
            for a in attachments[mid]["attachments"]:
                labels.append(f'important attachment {a["kind"]}')
            db.set_labels(conn, f"gmail:{mid}", " | ".join(labels))
    return {"teams": teams, "unanswered": unanswered, "attachments": attachments}
