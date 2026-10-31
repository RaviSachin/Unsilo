import hashlib
import hmac
import json

from unsilo import export
from unsilo.analysis import gmail_triage
from unsilo.config import GOOGLE_SCOPES, settings
from unsilo.connectors import gmail, whatsapp
from unsilo.query.answer import NOT_FOUND, ask


def test_only_readonly_scopes():
    assert GOOGLE_SCOPES == ["https://www.googleapis.com/auth/gmail.readonly",
                             "https://www.googleapis.com/auth/drive.readonly"]


def test_unselected_group_is_never_stored(conn):
    rows = conn.execute("SELECT group_id FROM wa_messages UNION SELECT group_id FROM wa_raw_events").fetchall()
    assert {r[0] for r in rows} == {"120363000000000001@g.us", "120363000000000002@g.us"}
    assert conn.execute("SELECT COUNT(*) FROM records WHERE body LIKE '%Party%'").fetchone()[0] == 0


def test_webhook_replay_does_not_duplicate(conn):
    before = conn.execute("SELECT COUNT(*) FROM wa_messages").fetchone()[0]
    line = (settings.selected_groups_file.parents[1] / "fixtures/whatsapp_webhooks.jsonl").read_text().splitlines()[0]
    whatsapp.ingest(conn, json.loads(line))
    assert conn.execute("SELECT COUNT(*) FROM wa_messages").fetchone()[0] == before


def test_signature_check(monkeypatch):
    monkeypatch.setattr(settings, "meta_app_secret", "s3cret")
    body = b'{"entry": []}'
    good = "sha256=" + hmac.new(b"s3cret", body, hashlib.sha256).hexdigest()
    assert whatsapp.verify_signature(body, good)
    assert not whatsapp.verify_signature(body, "sha256=deadbeef")
    assert not whatsapp.verify_signature(body, None)


def test_unanswered_respects_replies_and_age(conn):
    ids = {u["message_id"] for u in gmail_triage.find_unanswered(gmail.load_emails(conn))}
    assert "m06" not in ids          # we replied after it
    assert "m04" in ids              # 7 days, no reply
    assert "m11" not in ids          # only 2 days old
    assert "m02" not in ids          # our own outbound mail


def test_attachment_flags(conn):
    out = export.gmail_payload(conn)
    flagged = {(a["message_id"], a["kind"]) for a in out["important_attachments"]}
    assert ("m03", "purchase order") in flagged
    assert ("m06", "invoice") in flagged
    assert ("m08", "KYC/verification") in flagged
    assert all(a["reason"] for a in out["important_attachments"])


def test_drive_categories(conn):
    cats = {d["file_id"]: d["category"] for d in export.drive_payload(conn)["documents"]}
    assert cats == {"d01": "sales", "d02": "sales", "d03": "marketing", "d04": "verification",
                    "d05": "office", "d06": "accounts", "d07": "office"}


def test_outputs_written(conn):
    paths = export.write_all(conn)
    assert len(paths) == 3
    wa = json.loads(open(paths[0]).read())
    site = next(g for g in wa["groups"] if g["group_name"] == "Site Team Pune")
    assert len(site["participants"]) == 3 and len(site["messages"]) == 5


def test_answer_cites_sources(conn):
    result = ask(conn, "What were our sales last month?")
    assert result["answerable"]
    assert result["citations"][0]["source_id"] == "drive:d01"


def test_unknown_question_says_so(conn):
    result = ask(conn, "zzqx flibbertigibbet")
    assert not result["answerable"] and result["answer"] == NOT_FOUND and result["citations"] == []


def test_empty_question(conn):
    assert ask(conn, "   the of and ")["answerable"] is False


def test_api_routes(conn, monkeypatch):
    from fastapi.testclient import TestClient

    from unsilo.api import app

    monkeypatch.setattr(settings, "whatsapp_verify_token", "tok")
    monkeypatch.setattr(settings, "meta_app_secret", "")
    monkeypatch.setattr(settings, "whatsapp_require_signature", True)
    client = TestClient(app)
    assert client.get("/api/health").json()["ok"]
    assert client.get("/api/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "tok",
                                                        "hub.challenge": "42"}).text == "42"
    assert client.get("/api/webhooks/whatsapp", params={"hub.mode": "subscribe", "hub.verify_token": "bad",
                                                        "hub.challenge": "42"}).status_code == 403
    assert client.post("/api/webhooks/whatsapp", content=b"{}").status_code == 401  # no secret + required
    r = client.post("/api/ask", json={"question": "Where is the latest quotation for Shree Constructions?"}).json()
    assert r["citations"][0]["source_id"] == "drive:d02"
    assert {c["provider"] for c in client.get("/api/connections").json()} == {"gmail", "drive", "whatsapp"}
