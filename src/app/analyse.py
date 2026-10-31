"""Task 1-3 analysis. AI when GEMINI_API_KEY is set; keyword rules otherwise (and for anything the AI skips)."""
import re
from datetime import datetime

from . import ai, db, google, settings, whatsapp

TEAMS = ["sales", "marketing", "other"]
CATEGORIES = ["sales", "marketing", "verification", "office", "accounts"]

TEAM_WORDS = {
    "sales": ["quotation", "quote", "rfq", "enquiry", "inquiry", "purchase order", "order", "pricing", "price",
              "rate", "rental", "hire", "booking", "deal", "proposal", "negotiat", "discount", "delivery",
              "customer", "client", "lead", "invoice", "payment", "machine", "equipment"],
    "marketing": ["campaign", "newsletter", "social media", "instagram", "linkedin", "facebook", "brand",
                  "webinar", "seo", "advertis", "promotion", "promo", "launch", "event", "expo", "brochure",
                  "content", "influencer", "press", "banner", "creative"],
}
CATEGORY_WORDS = {
    "sales": ["quotation", "quote", "sales", "purchase order", "order", "pipeline", "lead", "customer", "deal",
              "price list", "rate card", "proposal", "booking"],
    "marketing": ["marketing", "campaign", "brochure", "social", "brand", "content calendar", "seo", "promotion",
                  "newsletter", "event", "press release", "creative"],
    "verification": ["kyc", "aadhaar", "aadhar", "pan card", "gst certificate", "gstin", "verification", "identity",
                     "id proof", "address proof", "registration certificate", "licence", "license", "cancelled cheque"],
    "office": ["policy", "hr", "leave", "attendance", "minutes", "sop", "handbook", "holiday", "onboarding",
               "office", "admin", "asset register", "employee", "roster", "notice"],
    "accounts": ["invoice", "ledger", "balance sheet", "profit", "p&l", "expense", "payment", "receivable",
                 "payable", "tax", "tds", "gst return", "bank statement", "reconciliation", "budget", "salary",
                 "payroll", "credit note", "debit note", "accounts"],
}
CRITICAL = {
    "invoice": ["invoice", "bill"],
    "purchase order": ["purchase order", "po"],
    "quotation": ["quotation", "quote", "estimate", "proforma"],
    "contract": ["contract", "agreement", "mou", "nda", "lease"],
    "KYC/verification": ["kyc", "aadhaar", "aadhar", "pan", "gst", "certificate", "passport", "verification",
                         "cancelled cheque", "registration"],
}
AUTOMATED = ("newsletter", "noreply", "no-reply", "donotreply", "notifications", "mailer-daemon")


def _best(text: str, table: dict, default: str) -> tuple[str, list[str]]:
    t = f" {text.lower()} "
    scores = {k: sum(t.count(w) for w in words) for k, words in table.items()}
    best = max(scores, key=scores.get)
    if not scores[best]:
        return default, []
    return best, [w for w in table[best] if w in t][:3]


# --- Gmail ---------------------------------------------------------------------------------------

TEAM_PROMPT = ("Label each email of an Indian equipment-rental company with one team. sales: customer enquiries, "
               "quotations, bookings, orders, pricing, deliveries, customer invoices/payments. marketing: campaigns, "
               "social media, brand, events, newsletters they run, ads, agencies. other: HR, IT, admin, vendors not "
               "about selling, notifications, spam. Reason: short, quote the deciding words.")
TEAM_SCHEMA = ai.obj({"items": {"type": "array", "items": ai.obj({"id": ai.STR, "team": {"type": "string", "enum": TEAMS}, "reason": ai.STR})}})

ATT_PROMPT = ("Is each email attachment business-critical? Critical kinds: invoice, purchase order, quotation, "
              "contract, KYC/verification (PAN, Aadhaar, GST, ID, certificates). Logos, photos, signatures, "
              "brochures are not. Reason must name the evidence.")
ATT_SCHEMA = ai.obj({"items": {"type": "array", "items": ai.obj({
    "id": ai.STR, "critical": {"type": "boolean"},
    "kind": {"type": "string", "enum": list(CRITICAL) + ["none"]}, "reason": ai.STR})}})


def _ours(e: dict) -> bool:
    return "SENT" in e["labels"] or (bool(settings.SANDBOX_EMAIL) and e["from_addr"] == settings.SANDBOX_EMAIL)


def unanswered(emails: list[dict]) -> list[dict]:
    ref = settings.reference_date()
    out = []
    for e in emails:
        if _ours(e) or "DRAFT" in e["labels"]:
            continue
        sent = datetime.fromisoformat(e["sent_at"])
        if sent > ref:
            continue
        replied = any(_ours(o) and o["thread_id"] == e["thread_id"] and datetime.fromisoformat(o["sent_at"]) > sent
                      for o in emails)
        days = (ref - sent).days
        if not replied and days >= settings.UNANSWERED_DAYS:
            out.append({"message_id": e["id"], "thread_id": e["thread_id"], "from": e["from_addr"],
                        "subject": e["subject"], "received_at": e["sent_at"], "days_without_reply": days})
    return sorted(out, key=lambda x: -x["days_without_reply"])


