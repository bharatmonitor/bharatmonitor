import { useAccount, useTrendMetrics, useFeedItems } from '@/hooks/useData'
import NavBar from '@/components/layout/NavBar'
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell } from 'recharts'
import { useMemo } from 'react'

export default function PoliticalTrendsPage() {
  const { data: account } = useAccount()
  const { data: trends = [], isLoading } = useTrendMetrics(account?.id || '')
  const { data: feed = [] } = useFeedItems(account?.id || '')

  // Platform distribution from feed
  const platformData = useMemo(() => {
    const counts: Record<string, number> = {}
    feed.forEach(f => { counts[f.platform] = (counts[f.platform] || 0) + 1 })
    return Object.entries(counts).map(([name, value]) => ({ name: name.toUpperCase(), value })).sort((a, b) => b.value - a.value)
  }, [feed])

  // Sentiment over time
  const sentimentData = trends[0]?.data_points || []

  // Bucket distribution
  const bucketData = useMemo(() => {
    const counts = { red: 0, yellow: 0, blue: 0, silver: 0 }
    feed.forEach(f => { if (f.bucket in counts) counts[f.bucket as keyof typeof counts]++ })
    return [
      { name: 'CRISIS', value: counts.red, color: '#f03e3e' },
      { name: 'DEVELOPING', value: counts.yellow, color: '#f5a623' },
      { name: 'BACKGROUND', value: counts.blue, color: '#3d8ef0' },
      { name: 'INTEL', value: counts.silver, color: '#8892a4' },
    ]
  }, [feed])

  const PLAT_COLORS: Record<string, string> = {
    TWITTER: '#1d9bf0', INSTAGRAM: '#e1306c', FACEBOOK: '#1877f2',
    YOUTUBE: '#ff2020', NEWS: '#8892a4', WHATSAPP: '#25d366', REDDIT: '#ff4500',
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <NavBar />

      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Page title */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)', letterSpacing: '2px', marginBottom: '6px' }}>ANALYTICS</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#edf0f8' }}>{account?.politician_name || 'Account'} — Political Intelligence Trends</div>
        </div>

        {/* Charts grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* Sentiment trend */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '16px' }}>SENTIMENT TREND (7 DAYS)</div>
            {sentimentData.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={sentimentData}>
                  <defs>
                    <linearGradient id="sentGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3a0" stopOpacity={0.2} />
                      <stop offset="95%" stopColor="#22d3a0" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                  <XAxis dataKey="date" tick={{ fill: '#545f78', fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis domain={[0, 100]} tick={{ fill: '#545f78', fontSize: 8 }} axisLine={false} tickLine={false} />
                  <Tooltip contentStyle={{ background: '#121620', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '6px', fontSize: '10px' }} />
                  <Area type="monotone" dataKey="value" stroke="#22d3a0" fill="url(#sentGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: '180px', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)' }}>No trend data yet</div>
            )}
          </div>

          {/* Bucket distribution */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '16px' }}>SIGNAL DISTRIBUTION</div>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={bucketData} layout="vertical" margin={{ left: 50, right: 10 }}>
                <XAxis type="number" tick={{ fill: '#545f78', fontSize: 8 }} axisLine={false} tickLine={false} />
                <YAxis dataKey="name" type="category" tick={{ fill: '#9aa3b8', fontSize: 8, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={48} />
                <Tooltip contentStyle={{ background: '#121620', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '6px', fontSize: '10px' }} />
                <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                  {bucketData.map((d) => <Cell key={d.name} fill={d.color} fillOpacity={0.85} />)}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Platform distribution */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '16px' }}>PLATFORM COVERAGE</div>
          {platformData.length > 0 ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {platformData.map(p => {
                const max = platformData[0]?.value || 1
                const c = PLAT_COLORS[p.name] || '#8892a4'
                return (
                  <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', width: '80px', flexShrink: 0 }}>{p.name}</span>
                    <div style={{ flex: 1, height: '6px', background: 'var(--s3)', borderRadius: '3px', overflow: 'hidden' }}>
                      <div style={{ width: `${(p.value / max) * 100}%`, height: '100%', background: c, borderRadius: '3px' }} />
                    </div>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', width: '40px', textAlign: 'right' }}>{p.value}</span>
                  </div>
                )
              })}
            </div>
          ) : (
            <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)' }}>No platform data — trigger an ingest from the dashboard</div>
          )}
        </div>
      </div>
    </div>
  )
}
