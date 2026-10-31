// Unsilo UI: plain JavaScript, talks to the API on the same server.
const $ = (s) => document.querySelector(s)
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]))
const when = (iso) => (iso ? new Date(iso).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '')
const TONE = { sales: 'lime', marketing: 'pink', other: '', verification: 'violet', office: 'blue', accounts: 'orange' }
const badge = (text, tone = '') => `<span class="badge ${tone}">${esc(text)}</span>`
const NAMES = { gmail: 'Gmail', drive: 'Drive', whatsapp: 'WhatsApp', whatsapp_summary: 'WhatsApp summary' }

async function api(path, opts = {}) {
  let res
  try {
    res = await fetch(path, { headers: { 'Content-Type': 'application/json' }, ...opts })
  } catch {
    throw new Error('Backend not reachable. Is uvicorn running?')
  }
  const body = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(body.detail || `Request failed (${res.status})`)
  return body
}

function toast(msg) {
  const t = $('#toast')
  t.textContent = msg
  t.hidden = false
  clearTimeout(toast.timer)
  toast.timer = setTimeout(() => (t.hidden = true), msg.startsWith("⚠") ? 9000 : 4000)
}

// ---- tabs
const loaders = {}
let current = 'ask'
function show(tab) {
  current = tab
  document.querySelectorAll('#tabs button').forEach((b) => b.classList.toggle('on', b.dataset.tab === tab))
  document.querySelectorAll('[data-view]').forEach((v) => (v.hidden = v.dataset.view !== tab))
  loaders[tab]?.()
}
$('#tabs').addEventListener('click', (e) => e.target.dataset.tab && show(e.target.dataset.tab))

// ---- status bar
let health = null
async function loadHealth() {
  try {
    health = await api('/api/health')
    $('#status').innerHTML =
      badge(`AI: ${health.ai}`, health.ai === 'gemini' ? 'lime' : '') +
      badge(`Google ${health.google_connected ? 'on' : 'off'}`, health.google_connected ? 'lime' : '') +
      badge(`${health.counts.whatsapp_messages} WhatsApp msgs`, health.counts.whatsapp_messages ? 'lime' : '') +
      badge(`ref date ${health.reference_date}`)
    renderSetup()
  } catch (e) {
    $('#status').innerHTML = badge('backend offline', 'orange')
  }
}

const SETUP_ICON = { gmail: '✉ Gmail', drive: '▲ Drive', whatsapp: '◉ WhatsApp', ai: '✦ AI', dates: '◷ Dates' }
function renderSetup() {
  const items = health?.setup || []
  $('#setup').innerHTML = items.length
    ? `<div class="card setup"><h3>Still to set up</h3><ul>${items
        .map((p) => `<li><b>${SETUP_ICON[p.source] || esc(p.source)}</b> ${esc(p.text)}</li>`)
        .join('')}</ul><p class="muted small">Edit <code>.env</code> or <code>config/selected_groups.json</code>, then stop and restart uvicorn.</p></div>`
    : ''
}

// ---- Ask
const EXAMPLES = [
  'What were our sales last month?',
  'Which sales emails are still pending a reply?',
  'What did the site team agree on in the WhatsApp group this week?',
  'Where is the latest quotation?',
  'Which KYC documents do we have?',
]
$('#examples').innerHTML = EXAMPLES.map((q) => `<button class="chip">${esc(q)}</button>`).join('')
$('#examples').addEventListener('click', (e) => e.target.matches('.chip') && ask(e.target.textContent))
$('#askForm').addEventListener('submit', (e) => (e.preventDefault(), ask($('#q').value)))

