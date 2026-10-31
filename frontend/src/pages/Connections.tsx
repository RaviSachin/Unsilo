import { useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import MailRounded from '@mui/icons-material/MailRounded'
import DescriptionRounded from '@mui/icons-material/DescriptionRounded'
import ChatRounded from '@mui/icons-material/ChatRounded'
import VerifiedUserRounded from '@mui/icons-material/VerifiedUserRounded'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import ErrorOutlineRounded from '@mui/icons-material/ErrorOutlineRounded'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import LockRounded from '@mui/icons-material/LockRounded'
import { MovingBorder, NumberTicker } from '../components/aceternity/Effects'
import { PageHeader, Pill, StatusDot } from '../components/ui'
import { invalidate, post } from '../lib/api'
import { useApp } from '../lib/app-context'
import { C } from '../theme'

type Busy = null | 'gmail' | 'drive' | 'analyse'

function SourceCard({ icon, title, text, count, unit, on, status, children, delay }: {
  icon: ReactNode; title: string; text: string; count: number; unit: string; on: boolean; status: string; children: ReactNode; delay: number
}) {
  return (
    <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }}>
      <MovingBorder active={on} radius={22} sx={{ height: '100%' }}>
        <Stack sx={{ p: 3, height: '100%' }} spacing={2}>
          <Stack direction="row" justifyContent="space-between" alignItems="center">
            <Box sx={{ width: 50, height: 50, borderRadius: 3, display: 'grid', placeItems: 'center', color: C.amber, background: `${C.amber}1a`, border: `1px solid ${C.amber}33` }}>{icon}</Box>
            <Pill color={on ? C.lime : C.amber}><StatusDot on={on} />{status}</Pill>
          </Stack>
          <Box>
            <Typography variant="h5">{title}</Typography>
            <Typography sx={{ color: C.muted, fontSize: 14, mt: 0.6, minHeight: 42 }}>{text}</Typography>
          </Box>
          <Stack direction="row" alignItems="baseline" spacing={1}>
            <Typography sx={{ fontFamily: '"Bricolage Grotesque"', fontWeight: 800, fontSize: 44, lineHeight: 1 }}><NumberTicker value={count} /></Typography>
            <Typography sx={{ color: C.dim, fontSize: 13 }}>{unit}</Typography>
          </Stack>
          <Box sx={{ flex: 1 }} />
          <Stack direction="row" spacing={1}>{children}</Stack>
        </Stack>
      </MovingBorder>
    </motion.div>
  )
}

