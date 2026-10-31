import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Dialog from '@mui/material/Dialog'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import LinearProgress from '@mui/material/LinearProgress'
import useMediaQuery from '@mui/material/useMediaQuery'
import CloseRounded from '@mui/icons-material/CloseRounded'
import SendRounded from '@mui/icons-material/SendRounded'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import MailOutlineRounded from '@mui/icons-material/MailOutlineRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import EditNoteRounded from '@mui/icons-material/EditNoteRounded'
import VisibilityRounded from '@mui/icons-material/VisibilityRounded'
import { Avatar, Pill } from './ui'
import { gmailComposeUrl, isValidEmailList, mailtoUrl, trimForUrl, type EmailDraft } from '../lib/email'
import { useApp } from '../lib/app-context'
import { colorFor } from '../lib/format'
import { C } from '../theme'

type Props = {
  open: boolean
  onClose: () => void
  initial: EmailDraft | null
  title?: string
  loading?: boolean
  badge?: string
  keyPoints?: string[]
}

function Field({ label, value, onChange, placeholder, error }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; error?: boolean }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1, borderBottom: `1px solid ${C.line}` }}>
      <Typography sx={{ width: 58, flexShrink: 0, fontSize: 13.5, color: error ? C.red : C.dim }}>{label}</Typography>
      <InputBase value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} fullWidth sx={{ fontSize: 14.5 }} inputProps={{ 'aria-label': label }} />
    </Stack>
  )
}

