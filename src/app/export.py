"""outputs/*.json. When the organiser's schema arrives, change only these three functions."""
import json
from datetime import datetime, timezone

from . import analyse, db, google, settings, whatsapp


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def whatsapp_output() -> dict:
    interp = db.results("wa_interpretation")
    return {"generated_at": _now(), "selected_groups": [g.get("name") or g.get("id") for g in settings.selected_groups()],
            "groups": [{"group_id": g["group_id"], "group_name": g["name"],
                        "participants": [{"name": p["name"], "number": p["wa_id"]} for p in g["participants"]],
                        "messages": [{"message_id": m["message_id"], "sender_name": m["sender_name"],
                                      "sender_number": m["sender_id"], "timestamp": m["sent_at"], "type": m["type"],
                                      "text": m["text"]} for m in g["messages"]],
                        "interpretation": interp.get(g["group_id"], {})} for g in whatsapp.groups()]}


def gmail_output() -> dict:
    emails = google.emails()
    teams, atts = db.results("email_team"), db.results("email_attachments")
    subject = {e["id"]: e["subject"] for e in emails}
    return {"generated_at": _now(), "reference_date": settings.reference_date().date().isoformat(),
            "emails": [{"message_id": e["id"], "thread_id": e["thread_id"], "from": e["from_addr"], "subject": e["subject"],
                        "date": e["sent_at"], "classification": teams.get(e["id"], {}).get("team"),
                        "classification_reason": teams.get(e["id"], {}).get("reason"),
                        "important_attachment": atts.get(e["id"], {}).get("flagged", False),
                        "attachment_flags": atts.get(e["id"], {}).get("attachments", [])} for e in emails],
            "unanswered": analyse.unanswered(emails),
            "important_attachments": [{"message_id": mid, "subject": subject.get(mid, ""), **a}
                                      for mid, r in atts.items() for a in r.get("attachments", [])]}


def drive_output() -> dict:
    cats = db.results("drive_category")
    return {"generated_at": _now(), "documents": [
        {"file_id": d["id"], "name": d["name"], "mime_type": d["mime_type"], "url": d["url"],
         "category": cats.get(d["id"], {}).get("category"), "reason": cats.get(d["id"], {}).get("reason"),
         "extraction_error": d["error"]} for d in google.documents()]}


def write_all() -> list[str]:
    settings.OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    paths = []
    for name, fn in (("whatsapp_output.json", whatsapp_output), ("gmail_output.json", gmail_output),
                     ("drive_output.json", drive_output)):
        path = settings.OUTPUT_DIR / name
        path.write_text(json.dumps(fn(), indent=2, ensure_ascii=False), encoding="utf-8")
        paths.append(str(path))
    return paths
