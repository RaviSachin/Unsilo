"""Read-only list endpoints for the React UI: Gmail clone, Drive clone. Nothing here writes to Google."""
from fastapi import APIRouter, HTTPException

from . import ai, analyse, db, google, settings

router = APIRouter(prefix="/api")


def _snippet(text: str, n: int = 180) -> str:
    return " ".join((text or "").split())[:n]


def _email_meta(e: dict, teams: dict, atts: dict, pending: dict) -> dict:
    team = teams.get(e["id"], {})
    flags = atts.get(e["id"], {}).get("attachments", [])
    return {
        "id": e["id"], "thread_id": e["thread_id"], "from_addr": e["from_addr"], "from_name": e["from_name"] or "",
        "to": e["to"], "subject": e["subject"] or "(no subject)", "snippet": _snippet(e["body"]),
        "sent_at": e["sent_at"], "labels": e["labels"],
        "attachments": [{"filename": a["filename"], "mime_type": a.get("mime_type", "")} for a in e["attachments"]],
        "team": team.get("team"), "team_reason": team.get("reason"), "team_method": team.get("method"),
        "unanswered_days": pending.get(e["id"]), "critical": flags,
        "url": f"https://mail.google.com/mail/u/0/#all/{e['id']}",
    }


def _email_context():
    emails = google.emails()
    pending = {u["message_id"]: u["days_without_reply"] for u in analyse.unanswered(emails)}
    return emails, db.results("email_team"), db.results("email_attachments"), pending


@router.get("/emails")
def list_emails():
    """Every synced email (newest first) with its Unsilo labels. Bodies are left out to keep the list fast."""
    emails, teams, atts, pending = _email_context()
    out = [_email_meta(e, teams, atts, pending) for e in emails]
    out.sort(key=lambda m: m["sent_at"] or "", reverse=True)
    return {"reference_date": settings.reference_date().date().isoformat(),
            "unanswered_days": settings.UNANSWERED_DAYS, "emails": out}


@router.get("/emails/{email_id}")
def get_email(email_id: str):
    """One email with its full body, attachment text previews and the rest of its thread."""
    emails, teams, atts, pending = _email_context()
    found = next((e for e in emails if e["id"] == email_id), None)
    if not found:
        raise HTTPException(404, "Email not found")
    item = _email_meta(found, teams, atts, pending)
    item["body"] = found["body"]
    item["attachments"] = [{"filename": a["filename"], "mime_type": a.get("mime_type", ""),
                            "preview": _snippet(a.get("text") or "", 400)} for a in found["attachments"]]
    item["thread"] = [_email_meta(e, teams, atts, pending) | {"body": e["body"]}
                      for e in sorted(emails, key=lambda x: x["sent_at"] or "")
                      if e["thread_id"] == found["thread_id"] and e["id"] != found["id"]]
    return item


@router.get("/documents")
def list_documents():
    """Every synced Drive file with its category. Videos and images are included (kept by name)."""
    cats = db.results("drive_category")
    docs = []
    for d in google.documents():
        c = cats.get(d["id"], {})
        docs.append({"id": d["id"], "name": d["name"], "mime_type": d["mime_type"], "modified_at": d["modified_at"],
                     "url": d["url"] or f"https://drive.google.com/file/d/{d['id']}/view",
                     "category": c.get("category"), "reason": c.get("reason"), "method": c.get("method"),
                     "preview": _snippet(d["text"], 260), "has_text": bool(d["text"]), "error": d["error"]})
    docs.sort(key=lambda x: x["modified_at"] or "", reverse=True)
    return {"documents": docs}


DRAFT_PROMPT = ("You write short, polite business email replies for an equipment rental / construction / mining company. "
                "Use ONLY facts from the email thread; never invent prices, dates or commitments. Where a fact is needed "
                "but missing, leave a clear placeholder like [confirm date]. Plain text, no markdown, sign off as 'Team'.")
DRAFT_SCHEMA = ai.obj({"subject": ai.STR, "body": ai.STR, "key_points": ai.STRS})


def _template_reply(e: dict) -> dict:
    name = (e["from_name"] or e["from_addr"].split("@")[0]).split()[0].title()
    atts = [a["filename"] for a in e["attachments"]]
    lines = [f"Hi {name},", "", f"Thank you for your email about \"{e['subject']}\"."]
    if atts:
        lines.append(f"We have received {', '.join(atts)} and our team is reviewing it.")
    lines += ["We will get back to you with the details by [confirm date].", "", "Regards,", "Team"]
    subject = e["subject"] if e["subject"].lower().startswith("re:") else f"Re: {e['subject']}"
    return {"subject": subject, "body": "\n".join(lines), "key_points": [], "method": "template"}


@router.get("/emails/{email_id}/draft")
def draft_reply(email_id: str):
    """Suggested reply (shown in the compose window; the user sends it from Gmail, Unsilo never sends mail)."""
    emails = google.emails()
    e = next((x for x in emails if x["id"] == email_id), None)
    if not e:
        raise HTTPException(404, "Email not found")
    thread = sorted((x for x in emails if x["thread_id"] == e["thread_id"]), key=lambda x: x["sent_at"] or "")
    text = "\n\n".join(f"From: {x['from_name']} <{x['from_addr']}>\nDate: {x['sent_at']}\nSubject: {x['subject']}\n"
                        f"Attachments: {', '.join(a['filename'] for a in x['attachments']) or 'none'}\n\n{(x['body'] or '')[:3000]}"
                        for x in thread[-6:])
    out = ai.json_call(DRAFT_PROMPT, f"Write the reply to the last email from {e['from_addr']}.\n\n{text}", DRAFT_SCHEMA, 2000)
    if out and out.get("body"):
        return {"to": e["from_addr"], "subject": out["subject"] or f"Re: {e['subject']}", "body": out["body"],
                "key_points": out.get("key_points", []), "method": "ai"}
    return {"to": e["from_addr"], **_template_reply(e)}
