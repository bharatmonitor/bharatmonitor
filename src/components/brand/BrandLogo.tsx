// src/components/brand/BrandLogo.tsx
// Single source of truth for the BharatMonitor logo. Use everywhere instead of
// ad-hoc markup so the brand stays consistent across the platform.
//
//   <BrandLogo variant="lockup" height={40} />   // sidebar / header / report
//   <BrandLogo variant="mark"   height={32} />   // compact / favicon-like
//   <BrandLogo variant="mono"   height={32} color="#edf0f8" />  // single-colour
import type { CSSProperties } from 'react'

// Legal switch: true = India-outline mark (country outline, not the flag);
// false = text-only 'भ' monogram tile (zero map-compliance exposure).
// No Indian flag is used anywhere either way.
export const BRAND_USE_MAP = true

type Variant = 'lockup' | 'mark' | 'mono'
const INDIA = "M24.3 76.4 L23.1 73.0 L22.7 72.8 L22.3 71.9 L22.1 70.7 L21.6 70.5 L20.9 69.1 L20.1 64.7 L19.3 62.2 L19.5 61.7 L19.1 61.4 L18.8 59.7 L18.4 56.7 L19.1 54.4 L18.7 52.8 L18.3 52.7 L18.2 52.0 L18.6 51.5 L18.2 51.2 L18.5 51.0 L18.1 50.7 L18.3 50.4 L18.0 50.0 L18.1 49.3 L18.7 49.3 L19.2 48.9 L17.6 48.8 L17.1 50.2 L17.0 50.6 L17.4 51.0 L16.8 52.4 L13.0 54.0 L10.8 52.7 L7.5 48.8 L7.7 48.4 L8.1 48.7 L8.2 49.2 L10.9 48.1 L12.7 46.1 L11.5 46.0 L10.8 46.9 L8.9 47.3 L8.0 47.1 L6.6 46.1 L5.9 45.1 L5.0 44.5 L5.7 43.6 L6.9 43.6 L6.9 42.5 L7.7 42.8 L9.4 42.5 L9.8 42.9 L10.7 42.9 L10.9 42.5 L12.3 42.1 L12.3 42.7 L12.5 42.8 L13.7 42.3 L13.8 42.1 L13.5 42.1 L13.5 41.6 L13.8 41.3 L12.5 39.0 L12.6 38.1 L11.4 38.0 L10.9 37.3 L11.1 35.4 L10.0 35.2 L9.1 34.7 L9.4 33.3 L11.7 30.7 L12.3 30.7 L12.8 31.6 L13.2 31.7 L14.1 31.3 L16.1 31.0 L16.2 30.4 L17.1 29.5 L17.6 28.3 L19.2 27.5 L20.2 25.7 L20.6 24.6 L22.2 23.8 L22.0 23.2 L22.2 22.8 L23.4 21.5 L24.4 21.0 L23.8 20.8 L24.2 19.7 L23.8 18.8 L24.0 18.5 L26.4 17.4 L26.3 16.9 L25.9 16.7 L24.3 16.5 L24.3 15.5 L23.5 15.6 L21.2 14.6 L21.1 12.0 L20.5 10.5 L20.7 9.8 L21.2 9.8 L21.6 9.2 L22.2 9.0 L22.8 8.2 L21.5 7.8 L21.7 6.8 L20.6 6.7 L19.8 6.2 L19.7 5.7 L18.5 5.8 L18.0 5.6 L18.2 4.5 L19.4 3.8 L19.8 3.1 L21.8 3.0 L21.9 2.8 L21.4 2.4 L22.5 2.7 L24.4 1.9 L25.0 2.4 L26.3 1.9 L26.7 2.7 L27.5 3.4 L30.1 4.7 L30.6 5.1 L30.3 5.4 L30.6 5.8 L32.4 6.4 L32.4 6.8 L33.8 7.0 L34.0 6.7 L34.5 6.8 L35.3 6.0 L36.9 5.6 L37.4 5.8 L37.6 5.4 L38.1 5.3 L38.3 5.6 L39.6 6.0 L39.9 5.8 L40.8 6.5 L40.9 7.0 L40.2 9.4 L39.3 9.7 L39.3 10.1 L38.5 10.1 L38.8 10.8 L38.1 11.5 L36.7 11.7 L37.3 12.9 L36.8 13.0 L37.0 13.8 L38.4 14.0 L38.1 14.6 L38.9 15.7 L38.3 16.3 L38.0 16.1 L37.0 16.9 L36.3 15.9 L35.3 16.3 L35.7 16.7 L35.5 17.1 L36.4 18.0 L36.2 18.7 L36.6 19.3 L36.2 19.5 L36.4 20.2 L37.4 19.8 L38.0 20.8 L38.8 21.4 L39.6 21.3 L40.7 22.0 L40.6 22.5 L43.0 23.7 L41.0 25.2 L41.2 25.7 L40.7 26.2 L40.9 26.6 L40.1 28.1 L40.9 28.7 L41.6 28.5 L43.5 29.6 L43.8 30.1 L45.5 31.2 L46.0 31.0 L47.2 31.8 L47.9 31.7 L48.0 32.4 L49.3 32.5 L49.6 32.9 L49.9 32.4 L50.6 32.4 L51.3 32.9 L51.2 32.6 L52.0 32.3 L53.5 32.8 L53.6 33.8 L55.2 34.3 L55.4 34.7 L56.5 34.4 L57.2 35.3 L57.7 35.0 L59.7 35.8 L60.6 35.3 L61.0 35.8 L63.6 35.9 L64.0 34.7 L63.4 33.6 L64.1 30.9 L65.3 30.4 L65.9 30.8 L66.1 31.2 L65.7 32.1 L66.2 32.9 L65.6 33.5 L66.0 33.6 L66.0 34.0 L66.8 34.5 L67.5 34.4 L68.9 34.9 L70.6 34.2 L71.4 34.7 L74.3 34.5 L74.9 34.2 L75.4 34.4 L75.4 32.7 L75.3 32.4 L74.2 32.4 L73.9 31.9 L74.1 31.4 L74.7 31.4 L74.9 31.6 L76.0 31.2 L76.1 31.4 L76.9 31.3 L77.4 30.8 L77.2 30.3 L78.8 29.7 L78.7 29.4 L79.1 28.7 L81.0 28.5 L81.9 27.1 L83.1 26.5 L83.7 27.0 L85.4 27.5 L85.6 26.9 L87.2 26.1 L87.7 26.8 L88.1 26.8 L87.4 27.4 L87.7 27.8 L88.2 27.5 L88.7 28.2 L87.9 29.1 L87.9 29.5 L88.9 29.3 L91.0 30.1 L91.0 31.0 L89.5 31.9 L90.4 33.5 L90.1 33.6 L89.5 33.3 L89.3 32.8 L87.9 33.0 L87.0 33.4 L85.3 34.9 L84.7 34.9 L84.2 35.7 L84.6 36.9 L84.1 37.5 L84.1 37.9 L83.1 38.9 L82.8 39.6 L83.3 40.2 L82.9 41.1 L82.2 41.9 L81.5 44.0 L80.3 43.5 L79.6 43.7 L79.3 43.2 L78.9 43.4 L79.3 43.7 L79.3 46.0 L79.0 46.6 L78.5 46.6 L78.4 47.6 L78.7 49.0 L78.0 49.8 L77.3 49.4 L77.0 49.8 L76.0 44.3 L75.6 44.3 L75.4 44.6 L75.0 44.5 L75.0 45.3 L74.6 45.0 L74.6 46.5 L74.0 46.8 L73.8 46.1 L73.2 45.8 L72.7 44.8 L73.2 43.5 L74.1 43.1 L74.2 42.9 L74.5 43.0 L74.5 42.7 L75.0 43.1 L75.0 42.4 L75.8 41.9 L76.1 41.1 L75.9 40.6 L76.7 40.7 L76.5 40.2 L75.4 39.7 L73.7 39.9 L73.3 39.5 L70.6 39.8 L68.8 39.3 L69.0 37.3 L68.5 36.6 L68.3 36.4 L68.3 36.9 L67.4 37.1 L66.8 36.7 L66.7 35.9 L66.3 35.7 L66.2 36.2 L65.7 36.1 L64.6 35.1 L64.4 35.5 L65.0 35.9 L64.0 36.6 L63.8 37.6 L65.4 38.8 L65.8 38.6 L65.9 39.1 L66.4 39.4 L66.1 39.7 L64.7 39.7 L64.6 40.4 L63.9 40.6 L63.5 41.3 L63.8 41.8 L65.6 42.7 L65.6 43.8 L65.2 43.9 L65.1 44.4 L65.7 45.2 L65.5 45.9 L66.2 46.0 L66.0 46.8 L66.3 47.1 L66.1 47.4 L66.6 50.0 L66.0 50.1 L65.7 49.8 L65.0 50.3 L64.6 50.2 L64.2 51.2 L63.9 50.0 L64.1 49.5 L63.7 49.0 L63.5 49.1 L64.0 49.5 L63.3 50.4 L60.4 51.9 L60.1 52.7 L60.4 53.7 L60.1 53.7 L59.9 53.9 L60.7 53.9 L59.9 54.5 L59.9 55.1 L58.7 56.3 L55.7 57.5 L54.0 59.1 L53.8 59.0 L54.0 59.1 L52.1 61.6 L50.7 62.3 L49.2 64.0 L46.8 65.6 L46.6 65.9 L46.9 66.2 L46.8 67.1 L45.0 67.9 L43.7 68.0 L42.7 69.8 L42.4 69.9 L42.2 69.3 L42.0 69.3 L40.9 69.8 L40.1 72.1 L40.5 73.4 L40.4 75.2 L41.0 77.6 L40.4 80.3 L39.5 81.5 L39.3 82.8 L39.5 84.3 L39.5 87.1 L38.2 87.0 L37.8 87.3 L37.8 87.9 L36.7 89.7 L37.2 90.2 L38.0 90.2 L37.9 90.4 L36.6 90.4 L35.2 90.9 L34.6 91.6 L34.5 92.8 L33.5 93.9 L32.8 94.1 L31.8 93.8 L29.8 91.5 L29.1 89.7 L28.8 87.4 L26.9 82.6 L25.9 81.6 L24.7 79.0 L24.3 76.4Z"
const PULSE = "15,48 33,48 39,39 48,58 55,43 62,48 82,48"

