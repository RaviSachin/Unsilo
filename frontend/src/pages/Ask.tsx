import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import SearchRounded from '@mui/icons-material/SearchRounded'
import SendRounded from '@mui/icons-material/SendRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded'
import DeleteSweepRounded from '@mui/icons-material/DeleteSweepRounded'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import ForwardToInboxRounded from '@mui/icons-material/ForwardToInboxRounded'
import DataObjectRounded from '@mui/icons-material/DataObjectRounded'
import EmailComposer from '../components/EmailComposer'
import { answerToEmail, downloadJson, slug, type EmailDraft } from '../lib/email'
import StarField from '../components/aceternity/StarField'
import { GlowCard, Spotlight, TextGenerate } from '../components/aceternity/Effects'
import { Pill, SourceChip, SOURCE_META } from '../components/ui'
import { post } from '../lib/api'
import type { AskResult } from '../lib/types'
import { fullDate } from '../lib/format'
import { useApp } from '../lib/app-context'
import { C } from '../theme'

const SUGGESTIONS = [
  'Which equipment needs maintenance this month?',
  'Find the latest rental quotation for an excavator',
  'Show pending customer follow-ups',
  'What did the site team decide about delivery?',
  'Give me a summary of everything',
]
const PLACEHOLDERS = [
  'Ask about equipment, rentals, invoices, sites, decisions…',
  'Where is the latest quotation for Shree Constructions?',
  'Which sales emails are still pending a reply?',
  'What did the site team agree on this week?',
  'Which KYC documents do we have?',
]

type Turn = { id: number; q: string; result?: AskResult; error?: string }

// Survives page switches inside the SPA, so the conversation is still there when you come back.
let history: Turn[] = []
let nextId = 1

const MODE_BADGE: Record<string, { label: string; color: string }> = {
  ai: { label: 'grounded answer', color: C.lime },
  closest: { label: 'closest match', color: C.hazard },
  overview: { label: 'summary', color: C.sky },
  records: { label: 'top records', color: C.amber },
  chat: { label: 'hello', color: C.lime },
  empty: { label: 'no data yet', color: C.amber },
  not_found: { label: 'no data found', color: C.amber },
}

function AskInput({ onAsk, busy, focusKey }: { onAsk: (q: string) => void; busy: boolean; focusKey?: unknown }) {
  const [value, setValue] = useState('')
  const [ph, setPh] = useState(0)
  const [vanish, setVanish] = useState<string | null>(null)
  const ref = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const t = window.setInterval(() => setPh((v) => (v + 1) % PLACEHOLDERS.length), 3200)
    return () => window.clearInterval(t)
  }, [])
  useEffect(() => { ref.current?.focus() }, [focusKey])

  const submit = (e: FormEvent) => {
    e.preventDefault()
    const q = value.trim()
    if (!q || busy) return
    setVanish(q)
    setValue('')
    onAsk(q)
    window.setTimeout(() => setVanish(null), 650)
  }

  return (
    <Box component="form" onSubmit={submit} sx={{
      position: 'relative', display: 'flex', alignItems: 'center', gap: { xs: 1, sm: 1.5 }, pl: { xs: 1.5, sm: 2.5 }, pr: 1, py: 1, borderRadius: 4,
      border: `1px solid ${C.line}`, background: 'rgba(20,20,24,0.85)', backdropFilter: 'blur(10px)',
      boxShadow: `0 20px 60px rgba(0,0,0,0.45)`, transition: 'border-color .2s, box-shadow .2s',
      '&:focus-within': { borderColor: `${C.amber}88`, boxShadow: `0 0 0 4px ${C.amber}1a, 0 20px 60px rgba(0,0,0,0.45)` },
    }}>
      <SearchRounded sx={{ color: C.dim, display: { xs: 'none', sm: 'block' } }} />
      <Box sx={{ position: 'relative', flex: 1, minWidth: 0, height: 48, overflow: 'hidden', fontSize: { xs: 15, sm: 17 } }}>
        <Box component="input" ref={ref} value={value} onChange={(e) => setValue(e.target.value)} aria-label="Ask Unsilo"
          sx={{ position: 'absolute', inset: 0, width: '100%', background: 'transparent', border: 0, outline: 0, color: C.text, fontSize: { xs: 15, sm: 17 }, fontFamily: 'inherit' }} />
        <AnimatePresence mode="wait">
          {!value && !vanish && (
            <motion.span key={ph} initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: -12, opacity: 0 }} transition={{ duration: 0.3 }}
              style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'block', lineHeight: '48px', color: C.dim, fontSize: 'inherit', pointerEvents: 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', right: 0 }}>
              {PLACEHOLDERS[ph]}
            </motion.span>
          )}
        </AnimatePresence>
        <AnimatePresence>
          {vanish && (
            <motion.span key="vanish" initial={{ opacity: 1, x: 0, filter: 'blur(0px)' }} animate={{ opacity: 0, x: 40, filter: 'blur(10px)', letterSpacing: '0.3em' }}
              transition={{ duration: 0.6 }} style={{ position: 'absolute', left: 0, top: 0, bottom: 0, display: 'flex', alignItems: 'center', fontSize: 'inherit', color: C.amber, pointerEvents: 'none', whiteSpace: 'nowrap' }}>
              {vanish}
            </motion.span>
          )}
        </AnimatePresence>
      </Box>
      <Button type="submit" variant="contained" disabled={busy || !value.trim()} aria-label="Ask"
        sx={{ height: 48, minWidth: { xs: 48, sm: 96 }, px: { xs: 0, sm: 3 }, '&.Mui-disabled': { opacity: 0.5, color: '#140b00' } }}>
        <Box component="span" sx={{ display: { xs: 'none', sm: 'inline' }, mr: 1 }}>Ask</Box><SendRounded fontSize="small" />
      </Button>
    </Box>
  )
}

