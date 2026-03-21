import { useEffect, useRef } from 'react'
import type { TrendMetric } from '@/types'
import { useDashboardStore } from '@/store'

const METRIC_CONFIG: Record<string, { label: string; format: (v: number) => string; color: string }> = {
  sentiment:          { label: 'SENTIMENT',     format: v => `${v}%`,          color: '#22d3a0' },
  mention_volume:     { label: 'MENTIONS',      format: v => `${v}M`,          color: '#7c6dfa' },
  narrative_score:    { label: 'NARRATIVE',     format: v => `${v}/100`,       color: '#f5a623' },
  opposition_pressure:{ label: 'OPP PRESSURE',  format: v => v > 55 ? 'HIGH' : v > 35 ? 'MED' : 'LOW', color: '#f03e3e' },
  issue_ownership:    { label: 'ISSUE OWN.',    format: v => `${v}%`,          color: '#22d3a0' },
  youth_sentiment:    { label: 'YOUTH SENT.',   format: v => `${v}%`,          color: '#f5a623' },
  social_share:       { label: 'SOCIAL SHARE',  format: v => `${v}%`,          color: '#7c6dfa' },
  vernacular_reach:   { label: 'VERNACULAR',    format: v => `${v} langs`,     color: '#3d8ef0' },
}

function Sparkline({ data, color }: { data: number[]; color: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const w = canvas.width
    const h = canvas.height
    const min = Math.min(...data)
    const max = Math.max(...data)
    const range = max - min || 1

    ctx.clearRect(0, 0, w, h)
    ctx.beginPath()
    ctx.strokeStyle = color
    ctx.lineWidth = 1.5
    ctx.lineJoin = 'round'
    ctx.lineCap = 'round'

    data.forEach((val, i) => {
      const x = (i / (data.length - 1)) * w
      const y = h - ((val - min) / range) * (h - 4) - 2
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y)
    })
    ctx.stroke()

    // Fill
    ctx.lineTo((data.length - 1) / (data.length - 1) * w, h)
    ctx.lineTo(0, h)
    ctx.closePath()
    const grad = ctx.createLinearGradient(0, 0, 0, h)
    grad.addColorStop(0, color + '30')
    grad.addColorStop(1, color + '00')
    ctx.fillStyle = grad
    ctx.fill()
  }, [data, color])

  return <canvas ref={canvasRef} width={100} height={28} style={{ display: 'block', width: '100%', height: '28px' }} />
}

interface Props { trends: TrendMetric[] }

export default function TrendStrip({ trends }: Props) {
  const { activePlatform } = useDashboardStore()

  return (
    <div style={{ borderBottom: '1px solid var(--b0)', padding: '8px 14px', display: 'flex', gap: '7px', overflowX: 'auto', scrollbarWidth: 'none', background: 'var(--s1)', flexShrink: 0 }}>
      {trends.map(t => {
        const cfg = METRIC_CONFIG[t.metric]
        if (!cfg) return null
        const deltaPositive = t.delta_7d >= 0
        const isNegativeMetric = t.metric === 'opposition_pressure'
        const isGood = isNegativeMetric ? !deltaPositive : deltaPositive
        const deltaColor = isGood ? 'var(--grn)' : 'var(--red)'
        const deltaPrefix = t.delta_7d >= 0 ? '▲' : '▼'
        const displayVal = cfg.format(t.current_value)
        const valColor = t.metric === 'opposition_pressure' && t.current_value > 55 ? 'var(--red)'
          : t.metric === 'narrative_score' && t.current_value < 45 ? 'var(--yel)'
          : cfg.color

        return (
          <div key={t.id} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '7px', padding: '7px 9px', minWidth: '110px', flexShrink: 0, transition: 'border-color .15s', cursor: 'default' }}
            onMouseEnter={e => (e.currentTarget.style.borderColor = 'var(--b2)')}
            onMouseLeave={e => (e.currentTarget.style.borderColor = 'var(--b1)')}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '2px' }}>
              {cfg.label}{activePlatform !== 'all' ? ` · ${activePlatform.toUpperCase()}` : ''}
            </div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '15px', fontWeight: 700, lineHeight: 1, color: valColor }}>{displayVal}</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', marginTop: '2px', color: deltaColor }}>
              {deltaPrefix} {Math.abs(t.delta_7d).toFixed(1)}{t.metric.includes('volume') ? '%' : t.metric === 'vernacular_reach' ? '' : '%'} 7d
            </div>
            <div style={{ marginTop: '5px' }}>
              <Sparkline data={t.data_points.map(d => d.value)} color={cfg.color} />
            </div>
          </div>
        )
      })}
    </div>
  )
}
