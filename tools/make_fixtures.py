"""Generates the synthetic practice data in fixtures/. Run: python tools/make_fixtures.py"""
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path

OUT = Path(__file__).resolve().parents[1] / "fixtures"
REF = datetime(2026, 10, 20, 18, 0, tzinfo=timezone.utc)
US = "ops@e9sandbox.example"


def at(days_ago, hour=10):
    return (REF - timedelta(days=days_ago)).replace(hour=hour, minute=0).isoformat()


def email(mid, thread, frm, name, subject, body, days_ago, to=US, atts=(), sent=False):
    return {"message_id": mid, "thread_id": thread, "from_addr": frm, "from_name": name, "to": [to], "cc": [],
            "subject": subject, "body": body, "sent_at": at(days_ago), "label_ids": ["SENT"] if sent else ["INBOX"],
            "attachments": [{"filename": f, "mime_type": m, "size": 20000, "text": t} for f, m, t in atts]}


PDF = "application/pdf"
emails = [
    email("m01", "t01", "purchase@shreeconstructions.in", "Anil Kulkarni", "Enquiry: 2 excavators for Hinjewadi site",
          "Hi, we need two 20-ton excavators for 45 days starting 1 Nov at Hinjewadi Phase 3. Please share your best rental rate and availability.", 12),
    email("m02", "t01", US, "E9 Ops", "Re: Enquiry: 2 excavators for Hinjewadi site",
          "Dear Anil, thanks. Quotation attached: Rs 1,85,000 per machine per month, operator included.", 11,
          to="purchase@shreeconstructions.in", atts=[("Quotation_Shree_Excavators.pdf", PDF, "QUOTATION No Q-2291 Excavator 20T x2 Rs 1,85,000 per month")], sent=True),
    email("m03", "t01", "purchase@shreeconstructions.in", "Anil Kulkarni", "Re: Enquiry: 2 excavators for Hinjewadi site",
          "Rate is acceptable. Please find our purchase order attached. Kindly confirm dispatch date.", 9,
          atts=[("PO-SC-4471.pdf", PDF, "PURCHASE ORDER PO-SC-4471 Shree Constructions 2 x Excavator 20T")]),
    email("m04", "t04", "rohit@metrobuildcorp.com", "Rohit Shah", "Crane rental quote needed urgently",
          "Can you quote for a 50-ton mobile crane for 10 days at Kharadi? Need it by next Monday.", 7),
    email("m05", "t05", "hello@buzzmedia.agency", "Buzz Media", "October social media campaign report",
          "Attached is the campaign performance for the Instagram and LinkedIn ads. Reach 48k, 312 leads.", 6,
          atts=[("campaign_report_oct.pdf", PDF, "Campaign report Instagram LinkedIn ads reach")]),
    email("m06", "t06", "accounts@deccaninfra.in", "Deccan Infra Accounts", "Invoice INV-7781 payment status",
          "Please confirm when payment for invoice INV-7781 (Rs 3,40,000) for the backhoe loader rental will be released.", 8,
          atts=[("INV-7781.pdf", PDF, "TAX INVOICE INV-7781 Backhoe loader rental Rs 3,40,000")]),
    email("m07", "t06", US, "E9 Ops", "Re: Invoice INV-7781 payment status",
          "Payment has been scheduled for 25 Oct.", 7, to="accounts@deccaninfra.in", sent=True),
    email("m08", "t08", "kyc@patilenterprises.co.in", "Patil Enterprises", "KYC documents for vendor onboarding",
          "As requested, attaching our GST certificate and PAN card copy for verification.", 6,
          atts=[("GST_Certificate_Patil.pdf", PDF, "GSTIN 27ABCDE1234F1Z5 certificate of registration"),
                ("PAN_Patil.jpg", "image/jpeg", "")]),
    email("m09", "t09", "events@constructionexpo.in", "Construction Expo", "Booth booking for Pune Construction Expo 2026",
          "Book your stall at the Pune Construction Expo. Early bird pricing ends soon. Brochure attached.", 10,
          atts=[("Expo_brochure.pdf", PDF, "brochure exhibition stall sizes")]),
    email("m10", "t10", "it-support@e9sandbox.example", "IT Support", "Scheduled password reset",
          "Your mailbox password will expire in 3 days.", 3),
    email("m11", "t11", "sunita@greenfieldhomes.in", "Sunita Rao", "Rental agreement draft for 3 JCBs",
          "Please review the attached rental agreement draft and confirm the terms by Friday.", 2,
          atts=[("Rental_Agreement_Greenfield.docx", "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                 "RENTAL AGREEMENT between Greenfield Homes and E9 for 3 JCB backhoe loaders")]),
    email("m12", "t12", "newsletter@infraweekly.com", "Infra Weekly", "This week in infrastructure",
          "Top stories: metro line 3 progress, cement prices, new tender notices.", 15),
]

drive = [
    {"file_id": "d01", "name": "Sales Report September 2026.xlsx", "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
     "modified_at": "2026-10-02T09:00:00+00:00", "web_url": "https://drive.google.com/file/d/d01",
     "text": "# Sheet: Summary\nMonth | Rentals closed | Revenue (INR)\nAugust 2026 | 14 | 21,40,000\nSeptember 2026 | 18 | 27,85,000\n# Sheet: Top customers\nShree Constructions | 6,20,000\nDeccan Infra | 4,10,000", "extract_error": None},
    {"file_id": "d02", "name": "Q-2291 Quotation Shree Constructions.pdf", "mime_type": "application/pdf",
     "modified_at": "2026-10-09T09:00:00+00:00", "web_url": "https://drive.google.com/file/d/d02",
     "text": "QUOTATION Q-2291 To Shree Constructions. 2 x 20T excavator, Rs 1,85,000 per machine per month, 45 days, operator included. Valid 15 days.", "extract_error": None},
    {"file_id": "d03", "name": "Diwali Campaign Plan", "mime_type": "application/vnd.google-apps.document",
     "modified_at": "2026-10-05T09:00:00+00:00", "web_url": "https://docs.google.com/document/d/d03",
     "text": "Diwali marketing campaign: Instagram reels, LinkedIn ads targeting contractors, 10% festive discount banner, budget Rs 80,000.", "extract_error": None},
    {"file_id": "d04", "name": "Vendor KYC - Patil Enterprises.pdf", "mime_type": "application/pdf",
     "modified_at": "2026-10-14T09:00:00+00:00", "web_url": "https://drive.google.com/file/d/d04",
     "text": "KYC form. Vendor: Patil Enterprises. PAN: ABCDE1234F. GSTIN 27ABCDE1234F1Z5. Aadhaar of proprietor verified.", "extract_error": None},
    {"file_id": "d05", "name": "Office Leave Policy 2026.docx", "mime_type": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
     "modified_at": "2026-01-10T09:00:00+00:00", "web_url": "https://drive.google.com/file/d/d05",
     "text": "Leave policy: 18 paid leaves per year, attendance through biometric, holidays list attached. HR approval needed.", "extract_error": None},
    {"file_id": "d06", "name": "Expense Ledger Oct 2026", "mime_type": "application/vnd.google-apps.spreadsheet",
     "modified_at": "2026-10-18T09:00:00+00:00", "web_url": "https://docs.google.com/spreadsheets/d/d06",
     "text": "# Sheet: Ledger\nDate | Head | Amount\n2026-10-03 | Diesel | 1,20,000\n2026-10-07 | Machine repair | 65,000\n2026-10-12 | Salaries | 4,80,000", "extract_error": None},
    {"file_id": "d07", "name": "Site meeting minutes 15 Oct", "mime_type": "application/vnd.google-apps.document",
     "modified_at": "2026-10-15T12:00:00+00:00", "web_url": "https://docs.google.com/document/d/d07",
     "text": "Minutes of meeting, office: safety audit scheduled 22 Oct, new security guard roster from Monday.", "extract_error": None},
]

SITE, SALES, OTHER = "120363000000000001@g.us", "120363000000000002@g.us", "120363000000000099@g.us"
people = {"919800000001": "Ravi (Site Lead)", "919800000002": "Meena (Ops)", "919800000003": "Sachin (Sales)",
          "919800000004": "Gaurav (Driver)", "919800000009": "Personal Friend"}


def wa(gid, n, frm, days_ago, hour, text):
    ts = int((REF - timedelta(days=days_ago)).replace(hour=hour, minute=0).timestamp())
    return {"object": "whatsapp_business_account", "entry": [{"id": "WABA_SANDBOX", "changes": [{"field": "messages", "value": {
        "messaging_product": "whatsapp", "metadata": {"display_phone_number": "917822095128", "phone_number_id": "PNID"},
        "contacts": [{"profile": {"name": people[frm]}, "wa_id": frm}],
        "messages": [{"from": frm, "id": f"wamid.{gid[12:18]}{n:03d}", "timestamp": str(ts), "type": "text",
                      "group_id": gid, "text": {"body": text}}]}}]}]}


webhooks = [
    wa(SITE, 1, "919800000001", 2, 9, "Morning all. Hinjewadi site needs 2 excavators by 1 Nov, can ops confirm?"),
    wa(SITE, 2, "919800000002", 2, 10, "Shree Constructions PO received. I will arrange dispatch on 30 Oct."),
    wa(SITE, 3, "919800000004", 2, 11, "I can drive the first excavator, need the trailer permit by Thursday."),
    wa(SITE, 4, "919800000002", 1, 9, "Permit applied. Agreed: dispatch 30 Oct 6am, Gaurav drives unit 1."),
    wa(SITE, 5, "919800000001", 1, 10, "Confirmed. Also please send the site safety checklist."),
    wa(SALES, 1, "919800000003", 3, 12, "Metro Buildcorp wants a 50T crane for 10 days at Kharadi, who is quoting?"),
    wa(SALES, 2, "919800000002", 3, 13, "I'll send the crane quote by tomorrow."),
    wa(OTHER, 1, "919800000009", 1, 20, "Party at my place Saturday?"),  # not selected: must be dropped
]

groups_meta = {"groups": [
    {"group_id": SITE, "name": "Site Team Pune", "participants": [{"wa_id": k, "name": people[k]} for k in ["919800000001", "919800000002", "919800000004"]]},
    {"group_id": SALES, "name": "Sales Leads", "participants": [{"wa_id": k, "name": people[k]} for k in ["919800000002", "919800000003"]]},
    {"group_id": OTHER, "name": "Weekend Plans", "participants": [{"wa_id": "919800000009", "name": "Personal Friend"}]},
]}

OUT.mkdir(exist_ok=True)
(OUT / "gmail.json").write_text(json.dumps(emails, indent=2))
(OUT / "drive.json").write_text(json.dumps(drive, indent=2))
(OUT / "whatsapp_webhooks.jsonl").write_text("\n".join(json.dumps(w) for w in webhooks) + "\n")
(OUT / "whatsapp_groups.json").write_text(json.dumps(groups_meta, indent=2))
(OUT / "meta.json").write_text(json.dumps({"reference_date": REF.date().isoformat(), "sandbox_email": US}, indent=2))
print("fixtures written to", OUT)
