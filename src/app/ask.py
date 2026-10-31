"""Task 4: search all three sources, answer only from what was found, cite it, or say it isn't there."""
import calendar
import re
from datetime import datetime, timedelta

from . import ai, settings
from .db import conn

NOT_FOUND = "I couldn't find this in the connected WhatsApp, Gmail or Drive data, so I won't guess."
STOP = set("""a an the of to in on for and or is are was were be been do does did what which who whom when where why
how our we us my me i you your it its this that these those there their they them with from by at as any all some
please tell show give list find about into than then so if can could would should will have has had not get got still""".split())
SYNONYMS = {
    "sales": ["sales", "sale", "revenue", "sold", "turnover"], "revenue": ["revenue", "sales", "turnover"],
    "pending": ["pending", "unanswered", "reply"], "unanswered": ["unanswered", "pending", "reply"],
    "reply": ["reply", "unanswered", "pending"], "agree": ["agree", "agreed", "decision", "confirmed", "final"],
    "agreed": ["agreed", "decision", "confirmed", "final"], "quotation": ["quotation", "quote", "estimate"],
    "quote": ["quote", "quotation", "estimate"], "invoice": ["invoice", "bill", "payment"],
    "kyc": ["kyc", "verification", "pan", "aadhaar", "gst"],
}
SOURCE_WORDS = {"gmail": {"email", "emails", "mail", "mails", "inbox"},
                "drive": {"document", "documents", "doc", "docs", "drive", "file", "files", "sheet", "pdf"},
                "whatsapp": {"whatsapp", "group", "chat", "message", "messages"}}


def period(q: str) -> tuple[datetime, datetime] | None:
    ref = settings.reference_date()
    q = q.lower()
    day = ref.replace(hour=0, minute=0, second=0, microsecond=0)
    if "today" in q:
        return day, ref
    if "yesterday" in q:
        return day - timedelta(days=1), day
    if "this week" in q:
        return day - timedelta(days=day.weekday()), ref
    if "last week" in q:
        start = day - timedelta(days=day.weekday() + 7)
        return start, start + timedelta(days=7)
    if "this month" in q:
        return day.replace(day=1), ref
    if "last month" in q or "previous month" in q:
        first = day.replace(day=1)
        return (first - timedelta(days=1)).replace(day=1), first
    m = re.search(r"last (\d+) days", q)
    if m:
        return day - timedelta(days=int(m.group(1))), ref
    for i, name in enumerate(calendar.month_name):
        if i and re.search(rf"\b{name.lower()}\b", q):
            year = ref.year if i <= ref.month else ref.year - 1
            start = day.replace(year=year, month=i, day=1)
            return start, start + timedelta(days=calendar.monthrange(year, i)[1])
    return None


def terms(q: str) -> list[str]:
    out = []
    for w in re.findall(r"[a-z0-9]+", q.lower()):
        if w not in STOP and len(w) > 1:
            out += [t for t in SYNONYMS.get(w, [w]) if t not in out]
    return out


<<<<<<< HEAD
def search(q: str, limit: int = 14, use_period: bool = True) -> tuple[list[dict], dict]:
    words, rng = terms(q), (period(q) if use_period else None)
=======
def search(q: str, limit: int = 14) -> tuple[list[dict], dict]:
    words, rng = terms(q), period(q)
>>>>>>> 2fc174a364fb375a5a0731d82cb95fb37f4267a3
    q_words = set(re.findall(r"[a-z]+", q.lower()))
    wanted = {s for s, ws in SOURCE_WORDS.items() if q_words & ws}
    info = {"terms": words, "period": [d.isoformat() for d in rng] if rng else None, "sources": sorted(wanted)}
    if not words:
        return [], info
    rows = conn.execute(
        "SELECT r.*, bm25(records_fts, 0, 3.0, 1.0, 1.0, 2.0) AS rank FROM records_fts "
        "JOIN records r ON r.source_id = records_fts.source_id WHERE records_fts MATCH ? ORDER BY rank LIMIT 80",
        (" OR ".join(f'"{w}"*' for w in words),)).fetchall()
    hits = []
    for r in rows:
        base = "whatsapp" if r["source"].startswith("whatsapp") else r["source"]
        score = -r["rank"] * (0.4 if wanted and base not in wanted else 1)
        if rng and r["source"] in ("gmail", "whatsapp") and r["occurred_at"]:
            if not rng[0] <= datetime.fromisoformat(r["occurred_at"]) < rng[1]:
                continue  # dated messages outside the asked period are not evidence for it
        hits.append({**dict(r), "score": score})

    # Questions about pending replies: use the triage result, not keyword luck
