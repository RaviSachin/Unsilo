import { alpha, createTheme } from '@mui/material/styles'

// Site-safety palette: charcoal steel, hi-vis amber, hazard yellow, plus a lime "all good" pop.
export const C = {
  bg: '#09090b',
  panel: '#121216',
  panel2: '#17171c',
  line: 'rgba(255,255,255,0.08)',
  text: '#f4f4f5',
  muted: '#a1a1aa',
  dim: '#71717a',
  amber: '#ff9f1c',
  orange: '#ff6b1a',
  hazard: '#ffd60a',
  lime: '#c6f432',
  pink: '#f72585',
  sky: '#4cc9f0',
  red: '#ff4d6d',
}

export const GRADIENT = `linear-gradient(100deg, ${C.hazard} 0%, ${C.amber} 45%, ${C.orange} 100%)`

export const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: { main: C.amber, contrastText: '#120a00' },
    secondary: { main: C.lime, contrastText: '#0e1200' },
    error: { main: C.red },
    warning: { main: C.hazard },
    info: { main: C.sky },
    success: { main: C.lime },
    background: { default: C.bg, paper: C.panel },
    text: { primary: C.text, secondary: C.muted },
    divider: C.line,
  },
  shape: { borderRadius: 14 },
  typography: {
    fontFamily: '"Inter", system-ui, -apple-system, "Segoe UI", sans-serif',
    h1: { fontFamily: '"Bricolage Grotesque", "Inter", sans-serif', fontWeight: 800, letterSpacing: '-0.035em' },
    h2: { fontFamily: '"Bricolage Grotesque", "Inter", sans-serif', fontWeight: 800, letterSpacing: '-0.03em' },
    h3: { fontFamily: '"Bricolage Grotesque", "Inter", sans-serif', fontWeight: 700, letterSpacing: '-0.025em' },
    h4: { fontFamily: '"Bricolage Grotesque", "Inter", sans-serif', fontWeight: 700, letterSpacing: '-0.02em' },
    h5: { fontFamily: '"Bricolage Grotesque", "Inter", sans-serif', fontWeight: 700 },
    h6: { fontFamily: '"Bricolage Grotesque", "Inter", sans-serif', fontWeight: 700 },
    overline: { fontWeight: 800, letterSpacing: '0.22em', fontSize: 11 },
    button: { textTransform: 'none', fontWeight: 700 },
  },
  components: {
    MuiCssBaseline: {
      styleOverrides: {
        body: { backgroundColor: C.bg },
      },
    },
    MuiPaper: {
      styleOverrides: {
        root: { backgroundImage: 'none', border: `1px solid ${C.line}` },
      },
    },
    MuiButton: {
      defaultProps: { disableElevation: true },
      styleOverrides: {
        root: { borderRadius: 12, paddingInline: 18 },
        containedPrimary: {
          background: GRADIENT,
          color: '#140b00',
          boxShadow: `0 8px 30px ${alpha(C.amber, 0.25)}`,
          '&:hover': { background: GRADIENT, filter: 'brightness(1.08)', boxShadow: `0 10px 36px ${alpha(C.amber, 0.4)}` },
        },
        outlined: { borderColor: C.line, color: C.text, '&:hover': { borderColor: alpha(C.amber, 0.6), background: alpha(C.amber, 0.06) } },
      },
    },
    MuiChip: {
      styleOverrides: {
        root: { fontWeight: 600, borderRadius: 999 },
        outlined: { borderColor: C.line },
      },
    },
    MuiTooltip: {
      styleOverrides: { tooltip: { background: '#1f1f25', border: `1px solid ${C.line}`, fontSize: 12 } },
    },
    MuiDialog: {
      styleOverrides: { paper: { background: C.panel, borderRadius: 20 } },
    },
    MuiTab: { styleOverrides: { root: { textTransform: 'none', fontWeight: 600, minHeight: 44 } } },
    MuiOutlinedInput: {
      styleOverrides: {
        root: { borderRadius: 12, background: alpha('#fff', 0.03) },
        notchedOutline: { borderColor: C.line },
      },
    },
    MuiMenu: { styleOverrides: { paper: { background: '#18181d' } } },
  },
})