def _rule_attachment(a: dict) -> tuple[str | None, str]:
    name = re.sub(r"[_\-.]+", " ", a["filename"].lower())
    for kind, words in CRITICAL.items():
        for w in words:
            if re.search(rf"\b{re.escape(w)}\b", name):
                return kind, f'filename "{a["filename"]}" contains "{w}"'
    head = (a.get("text") or "")[:3000].lower()
    for kind, words in CRITICAL.items():
        for w in words:
            if len(w) > 3 and w in head:
                return kind, f'document text contains "{w}"'
    return None, ""


def analyse_gmail() -> None:
    emails = google.emails()
    teams, atts = {}, {}
    for i in range(0, len(emails), 12):
        batch = emails[i:i + 12]
        out = ai.json_call(TEAM_PROMPT, "\n\n".join(
            f'<email id="{e["id"]}">From: {e["from_name"]} <{e["from_addr"]}>\nSubject: {e["subject"]}\n'
            f'Attachments: {", ".join(a["filename"] for a in e["attachments"]) or "none"}\n{e["body"][:1500]}</email>'
            for e in batch), TEAM_SCHEMA)
        for it in (out or {}).get("items", []):
            teams[it["id"]] = {"team": it["team"], "reason": it["reason"], "method": "ai"}
        pairs = [(e, a) for e in batch for a in e["attachments"]]
        if pairs:
            out = ai.json_call(ATT_PROMPT, "\n\n".join(
                f'<attachment id="{e["id"]}|{a["filename"]}">Subject: {e["subject"]}\nFile: {a["filename"]} '
                f'({a["mime_type"]})\nStart of content: {(a.get("text") or "")[:800]}</attachment>' for e, a in pairs), ATT_SCHEMA)
            for it in (out or {}).get("items", []):
                atts[it["id"]] = it

    pending = {u["message_id"]: u["days_without_reply"] for u in unanswered(emails)}
    for e in emails:
        if e["id"] not in teams:
            if e["from_addr"].split("@")[0].startswith(AUTOMATED):
                teams[e["id"]] = {"team": "other", "reason": f'automated sender {e["from_addr"]}', "method": "rules"}
            else:
                team, hits = _best(f'{e["subject"]} {e["body"]}', TEAM_WORDS, "other")
                teams[e["id"]] = {"team": team, "method": "rules",
                                  "reason": f'keywords: {", ".join(hits)}' if hits else "no sales or marketing signals"}
        flags = []
        for a in e["attachments"]:
            v = atts.get(f'{e["id"]}|{a["filename"]}')
            if v is not None:
                if v["critical"]:
                    flags.append({"filename": a["filename"], "kind": v["kind"], "reason": v["reason"]})
                continue
            kind, why = _rule_attachment(a)
            if kind:
                flags.append({"filename": a["filename"], "kind": kind, "reason": f"Looks like a {kind}: {why}."})
        db.save_result("email_team", e["id"], teams[e["id"]])
        db.save_result("email_attachments", e["id"], {"flagged": bool(flags), "attachments": flags})
        tags = [f'team {teams[e["id"]]["team"]}', f'{teams[e["id"]]["team"]} email']
        if e["id"] in pending:
            tags.append(f'unanswered pending reply no reply for {pending[e["id"]]} days')
        tags += [f'important attachment {f["kind"]}' for f in flags]
        db.add_tags(f'gmail:{e["id"]}', " | ".join(tags))
    db.conn.commit()


# --- Drive ---------------------------------------------------------------------------------------

DRIVE_PROMPT = ("Put a company document in exactly one category. sales: quotations, sales reports, orders, customer "
                "lists, price lists. marketing: campaign plans, brochures, social calendars, brand, events. "
                "verification: KYC, PAN, Aadhaar, GST certificates, ID/address proof, registrations, licences. "
                "office: HR policies, attendance, minutes, SOPs, admin, asset registers. accounts: invoices, ledgers, "
                "expenses, P&L, balance sheets, payments, tax, payroll, bank statements. Judge content first, "
                "filename second. Reason: one line naming the evidence.")
DRIVE_SCHEMA = ai.obj({"category": {"type": "string", "enum": CATEGORIES}, "reason": ai.STR})