<<<<<<< HEAD
    if q_words & PENDING_WORDS:
=======
    if q_words & {"pending", "unanswered", "unreplied", "reply", "replied", "waiting", "respond"}:
>>>>>>> 2fc174a364fb375a5a0731d82cb95fb37f4267a3
        team = next(iter(q_words & {"sales", "marketing"}), None)
        rows = conn.execute("SELECT r.*, x.data FROM records r JOIN results x ON x.kind = 'email_team' "
                            "AND 'gmail:' || x.item_id = r.source_id WHERE r.tags LIKE '%unanswered%'").fetchall()
        pending = [{**dict(r), "score": 100.0} for r in rows if not team or f'"team": "{team}"' in r["data"]]
        if pending:
            ids = {p["source_id"] for p in pending}
            hits = pending + [h for h in hits if h["source_id"] not in ids and h["source"] != "gmail"]

    # A question naming a WhatsApp group pulls that group's messages for the period
    for g in conn.execute("SELECT DISTINCT group_id, group_name FROM wa_messages").fetchall():
        name_words = set(re.findall(r"[a-z0-9]+", (g["group_name"] or "").lower())) - STOP
        if name_words and len(name_words & q_words) >= min(2, len(name_words)):
            seen = {h["source_id"] for h in hits}
            for r in conn.execute("SELECT r.* FROM wa_messages m JOIN records r ON r.source_id = 'whatsapp:' || m.message_id "
                                  "WHERE m.group_id = ? ORDER BY m.sent_at DESC LIMIT 60", (g["group_id"],)).fetchall():
                if r["source_id"] not in seen and (not rng or rng[0] <= datetime.fromisoformat(r["occurred_at"]) < rng[1]):
                    hits.append({**dict(r), "score": 0.5})
    hits.sort(key=lambda h: -h["score"])
    return hits[:limit], info


def _snippet(body: str, words: list[str], width: int = 1200) -> str:
    if len(body) <= width:
        return body
    low = body.lower()
    pos = [low.find(w) for w in words if low.find(w) >= 0]
    start = max(0, min(pos) - 200) if pos else 0
    return body[start:start + width]


def _cite(h: dict, words: list[str]) -> dict:
    return {"source_id": h["source_id"], "type": h["source"], "title": h["title"], "from": h["sender"],
            "date": h["occurred_at"], "url": h["url"], "excerpt": _snippet(h["body"] or "", words)[:300]}


ANSWER_PROMPT = ("Answer questions about a company using ONLY the numbered sources. Every factual sentence cites at "
<<<<<<< HEAD
                 "least one source like [S2]. If the sources answer only part of the question, answer that part and "
                 "say in one short sentence what is missing (answerable=true). Set answerable=false only when none of "
                 "the sources is relevant. No outside knowledge. Dates are relative to the reference date. Be concise; "
                 "use short '- ' bullet lines when listing several items.")
CLOSEST_PROMPT = ("The data has nothing dated in the period the question asks about. Using ONLY the numbered sources, "
                  "start with one short sentence saying nothing was found for that exact period, then give what the "
                  "closest sources do say, with their dates. Cite every fact like [S2]. Use short '- ' bullet lines. "
                  "answerable=true unless none of the sources is relevant.")
OVERVIEW_PROMPT = ("Using ONLY the numbered sources (a cross-section of the company's WhatsApp, Gmail and Drive data), "
                   "write a short, useful summary for the question. If the question asks for something specific that the "
                   "sources do not contain, say so in one sentence first, then summarise the closest relevant points. "
                   "Use 3 to 8 short '- ' bullet lines grouped by topic, each citing sources like [S2]. "
                   "answerable=true unless the sources are empty.")
=======
                 "least one source like [S2]. If the sources don't contain the answer, set answerable=false and say "
                 "what is missing. No outside knowledge. Dates are relative to the reference date. Be concise.")
>>>>>>> 2fc174a364fb375a5a0731d82cb95fb37f4267a3
ANSWER_SCHEMA = ai.obj({"answerable": {"type": "boolean"}, "answer": ai.STR, "citations": ai.STRS})


GREETING = re.compile(r"^\s*(hi+|hey+|hello+|hii+|namaste|yo|thanks?( you)?|thank you|ok(ay)?|good (morning|afternoon|evening))\W*$", re.I)
HELP = ("Hi! Ask me about your WhatsApp groups, Gmail or Drive, for example \"Which sales emails are still "
        "pending a reply?\" or \"Where is the latest quotation?\". Every answer links to the message or file it came from.")


