<p align="center"><img src="web/logo.svg" alt="Unsilo" width="96"></p>

# Unsilo

**Ask your WhatsApp, Gmail and Drive anything. Every answer shows its receipts.**

Unsilo brings read-only Gmail, Google Drive and selected WhatsApp business information into one searchable workspace. The React frontend is designed for construction, equipment-rental and field operations.

## Project structure

```text
unsilo/
├── frontend/             # React + TypeScript + Vite source
│   ├── src/
│   │   ├── components/   # Reusable UI and 3D equipment scene
│   │   ├── App.tsx       # Single-page application
│   │   ├── type.ts       # API types and shared helpers
│   │   └── style.ts      # Shared style tokens
│   ├── package.json
│   └── vite.config.ts
├── web/                  # Production frontend build served by FastAPI
├── src/app/              # FastAPI backend and API routes
├── config/               # WhatsApp selected-groups configuration
├── fixtures/             # Sample/demo input data
├── outputs/              # Generated JSON reports (created at runtime)
├── tests/
├── requirements.txt
└── README.md
```

## Requirements

- Python 3.11+
- Node.js 20+ and npm

## Run in development mode

### 1. Configure and start the backend

Open PowerShell in the `unsilo` project folder:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
Copy-Item .env.example .env
```

Add your own credentials/configuration to `.env` if you want live Google, WhatsApp or AI integrations.

Start FastAPI:

```powershell
cd src
uvicorn app.main:app --reload --port 8000
```

Backend API docs: http://localhost:8000/docs

### 2. Start the React frontend

Open a **second terminal** in the `unsilo` project folder:

```powershell
cd frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal, normally http://localhost:5173.

The Vite development server proxies `/api` requests to `http://localhost:8000`, so the React app uses the existing FastAPI backend.

## Build React for the FastAPI web route

To serve the React frontend directly from **http://localhost:8000**:

```powershell
cd frontend
npm install
npm run build
```

The Vite build is configured to write production files into `../web`. FastAPI already serves that directory at `/static` and returns `web/index.html` at `/`.

Then start/restart the backend from `src`:

```powershell
cd ..\src
uvicorn app.main:app --reload --port 8000
```

Run `npm run build` again whenever you change the React frontend and want those changes reflected on the FastAPI root URL.

## Frontend features

- React + TypeScript single-page application.
- Vite development server and production build.
- Framer Motion page and interaction animations.
- Three.js / React Three Fiber animated excavator scene.
- Collapsible sidebar and construction/rental visual theme.
- Gmail-inspired inbox, category filters, search and message preview.
- Drive-inspired file library with image/video thumbnails and media preview.
- Ask Unsilo, Connections, WhatsApp/site updates and Reports views.
- Lucide icon set and shared TypeScript API contracts.

## Existing backend API routes used

The React app calls the existing FastAPI routes; it does not require a separate backend:

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/api/health` | Backend and connection status |
| GET | `/api/oauth/google/start` | Start Google OAuth |
| POST | `/api/sync/gmail` | Sync Gmail |
| POST | `/api/sync/drive` | Sync Drive |
| POST | `/api/analyse` | Re-run analysis |
| POST | `/api/ask` | Ask a question across connected sources |
| GET | `/api/outputs/gmail` | Gmail analysis output |
| GET | `/api/outputs/drive` | Drive analysis output |
| GET | `/api/outputs/whatsapp` | WhatsApp analysis output |
| GET | `/api/whatsapp/groups` | WhatsApp groups and messages |
| POST | `/api/export` | Generate output JSON files |

## Live integrations

1. Copy `.env.example` to `.env` and enter your own credentials.
2. Configure Google OAuth redirect URI as `http://localhost:8000/api/oauth/google/callback`.
3. Start the backend and connect Google from the Connections screen.
4. Sync Gmail and Drive from the UI.
5. Configure the WhatsApp Cloud API webhook and selected group IDs as described in `.env.example` and `config/selected_groups.json`.

## Important data notes

- The Gmail endpoint currently returns message metadata and attachment metadata, not the original email body. The UI does not invent email content.
- The Drive endpoint returns file IDs, MIME types and Drive URLs. Thumbnail rendering depends on Google Drive permissions and file availability.
- The frontend performs no Gmail send/delete/label operations and no Drive modification operations.
- Local `.env`, OAuth tokens, runtime databases and generated reports are not included in this source archive. Create/configure them locally.

## Tests

From the `unsilo` project folder:

```powershell
.\.venv\Scripts\Activate.ps1
pytest -q
```