async function ask(q) {
  if (!q.trim()) return
  $('#q').value = q
  $('#askBtn').disabled = true
  $('#askBtn').textContent = 'Thinking…'
  try {
    const a = await api('/api/ask', { method: 'POST', body: JSON.stringify({ question: q }) })
    const ids = a.citations.map((c) => c.source_id)
    const text = esc(a.answer).replace(/\[([a-z_]+:[^\]]+)\]/g, (m, id) => {
      const n = ids.indexOf(id) + 1
      return n ? `<sup class="cite">${n}</sup>` : ''
    })
    $('#answer').innerHTML = `
      <div class="card answer ${a.answerable ? '' : 'none'}">
        <div class="head"><span class="muted">${esc(a.question)}</span>
          ${a.answerable ? badge(a.mode === 'chat' ? 'hello' : a.mode === 'ai' ? 'grounded answer' : a.mode === 'closest' ? 'closest match' : a.mode === 'overview' ? 'summary' : 'top records', 'lime') : badge(a.mode === 'empty' ? 'no data yet' : 'no data found', 'orange')}</div>
        <p class="text">${text}</p>
        ${a.citations.length ? '<p class="label">Receipts</p>' : ''}
        ${a.citations.map((c, i) => `
          <a class="citation" ${c.url ? `href="${esc(c.url)}" target="_blank" rel="noreferrer"` : ''}>
            <span class="num">${i + 1}</span>
            <span class="body"><b>${badge(NAMES[c.type] || c.type)} ${esc(c.title)}</b>
              <span class="muted small">${esc([c.from, when(c.date)].filter(Boolean).join(' · '))}</span>
              <span class="excerpt">${esc(c.excerpt)}</span></span>
          </a>`).join('')}
        <p class="muted small">Searched: ${esc(a.retrieval.terms.join(', ') || '—')}${a.retrieval.period ? ` · period ${a.retrieval.period[0].slice(0, 10)} to ${a.retrieval.period[1].slice(0, 10)}` : ''}</p>
      </div>`
  } catch (e) {
    $('#answer').innerHTML = `<div class="problem">${esc(e.message)}</div>`
  } finally {
    $('#askBtn').disabled = false
    $('#askBtn').textContent = 'Ask'
  }
}

// ---- Sources
loaders.sources = async () => {
  await loadHealth()
  if (!health) return ($('#sources').innerHTML = '<div class="problem">Backend offline.</div>')
  const h = health
  $('#sources').innerHTML = `
    <div class="grid">
      <div class="card"><h3>✉ Gmail</h3>${badge(h.google_connected ? 'connected' : 'not connected', h.google_connected ? 'lime' : '')}
        <p class="big">${h.counts.emails}</p><p class="muted">emails</p>
        ${h.google_connected ? '<button class="btn" data-sync="gmail">Sync Gmail</button>'
          : h.google_configured ? '<a class="btn primary" href="/api/oauth/google/start">Connect Google</a>'
          : '<p class="err">Add GOOGLE_CLIENT_SECRET to .env and restart</p>'}</div>
      <div class="card"><h3>▲ Drive</h3>${badge({ oauth: 'connected', api_key: 'API key (public folder)', none: 'not connected' }[h.drive_mode], h.drive_mode === 'none' ? '' : 'lime')}
        <p class="big">${h.counts.documents}</p><p class="muted">documents</p>
        <button class="btn" data-sync="drive">Sync Drive</button></div>
      <div class="card"><h3>◉ WhatsApp</h3>${badge(`${h.selected_groups} selected groups`, 'lime')}
        <p class="big">${h.counts.whatsapp_messages}</p><p class="muted">messages received by webhook</p>
        <button class="btn" id="reanalyse">Re-analyse all</button></div>
    </div>
    <div class="card steps">
      <h3>Connect</h3>
      <ol>
        <li><b>Google (Gmail + Drive):</b> ${h.google_configured ? `<a class="btn primary small" href="/api/oauth/google/start">${h.google_connected ? 'Reconnect' : 'Connect'} Google</a>` : '<span class="muted">add GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to .env and restart</span>'}</li>
        <li><b>WhatsApp:</b> <span class="muted">tunnel link + <code>/api/webhooks/whatsapp</code>, verify token from .env; group ids in <code>config/selected_groups.json</code></span></li>
        <li><b>Reference date:</b> <span class="muted">set REFERENCE_DATE in .env (kickoff), restart</span></li>
      </ol>
    </div>`
}
$('#sources').addEventListener('click', async (e) => {
  const b = e.target.closest('button')
  if (!b) return
  b.disabled = true
  const label = b.textContent
  b.textContent = 'Working…'
  try {
    if (b.dataset.sync) {
      const r = await api(`/api/sync/${b.dataset.sync}`, { method: 'POST' })
      toast(`${NAMES[r.source]}: ${r.imported} imported and analysed`)
    } else if (b.id === 'reanalyse') {
      const r = await api('/api/analyse', { method: 'POST' })
      toast(`Analysed ${r.emails} emails, ${r.documents} documents, ${r.groups} groups`)
    }
  } catch (err) {
    toast(`⚠ ${err.message}`)
  }
  b.textContent = label
  b.disabled = false
  loaders.sources()
})

