import { memo, useCallback, useEffect, useMemo, useState, type MouseEvent, type ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import Menu from '@mui/material/Menu'
import MenuItem from '@mui/material/MenuItem'
import InputBase from '@mui/material/InputBase'
import Dialog from '@mui/material/Dialog'
import LinearProgress from '@mui/material/LinearProgress'
import ToggleButton from '@mui/material/ToggleButton'
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup'
import useMediaQuery from '@mui/material/useMediaQuery'
import AddRounded from '@mui/icons-material/AddRounded'
import FolderRounded from '@mui/icons-material/FolderRounded'
import ScheduleRounded from '@mui/icons-material/ScheduleRounded'
import VideoLibraryRounded from '@mui/icons-material/VideoLibraryRounded'
import PhotoLibraryRounded from '@mui/icons-material/PhotoLibraryRounded'
import ArticleRounded from '@mui/icons-material/ArticleRounded'
import SearchRounded from '@mui/icons-material/SearchRounded'
import CloseRounded from '@mui/icons-material/CloseRounded'
import GridViewRounded from '@mui/icons-material/GridViewRounded'
import ViewListRounded from '@mui/icons-material/ViewListRounded'
import ExpandMoreRounded from '@mui/icons-material/ExpandMoreRounded'
import RefreshRounded from '@mui/icons-material/RefreshRounded'
import OpenInNewRounded from '@mui/icons-material/OpenInNewRounded'
import PlayArrowRounded from '@mui/icons-material/PlayArrowRounded'
import ChevronLeftRounded from '@mui/icons-material/ChevronLeftRounded'
import ChevronRightRounded from '@mui/icons-material/ChevronRightRounded'
import AutoAwesomeRounded from '@mui/icons-material/AutoAwesomeRounded'
import SwapVertRounded from '@mui/icons-material/SwapVertRounded'
import CloudRounded from '@mui/icons-material/CloudRounded'
import LabelRounded from '@mui/icons-material/LabelRounded'
import { EmptyState, ErrorBox, LoadingRows, Pill } from '../components/ui'
import { invalidate, post, useApi } from '../lib/api'
import { useApp } from '../lib/app-context'
import type { DriveDoc } from '../lib/types'
import { CATEGORY_COLORS, fileKind, fullDate, KIND_META, mailDate, parseDate, previewUrl, thumbUrl, type FileKind } from '../lib/format'
import { C } from '../theme'

type View = 'all' | 'recent' | 'videos' | 'images' | 'docs'
type Modified = 'any' | 'today' | '7d' | '30d' | 'year'
type Sort = 'modified' | 'name'

const CATS = ['sales', 'marketing', 'verification', 'office', 'accounts'] as const
const MOD_LABEL: Record<Modified, string> = { any: 'Modified', today: 'Today', '7d': 'Last 7 days', '30d': 'Last 30 days', year: 'This year' }
const TYPE_ORDER: FileKind[] = ['doc', 'sheet', 'slides', 'pdf', 'image', 'video', 'audio', 'text', 'archive', 'other']

function modifiedOk(iso: string, m: Modified) {
  if (m === 'any') return true
  const d = parseDate(iso)
  if (!d) return false
  const now = new Date()
  const start = new Date(now)
  if (m === 'today') start.setHours(0, 0, 0, 0)
  else if (m === 'year') { start.setMonth(0, 1); start.setHours(0, 0, 0, 0) }
  else start.setDate(now.getDate() - (m === '7d' ? 7 : 30))
  return d >= start
}

function KindIcon({ kind, size = 22 }: { kind: FileKind; size?: number }) {
  const k = KIND_META[kind]
  return (
    <Box sx={{ width: size, height: size, borderRadius: 0.8, flexShrink: 0, display: 'grid', placeItems: 'center', background: k.color, color: '#111', fontSize: size * 0.42, fontWeight: 900 }}>
      {kind === 'video' ? <PlayArrowRounded sx={{ fontSize: size * 0.8 }} /> : k.label[0]}
    </Box>
  )
}

/** Drive thumbnail with a designed fallback (type tile + text preview) when Drive has no thumbnail. */
const Thumb = memo(function Thumb({ doc, kind }: { doc: DriveDoc; kind: FileKind }) {
  const [failed, setFailed] = useState(false)
  const k = KIND_META[kind]
  const fallback = (
    <Box sx={{ position: 'absolute', inset: 0, p: 1.6, background: kind === 'video' ? 'linear-gradient(135deg, #1a0d12, #0d0d10)' : `linear-gradient(160deg, ${k.color}22, ${C.panel} 70%)` }}>
      {doc.preview && kind !== 'video' ? (
        <Box sx={{ height: '100%', borderRadius: 1.5, p: 1.2, background: '#f4f4f5', color: '#3f3f46', fontSize: 9.5, lineHeight: 1.45, overflow: 'hidden', fontFamily: 'Inter', boxShadow: '0 6px 20px rgba(0,0,0,0.35)' }}>
          {doc.preview}
        </Box>
      ) : (
        <Box sx={{ height: '100%', display: 'grid', placeItems: 'center' }}><KindIcon kind={kind} size={52} /></Box>
      )}
    </Box>
  )
  return (
    <Box sx={{ position: 'relative', aspectRatio: '16 / 10', borderRadius: 2.5, overflow: 'hidden', background: '#0f0f12' }}>
      {failed ? fallback : (
        <Box component="img" src={thumbUrl(doc.id)} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)}
          sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }} />
      )}
      {kind === 'video' && (
        <Box className="play" sx={{ position: 'absolute', inset: 0, display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg, transparent 40%, rgba(0,0,0,0.55))' }}>
          <Box sx={{ width: 54, height: 54, borderRadius: '50%', display: 'grid', placeItems: 'center', background: 'rgba(255,255,255,0.92)', color: '#111', boxShadow: `0 0 0 8px rgba(255,255,255,0.15), 0 10px 30px rgba(0,0,0,0.5)`, transition: 'transform .2s' }}>
            <PlayArrowRounded sx={{ fontSize: 34 }} />
          </Box>
        </Box>
      )}
    </Box>
  )
})

