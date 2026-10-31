import { memo, useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Checkbox from '@mui/material/Checkbox'
import Tooltip from '@mui/material/Tooltip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import Divider from '@mui/material/Divider'
import InputBase from '@mui/material/InputBase'
import LinearProgress from '@mui/material/LinearProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import EditRounded from '@mui/icons-material/EditRounded'
import InboxRounded from '@mui/icons-material/InboxRounded'
import StarRounded from '@mui/icons-material/StarRounded'
import StarBorderRounded from '@mui/icons-material/StarBorderRounded'
import LabelImportantRounded from '@mui/icons-material/LabelImportantRounded'
import SendRounded from '@mui/icons-material/SendRounded'
import DraftsRounded from '@mui/icons-material/DraftsRounded'
import AllInboxRounded from '@mui/icons-material/AllInboxRounded'
import ScheduleRounded from '@mui/icons-material/ScheduleRounded'
import AttachFileRounded from '@mui/icons-material/AttachFileRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import SellRounded from '@mui/icons-material/SellRounded'
import LocalOfferRounded from '@mui/icons-material/LocalOfferRounded'
import PeopleAltRounded from '@mui/icons-material/PeopleAltRounded'
import InfoRounded from '@mui/icons-material/InfoRounded'
import ForumRounded from '@mui/icons-material/ForumRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import TuneRounded from '@mui/icons-material/TuneRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import ArrowBackRounded from '@mui/icons-material/ArrowBackRounded'
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import MarkEmailUnreadRounded from '@mui/icons-material/MarkEmailUnreadRounded'
import ReplyRounded from '@mui/icons-material/ReplyRounded'
import EmailComposer from '../components/EmailComposer'
import { api } from '../lib/api'
import type { EmailDraft } from '../lib/email'
import { Avatar, EmptyState, ErrorBox, LoadingRows, Pill } from '../components/ui'
import { invalidate, post, useApi } from '../lib/api'
import { useApp } from '../lib/app-context'
import type { EmailFull, EmailList, EmailMeta } from '../lib/types'
import { colorFor, fileKind, fullDate, KIND_META, mailDate, parseDate } from '../lib/format'
import { C } from '../theme'

/* ------------------------------------------------------------------ filters */

type Folder = 'inbox' | 'starred' | 'important' | 'sent' | 'drafts' | 'all' | 'unanswered' | 'critical' | 'attachments' | 'team:sales' | 'team:marketing' | 'team:other'
type Tab = 'primary' | 'promotions' | 'social' | 'updates' | 'forums'
type DateRange = 'any' | 'today' | '7d' | '30d' | '90d' | 'year'

const TEAM_COLOR: Record<string, string> = { sales: C.lime, marketing: C.pink, other: '#9ca3af' }

const has = (e: EmailMeta, l: string) => e.labels.includes(l)
const CATEGORY_LABEL: Record<Exclude<Tab, 'primary'>, string> = {
  promotions: 'CATEGORY_PROMOTIONS', social: 'CATEGORY_SOCIAL', updates: 'CATEGORY_UPDATES', forums: 'CATEGORY_FORUMS',
}
function tabOf(e: EmailMeta): Tab {
  for (const [tab, label] of Object.entries(CATEGORY_LABEL)) if (has(e, label)) return tab as Tab
  return 'primary'
}
// Archived mail has no INBOX label in Gmail, so it only shows under All mail (like the real thing).
const inInbox = (e: EmailMeta) => has(e, 'INBOX') || e.labels.length === 0

const FOLDER_TEST: Record<Folder, (e: EmailMeta) => boolean> = {
  inbox: inInbox,
  starred: (e) => has(e, 'STARRED'),
  important: (e) => has(e, 'IMPORTANT'),
  sent: (e) => has(e, 'SENT'),
  drafts: (e) => has(e, 'DRAFT'),
  all: () => true,
  unanswered: (e) => e.unanswered_days != null,
  critical: (e) => e.critical.length > 0,
  attachments: (e) => e.attachments.length > 0,
  'team:sales': (e) => e.team === 'sales',
  'team:marketing': (e) => e.team === 'marketing',
  'team:other': (e) => e.team === 'other',
}

const DATE_LABEL: Record<DateRange, string> = { any: 'Any time', today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', '90d': 'Last 3 months', year: 'This year' }

function inRange(iso: string, range: DateRange): boolean {
  if (range === 'any') return true
  const d = parseDate(iso)
  if (!d) return false
  const now = new Date()
  const start = new Date(now)
  if (range === 'today') start.setHours(0, 0, 0, 0)
  else if (range === 'year') { start.setMonth(0, 1); start.setHours(0, 0, 0, 0) }
  else start.setDate(now.getDate() - { '7d': 7, '30d': 30, '90d': 90 }[range])
  return d >= start
}

/** Gmail-style search: free text plus from: to: subject: has:attachment is:unread|starred|important label:sales|marketing|other|unanswered|critical */
function matchQuery(e: EmailMeta, q: string): boolean {
  const tokens = q.toLowerCase().match(/(\w+:"[^"]+"|\w+:\S+|"[^"]+"|\S+)/g) ?? []
  const hay = `${e.from_name} ${e.from_addr} ${e.subject} ${e.snippet} ${e.to.join(' ')} ${e.attachments.map((a) => a.filename).join(' ')}`.toLowerCase()
  return tokens.every((tok) => {
    const m = tok.match(/^(\w+):"?([^"]+)"?$/)
    if (!m) return hay.includes(tok.replace(/"/g, ''))
    const [, key, val] = m
    switch (key) {
      case 'from': return `${e.from_name} ${e.from_addr}`.toLowerCase().includes(val)
      case 'to': return e.to.join(' ').toLowerCase().includes(val)
      case 'subject': return e.subject.toLowerCase().includes(val)
      case 'has': return val.startsWith('attach') ? e.attachments.length > 0 : true
      case 'filename': return e.attachments.some((a) => a.filename.toLowerCase().includes(val))
      case 'is': return val === 'unread' ? has(e, 'UNREAD') : val === 'starred' ? has(e, 'STARRED') : val === 'important' ? has(e, 'IMPORTANT') : val === 'read' ? !has(e, 'UNREAD') : true
      case 'label':
        if (val === 'unanswered') return e.unanswered_days != null
        if (val === 'critical') return e.critical.length > 0
        return e.team === val || e.labels.some((l) => l.toLowerCase() === val)
      default: return hay.includes(tok)
    }
  })
}

/* ----------------------------------------------------------------- left rail */

function NavItem({ icon, label, count, active, onClick, color, chip }: { icon: ReactNode; label: string; count?: number; active: boolean; onClick: () => void; color?: string; chip?: boolean }) {
  return (
    <Box onClick={onClick} role="button" sx={chip ? {
      display: 'flex', alignItems: 'center', gap: 0.8, px: 1.4, py: 0.7, borderRadius: 99, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
      fontSize: 13, fontWeight: 700, color: active ? '#140b00' : C.muted, background: active ? C.amber : 'rgba(255,255,255,0.04)',
      border: `1px solid ${active ? C.amber : C.line}`, '& svg': { fontSize: 17 },
    } : {
      display: 'flex', alignItems: 'center', gap: 1.6, pl: 2, pr: 1.6, py: 0.9, borderRadius: '0 99px 99px 0', mr: 1, cursor: 'pointer',
      fontSize: 14, fontWeight: active ? 800 : 500, color: active ? C.text : C.muted,
      background: active ? `${C.amber}26` : 'transparent', '&:hover': { background: active ? `${C.amber}30` : 'rgba(255,255,255,0.04)' },
    }}>
      <Box sx={{ display: 'flex', color: chip && active ? 'inherit' : color ?? (active ? C.amber : 'inherit'), '& svg': { fontSize: chip ? 17 : 19 } }}>{icon}</Box>
      <Box sx={{ flex: chip ? 'none' : 1 }}>{label}</Box>
      {!!count && <Box sx={{ fontSize: 12, fontWeight: 700, color: chip && active ? 'inherit' : active ? C.text : C.dim }}>{count}</Box>}
    </Box>
  )
}

/* ---------------------------------------------------------------------- row */

const Row = memo(function Row({ e, checked, onCheck, onOpen, phone }: { e: EmailMeta; checked: boolean; onCheck: (id: string) => void; onOpen: (id: string) => void; phone?: boolean }) {
  const unread = has(e, 'UNREAD')
  const starred = has(e, 'STARRED')
  const who = has(e, 'SENT') ? `To: ${e.to[0] ?? ''}` : e.from_name || e.from_addr
  if (phone) {
    return (
      <Stack direction="row" spacing={1.4} onClick={() => onOpen(e.id)} sx={{ px: 1.6, py: 1.4, cursor: 'pointer', borderBottom: `1px solid ${C.line}`, background: checked ? `${C.amber}14` : unread ? 'rgba(255,255,255,0.035)' : 'transparent', '&:active': { background: 'rgba(255,255,255,0.06)' } }}>
        <Box onClick={(ev) => { ev.stopPropagation(); onCheck(e.id) }} sx={{ flexShrink: 0 }}>
          {checked ? <Box sx={{ width: 40, height: 40, borderRadius: '50%', display: 'grid', placeItems: 'center', background: C.amber, color: '#140b00', fontWeight: 900 }}>✓</Box>
            : <Avatar name={who} color={colorFor(e.from_addr)} size={40} />}
        </Box>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" alignItems="center" spacing={1}>
            <Typography noWrap sx={{ flex: 1, fontSize: 14.5, fontWeight: unread ? 800 : 600 }}>{who}</Typography>
            <Typography sx={{ fontSize: 12, color: unread ? C.text : C.dim, fontWeight: unread ? 800 : 500, flexShrink: 0 }}>{mailDate(e.sent_at)}</Typography>
          </Stack>
          <Typography noWrap sx={{ fontSize: 13.5, fontWeight: unread ? 800 : 500 }}>{e.subject}</Typography>
          <Stack direction="row" alignItems="center" spacing={0.8}>
            <Typography noWrap sx={{ flex: 1, fontSize: 13, color: C.dim }}>{e.snippet}</Typography>
            {e.attachments.length > 0 && <AttachFileRounded sx={{ fontSize: 15, color: C.dim, transform: 'rotate(45deg)' }} />}
            {starred ? <StarRounded sx={{ fontSize: 18, color: C.hazard }} /> : <StarBorderRounded sx={{ fontSize: 18, color: C.dim }} />}
          </Stack>
          {(e.unanswered_days != null || (e.team && e.team !== 'other') || e.critical.length > 0) && (
            <Stack direction="row" spacing={0.6} sx={{ mt: 0.6, flexWrap: 'wrap', rowGap: 0.5 }}>
              {e.team && e.team !== 'other' && <Pill color={TEAM_COLOR[e.team]} sx={{ fontSize: 10.5, py: 0, px: 0.8 }}>{e.team}</Pill>}
              {e.unanswered_days != null && <Pill color={C.red} sx={{ fontSize: 10.5, py: 0, px: 0.8 }}>{e.unanswered_days}d no reply</Pill>}
              {e.critical.length > 0 && <Pill color={C.hazard} sx={{ fontSize: 10.5, py: 0, px: 0.8 }}>{e.critical[0].kind}</Pill>}
            </Stack>
          )}
        </Box>
      </Stack>
    )
  }
  return (
    <Box onClick={() => onOpen(e.id)} sx={{
      display: 'flex', alignItems: 'center', gap: 1, px: 1, minHeight: 44, cursor: 'pointer', borderBottom: `1px solid ${C.line}`,
      background: checked ? `${C.amber}14` : unread ? 'rgba(255,255,255,0.035)' : 'transparent',
      position: 'relative', transition: 'background .12s',
      '&:hover': { background: checked ? `${C.amber}1c` : 'rgba(255,255,255,0.05)', boxShadow: `inset 0 -1px 0 ${C.line}, 0 1px 6px rgba(0,0,0,0.4)`, zIndex: 1 },
      '&:hover .row-actions': { opacity: 1 }, '&:hover .row-date': { opacity: 0 },
    }}>
      <Checkbox size="small" checked={checked} onClick={(ev) => ev.stopPropagation()} onChange={() => onCheck(e.id)} sx={{ p: 0.6, color: C.dim }} />
      <Box sx={{ display: 'flex', color: starred ? C.hazard : C.dim, '& svg': { fontSize: 19 } }}>{starred ? <StarRounded /> : <StarBorderRounded />}</Box>
      {has(e, 'IMPORTANT') && <LabelImportantRounded sx={{ fontSize: 18, color: C.hazard }} />}
      <Typography noWrap sx={{ width: { xs: 110, md: 190 }, flexShrink: 0, fontSize: 14, fontWeight: unread ? 800 : 500, color: unread ? C.text : '#d4d4d8', pl: 0.5 }}>
        {who}
      </Typography>
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Stack direction="row" alignItems="center" spacing={0.8} sx={{ minWidth: 0 }}>
          {e.team && e.team !== 'other' && <Pill color={TEAM_COLOR[e.team]} sx={{ fontSize: 10.5, py: 0, px: 0.8 }}>{e.team}</Pill>}
          {e.unanswered_days != null && <Pill color={C.red} sx={{ fontSize: 10.5, py: 0, px: 0.8 }}>{e.unanswered_days}d no reply</Pill>}
          <Typography noWrap sx={{ fontSize: 14, minWidth: 0 }}>
            <Box component="span" sx={{ fontWeight: unread ? 800 : 600, color: C.text }}>{e.subject}</Box>
            <Box component="span" sx={{ color: C.dim }}> — {e.snippet}</Box>
          </Typography>
        </Stack>
        {e.attachments.length > 0 && (
          <Stack direction="row" spacing={0.8} sx={{ mt: 0.6, mb: 0.4, overflow: 'hidden' }}>
            {e.attachments.slice(0, 3).map((a) => {
              const crit = e.critical.find((c) => c.filename === a.filename)
              const k = KIND_META[fileKind(a.mime_type, a.filename)]
              return (
                <Box key={a.filename} sx={{ display: 'flex', alignItems: 'center', gap: 0.6, px: 1, py: 0.25, borderRadius: 99, fontSize: 12, maxWidth: 220,
                  border: `1px solid ${crit ? `${C.hazard}66` : C.line}`, color: crit ? C.hazard : C.muted, background: crit ? `${C.hazard}10` : 'transparent' }}>
                  <Box sx={{ width: 8, height: 8, borderRadius: 0.5, background: k.color, flexShrink: 0 }} />
                  <Box component="span" sx={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{a.filename}</Box>
                </Box>
              )
            })}
            {e.attachments.length > 3 && <Typography sx={{ fontSize: 12, color: C.dim }}>+{e.attachments.length - 3}</Typography>}
          </Stack>
        )}
      </Box>
      {e.critical.length > 0 && <Tooltip title={e.critical.map((c) => `${c.kind}: ${c.filename}`).join(', ')}><WarningAmberRounded sx={{ fontSize: 18, color: C.hazard }} /></Tooltip>}
      {e.attachments.length > 0 && <AttachFileRounded sx={{ fontSize: 17, color: C.dim, transform: 'rotate(45deg)' }} />}
      <Box sx={{ position: 'relative', width: 70, textAlign: 'right', flexShrink: 0 }}>
        <Typography className="row-date" sx={{ fontSize: 12.5, fontWeight: unread ? 800 : 500, color: unread ? C.text : C.dim, transition: 'opacity .1s' }}>{mailDate(e.sent_at)}</Typography>
        <Box className="row-actions" sx={{ position: 'absolute', right: 0, top: '50%', transform: 'translateY(-50%)', opacity: 0, transition: 'opacity .1s' }}>
          <Tooltip title="Open in Gmail">
            <IconButton size="small" href={e.url} target="_blank" rel="noreferrer" onClick={(ev) => ev.stopPropagation()}><OpenInNewRounded sx={{ fontSize: 17 }} /></IconButton>
          </Tooltip>
        </Box>
      </Box>
    </Box>
  )
})

/* ------------------------------------------------------------- reading pane */

function MessageBlock({ m, open, onToggle }: { m: EmailMeta & { body: string }; open: boolean; onToggle: () => void }) {
  const who = m.from_name || m.from_addr
  return (
    <Box sx={{ borderBottom: `1px solid ${C.line}`, py: 2 }}>
      <Stack direction="row" spacing={1.6} alignItems="flex-start" onClick={onToggle} sx={{ cursor: 'pointer' }}>
        <Avatar name={who} color={colorFor(m.from_addr)} size={40} />
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Stack direction="row" spacing={1} alignItems="baseline" sx={{ flexWrap: 'wrap' }}>
            <Typography sx={{ fontWeight: 800 }}>{who}</Typography>
            <Typography sx={{ fontSize: 12.5, color: C.dim }}>&lt;{m.from_addr}&gt;</Typography>
          </Stack>
          {open ? <Typography sx={{ fontSize: 12.5, color: C.dim }}>to {m.to.join(', ') || 'me'}</Typography>
            : <Typography noWrap sx={{ fontSize: 13, color: C.muted }}>{m.snippet}</Typography>}
        </Box>
        <Typography sx={{ fontSize: 12.5, color: C.dim, flexShrink: 0 }}>{fullDate(m.sent_at)}</Typography>
      </Stack>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }} style={{ overflow: 'hidden' }}>
            <Typography component="div" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14.5, lineHeight: 1.75, color: '#e4e4e7', pl: { md: 7 }, pt: 2 }}>
              {m.body || m.snippet || '(no text)'}
            </Typography>
          </motion.div>
        )}
      </AnimatePresence>
    </Box>
  )
}

