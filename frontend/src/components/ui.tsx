import type { ReactNode } from 'react'
import { motion } from 'framer-motion'
import Box, { type BoxProps } from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Skeleton from '@mui/material/Skeleton'
import MailRounded from '@mui/icons-material/MailRounded'
import DescriptionRounded from '@mui/icons-material/DescriptionRounded'
import ChatRounded from '@mui/icons-material/ChatRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import SearchOffRounded from '@mui/icons-material/SearchOffRounded'
import { C } from '../theme'

export function PageHeader({ kicker, title, subtitle, right }: { kicker: string; title: ReactNode; subtitle?: ReactNode; right?: ReactNode }) {
  return (
    <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'flex-end' }} justifyContent="space-between" spacing={2} sx={{ mb: 3.5 }}>
      <Box component={motion.div} initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5 }}>
        <Typography variant="overline" sx={{ color: C.amber }}>{kicker}</Typography>
        <Typography variant="h3" sx={{ fontSize: { xs: 30, md: 40 }, lineHeight: 1.05, mt: 0.5 }}>{title}</Typography>
        {subtitle && <Typography sx={{ color: C.muted, mt: 1, maxWidth: 720 }}>{subtitle}</Typography>}
      </Box>
      {right}
    </Stack>
  )
}

export function StatusDot({ on, color }: { on: boolean; color?: string }) {
  const c = color ?? (on ? C.lime : C.amber)
  return (
    <Box component="span" sx={{ position: 'relative', display: 'inline-flex', width: 9, height: 9, flexShrink: 0 }}>
      {on && <Box component="span" sx={{ position: 'absolute', inset: 0, borderRadius: '50%', color: `${c}88`, animation: 'pulse-ring 1.6s ease-out infinite' }} />}
      <Box component="span" sx={{ position: 'relative', width: 9, height: 9, borderRadius: '50%', background: c, boxShadow: `0 0 10px ${c}` }} />
    </Box>
  )
}

export function Pill({ children, color = C.amber, sx }: { children: ReactNode; color?: string; sx?: BoxProps['sx'] }) {
  return (
    <Box component="span" sx={{
      display: 'inline-flex', alignItems: 'center', gap: 0.6, px: 1.1, py: 0.25, borderRadius: 99, fontSize: 12, fontWeight: 700,
      color, border: `1px solid ${color}55`, background: `${color}14`, whiteSpace: 'nowrap', lineHeight: 1.6, ...sx,
    }}>{children}</Box>
  )
}

export function EmptyState({ title, text, action, icon }: { title: string; text?: ReactNode; action?: ReactNode; icon?: ReactNode }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1.2} sx={{ py: 8, px: 3, textAlign: 'center', color: C.muted }}>
      <Box sx={{ width: 64, height: 64, borderRadius: '20px', display: 'grid', placeItems: 'center', background: `${C.amber}14`, color: C.amber, border: `1px solid ${C.amber}33`, animation: 'float-y 4s ease-in-out infinite' }}>
        {icon ?? <SearchOffRounded />}
      </Box>
      <Typography variant="h6" sx={{ color: C.text }}>{title}</Typography>
      {text && <Typography sx={{ maxWidth: 460, fontSize: 14 }}>{text}</Typography>}
      {action}
    </Stack>
  )
}

export function ErrorBox({ message }: { message: string }) {
  return (
    <Box sx={{ p: 2, borderRadius: 3, border: `1px solid ${C.red}55`, background: `${C.red}12`, color: '#ffc2cc', fontSize: 14 }}>
      {message}
    </Box>
  )
}

export function LoadingRows({ rows = 6, height = 52 }: { rows?: number; height?: number }) {
  return (
    <Stack spacing={1}>
      {Array.from({ length: rows }, (_, i) => (
        <Skeleton key={i} variant="rounded" height={height} sx={{ bgcolor: 'rgba(255,255,255,0.05)', borderRadius: 3 }} />
      ))}
    </Stack>
  )
}

export const SOURCE_META: Record<string, { label: string; color: string; icon: ReactNode }> = {
  gmail: { label: 'Gmail', color: '#ff6b6b', icon: <MailRounded sx={{ fontSize: 16 }} /> },
  drive: { label: 'Drive', color: '#4cc9f0', icon: <DescriptionRounded sx={{ fontSize: 16 }} /> },
  whatsapp: { label: 'WhatsApp', color: '#25d366', icon: <ChatRounded sx={{ fontSize: 16 }} /> },
  whatsapp_summary: { label: 'Site summary', color: '#c6f432', icon: <AutoAwesomeRounded sx={{ fontSize: 16 }} /> },
}

export function SourceChip({ type }: { type: string }) {
  const m = SOURCE_META[type] ?? { label: type, color: C.muted, icon: null }
  return <Pill color={m.color}>{m.icon}{m.label}</Pill>
}

export function Avatar({ name, size = 36, color }: { name: string; size?: number; color: string }) {
  const parts = name.replace(/[<>"]/g, '').trim().split(/[\s._@-]+/).filter(Boolean)
  const text = ((parts[0]?.[0] ?? '?') + (parts[1]?.[0] ?? '')).toUpperCase()
  return (
    <Box sx={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', fontWeight: 800, fontSize: size * 0.38, color: '#111', background: color }}>
      {text}
    </Box>
  )
}
