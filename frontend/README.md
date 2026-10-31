# Unsilo React frontend

React + TypeScript + Vite frontend for the existing Unsilo FastAPI backend.

## Development

Start the backend in another terminal on `http://localhost:8000`, then:

```powershell
npm install
npm run dev
```

Open `http://localhost:5173`. Vite proxies `/api` requests to the backend.

## Production build

```powershell
npm install
npm run build
```

The Vite configuration uses `/static/` as the asset base and writes the build into `../web`. FastAPI serves `web/index.html` at `/` and the generated assets at `/static`.

## Backend API contract

The frontend uses the existing endpoints:

- `GET /api/health`
- `GET /api/oauth/google/start`
- `POST /api/sync/gmail` and `POST /api/sync/drive`
- `POST /api/analyse`
- `POST /api/ask`
- `GET /api/outputs/gmail`, `/api/outputs/drive`, `/api/outputs/whatsapp`
- `GET /api/whatsapp/groups`
- `POST /api/export`

The frontend does not add or modify backend routes. See `../README.md` for full application setup and API notes.
