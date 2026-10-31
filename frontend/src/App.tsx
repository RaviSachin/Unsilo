import { lazy, Suspense, useEffect, type ReactNode } from 'react'
import { BrowserRouter, Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import Box from '@mui/material/Box'
import Shell from './components/layout/Shell'
import { AppProvider, useApp } from './lib/app-context'
import { invalidate } from './lib/api'
import { C } from './theme'

// Each page is its own chunk, so the first load stays small and fast.
const Overview = lazy(() => import('./pages/Overview'))
const Ask = lazy(() => import('./pages/Ask'))
const Connections = lazy(() => import('./pages/Connections'))
const Gmail = lazy(() => import('./pages/Gmail'))
const Drive = lazy(() => import('./pages/Drive'))
const SiteUpdates = lazy(() => import('./pages/SiteUpdates'))
const Reports = lazy(() => import('./pages/Reports'))
const NotFound = lazy(() => import('./pages/NotFound'))

function PageLoader() {
  return (
    <Box sx={{ display: 'grid', placeItems: 'center', height: '50vh' }}>
      <Box sx={{ width: 42, height: 42, borderRadius: '50%', border: `3px solid ${C.line}`, borderTopColor: C.amber, animation: 'spin .8s linear infinite' }} />
    </Box>
  )
}

const page = (el: ReactNode) => <Suspense fallback={<PageLoader />}>{el}</Suspense>

/** Shows a toast after the Google sign-in redirect (/?google=connected or ?google_error=...). */
function OAuthReturn() {
  const { search } = useLocation()
  const navigate = useNavigate()
  const { toast, refreshHealth } = useApp()
  useEffect(() => {
    const q = new URLSearchParams(search)
    if (q.get('google') === 'connected') {
      toast('Google connected. Now sync Gmail and Drive.')
      refreshHealth()
      navigate('/connections', { replace: true })
    } else if (q.get('google_error')) {
      toast(`Google sign-in failed: ${q.get('google_error')}`, 'error')
      navigate('/connections', { replace: true })
    }
  }, [search, toast, refreshHealth, navigate])
  return null
}

/** Ctrl/Cmd + K jumps to Ask from anywhere. */
function Shortcuts() {
  const navigate = useNavigate()
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        navigate('/ask', { state: { focus: Date.now() } })
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])
  return null
}

export default function App() {
  useEffect(() => {
    // warm the data the dashboard needs while the first chunk renders
    invalidate('/api/health')
  }, [])
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AppProvider>
        <OAuthReturn />
        <Shortcuts />
        <Routes>
          <Route element={<Shell />}>
            <Route index element={page(<Overview />)} />
            <Route path="ask" element={page(<Ask />)} />
            <Route path="connections" element={page(<Connections />)} />
            <Route path="gmail" element={page(<Gmail />)} />
            <Route path="drive" element={page(<Drive />)} />
            <Route path="site-updates" element={page(<SiteUpdates />)} />
            <Route path="reports" element={page(<Reports />)} />
            <Route path="*" element={page(<NotFound />)} />
          </Route>
        </Routes>
      </AppProvider>
    </BrowserRouter>
  )
}
