import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import InputBase from '@mui/material/InputBase'
import useMediaQuery from '@mui/material/useMediaQuery'
import GroupsRounded from '@mui/icons-material/GroupsRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import GavelRounded from '@mui/icons-material/GavelRounded'
import TaskAltRounded from '@mui/icons-material/TaskAltRounded'
import PeopleRounded from '@mui/icons-material/PeopleRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import DoneAllRounded from '@mui/icons-material/DoneAllRounded'
import { MovingBorder } from '../components/aceternity/Effects'
import { Avatar, EmptyState, ErrorBox, LoadingRows, PageHeader, Pill } from '../components/ui'
import { invalidate, post, useApi } from '../lib/api'
import { useApp } from '../lib/app-context'
import type { WaGroup } from '../lib/types'
import { colorFor, dayLabel, timeOnly } from '../lib/format'
import { C } from '../theme'

type Panel = 'summary' | 'decisions' | 'actions' | 'people'

export default function SiteUpdates() {
  const { data, error } = useApi<WaGroup[]>('/api/whatsapp/groups', 15000)
  const { toast } = useApp()
  const navigate = useNavigate()
  const wide = useMediaQuery('(min-width:1200px)')
  const [active, setActive] = useState<string | null>(null)
  const [panel, setPanel] = useState<Panel>('summary')
  const [q, setQ] = useState('')
  const [busy, setBusy] = useState(false)
  const [hot, setHot] = useState<Set<string>>(new Set())
  const chatRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => data ?? [], [data])
  const group = groups.find((g) => g.group_id === active) ?? groups[0]
  useEffect(() => { chatRef.current?.scrollTo({ top: chatRef.current.scrollHeight }) }, [group?.group_id, group?.messages.length])

  const messages = useMemo(() => {
    const list = group?.messages ?? []
    return q ? list.filter((m) => `${m.text} ${m.sender_name}`.toLowerCase().includes(q.toLowerCase())) : list
  }, [group, q])

  const analyse = async () => {
    setBusy(true)
    try {
      await post('/api/analyse')
      toast('Site updates re-analysed')
      invalidate('/api/whatsapp/groups')
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }

  const it = group?.interpretation ?? {}
  const PANELS: { key: Panel; label: string; icon: ReactNode; n?: number }[] = [
    { key: 'summary', label: 'Summary', icon: <AutoAwesomeRounded sx={{ fontSize: 17 }} /> },
    { key: 'decisions', label: 'Decisions', icon: <GavelRounded sx={{ fontSize: 17 }} />, n: it.decisions?.length },
    { key: 'actions', label: 'Actions', icon: <TaskAltRounded sx={{ fontSize: 17 }} />, n: it.action_items?.length },
    { key: 'people', label: 'People', icon: <PeopleRounded sx={{ fontSize: 17 }} />, n: it.participants?.length },
  ]
  const focus = (ids: string[]) => { setHot(new Set(ids)); window.setTimeout(() => document.getElementById(`m-${ids[0]}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50) }

  return (
    <Box>
      <PageHeader kicker="Field comms" title="Hear it from the site."
        subtitle="Decisions, action items and asks from your selected WhatsApp groups, pulled out automatically."
        right={<Button variant="outlined" startIcon={<RefreshRounded sx={{ animation: busy ? 'spin 1s linear infinite' : 'none' }} />} disabled={busy} onClick={analyse}>Re-analyse</Button>} />
      {error && <ErrorBox message={error} />}
      {!data && !error ? <LoadingRows rows={5} height={70} /> : groups.length === 0 || groups.every((g) => g.messages.length === 0) ? (
        <Box sx={{ borderRadius: 5, border: `1px solid ${C.line}`, background: C.panel }}>
          <EmptyState icon={<GroupsRounded />} title="No site messages yet"
            text="Once a selected WhatsApp group talks, messages land here through the webhook. Check config/selected_groups.json and the webhook on the Connections page."
            action={<Button variant="contained" onClick={() => navigate('/connections')}>Open connections</Button>} />
        </Box>
      ) : (
        <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: wide ? '280px 1fr 380px' : { xs: '1fr', md: '260px 1fr' } }}>
          {/* groups: a swipeable row on phones, a list on bigger screens */}
          <Stack direction={{ xs: 'row', md: 'column' }} spacing={1} sx={{ overflowX: { xs: 'auto', md: 'visible' }, pb: { xs: 0.5, md: 0 }, '&::-webkit-scrollbar': { height: 0 } }}>
            {groups.map((g) => {
              const on = g.group_id === group?.group_id
              const last = g.messages[g.messages.length - 1]
              return (
                <Box key={g.group_id} onClick={() => { setActive(g.group_id); setHot(new Set()) }} sx={{ cursor: 'pointer', flexShrink: 0, width: { xs: 250, md: 'auto' } }}>
                  <MovingBorder active={on} radius={16}>
                    <Stack direction="row" spacing={1.4} alignItems="center" sx={{ p: 1.6 }}>
                      <Avatar name={g.name} color={colorFor(g.name)} size={42} />
                      <Box sx={{ minWidth: 0, flex: 1 }}>
                        <Typography noWrap sx={{ fontWeight: 800, fontSize: 14.5 }}>{g.name}</Typography>
                        <Typography noWrap sx={{ fontSize: 12.5, color: C.dim }}>{last ? `${last.sender_name ?? last.sender_id}: ${last.text}` : 'No messages yet'}</Typography>
                      </Box>
                      <Pill color={C.lime} sx={{ fontSize: 11, py: 0 }}>{g.messages.length}</Pill>
                    </Stack>
                  </MovingBorder>
                </Box>
              )
            })}
          </Stack>

          {/* chat */}
          {group && (
            <Box sx={{ borderRadius: 5, border: `1px solid ${C.line}`, overflow: 'hidden', display: 'flex', flexDirection: 'column', height: { xs: '70vh', md: 680 }, minWidth: 0,
              background: `radial-gradient(circle at 20% 0%, #25d36610, transparent 40%), #0d0f0e` }}>
              <Stack direction="row" spacing={1.4} alignItems="center" sx={{ px: 2, py: 1.4, borderBottom: `1px solid ${C.line}`, background: 'rgba(0,0,0,0.3)' }}>
                <Avatar name={group.name} color={colorFor(group.name)} size={38} />
                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Typography noWrap sx={{ fontWeight: 800 }}>{group.name}</Typography>
                  <Typography noWrap sx={{ fontSize: 12, color: C.dim }}>{group.participants.map((p) => p.name ?? p.wa_id).join(', ') || 'participants unknown'}</Typography>
                </Box>
                <Box sx={{ display: { xs: 'none', sm: 'flex' }, alignItems: 'center', gap: 0.8, px: 1.4, height: 36, borderRadius: 99, background: 'rgba(255,255,255,0.05)', width: { sm: 180, lg: 200 } }}>
                  <SearchRounded sx={{ fontSize: 18, color: C.dim }} />
                  <InputBase value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chat" sx={{ fontSize: 13.5, flex: 1 }} />
                </Box>
              </Stack>
              <Box ref={chatRef} sx={{ flex: 1, overflowY: 'auto', p: 2, minHeight: 300 }}>
                {messages.map((m, i) => {
                  const day = dayLabel(m.sent_at)
                  const showDay = i === 0 || dayLabel(messages[i - 1].sent_at) !== day
                  const name = m.sender_name ?? m.sender_id
                  const lit = hot.has(m.message_id)
                  return (
                    <Box key={m.message_id} id={`m-${m.message_id}`}>
                      {showDay && <Box sx={{ textAlign: 'center', my: 1.5 }}><Pill color={C.muted} sx={{ background: '#1a1d1c' }}>{day}</Pill></Box>}
                      <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(i * 0.02, 0.4) }}>
                        <Box sx={{ maxWidth: { xs: '90%', sm: '78%' }, mb: 1, px: 1.6, py: 1, borderRadius: '4px 16px 16px 16px', background: lit ? `${C.amber}26` : '#1d2421',
                          border: `1px solid ${lit ? C.amber : 'transparent'}`, boxShadow: '0 1px 1px rgba(0,0,0,0.3)', transition: 'all .3s' }}>
                          <Typography sx={{ fontSize: 12.5, fontWeight: 800, color: colorFor(name) }}>{name}</Typography>
                          <Typography sx={{ fontSize: 14.5, whiteSpace: 'pre-wrap', wordBreak: 'break-word' }}>{m.text}</Typography>
                          <Stack direction="row" spacing={0.5} alignItems="center" justifyContent="flex-end" sx={{ color: C.dim, fontSize: 11 }}>
                            <span>{timeOnly(m.sent_at)}</span><DoneAllRounded sx={{ fontSize: 14, color: C.sky }} />
                          </Stack>
                        </Box>
                      </motion.div>
                    </Box>
                  )
                })}
                {messages.length === 0 && <Typography sx={{ color: C.dim, textAlign: 'center', mt: 6 }}>No messages match.</Typography>}
              </Box>
            </Box>
          )}

          {/* insights */}
          {group && (
            <Box sx={{ gridColumn: wide ? 'auto' : { md: '1 / -1' }, borderRadius: 5, border: `1px solid ${C.line}`, background: C.panel, p: 2.5, height: { lg: 680 }, overflowY: 'auto' }}>
              <Stack direction="row" spacing={0.8} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
                {PANELS.map((p) => (
                  <Box key={p.key} component="button" type="button" onClick={() => setPanel(p.key)} sx={{
                    position: 'relative', display: 'flex', alignItems: 'center', gap: 0.7, px: 1.4, py: 0.8, borderRadius: 99, border: 0, cursor: 'pointer',
                    fontFamily: 'inherit', fontSize: 13, fontWeight: 700, color: panel === p.key ? '#140b00' : C.muted, background: 'transparent',
                  }}>
                    {panel === p.key && <motion.span layoutId="site-panel" style={{ position: 'absolute', inset: 0, borderRadius: 99, background: C.amber }} />}
                    <Box component="span" sx={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 0.7 }}>{p.icon}{p.label}{p.n ? ` · ${p.n}` : ''}</Box>
                  </Box>
                ))}
              </Stack>
              <AnimatePresence mode="wait">
                <motion.div key={`${group.group_id}-${panel}`} initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }} transition={{ duration: 0.2 }}>
                  {panel === 'summary' && (
                    <Box>
                      <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 1 }}>
                        <Typography sx={{ fontWeight: 800 }}>What's going on</Typography>
                        {it.method && <Pill color={C.dim} sx={{ fontSize: 10 }}>{it.method === 'ai' ? 'AI' : it.method}</Pill>}
                      </Stack>
                      <Typography sx={{ color: C.muted, lineHeight: 1.7 }}>{it.summary || 'No summary yet. Hit Re-analyse.'}</Typography>
                      <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
                        <Pill color={C.lime}>{it.decisions?.length ?? 0} decisions</Pill>
                        <Pill color={C.amber}>{it.action_items?.length ?? 0} actions</Pill>
                      </Stack>
                      <Button sx={{ mt: 2, px: 0, color: C.amber }} startIcon={<AutoAwesomeRounded />}
                        onClick={() => navigate('/ask', { state: { q: `What did the ${group.name} group decide and who owns what?` } })}>Ask Unsilo about this group</Button>
                    </Box>
                  )}
                  {panel === 'decisions' && (
                    <Stack spacing={1}>
                      {(it.decisions ?? []).length === 0 && <Typography sx={{ color: C.dim }}>No decisions found yet.</Typography>}
                      {(it.decisions ?? []).map((d, i) => (
                        <Box key={i} onClick={() => focus(d.message_ids)} sx={{ p: 1.6, borderRadius: 3, cursor: 'pointer', border: `1px solid ${C.line}`, '&:hover': { borderColor: `${C.lime}66` } }}>
                          <Typography sx={{ fontSize: 14 }}>✅ {d.decision}</Typography>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  {panel === 'actions' && (
                    <Stack spacing={1}>
                      {(it.action_items ?? []).length === 0 && <Typography sx={{ color: C.dim }}>No action items yet.</Typography>}
                      {(it.action_items ?? []).map((a, i) => (
                        <Box key={i} onClick={() => focus(a.message_ids)} sx={{ p: 1.6, borderRadius: 3, cursor: 'pointer', border: `1px solid ${C.line}`, '&:hover': { borderColor: `${C.amber}66` } }}>
                          <Typography sx={{ fontSize: 14 }}>{a.task}</Typography>
                          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
                            <Pill color={colorFor(a.owner || '?')}>{a.owner || 'unassigned'}</Pill>
                            {a.due && <Pill color={C.red}>due {a.due}</Pill>}
                          </Stack>
                        </Box>
                      ))}
                    </Stack>
                  )}
                  {panel === 'people' && (
                    <Stack spacing={1.2}>
                      {(it.participants ?? []).map((p) => (
                        <Box key={p.number} sx={{ p: 1.6, borderRadius: 3, border: `1px solid ${C.line}` }}>
                          <Stack direction="row" spacing={1.2} alignItems="center">
                            <Avatar name={p.name} color={colorFor(p.name)} size={32} />
                            <Box><Typography sx={{ fontWeight: 700, fontSize: 14 }}>{p.name}</Typography><Typography sx={{ fontSize: 12, color: C.dim }}>{p.number}</Typography></Box>
                          </Stack>
                          {p.asking_for.length > 0 && <Typography sx={{ fontSize: 13, color: C.muted, mt: 1 }}>🙋 Asking: {p.asking_for.join(' · ')}</Typography>}
                          {p.committing_to.length > 0 && <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.5 }}>🤝 Committing: {p.committing_to.join(' · ')}</Typography>}
                        </Box>
                      ))}
                    </Stack>
                  )}
                </motion.div>
              </AnimatePresence>
            </Box>
          )}
        </Box>
      )}
    </Box>
  )
}