def _records_answer(base: dict, hits: list, words: list[str], heading: str) -> dict:
    top = hits[:3]
    lines = "\n".join(f"[S{i}] {h['title']}: {' '.join(_snippet(h['body'] or '', words, 220).split())}"
                      for i, h in enumerate(top, 1))
    return {**base, "answerable": True, "mode": "records", "answer": f"{heading}\n{lines}",
            "citations": [_cite(h, words) for h in top]}


<<<<<<< HEAD
SUMMARY_WORDS = {"summary", "summarise", "summarize", "overview", "update", "updates", "status", "happening",
                 "highlights", "recap", "brief", "everything", "latest", "recent"}


def overview_hits(limit: int = 14) -> list[dict]:
    """A cross-section of the data: every WhatsApp group summary, then the newest emails and documents."""
    def rows(sql: str, n: int):
        return [dict(r) | {"score": 0.0} for r in conn.execute(sql, (n,)).fetchall()]
    ref = settings.reference_date().isoformat()
    picks = rows("SELECT * FROM records WHERE source = 'whatsapp_summary' LIMIT ?", 6)
    picks += [r for r in rows("SELECT * FROM records WHERE source = 'gmail' ORDER BY occurred_at DESC LIMIT ?", 12)
              if (r["occurred_at"] or "") <= ref][:5]
    picks += rows("SELECT * FROM records WHERE source = 'drive' ORDER BY occurred_at DESC LIMIT ?", 5)
    if len(picks) < limit:
        picks += rows("SELECT * FROM records WHERE source = 'whatsapp' ORDER BY occurred_at DESC LIMIT ?", limit - len(picks))
    return picks[:limit]


def _merge(*lists: list[dict], limit: int = 14) -> list[dict]:
    out, seen = [], set()
    for lst in lists:
        for h in lst:
            if h["source_id"] not in seen:
                seen.add(h["source_id"])
                out.append(h)
    return out[:limit]


def _ai_answer(base: dict, question: str, hits: list[dict], words: list[str], prompt: str, mode: str) -> dict | None:
    """Gemini answer with enforced citations. None means "not answerable from these hits"."""
    sources = "\n\n".join(f"[S{i}] id={h['source_id']} type={h['source']} date={(h['occurred_at'] or '')[:10]} "
                           f"from={h['sender']}\ntitle: {h['title']}\n{_snippet(h['body'] or '', words)}"
                           for i, h in enumerate(hits, 1))
    out = ai.json_call(prompt, f"Reference date: {settings.reference_date().date()}\nQuestion: {question}\n\n"
                               f"Sources:\n{sources}", ANSWER_SCHEMA)
    if not out:
        # Gemini busy or out of quota: still show the matching records instead of nothing.
        return _records_answer(base, hits, words, "Gemini is busy right now, so here are the most relevant records:")
    labels = {f"S{i}": h for i, h in enumerate(hits, 1)}
    ids = {h["source_id"]: h for h in hits}
    cited = []
    for c in out["citations"]:
        h = labels.get(c.strip("[] ")) or ids.get(c)
        if h and h not in cited:
            cited.append(h)
    text = out["answer"]
    for m in re.findall(r"\[(S\d+)\]", text):  # citations used inline but missing from the list
        if m in labels and labels[m] not in cited:
            cited.append(labels[m])
    for label in sorted(labels, key=lambda x: -len(x)):  # S12 before S1
        text = text.replace(f"[{label}]", f"[{labels[label]['source_id']}]")
    if not out["answerable"] or not cited:  # enforced in code: no valid citation, no answer
        return None
    return {**base, "answerable": True, "mode": mode, "answer": text, "citations": [_cite(h, words) for h in cited]}


PENDING_WORDS = {"pending", "unanswered", "unreplied", "reply", "replied", "waiting", "respond"}


def _not_found(base: dict, question: str) -> dict:
    """Clear "nothing in the connectors" answer, with what was searched."""
    count = lambda sql: conn.execute(sql).fetchone()[0]  # noqa: E731
    e, d, w = (count("SELECT COUNT(*) FROM emails"), count("SELECT COUNT(*) FROM documents"),
               count("SELECT COUNT(*) FROM wa_messages"))
    q_words = set(re.findall(r"[a-z]+", question.lower()))
    if q_words & PENDING_WORDS and q_words & {"email", "emails", "mail", "mails", "sales", "marketing", "reply"}:
        text = (f"No pending emails found in Gmail. None of the {e} emails has gone {settings.UNANSWERED_DAYS}+ days "
                f"without a reply (reference date {settings.reference_date().date()}).")
    else:
        text = (f"No data found in the connectors for this question. Searched {e} Gmail emails, {d} Drive documents "
                f"and {w} WhatsApp messages, and none of them matches.")
    return {**base, "answerable": False, "mode": "not_found", "answer": text, "citations": [],
            "searched": {"emails": e, "documents": d, "whatsapp_messages": w}}


