<p align="center"><img src="web/logo.svg" alt="Unsilo" width="96"></p>

# Unsilo

**Ask your WhatsApp, Gmail and Drive anything. Every answer shows its receipts.**

Unsilo reads a company's three silos through the official read-only APIs, makes sense of each one,
and answers plain-English questions across all of them. Each answer cites the email, document or
WhatsApp message it came from, and says "not in the data" instead of guessing.

## Run it

Python 3.11+.

```bash
python -m venv .venv
source .venv/bin/activate              # Windows: .venv\Scripts\Activate.ps1
pip install -r requirements.txt
cp .env.example .env                   # then fill in the values (see below)

cd src
uvicorn app.main:app --reload --port 8000
```

Open **http://localhost:8000**. The UI and the API run on the same port, so there is no separate frontend build.

## Connect the sources

| Source | What to set in `.env` | Then |
| --- | --- | --- |
| Gmail + Drive (OAuth) | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `SANDBOX_EMAIL`. Redirect URI in Google Cloud: `http://localhost:8000/api/oauth/google/callback` | **Sources → Connect Google**, sign in, then **Sync Gmail** / **Sync Drive** |
| Drive (no OAuth) | `DRIVE_API_KEY` + `DRIVE_FOLDER_ID` of a folder shared as "Anyone with the link" | **Sync Drive** |
| WhatsApp | `WHATSAPP_VERIFY_TOKEN`, `META_APP_SECRET`; real group ids or names in `config/selected_groups.json` | `cloudflared tunnel --url http://localhost:8000`, give Meta `https://<tunnel>/api/webhooks/whatsapp` + the verify token |
| AI answers | `GEMINI_API_KEY` (optional) | Without it, labels use keyword rules and answers list the top cited records |
| Dates | `REFERENCE_DATE=YYYY-MM-DD` (from kickoff) | Used for "unanswered for 5+ days" and "last month" |

A Google API key (`AIza…`) cannot read Gmail; Google only accepts OAuth for mailboxes.
Opening the webhook URL in a browser returns 403. That is expected: only Meta's request carries the verify token.

## Outputs

**Outputs → Write outputs/ files** (or `POST /api/export`) writes:

- `outputs/whatsapp_output.json`: selected groups, participants, messages, summary, asks, commitments, decisions, action items
- `outputs/gmail_output.json`: team label (sales / marketing / other) with reason, unanswered emails (5+ days), business-critical attachments with reason
- `outputs/drive_output.json`: one category per document (sales / marketing / verification / office / accounts) with a one-line reason

## How it works

```
WhatsApp webhook ──(HMAC check, selected groups only)──┐
Gmail API (gmail.readonly) ────────────────────────────┼─> SQLite ─> analysis (Gemini or rules) ─> outputs/*.json
Drive API (drive.readonly, PDF/DOCX/XLSX/Docs/Sheets) ─┘      │
                                                              └─> FTS5 BM25 index ─> /api/ask ─> grounded answer + citations
```

| File | Job |
| --- | --- |
| `src/app/settings.py` | Every setting from `.env`; the two allowed Google scopes |
| `src/app/db.py` | SQLite tables and the search index |
| `src/app/whatsapp.py` | Webhook signature check, selected-groups filter, message storage |
| `src/app/google.py` | OAuth (state + scope check), Gmail sync, Drive sync |
| `src/app/extract.py` | Text from PDF, Word, Excel, CSV |
| `src/app/ai.py` | Gemini JSON calls with model fallback; returns nothing when no key |
| `src/app/analyse.py` | Email teams, unanswered, attachment flags, Drive categories, WhatsApp interpretation |
| `src/app/ask.py` | Date-aware search and grounded answers (no valid citation means "I don't know") |
| `src/app/export.py` | The three output files |
| `src/app/main.py` | API routes and the UI |
| `web/` | One-page UI (Ask, Sources, Gmail, Drive, WhatsApp, Outputs) |

## API

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | AI mode, Google status, counts, reference date |
| GET | `/api/oauth/google/start` · `/callback` | Google sign-in |
| POST | `/api/sync/gmail` · `/api/sync/drive` | Pull and analyse a source |
| POST | `/api/analyse` | Re-run analysis |
| POST | `/api/ask` | `{"question": "..."}` → answer, citations, search details |
| GET | `/api/outputs/{whatsapp,gmail,drive}` | Output preview |
| POST | `/api/export` | Write `outputs/*.json` |
| GET/POST | `/api/webhooks/whatsapp` | Meta verification · events |
| GET | `/api/whatsapp/groups` | Groups with messages and interpretation |
| POST | `/api/whatsapp/participants` | Load organiser-provided participant lists |

## Security and rules

- Google scopes are exactly `gmail.readonly` and `drive.readonly`; the callback rejects anything else.
- Read-only: no send, delete, label or modify calls anywhere.
- WhatsApp: official Cloud API webhooks only, every POST checked with `X-Hub-Signature-256`.
  Messages from groups not in `selected_groups.json` are dropped before storage; logs hold counts only.
- Secrets live in `.env` (gitignored). The Google token is stored in `data/` (gitignored).

## Known limitations

- The exact WhatsApp group-id field depends on the organiser's setup; `whatsapp._group_of()` checks several places.
- Output JSON shapes follow the task text; adjust `export.py` if the organisers share a schema.
- Keyword-rule labels are rough; set `GEMINI_API_KEY` for the AI path.
- Images and scanned PDFs are not OCR'd.