export default function Connections() {
  const { health, toast, refreshHealth } = useApp()
  const [busy, setBusy] = useState<Busy>(null)
  const hook = `${window.location.origin}/api/webhooks/whatsapp`

  const run = async (what: Exclude<Busy, null>) => {
    setBusy(what)
    try {
      if (what === 'analyse') {
        const r = await post<{ emails: number; documents: number; groups: number }>('/api/analyse')
        toast(`Re-analysed ${r.emails} emails, ${r.documents} files and ${r.groups} groups`)
      } else {
        const r = await post<{ imported: number }>(`/api/sync/${what}`)
        toast(`Synced ${r.imported} ${what === 'gmail' ? 'emails' : 'files'}`)
      }
      invalidate('/api/')
      refreshHealth()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(null)
    }
  }

  const setup = health?.setup ?? []
  return (
    <Box>
      <PageHeader kicker="Your data, your rules" title="Bring the whole operation in."
        subtitle="Connect your existing business sources. Unsilo reads them through official, read-only APIs and indexes everything for search." />

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' } }}>
        <SourceCard delay={0.05} icon={<MailRounded />} title="Gmail" text="Rental enquiries, customer quotes, invoices and supplier conversations."
          count={health?.counts.emails ?? 0} unit="emails indexed" on={!!health?.google_connected} status={health?.google_connected ? 'Connected' : 'Not connected'}>
          <Button variant="contained" fullWidth disabled={!!busy || !health?.google_connected} onClick={() => run('gmail')}>{busy === 'gmail' ? 'Syncing…' : 'Sync now'}</Button>
          <Button variant="outlined" href="/api/oauth/google/start">{health?.google_connected ? 'Reconnect' : 'Connect'}</Button>
        </SourceCard>
        <SourceCard delay={0.12} icon={<DescriptionRounded />} title="Google Drive" text="Equipment specs, hire agreements, purchase orders, site photos and videos."
          count={health?.counts.documents ?? 0} unit="files indexed" on={health?.drive_mode !== 'none' && !!health} status={health ? ({ oauth: 'Connected', api_key: 'API key', none: 'Not connected' } as const)[health.drive_mode] : '…'}>
          <Button variant="contained" fullWidth disabled={!!busy || health?.drive_mode === 'none'} onClick={() => run('drive')}>{busy === 'drive' ? 'Syncing…' : 'Sync now'}</Button>
        </SourceCard>
        <SourceCard delay={0.19} icon={<ChatRounded />} title="WhatsApp / Site updates" text="Delivery confirmations, breakdown alerts, approvals and site decisions."
          count={health?.counts.whatsapp_messages ?? 0} unit="messages received" on={(health?.counts.whatsapp_messages ?? 0) > 0} status={`${health?.selected_groups ?? 0} groups selected`}>
          <Button variant="outlined" fullWidth disabled={!!busy} onClick={() => run('analyse')}>{busy === 'analyse' ? 'Analysing…' : 'Refresh analysis'}</Button>
        </SourceCard>
      </Box>

      <Box sx={{ display: 'grid', gap: 2.5, gridTemplateColumns: { xs: '1fr', lg: '1.4fr 1fr' }, mt: 2.5 }}>
        <Box sx={{ p: 3, borderRadius: 5, border: `1px solid ${C.line}`, background: C.panel }}>
          <Stack direction="row" spacing={1.2} alignItems="center" sx={{ mb: 2 }}>
            <VerifiedUserRounded sx={{ color: C.amber }} />
            <Typography variant="h6">Integration health & setup</Typography>
          </Stack>
          {setup.length === 0 ? (
            <Stack direction="row" spacing={1.5} alignItems="center" sx={{ p: 2, borderRadius: 3, background: `${C.lime}10`, border: `1px solid ${C.lime}40` }}>
              <CheckCircleRounded sx={{ color: C.lime }} />
              <Typography>Everything is configured. You're good to go. 🚀</Typography>
            </Stack>
          ) : (
            <Stack spacing={1.2}>
              {setup.map((s, i) => (
                <Stack key={i} direction="row" spacing={1.5} alignItems="flex-start" sx={{ p: 1.8, borderRadius: 3, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.02)' }}>
                  <ErrorOutlineRounded sx={{ color: C.hazard, mt: 0.2 }} />
                  <Box>
                    <Typography sx={{ fontWeight: 700, fontSize: 13, color: C.hazard, textTransform: 'capitalize' }}>{s.source}</Typography>
                    <Typography sx={{ fontSize: 14, color: C.muted }}>{s.text}</Typography>
                  </Box>
                </Stack>
              ))}
              <Typography sx={{ fontSize: 12.5, color: C.dim }}>Edit <code>.env</code> or <code>config/selected_groups.json</code>, then restart uvicorn.</Typography>
            </Stack>
          )}
        </Box>

        <Box sx={{ p: 3, borderRadius: 5, border: `1px solid ${C.line}`, background: C.panel }}>
          <Typography variant="h6" sx={{ mb: 1 }}>WhatsApp webhook</Typography>
          <Typography sx={{ fontSize: 13.5, color: C.muted, mb: 1.5 }}>Paste your tunnel URL + this path into Meta → WhatsApp → Configuration, with the verify token from <code>.env</code>.</Typography>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1.2, pl: 1.8, borderRadius: 2.5, background: '#0b0b0e', border: `1px solid ${C.line}` }}>
            <Typography className="mono" noWrap sx={{ flex: 1, fontSize: 13, color: C.amber }}>{hook}</Typography>
            <Tooltip title="Copy">
              <IconButton size="small" onClick={() => { navigator.clipboard?.writeText(hook); toast('Webhook URL copied') }}><ContentCopyRounded fontSize="small" /></IconButton>
            </Tooltip>
          </Stack>
          <Typography variant="overline" sx={{ display: 'block', color: C.dim, mt: 2.5, mb: 1 }}>Guard rails</Typography>
          <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
            {['gmail.readonly', 'drive.readonly', 'HMAC-signed webhooks', 'Selected groups only', 'No send / delete'].map((t) => (
              <Pill key={t} color={C.lime}><LockRounded sx={{ fontSize: 13 }} />{t}</Pill>
            ))}
          </Stack>
        </Box>
      </Box>
    </Box>
  )
}
