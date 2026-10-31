import { useEffect, useRef, useState, type ReactNode } from 'react'
import { NavLink, useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import IconButton from '@mui/material/IconButton'
import Drawer from '@mui/material/Drawer'
import Tooltip from '@mui/material/Tooltip'
import useMediaQuery from '@mui/material/useMediaQuery'
import DashboardRounded from '@mui/icons-material/DashboardRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import HubRounded from '@mui/icons-material/HubRounded'
import MailRounded from '@mui/icons-material/MailRounded'
import FolderRounded from '@mui/icons-material/FolderRounded'
import ChatRounded from '@mui/icons-material/ChatRounded'
import AssessmentRounded from '@mui/icons-material/AssessmentRounded'
import MenuRounded from '@mui/icons-material/MenuRounded'
import KeyboardDoubleArrowLeftRounded from '@mui/icons-material/KeyboardDoubleArrowLeftRounded'
import KeyboardDoubleArrowRightRounded from '@mui/icons-material/KeyboardDoubleArrowRightRounded'
import BoltRounded from '@mui/icons-material/BoltRounded'
import MonitorHeartRounded from '@mui/icons-material/MonitorHeartRounded'
import StarField from '../aceternity/StarField'
import ErrorBoundary from '../ErrorBoundary'
import { StatusDot, Pill } from '../ui'
import { useApp } from '../../lib/app-context'
import { C, GRADIENT } from '../../theme'

export const NAV = [
  { to: '/', label: 'Overview', icon: <DashboardRounded fontSize="small" />, title: 'Overview' },
  { to: '/ask', label: 'Ask Unsilo', icon: <AutoAwesomeRounded fontSize="small" />, title: 'Ask Unsilo', badge: 'AI' },
  { to: '/connections', label: 'Connections', icon: <HubRounded fontSize="small" />, title: 'Connections' },
  { to: '/gmail', label: 'Gmail intel', icon: <MailRounded fontSize="small" />, title: 'Gmail intel', countKey: 'emails' as const },
  { to: '/drive', label: 'Documents', icon: <FolderRounded fontSize="small" />, title: 'Documents', countKey: 'documents' as const },
  { to: '/site-updates', label: 'Site updates', icon: <ChatRounded fontSize="small" />, title: 'Site updates', countKey: 'whatsapp_messages' as const },
  { to: '/reports', label: 'Reports', icon: <AssessmentRounded fontSize="small" />, title: 'Reports' },
]

function Brand({ compact }: { compact: boolean }) {
  return (
    <Stack direction="row" alignItems="center" spacing={1.4} sx={{ px: compact ? 0 : 0.5, justifyContent: compact ? 'center' : 'flex-start' }}>
      <Box component="img" src="/logo.svg" alt="" sx={{ width: 42, height: 42, borderRadius: '13px', boxShadow: `0 8px 24px ${C.amber}40` }} />
      {!compact && (
        <Box>
          <Typography sx={{ fontFamily: '"Bricolage Grotesque"', fontWeight: 800, fontSize: 24, lineHeight: 1, letterSpacing: '-0.03em' }}>
            unsilo<Box component="span" sx={{ color: C.amber }}>.</Box>
          </Typography>
          <Typography sx={{ fontSize: 9.5, letterSpacing: '0.28em', color: C.dim, fontWeight: 700, mt: 0.4 }}>FIELD INTELLIGENCE</Typography>
        </Box>
      )}
    </Stack>
  )
}

function SideNav({ compact, onNavigate }: { compact: boolean; onNavigate?: () => void }) {
  const { health } = useApp()
  const { pathname } = useLocation()
  return (
    <Stack spacing={0.5} component="nav">
      {!compact && <Typography variant="overline" sx={{ color: C.dim, px: 1.5, mb: 0.5 }}>Workspace</Typography>}
      {NAV.map((item) => {
        const active = item.to === '/' ? pathname === '/' : pathname.startsWith(item.to)
        const count = item.countKey && health ? health.counts[item.countKey] : undefined
        const link = (
          <Box key={item.to} component={NavLink} to={item.to} onClick={onNavigate}
            sx={{
              position: 'relative', display: 'flex', alignItems: 'center', gap: 1.5, px: compact ? 0 : 1.6, py: 1.2,
              justifyContent: compact ? 'center' : 'flex-start', borderRadius: 3, textDecoration: 'none',
              color: active ? C.text : C.muted, fontWeight: 600, fontSize: 14.5, transition: 'color .2s',
              '&:hover': { color: C.text, background: 'rgba(255,255,255,0.03)' },
            }}>
            {active && (
              <motion.span layoutId="nav-active" transition={{ type: 'spring', stiffness: 380, damping: 32 }}
                style={{ position: 'absolute', inset: 0, borderRadius: 12, background: `linear-gradient(90deg, ${C.amber}26, ${C.amber}08)`, border: `1px solid ${C.amber}40`, boxShadow: `inset 3px 0 0 ${C.amber}` }} />
            )}
            <Box sx={{ position: 'relative', display: 'flex', color: active ? C.amber : 'inherit' }}>{item.icon}</Box>
            {!compact && <Box sx={{ position: 'relative', flex: 1 }}>{item.label}</Box>}
            {!compact && item.badge && <Pill sx={{ position: 'relative', fontSize: 10, px: 0.8 }}>{item.badge}</Pill>}
            {!compact && count !== undefined && <Box sx={{ position: 'relative', fontSize: 12, color: C.dim, fontWeight: 700 }}>{count}</Box>}
          </Box>
        )
        return compact ? <Tooltip key={item.to} title={item.label} placement="right">{link}</Tooltip> : link
      })}
    </Stack>
  )
}

function SidebarContent({ compact, onToggle, onNavigate }: { compact: boolean; onToggle?: () => void; onNavigate?: () => void }) {
  return (
    <Stack sx={{ height: '100%', p: compact ? 1.2 : 2.2, gap: 3 }}>
      <Stack direction="row" alignItems="center" justifyContent="space-between">
        <Brand compact={compact} />
        {onToggle && !compact && (
          <IconButton size="small" onClick={onToggle} sx={{ color: C.dim, border: `1px solid ${C.line}` }}><KeyboardDoubleArrowLeftRounded fontSize="small" /></IconButton>
        )}
      </Stack>
      {onToggle && compact && (
        <IconButton size="small" onClick={onToggle} sx={{ alignSelf: 'center', color: C.dim, border: `1px solid ${C.line}` }}><KeyboardDoubleArrowRightRounded fontSize="small" /></IconButton>
      )}
      {!compact && (
        <Box sx={{ px: 1.5, py: 1.2, borderRadius: 3, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: 1.2, fontSize: 14, fontWeight: 600 }}>
          <StatusDot on /> Operations workspace
        </Box>
      )}
      <SideNav compact={compact} onNavigate={onNavigate} />
      <Box sx={{ flex: 1 }} />
      {!compact && (
        <Box sx={{ position: 'relative', overflow: 'hidden', p: 2.2, borderRadius: 4, border: `1px solid ${C.amber}30`, background: `linear-gradient(160deg, ${C.amber}1f, transparent 60%), ${C.panel}` }}>
          <Box sx={{ position: 'absolute', top: 0, left: 0, right: 0, height: 5 }} className="hazard-stripes" />
          <Box sx={{ width: 40, height: 40, borderRadius: 2.5, display: 'grid', placeItems: 'center', background: `${C.amber}22`, color: C.amber, mt: 0.5, mb: 1.5 }}><BoltRounded /></Box>
          <Typography sx={{ fontWeight: 800 }}>Field to office. No silos.</Typography>
          <Typography sx={{ fontSize: 13, color: C.muted, mt: 0.5 }}>Equipment, projects and site chatter, finally in one place.</Typography>
        </Box>
      )}
      <Stack direction="row" alignItems="center" spacing={1.4} sx={{ pt: 2, borderTop: `1px solid ${C.line}`, justifyContent: compact ? 'center' : 'flex-start' }}>
        <Box sx={{ width: 38, height: 38, borderRadius: '50%', display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: 13, color: '#120a00', background: GRADIENT }}>OP</Box>
        {!compact && (
          <Box>
            <Typography sx={{ fontWeight: 700, fontSize: 14 }}>Ops team</Typography>
            <Typography sx={{ fontSize: 12, color: C.dim }}>Rental · Construction · Mining</Typography>
          </Box>
        )}
      </Stack>
    </Stack>
  )
}

function TopBar({ onMenu }: { onMenu?: () => void }) {
  const { health, healthError } = useApp()
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const page = NAV.find((n) => (n.to === '/' ? pathname === '/' : pathname.startsWith(n.to)))
  const online = !!health && !healthError
  return (
    <Stack direction="row" alignItems="center" spacing={{ xs: 1, sm: 1.5 }} sx={{ px: { xs: 1.5, sm: 2, md: 4 }, pt: { xs: 2, md: 3 }, pb: 1, maxWidth: 1680, mx: 'auto' }}>
      {onMenu && <IconButton onClick={onMenu} sx={{ border: `1px solid ${C.line}` }}><MenuRounded /></IconButton>}
      <Box sx={{ flex: 1, minWidth: 0 }}>
        <Typography variant="overline" noWrap sx={{ color: C.amber, display: 'block', lineHeight: 1.4, fontSize: { xs: 9.5, sm: 11 } }}>Rental · Construction · Mining</Typography>
        <Typography variant="h4" noWrap sx={{ fontSize: { xs: 24, md: 32 } }}>{page?.title ?? 'Unsilo'}</Typography>
      </Box>
      <Stack direction="row" spacing={1} alignItems="center" sx={{ display: { xs: 'none', sm: 'flex' } }}>
        {health && <Pill color={health.ai === 'gemini' ? C.lime : C.muted}><AutoAwesomeRounded sx={{ fontSize: 14 }} />AI: {health.ai}</Pill>}
        {health && <Pill color={C.muted} sx={{ display: { xs: 'none', lg: 'inline-flex' } }}>ref {health.reference_date}</Pill>}
        <Tooltip title={healthError ?? 'Backend is reachable'}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 1.6, py: 0.8, borderRadius: 99, border: `1px solid ${C.line}`, fontSize: 13, fontWeight: 600, color: C.muted }}>
            <StatusDot on={online} color={online ? C.lime : C.red} /> {online ? 'API connected' : 'API offline'}
          </Box>
        </Tooltip>
      </Stack>
      <Tooltip title="Connections health">
        <IconButton onClick={() => navigate('/connections')} sx={{ border: `1px solid ${C.line}`, borderRadius: 3 }}><MonitorHeartRounded fontSize="small" /></IconButton>
      </Tooltip>
    </Stack>
  )
}