const Card = memo(function Card({ doc, onOpen, index }: { doc: DriveDoc; onOpen: (id: string) => void; index: number }) {
  const kind = fileKind(doc.mime_type, doc.name)
  return (
    <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: Math.min(index * 0.025, 0.5) }}>
      <Box onClick={() => onOpen(doc.id)} sx={{
        p: { xs: 0.8, sm: 1.2 }, borderRadius: { xs: 3, sm: 4 }, cursor: 'pointer', background: C.panel2, border: `1px solid ${C.line}`, transition: 'all .2s',
        '&:hover': { borderColor: `${C.amber}66`, transform: 'translateY(-3px)', boxShadow: `0 16px 40px rgba(0,0,0,0.45), 0 0 0 1px ${C.amber}22` },
        '&:hover .play > div': { transform: 'scale(1.1)' },
      }}>
        <Stack direction="row" spacing={1.2} alignItems="center" sx={{ px: 0.6, pb: 1.2, pt: 0.4 }}>
          <KindIcon kind={kind} size={20} />
          <Typography noWrap sx={{ fontWeight: 600, fontSize: { xs: 12.5, sm: 13.5 }, flex: 1, minWidth: 0 }}>{doc.name}</Typography>
        </Stack>
        <Thumb doc={doc} kind={kind} />
        <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{ px: 0.6, pt: 1.2, pb: 0.2 }}>
          {doc.category ? <Pill color={CATEGORY_COLORS[doc.category]} sx={{ fontSize: 11, py: 0 }}>{doc.category}</Pill> : <span />}
          <Typography sx={{ fontSize: 12, color: C.dim }}>{mailDate(doc.modified_at)}</Typography>
        </Stack>
      </Box>
    </motion.div>
  )
})