// ---- Gmail
let gmailFilter = 'all'
loaders.gmail = async () => {
  try {
    const d = await api('/api/outputs/gmail')
    const pending = new Map(d.unanswered.map((u) => [u.message_id, u.days_without_reply]))
    const rows = d.emails
      .filter((e) => gmailFilter === 'all' || (gmailFilter === 'unanswered' ? pending.has(e.message_id) : gmailFilter === 'attachments' ? e.important_attachment : e.classification === gmailFilter))
      .sort((a, b) => b.date.localeCompare(a.date))
    $('#gmail').innerHTML = !d.emails.length ? '<div class="empty">No emails yet. Connect Google and sync Gmail.</div>' : `
      <div class="stats">
        <div class="card"><p class="big">${d.emails.length}</p><p class="muted">emails</p></div>
        <div class="card"><p class="big">${d.unanswered.length}</p><p class="muted">no reply ≥ 5 days</p></div>
        <div class="card"><p class="big">${d.important_attachments.length}</p><p class="muted">important attachments</p></div>
        <div class="card"><p class="big">${d.reference_date}</p><p class="muted">reference date</p></div>
      </div>
      <div class="chips">${['all', 'sales', 'marketing', 'other', 'unanswered', 'attachments'].map((f) => `<button class="chip ${f === gmailFilter ? 'on' : ''}" data-f="${f}">${f}</button>`).join('')}</div>
      ${rows.map((e) => `
        <div class="card rowcard"><div>
          <p class="title">${esc(e.subject)}</p>
          <p class="muted small">${esc(e.from)} · ${when(e.date)}</p>
          <p class="small reason">${esc(e.classification_reason)}</p>
          ${e.attachment_flags.map((a) => `<p class="small flag">📎 <b>${esc(a.filename)}</b> · ${esc(a.kind)}: ${esc(a.reason)}</p>`).join('')}
        </div><div class="side">${badge(e.classification, TONE[e.classification])}${pending.has(e.message_id) ? badge(`${pending.get(e.message_id)}d no reply`, 'orange') : ''}</div></div>`).join('')}`
  } catch (e) {
    $('#gmail').innerHTML = `<div class="problem">${esc(e.message)}</div>`
  }
}
$('#gmail').addEventListener('click', (e) => e.target.dataset.f && ((gmailFilter = e.target.dataset.f), loaders.gmail()))

// ---- Drive
loaders.drive = async () => {
  try {
    const d = await api('/api/outputs/drive')
    $('#drive').innerHTML = !d.documents.length ? '<div class="empty">No documents yet. Sync Drive.</div>' : `
      <div class="stats">${['sales', 'marketing', 'verification', 'office', 'accounts'].map((c) => `<div class="card"><p class="big">${d.documents.filter((x) => x.category === c).length}</p>${badge(c, TONE[c])}</div>`).join('')}</div>
      <div class="grid">${d.documents.map((x) => `
        <a class="card doc" ${x.url ? `href="${esc(x.url)}" target="_blank" rel="noreferrer"` : ''}>
          ${badge(x.category, TONE[x.category])}<p class="title">${esc(x.name)}</p>
          <p class="small reason">${esc(x.reason)}</p>${x.extraction_error ? `<p class="small err">Couldn't read: ${esc(x.extraction_error)}</p>` : ''}
        </a>`).join('')}</div>`
  } catch (e) {
    $('#drive').innerHTML = `<div class="problem">${esc(e.message)}</div>`
  }
}

