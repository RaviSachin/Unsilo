import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import ArrowForwardRounded from '@mui/icons-material/ArrowForwardRounded'
import HubRounded from '@mui/icons-material/HubRounded'
import MailRounded from '@mui/icons-material/MailRounded'
import DescriptionRounded from '@mui/icons-material/DescriptionRounded'
import ChatRounded from '@mui/icons-material/ChatRounded'
import GroupsRounded from '@mui/icons-material/GroupsRounded'
import ScheduleRounded from '@mui/icons-material/ScheduleRounded'
import WarningAmberRounded from '@mui/icons-material/WarningAmberRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import SouthEastRounded from '@mui/icons-material/SouthEastRounded'
import StarField from '../components/aceternity/StarField'
import { BackgroundBeams, FlipWords, GlowCard, HoverGrid, Marquee, Meteors, NumberTicker, Spotlight } from '../components/aceternity/Effects'
import Excavator from '../components/Excavator'
import { Pill, StatusDot } from '../components/ui'
import { useApp } from '../lib/app-context'
import { useApi } from '../lib/api'
import type { EmailList, WaGroup } from '../lib/types'
import { mailDate } from '../lib/format'
import { C } from '../theme'

const PROMPTS = [
  'Which equipment needs maintenance this month?',
  'Find the latest rental quotation for an excavator',
  'Show pending customer follow-ups',
  'What did the site team decide about delivery?',
]

const TICKER = ['Excavators', 'Dumpers', 'Cranes', 'Loaders', 'Site permits', 'Rental quotes', 'KYC', 'Purchase orders', 'Dispatch', 'Fleet health']

function greeting() {
  const h = new Date().getHours()
  return h < 12 ? 'Morning, team.' : h < 17 ? 'Afternoon, team.' : 'Evening, team.'
}