function Reader({ id, list, onClose, onMove }: { id: string; list: EmailMeta[]; onClose: () => void; onMove: (id: string) => void }) {
  const { data, error } = useApi<EmailFull>(`/api/emails/${encodeURIComponent(id)}`)
  const navigate = useNavigate()
  const [openIds, setOpenIds] = useState<Set<string>>(new Set([id]))
  const [reply, setReply] = useState<(EmailDraft & { method?: string; key_points?: string[] }) | null>(null)
  const [drafting, setDrafting] = useState(false)
  const startReply = async () => {
    if (!meta) return
    setReply({ to: meta.from_addr, subject: meta.subject.toLowerCase().startsWith('re:') ? meta.subject : `Re: ${meta.subject}`, body: '' })
    setDrafting(true)
    try {
      const d = await api<EmailDraft & { method: string; key_points: string[] }>(`/api/emails/${encodeURIComponent(id)}/draft`)
      setReply(d)
    } catch {
      setReply((r) => r && { ...r, body: `Hi,\n\nThank you for your email.\n\nRegards,\nTeam` })
    } finally {
      setDrafting(false)
    }
  }
  useEffect(() => { setOpenIds(new Set([id])) }, [id])
  const idx = list.findIndex((e) => e.id === id)
  const prev = idx > 0 ? list[idx - 1] : undefined
  const next = idx >= 0 && idx < list.length - 1 ? list[idx + 1] : undefined
  const meta = data ?? list.find((e) => e.id === id)
  const thread = data ? [...data.thread.filter((t) => (t.sent_at || '') < (data.sent_at || '')), data, ...data.thread.filter((t) => (t.sent_at || '') >= (data.sent_at || ''))] : []

  return (
    <Box>
      <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1, py: 0.8, borderBottom: `1px solid ${C.line}`, position: 'sticky', top: 0, zIndex: 2, background: 'rgba(14,14,17,0.95)', backdropFilter: 'blur(8px)' }}>
        <Tooltip title="Back to list"><IconButton onClick={onClose}><ArrowBackRounded /></IconButton></Tooltip>
        {meta && <Tooltip title="Open in Gmail"><IconButton href={meta.url} target="_blank" rel="noreferrer"><OpenInNewRounded fontSize="small" /></IconButton></Tooltip>}
        {meta && (
          <Tooltip title="Ask Unsilo about this email">
            <IconButton onClick={() => navigate('/ask', { state: { q: `Summarise the email "${meta.subject}" from ${meta.from_name || meta.from_addr} and what we need to do` } })}><AutoAwesomeRounded fontSize="small" sx={{ color: C.amber }} /></IconButton>
          </Tooltip>
        )}
        <Box sx={{ flex: 1 }} />
        {idx >= 0 && <Typography sx={{ fontSize: 12.5, color: C.dim, mr: 1, display: { xs: 'none', sm: 'block' } }}>{idx + 1} of {list.length}</Typography>}
        <IconButton disabled={!prev} onClick={() => prev && onMove(prev.id)}><ChevronLeftRounded /></IconButton>
        <IconButton disabled={!next} onClick={() => next && onMove(next.id)}><ChevronRightRounded /></IconButton>
      </Stack>
      <Box sx={{ p: { xs: 2, md: 3.5 } }}>
        {error && <ErrorBox message={error} />}
        {!meta ? <LoadingRows rows={4} /> : (
          <>
            <Stack direction="row" spacing={1} alignItems="center" sx={{ flexWrap: 'wrap', rowGap: 1, mb: 2 }}>
              <Typography variant="h5" sx={{ mr: 1, fontSize: { xs: 19, md: 24 }, wordBreak: 'break-word' }}>{meta.subject}</Typography>
              {meta.labels.filter((l) => ['INBOX', 'SENT', 'IMPORTANT'].includes(l)).map((l) => <Pill key={l} color={C.muted} sx={{ fontSize: 11 }}>{l.toLowerCase()}</Pill>)}
              {meta.team && <Pill color={TEAM_COLOR[meta.team]}>{meta.team}</Pill>}
            </Stack>

            <Box sx={{ position: 'relative', overflow: 'hidden', p: 2, mb: 1, borderRadius: 3, border: `1px solid ${C.amber}40`, background: `linear-gradient(120deg, ${C.amber}14, transparent 70%)` }}>
              <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                <AutoAwesomeRounded sx={{ fontSize: 18, color: C.amber }} />
                <Typography sx={{ fontWeight: 800, fontSize: 14 }}>Unsilo insight</Typography>
                {meta.team_method && <Pill color={C.dim} sx={{ fontSize: 10 }}>{meta.team_method === 'ai' ? 'AI' : 'rules'}</Pill>}
              </Stack>
              <Stack spacing={0.6} sx={{ fontSize: 13.5, color: C.muted }}>
                <span>🏷️ Team: <b style={{ color: TEAM_COLOR[meta.team ?? 'other'] }}>{meta.team ?? 'unlabelled'}</b>{meta.team_reason ? ` — ${meta.team_reason}` : ''}</span>
                <span>{meta.unanswered_days != null ? <>⏰ <b style={{ color: C.red }}>No reply for {meta.unanswered_days} days</b></> : '✅ Not waiting on a reply'}</span>
                {meta.critical.map((c) => <span key={c.filename}>⚠️ <b style={{ color: C.hazard }}>{c.kind}</b>: {c.filename} — {c.reason}</span>)}
              </Stack>
            </Box>

            {data ? thread.map((m) => (
              <MessageBlock key={m.id} m={m} open={openIds.has(m.id)}
                onToggle={() => setOpenIds((s) => { const n = new Set(s); n.has(m.id) ? n.delete(m.id) : n.add(m.id); return n })} />
            )) : <LoadingRows rows={3} height={70} />}

            {data && data.attachments.length > 0 && (
              <Box sx={{ mt: 2.5 }}>
                <Typography sx={{ fontWeight: 700, mb: 1.2, fontSize: 14 }}>{data.attachments.length} attachment{data.attachments.length > 1 ? 's' : ''}</Typography>
                <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' } }}>
                  {data.attachments.map((a) => {
                    const k = KIND_META[fileKind(a.mime_type, a.filename)]
                    const crit = data.critical.find((c) => c.filename === a.filename)
                    return (
                      <Box key={a.filename} sx={{ p: 1.6, borderRadius: 3, border: `1px solid ${crit ? `${C.hazard}66` : C.line}`, background: 'rgba(255,255,255,0.02)' }}>
                        <Stack direction="row" spacing={1.2} alignItems="center">
                          <Box sx={{ width: 34, height: 34, borderRadius: 1.5, display: 'grid', placeItems: 'center', fontSize: 10, fontWeight: 900, color: '#111', background: k.color }}>{k.label.slice(0, 3).toUpperCase()}</Box>
                          <Box sx={{ minWidth: 0 }}>
                            <Typography noWrap sx={{ fontWeight: 700, fontSize: 13.5 }}>{a.filename}</Typography>
                            {crit ? <Typography sx={{ fontSize: 12, color: C.hazard }}>Critical · {crit.kind}</Typography> : <Typography sx={{ fontSize: 12, color: C.dim }}>{k.label}</Typography>}
                          </Box>
                        </Stack>
                        {a.preview && <Typography sx={{ mt: 1, fontSize: 12, color: C.dim, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{a.preview}</Typography>}
                      </Box>
                    )
                  })}
                </Box>
              </Box>
            )}
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 3 }}>
              <Button variant="contained" startIcon={<ReplyRounded />} onClick={startReply}>Reply with suggested message</Button>
              <Button variant="outlined" href={meta.url} target="_blank" rel="noreferrer" startIcon={<OpenInNewRounded />}>Open in Gmail</Button>
            </Stack>
            <EmailComposer open={!!reply} initial={reply} loading={drafting} onClose={() => setReply(null)}
              title={drafting ? 'Writing a suggested reply…' : `Reply to ${meta.from_name || meta.from_addr}`}
              badge={reply?.method === 'ai' ? 'AI suggested reply' : reply?.method === 'template' ? 'Template reply' : undefined}
              keyPoints={reply?.key_points} />
          </>
        )}
      </Box>
    </Box>
  )
}

