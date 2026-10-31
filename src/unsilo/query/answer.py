"""Task 4 answering: grounded answers that cite sources, and an honest "I don't know".

Rules enforced in code (not just in the prompt):
- no retrieved evidence -> "not in the data", no LLM call at all
- the LLM may cite only ids it was shown; unknown ids are dropped
- an answer with zero valid citations is turned into "not in the data"
"""
from __future__ import annotations

import sqlite3

from .. import llm
from ..config import settings
from .retrieve import Hit, search

NOT_FOUND = "I couldn't find this in the connected WhatsApp, Gmail or Drive data, so I won't guess."

SYSTEM = (
    "You answer questions about a company using ONLY the numbered sources provided. "
    "Every factual sentence must cite at least one source id in square brackets, like [S2]. "
    "If the sources do not contain the answer, set answerable to false and say what is missing. "
    "Never use outside knowledge. Dates are relative to the reference date given. "
    "Be concise: a direct answer first, then supporting details."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "answerable": {"type": "boolean"},
        "answer": {"type": "string"},
        "citations": {"type": "array", "items": {"type": "string"}},
    },
    "required": ["answerable", "answer", "citations"],
    "additionalProperties": False,
}


def _context(hits: list[Hit]) -> str:
    blocks = []
    for i, h in enumerate(hits, 1):
        blocks.append(
            f"[S{i}] source={h.source_id} type={h.provider} date={h.occurred_at[:10]} from={h.sender}\n"
            f"title: {h.title}\n{h.snippet}"
        )
    return "\n\n".join(blocks)


def _citation(h: Hit) -> dict:
    return {"source_id": h.source_id, "type": h.provider, "title": h.title, "date": h.occurred_at,
            "from": h.sender, "url": h.source_url, "excerpt": h.snippet[:300]}


def ask(conn: sqlite3.Connection, question: str) -> dict:
    hits, meta = search(conn, question)
    if not hits:
        return {"question": question, "answerable": False, "answer": NOT_FOUND, "citations": [], "retrieval": meta}

    if llm.provider() == "none":
        # No LLM: return the best evidence verbatim rather than inventing a summary.
        top = hits[:3]
        lines = [f"[S{i}] {h.title}: {h.snippet[:200]}" for i, h in enumerate(top, 1)]
        return {"question": question, "answerable": True, "mode": "extractive",
                "answer": "Most relevant records (no LLM configured):\n" + "\n".join(lines),
                "citations": [_citation(h) for h in top], "retrieval": meta}

    ref = settings.reference_date.date().isoformat()
    prompt = f"Reference date: {ref}\nQuestion: {question}\n\nSources:\n{_context(hits)}"
    out = llm.json_call(SYSTEM, prompt, SCHEMA, effort="medium", max_tokens=4000)
    if not out:
        return {"question": question, "answerable": False, "answer": "The answer service is unavailable right now.",
                "citations": [], "retrieval": meta}

    by_label = {f"S{i}": h for i, h in enumerate(hits, 1)}
    by_id = {h.source_id: h for h in hits}
    cited = []
    for c in out["citations"]:
        h = by_label.get(c.strip("[] ")) or by_id.get(c)
        if h and h not in cited:
            cited.append(h)
    if not out["answerable"] or not cited:
        answer = out["answer"] if not out["answerable"] and out["answer"] else NOT_FOUND
        return {"question": question, "answerable": False, "answer": answer, "citations": [], "retrieval": meta}

    answer = out["answer"]
    for label, h in by_label.items():  # make inline [S2] markers point at real ids for the UI
        answer = answer.replace(f"[{label}]", f"[{h.source_id}]")
    return {"question": question, "answerable": True, "answer": answer,
            "citations": [_citation(h) for h in cited], "retrieval": meta}