function Preview({ doc, onClose, onPrev, onNext }: { doc: DriveDoc | null; onClose: () => void; onPrev?: () => void; onNext?: () => void }) {
  const wide = useMediaQuery('(min-width:1100px)')
  const phone = useMediaQuery('(max-width:640px)')
  const navigate = useNavigate()
  const kind = doc ? fileKind(doc.mime_type, doc.name) : 'other'
  const [imgFailed, setImgFailed] = useState(false)
  useEffect(() => { setImgFailed(false) }, [doc?.id])
  useEffect(() => {
    if (!doc) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') onPrev?.()
      if (e.key === 'ArrowRight') onNext?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [doc, onPrev, onNext])

  return (
    <Dialog open={!!doc} onClose={onClose} fullWidth maxWidth="xl" fullScreen={phone}
      PaperProps={{ sx: { height: { md: '88vh' }, background: '#0c0c0f', border: `1px solid ${C.line}`, overflow: 'hidden' } }}
      slotProps={{ backdrop: { sx: { backdropFilter: 'blur(8px)', background: 'rgba(0,0,0,0.7)' } } }}>
      {doc && (
        <Stack component={motion.div} initial={{ scale: 0.94, opacity: 0 }} animate={{ scale: 1, opacity: 1 }}
          transition={{ type: 'spring', stiffness: 220, damping: 24 }} sx={{ height: '100%' }}>
          <Stack direction="row" alignItems="center" spacing={1.5} sx={{ px: 2, py: 1.4, borderBottom: `1px solid ${C.line}` }}>
            <KindIcon kind={kind} size={26} />
            <Typography noWrap sx={{ fontWeight: 700, flex: 1 }}>{doc.name}</Typography>
            <Tooltip title="Ask Unsilo about this file">
              <IconButton onClick={() => navigate('/ask', { state: { q: `What is in "${doc.name}" and why does it matter?` } })}><AutoAwesomeRounded sx={{ color: C.amber }} /></IconButton>
            </Tooltip>
            <Button variant="outlined" size="small" href={doc.url} target="_blank" rel="noreferrer" startIcon={<OpenInNewRounded />} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>Open in Drive</Button>
            <IconButton href={doc.url} target="_blank" rel="noreferrer" sx={{ display: { xs: 'inline-flex', sm: 'none' } }} aria-label="Open in Drive"><OpenInNewRounded /></IconButton>
            <IconButton onClick={onClose}><CloseRounded /></IconButton>
          </Stack>
          <Stack direction={wide ? 'row' : 'column'} sx={{ flex: 1, minHeight: 0 }}>
            <Box sx={{ position: 'relative', flex: 1, minHeight: { xs: '42vh', sm: 360, md: 0 }, background: '#000', display: 'grid', placeItems: 'center' }}>
              {kind === 'image' && !imgFailed ? (
                <Box component="img" src={thumbUrl(doc.id, 1800)} alt={doc.name} referrerPolicy="no-referrer" onError={() => setImgFailed(true)}
                  sx={{ maxWidth: '100%', maxHeight: '100%', objectFit: 'contain' }} />
              ) : (
                <Box component="iframe" key={doc.id} src={previewUrl(doc.id)} title={doc.name} allow="autoplay; encrypted-media; fullscreen" allowFullScreen
                  sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 0, background: '#111' }} />
              )}
              {onPrev && <IconButton onClick={onPrev} sx={{ position: 'absolute', left: 12, top: '50%', background: 'rgba(0,0,0,0.6)', '&:hover': { background: 'rgba(0,0,0,0.8)' } }}><ChevronLeftRounded /></IconButton>}
              {onNext && <IconButton onClick={onNext} sx={{ position: 'absolute', right: 12, top: '50%', background: 'rgba(0,0,0,0.6)', '&:hover': { background: 'rgba(0,0,0,0.8)' } }}><ChevronRightRounded /></IconButton>}
            </Box>
            <Box sx={{ width: wide ? 340 : '100%', flexShrink: 0, p: 2.5, borderLeft: wide ? `1px solid ${C.line}` : 0, overflowY: 'auto' }}>
              <Typography variant="overline" sx={{ color: C.dim }}>Details</Typography>
              <Stack spacing={1.6} sx={{ mt: 1, fontSize: 14 }}>
                <Detail label="Type">{KIND_META[kind].label}</Detail>
                <Detail label="Modified">{fullDate(doc.modified_at) || '—'}</Detail>
                <Detail label="Category">{doc.category ? <Pill color={CATEGORY_COLORS[doc.category]}>{doc.category}</Pill> : '—'}</Detail>
                {doc.reason && (
                  <Box sx={{ p: 1.6, borderRadius: 3, border: `1px solid ${C.amber}40`, background: `${C.amber}0d` }}>
                    <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 0.6 }}>
                      <AutoAwesomeRounded sx={{ fontSize: 16, color: C.amber }} />
                      <Typography sx={{ fontWeight: 800, fontSize: 13 }}>Why this category</Typography>
                      {doc.method && <Pill color={C.dim} sx={{ fontSize: 10 }}>{doc.method === 'ai' ? 'AI' : 'rules'}</Pill>}
                    </Stack>
                    <Typography sx={{ fontSize: 13, color: C.muted }}>{doc.reason}</Typography>
                  </Box>
                )}
                {doc.error && <ErrorBox message={`Text extraction: ${doc.error}`} />}
                {doc.preview && (
                  <Box>
                    <Typography sx={{ fontSize: 12, color: C.dim, mb: 0.6 }}>Text preview</Typography>
                    <Typography sx={{ fontSize: 13, color: C.muted, whiteSpace: 'pre-wrap' }}>{doc.preview}…</Typography>
                  </Box>
                )}
                <Typography sx={{ fontSize: 11.5, color: C.dim }}>Preview plays through Google Drive, so this browser needs to be signed in to a Google account that can see the file.</Typography>
              </Stack>
            </Box>
          </Stack>
        </Stack>
      )}
    </Dialog>
  )
}

