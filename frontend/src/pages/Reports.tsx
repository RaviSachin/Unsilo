import { useMemo, useState, type ReactNode } from 'react'
import { motion } from 'framer-motion'
import Box from '@mui/material/Box'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import IconButton from '@mui/material/IconButton'
import Tooltip from '@mui/material/Tooltip'
import DownloadRounded from '@mui/icons-material/DownloadRounded'
import ContentCopyRounded from '@mui/icons-material/ContentCopyRounded'
import MailRounded from '@mui/icons-material/MailRounded'
import DescriptionRounded from '@mui/icons-material/DescriptionRounded'
import ChatRounded from '@mui/icons-material/ChatRounded'
import RocketLaunchRounded from '@mui/icons-material/RocketLaunchRounded'
import FileDownloadRounded from '@mui/icons-material/FileDownloadRounded'
import { GlowCard } from '../components/aceternity/Effects'
import { ErrorBox, LoadingRows, PageHeader, Pill } from '../components/ui'
import { api, post, useApi } from '../lib/api'
import { downloadJson } from '../lib/email'
import { useApp } from '../lib/app-context'
import { C } from '../theme'

type Name = 'gmail' | 'drive' | 'whatsapp'
const META: Record<Name, { file: string; icon: ReactNode; color: string; desc: string }> = {
  gmail: { file: 'gmail_output.json', icon: <MailRounded />, color: '#ff6b6b', desc: 'Team labels, unanswered emails, critical attachments' },
  drive: { file: 'drive_output.json', icon: <DescriptionRounded />, color: C.sky, desc: 'One category per document, with a reason' },
  whatsapp: { file: 'whatsapp_output.json', icon: <ChatRounded />, color: '#25d366', desc: 'Groups, messages, summary, decisions, actions' },
}

/** Small JSON syntax highlighter (keys, strings, numbers, literals) without a dependency. */
function highlight(json: string): ReactNode[] {
  const out: ReactNode[] = []
  const re = /("(?:\\.|[^"\\])*")(\s*:)?|\b(true|false|null)\b|(-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g
  let last = 0
  let m: RegExpExecArray | null
  let k = 0
  while ((m = re.exec(json))) {
    if (m.index > last) out.push(json.slice(last, m.index))
    if (m[1]) out.push(<span key={k++} style={{ color: m[2] ? C.amber : C.lime }}>{m[1]}</span>, m[2] ?? '')
    else if (m[3]) out.push(<span key={k++} style={{ color: C.pink }}>{m[3]}</span>)
    else out.push(<span key={k++} style={{ color: C.sky }}>{m[4]}</span>)
    last = re.lastIndex
  }
  out.push(json.slice(last))
  return out
}