export default function Shell() {
  const location = useLocation()
  const mobile = useMediaQuery('(max-width:900px)')
  const [compact, setCompact] = useState(() => {
    try { return localStorage.getItem('unsilo.compact') === '1' } catch { return false }
  })
  const [open, setOpen] = useState(false)
  useEffect(() => {
    try { localStorage.setItem('unsilo.compact', compact ? '1' : '0') } catch { /* storage blocked */ }
  }, [compact])
  useEffect(() => { window.scrollTo({ top: 0 }) }, [location.pathname])

  const width = compact ? 84 : 290
  return (
    <Box sx={{ display: 'flex', minHeight: '100vh', position: 'relative' }}>
      {/* global ambient layer */}
      <Box aria-hidden sx={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}>
        <Box sx={{ position: 'absolute', inset: 0, background: `radial-gradient(900px 500px at 75% -10%, ${C.amber}14, transparent 60%), radial-gradient(700px 500px at 0% 100%, #c6f43208, transparent 60%)` }} />
        <Box className="grid-bg" sx={{ position: 'absolute', inset: 0 }} />
        <StarField density={0.35} />
      </Box>

      {mobile ? (
        <Drawer open={open} onClose={() => setOpen(false)} PaperProps={{ sx: { width: 290, background: C.panel, borderRight: `1px solid ${C.line}` } }}>
          <SidebarContent compact={false} onNavigate={() => setOpen(false)} />
        </Drawer>
      ) : (
        <Box component={motion.aside} animate={{ width }} transition={{ type: 'spring', stiffness: 260, damping: 30 }}
          sx={{ position: 'sticky', top: 0, height: '100vh', flexShrink: 0, zIndex: 2, borderRight: `1px solid ${C.line}`, background: 'rgba(12,12,15,0.82)', backdropFilter: 'blur(14px)', overflowY: 'auto', overflowX: 'hidden' }}>
          <SidebarContent compact={compact} onToggle={() => setCompact((v) => !v)} />
        </Box>
      )}

      <Box component="main" sx={{ flex: 1, minWidth: 0, position: 'relative', zIndex: 1 }}>
        <TopBar onMenu={mobile ? () => setOpen(true) : undefined} />
        <AnimatePresence mode="wait">
          <PageFrame key={location.pathname}>
            <FrozenOutlet />
          </PageFrame>
        </AnimatePresence>
        <Footer />
      </Box>
    </Box>
  )
}

