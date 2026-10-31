"""Keyword rules. Used when no LLM is configured, and as a sanity check on LLM labels.

Weights are deliberately simple so any teammate can explain and tune them during judging.
"""
from __future__ import annotations

import re

EMAIL_TEAMS = {
    "sales": ["quotation", "quote", "rfq", "enquiry", "inquiry", "purchase order", "po ", "order", "pricing",
              "price", "rate", "rental", "hire", "booking", "deal", "proposal", "negotiat", "discount",
              "delivery", "customer", "client", "lead", "invoice", "payment", "advance", "machine", "excavator",
              "crane", "equipment"],
    "marketing": ["campaign", "newsletter", "social media", "instagram", "linkedin", "facebook", "brand",
                  "webinar", "seo", "ads", "advertis", "promotion", "promo", "launch", "event", "expo",
                  "brochure", "content", "influencer", "press", "leaflet", "banner", "creative"],
}

DRIVE_CATEGORIES = {
    "sales": ["quotation", "quote", "sales", "purchase order", "order", "pipeline", "lead", "customer",
              "deal", "rental agreement", "price list", "rate card", "proposal", "booking"],
    "marketing": ["marketing", "campaign", "brochure", "social", "brand", "content calendar", "seo", "ads",
                  "promotion", "newsletter", "event", "press release", "creative", "audience"],
    "verification": ["kyc", "aadhaar", "aadhar", "pan card", "pan ", "gst certificate", "gstin", "verification",
                     "identity", "id proof", "address proof", "registration certificate", "license", "licence",
                     "cancelled cheque", "incorporation"],
    "office": ["policy", "hr", "leave", "attendance", "meeting minutes", "minutes of", "sop", "handbook",
               "holiday", "onboarding", "office", "admin", "asset register", "employee", "roster", "notice"],
    "accounts": ["invoice", "ledger", "balance sheet", "profit", "loss", "p&l", "expense", "payment",
                 "receivable", "payable", "tax", "tds", "gst return", "bank statement", "reconciliation",
                 "budget", "salary", "payroll", "credit note", "debit note", "accounts"],
}

CRITICAL_ATTACHMENTS = {
    "invoice": ["invoice", "tax invoice", "bill"],
    "purchase order": ["purchase order", "po_", "po-", "po ", "p.o."],
    "quotation": ["quotation", "quote", "estimate", "proforma"],
    "contract": ["contract", "agreement", "mou", "nda", "terms", "lease"],
    "KYC/verification": ["kyc", "aadhaar", "aadhar", "pan", "gst", "certificate", "id proof", "passport",
                         "verification", "cancelled cheque", "registration"],
}


def score(text: str, keywords: list[str]) -> int:
    t = f" {text.lower()} "
    return sum(t.count(k) for k in keywords)


def best_label(text: str, table: dict[str, list[str]], default: str) -> tuple[str, list[str]]:
    scores = {label: score(text, kws) for label, kws in table.items()}
    label = max(scores, key=scores.get)
    if scores[label] == 0:
        return default, []
    hits = [k.strip() for k in table[label] if k in f" {text.lower()} "]
    return label, hits[:3]


def attachment_kind(filename: str, text: str = "") -> tuple[str | None, str]:
    """Returns (kind, evidence) for a business-critical attachment, or (None, "")."""
    name = re.sub(r"[_\-.]+", " ", filename.lower())
    for kind, kws in CRITICAL_ATTACHMENTS.items():
        for k in kws:
            if k.strip(" _-") and re.search(rf"\b{re.escape(k.strip(' _-.'))}\b", name):
                return kind, f'filename "{filename}" contains "{k.strip()}"'
    head = text[:3000].lower()
    for kind, kws in CRITICAL_ATTACHMENTS.items():
        for k in kws:
            if len(k.strip()) > 3 and k in head:
                return kind, f'document text contains "{k.strip()}"'
    return None, ""


AUTOMATED_SENDERS = ("newsletter", "noreply", "no-reply", "donotreply", "notifications", "it-support", "mailer-daemon")


def is_automated(addr: str) -> bool:
    return addr.split("@")[0].lower().startswith(AUTOMATED_SENDERS)
