"""Task 3: exactly one category per Drive document, with a one-line reason."""
from __future__ import annotations

import sqlite3

from .. import db, llm
from . import rules

CATEGORIES = ["sales", "marketing", "verification", "office", "accounts"]

SYSTEM = (
    "Categorise a company document into exactly one category:\n"
    "- sales: quotations, sales reports, orders, customer lists, price lists, rental agreements with customers.\n"
    "- marketing: campaign plans, brochures, social media calendars, brand guidelines, event plans.\n"
    "- verification: KYC, PAN, Aadhaar, GST certificates, ID/address proof, registration or licence documents.\n"
    "- office: HR policies, attendance, meeting minutes, SOPs, office admin, asset registers.\n"
    "- accounts: invoices, ledgers, expenses, P&L, balance sheets, payments, tax, payroll, bank statements.\n"
    "Judge by content first, filename second. Reason: one line naming the deciding evidence."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "category": {"type": "string", "enum": CATEGORIES},
        "reason": {"type": "string"},
    },
    "required": ["category", "reason"],
    "additionalProperties": False,
}


def classify(doc: dict) -> dict:
    prompt = f'Filename: {doc["name"]}\nType: {doc["mime_type"]}\n\nContent:\n{(doc.get("text") or "")[:6000]}'
    out = llm.json_call(SYSTEM, prompt, SCHEMA)
    if out and out.get("category") in CATEGORIES:
        return {"category": out["category"], "reason": out["reason"].strip().splitlines()[0], "method": "llm"}
    text = f'{doc["name"]} {doc["name"]} {doc.get("text") or ""}'  # filename counted twice: it is a strong hint
    category, hits = rules.best_label(text, rules.DRIVE_CATEGORIES, "office")
    reason = (f'Mentions {", ".join(hits)}.' if hits else "No strong signals; defaulted to office.")
    return {"category": category, "reason": reason, "method": "rules"}


def run(conn: sqlite3.Connection, docs: list[dict]) -> dict[str, dict]:
    results = {d["file_id"]: classify(d) for d in docs}
    with db.tx(conn):
        for fid, r in results.items():
            db.save_analysis(conn, "drive_category", fid, r)
            db.set_labels(conn, f"drive:{fid}", f'category {r["category"]} | {r["category"]} document')
    return results
