import { useEffect, useRef } from 'react'
import Box, { type BoxProps } from '@mui/material/Box'

type Props = BoxProps & {
  /** stars per 10,000 px² */
  density?: number
  shooting?: boolean
  color?: string
}

type Star = { x: number; y: number; r: number; vx: number; vy: number; tw: number; ph: number }
type Shot = { x: number; y: number; len: number; v: number; life: number }

/**
 * Floating, twinkling stars with the odd shooting star (Aceternity "Stars background" + "Shooting stars" idea),
 * drawn on one canvas. Pauses when the tab is hidden and goes static for reduced-motion users.
 */
export default function StarField({ density = 1.1, shooting = true, color = '255, 214, 140', sx, ...rest }: Props) {
  const ref = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = ref.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    let w = 0
    let h = 0
    let stars: Star[] = []
    let shots: Shot[] = []
    let raf = 0
    let last = performance.now()

    const resize = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2)
      const rect = canvas.getBoundingClientRect()
      w = rect.width
      h = rect.height
      canvas.width = Math.max(1, w * dpr)
      canvas.height = Math.max(1, h * dpr)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      const count = Math.min(420, Math.round(((w * h) / 10000) * density))
      stars = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.3 + 0.2,
        vx: (Math.random() - 0.5) * 0.06,
        vy: -Math.random() * 0.12 - 0.02,
        tw: Math.random() * 0.002 + 0.0008,
        ph: Math.random() * Math.PI * 2,
      }))
    }

    const draw = (now: number) => {
      const dt = Math.min(48, now - last)
      last = now
      ctx.clearRect(0, 0, w, h)
      for (const s of stars) {
        if (!reduce) {
          s.x += s.vx * dt * 0.06
          s.y += s.vy * dt * 0.06
          if (s.y < -2) (s.y = h + 2), (s.x = Math.random() * w)
          if (s.x < -2) s.x = w + 2
          if (s.x > w + 2) s.x = -2
        }
        const a = 0.35 + 0.65 * Math.abs(Math.sin(s.ph + now * s.tw))
        ctx.beginPath()
        ctx.fillStyle = `rgba(${color}, ${a * 0.85})`
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fill()
      }
      if (shooting && !reduce) {
        if (Math.random() < 0.004 && shots.length < 2)
          shots.push({ x: Math.random() * w * 0.8, y: Math.random() * h * 0.4, len: 90 + Math.random() * 90, v: 0.6 + Math.random() * 0.5, life: 1 })
        shots = shots.filter((sh) => sh.life > 0)
        for (const sh of shots) {
          sh.x += sh.v * dt
          sh.y += sh.v * dt * 0.45
          sh.life -= dt / 1400
          const g = ctx.createLinearGradient(sh.x, sh.y, sh.x - sh.len, sh.y - sh.len * 0.45)
          g.addColorStop(0, `rgba(255, 230, 170, ${sh.life})`)
          g.addColorStop(1, 'rgba(255, 159, 28, 0)')
          ctx.strokeStyle = g
          ctx.lineWidth = 1.6
          ctx.beginPath()
          ctx.moveTo(sh.x, sh.y)
          ctx.lineTo(sh.x - sh.len, sh.y - sh.len * 0.45)
          ctx.stroke()
        }
      }
      if (!reduce) raf = requestAnimationFrame(draw)
    }

    const ro = new ResizeObserver(resize)
    ro.observe(canvas)
    resize()
    raf = requestAnimationFrame(draw)
    const onVis = () => {
      cancelAnimationFrame(raf)
      if (!document.hidden) {
        last = performance.now()
        raf = requestAnimationFrame(draw)
      }
    }
    document.addEventListener('visibilitychange', onVis)
    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      document.removeEventListener('visibilitychange', onVis)
    }
  }, [density, shooting, color])

  return (
    <Box
      component="canvas"
      ref={ref}
      aria-hidden
      sx={{ position: 'absolute', inset: 0, width: '100%', height: '100%', pointerEvents: 'none', ...sx }}
      {...rest}
    />
  )
}