// ---- WhatsApp
let waActive = null
loaders.whatsapp = async () => {
  try {
    const groups = await api('/api/whatsapp/groups')
    const g = groups.find((x) => x.group_id === waActive) || groups[0]
    if (!groups.length) return ($('#whatsapp').innerHTML = '<div class="empty">No groups in config/selected_groups.json.</div>')
    const i = g.interpretation || {}
    $('#whatsapp').innerHTML = `
      <div class="wa">
        <aside>${groups.map((x) => `<button class="wagroup ${x === g ? 'on' : ''}" data-g="${esc(x.group_id)}"><b>${esc(x.name)}</b><span class="muted small">${x.messages.length} messages · ${x.participants.length} people</span></button>`).join('')}</aside>
        <div class="col">
          <div class="card">
            <div class="head"><h3>${esc(g.name)}</h3>${badge(i.method === 'ai' ? 'AI summary' : i.method === 'rules' ? 'keyword summary' : 'not analysed yet', 'violet')}</div>
            <p>${esc(i.summary || 'Press "Re-analyse all" on Sources after messages arrive.')}</p>
            ${i.decisions?.length ? `<p class="label">Decisions</p><ul>${i.decisions.map((d) => `<li>${esc(d.decision)}</li>`).join('')}</ul>` : ''}
            ${i.action_items?.length ? `<p class="label">Action items</p><ul>${i.action_items.map((a) => `<li>${esc(a.task)} <span class="muted">· ${esc(a.owner)}${a.due ? ` · due ${esc(a.due)}` : ''}</span></li>`).join('')}</ul>` : ''}
            <p class="label">Participants</p><div class="chips">${g.participants.map((p) => `<span class="chip static">${esc(p.name || '?')} · ${esc(p.wa_id)}</span>`).join('') || '<span class="muted">none yet</span>'}</div>
          </div>
          <div class="card chat">${g.messages.map((m) => `<div class="bubble"><b>${esc(m.sender_name || m.sender_id)}</b><span>${esc(m.text)}</span><span class="muted small">${when(m.sent_at)}</span></div>`).join('') || '<span class="muted">No messages yet.</span>'}</div>
        </div>
      </div>`
  } catch (e) {
    $('#whatsapp').innerHTML = `<div class="problem">${esc(e.message)}</div>`
  }
}
$('#whatsapp').addEventListener('click', (e) => {
  const b = e.target.closest('[data-g]')
  if (b) (waActive = b.dataset.g), loaders.whatsapp()
})

// ---- Outputs
document.querySelectorAll('[data-out]').forEach((b) =>
  b.addEventListener('click', async () => {
    document.querySelectorAll('[data-out]').forEach((x) => x.classList.toggle('on', x === b))
    try {
      $('#json').textContent = JSON.stringify(await api(`/api/outputs/${b.dataset.out}`), null, 2)
      $('#json').hidden = false
    } catch (e) {
      toast(`⚠ ${e.message}`)
    }
  }),
)
$('#exportBtn').addEventListener('click', async () => {
  try {
    const r = await api('/api/export', { method: 'POST' })
    toast(`Wrote ${r.written.length} files to outputs/`)
  } catch (e) {
    toast(`⚠ ${e.message}`)
  }
})

// ---- start
loadHealth()
const googleError = new URLSearchParams(location.search).get('google_error')
if (googleError) {
  toast(`⚠ Google sign-in failed: ${googleError === 'access_denied' ? 'access denied. Add your Gmail as a Test user under Audience in Google Cloud.' : googleError}`)
  show('sources')
}
if (new URLSearchParams(location.search).get('google') === 'connected') {
  toast('Google connected (read-only)')
  history.replaceState(null, '', '/')
  show('sources')
}
