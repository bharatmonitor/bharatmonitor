import { useEffect, useState } from 'react'
import type { AIBrief, BucketColor } from '@/types'
import { useDashboardStore, useFeedCountStore } from '@/store'

const TAG_COLORS: Record<string, { bg: string; color: string; border: string }> = {
  CRISIS:   { bg: 'rgba(240,62,62,0.12)',   color: '#f03e3e', border: 'rgba(240,62,62,0.25)' },
  OPP:      { bg: 'rgba(245,166,35,0.12)',  color: '#f5a623', border: 'rgba(245,166,35,0.25)' },
  POSITIVE: { bg: 'rgba(34,211,160,0.12)',  color: '#22d3a0', border: 'rgba(34,211,160,0.25)' },
  INTEL:    { bg: 'rgba(61,142,240,0.12)',  color: '#3d8ef0', border: 'rgba(61,142,240,0.25)' },
  SURGE:    { bg: 'rgba(240,62,62,0.12)',   color: '#f03e3e', border: 'rgba(240,62,62,0.25)' },
  RTI:      { bg: 'rgba(245,166,35,0.12)',  color: '#f5a623', border: 'rgba(245,166,35,0.25)' },
  TREND:    { bg: 'rgba(34,211,160,0.12)',  color: '#22d3a0', border: 'rgba(34,211,160,0.25)' },
  AI:       { bg: 'rgba(249,115,22,0.12)',  color: '#f97316', border: 'rgba(249,115,22,0.25)' },
}

function decodeHtml(html: string): string {
  try {
    const txt = document.createElement('textarea')
    txt.innerHTML = html
    return txt.value
  } catch { return html }
}

export function AIRibbon({ brief }: { brief: AIBrief }) {
  const [countdown, setCountdown] = useState(60)
  useEffect(() => {
    const id = setInterval(() => setCountdown(c => c <= 1 ? 60 : c - 1), 1000)
    return () => clearInterval(id)
  }, [])

  const items = [...(brief.ticker_items || []), ...(brief.ticker_items || [])]

  return (
    <div style={{
      background: 'rgba(249,115,22,0.04)',
      borderBottom: '1px solid rgba(249,115,22,0.14)',
      position: 'sticky', top: '52px', zIndex: 290,
      display: 'flex', alignItems: 'center', height: '30px',
      padding: '0 14px', gap: '10px',
      overflow: 'hidden', isolation: 'isolate',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0, paddingRight: '10px', borderRight: '1px solid var(--b1)' }}>
        <span style={{ fontSize: '10px', color: '#f97316' }}>◈</span>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: '#f97316', letterSpacing: '2px' }}>AI LIVE</span>
      </div>
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        <div
          style={{ display: 'flex', whiteSpace: 'nowrap', animation: 'ticker 55s linear infinite' }}
          onMouseEnter={e => ((e.currentTarget as HTMLDivElement).style.animationPlayState = 'paused')}
          onMouseLeave={e => ((e.currentTarget as HTMLDivElement).style.animationPlayState = 'running')}>
          {items.map((item, i) => {
            const tc = TAG_COLORS[item.tag] || TAG_COLORS.AI
            return (
              <span key={`${item.id}-${i}`} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', padding: '0 20px', fontSize: '10px', color: 'var(--t1)', borderRight: '1px solid var(--b0)', flexShrink: 0 }}>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', padding: '1px 4px', borderRadius: '2px', background: tc.bg, color: tc.color, border: `1px solid ${tc.border}`, flexShrink: 0 }}>{item.tag}</span>
                {decodeHtml(item.text || "")}
              </span>
            )
          })}
        </div>
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)', flexShrink: 0, paddingLeft: '10px', borderLeft: '1px solid var(--b1)' }}>
        {countdown}s
      </div>
    </div>
  )
}

export default AIRibbon

const selectViewMode    = (s: ReturnType<typeof useDashboardStore.getState>) => s.viewMode
const selectSetViewMode = (s: ReturnType<typeof useDashboardStore.getState>) => s.setViewMode
const selectCounts      = (s: ReturnType<typeof useFeedCountStore.getState>) => s.counts

export function BucketNav() {
  const viewMode    = useDashboardStore(selectViewMode)
  const setViewMode = useDashboardStore(selectSetViewMode)
  const counts      = useFeedCountStore(selectCounts)

  const buckets: { id: BucketColor; label: string; color: string; bg: string; border: string; live?: boolean }[] = [
    { id: 'red',    label: 'CRISIS',      color: '#f03e3e', bg: 'rgba(240,62,62,0.08)',    border: 'rgba(240,62,62,0.28)',    live: true },
    { id: 'yellow', label: 'DEVELOPING',  color: '#f5a623', bg: 'rgba(245,166,35,0.08)',   border: 'rgba(245,166,35,0.28)'   },
    { id: 'blue',   label: 'BACKGROUND',  color: '#3d8ef0', bg: 'rgba(61,142,240,0.08)',   border: 'rgba(61,142,240,0.28)'   },
    { id: 'silver', label: 'QUOTE INTEL', color: '#f5a623', bg: 'rgba(245,166,35,0.08)',   border: 'rgba(245,166,35,0.28)'   },
  ]

  return (
    <div style={{
      background: 'var(--s1)', borderBottom: '1px solid var(--b1)',
      position: 'sticky', top: '82px', zIndex: 280,
      display: 'flex', alignItems: 'center',
      padding: '0 14px', height: '36px', gap: '5px',
      overflow: 'hidden', isolation: 'isolate',
    }}>
      {buckets.map(b => (
        <button
          key={b.id}
          onClick={() => document.getElementById(`bcol-${b.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}
          style={{
            display: 'flex', alignItems: 'center', gap: '4px',
            padding: '4px 10px', borderRadius: '5px',
            border: `1px solid ${b.border}`, background: b.bg,
            color: b.color, fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '8px', letterSpacing: '1px', cursor: 'pointer', transition: 'all .15s',
          }}
          onMouseEnter={e => { e.currentTarget.style.opacity = '0.75' }}
          onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: b.color, flexShrink: 0, animation: b.live ? 'blink 1.4s infinite' : 'none' }} />
          {b.label}
          <span style={{ background: 'rgba(255,255,255,0.07)', padding: '1px 4px', borderRadius: '2px', fontSize: '7px', marginLeft: '1px' }}>
            {counts[b.id] || 0}
          </span>
        </button>
      ))}

      <div style={{ width: '1px', height: '14px', background: 'var(--b1)', margin: '0 4px' }} />

      <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '6px' }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)' }}>SINCE APR 2024 ELECTION</span>
        <div style={{ display: 'flex', border: '1px solid var(--b1)', borderRadius: '4px', overflow: 'hidden' }}>
          {(['4col', '2x2'] as const).map(v => (
            <button
              key={v}
              onClick={() => setViewMode(v)}
              style={{
                fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px',
                padding: '3px 7px', background: viewMode === v ? 'var(--s4)' : 'transparent',
                color: viewMode === v ? 'var(--t0)' : 'var(--t2)',
                border: 'none', cursor: 'pointer', transition: 'all .15s',
              }}>
              {v === '4col' ? '4 COLS' : '2×2'}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