function Detail({ label, children }: { label: string; children: ReactNode }) {
  return (
    <Stack direction="row" justifyContent="space-between" alignItems="center" spacing={2}>
      <Typography sx={{ color: C.dim, fontSize: 13 }}>{label}</Typography>
      <Box sx={{ fontSize: 13.5, textAlign: 'right' }}>{children}</Box>
    </Stack>
  )
}

function RailItem({ icon, label, count, active, onClick, color, chip }: { icon: ReactNode; label: string; count?: number; active: boolean; onClick: () => void; color?: string; chip?: boolean }) {
  if (chip) {
    return (
      <Box onClick={onClick} role="button" sx={{
        display: 'flex', alignItems: 'center', gap: 0.8, px: 1.4, py: 0.7, borderRadius: 99, cursor: 'pointer', flexShrink: 0, whiteSpace: 'nowrap',
        fontSize: 13, fontWeight: 700, color: active ? '#140b00' : C.muted, background: active ? C.amber : 'rgba(255,255,255,0.04)',
        border: `1px solid ${active ? C.amber : C.line}`, '& svg': { fontSize: 17, color: active ? 'inherit' : color },
      }}>
        {icon}{label}{count !== undefined && <Box component="span" sx={{ fontSize: 12, opacity: 0.8 }}>{count}</Box>}
      </Box>
    )
  }
  return (
    <Box onClick={onClick} role="button" sx={{
      display: 'flex', alignItems: 'center', gap: 1.6, pl: 2, pr: 1.6, py: 0.9, mr: 1, borderRadius: '0 99px 99px 0', cursor: 'pointer',
      fontSize: 14, fontWeight: active ? 800 : 500, color: active ? C.text : C.muted, background: active ? `${C.amber}26` : 'transparent',
      '&:hover': { background: active ? `${C.amber}30` : 'rgba(255,255,255,0.04)' },
    }}>
      <Box sx={{ display: 'flex', color: color ?? (active ? C.amber : 'inherit'), '& svg': { fontSize: 19 } }}>{icon}</Box>
      <Box sx={{ flex: 1 }}>{label}</Box>
      {count !== undefined && <Box sx={{ fontSize: 12, color: C.dim, fontWeight: 700 }}>{count}</Box>}
    </Box>
  )
}