const PAGE_VARIANTS = {
  initial: { opacity: 0, y: 16, filter: 'blur(6px)' },
  enter: { opacity: 1, y: 0, filter: 'blur(0px)' },
  exit: { opacity: 0, y: -10, filter: 'blur(6px)' },
}

function PageFrame({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <motion.div ref={ref} variants={PAGE_VARIANTS} initial="initial" animate="enter" exit="exit"
      transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
      onAnimationComplete={(name) => {
        // drop transform/filter once the page is in, so sticky toolbars behave normally
        if (name === 'enter' && ref.current) {
          ref.current.style.transform = 'none'
          ref.current.style.filter = 'none'
        }
      }}>
      <Box sx={{ px: { xs: 1.5, sm: 2, md: 4 }, pt: { xs: 1, md: 2 }, pb: 6, maxWidth: 1680, mx: 'auto' }}>
        <ErrorBoundary>{children}</ErrorBoundary>
      </Box>
    </motion.div>
  )
}

/** Keeps the old page on screen while it animates out (Outlet alone would swap content immediately). */
function FrozenOutlet() {
  const outlet = useOutlet()
  const [frozen] = useState(outlet)
  return frozen
}

function Footer(): ReactNode {
  return (
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" spacing={1}
      sx={{ mx: { xs: 1.5, sm: 2, md: 4 }, py: 3, borderTop: `1px solid ${C.line}`, color: C.dim, fontSize: { xs: 9.5, sm: 11 }, fontWeight: 700, letterSpacing: { xs: '0.12em', sm: '0.2em' }, textAlign: { xs: 'center', sm: 'left' } }}>
      <span>UNSILO · FIELD INTELLIGENCE</span>
      <span>BUILT FOR THE PEOPLE WHO BUILD THINGS.</span>
    </Stack>
  )
}
