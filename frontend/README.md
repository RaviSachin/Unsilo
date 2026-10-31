# Unsilo UI (React + TypeScript + MUI + framer-motion)

Field-intelligence dashboard for rental, construction and mining teams.

## Run (development, hot reload)

```bash
# terminal 1 – backend (from the unsilo folder)
cd src
uvicorn app.main:app --reload --port 8000

# terminal 2 – frontend
cd frontend
npm install          # first time only
npm run dev          # http://localhost:5173  (calls /api on :8000 through the Vite proxy)
```

## Run (production build, one port)

```bash
cd frontend
npm run build        # writes frontend/dist
# restart uvicorn → open http://localhost:8000  (old UI stays at /classic)
```

Use the built version for Google sign-in and the WhatsApp webhook tunnel, since both point at port 8000.

## Pages (React Router, each page is lazy-loaded)

| Route | What it is |
| --- | --- |
| `/` | Overview: animated hero (spotlight, beams, floating stars, live excavator), live counts, needs-a-reply, field decisions |
| `/ask` | Ask Unsilo: chat thread, word-by-word answers, clickable receipts |
| `/connections` | Sync Gmail/Drive, Google connect, setup health, webhook URL |
| `/gmail` | Gmail clone: folders, Primary/Promotions/Social/Updates/Forums tabs, smart views, team labels, date/unread/attachment filters, `from:` `subject:` `has:attachment` `is:unread` `label:` search, thread reader, pagination, bulk "Ask Unsilo" |
| `/drive` | Drive clone: My Drive/Recent/Documents/Videos/Images, category + type + modified filters, grid/list, sort, thumbnails, popup preview (videos play in the popup) |
| `/site-updates` | WhatsApp: groups, chat view, summary/decisions/actions/people (click to jump to the message) |
| `/reports` | Output JSON preview with highlighting, copy, download, generate all |

## Animation components (`src/components/aceternity`)

Aceternity UI–style effects rebuilt with framer-motion + MUI (no Tailwind needed): Spotlight, Background Beams,
Star field with shooting stars, Meteors, Card spotlight (glow card), Moving Border, Text Generate, Flip Words,
Hover grid, Number Ticker, Marquee. All respect `prefers-reduced-motion`; the star canvas pauses in background tabs.

Shortcuts: `Ctrl/Cmd + K` → Ask, `/` → Gmail search, `Esc` → close email, `← →` → previous/next file in the Drive preview.

## Email + JSON (v1.1)

- **Ask → "Email this"** opens a compose window with the answer, numbered citations and a sources list. Edit To/Cc/Subject/Body, see a live preview of exactly how the email will look, then **Open in Gmail** (or Mail app / Copy). Unsilo never sends mail itself (read-only scopes).
- **Gmail → "Reply with suggested message"** drafts a reply from the email thread (Gemini when a key is set, a safe template otherwise) via `GET /api/emails/{id}/draft`, then opens the same compose window.
- **JSON downloads**: every Ask answer (`JSON` button), each report (`Download JSON`), and **Download all JSON** on the Reports page.

## Screen test checklist

Open Chrome DevTools → device toolbar (Ctrl+Shift+M) and check each page at:

| Width | Device | What to expect |
| --- | --- | --- |
| 360 | small phone | menu button opens drawer; Gmail/Drive folders become swipeable chips; Gmail rows are two-line; Drive is 2 columns; preview + compose are full screen with Write/Preview tabs |
| 768 | tablet | stats in 2 columns; Site updates shows chat under the group chips |
| 1024 | small laptop | sidebar visible (collapsible); Gmail rail still chips (≤1000px) |
| 1440 | laptop | full Gmail/Drive rails; Site updates 3 columns |
| 1920+ | desktop | content capped at 1680px and centred |
