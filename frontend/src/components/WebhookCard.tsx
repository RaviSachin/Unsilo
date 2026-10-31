import { useEffect, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import InputBase from '@mui/material/InputBase'
import Tooltip from '@mui/material/Tooltip'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import BoltRounded from '@mui/icons-material/BoltRounded'
import CheckCircleRounded from '@mui/icons-material/CheckCircleRounded'
import CancelRounded from '@mui/icons-material/CancelRounded'
import LockRounded from '@mui/icons-material/LockRounded'
import { Pill, StatusDot } from './ui'
import { invalidate, post } from '../lib/api'
import { useApp } from '../lib/app-context'
import type { SelfTest } from '../lib/types'
import { C } from '../theme'

const KEY = 'unsilo.tunnel'

/** Meta needs the public tunnel URL (never localhost). Paste it once, copy the exact callback, and test it end to end. */
export default function WebhookCard() {
  const { health, toast, refreshHealth } = useApp()
  const [base, setBase] = useState(() => { try { return localStorage.getItem(KEY) ?? '' } catch { return '' } })
  const [busy, setBusy] = useState(false)
  const [result, setResult] = useState<SelfTest | null>(null)

  useEffect(() => { if (!base && health?.webhook?.tunnel) setBase(health.webhook.tunnel) }, [base, health?.webhook?.tunnel])
  useEffect(() => { try { localStorage.setItem(KEY, base) } catch { /* storage blocked */ } }, [base])

  const clean = base.trim().replace(/\/+$/, '').replace(/\/api(\/webhooks(\/whatsapp)?)?$/, '')
  const valid = /^https:\/\/[^\s/]+\.[^\s/]+/.test(clean) && !/localhost|127\.0\.0\.1/.test(clean)
  const callback = valid ? `${clean}/api/webhooks/whatsapp` : '<your https tunnel URL>/api/webhooks/whatsapp'
  const wh = health?.webhook

  const copy = (text: string, what: string) => { navigator.clipboard?.writeText(text); toast(`${what} copied`) }
  const test = async () => {
    setBusy(true)
    setResult(null)
    try {
      const r = await post<SelfTest>('/api/webhooks/self-test', { base: clean })
      setResult(r)
      toast(r.ok ? 'Webhook works end to end 🎉' : 'Webhook test found a problem', r.ok ? 'success' : 'error')
      invalidate('/api/whatsapp/groups')
      refreshHealth()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box sx={{ p: { xs: 2.2, md: 3 }, borderRadius: 5, border: `1px solid ${C.line}`, background: C.panel, minWidth: 0 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1} sx={{ mb: 1 }}>
        <Typography variant="h6">WhatsApp webhook</Typography>
        <Pill color={wh?.calls ? C.lime : C.amber}><StatusDot on={!!wh?.calls} />{wh?.calls ? `${wh.calls} calls` : 'no calls yet'}</Pill>
      </Stack>
      <Typography sx={{ fontSize: 13.5, color: C.muted, mb: 1.5 }}>
        1) Paste the <b>https://…trycloudflare.com</b> URL that cloudflared printed. 2) Test it. 3) Copy the callback URL into Meta → WhatsApp → Configuration with the verify token from <code>.env</code>.
      </Typography>

      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.6, height: 46, borderRadius: 2.5, background: '#0b0b0e', border: `1px solid ${base && !valid ? C.red : C.line}`, '&:focus-within': { borderColor: C.amber } }}>
        <InputBase value={base} onChange={(e) => setBase(e.target.value)} placeholder="https://something.trycloudflare.com" fullWidth sx={{ fontSize: 14, fontFamily: 'JetBrains Mono, monospace' }} inputProps={{ 'aria-label': 'Tunnel URL' }} />
      </Box>
      {base && !valid && <Typography sx={{ fontSize: 12, color: C.red, mt: 0.6 }}>Use the public https tunnel URL, not localhost.</Typography>}

      <Typography sx={{ fontSize: 12, color: C.dim, mt: 1.6, mb: 0.6 }}>Callback URL for Meta</Typography>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ p: 1, pl: 1.6, borderRadius: 2.5, background: '#0b0b0e', border: `1px solid ${C.line}` }}>
        <Typography className="mono" sx={{ flex: 1, minWidth: 0, fontSize: 12.5, color: valid ? C.amber : C.dim, wordBreak: 'break-all' }}>{callback}</Typography>
        <Tooltip title="Copy callback URL"><span><IconButton size="small" disabled={!valid} onClick={() => copy(callback, 'Callback URL')}><ContentCopyRounded fontSize="small" /></IconButton></span></Tooltip>
      </Stack>

      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ mt: 1.6 }}>
        <Button variant="contained" startIcon={<BoltRounded />} disabled={!valid || busy} onClick={test}>{busy ? 'Testing…' : 'Test webhook'}</Button>
        <Button variant="outlined" href="https://developers.facebook.com/apps/" target="_blank" rel="noreferrer">Open Meta apps</Button>
      </Stack>

      <AnimatePresence>
        {result && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
            <Stack spacing={0.8} sx={{ mt: 2, p: 1.6, borderRadius: 3, border: `1px solid ${result.ok ? `${C.lime}55` : `${C.red}55`}`, background: result.ok ? `${C.lime}0c` : `${C.red}0c` }}>
              {result.steps.map((s) => (
                <Stack key={s.name} direction="row" spacing={1} alignItems="flex-start">
                  {s.ok ? <CheckCircleRounded sx={{ fontSize: 18, color: C.lime, mt: 0.2 }} /> : <CancelRounded sx={{ fontSize: 18, color: C.red, mt: 0.2 }} />}
                  <Box sx={{ minWidth: 0 }}>
                    <Typography sx={{ fontSize: 13.5, fontWeight: 700 }}>{s.name}</Typography>
                    {s.detail && <Typography sx={{ fontSize: 12.5, color: C.muted, wordBreak: 'break-word' }}>{s.detail}</Typography>}
                  </Box>
                </Stack>
              ))}
            </Stack>
          </motion.div>
        )}
      </AnimatePresence>

      {wh?.last && (
        <Typography sx={{ fontSize: 12, color: C.dim, mt: 1.6 }}>Last call {wh.last} UTC: {wh.result}</Typography>
      )}
      <Typography sx={{ fontSize: 12, color: C.dim, mt: 1 }}>
        Mode: {health?.whatsapp_direct ? '1:1 test chats are kept (WHATSAPP_ALLOW_DIRECT=true)' : 'selected groups only'} · {health?.selected_groups ?? 0} group(s) configured
      </Typography>

      <Typography variant="overline" sx={{ display: 'block', color: C.dim, mt: 2.5, mb: 1 }}>Guard rails</Typography>
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {['gmail.readonly', 'drive.readonly', 'HMAC-signed webhooks', 'Selected groups only', 'No send / delete'].map((t) => (
          <Pill key={t} color={C.lime}><LockRounded sx={{ fontSize: 13 }} />{t}</Pill>
        ))}
      </Stack>
    </Box>
  )
}
