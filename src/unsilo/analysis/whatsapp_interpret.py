"""Task 1 interpretation: summary, per-participant asks and commitments, action items, decisions."""
from __future__ import annotations

import re
import sqlite3

from .. import db, llm

SYSTEM = (
    "You read a WhatsApp group chat from an equipment-rental business and report what happened. "
    "Use only what the messages say. Cite message ids for every ask, commitment, action item and decision."
)

SCHEMA = {
    "type": "object",
    "properties": {
        "summary": {"type": "string"},
        "participants": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "name": {"type": "string"},
                    "number": {"type": "string"},
                    "asking_for": {"type": "array", "items": {"type": "string"}},
                    "committing_to": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["name", "number", "asking_for", "committing_to"],
                "additionalProperties": False,
            },
        },
        "action_items": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "task": {"type": "string"},
                    "owner": {"type": "string"},
                    "due": {"type": "string"},
                    "message_ids": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["task", "owner", "due", "message_ids"],
                "additionalProperties": False,
            },
        },
        "decisions": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "decision": {"type": "string"},
                    "message_ids": {"type": "array", "items": {"type": "string"}},
                },
                "required": ["decision", "message_ids"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["summary", "participants", "action_items", "decisions"],
    "additionalProperties": False,
}

ASK = re.compile(r"\?|\b(please|pls|can you|could you|need|send|share|want|require|kindly)\b", re.I)
COMMIT = re.compile(r"\b(i will|i'll|will do|we will|we'll|done|on it|by (today|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday|eod)|i can)\b", re.I)
DECIDE = re.compile(r"\b(agreed|confirmed|final|finalised|finalized|approved|decided|go ahead|ok done|let's go with)\b", re.I)


def _transcript(group: dict) -> str:
    return "\n".join(
        f'[{m["message_id"]}] {m["sent_at"][:16]} {m["sender_name"] or m["sender_id"]} ({m["sender_id"]}): {m["text"]}'
        for m in group["messages"]
    )


def _rules(group: dict) -> dict:
    people: dict[str, dict] = {}
    for p in group["participants"]:
        people[p["wa_id"]] = {"name": p["name"] or p["wa_id"], "number": p["wa_id"], "asking_for": [], "committing_to": []}
    actions, decisions = [], []
    for m in group["messages"]:
        who = people.setdefault(m["sender_id"], {"name": m["sender_name"] or m["sender_id"], "number": m["sender_id"],
                                                 "asking_for": [], "committing_to": []})
        text = m["text"] or ""
        if COMMIT.search(text):
            who["committing_to"].append(text)
            actions.append({"task": text, "owner": who["name"], "due": "", "message_ids": [m["message_id"]]})
        elif ASK.search(text):
            who["asking_for"].append(text)
        if DECIDE.search(text):
            decisions.append({"decision": text, "message_ids": [m["message_id"]]})
    n = len(group["messages"])
    speakers = len({m["sender_id"] for m in group["messages"]})
    summary = (f'{n} messages from {speakers} participants in "{group["name"]}". '
               f'{len(actions)} commitments and {len(decisions)} decisions detected by keyword rules.')
    return {"summary": summary, "participants": list(people.values()), "action_items": actions,
            "decisions": decisions, "method": "rules"}


def interpret(group: dict) -> dict:
    if not group["messages"]:
        return {"summary": "No messages received yet.", "participants": [], "action_items": [], "decisions": [],
                "method": "none"}
    roster = "\n".join(f'- {p["name"] or "?"} ({p["wa_id"]})' for p in group["participants"])
    prompt = f'Group: {group["name"]}\nParticipants:\n{roster}\n\nMessages:\n{_transcript(group)[-60000:]}'
    out = llm.json_call(SYSTEM, prompt, SCHEMA, effort="medium", max_tokens=8000)
    if out:
        out["method"] = "llm"
        return out
    return _rules(group)


def run(conn: sqlite3.Connection, groups: list[dict]) -> dict[str, dict]:
    results = {g["group_id"]: interpret(g) for g in groups}
    with db.tx(conn):
        for gid, r in results.items():
            db.save_analysis(conn, "wa_interpretation", gid, r)
            # The interpretation itself becomes searchable, cited as the group
            group = next(g for g in groups if g["group_id"] == gid)
            body = "\n".join([r["summary"]]
                             + [f'Action: {a["task"]} (owner {a["owner"]})' for a in r["action_items"]]
                             + [f'Decision: {d["decision"]}' for d in r["decisions"]])
            last = group["messages"][-1]["sent_at"] if group["messages"] else ""
            db.upsert_record(conn, provider="whatsapp_summary", external_id=gid,
                             title=f'WhatsApp group summary: {group["name"]}', body=body, occurred_at=last,
                             labels="summary agreed decided action items", extra={"group_id": gid})
    return results
