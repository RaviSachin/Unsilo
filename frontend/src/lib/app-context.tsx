import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react'
import Snackbar from '@mui/material/Snackbar'
import Alert from '@mui/material/Alert'
import { useApi } from './api'
import type { Health } from './types'

type Toast = { text: string; kind: 'success' | 'error' | 'info' }
type Ctx = {
  health?: Health
  healthError: string | null
  refreshHealth: () => Promise<unknown>
  toast: (text: string, kind?: Toast['kind']) => void
}

const AppCtx = createContext<Ctx | null>(null)

export function AppProvider({ children }: { children: ReactNode }) {
  const { data, error, refresh } = useApi<Health>('/api/health', 20000)
  const [toastState, setToast] = useState<Toast | null>(null)
  const toast = useCallback((text: string, kind: Toast['kind'] = 'success') => setToast({ text, kind }), [])
  const value = useMemo(() => ({ health: data, healthError: error, refreshHealth: refresh, toast }), [data, error, refresh, toast])
  return (
    <AppCtx.Provider value={value}>
      {children}
      <Snackbar open={!!toastState} autoHideDuration={4200} onClose={() => setToast(null)} anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}>
        <Alert severity={toastState?.kind ?? 'info'} variant="filled" onClose={() => setToast(null)} sx={{ fontWeight: 600, borderRadius: 3 }}>
          {toastState?.text}
        </Alert>
      </Snackbar>
    </AppCtx.Provider>
  )
}

export function useApp(): Ctx {
  const ctx = useContext(AppCtx)
  if (!ctx) throw new Error('useApp must be used inside AppProvider')
  return ctx
}
