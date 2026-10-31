import { Component, type ErrorInfo, type ReactNode } from 'react'
import Box from '@mui/material/Box'
import Typography from '@mui/material/Typography'
import Button from '@mui/material/Button'
import { C } from '../theme'

type State = { error: Error | null }

/** Keeps one broken page from blanking the whole app; shows the error and a retry button instead. */
export default class ErrorBoundary extends Component<{ children: ReactNode }, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Unsilo page error:', error, info.componentStack)
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <Box sx={{ p: { xs: 2.5, md: 4 }, borderRadius: 4, border: `1px solid ${C.red}55`, background: `${C.red}10`, maxWidth: 760, mx: 'auto', mt: 4 }}>
        <Typography variant="h5" sx={{ mb: 1 }}>This page hit a snag 🚧</Typography>
        <Typography sx={{ color: C.muted, mb: 2 }}>The rest of Unsilo still works. Retry, or open another page from the menu.</Typography>
        <Box component="pre" className="mono" sx={{ p: 1.5, borderRadius: 2, background: '#0b0b0e', color: '#ffc2cc', fontSize: 12, whiteSpace: 'pre-wrap', wordBreak: 'break-word', mb: 2 }}>
          {this.state.error.message}
        </Box>
        <Button variant="contained" onClick={() => this.setState({ error: null })}>Try again</Button>
      </Box>
    )
  }
}