export default function Reports() {
  const [name, setName] = useState<Name>('gmail')
  const { data, error, refresh } = useApi<unknown>(`/api/outputs/${name}`)
  const { toast } = useApp()
  const [busy, setBusy] = useState(false)
  const text = useMemo(() => (data === undefined ? '' : JSON.stringify(data, null, 2)), [data])
  const shown = text.length > 200_000 ? `${text.slice(0, 200_000)}\n… (truncated in preview, download for the full file)` : text
  const nodes = useMemo(() => highlight(shown), [shown])

  const generate = async () => {
    setBusy(true)
    try {
      const r = await post<{ written: string[] }>('/api/export')
      toast(`Wrote ${r.written.length} files to outputs/`)
      refresh()
    } catch (e) {
      toast((e as Error).message, 'error')
    } finally {
      setBusy(false)
    }
  }
  const download = () => {
    downloadJson(META[name].file, text)
    toast(`Downloaded ${META[name].file}`)
  }
  const downloadAll = async () => {
    try {
      for (const n of Object.keys(META) as Name[]) {
        downloadJson(META[n].file, await api(`/api/outputs/${n}`))
        await new Promise((r) => window.setTimeout(r, 350)) // browsers block rapid multi-downloads
      }
      toast('Downloaded all 3 JSON files')
    } catch (e) {
      toast((e as Error).message, 'error')
    }
  }

  return (
    <Box>
      <PageHeader kicker="Exports & handoffs" title="Make the work portable."
        subtitle="Preview the structured outputs and regenerate the JSON files from your current data."
        right={
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.2} sx={{ width: { xs: '100%', md: 'auto' } }}>
            <Button variant="outlined" size="large" startIcon={<FileDownloadRounded />} onClick={downloadAll}>Download all JSON</Button>
            <Button variant="contained" size="large" startIcon={<RocketLaunchRounded />} disabled={busy} onClick={generate}>{busy ? 'Generating…' : 'Generate all reports'}</Button>
          </Stack>
        } />

      <Box sx={{ display: 'grid', gap: 2, gridTemplateColumns: { xs: '1fr', md: 'repeat(3, 1fr)' }, mb: 2.5 }}>
        {(Object.keys(META) as Name[]).map((n) => (
          <GlowCard key={n} glow={META[n].color} onClick={() => setName(n)} sx={{ p: 2.5, cursor: 'pointer', borderColor: name === n ? `${META[n].color}88` : undefined }}>
            <Stack direction="row" spacing={1.5} alignItems="center">
              <Box sx={{ width: 44, height: 44, borderRadius: 2.5, display: 'grid', placeItems: 'center', color: META[n].color, background: `${META[n].color}1a` }}>{META[n].icon}</Box>
              <Box sx={{ minWidth: 0 }}>
                <Typography className="mono" sx={{ fontWeight: 600, fontSize: 14 }}>{META[n].file}</Typography>
                <Typography sx={{ fontSize: 12.5, color: C.dim }}>{META[n].desc}</Typography>
              </Box>
            </Stack>
            {name === n && <motion.div layoutId="report-active" style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 3, background: META[n].color }} />}
          </GlowCard>
        ))}
      </Box>

      <Box sx={{ borderRadius: 5, border: `1px solid ${C.line}`, background: '#0b0b0e', overflow: 'hidden' }}>
        <Stack direction="row" alignItems="center" spacing={1} sx={{ px: 2, py: 1.2, borderBottom: `1px solid ${C.line}` }}>
          <Stack direction="row" spacing={0.8}>{['#ff5f57', '#febc2e', '#28c840'].map((c) => <Box key={c} sx={{ width: 11, height: 11, borderRadius: '50%', background: c }} />)}</Stack>
          <Typography className="mono" noWrap sx={{ flex: 1, minWidth: 0, fontSize: 13, color: C.muted, ml: 1 }}>outputs/{META[name].file}</Typography>
          <Pill color={C.dim} sx={{ fontSize: 11, display: { xs: 'none', sm: 'inline-flex' } }}>{(text.length / 1024).toFixed(1)} KB</Pill>
          <Tooltip title="Copy JSON"><IconButton size="small" onClick={() => { navigator.clipboard?.writeText(text); toast('JSON copied') }}><ContentCopyRounded fontSize="small" /></IconButton></Tooltip>
          <Button size="small" variant="contained" startIcon={<DownloadRounded />} onClick={download} disabled={!text} sx={{ display: { xs: 'none', sm: 'inline-flex' } }}>Download JSON</Button>
          <Tooltip title="Download JSON"><span><IconButton size="small" onClick={download} disabled={!text} sx={{ display: { xs: 'inline-flex', sm: 'none' } }}><DownloadRounded fontSize="small" /></IconButton></span></Tooltip>
        </Stack>
        {error && <Box sx={{ p: 2 }}><ErrorBox message={error} /></Box>}
        {data === undefined && !error ? <Box sx={{ p: 2 }}><LoadingRows rows={8} height={20} /></Box> : (
          <Box component="pre" className="mono" sx={{ m: 0, p: { xs: 1.5, sm: 2.5 }, fontSize: { xs: 11, sm: 12.5 }, lineHeight: 1.65, maxHeight: { xs: 480, md: 620 }, overflow: 'auto', color: '#d4d4d8' }}>{nodes}</Box>
        )}
      </Box>
    </Box>
  )
}
