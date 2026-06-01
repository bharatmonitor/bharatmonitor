// src/components/godmode/AccountUsagePanel.tsx
// Per-account usage telemetry for God Mode. Opens inline when an account row's
// "Usage" button is clicked. Combines: bm_feed platform breakdown, ingest_log
// run history, and today's quota consumption.
import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { getFuelBreakdown } from '../../lib/quota'

const mono = '"IBM Plex Mono", monospace'
const T1 = '#c8d0e0', T2 = '#8892a4', T3 = '#545f78', CARD2 = '#161d2c', ACC = '#f97316'
const PLAT_COLORS: Record<string, string> = {
  twitter: '#1d9bf0', instagram: '#e1306c', facebook: '#1877f2', whatsapp: '#25d366',
  youtube: '#ff2020', news: '#8892a4', reddit: '#ff4500', bluesky: '#0085ff',
}

interface Stats {
  total: number
  byPlatform: [string, number][]
  last24h: number
  last7d: number
  lastFetched: string | null
  runs: number
  inserted: number
  rawTotal: number
  aiRuns: number
  lastRun: string | null
}

export function AccountUsagePanel({ accountId }: { accountId: string }) {
  const [stats, setStats] = useState<Stats | null>(null)
  const [err, setErr] = useState<string | null>(null)

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const since24 = new Date(Date.now() - 864e5).toISOString()
        const since7d = new Date(Date.now() - 7 * 864e5).toISOString()

        const { data: feed, error: fe } = await supabase
          .from('bm_feed').select('platform, fetched_at, published_at')
          .eq('account_id', accountId).limit(5000)
        if (fe) throw fe

        const platMap = new Map<string, number>()
        let last24h = 0, last7d = 0, lastFetched: string | null = null
        for (const r of feed ?? []) {
          platMap.set(r.platform, (platMap.get(r.platform) || 0) + 1)
          const ts = r.fetched_at || r.published_at
          if (ts) {
            if (ts >= since24) last24h++
            if (ts >= since7d) last7d++
            if (!lastFetched || ts > lastFetched) lastFetched = ts
          }
        }

        const { data: logs } = await supabase
          .from('ingest_log').select('run_at, inserted, raw_total, ai_used')
          .eq('account_id', accountId).order('run_at', { ascending: false }).limit(200)

        const runs = logs?.length ?? 0
        const inserted = (logs ?? []).reduce((s, l) => s + (l.inserted || 0), 0)
        const rawTotal = (logs ?? []).reduce((s, l) => s + (l.raw_total || 0), 0)
        const aiRuns = (logs ?? []).filter((l) => l.ai_used).length

        if (alive) setStats({
          total: feed?.length ?? 0,
          byPlatform: [...platMap.entries()].sort((a, b) => b[1] - a[1]),
          last24h, last7d, lastFetched,
          runs, inserted, rawTotal, aiRuns,
          lastRun: logs?.[0]?.run_at ?? null,
        })
      } catch (e: any) { if (alive) setErr(e.message || 'load failed') }
    })()
    return () => { alive = false }
  }, [accountId])

  const fuel = getFuelBreakdown(accountId, true)
  const fmt = (ts: string | null) => ts ? new Date(ts).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—'
  const cell = { fontFamily: mono, fontSize: '9px' } as const
  const label = { fontFamily: mono, fontSize: '7px', color: T3, letterSpacing: '1px', marginBottom: '3px' } as const

  if (err) return <div style={{ ...cell, color: '#f03e3e', padding: '10px' }}>Usage load failed: {err}</div>
  if (!stats) return <div style={{ ...cell, color: T3, padding: '10px' }}>Loading usage…</div>

  const maxPlat = Math.max(...stats.byPlatform.map(([, n]) => n), 1)

  return (
    <div style={{ marginTop: '8px', padding: '12px', background: '#0d1018', border: '1px solid rgba(255,255,255,0.08)', borderRadius: '8px' }}>
      <div style={{ fontFamily: mono, fontSize: '8px', color: ACC, letterSpacing: '1px', marginBottom: '10px' }}>📊 DATA USAGE — {accountId}</div>

      {/* headline numbers */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px', marginBottom: '12px' }}>
        {[['STORED ITEMS', stats.total], ['INGEST RUNS', stats.runs], ['ITEMS / 24H', stats.last24h], ['ITEMS / 7D', stats.last7d]].map(([l, v]) => (
          <div key={l as string} style={{ background: CARD2, borderRadius: '6px', padding: '8px' }}>
            <div style={label}>{l}</div>
            <div style={{ fontFamily: mono, fontSize: '15px', color: T1, fontWeight: 700 }}>{(v as number).toLocaleString('en-IN')}</div>
          </div>
        ))}
      </div>

      {/* platform breakdown */}
      <div style={label}>DATA BY PLATFORM (STORED)</div>
      <div style={{ marginBottom: '12px' }}>
        {stats.byPlatform.length === 0 && <div style={{ ...cell, color: T3 }}>No items yet</div>}
        {stats.byPlatform.map(([plat, n]) => (
          <div key={plat} style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
            <span style={{ ...cell, color: T2, width: '64px', textTransform: 'capitalize' }}>{plat}</span>
            <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.05)', borderRadius: '3px', overflow: 'hidden' }}>
              <div style={{ width: `${(n / maxPlat) * 100}%`, height: '100%', background: PLAT_COLORS[plat] || T2, borderRadius: '3px' }} />
            </div>
            <span style={{ ...cell, color: T1, width: '44px', textAlign: 'right', fontWeight: 600 }}>{n.toLocaleString('en-IN')}</span>
          </div>
        ))}
      </div>

      {/* run + quota stats */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
        <div>
          <div style={label}>INGEST ACTIVITY</div>
          {[['Items fetched (raw)', stats.rawTotal], ['Items stored', stats.inserted], ['AI-scored runs', `${stats.aiRuns}/${stats.runs}`], ['Last ingest', fmt(stats.lastRun)], ['Last item', fmt(stats.lastFetched)]].map(([l, v]) => (
            <div key={l as string} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
              <span style={{ ...cell, color: T3 }}>{l}</span>
              <span style={{ ...cell, color: T1, fontWeight: 600 }}>{typeof v === 'number' ? v.toLocaleString('en-IN') : v}</span>
            </div>
          ))}
        </div>
        <div>
          <div style={label}>QUOTA CONSUMED TODAY</div>
          {(['searches', 'news', 'youtube', 'social'] as const).map((k) => {
            const b = (fuel as any)[k] || { used: 0, limit: 0 }
            return (
              <div key={k} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px' }}>
                <span style={{ ...cell, color: T3, textTransform: 'capitalize' }}>{k}</span>
                <span style={{ ...cell, color: T1, fontWeight: 600 }}>{b.used} / {b.limit}</span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
