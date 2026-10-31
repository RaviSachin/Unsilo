import type { AskResult } from './types'

export type EmailDraft = { to: string; cc?: string; subject: string; body: string }

const LABEL: Record<string, string> = { gmail: 'Email', drive: 'Drive file', whatsapp: 'WhatsApp', whatsapp_summary: 'WhatsApp summary' }

/** Turns an Ask answer into a ready-to-send email: clean text, numbered citations and a sources list. */
export function answerToEmail(r: AskResult): EmailDraft {
  const ids = r.citations.map((c) => c.source_id)
  const text = r.answer
    .replace(/\[([a-z_]+:[^\]]+)\]/g, (_, id: string) => (ids.includes(id) ? `[${ids.indexOf(id) + 1}]` : ''))
    .replace(/\[S(\d+)\]/g, '[$1]')
    .replace(/[ \t]+\n/g, '\n')
    .trim()
  const sources = r.citations.map((c, i) => {
    const date = c.date ? ` (${c.date.slice(0, 10)})` : ''
    return `[${i + 1}] ${LABEL[c.type] ?? c.type}: ${c.title}${date}${c.url ? `\n    ${c.url}` : ''}`
  })
  const body = [
    'Hi,',
    '',
    `Here is what I found for: "${r.question}"`,
    '',
    text,
    ...(sources.length ? ['', 'Sources:', ...sources] : []),
    '',
    'Regards,',
    'Team',
    '',
    '— Sent via Unsilo (answers checked against our Gmail, Drive and site WhatsApp data)',
  ].join('\n')
  const subject = `Unsilo: ${r.question.length > 70 ? `${r.question.slice(0, 67)}…` : r.question}`
  return { to: '', subject, body }
}

// Browsers and Gmail cut very long compose URLs, so long bodies are trimmed in the link (the full text can be copied).
const MAX_BODY_IN_URL = 1800

export function trimForUrl(body: string): { body: string; trimmed: boolean } {
  if (body.length <= MAX_BODY_IN_URL) return { body, trimmed: false }
  return { body: `${body.slice(0, MAX_BODY_IN_URL)}\n\n[…message trimmed, paste the full text from Unsilo]`, trimmed: true }
}

export function gmailComposeUrl(d: EmailDraft): string {
  // encodeURIComponent (spaces as %20) rather than URLSearchParams ("+"), which Gmail can show literally
  const q: [string, string][] = [['view', 'cm'], ['fs', '1'], ['tf', '1']]
  if (d.to) q.push(['to', d.to])
  if (d.cc) q.push(['cc', d.cc])
  if (d.subject) q.push(['su', d.subject])
  if (d.body) q.push(['body', trimForUrl(d.body).body])
  return `https://mail.google.com/mail/?${q.map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('&')}`
}

export function mailtoUrl(d: EmailDraft): string {
  const parts: string[] = []
  if (d.cc) parts.push(`cc=${encodeURIComponent(d.cc)}`)
  if (d.subject) parts.push(`subject=${encodeURIComponent(d.subject)}`)
  if (d.body) parts.push(`body=${encodeURIComponent(trimForUrl(d.body).body)}`)
  return `mailto:${encodeURIComponent(d.to).replace(/%40/g, '@').replace(/%2C/gi, ',')}${parts.length ? `?${parts.join('&')}` : ''}`
}

export function isValidEmailList(value: string): boolean {
  if (!value.trim()) return true
  return value.split(/[,;]/).map((s) => s.trim()).filter(Boolean).every((s) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s))
}

/** Saves any data as a pretty-printed .json file in the browser. */
export function downloadJson(filename: string, data: unknown) {
  const text = typeof data === 'string' ? data : JSON.stringify(data, null, 2)
  const url = URL.createObjectURL(new Blob([text], { type: 'application/json;charset=utf-8' }))
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.json') ? filename : `${filename}.json`
  document.body.appendChild(a)
  a.click()
  a.remove()
  window.setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function slug(text: string, max = 40): string {
  return text.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, max) || 'unsilo'
}