/** Compose window: edit the message, see exactly how it will look, then open it in Gmail (or any mail app) to send. */
export default function EmailComposer({ open, onClose, initial, title = 'New message', loading, badge, keyPoints }: Props) {
  const { toast } = useApp()
  const mobile = useMediaQuery('(max-width:899px)')
  const [d, setD] = useState<EmailDraft>({ to: '', cc: '', subject: '', body: '' })
  const [tab, setTab] = useState<'edit' | 'preview'>('edit')
  useEffect(() => { if (initial) setD({ cc: '', ...initial }) }, [initial])
  useEffect(() => { if (open) setTab('edit') }, [open])

  const toOk = isValidEmailList(d.to)
  const ccOk = isValidEmailList(d.cc ?? '')
  const ready = !!d.to.trim() && toOk && ccOk && !!d.subject.trim()
  const trimmed = trimForUrl(d.body).trimmed
  const set = (k: keyof EmailDraft) => (v: string) => setD((x) => ({ ...x, [k]: v }))

  const copyAll = () => {
    navigator.clipboard?.writeText(`To: ${d.to}\n${d.cc ? `Cc: ${d.cc}\n` : ''}Subject: ${d.subject}\n\n${d.body}`)
    toast('Email copied')
  }

  const editor = (
    <Stack sx={{ flex: 1, minWidth: 0, minHeight: 0 }}>
      <Field label="To" value={d.to} onChange={set('to')} placeholder="name@company.com, other@company.com" error={!toOk} />
      <Field label="Cc" value={d.cc ?? ''} onChange={set('cc')} placeholder="optional" error={!ccOk} />
      <Field label="Subject" value={d.subject} onChange={set('subject')} />
      {loading && <LinearProgress sx={{ height: 2, '& .MuiLinearProgress-bar': { background: C.amber } }} />}
      <InputBase multiline value={d.body} onChange={(e) => set('body')(e.target.value)} placeholder="Write your message…"
        sx={{ flex: 1, alignItems: 'flex-start', p: 2, fontSize: 14.5, lineHeight: 1.65, overflowY: 'auto', '& textarea': { minHeight: { xs: 260, md: 340 } } }} />
    </Stack>
  )

  const preview = (
    <Box sx={{ flex: 1, minWidth: 0, p: { xs: 2, md: 3 }, overflowY: 'auto', background: '#f6f6f7', color: '#18181b' }}>
      <Typography sx={{ fontSize: 11, fontWeight: 800, letterSpacing: '0.18em', color: '#71717a', mb: 1.5 }}>PREVIEW · HOW THE EMAIL WILL LOOK</Typography>
      <Box sx={{ background: '#fff', borderRadius: 3, p: { xs: 2, md: 3 }, boxShadow: '0 1px 3px rgba(0,0,0,0.08), 0 8px 30px rgba(0,0,0,0.06)' }}>
        <Typography sx={{ fontSize: { xs: 18, md: 21 }, fontWeight: 600, mb: 2, wordBreak: 'break-word' }}>{d.subject || '(no subject)'}</Typography>
        <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 2 }}>
          <Avatar name="Me" color={colorFor('me')} size={38} />
          <Box sx={{ minWidth: 0 }}>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>You</Typography>
            <Typography noWrap sx={{ fontSize: 12.5, color: '#71717a' }}>to {d.to || '…'}{d.cc ? `, cc ${d.cc}` : ''}</Typography>
          </Box>
        </Stack>
        <Typography component="div" sx={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14.5, lineHeight: 1.7, color: '#27272a' }}>
          {d.body || 'Your message will appear here.'}
        </Typography>
      </Box>
      {keyPoints && keyPoints.length > 0 && (
        <Box sx={{ mt: 2, p: 2, borderRadius: 3, background: '#fff7ea', border: '1px solid #ffd59a' }}>
          <Typography sx={{ fontWeight: 800, fontSize: 13, mb: 0.6, color: '#9a5b00' }}>What this reply covers</Typography>
          {keyPoints.map((k) => <Typography key={k} sx={{ fontSize: 13, color: '#6b4500' }}>• {k}</Typography>)}
        </Box>
      )}
    </Box>
  )

  return (
    <Dialog open={open} onClose={onClose} fullScreen={mobile} fullWidth maxWidth="lg"
      PaperProps={{ sx: { height: { md: '86vh' }, overflow: 'hidden', background: C.panel } }}
      slotProps={{ backdrop: { sx: { backdropFilter: 'blur(6px)', background: 'rgba(0,0,0,0.65)' } } }}>
      <Stack component={motion.div} initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: 'spring', stiffness: 260, damping: 26 }} sx={{ height: '100%' }}>
        <Stack direction="row" alignItems="center" spacing={1.2} sx={{ px: 2, py: 1.2, borderBottom: `1px solid ${C.line}`, background: '#1a1a20' }}>
          <MailOutlineRounded sx={{ color: C.amber }} />
          <Typography sx={{ fontWeight: 800, flex: 1, minWidth: 0 }} noWrap>{title}</Typography>
          {badge && <Pill color={C.lime} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}><AutoAwesomeRounded sx={{ fontSize: 13 }} />{badge}</Pill>}
          <IconButton onClick={onClose} aria-label="Close"><CloseRounded /></IconButton>
        </Stack>

        {mobile && (
          <Stack direction="row" sx={{ borderBottom: `1px solid ${C.line}` }}>
            {(['edit', 'preview'] as const).map((t) => (
              <Button key={t} fullWidth onClick={() => setTab(t)} startIcon={t === 'edit' ? <EditNoteRounded /> : <VisibilityRounded />}
                sx={{ borderRadius: 0, py: 1.2, color: tab === t ? C.amber : C.muted, borderBottom: `2px solid ${tab === t ? C.amber : 'transparent'}` }}>
                {t === 'edit' ? 'Write' : 'Preview'}
              </Button>
            ))}
          </Stack>
        )}

        <Stack direction="row" sx={{ flex: 1, minHeight: 0 }}>
          {mobile ? (
            <AnimatePresence mode="wait">
              <motion.div key={tab} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} style={{ flex: 1, display: 'flex', minWidth: 0 }}>
                {tab === 'edit' ? editor : preview}
              </motion.div>
            </AnimatePresence>
          ) : (
            <>
              <Box sx={{ flex: 1, display: 'flex', minWidth: 0, borderRight: `1px solid ${C.line}` }}>{editor}</Box>
              {preview}
            </>
          )}
        </Stack>

        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} alignItems={{ sm: 'center' }} sx={{ px: 2, py: 1.5, borderTop: `1px solid ${C.line}`, background: '#141418' }}>
          <Typography sx={{ flex: 1, fontSize: 12, color: trimmed ? C.hazard : C.dim }}>
            {trimmed ? 'Long message: the link carries a shortened copy. Use "Copy" to paste the full text.' : 'Unsilo is read-only: your email opens in Gmail, ready to send.'}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', rowGap: 1 }}>
            <Tooltip title="Copy the whole email">
              <Button variant="outlined" startIcon={<ContentCopyRounded />} onClick={copyAll}>Copy</Button>
            </Tooltip>
            <Button variant="outlined" href={ready ? mailtoUrl(d) : undefined} disabled={!ready}>Mail app</Button>
            <Button variant="contained" endIcon={<SendRounded />} disabled={!ready} href={ready ? gmailComposeUrl(d) : undefined} target="_blank" rel="noreferrer">
              Open in Gmail
            </Button>
          </Stack>
        </Stack>
      </Stack>
    </Dialog>
  )
}
