const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function parseDate(iso?: string | null): Date | null {
  if (!iso) return null
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? null : d
}

/** Gmail-style: time for today, "31 Oct" this year, "31/10/25" otherwise. */
export function mailDate(iso?: string | null): string {
  const d = parseDate(iso)
  if (!d) return ''
  const now = new Date()
  if (d.toDateString() === now.toDateString())
    return d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
  if (d.getFullYear() === now.getFullYear()) return `${d.getDate()} ${MONTHS[d.getMonth()]}`
  return `${d.getDate()}/${d.getMonth() + 1}/${String(d.getFullYear()).slice(2)}`
}

export function fullDate(iso?: string | null): string {
  const d = parseDate(iso)
  if (!d) return ''
  return d.toLocaleString([], { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' })
}

export function dayLabel(iso?: string | null): string {
  const d = parseDate(iso)
  if (!d) return ''
  const today = new Date()
  const y = new Date(today)
  y.setDate(today.getDate() - 1)
  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === y.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })
}

export function timeOnly(iso?: string | null): string {
  const d = parseDate(iso)
  return d ? d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }) : ''
}

export function initials(name: string): string {
  const parts = name.replace(/[<>"]/g, '').trim().split(/[\s._@-]+/).filter(Boolean)
  return ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
}

/** Stable pleasant colour for a person or group name. */
export function colorFor(seed: string): string {
  const palette = ['#ff9f1c', '#ffd60a', '#c6f432', '#4cc9f0', '#f72585', '#b388ff', '#2ec4b6', '#ff6b6b']
  let h = 0
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0
  return palette[h % palette.length]
}

export type FileKind = 'video' | 'image' | 'pdf' | 'doc' | 'sheet' | 'slides' | 'folder' | 'audio' | 'archive' | 'text' | 'other'

export function fileKind(mime: string, name = ''): FileKind {
  const m = mime.toLowerCase()
  const n = name.toLowerCase()
  if (m.startsWith('video/') || /\.(mp4|mov|avi|mkv|webm)$/.test(n)) return 'video'
  if (m.startsWith('image/') || m.endsWith('.drawing')) return 'image'
  if (m.startsWith('audio/')) return 'audio'
  if (m === 'application/pdf') return 'pdf'
  if (m.endsWith('.folder')) return 'folder'
  if (m.endsWith('.spreadsheet') || m.includes('spreadsheetml') || m.includes('excel') || m === 'text/csv') return 'sheet'
  if (m.endsWith('.presentation') || m.includes('presentationml') || m.includes('powerpoint')) return 'slides'
  if (m.endsWith('.document') || m.includes('wordprocessingml') || m.includes('msword')) return 'doc'
  if (m.includes('zip') || m.includes('compressed')) return 'archive'
  if (m.startsWith('text/') || m === 'application/json') return 'text'
  return 'other'
}

export const KIND_META: Record<FileKind, { label: string; color: string }> = {
  video: { label: 'Video', color: '#ff4d6d' },
  image: { label: 'Image', color: '#ff9f1c' },
  pdf: { label: 'PDF', color: '#ef4444' },
  doc: { label: 'Document', color: '#4c8dff' },
  sheet: { label: 'Spreadsheet', color: '#22c55e' },
  slides: { label: 'Presentation', color: '#ffb703' },
  folder: { label: 'Folder', color: '#9ca3af' },
  audio: { label: 'Audio', color: '#b388ff' },
  archive: { label: 'Archive', color: '#a1a1aa' },
  text: { label: 'Text', color: '#94a3b8' },
  other: { label: 'File', color: '#94a3b8' },
}

export const thumbUrl = (id: string, size = 480) => `https://drive.google.com/thumbnail?id=${id}&sz=w${size}`
export const previewUrl = (id: string) => `https://drive.google.com/file/d/${id}/preview`

export const CATEGORY_COLORS: Record<string, string> = {
  sales: '#c6f432',
  marketing: '#f72585',
  verification: '#b388ff',
  office: '#4cc9f0',
  accounts: '#ff9f1c',
  other: '#9ca3af',
}
