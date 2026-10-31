import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { animate, AnimatePresence, motion, useInView } from 'framer-motion'
import Box, { type BoxProps } from '@mui/material/Box'
import { C } from '../../theme'

/* ------------------------------------------------------------------ Spotlight */
/** Aceternity "Spotlight": a soft beam of light sweeping in from the corner. */
export function Spotlight({ fill = C.amber, sx }: { fill?: string; sx?: BoxProps['sx'] }) {
  return (
    <Box
      component={motion.svg}
      initial={{ opacity: 0, x: -120, y: -80 }}
      animate={{ opacity: 1, x: 0, y: 0 }}
      transition={{ duration: 1.6, ease: 'easeOut', delay: 0.2 }}
      viewBox="0 0 3787 2842"
      fill="none"
      aria-hidden
      sx={{ position: 'absolute', pointerEvents: 'none', width: { xs: '180%', md: '120%' }, height: 'auto', top: { xs: -160, md: -260 }, left: { xs: -200, md: -120 }, zIndex: 0, ...sx }}
    >
      <g filter="url(#spot-blur)">
        <ellipse cx="1924.71" cy="273.501" rx="1924.71" ry="273.501" transform="matrix(-0.822377 -0.568943 -0.568943 0.822377 3631.88 2291.09)" fill={fill} fillOpacity="0.16" />
      </g>
      <defs>
        <filter id="spot-blur" x="0.860352" y="0.838989" width="3785.16" height="2840.26" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
          <feFlood floodOpacity="0" result="BackgroundImageFix" />
          <feBlend mode="normal" in="SourceGraphic" in2="BackgroundImageFix" result="shape" />
          <feGaussianBlur stdDeviation="151" result="effect1_foregroundBlur" />
        </filter>
      </defs>
    </Box>
  )
}

/* ------------------------------------------------------------ Background beams */
const BEAMS = [
  'M-380 -189C-380 -189 -312 216 152 343C616 470 684 875 684 875',
  'M-338 -237C-338 -237 -270 168 194 295C658 422 726 827 726 827',
  'M-296 -285C-296 -285 -228 120 236 247C700 374 768 779 768 779',
  'M-254 -333C-254 -333 -186 72 278 199C742 326 810 731 810 731',
  'M-212 -381C-212 -381 -144 24 320 151C784 278 852 683 852 683',
  'M-170 -429C-170 -429 -102 -24 362 103C826 230 894 635 894 635',
]

/** Aceternity "Background beams": light pulses travelling along curved paths. */
export function BackgroundBeams({ sx }: { sx?: BoxProps['sx'] }) {
  return (
    <Box component="svg" viewBox="0 0 696 316" fill="none" aria-hidden preserveAspectRatio="xMidYMid slice"
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', opacity: 0.7, ...sx }}>
      {BEAMS.map((d, i) => (
        <path key={`b${i}`} d={d} stroke="rgba(255,255,255,0.045)" strokeWidth="0.6" />
      ))}
      {BEAMS.map((d, i) => (
        <motion.path key={`a${i}`} d={d} stroke={`url(#beam-${i})`} strokeWidth="1.1" strokeLinecap="round" />
      ))}
      <defs>
        {BEAMS.map((_, i) => (
          <motion.linearGradient key={i} id={`beam-${i}`} gradientUnits="userSpaceOnUse"
            initial={{ x1: '0%', x2: '0%', y1: '0%', y2: '0%' }}
            animate={{ x1: ['0%', '100%'], x2: ['0%', '95%'], y1: ['0%', '100%'], y2: ['0%', `${93 + i}%`] }}
            transition={{ duration: 7 + i * 1.3, ease: 'easeInOut', repeat: Infinity, delay: i * 0.9 }}>
            <stop stopColor={C.hazard} stopOpacity="0" />
            <stop stopColor={C.hazard} />
            <stop offset="32.5%" stopColor={C.amber} />
            <stop offset="100%" stopColor={C.orange} stopOpacity="0" />
          </motion.linearGradient>
        ))}
      </defs>
    </Box>
  )
}

