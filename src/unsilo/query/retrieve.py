"""Task 4 retrieval: find the records that can answer a question.

1. Understand the question: date range ("last month", "this week"...), source hints ("email", "WhatsApp").
2. BM25 full-text search over all records (analysis labels included, so "pending reply" finds unanswered mail).
3. If the question names a WhatsApp group, pull that group's messages in the date range too.
"""
from __future__ import annotations

import calendar
import re
import sqlite3
from dataclasses import dataclass
from datetime import datetime, timedelta

from ..config import settings

STOPWORDS = set("""a an the of to in on for and or is are was were be been do does did what which who whom whose when
where why how our we us my me i you your it its this that these those there their they them with from by at as
any all some please tell show give list find about into than then so if can could would should will shall have
has had not no yes get got still""".split())

SYNONYMS = {
    "sales": ["sales", "sale", "revenue", "sold", "turnover", "billing"],
    "revenue": ["revenue", "sales", "turnover"],
    "pending": ["pending", "unanswered", "reply"],
    "unanswered": ["unanswered", "pending", "reply"],
    "reply": ["reply", "unanswered", "pending"],
    "agree": ["agree", "agreed", "decision", "confirmed", "final", "decided"],
    "agreed": ["agreed", "decision", "confirmed", "final", "decided"],
    "quotation": ["quotation", "quote", "estimate"],
    "quote": ["quote", "quotation", "estimate"],
    "invoice": ["invoice", "bill", "payment"],
    "kyc": ["kyc", "verification", "pan", "aadhaar", "gst"],
}

SOURCE_HINTS = {
    "gmail": ["email", "emails", "mail", "mails", "inbox", "gmail"],
    "drive": ["document", "documents", "doc", "docs", "drive", "file", "files", "sheet", "spreadsheet", "pdf"],
    "whatsapp": ["whatsapp", "group", "chat", "message", "messages", "wa"],
}


@dataclass
class Hit:
    source_id: str
    provider: str
    title: str
    snippet: str
    sender: str
    occurred_at: str
    source_url: str
    score: float


def date_range(question: str, ref: datetime | None = None) -> tuple[datetime, datetime] | None:
    ref = ref or settings.reference_date
    q = question.lower()
    day0 = ref.replace(hour=0, minute=0, second=0, microsecond=0)
    if "today" in q:
        return day0, ref
    if "yesterday" in q:
        return day0 - timedelta(days=1), day0
    if "this week" in q:
        return day0 - timedelta(days=day0.weekday()), ref
    if "last week" in q:
        start = day0 - timedelta(days=day0.weekday() + 7)
        return start, start + timedelta(days=7)
    if "this month" in q:
        return day0.replace(day=1), ref
    if "last month" in q or "previous month" in q:
        first = day0.replace(day=1)
        prev_last = first - timedelta(days=1)
        return prev_last.replace(day=1), first
    m = re.search(r"last (\d+) days", q)
    if m:
        return day0 - timedelta(days=int(m.group(1))), ref
    for i, name in enumerate(calendar.month_name):
        if i and re.search(rf"\b{name.lower()}\b", q):
            year = ref.year if i <= ref.month else ref.year - 1
            start = ref.replace(year=year, month=i, day=1, hour=0, minute=0, second=0, microsecond=0)
            end_day = calendar.monthrange(year, i)[1]
            return start, start.replace(day=end_day) + timedelta(days=1)
    return None


def _terms(question: str) -> list[str]:
    words = re.findall(r"[a-z0-9]+", question.lower())
    terms: list[str] = []
    for w in words:
        if w in STOPWORDS or len(w) < 2:
            continue
        for t in SYNONYMS.get(w, [w]):
            if t not in terms:
                terms.append(t)
    return terms


def _source_hints(question: str) -> set[str]:
    words = set(re.findall(r"[a-z]+", question.lower()))
    return {src for src, kws in SOURCE_HINTS.items() if words & set(kws)}


def _snippet(body: str, terms: list[str], width: int = 1200) -> str:
    if len(body) <= width:
        return body
    low = body.lower()
    positions = [low.find(t) for t in terms if low.find(t) >= 0]
    start = max(0, min(positions) - 200) if positions else 0
    return ("..." if start else "") + body[start:start + width] + "..."


