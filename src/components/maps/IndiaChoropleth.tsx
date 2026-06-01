// src/components/maps/IndiaChoropleth.tsx
// Sentiment choropleth. Two modes:
//   <IndiaChoropleth mode="india" data={stateData} />            // 36 states/UTs
//   <IndiaChoropleth mode="chhattisgarh" data={districtData} />  // 28 CG districts
// `data` maps region name -> { score (0–100), mentions }. Account-agnostic:
// feed it geoSentimentByState()/geoSentimentByDistrict() from lib/chartData.
import { useState } from 'react'
import { INDIA_VIEWBOX, INDIA_STATES, CHHATTISGARH_DISTRICTS } from './indiaPaths'
import { TOKENS } from '../../lib/chartData'

const mono = '"IBM Plex Mono", monospace'

export interface RegionDatum { score: number; mentions: number }
export type RegionData = Record<string, RegionDatum>

// Diverging red→grey→green for a 0–100 sentiment score; empty = faint fill.
function fillFor(d: RegionDatum | undefined): string {
  if (!d || d.mentions === 0) return 'rgba(255,255,255,0.05)'
  const s = d.score
  if (s >= 50) { const t = (s - 50) / 50; return `rgba(34,211,160,${0.25 + t * 0.6})` }
  const t = (50 - s) / 50; return `rgba(240,62,62,${0.25 + t * 0.6})`
}

export function IndiaChoropleth({
  mode = 'india', data, height = 460,
}: { mode?: 'india' | 'chhattisgarh'; data: RegionData; height?: number }) {
  const [hover, setHover] = useState<{ name: string; d?: RegionDatum; x: number; y: number } | null>(null)
  const paths = mode === 'chhattisgarh' ? CHHATTISGARH_DISTRICTS : INDIA_STATES
  const vb = mode === 'chhattisgarh' ? cgViewBox() : INDIA_VIEWBOX

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <svg viewBox={vb} style={{ width: '100%', height, display: 'block' }} role="img"
        aria-label={mode === 'chhattisgarh' ? 'Chhattisgarh district sentiment' : 'India state sentiment'}>
        {Object.entries(paths).map(([name, d]) => {
          const datum = data[name]
          return (
            <path key={name} d={d} fill={fillFor(datum)}
              stroke="rgba(255,255,255,0.18)" strokeWidth={mode === 'chhattisgarh' ? 0.6 : 1}
              onMouseEnter={(e) => setHover({ name, d: datum, x: e.clientX, y: e.clientY })}
              onMouseMove={(e) => setHover((h) => h && { ...h, x: e.clientX, y: e.clientY })}
              onMouseLeave={() => setHover(null)}
              style={{ cursor: 'pointer', transition: 'fill .2s' }} />
          )
        })}
      </svg>

      {/* legend */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontFamily: mono, fontSize: 8.5, color: TOKENS.t3 }}>
        <span>NEGATIVE</span>
        <div style={{ flex: 1, maxWidth: 180, height: 7, borderRadius: 4,
          background: 'linear-gradient(90deg,#f03e3e,rgba(255,255,255,0.12),#22d3a0)' }} />
        <span>POSITIVE</span>
        <span style={{ marginLeft: 10 }}>· faint = no data</span>
      </div>

      {hover && (
        <div style={{ position: 'fixed', left: hover.x + 12, top: hover.y + 12, zIndex: 50, pointerEvents: 'none',
          background: TOKENS.s1, border: '1px solid rgba(255,255,255,0.14)', borderRadius: 8, padding: '6px 9px',
          fontFamily: mono, fontSize: 10, color: TOKENS.t1 }}>
          <div style={{ fontWeight: 700 }}>{hover.name}</div>
          <div style={{ color: TOKENS.t2 }}>
            {hover.d && hover.d.mentions ? `${hover.d.score}/100 · ${hover.d.mentions} mentions` : 'No mentions'}
          </div>
        </div>
      )}
    </div>
  )
}

// Tight viewBox around Chhattisgarh so it fills the frame (derived from paths).
function cgViewBox(): string {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const d of Object.values(CHHATTISGARH_DISTRICTS)) {
    for (const m of d.matchAll(/([\d.]+) ([\d.]+)/g)) {
      const x = parseFloat(m[1]), y = parseFloat(m[2])
      minX = Math.min(minX, x); minY = Math.min(minY, y); maxX = Math.max(maxX, x); maxY = Math.max(maxY, y)
    }
  }
  const pad = 8
  return `${minX - pad} ${minY - pad} ${maxX - minX + pad * 2} ${maxY - minY + pad * 2}`
}