/* ----------------------------------------------------------------- Meteors */
/** Aceternity "Meteors": small streaks falling across a card. */
export function Meteors({ count = 12 }: { count?: number }) {
  const meteors = useMemo(
    () => Array.from({ length: count }, () => ({ left: Math.random() * 100, delay: Math.random() * 6, dur: 3 + Math.random() * 6 })),
    [count],
  )
  return (
    <Box aria-hidden sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
      {meteors.map((m, i) => (
        <Box key={i} sx={{
          position: 'absolute', top: -10, left: `${m.left}%`, width: 2, height: 2, borderRadius: 9,
          background: C.hazard, boxShadow: `0 0 0 1px rgba(255,255,255,0.05)`, transform: 'rotate(215deg)',
          animation: `meteor ${m.dur}s linear ${m.delay}s infinite`,
          '&::before': { content: '""', position: 'absolute', top: '50%', width: 70, height: 1, transform: 'translateY(-50%)', background: `linear-gradient(90deg, ${C.amber}, transparent)` },
          '@keyframes meteor': {
            '0%': { transform: 'rotate(215deg) translateX(0)', opacity: 1 },
            '70%': { opacity: 1 },
            '100%': { transform: 'rotate(215deg) translateX(-600px)', opacity: 0 },
          },
        }} />
      ))}
    </Box>
  )
}

/* ------------------------------------------------------------- Glow card */
/** Aceternity "Card spotlight": a radial glow that follows the cursor. No re-renders on mouse move. */
export function GlowCard({ children, sx, glow = C.amber, ...rest }: BoxProps & { glow?: string }) {
  const ref = useRef<HTMLDivElement>(null)
  return (
    <Box
      ref={ref}
      onMouseMove={(e) => {
        const r = ref.current?.getBoundingClientRect()
        if (!r || !ref.current) return
        ref.current.style.setProperty('--mx', `${e.clientX - r.left}px`)
        ref.current.style.setProperty('--my', `${e.clientY - r.top}px`)
      }}
      sx={{
        position: 'relative', overflow: 'hidden', borderRadius: 4, border: `1px solid ${C.line}`,
        background: `linear-gradient(180deg, ${C.panel2}, ${C.panel})`,
        transition: 'border-color .25s, transform .25s',
        '&::before': {
          content: '""', position: 'absolute', inset: 0, opacity: 0, transition: 'opacity .3s', pointerEvents: 'none',
          background: `radial-gradient(420px circle at var(--mx, 50%) var(--my, 50%), ${glow}22, transparent 45%)`,
        },
        '&:hover': { borderColor: `${glow}55` },
        '&:hover::before': { opacity: 1 },
        ...sx,
      }}
      {...rest}
    >
      {children}
    </Box>
  )
}

/* ---------------------------------------------------------- Moving border */
/** Aceternity "Moving border": a bright segment orbiting the edge of a box. */
export function MovingBorder({ children, active = true, radius = 18, sx, color = C.amber }: {
  children: ReactNode; active?: boolean; radius?: number; sx?: BoxProps['sx']; color?: string
}) {
  return (
    <Box sx={{ position: 'relative', borderRadius: `${radius}px`, p: '1px', overflow: 'hidden', background: C.line, ...sx }}>
      {active && (
        <Box aria-hidden sx={{
          position: 'absolute', inset: '-60%',
          background: `conic-gradient(from 0deg, transparent 0 300deg, ${color} 330deg, ${C.hazard} 345deg, transparent 360deg)`,
          animation: 'spin 4.5s linear infinite',
        }} />
      )}
      <Box sx={{ position: 'relative', borderRadius: `${radius - 1}px`, background: `linear-gradient(180deg, ${C.panel2}, ${C.panel})`, height: '100%' }}>
        {children}
      </Box>
    </Box>
  )
}

/* ---------------------------------------------------------- Number ticker */
export function NumberTicker({ value, duration = 1.4 }: { value: number; duration?: number }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  useEffect(() => {
    if (!inView || !ref.current) return
    const node = ref.current
    const from = Number(node.dataset.v || 0)
    const controls = animate(from, value, {
      duration, ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => { node.textContent = Math.round(v).toLocaleString() },
    })
    node.dataset.v = String(value)
    return () => controls.stop()
  }, [inView, value, duration])
  return <span ref={ref}>0</span>
}