def search(conn: sqlite3.Connection, question: str, limit: int = 14) -> tuple[list[Hit], dict]:
    terms = _terms(question)
    rng = date_range(question)
    hints = _source_hints(question)
    meta = {"terms": terms, "date_range": [d.isoformat() for d in rng] if rng else None, "sources": sorted(hints)}
    if not terms:
        return [], meta

    fts_query = " OR ".join(f'"{t}"*' for t in terms)
    rows = conn.execute(
        """SELECT r.*, bm25(records_fts, 0, 3.0, 1.0, 1.0, 2.0) AS rank FROM records_fts
           JOIN records r ON r.source_id = records_fts.source_id
           WHERE records_fts MATCH ? ORDER BY rank LIMIT 80""",
        (fts_query,),
    ).fetchall()

    hits: list[Hit] = []
    for r in rows:
        provider = r["provider"]
        base = "whatsapp" if provider.startswith("whatsapp") else provider
        score = -r["rank"]
        if hints and base not in hints:
            score *= 0.4
        if rng and provider in {"gmail", "whatsapp"} and r["occurred_at"]:
            when = datetime.fromisoformat(r["occurred_at"])
            if not (rng[0] <= when < rng[1]):
                continue  # dated messages outside the asked period are not evidence for it
        hits.append(Hit(r["source_id"], provider, r["title"] or "", _snippet(r["body"] or "", terms),
                        r["sender"] or "", r["occurred_at"] or "", r["source_url"] or "", score))

    hits += _group_messages(conn, question, rng, {h.source_id for h in hits})
    hits = _structured(conn, question, hits)
    hits.sort(key=lambda h: -h.score)
    return hits[:limit], meta


def _group_messages(conn, question: str, rng, seen: set[str]) -> list[Hit]:
    """If the question names a group ("site team"), include its messages for the period."""
    q_words = set(re.findall(r"[a-z0-9]+", question.lower())) - STOPWORDS
    out: list[Hit] = []
    for g in conn.execute("SELECT group_id, name FROM wa_groups").fetchall():
        name_words = set(re.findall(r"[a-z0-9]+", (g["name"] or "").lower())) - STOPWORDS
        if not name_words or len(name_words & q_words) < min(2, len(name_words)):
            continue
        rows = conn.execute(
            "SELECT r.* FROM wa_messages m JOIN records r ON r.source_id = 'whatsapp:' || m.message_id "
            "WHERE m.group_id = ? ORDER BY m.sent_at DESC LIMIT 60", (g["group_id"],)).fetchall()
        for r in rows:
            if r["source_id"] in seen:
                continue
            if rng and not (rng[0] <= datetime.fromisoformat(r["occurred_at"]) < rng[1]):
                continue
            out.append(Hit(r["source_id"], "whatsapp", r["title"], r["body"], r["sender"], r["occurred_at"],
                           r["source_url"] or "", 0.5))
        summary = conn.execute("SELECT * FROM records WHERE source_id = ?",
                               (f'whatsapp_summary:{g["group_id"]}',)).fetchone()
        if summary and summary["source_id"] not in seen:
            out.append(Hit(summary["source_id"], "whatsapp_summary", summary["title"], summary["body"], "",
                           summary["occurred_at"], "", 1.0))
    return out


PENDING_WORDS = {"pending", "unanswered", "unreplied", "reply", "replied", "respond", "responded", "waiting"}
TEAM_WORDS = {"sales", "marketing"}


def _structured(conn, question: str, hits: list[Hit]) -> list[Hit]:
    """Questions about unanswered mail are answered from the triage results, not keyword luck."""
    words = set(re.findall(r"[a-z]+", question.lower()))
    if not words & PENDING_WORDS:
        return hits
    team = next(iter(words & TEAM_WORDS), None)
    rows = conn.execute(
        """SELECT r.*, a.result AS team FROM records r JOIN analysis a
           ON a.kind = 'email_team' AND 'gmail:' || a.item_id = r.source_id
           WHERE r.provider = 'gmail' AND r.labels LIKE '%unanswered%'"""
    ).fetchall()
    boosted = {}
    for r in rows:
        if team and f'"team": "{team}"' not in r["team"]:
            continue
        boosted[r["source_id"]] = Hit(r["source_id"], "gmail", r["title"], f'{r["body"][:600]}\n[{r["labels"]}]',
                                      r["sender"], r["occurred_at"], r["source_url"] or "", 100.0)
    if not boosted:
        return hits
    # unanswered emails of the asked team first; drop other email hits so the list stays precise
    rest = [h for h in hits if h.source_id not in boosted and h.provider != "gmail"]
    return list(boosted.values()) + rest