export function BrandLogo({
  variant = 'lockup', height = 40, color, style,
}: { variant?: Variant; height?: number; color?: string; style?: CSSProperties }) {
  const id = `bm-${Math.random().toString(36).slice(2, 7)}` // unique grad/clip ids per instance
  const mono = color || '#edf0f8'

  const Mark = ({ flat }: { flat?: boolean }) => (
    <g>
      <defs>
        {!flat && (
          <linearGradient id={`${id}g`} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#fb923c" /><stop offset="55%" stopColor="#f97316" /><stop offset="100%" stopColor="#ea580c" />
          </linearGradient>
        )}
        <clipPath id={`${id}c`}><path d={INDIA} /></clipPath>
      </defs>
      <path d={INDIA} fill={flat ? mono : `url(#${id}g)`} />
      <g clipPath={`url(#${id}c)`}>
        <polyline points={PULSE} fill="none" stroke={flat ? '#0d1018' : '#0d1018'} strokeWidth={3.1}
          strokeLinejoin="round" strokeLinecap="round" opacity={flat ? 0.9 : 0.92} />
      </g>
      <circle cx={54.9} cy={43.0} r={3.3} fill="#0d1018" /><circle cx={54.9} cy={43.0} r={1.5} fill={flat ? mono : '#fb923c'} />
    </g>
  )

  if (variant === 'mark' || variant === 'mono') {
    if (!BRAND_USE_MAP) {
      // Text-only monogram tile — no map, no flag.
      return (
        <div role="img" aria-label="BharatMonitor" style={{
          height, width: height, borderRadius: height * 0.22,
          background: variant === 'mono' ? 'transparent' : 'linear-gradient(135deg,#fb923c,#ea580c)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: "'IBM Plex Mono',monospace", fontWeight: 700,
          fontSize: height * 0.5, color: variant === 'mono' ? (color || '#edf0f8') : '#0d1018', ...style,
        }}>भ</div>
      )
    }
    return (
      <svg height={height} viewBox="0 0 96 96" style={style} role="img" aria-label="BharatMonitor">
        <Mark flat={variant === 'mono'} />
      </svg>
    )
  }

  // lockup
  return (
    <svg height={height} viewBox="0 0 340 96" style={style} role="img" aria-label="BharatMonitor">
      <g transform="translate(0 -2)"><Mark /></g>
      <text x={104} y={52} fontFamily="'IBM Plex Mono',monospace" fontSize={27} fontWeight={700} fill="#edf0f8" letterSpacing="-0.5">
        Bharat<tspan fill="#f97316">Monitor</tspan>
      </text>
      <text x={105} y={70} fontFamily="'IBM Plex Mono',monospace" fontSize={9.5} fontWeight={500} fill="#8892a4" letterSpacing="3.2">
        POLITICAL INTELLIGENCE
      </text>
    </svg>
  )
}