/* ------------------------------------------------------------ Flip words */
export function FlipWords({ words, interval = 2400, sx }: { words: string[]; interval?: number; sx?: BoxProps['sx'] }) {
  const [i, setI] = useState(0)
  useEffect(() => {
    const t = window.setInterval(() => setI((v) => (v + 1) % words.length), interval)
    return () => window.clearInterval(t)
  }, [words.length, interval])
  return (
    <Box component="span" sx={{ position: 'relative', display: 'inline-block', ...sx }}>
      <AnimatePresence mode="wait">
        <motion.span key={words[i]} className="gradient-text" style={{ display: 'inline-block' }}
          initial={{ opacity: 0, y: 18, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -22, filter: 'blur(8px)', scale: 1.4, position: 'absolute' }}
          transition={{ type: 'spring', stiffness: 120, damping: 14 }}>
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </Box>
  )
}

/* ---------------------------------------------------------- Text generate */
/**
 * Aceternity "Text generate effect": words fade in one after another.
 * `renderWord` lets callers swap tokens (like citations) for components.
 */
export function TextGenerate({ text, renderWord, speed = 0.018 }: {
  text: string; renderWord?: (word: string, key: string) => ReactNode; speed?: number
}) {
  const lines = useMemo(() => text.split('\n'), [text])
  let n = 0
  return (
    <Box component="div">
      {lines.map((line, li) => (
        <Box key={li} component="div" sx={{ minHeight: line.trim() ? undefined : 10, pl: /^\s*[-•]\s/.test(line) ? 2 : 0, textIndent: /^\s*[-•]\s/.test(line) ? '-12px' : 0, mb: 0.4 }}>
          {line.split(/(\s+)/).map((w, wi) => {
            if (!w.trim()) return w
            const delay = Math.min(n++ * speed, 2.2)
            const word = w.replace(/^-$/, '•')
            return (
              <motion.span key={`${li}-${wi}`} initial={{ opacity: 0, filter: 'blur(6px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.35, delay }} style={{ display: 'inline' }}>
                {renderWord ? renderWord(word, `${li}-${wi}`) : word}
              </motion.span>
            )
          })}
        </Box>
      ))}
    </Box>
  )
}

/* ----------------------------------------------------------- Hover grid */
/** Aceternity "Card hover effect": a highlight that glides between items. */
export function HoverGrid<T>({ items, render, onPick, columns = { xs: 1, sm: 2 } }: {
  items: T[]; render: (item: T) => ReactNode; onPick?: (item: T) => void; columns?: Record<string, number>
}) {
  const [hover, setHover] = useState<number | null>(null)
  const cols = Object.fromEntries(Object.entries(columns).map(([k, v]) => [k, `repeat(${v}, 1fr)`]))
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: cols, gap: 1 }}>
      {items.map((item, i) => (
        <Box key={i} onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} onClick={() => onPick?.(item)}
          sx={{ position: 'relative', p: 0.75, cursor: onPick ? 'pointer' : 'default' }}>
          <AnimatePresence>
            {hover === i && (
              <motion.span layoutId="hover-grid-bg" initial={{ opacity: 0 }} animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.1 } }}
                style={{ position: 'absolute', inset: 0, borderRadius: 18, background: 'rgba(255,159,28,0.10)', display: 'block' }} />
            )}
          </AnimatePresence>
          <Box sx={{ position: 'relative', zIndex: 1, height: '100%' }}>{render(item)}</Box>
        </Box>
      ))}
    </Box>
  )
}

/* -------------------------------------------------------------- Marquee */
export function Marquee({ children, speed = 40 }: { children: ReactNode; speed?: number }) {
  return (
    <Box sx={{ overflow: 'hidden', maskImage: 'linear-gradient(90deg, transparent, black 10%, black 90%, transparent)' }}>
      <Box sx={{ display: 'flex', width: 'max-content', animation: `marquee ${speed}s linear infinite` }}>
        <Box sx={{ display: 'flex' }}>{children}</Box>
        <Box sx={{ display: 'flex' }} aria-hidden>{children}</Box>
      </Box>
    </Box>
  )
}