def analyse_drive() -> None:
    for d in google.documents():
        out = ai.json_call(DRIVE_PROMPT, f'File: {d["name"]} ({d["mime_type"]})\n\n{(d["text"] or "")[:6000]}', DRIVE_SCHEMA)
        if out and out.get("category") in CATEGORIES:
            res = {"category": out["category"], "reason": out["reason"].strip().splitlines()[0], "method": "ai"}
        else:
            cat, hits = _best(f'{d["name"]} {d["name"]} {d["text"] or ""}', CATEGORY_WORDS, "office")
            res = {"category": cat, "method": "rules",
                   "reason": f'Mentions {", ".join(hits)}.' if hits else "No strong signals; defaulted to office."}
        db.save_result("drive_category", d["id"], res)
        db.add_tags(f'drive:{d["id"]}', f'category {res["category"]} | {res["category"]} document')
    db.conn.commit()


# --- WhatsApp ------------------------------------------------------------------------------------

WA_PROMPT = ("Read a WhatsApp group chat of an equipment-rental business. Using only the messages, give a short "
             "summary, what each participant is asking for and committing to, action items (owner, due if stated) "
             "and decisions. Cite message ids.")
WA_SCHEMA = ai.obj({
    "summary": ai.STR,
    "participants": {"type": "array", "items": ai.obj({"name": ai.STR, "number": ai.STR, "asking_for": ai.STRS, "committing_to": ai.STRS})},
    "action_items": {"type": "array", "items": ai.obj({"task": ai.STR, "owner": ai.STR, "due": ai.STR, "message_ids": ai.STRS})},
    "decisions": {"type": "array", "items": ai.obj({"decision": ai.STR, "message_ids": ai.STRS})},
})
ASK = re.compile(r"\?|\b(please|pls|can you|could you|need|send|share|kindly|require)\b", re.I)
COMMIT = re.compile(r"\b(i will|i'll|we will|we'll|will do|on it|i can|by (today|tomorrow|eod|monday|tuesday|wednesday|thursday|friday|saturday|sunday))\b", re.I)
DECIDE = re.compile(r"\b(agreed|confirmed|final|finalised|finalized|approved|decided|go ahead|let's go with)\b", re.I)


def _wa_rules(g: dict) -> dict:
    people = {p["wa_id"]: {"name": p["name"] or p["wa_id"], "number": p["wa_id"], "asking_for": [], "committing_to": []}
              for p in g["participants"]}
    actions, decisions = [], []
    for m in g["messages"]:
        who = people.setdefault(m["sender_id"], {"name": m["sender_name"] or m["sender_id"], "number": m["sender_id"],
                                                 "asking_for": [], "committing_to": []})
        if COMMIT.search(m["text"] or ""):
            who["committing_to"].append(m["text"])
            actions.append({"task": m["text"], "owner": who["name"], "due": "", "message_ids": [m["message_id"]]})
        elif ASK.search(m["text"] or ""):
            who["asking_for"].append(m["text"])
        if DECIDE.search(m["text"] or ""):
            decisions.append({"decision": m["text"], "message_ids": [m["message_id"]]})
    summary = (f'{len(g["messages"])} messages from {len({m["sender_id"] for m in g["messages"]})} people. '
               f'{len(actions)} commitments and {len(decisions)} decisions found by keyword rules.')
    return {"summary": summary, "participants": list(people.values()), "action_items": actions, "decisions": decisions}


def analyse_whatsapp() -> None:
    for g in whatsapp.groups():
        if not g["messages"]:
            res = {"summary": "No messages yet.", "participants": [], "action_items": [], "decisions": [], "method": "none"}
        else:
            chat = "\n".join(f'[{m["message_id"]}] {m["sent_at"][:16]} {m["sender_name"] or m["sender_id"]} '
                             f'({m["sender_id"]}): {m["text"]}' for m in g["messages"])
            roster = "\n".join(f'- {p["name"]} ({p["wa_id"]})' for p in g["participants"])
            out = ai.json_call(WA_PROMPT, f'Group: {g["name"]}\nParticipants:\n{roster}\n\n{chat[-60000:]}', WA_SCHEMA, 8000)
            res = {**out, "method": "ai"} if out else {**_wa_rules(g), "method": "rules"}
        db.save_result("wa_interpretation", g["group_id"], res)
        body = "\n".join([res["summary"]] + [f'Action: {a["task"]} (owner {a["owner"]})' for a in res["action_items"]]
                         + [f'Decision: {d["decision"]}' for d in res["decisions"]])
        last = g["messages"][-1]["sent_at"] if g["messages"] else ""
        db.index(f'whatsapp_summary:{g["group_id"]}', "whatsapp_summary", f'WhatsApp group summary: {g["name"]}',
                 body, "", "", last, "summary agreed decided decisions action items")
    db.conn.commit()


def analyse_all() -> dict:
    analyse_gmail()
    analyse_drive()
    analyse_whatsapp()
    return {"emails": len(google.emails()), "documents": len(google.documents()), "groups": len(whatsapp.groups())}