/* --------------------------------------------------------------------- page */

const PAGE = 50

export default function Gmail() {
  const { data, error, loading } = useApi<EmailList>('/api/emails')
  const { toast, refreshHealth } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const mobile = useMediaQuery('(max-width:1000px)')
  const phone = useMediaQuery('(max-width:640px)')
  const [compose, setCompose] = useState<EmailDraft | null>(null)
  const [folder, setFolder] = useState<Folder>('inbox')
  const [tab, setTab] = useState<Tab>('primary')
  const [query, setQuery] = useState('')
  const [range, setRange] = useState<DateRange>('any')
  const [unreadOnly, setUnreadOnly] = useState(false)
  const [attachOnly, setAttachOnly] = useState(false)
  const [oldestFirst, setOldestFirst] = useState(false)
  const [page, setPage] = useState(0)
  const [checked, setChecked] = useState<Set<string>>(new Set())
  const [dateMenu, setDateMenu] = useState<HTMLElement | null>(null)
  const [syncing, setSyncing] = useState(false)
  const searchRef = useRef<HTMLInputElement>(null)
  const openId = params.get('open')

  const emails = useMemo(() => data?.emails ?? [], [data])
  const counts = useMemo(() => {
    const c = {} as Record<Folder, number>
    for (const f of Object.keys(FOLDER_TEST) as Folder[]) c[f] = emails.filter(FOLDER_TEST[f]).length
    return c
  }, [emails])
  const unreadInbox = useMemo(() => emails.filter((e) => inInbox(e) && has(e, 'UNREAD')).length, [emails])
  const tabCounts = useMemo(() => {
    const c: Record<Tab, number> = { primary: 0, promotions: 0, social: 0, updates: 0, forums: 0 }
    emails.filter(inInbox).forEach((e) => c[tabOf(e)]++)
    return c
  }, [emails])
  const showTabs = folder === 'inbox' && !query && (tabCounts.promotions + tabCounts.social + tabCounts.updates + tabCounts.forums) > 0

  const filtered = useMemo(() => {
    const test = FOLDER_TEST[folder]
    const out = emails.filter((e) =>
      test(e) && (!showTabs || tabOf(e) === tab) && inRange(e.sent_at, range) && (!unreadOnly || has(e, 'UNREAD')) &&
      (!attachOnly || e.attachments.length > 0) && (!query.trim() || matchQuery(e, query.trim())))
    return oldestFirst ? [...out].reverse() : out
  }, [emails, folder, showTabs, tab, range, unreadOnly, attachOnly, query, oldestFirst])

  useEffect(() => { setPage(0) }, [folder, tab, range, unreadOnly, attachOnly, query, oldestFirst])
  useEffect(() => { setChecked(new Set()) }, [folder, tab, query])
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') { e.preventDefault(); searchRef.current?.focus() }
      if (e.key === 'Escape' && openId) setParams({}, { replace: true })
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [openId, setParams])

  const pageItems = filtered.slice(page * PAGE, page * PAGE + PAGE)
  const open = useCallback((id: string) => setParams({ open: id }), [setParams])
  const check = useCallback((id: string) => setChecked((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n }), [])
  const allChecked = pageItems.length > 0 && pageItems.every((e) => checked.has(e.id))

  const sync = async () => {
    setSyncing(true)
    try {
      const r = await post<{ imported: number }>('/api/sync/gmail')
      toast(`Synced ${r.imported} emails from Gmail`)
      invalidate('/api/emails')
      refreshHealth()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const pick = (f: Folder) => { setFolder(f); setParams({}, { replace: true }) }
  const askSelected = () => {
    const subj = emails.filter((e) => checked.has(e.id)).map((e) => `"${e.subject}"`).slice(0, 8).join(', ')
    navigate('/ask', { state: { q: `Summarise these emails and the next steps: ${subj}` } })
  }

  const navItems: { f: Folder; icon: ReactNode; label: string; count?: number; color?: string; group?: string }[] = [
    { f: 'inbox', icon: <InboxRounded />, label: 'Inbox', count: unreadInbox || counts.inbox },
    { f: 'starred', icon: <StarRounded />, label: 'Starred', count: counts.starred },
    { f: 'important', icon: <LabelImportantRounded />, label: 'Important', count: counts.important },
    { f: 'sent', icon: <SendRounded />, label: 'Sent', count: counts.sent },
    { f: 'drafts', icon: <DraftsRounded />, label: 'Drafts', count: counts.drafts },
    { f: 'all', icon: <AllInboxRounded />, label: 'All mail', count: counts.all },
    { f: 'unanswered', icon: <ScheduleRounded />, label: `No reply ${data?.unanswered_days ?? 5}+ days`, count: counts.unanswered, color: C.red, group: 'Unsilo smart views' },
    { f: 'critical', icon: <WarningAmberRounded />, label: 'Critical attachments', count: counts.critical, color: C.hazard },
    { f: 'attachments', icon: <AttachFileRounded />, label: 'With attachments', count: counts.attachments },
    ...(['sales', 'marketing', 'other'] as const).map((t, i) => ({ f: `team:${t}` as Folder, icon: <SellRounded />, label: t[0].toUpperCase() + t.slice(1), count: counts[`team:${t}`], color: TEAM_COLOR[t], group: i === 0 ? 'Teams' : undefined })),
  ]

  const rail = mobile ? (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1.2, overflowX: 'auto', borderBottom: `1px solid ${C.line}`, '&::-webkit-scrollbar': { height: 0 } }}>
      <Button variant="contained" size="small" startIcon={<EditRounded />} onClick={() => setCompose({ to: '', subject: '', body: '' })} sx={{ flexShrink: 0, borderRadius: 99 }}>Compose</Button>
      {navItems.map((n) => <NavItem key={n.f} chip icon={n.icon} label={n.label} count={n.count} color={n.color} active={folder === n.f} onClick={() => pick(n.f)} />)}
    </Stack>
  ) : (
    <Box sx={{ width: 236, flexShrink: 0, py: 1.5 }}>
      <Box sx={{ px: 1.5, mb: 1.5 }}>
        <Button variant="contained" startIcon={<EditRounded />} onClick={() => setCompose({ to: '', subject: '', body: '' })}
          sx={{ borderRadius: 4, py: 1.6, px: 3 }}>Compose</Button>
      </Box>
      {navItems.map((n) => (
        <Box key={n.f}>
          {n.group && <Typography variant="overline" sx={{ display: 'block', color: C.dim, px: 2.2, mt: 2, mb: 0.5, fontSize: 10 }}>{n.group}</Typography>}
          <NavItem icon={n.icon} label={n.label} count={n.count} color={n.color} active={folder === n.f} onClick={() => pick(n.f)} />
        </Box>
      ))}
      <Box sx={{ m: 1.5, mt: 3, p: 2, borderRadius: 3, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.02)' }}>
        <Typography variant="overline" sx={{ color: C.dim, fontSize: 10 }}>Storage snapshot</Typography>
        <Typography sx={{ fontFamily: '"Bricolage Grotesque"', fontWeight: 800, fontSize: 28 }}>{emails.length}</Typography>
        <Typography sx={{ fontSize: 12, color: C.dim, mb: 1 }}>emails indexed · read-only</Typography>
        <LinearProgress variant="determinate" value={Math.min(100, (emails.length / 2000) * 100)} sx={{ height: 6, borderRadius: 9, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${C.hazard}, ${C.amber})` } }} />
      </Box>
    </Box>
  )

  const TABS: { key: Tab; label: string; icon: ReactNode; color: string }[] = [
    { key: 'primary', label: 'Primary', icon: <InboxRounded />, color: C.amber },
    { key: 'promotions', label: 'Promotions', icon: <LocalOfferRounded />, color: C.lime },
    { key: 'social', label: 'Social', icon: <PeopleAltRounded />, color: C.sky },
    { key: 'updates', label: 'Updates', icon: <InfoRounded />, color: C.hazard },
    { key: 'forums', label: 'Forums', icon: <ForumRounded />, color: C.pink },
  ]

  return (
    <Box sx={{ borderRadius: 5, border: `1px solid ${C.line}`, background: 'rgba(14,14,17,0.88)', backdropFilter: 'blur(10px)', overflow: 'hidden' }}>
      {/* header: logo + search */}
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={{ xs: 1.5, md: 2 }} sx={{ px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.5, sm: 2 }, borderBottom: `1px solid ${C.line}` }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: { md: 236 }, flexShrink: 0 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: C.amber, background: `${C.amber}1a`, border: `1px solid ${C.amber}33` }}><MarkEmailUnreadRounded /></Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Gmail</Typography>
            <Typography sx={{ fontSize: 12, color: C.dim }}>Business inbox · indexed view</Typography>
          </Box>
        </Stack>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, px: 2, height: 48, borderRadius: 99, background: 'rgba(255,255,255,0.06)', border: `1px solid transparent`, '&:focus-within': { background: '#1c1c22', borderColor: `${C.amber}66` } }}>
          <SearchRounded sx={{ color: C.dim }} />
          <InputBase inputRef={searchRef} value={query} onChange={(e) => setQuery(e.target.value)} placeholder={phone ? 'Search mail' : 'Search mail   (try from:anil  has:attachment  label:unanswered)'} sx={{ flex: 1, minWidth: 0, fontSize: 15 }} />
          {query && <IconButton size="small" onClick={() => setQuery('')}><CloseRounded fontSize="small" /></IconButton>}
          <Box sx={{ px: 1, py: 0.2, borderRadius: 1, border: `1px solid ${C.line}`, fontSize: 11, color: C.dim, display: { xs: 'none', md: 'block' } }}>/</Box>
        </Box>
        <Tooltip title="Sync Gmail now">
          <span><IconButton onClick={sync} disabled={syncing} sx={{ border: `1px solid ${C.line}` }}><RefreshRounded sx={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} /></IconButton></span>
        </Tooltip>
      </Stack>
      {(syncing || (loading && !data)) && <LinearProgress sx={{ height: 2, '& .MuiLinearProgress-bar': { background: C.amber } }} />}

      <Stack direction={mobile ? 'column' : 'row'} sx={{ minHeight: 640 }}>
        {rail}

        <Box sx={{ flex: 1, minWidth: 0, borderLeft: mobile ? 0 : `1px solid ${C.line}` }}>
          {openId ? (
            <Reader id={openId} list={filtered} onClose={() => setParams({}, { replace: true })} onMove={open} />
          ) : (
            <>
              {/* toolbar */}
              <Stack direction="row" alignItems="center" spacing={0.5} sx={{ px: 1, py: 0.6, borderBottom: `1px solid ${C.line}`, flexWrap: 'wrap', rowGap: 0.5 }}>
                <Checkbox size="small" checked={allChecked} indeterminate={!allChecked && pageItems.some((e) => checked.has(e.id))}
                  onChange={() => setChecked(allChecked ? new Set() : new Set(pageItems.map((e) => e.id)))} sx={{ color: C.dim }} />
                {checked.size > 0 ? (
                  <>
                    <Typography sx={{ fontSize: 13, color: C.muted, mx: 1 }}>{checked.size} selected</Typography>
                    <Button size="small" startIcon={<AutoAwesomeRounded />} onClick={askSelected} sx={{ color: C.amber }}>Ask Unsilo about these</Button>
                  </>
                ) : (
                  <>
                    <Button size="small" startIcon={<TuneRounded />} endIcon={<ExpandMoreRounded />} onClick={(e) => setDateMenu(e.currentTarget)}
                      sx={{ color: range === 'any' ? C.muted : C.amber, borderRadius: 99, border: `1px solid ${range === 'any' ? C.line : `${C.amber}66`}`, px: 1.5 }}>{DATE_LABEL[range]}</Button>
                    <FilterChip on={unreadOnly} onClick={() => setUnreadOnly((v) => !v)} label="Unread" />
                    <FilterChip on={attachOnly} onClick={() => setAttachOnly((v) => !v)} label="Has attachment" />
                    <FilterChip on={oldestFirst} onClick={() => setOldestFirst((v) => !v)} label={oldestFirst ? 'Oldest first' : 'Newest first'} />
                    {(range !== 'any' || unreadOnly || attachOnly || query) && (
                      <Button size="small" onClick={() => { setRange('any'); setUnreadOnly(false); setAttachOnly(false); setQuery('') }} sx={{ color: C.dim }}>Clear filters</Button>
                    )}
                  </>
                )}
                <Box sx={{ flex: 1 }} />
                <Typography sx={{ fontSize: 12.5, color: C.dim }}>
                  {filtered.length ? `${page * PAGE + 1}–${Math.min(filtered.length, (page + 1) * PAGE)} of ${filtered.length}` : '0 of 0'}
                </Typography>
                <IconButton size="small" disabled={page === 0} onClick={() => setPage((p) => p - 1)}><ChevronLeftRounded /></IconButton>
                <IconButton size="small" disabled={(page + 1) * PAGE >= filtered.length} onClick={() => setPage((p) => p + 1)}><ChevronRightRounded /></IconButton>
              </Stack>
              <Menu anchorEl={dateMenu} open={!!dateMenu} onClose={() => setDateMenu(null)}>
                {(Object.keys(DATE_LABEL) as DateRange[]).map((r) => (
                  <MenuItem key={r} selected={r === range} onClick={() => { setRange(r); setDateMenu(null) }}>{DATE_LABEL[r]}</MenuItem>
                ))}
              </Menu>

              {/* category tabs */}
              {showTabs && (
                <Stack direction="row" sx={{ borderBottom: `1px solid ${C.line}`, overflowX: 'auto' }}>
                  {TABS.map((t) => (
                    <Box key={t.key} onClick={() => setTab(t.key)} role="tab" aria-selected={tab === t.key}
                      sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 1.2, px: { xs: 1.6, sm: 2.5 }, py: 1.6, minWidth: { xs: 'auto', md: 170 }, flexShrink: 0, cursor: 'pointer',
                        color: tab === t.key ? t.color : C.muted, fontWeight: 700, fontSize: 14, '&:hover': { background: 'rgba(255,255,255,0.03)' }, '& svg': { fontSize: 19 } }}>
                      {t.icon}{t.label}
                      {tabCounts[t.key] > 0 && <Pill color={t.color} sx={{ fontSize: 10.5, py: 0 }}>{tabCounts[t.key]}</Pill>}
                      {tab === t.key && <motion.span layoutId="gmail-tab" style={{ position: 'absolute', left: 8, right: 8, bottom: 0, height: 3, borderRadius: 3, background: t.color }} />}
                    </Box>
                  ))}
                </Stack>
              )}

              {error && <Box sx={{ p: 2 }}><ErrorBox message={error} /></Box>}
              {!data && !error ? <Box sx={{ p: 2 }}><LoadingRows rows={10} height={40} /></Box> : pageItems.length === 0 ? (
                <EmptyState title={emails.length ? 'No messages match' : 'No emails synced yet'}
                  text={emails.length ? 'Try another folder, tab or filter. Search supports from:, subject:, has:attachment, is:unread and label:.' : 'Connect Google on the Connections page, then hit sync.'}
                  action={!emails.length ? <Button variant="contained" onClick={sync} disabled={syncing}>Sync Gmail</Button> : undefined} />
              ) : (
                <Box>{pageItems.map((e) => <Row key={e.id} e={e} phone={phone} checked={checked.has(e.id)} onCheck={check} onOpen={open} />)}</Box>
              )}
              {data && (
                <Divider sx={{ my: 0 }} />
              )}
              {data && (
                <Typography sx={{ px: 2, py: 1.5, fontSize: 12, color: C.dim }}>
                  Read-only mirror of Gmail · reference date {data.reference_date} · replies open in Gmail, ready to send.
                </Typography>
              )}
            </>
          )}
        </Box>
      </Stack>
      <EmailComposer open={!!compose} initial={compose} onClose={() => setCompose(null)} title="New message" />
    </Box>
  )
}

function FilterChip({ on, label, onClick }: { on: boolean; label: string; onClick: () => void }) {
  return (
    <Button size="small" onClick={onClick} sx={{ borderRadius: 99, px: 1.5, color: on ? '#140b00' : C.muted, background: on ? C.amber : 'transparent', border: `1px solid ${on ? C.amber : C.line}`, '&:hover': { background: on ? C.amber : 'rgba(255,255,255,0.05)' } }}>
      {label}
    </Button>
  )
}