function Thinking() {
  return (
    <GlowCard sx={{ p: 3 }}>
      <Stack direction="row" spacing={2} alignItems="center">
        <Box sx={{ width: 34, height: 34, borderRadius: '50%', border: `3px solid ${C.line}`, borderTopColor: C.amber, animation: 'spin .8s linear infinite' }} />
        <Box>
          <Typography className="shimmer-text" sx={{ fontWeight: 700 }}>Digging through Gmail, Drive and site chats…</Typography>
          <Typography sx={{ color: C.dim, fontSize: 13 }}>Finding the receipts first, then writing the answer.</Typography>
        </Box>
      </Stack>
    </GlowCard>
  )
}

function AnswerCard({ turn }: { turn: Turn }) {
  const { toast } = useApp()
  const [mail, setMail] = useState<EmailDraft | null>(null)
  const [hot, setHot] = useState<number | null>(null)
  const r = turn.result
  if (turn.error) {
    return (
      <GlowCard sx={{ p: 3 }} glow={C.red}>
        <Typography sx={{ color: C.muted, mb: 1 }}>{turn.q}</Typography>
        <Typography sx={{ color: '#ffc2cc' }}>{turn.error}</Typography>
      </GlowCard>
    )
  }
  if (!r) return <Thinking />
  const ids = r.citations.map((c) => c.source_id)
  const badge = MODE_BADGE[r.mode] ?? MODE_BADGE.records

  const cite = (n: number, key: string) => (
    <Box key={key} component="sup" onMouseEnter={() => setHot(n)} onMouseLeave={() => setHot(null)}
      onClick={() => document.getElementById(`cite-${turn.id}-${n}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
      sx={{ display: 'inline-grid', placeItems: 'center', minWidth: 18, height: 18, px: 0.4, mx: 0.25, borderRadius: 1, fontSize: 11, fontWeight: 800, cursor: 'pointer', color: '#140b00', background: C.amber, verticalAlign: 'super' }}>
      {n}
    </Box>
  )
  const renderWord = (word: string, key: string): ReactNode => {
    const parts = word.split(/(\[[a-z_]+:[^\]]+\]|\[S\d+\])/)
    if (parts.length === 1) return <>{word} </>
    return (
      <>
        {parts.map((p, i) => {
          const m = p.match(/^\[([a-z_]+:[^\]]+)\]$/)
          if (m) { const n = ids.indexOf(m[1]) + 1; return n ? cite(n, `${key}-${i}`) : null }
          const s = p.match(/^\[S(\d+)\]$/)
          if (s) return cite(Number(s[1]), `${key}-${i}`)
          return <span key={`${key}-${i}`}>{p}</span>
        })}{' '}
      </>
    )
  }

  return (
    <GlowCard sx={{ p: { xs: 2.5, md: 3.5 } }} glow={r.answerable ? C.amber : C.hazard}>
      <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <AutoAwesomeRounded sx={{ color: C.amber, fontSize: 20 }} />
        <Typography sx={{ color: C.muted, flex: 1, minWidth: 200 }}>{turn.q}</Typography>
        <Pill color={badge.color}>{badge.label}</Pill>
        <Stack direction="row" spacing={0.5}>
          <Tooltip title="Copy answer">
            <IconButton size="small" onClick={() => { navigator.clipboard?.writeText(answerToEmail(r).body); toast('Answer copied') }}><ContentCopyRounded fontSize="small" /></IconButton>
          </Tooltip>
          <Tooltip title="Download answer as JSON">
            <IconButton size="small" onClick={() => downloadJson(`unsilo-answer-${slug(r.question)}`, r)}><DataObjectRounded fontSize="small" /></IconButton>
          </Tooltip>
        </Stack>
      </Stack>
      <Box sx={{ fontSize: { xs: 16, md: 18 }, lineHeight: 1.7, color: r.answerable ? C.text : '#ffd8a8' }}>
        <TextGenerate key={turn.id} text={r.answer} renderWord={renderWord} />
      </Box>

      {r.citations.length > 0 && (
        <>
          <Typography variant="overline" sx={{ color: C.dim, display: 'block', mt: 3, mb: 1.2 }}>Receipts</Typography>
          <Box sx={{ display: 'grid', gap: 1.2, gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)' } }}>
            {r.citations.map((c, i) => {
              const meta = SOURCE_META[c.type]
              return (
                <Box key={c.source_id} id={`cite-${turn.id}-${i + 1}`} component={motion.a} href={c.url || undefined} target="_blank" rel="noreferrer"
                  initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.06 }}
                  sx={{
                    display: 'flex', gap: 1.5, p: 1.8, borderRadius: 3, textDecoration: 'none', color: 'inherit',
                    border: `1px solid ${hot === i + 1 ? C.amber : C.line}`, background: hot === i + 1 ? `${C.amber}10` : 'rgba(255,255,255,0.02)',
                    transition: 'all .2s', cursor: c.url ? 'pointer' : 'default', '&:hover': { borderColor: `${meta?.color ?? C.amber}88` },
                  }}>
                  <Box sx={{ width: 26, height: 26, flexShrink: 0, borderRadius: 1.5, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, color: '#140b00', background: C.amber }}>{i + 1}</Box>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.5 }}>
                      <SourceChip type={c.type} />
                      {c.url && <OpenInNewRounded sx={{ fontSize: 14, color: C.dim }} />}
                    </Stack>
                    <Typography noWrap sx={{ fontWeight: 700, fontSize: 14.5 }}>{c.title}</Typography>
                    <Typography sx={{ fontSize: 12, color: C.dim }}>{[c.from, fullDate(c.date)].filter(Boolean).join(' · ')}</Typography>
                    <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.6, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{c.excerpt}</Typography>
                  </Box>
                </Box>
              )
            })}
          </Box>
        </>
      )}
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }} justifyContent="space-between" sx={{ mt: 2.5 }}>
        <Typography sx={{ color: C.dim, fontSize: 12.5, wordBreak: 'break-word' }}>
          Searched: {r.retrieval.terms.join(', ') || '—'}
          {r.retrieval.period ? ` · period ${r.retrieval.period[0].slice(0, 10)} → ${r.retrieval.period[1].slice(0, 10)}` : ''}
        </Typography>
        {r.mode !== 'chat' && (
          <Stack direction="row" spacing={1} sx={{ flexShrink: 0 }}>
            <Button size="small" variant="outlined" startIcon={<DataObjectRounded />} onClick={() => downloadJson(`unsilo-answer-${slug(r.question)}`, r)}>JSON</Button>
            <Button size="small" variant="contained" startIcon={<ForwardToInboxRounded />} onClick={() => setMail(answerToEmail(r))}>Email this</Button>
          </Stack>
        )}
      </Stack>
      <EmailComposer open={!!mail} initial={mail} onClose={() => setMail(null)} title="Email this answer" badge="Answer + receipts" />
    </GlowCard>
  )
}

export default function Ask() {
  const location = useLocation() as { pathname: string; state?: { q?: string; focus?: number } | null }
  const navigate = useNavigate()
  const [turns, setTurns] = useState<Turn[]>(history)
  const [busy, setBusy] = useState(false)
  const endRef = useRef<HTMLDivElement>(null)
  const askedFromState = useRef<string | null>(null)

  useEffect(() => { history = turns }, [turns])

  const ask = async (q: string) => {
    const id = nextId++
    setTurns((t) => [...t, { id, q }])
    setBusy(true)
    window.setTimeout(() => endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }), 60)
    try {
      const result = await post<AskResult>('/api/ask', { question: q })
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, result } : x)))
    } catch (e) {
      setTurns((t) => t.map((x) => (x.id === id ? { ...x, error: (e as Error).message } : x)))
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => {
    const q = location.state?.q
    if (q && askedFromState.current !== q) {
      askedFromState.current = q
      ask(q)
      navigate(location.pathname, { replace: true, state: null })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state?.q])

  const empty = turns.length === 0
  return (
    <Box sx={{ position: 'relative', maxWidth: 1080, mx: 'auto' }}>
      {empty && (
        <Box sx={{ position: 'relative', textAlign: 'center', pt: { xs: 4, md: 7 }, pb: 5 }}>
          <Box sx={{ position: 'absolute', inset: '-40px -10vw 0', overflow: 'hidden', pointerEvents: 'none', maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 70%)' }}>
            <Spotlight />
            <StarField density={1.6} />
          </Box>
          <Box component={motion.div} initial={{ scale: 0.6, opacity: 0, rotate: -20 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} transition={{ type: 'spring', stiffness: 160, damping: 12 }}
            sx={{ position: 'relative', width: 64, height: 64, mx: 'auto', borderRadius: '20px', display: 'grid', placeItems: 'center', color: C.amber, background: `${C.amber}18`, border: `1px solid ${C.amber}40`, boxShadow: `0 0 40px ${C.amber}30` }}>
            <AutoAwesomeRounded sx={{ fontSize: 30 }} />
          </Box>
          <Typography variant="overline" sx={{ position: 'relative', color: C.amber, display: 'block', mt: 3 }}>The business brain</Typography>
          <Typography variant="h1" sx={{ position: 'relative', fontSize: { xs: 40, md: 64 }, mt: 1 }}>
            Ask <Box component="span" className="gradient-text">literally</Box> anything.
          </Typography>
          <Typography sx={{ position: 'relative', color: C.muted, mt: 1.5, fontSize: 17 }}>Your Gmail + Drive + site conversations. One answer, with receipts.</Typography>
        </Box>
      )}

      <Stack spacing={2.5} sx={{ mb: 3 }}>
        <AnimatePresence initial={false}>
          {turns.map((t) => (
            <motion.div key={t.id} initial={{ opacity: 0, y: 24, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ type: 'spring', stiffness: 200, damping: 24 }}>
              <AnswerCard turn={t} />
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={endRef} />
      </Stack>

      <Box sx={{ position: empty ? 'relative' : 'sticky', bottom: 16, zIndex: 3 }}>
        <AskInput onAsk={ask} busy={busy} focusKey={location.state?.focus} />
      </Box>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" justifyContent="center" sx={{ mt: 2.5 }}>
        {SUGGESTIONS.map((s, i) => (
          <Box key={s} component={motion.button} type="button" onClick={() => !busy && ask(s)}
            initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 + i * 0.05 }} whileHover={{ y: -2 }}
            sx={{ px: 2, py: 1, borderRadius: 99, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.03)', color: C.text, fontSize: 13.5, fontFamily: 'inherit', cursor: 'pointer', '&:hover': { borderColor: `${C.amber}66`, color: C.amber } }}>
            {s}
          </Box>
        ))}
        {!empty && (
          <Button size="small" startIcon={<DeleteSweepRounded />} onClick={() => setTurns([])} sx={{ color: C.dim }}>Clear chat</Button>
        )}
      </Stack>
    </Box>
  )
}