=======
>>>>>>> 2fc174a364fb375a5a0731d82cb95fb37f4267a3
def answer(question: str) -> dict:
    if GREETING.match(question):
        return {"question": question, "retrieval": {"terms": [], "period": None, "sources": []},
                "answerable": True, "mode": "chat", "answer": HELP, "citations": []}
    if not conn.execute("SELECT 1 FROM records LIMIT 1").fetchone():
        return {"question": question, "retrieval": {"terms": terms(question), "period": None, "sources": []},
                "answerable": False, "mode": "empty", "citations": [],
                "answer": "No data is loaded yet, so there is nothing to answer from. Connect Gmail or Drive on the "
                          "Sources tab, or send a message in a selected WhatsApp group, then ask again."}
    hits, info = search(question)
    words = info["terms"]
    base = {"question": question, "retrieval": info}
<<<<<<< HEAD
    q_words = set(re.findall(r"[a-z]+", question.lower()))
    wants_summary = bool(q_words & SUMMARY_WORDS)
    if q_words & PENDING_WORDS and not any("unanswered" in (h.get("tags") or "") for h in hits) \
            and q_words & {"email", "emails", "mail", "mails", "reply"}:
        return _not_found(base, question)

    # Specific match within the asked period
    if hits and not wants_summary:
        if not settings.ai_enabled():
            return _records_answer(base, hits, words, "Most relevant records (no AI key set):")
        found = _ai_answer(base, question, hits, words, ANSWER_PROMPT, "ai")
        if found:
            return found

    # Nothing in that period: try the same question without the date limit
    if info["period"] and not wants_summary:
        wider, _ = search(question, use_period=False)
        wider = [h for h in wider if h["source_id"] not in {x["source_id"] for x in hits}] or wider
        if wider:
            if not settings.ai_enabled():
                return _records_answer(base, wider, words, "Nothing in that period. Closest records from other dates:")
            found = _ai_answer(base, question, wider, words, CLOSEST_PROMPT, "closest")
            if found:
                return found

    # Still nothing exact (or a summary was asked for): summarise what the data does contain
    pool = _merge(hits, overview_hits())
    if not settings.ai_enabled():
        return _records_answer(base, pool, words, "Latest records from your data:" if wants_summary else "No exact match. Latest records from your data:")
    found = _ai_answer(base, question, pool, words, OVERVIEW_PROMPT, "overview")
    if found:
        return found
    return _not_found(base, question)
=======
    if not hits:
        return {**base, "answerable": False, "mode": "not_found", "answer": NOT_FOUND, "citations": []}
    if not settings.ai_enabled():
        return _records_answer(base, hits, words, "Most relevant records (no AI key set):")

    sources = "\n\n".join(f"[S{i}] id={h['source_id']} type={h['source']} date={(h['occurred_at'] or '')[:10]} "
                          f"from={h['sender']}\ntitle: {h['title']}\n{_snippet(h['body'] or '', words)}"
                          for i, h in enumerate(hits, 1))
    out = ai.json_call(ANSWER_PROMPT, f"Reference date: {settings.reference_date().date()}\nQuestion: {question}\n\n"
                                      f"Sources:\n{sources}", ANSWER_SCHEMA)
    if not out:
        # Gemini busy or out of quota: still show the matching records instead of nothing.
        return _records_answer(base, hits, words, "Gemini is busy right now, so here are the most relevant records:")
    labels = {f"S{i}": h for i, h in enumerate(hits, 1)}
    ids = {h["source_id"]: h for h in hits}
    cited = []
    for c in out["citations"]:
        h = labels.get(c.strip("[] ")) or ids.get(c)
        if h and h not in cited:
            cited.append(h)
    if not out["answerable"] or not cited:  # enforced in code: no valid citation, no answer
        return {**base, "answerable": False, "mode": "not_found",
                "answer": out["answer"] if not out["answerable"] and out["answer"] else NOT_FOUND, "citations": []}
    text = out["answer"]
    for label, h in labels.items():
        text = text.replace(f"[{label}]", f"[{h['source_id']}]")
    return {**base, "answerable": True, "mode": "ai", "answer": text, "citations": [_cite(h, words) for h in cited]}
>>>>>>> 2fc174a364fb375a5a0731d82cb95fb37f4267a3