export default function Drive() {
  const { data, error, loading } = useApi<{ documents: DriveDoc[] }>('/api/documents')
  const { toast, refreshHealth } = useApp()
  const mobile = useMediaQuery('(max-width:1000px)')
  const [view, setView] = useState<View>('all')
  const [cat, setCat] = useState<string | null>(null)
  const [types, setTypes] = useState<FileKind[]>([])
  const [modified, setModified] = useState<Modified>('any')
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>('modified')
  const [asc, setAsc] = useState(false)
  const [layout, setLayout] = useState<'grid' | 'list'>(() => { try { return (localStorage.getItem('unsilo.drive.layout') as 'grid' | 'list') || 'grid' } catch { return 'grid' } })
  const [typeMenu, setTypeMenu] = useState<HTMLElement | null>(null)
  const [modMenu, setModMenu] = useState<HTMLElement | null>(null)
  const [openId, setOpenId] = useState<string | null>(null)
  const [syncing, setSyncing] = useState(false)
  useEffect(() => { try { localStorage.setItem('unsilo.drive.layout', layout) } catch { /* storage blocked */ } }, [layout])

  const docs = useMemo(() => data?.documents ?? [], [data])
  const withKind = useMemo(() => docs.map((d) => ({ d, k: fileKind(d.mime_type, d.name) })), [docs])
  const presentKinds = useMemo(() => TYPE_ORDER.filter((k) => withKind.some((x) => x.k === k)), [withKind])
  const catCount = useMemo(() => Object.fromEntries(CATS.map((c) => [c, docs.filter((d) => d.category === c).length])), [docs])

  const filtered = useMemo(() => {
    const now = Date.now()
    const out = withKind.filter(({ d, k }) => {
      if (view === 'recent' && (now - (parseDate(d.modified_at)?.getTime() ?? 0)) > 30 * 864e5) return false
      if (view === 'videos' && k !== 'video') return false
      if (view === 'images' && k !== 'image') return false
      if (view === 'docs' && !['doc', 'sheet', 'slides', 'pdf', 'text'].includes(k)) return false
      if (cat && d.category !== cat) return false
      if (types.length && !types.includes(k)) return false
      if (!modifiedOk(d.modified_at, modified)) return false
      if (query.trim()) {
        const q = query.trim().toLowerCase()
        if (!`${d.name} ${d.preview} ${d.category ?? ''} ${KIND_META[k].label}`.toLowerCase().includes(q)) return false
      }
      return true
    }).map((x) => x.d)
    out.sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : (b.modified_at || '').localeCompare(a.modified_at || '')) * (asc ? -1 : 1))
    return out
  }, [withKind, view, cat, types, modified, query, sort, asc])

  const openIdx = openId ? filtered.findIndex((d) => d.id === openId) : -1
  const openDoc = openId ? docs.find((d) => d.id === openId) ?? null : null
  const onOpen = useCallback((id: string) => setOpenId(id), [])

  const sync = async () => {
    setSyncing(true)
    try {
      const r = await post<{ imported: number }>('/api/sync/drive')
      toast(`Synced ${r.imported} files from Drive`)
      invalidate('/api/documents')
      refreshHealth()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setSyncing(false)
    }
  }

  const filtersOn = !!cat || types.length > 0 || modified !== 'any' || !!query
  const videos = withKind.filter((x) => x.k === 'video').length
  const images = withKind.filter((x) => x.k === 'image').length

  const views: { v: View; icon: ReactNode; label: string; count?: number; color?: string }[] = [
    { v: 'all', icon: <FolderRounded />, label: 'My Drive', count: docs.length },
    { v: 'recent', icon: <ScheduleRounded />, label: 'Recent' },
    { v: 'docs', icon: <ArticleRounded />, label: 'Documents' },
    { v: 'videos', icon: <VideoLibraryRounded />, label: 'Videos', count: videos, color: C.red },
    { v: 'images', icon: <PhotoLibraryRounded />, label: 'Photos & images', count: images },
  ]
  const rail = mobile ? (
    <Stack direction="row" spacing={1} alignItems="center" sx={{ px: 1.5, py: 1.2, overflowX: 'auto', borderBottom: `1px solid ${C.line}`, '&::-webkit-scrollbar': { height: 0 } }}>
      <Button variant="contained" size="small" startIcon={<AddRounded />} href="https://drive.google.com/drive/my-drive" target="_blank" rel="noreferrer" sx={{ flexShrink: 0, borderRadius: 99 }}>New</Button>
      {views.map((x) => <RailItem key={x.v} chip icon={x.icon} label={x.label} count={x.count} color={x.color} active={view === x.v} onClick={() => setView(x.v)} />)}
    </Stack>
  ) : (
    <Box sx={{ width: 236, flexShrink: 0, py: 1.5 }}>
      <Box sx={{ px: 1.5, mb: 1.5 }}>
        <Button variant="contained" startIcon={<AddRounded />} href="https://drive.google.com/drive/my-drive" target="_blank" rel="noreferrer" sx={{ borderRadius: 4, py: 1.5, px: 3 }}>New</Button>
      </Box>
      {views.map((x) => <RailItem key={x.v} icon={x.icon} label={x.label} count={x.count} color={x.color} active={view === x.v} onClick={() => setView(x.v)} />)}
      <Typography variant="overline" sx={{ display: 'block', color: C.dim, px: 2.2, mt: 2, mb: 0.5, fontSize: 10 }}>Unsilo categories</Typography>
      {CATS.map((c) => (
        <RailItem key={c} icon={<LabelRounded />} color={CATEGORY_COLORS[c]} label={c[0].toUpperCase() + c.slice(1)} count={catCount[c]} active={cat === c} onClick={() => setCat(cat === c ? null : c)} />
      ))}
      <Box sx={{ m: 1.5, mt: 3, p: 2, borderRadius: 3, border: `1px solid ${C.line}`, background: 'rgba(255,255,255,0.02)' }}>
        <Stack direction="row" spacing={1} alignItems="center"><CloudRounded sx={{ fontSize: 18, color: C.sky }} /><Typography sx={{ fontWeight: 700, fontSize: 13 }}>Storage</Typography></Stack>
        <LinearProgress variant="determinate" value={Math.min(100, docs.length / 5)} sx={{ my: 1.2, height: 6, borderRadius: 9, bgcolor: 'rgba(255,255,255,0.06)', '& .MuiLinearProgress-bar': { background: `linear-gradient(90deg, ${C.sky}, ${C.lime})` } }} />
        <Typography sx={{ fontSize: 12, color: C.dim }}>{docs.length} files indexed · read-only</Typography>
      </Box>
    </Box>
  )

  return (
    <Box sx={{ borderRadius: 5, border: `1px solid ${C.line}`, background: 'rgba(14,14,17,0.88)', backdropFilter: 'blur(10px)', overflow: 'hidden' }}>
      <Stack direction={{ xs: 'column', md: 'row' }} alignItems={{ md: 'center' }} spacing={{ xs: 1.5, md: 2 }} sx={{ px: { xs: 1.5, sm: 2.5 }, py: { xs: 1.5, sm: 2 }, borderBottom: `1px solid ${C.line}` }}>
        <Stack direction="row" alignItems="center" spacing={1.5} sx={{ width: { md: 236 }, flexShrink: 0 }}>
          <Box sx={{ width: 42, height: 42, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: C.sky, background: `${C.sky}1a`, border: `1px solid ${C.sky}33` }}><FolderRounded /></Box>
          <Box>
            <Typography sx={{ fontWeight: 800, fontSize: 18 }}>Drive</Typography>
            <Typography sx={{ fontSize: 12, color: C.dim }}>Visual library · indexed view</Typography>
          </Box>
        </Stack>
        <Box sx={{ flex: 1, display: 'flex', alignItems: 'center', gap: 1, px: 2, height: 48, borderRadius: 99, background: 'rgba(255,255,255,0.06)', '&:focus-within': { background: '#1c1c22', boxShadow: `0 0 0 1px ${C.amber}66` } }}>
          <SearchRounded sx={{ color: C.dim }} />
          <InputBase value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Search in Drive" sx={{ flex: 1, fontSize: 15 }} />
          {query && <IconButton size="small" onClick={() => setQuery('')}><CloseRounded fontSize="small" /></IconButton>}
        </Box>
        <Tooltip title="Sync Drive now">
          <span><IconButton onClick={sync} disabled={syncing} sx={{ border: `1px solid ${C.line}` }}><RefreshRounded sx={{ animation: syncing ? 'spin 1s linear infinite' : 'none' }} /></IconButton></span>
        </Tooltip>
      </Stack>
      {(syncing || (loading && !data)) && <LinearProgress sx={{ height: 2, '& .MuiLinearProgress-bar': { background: C.sky } }} />}

      <Stack direction={mobile ? 'column' : 'row'} sx={{ minHeight: 640 }}>
        {rail}
        <Box sx={{ flex: 1, minWidth: 0, borderLeft: mobile ? 0 : `1px solid ${C.line}`, p: { xs: 1.5, md: 2.5 } }}>
          <Typography variant="h5" sx={{ mb: 1.5 }}>
            {{ all: 'My Drive', recent: 'Recent', videos: 'Videos', images: 'Photos & images', docs: 'Documents' }[view]}
            {cat && <Box component="span" sx={{ color: C.dim }}> › <Box component="span" sx={{ color: CATEGORY_COLORS[cat] }}>{cat}</Box></Box>}
          </Typography>

          {/* Drive-style filter chips */}
          <Stack direction="row" spacing={1} alignItems="center" sx={{ mb: 2.5, flexWrap: 'wrap', rowGap: 1 }}>
            <ChipButton on={types.length > 0} onClick={(e) => setTypeMenu(e.currentTarget)}>{types.length ? types.map((t) => KIND_META[t].label).join(', ') : 'Type'}</ChipButton>
            <ChipButton on={modified !== 'any'} onClick={(e) => setModMenu(e.currentTarget)}>{MOD_LABEL[modified]}</ChipButton>
            {CATS.map((c) => (
              <Box key={c} component="button" type="button" onClick={() => setCat(cat === c ? null : c)} sx={{
                px: 1.6, py: 0.7, borderRadius: 99, fontSize: 13, fontWeight: 700, fontFamily: 'inherit', cursor: 'pointer', textTransform: 'capitalize',
                color: cat === c ? '#111' : C.muted, background: cat === c ? CATEGORY_COLORS[c] : 'transparent', border: `1px solid ${cat === c ? CATEGORY_COLORS[c] : C.line}`,
              }}>{c}</Box>
            ))}
            {filtersOn && <Button size="small" onClick={() => { setCat(null); setTypes([]); setModified('any'); setQuery('') }} sx={{ color: C.dim }}>Clear filters</Button>}
            <Box sx={{ flex: 1 }} />
            <Button size="small" startIcon={<SwapVertRounded />} onClick={() => (sort === 'modified' ? setSort('name') : setSort('modified'))} sx={{ color: C.muted }}>
              {sort === 'modified' ? 'Last modified' : 'Name'}
            </Button>
            <IconButton size="small" onClick={() => setAsc((v) => !v)} sx={{ color: C.muted, transform: asc ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><ExpandMoreRounded /></IconButton>
            <ToggleButtonGroup size="small" exclusive value={layout} onChange={(_, v) => v && setLayout(v)} sx={{ '& .MuiToggleButton-root': { borderColor: C.line, px: 1.2 }, '& .Mui-selected': { background: `${C.amber}26 !important`, color: `${C.amber} !important` } }}>
              <ToggleButton value="grid" aria-label="Grid view"><GridViewRounded fontSize="small" /></ToggleButton>
              <ToggleButton value="list" aria-label="List view"><ViewListRounded fontSize="small" /></ToggleButton>
            </ToggleButtonGroup>
          </Stack>
          <Menu anchorEl={typeMenu} open={!!typeMenu} onClose={() => setTypeMenu(null)}>
            {(presentKinds.length ? presentKinds : TYPE_ORDER).map((k) => (
              <MenuItem key={k} selected={types.includes(k)} onClick={() => setTypes((t) => (t.includes(k) ? t.filter((x) => x !== k) : [...t, k]))}>
                <Stack direction="row" spacing={1.2} alignItems="center"><KindIcon kind={k} size={18} /><span>{KIND_META[k].label}</span></Stack>
              </MenuItem>
            ))}
          </Menu>
          <Menu anchorEl={modMenu} open={!!modMenu} onClose={() => setModMenu(null)}>
            {(Object.keys(MOD_LABEL) as Modified[]).map((m) => (
              <MenuItem key={m} selected={m === modified} onClick={() => { setModified(m); setModMenu(null) }}>{m === 'any' ? 'Any time' : MOD_LABEL[m]}</MenuItem>
            ))}
          </Menu>

          {error && <ErrorBox message={error} />}
          {!data && !error ? <LoadingRows rows={6} height={90} /> : filtered.length === 0 ? (
            <EmptyState title={docs.length ? 'No matching files' : 'Drive is empty here'}
              text={docs.length ? 'Change the filters or search for something else.' : 'Sync Google Drive to pull in documents, sheets, PDFs, images and videos.'}
              action={!docs.length ? <Button variant="contained" onClick={sync} disabled={syncing}>Sync Drive</Button> : undefined} />
          ) : layout === 'grid' ? (
            <Box sx={{ display: 'grid', gap: { xs: 1.2, sm: 2 }, gridTemplateColumns: { xs: 'repeat(2, minmax(0, 1fr))', sm: 'repeat(auto-fill, minmax(200px, 1fr))', lg: 'repeat(auto-fill, minmax(230px, 1fr))' } }}>
              <AnimatePresence>
                {filtered.map((d, i) => <Card key={d.id} doc={d} onOpen={onOpen} index={i} />)}
              </AnimatePresence>
            </Box>
          ) : (
            <Box sx={{ borderRadius: 3, border: `1px solid ${C.line}`, overflow: 'hidden' }}>
              <Stack direction="row" sx={{ px: 2, py: 1.2, fontSize: 12.5, color: C.dim, fontWeight: 700, borderBottom: `1px solid ${C.line}` }}>
                <Box sx={{ flex: 1 }}>Name</Box>
                <Box sx={{ width: 130, display: { xs: 'none', sm: 'block' } }}>Category</Box>
                <Box sx={{ width: 120, display: { xs: 'none', md: 'block' } }}>Type</Box>
                <Box sx={{ width: 110, textAlign: 'right' }}>Last modified</Box>
              </Stack>
              {filtered.map((d) => {
                const k = fileKind(d.mime_type, d.name)
                return (
                  <Stack key={d.id} direction="row" alignItems="center" onClick={() => onOpen(d.id)}
                    sx={{ px: 2, py: 1.2, cursor: 'pointer', borderBottom: `1px solid ${C.line}`, '&:hover': { background: 'rgba(255,255,255,0.04)' }, '&:last-of-type': { borderBottom: 0 } }}>
                    <Stack direction="row" spacing={1.4} alignItems="center" sx={{ flex: 1, minWidth: 0 }}>
                      <KindIcon kind={k} size={22} />
                      <Typography noWrap sx={{ fontSize: 14, fontWeight: 600 }}>{d.name}</Typography>
                    </Stack>
                    <Box sx={{ width: 130, display: { xs: 'none', sm: 'block' } }}>{d.category && <Pill color={CATEGORY_COLORS[d.category]} sx={{ fontSize: 11, py: 0 }}>{d.category}</Pill>}</Box>
                    <Typography sx={{ width: 120, fontSize: 13, color: C.muted, display: { xs: 'none', md: 'block' } }}>{KIND_META[k].label}</Typography>
                    <Typography sx={{ width: 110, textAlign: 'right', fontSize: 13, color: C.muted }}>{mailDate(d.modified_at)}</Typography>
                  </Stack>
                )
              })}
            </Box>
          )}
          {data && <Typography sx={{ mt: 2.5, fontSize: 11.5, color: C.dim }}>Thumbnails and previews come straight from Google Drive and respect the file's sharing permissions. Files without a thumbnail show a text preview instead.</Typography>}
        </Box>
      </Stack>

      <Preview doc={openDoc} onClose={() => setOpenId(null)}
        onPrev={openIdx > 0 ? () => setOpenId(filtered[openIdx - 1].id) : undefined}
        onNext={openIdx >= 0 && openIdx < filtered.length - 1 ? () => setOpenId(filtered[openIdx + 1].id) : undefined} />
    </Box>
  )
}

function ChipButton({ on, children, onClick }: { on: boolean; children: ReactNode; onClick: (e: MouseEvent<HTMLElement>) => void }) {
  return (
    <Button size="small" endIcon={<ExpandMoreRounded />} onClick={onClick} sx={{ borderRadius: 2, px: 1.5, color: on ? '#111' : C.text, background: on ? C.amber : 'transparent', border: `1px solid ${on ? C.amber : C.line}`, '&:hover': { background: on ? C.amber : 'rgba(255,255,255,0.05)' } }}>
      {children}
    </Button>
  )
}