export default function Overview() {
  const navigate = useNavigate()
  const { health } = useApp()
  const { data: mail } = useApi<EmailList>('/api/emails')
  const { data: groups } = useApi<WaGroup[]>('/api/whatsapp/groups')

  const unanswered = useMemo(() => (mail?.emails ?? []).filter((e) => e.unanswered_days != null), [mail])
  const critical = useMemo(() => (mail?.emails ?? []).filter((e) => e.critical.length), [mail])
  const decisions = useMemo(
    () => (groups ?? []).flatMap((g) => (g.interpretation.decisions ?? []).map((d) => ({ group: g.name, text: d.decision }))).slice(0, 4),
    [groups],
  )

  const stats = [
    { label: 'Emails indexed', value: health?.counts.emails ?? 0, hint: 'Customer + supplier communication', icon: <MailRounded />, to: '/gmail' },
    { label: 'Documents indexed', value: health?.counts.documents ?? 0, hint: 'Contracts, specs & reports', icon: <DescriptionRounded />, to: '/drive' },
    { label: 'Site messages', value: health?.counts.whatsapp_messages ?? 0, hint: 'WhatsApp webhook records', icon: <ChatRounded />, to: '/site-updates' },
    { label: 'Selected groups', value: health?.selected_groups ?? 0, hint: 'Configured site conversations', icon: <GroupsRounded />, to: '/connections' },
  ]

  const conns = [
    { name: 'Google / Gmail', note: health?.google_connected ? 'Account linked' : 'Not connected', on: !!health?.google_connected, icon: <MailRounded fontSize="small" /> },
    { name: 'Google Drive', note: health?.drive_mode ?? '…', on: health?.drive_mode !== 'none', icon: <DescriptionRounded fontSize="small" /> },
    { name: 'WhatsApp groups', note: `${health?.selected_groups ?? 0} selected`, on: (health?.counts.whatsapp_messages ?? 0) > 0, icon: <ChatRounded fontSize="small" /> },
  ]

  return (
    <Stack spacing={3}>
      {/* HERO */}
      <Box component={motion.section} initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.6 }}
        sx={{ position: 'relative', overflow: 'hidden', borderRadius: 6, border: `1px solid ${C.amber}30`, minHeight: { md: 420 },
          background: `radial-gradient(800px 380px at 85% 40%, #1d3b1f55, transparent 60%), linear-gradient(120deg, #1a130a 0%, #111114 55%, #0e1a10 100%)` }}>
        <Spotlight />
        <BackgroundBeams />
        <StarField density={1.4} />
        <Box sx={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 6, opacity: 0.85 }} className="hazard-stripes" />
        <Stack direction={{ xs: 'column', md: 'row' }} alignItems="center" sx={{ position: 'relative', p: { xs: 2.5, sm: 4, md: 6 }, pb: { xs: 4, md: 6 }, gap: 2 }}>
          <Box sx={{ flex: 1.2, minWidth: 0 }}>
            <Pill sx={{ mb: 2.5 }}><AutoAwesomeRounded sx={{ fontSize: 14 }} />YOUR OPS COPILOT</Pill>
            <Typography sx={{ color: C.muted, mb: 1 }}>{greeting()}</Typography>
            <Typography variant="h1" sx={{ fontSize: { xs: 34, sm: 50, md: 60, lg: 68 }, lineHeight: 0.98 }}>
              Less chasing.
              <br />
              <Box component="span" className="gradient-text">More getting it done.</Box>
            </Typography>
            <Typography sx={{ color: C.muted, mt: 2.5, maxWidth: 520, fontSize: 16.5, lineHeight: 1.7 }}>
              One brain for your{' '}
              <FlipWords words={['rentals', 'sites', 'fleet', 'quotes', 'crews']} sx={{ fontWeight: 800, minWidth: 74 }} />
              {' '}— across emails, Drive docs and site WhatsApp groups. Every answer comes with receipts.
            </Typography>
            <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} sx={{ mt: 4 }} useFlexGap>
              <Button variant="contained" size="large" endIcon={<ArrowForwardRounded />} onClick={() => navigate('/ask')}>Ask Unsilo</Button>
              <Button variant="outlined" size="large" startIcon={<HubRounded />} onClick={() => navigate('/connections')}>Connect sources</Button>
            </Stack>
          </Box>
          <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center', position: 'relative', width: '100%' }}>
            <Excavator size={460} />
            <Box sx={{ display: { xs: 'none', sm: 'block' }, position: 'absolute', right: { xs: 8, md: 0 }, bottom: { xs: 0, md: -10 }, px: 1.6, py: 0.8, borderRadius: 2, border: `1px solid ${C.line}`, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(6px)', fontSize: 11, fontWeight: 800, letterSpacing: '0.2em', color: C.muted }}>
              FLEET INTELLIGENCE · LIVE
            </Box>
          </Box>
        </Stack>
      </Box>

      {/* TICKER */}
      <Marquee speed={45}>
        {TICKER.map((t) => (
          <Stack key={t} direction="row" alignItems="center" spacing={2} sx={{ px: 2.5, color: C.dim, fontWeight: 800, letterSpacing: '0.18em', fontSize: 12, whiteSpace: 'nowrap' }}>
            <span>{t.toUpperCase()}</span><Box component="span" sx={{ color: C.amber }}>✦</Box>
          </Stack>
        ))}
      </Marquee>

      {/* STATS */}
      <Box sx={{ display: 'grid', gap: { xs: 1.5, md: 2 }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', lg: 'repeat(4, 1fr)' } }}>
        {stats.map((s, i) => (
          <motion.div key={s.label} initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 + i * 0.07 }}>
          <GlowCard onClick={() => navigate(s.to)} sx={{ p: { xs: 2.2, md: 3 }, cursor: 'pointer', height: '100%' }}>
            <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
              <Typography sx={{ color: C.muted, fontWeight: 600 }}>{s.label}</Typography>
              <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: C.amber, background: `${C.amber}1a`, border: `1px solid ${C.amber}30` }}>{s.icon}</Box>
            </Stack>
            <Typography sx={{ fontFamily: '"Bricolage Grotesque"', fontWeight: 800, fontSize: { xs: 36, md: 46 }, lineHeight: 1.1, mt: 1.5 }}><NumberTicker value={s.value} /></Typography>
            <Typography sx={{ color: C.dim, fontSize: 13.5 }}>{s.hint}</Typography>
          </GlowCard>
          </motion.div>
        ))}
      </Box>

      {/* ASK + PULSE */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1.6fr 1fr' } }}>
        <GlowCard sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Stack direction="row" justifyContent="space-between" alignItems="flex-start">
            <Box>
              <Typography variant="overline" sx={{ color: C.amber }}>Ask the business</Typography>
              <Typography variant="h5" sx={{ mt: 0.5 }}>What’s the move today?</Typography>
            </Box>
            <AutoAwesomeRounded sx={{ color: C.amber, animation: 'float-y 3s ease-in-out infinite' }} />
          </Stack>
          <Box sx={{ mt: 2 }}>
            <HoverGrid items={PROMPTS} onPick={(q) => navigate('/ask', { state: { q } })} render={(q) => (
              <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={2}
                sx={{ p: 2.2, height: '100%', borderRadius: 3.5, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.02)' }}>
                <Typography sx={{ fontSize: 14.5, fontWeight: 500 }}>{q}</Typography>
                <SouthEastRounded sx={{ fontSize: 16, color: C.dim }} />
              </Stack>
            )} />
          </Box>
        </GlowCard>

        <GlowCard sx={{ p: { xs: 2.5, md: 3.5 } }}>
          <Meteors count={10} />
          <Typography variant="overline" sx={{ color: C.amber }}>System pulse</Typography>
          <Typography variant="h5" sx={{ mt: 0.5, mb: 2 }}>Your connections</Typography>
          <Stack spacing={1.6}>
            {conns.map((c) => (
              <Stack key={c.name} direction="row" alignItems="center" spacing={1.6}>
                <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: 'grid', placeItems: 'center', border: `1px solid ${C.line}`, color: C.muted }}>{c.icon}</Box>
                <Box sx={{ flex: 1 }}>
                  <Typography sx={{ fontWeight: 700, fontSize: 14.5 }}>{c.name}</Typography>
                  <Typography sx={{ fontSize: 12.5, color: C.dim }}>{c.note}</Typography>
                </Box>
                <StatusDot on={c.on} />
              </Stack>
            ))}
          </Stack>
          <Button onClick={() => navigate('/connections')} sx={{ mt: 2.5, px: 0, color: C.amber }} endIcon={<ArrowForwardRounded />}>Manage connections</Button>
        </GlowCard>
      </Box>

      {/* ATTENTION */}
      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', lg: '1fr 1fr' } }}>
        <GlowCard sx={{ p: { xs: 2.5, md: 3.5 } }} glow={C.red}>
          <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 2 }}>
            <ScheduleRounded sx={{ color: C.red }} />
            <Typography variant="h6">Needs a reply</Typography>
            <Pill color={C.red}>{unanswered.length}</Pill>
          </Stack>
          {unanswered.length === 0 ? (
            <Typography sx={{ color: C.muted, fontSize: 14 }}>Inbox zero energy. Nothing has waited {mail?.unanswered_days ?? 5}+ days. 🎉</Typography>
          ) : (
            <Stack spacing={1}>
              {unanswered.slice(0, 5).map((e) => (
                <Stack key={e.id} direction="row" spacing={1.5} alignItems="center" onClick={() => navigate(`/gmail?open=${e.id}`)}
                  sx={{ p: 1.4, borderRadius: 3, cursor: 'pointer', border: `1px solid ${C.line}`, '&:hover': { borderColor: `${C.red}55`, background: `${C.red}0a` } }}>
                  <Pill color={C.red}>{e.unanswered_days}d</Pill>
                  <Box sx={{ minWidth: 0, flex: 1 }}>
                    <Typography noWrap sx={{ fontWeight: 600, fontSize: 14 }}>{e.subject}</Typography>
                    <Typography noWrap sx={{ fontSize: 12.5, color: C.dim }}>{e.from_name || e.from_addr} · {mailDate(e.sent_at)}</Typography>
                  </Box>
                </Stack>
              ))}
            </Stack>
          )}
        </GlowCard>
        <GlowCard sx={{ p: { xs: 2.5, md: 3.5 } }} glow={C.lime}>
          <Stack direction="row" alignItems="center" spacing={1.2} sx={{ mb: 2 }}>
            <WarningAmberRounded sx={{ color: C.hazard }} />
            <Typography variant="h6">From the field</Typography>
            <Pill color={C.hazard}>{critical.length} critical files</Pill>
          </Stack>
          {decisions.length === 0 ? (
            <Typography sx={{ color: C.muted, fontSize: 14 }}>No site decisions yet. They show up here as soon as the WhatsApp group talks.</Typography>
          ) : (
            <Stack spacing={1}>
              {decisions.map((d, i) => (
                <Box key={i} onClick={() => navigate('/site-updates')} sx={{ p: 1.4, borderRadius: 3, cursor: 'pointer', border: `1px solid ${C.line}`, '&:hover': { borderColor: `${C.lime}55` } }}>
                  <Typography sx={{ fontSize: 14 }}>✅ {d.text}</Typography>
                  <Typography sx={{ fontSize: 12, color: C.dim, mt: 0.3 }}>{d.group}</Typography>
                </Box>
              ))}
            </Stack>
          )}
        </GlowCard>
      </Box>
    </Stack>
  )
}
