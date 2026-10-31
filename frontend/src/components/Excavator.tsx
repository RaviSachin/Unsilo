import { motion } from 'framer-motion'
import Box from '@mui/material/Box'

const dig = { duration: 4.2, repeat: Infinity, ease: 'easeInOut' as const }

/** Animated excavator: boom lifts, arm curls, bucket scoops, tracks roll, dirt flies. Pure SVG + framer-motion. */
export default function Excavator({ size = 420 }: { size?: number }) {
  return (
    <Box sx={{ width: size, maxWidth: '100%', aspectRatio: '420 / 300', position: 'relative', animation: 'float-y 6s ease-in-out infinite' }}>
      <svg viewBox="0 0 420 300" width="100%" height="100%" aria-label="Animated excavator" role="img">
        <defs>
          <linearGradient id="ex-body" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#ffd60a" />
            <stop offset="1" stopColor="#ff9f1c" />
          </linearGradient>
          <linearGradient id="ex-dark" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#2b2b31" />
            <stop offset="1" stopColor="#141417" />
          </linearGradient>
          <linearGradient id="ex-glass" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#4cc9f0" stopOpacity="0.55" />
            <stop offset="1" stopColor="#0b132b" stopOpacity="0.9" />
          </linearGradient>
          <radialGradient id="ex-shadow">
            <stop offset="0" stopColor="#000" stopOpacity="0.55" />
            <stop offset="1" stopColor="#000" stopOpacity="0" />
          </radialGradient>
          <filter id="ex-glow"><feGaussianBlur stdDeviation="6" /></filter>
        </defs>

        {/* ground + shadow */}
        <ellipse cx="200" cy="268" rx="170" ry="16" fill="url(#ex-shadow)" />
        <ellipse cx="300" cy="250" rx="60" ry="22" fill="#ff9f1c" opacity="0.18" filter="url(#ex-glow)" />

        {/* dirt pile */}
        <path d="M300 262 Q330 220 362 262 Z" fill="#6b4423" />
        <path d="M312 262 Q332 236 352 262 Z" fill="#8a5a2b" />

        {/* tracks */}
        <g>
          <rect x="70" y="222" width="190" height="40" rx="20" fill="url(#ex-dark)" stroke="#3a3a42" />
          <clipPath id="ex-track"><rect x="70" y="222" width="190" height="40" rx="20" /></clipPath>
          <g clipPath="url(#ex-track)">
            <motion.g animate={{ x: [0, -14] }} transition={{ duration: 0.6, repeat: Infinity, ease: 'linear' }}>
              {Array.from({ length: 16 }, (_, i) => (
                <rect key={i} x={74 + i * 14} y="223" width="6" height="5" rx="1" fill="#55555f" />
              ))}
            </motion.g>
          </g>
          {[95, 135, 175, 215, 238].map((cx, i) => (
            <motion.g key={i} style={{ originX: `${cx}px`, originY: '242px' }} animate={{ rotate: 360 }}
              transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}>
              <circle cx={cx} cy="242" r={i === 4 ? 13 : 11} fill="#1d1d22" stroke="#4b4b55" strokeWidth="2" />
              <line x1={cx - 7} y1="242" x2={cx + 7} y2="242" stroke="#6b6b75" strokeWidth="2" />
            </motion.g>
          ))}
        </g>

        {/* turntable + body */}
        <rect x="100" y="205" width="130" height="18" rx="6" fill="#1f1f24" />
        <path d="M85 150 h120 l18 22 v38 h-150 v-48 z" fill="url(#ex-body)" stroke="#b86e00" strokeWidth="1.5" />
        <rect x="80" y="196" width="150" height="12" rx="4" fill="#e08a00" />
        {/* hazard stripe */}
        <g clipPath="url(#ex-clip)">
          <clipPath id="ex-clip"><rect x="88" y="186" width="58" height="8" rx="2" /></clipPath>
          {Array.from({ length: 8 }, (_, i) => (
            <rect key={i} x={84 + i * 10} y="182" width="5" height="16" fill="#111" transform={`skewX(-35)`} />
          ))}
        </g>
        {/* counterweight + exhaust */}
        <rect x="66" y="160" width="26" height="46" rx="6" fill="#d98200" />
        <rect x="104" y="128" width="7" height="24" rx="2" fill="#2a2a30" />
        {[0, 1, 2].map((i) => (
          <motion.circle key={i} cx="107" cy="122" r="6" fill="#9ca3af"
            initial={{ opacity: 0, y: 0, scale: 0.4 }}
            animate={{ opacity: [0, 0.35, 0], y: [-2, -46], x: [0, -14], scale: [0.4, 1.8] }}
            transition={{ duration: 2.6, repeat: Infinity, delay: i * 0.85, ease: 'easeOut' }} />
        ))}
        {/* cab */}
        <path d="M150 112 h38 q8 0 10 8 l8 42 h-56 z" fill="url(#ex-body)" stroke="#b86e00" strokeWidth="1.5" />
        <path d="M157 120 h28 q5 0 6 5 l6 30 h-40 z" fill="url(#ex-glass)" />
        <motion.rect x="160" y="124" width="5" height="26" rx="2" fill="#fff" opacity="0.25"
          animate={{ x: [160, 186, 160] }} transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut' }} />
        {/* beacon */}
        <rect x="170" y="104" width="10" height="8" rx="2" fill="#2a2a30" />
        <motion.circle cx="175" cy="102" r="5" fill="#ff6b1a" animate={{ opacity: [1, 0.25, 1] }} transition={{ duration: 0.9, repeat: Infinity }} />
        <motion.circle cx="175" cy="102" r="14" fill="#ff6b1a" filter="url(#ex-glow)" animate={{ opacity: [0.6, 0, 0.6] }} transition={{ duration: 0.9, repeat: Infinity }} />

        {/* boom → arm → bucket (nested so each joint rides on the one before) */}
        <motion.g style={{ originX: '205px', originY: '168px' }} animate={{ rotate: [0, -16, -4, 8, 0] }} transition={dig}>
          <path d="M200 172 L268 92 L282 100 L214 182 Z" fill="url(#ex-body)" stroke="#b86e00" strokeWidth="1.5" />
          <rect x="222" y="128" width="40" height="6" rx="3" fill="#9aa0a6" transform="rotate(-50 242 131)" />
          <circle cx="205" cy="174" r="7" fill="#2a2a30" stroke="#55555f" strokeWidth="2" />
          <motion.g style={{ originX: '275px', originY: '96px' }} animate={{ rotate: [0, 18, 44, 20, 0] }} transition={dig}>
            <path d="M270 92 L338 150 L330 162 L262 104 Z" fill="url(#ex-body)" stroke="#b86e00" strokeWidth="1.5" />
            <circle cx="275" cy="96" r="7" fill="#2a2a30" stroke="#55555f" strokeWidth="2" />
            <motion.g style={{ originX: '334px', originY: '156px' }} animate={{ rotate: [0, 30, 70, 40, 0] }} transition={dig}>
              <path d="M330 150 q26 -4 30 22 l-8 22 q-24 4 -34 -12 z" fill="#3a3a42" stroke="#55555f" strokeWidth="1.5" />
              {[0, 1, 2, 3].map((i) => <path key={i} d={`M${343 + i * 4} 192 l3 8 l3 -9`} fill="#9aa0a6" />)}
              <circle cx="334" cy="156" r="6" fill="#2a2a30" stroke="#55555f" strokeWidth="2" />
              {/* dirt in the bucket */}
              <motion.path d="M334 170 q12 -10 22 2" stroke="#8a5a2b" strokeWidth="6" strokeLinecap="round" fill="none"
                animate={{ opacity: [0, 0, 1, 1, 0] }} transition={dig} />
            </motion.g>
          </motion.g>
        </motion.g>

        {/* flying dirt */}
        {[0, 1, 2, 3, 4].map((i) => (
          <motion.circle key={`d${i}`} cx={326 + i * 5} cy="250" r={2 + (i % 2)} fill="#a0703e"
            animate={{ y: [0, -30 - i * 6, 8], x: [0, (i - 2) * 9, (i - 2) * 14], opacity: [0, 1, 0] }}
            transition={{ duration: 1.4, repeat: Infinity, repeatDelay: 2.8, delay: 1.6 + i * 0.06 }} />
        ))}
      </svg>
    </Box>
  )
}
