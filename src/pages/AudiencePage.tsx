import { useMemo, useState } from 'react'
import { useAccount, useFeedItems, useCompetitors } from '@/hooks/useData'
import NavBar from '@/components/layout/NavBar'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, AreaChart, Area, CartesianGrid } from 'recharts'
import type { FeedItem, Platform } from '@/types'

const PLAT_COLORS: Record<string, string> = {
  twitter: '#1d9bf0', instagram: '#e1306c', facebook: '#1877f2',
  whatsapp: '#25d366', youtube: '#ff2020', news: '#8892a4', reddit: '#ff4500',
}

const PLAT_LABELS: Record<string, string> = {
  twitter: 'X / Twitter', instagram: 'Instagram', facebook: 'Facebook',
  whatsapp: 'WhatsApp', youtube: 'YouTube', news: 'News / RSS', reddit: 'Reddit',
}

const mono = 'IBM Plex Mono, monospace'

export default function AudiencePage() {
  const { data: account } = useAccount()
  const { data: feed = [], isLoading } = useFeedItems(account?.id || '')
  const { data: competitors = [] } = useCompetitors(account)
  const [selectedPlatform, setSelectedPlatform] = useState<Platform | 'all'>('all')

  // ── Platform distribution ──────────────────────────────────────────────────
  const platformStats = useMemo(() => {
    const stats: Record<string, { count: number; engagement: number; positive: number; negative: number; neutral: number; trending: number }> = {}
    feed.forEach(item => {
      const p = item.platform
      if (!stats[p]) stats[p] = { count: 0, engagement: 0, positive: 0, negative: 0, neutral: 0, trending: 0 }
      stats[p].count++
      stats[p].engagement += item.engagement ?? 0
      stats[p][item.sentiment]++
      if (item.is_trending) stats[p].trending++
    })
    return Object.entries(stats)
      .map(([platform, s]) => ({ platform, ...s, label: PLAT_LABELS[platform] || platform }))
      .sort((a, b) => b.engagement - a.engagement)
  }, [feed])

  // ── Filtered feed ──────────────────────────────────────────────────────────
  const filtered = useMemo(() =>
    selectedPlatform === 'all' ? feed : feed.filter(f => f.platform === selectedPlatform)
  , [feed, selectedPlatform])

  // ── Total engagement + reach ───────────────────────────────────────────────
  const totals = useMemo(() => {
    const t = { mentions: filtered.length, engagement: 0, positive: 0, negative: 0, neutral: 0, crisis: 0, trending: 0, sources: new Set<string>() }
    filtered.forEach(f => {
      t.engagement += f.engagement ?? 0
      t[f.sentiment]++
      if (f.bucket === 'red') t.crisis++
      if (f.is_trending) t.trending++
      t.sources.add(f.source)
    })
    return { ...t, uniqueSources: t.sources.size }
  }, [filtered])

  // ── Engagement over time (daily) ───────────────────────────────────────────
  const engagementTimeline = useMemo(() => {
    const byDay: Record<string, { date: string; engagement: number; mentions: number }> = {}
    filtered.forEach(f => {
      const d = f.published_at.slice(0, 10)
      if (!byDay[d]) byDay[d] = { date: d, engagement: 0, mentions: 0 }
      byDay[d].engagement += f.engagement ?? 0
      byDay[d].mentions++
    })
    return Object.values(byDay).sort((a, b) => a.date.localeCompare(b.date)).slice(-30)
  }, [filtered])

  // ── Top sources (influencers / accounts) ───────────────────────────────────
  const topSources = useMemo(() => {
    const src: Record<string, { source: string; platform: string; count: number; engagement: number; sentiment: number }> = {}
    filtered.forEach(f => {
      const k = `${f.source}|${f.platform}`
      if (!src[k]) src[k] = { source: f.source, platform: f.platform, count: 0, engagement: 0, sentiment: 0 }
      src[k].count++
      src[k].engagement += f.engagement ?? 0
      src[k].sentiment += f.tone ?? 0
    })
    return Object.values(src).sort((a, b) => b.engagement - a.engagement).slice(0, 15)
  }, [filtered])

  // ── Geo distribution ───────────────────────────────────────────────────────
  const geoData = useMemo(() => {
    const geo: Record<string, number> = {}
    filtered.forEach(f => (f.geo_tags ?? []).forEach(g => { geo[g] = (geo[g] || 0) + 1 }))
    return Object.entries(geo).map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, 12)
  }, [filtered])

  // ── Topic distribution ─────────────────────────────────────────────────────
  const topicData = useMemo(() => {
    const topics: Record<string, { count: number; engagement: number }> = {}
    filtered.forEach(f => (f.topic_tags ?? []).forEach(t => {
      if (!topics[t]) topics[t] = { count: 0, engagement: 0 }
      topics[t].count++
      topics[t].engagement += f.engagement ?? 0
    }))
    return Object.entries(topics).map(([name, v]) => ({ name, ...v })).sort((a, b) => b.engagement - a.engagement).slice(0, 10)
  }, [filtered])

  // ── Sentiment pie ──────────────────────────────────────────────────────────
  const sentimentPie = [
    { name: 'Positive', value: totals.positive, color: '#22d3a0' },
    { name: 'Negative', value: totals.negative, color: '#f03e3e' },
    { name: 'Neutral',  value: totals.neutral,  color: '#8892a4' },
  ].filter(s => s.value > 0)

  // ── Platform pie for chart ─────────────────────────────────────────────────
  const platformPie = platformStats.map(p => ({
    name: p.label, value: p.count, color: PLAT_COLORS[p.platform] || '#8892a4',
  }))

  const fmtNum = (n: number) => n > 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n > 1000 ? `${(n/1000).toFixed(0)}K` : String(n)

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
        <NavBar pageLabel="AUDIENCE INTELLIGENCE" />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
          <span style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t3)' }}>LOADING AUDIENCE DATA…</span>
        </div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <NavBar pageLabel="AUDIENCE INTELLIGENCE" />

      <div style={{ maxWidth: '1200px', margin: '0 auto', padding: '20px 16px' }}>

        {/* ── Platform filter tabs ──────────────────────────────────────────── */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', overflowX: 'auto', scrollbarWidth: 'none', paddingBottom: '2px' }}>
          <PlatBtn platform="all" label="ALL PLATFORMS" color="#8892a4" active={selectedPlatform === 'all'} onClick={() => setSelectedPlatform('all')} count={feed.length} />
          {platformStats.map(p => (
            <PlatBtn
              key={p.platform}
              platform={p.platform as Platform}
              label={(PLAT_LABELS[p.platform] || p.platform).toUpperCase()}
              color={PLAT_COLORS[p.platform] || '#8892a4'}
              active={selectedPlatform === p.platform}
              onClick={() => setSelectedPlatform(p.platform as Platform)}
              count={p.count}
            />
          ))}
        </div>

        {/* ── KPI Cards ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '10px', marginBottom: '16px' }}>
          {[
            { label: 'TOTAL MENTIONS', value: fmtNum(totals.mentions), color: 'var(--t0)' },
            { label: 'TOTAL REACH', value: fmtNum(totals.engagement), color: '#22d3a0' },
            { label: 'UNIQUE SOURCES', value: String(totals.uniqueSources), color: 'var(--acc)' },
            { label: 'POSITIVE', value: `${totals.mentions > 0 ? Math.round(totals.positive / totals.mentions * 100) : 0}%`, color: '#22d3a0' },
            { label: 'CRISIS ITEMS', value: String(totals.crisis), color: totals.crisis > 0 ? '#f03e3e' : '#22d3a0' },
            { label: 'TRENDING', value: String(totals.trending), color: '#f5a623' },
          ].map(k => (
            <div key={k.label} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '14px 12px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px', marginBottom: '6px' }}>{k.label}</div>
              <div style={{ fontFamily: mono, fontSize: '22px', fontWeight: 700, color: k.color, lineHeight: 1 }}>{k.value}</div>
            </div>
          ))}
        </div>

        {/* ── Row 1: Engagement Timeline + Sentiment + Platform Split ──────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr 1fr', gap: '12px', marginBottom: '16px' }}>

          {/* Engagement over time */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>ENGAGEMENT OVER TIME</div>
            {engagementTimeline.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <AreaChart data={engagementTimeline}>
                  <defs>
                    <linearGradient id="engGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#22d3a0" stopOpacity={0.3} />
                      <stop offset="95%" stopColor="#22d3a0" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid stroke="var(--b0)" strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 8, fontFamily: mono, fill: '#555f75' }} tickFormatter={d => d.slice(5)} />
                  <YAxis tick={{ fontSize: 8, fontFamily: mono, fill: '#555f75' }} tickFormatter={v => fmtNum(v)} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid var(--b1)', borderRadius: 6, fontFamily: mono, fontSize: 10 }} />
                  <Area type="monotone" dataKey="engagement" stroke="#22d3a0" fill="url(#engGrad)" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>NO TIMELINE DATA</div>
            )}
          </div>

          {/* Sentiment breakdown */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>SENTIMENT</div>
            {sentimentPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={sentimentPie} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3} dataKey="value">
                    {sentimentPie.map((s, i) => <Cell key={i} fill={s.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid var(--b1)', borderRadius: 6, fontFamily: mono, fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>NO DATA</div>
            )}
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginTop: '6px' }}>
              {sentimentPie.map(s => (
                <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: s.color }} />
                  <span style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t2)' }}>{s.name} ({s.value})</span>
                </div>
              ))}
            </div>
          </div>

          {/* Platform split */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>PLATFORM SPLIT</div>
            {platformPie.length > 0 ? (
              <ResponsiveContainer width="100%" height={180}>
                <PieChart>
                  <Pie data={platformPie} cx="50%" cy="50%" innerRadius={35} outerRadius={65} paddingAngle={3} dataKey="value">
                    {platformPie.map((p, i) => <Cell key={i} fill={p.color} />)}
                  </Pie>
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid var(--b1)', borderRadius: 6, fontFamily: mono, fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            ) : (
              <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>NO DATA</div>
            )}
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', flexWrap: 'wrap', marginTop: '6px' }}>
              {platformPie.slice(0, 4).map(p => (
                <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: p.color }} />
                  <span style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t2)' }}>{p.name} ({p.value})</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Row 2: Top Sources / Influencers + Geography ─────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>

          {/* Top sources */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>TOP SOURCES / INFLUENCERS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {topSources.length === 0 ? (
                <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)', padding: '20px', textAlign: 'center' }}>NO SOURCE DATA</div>
              ) : topSources.map((s, i) => {
                const maxEng = topSources[0]?.engagement || 1
                const pct = Math.max(5, (s.engagement / maxEng) * 100)
                const sentColor = s.sentiment > 0 ? '#22d3a0' : s.sentiment < 0 ? '#f03e3e' : '#8892a4'
                return (
                  <div key={`${s.source}-${s.platform}`} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 8px', borderRadius: '6px', background: 'var(--s2)', border: '1px solid var(--b0)' }}>
                    <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)', width: '16px', flexShrink: 0 }}>#{i + 1}</span>
                    <div style={{ width: 5, height: 5, borderRadius: '50%', background: PLAT_COLORS[s.platform] || '#888', flexShrink: 0 }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '10px', color: 'var(--t0)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.source}</div>
                      <div style={{ height: '3px', borderRadius: '2px', background: 'var(--b0)', marginTop: '3px', overflow: 'hidden' }}>
                        <div style={{ height: '100%', width: `${pct}%`, background: PLAT_COLORS[s.platform] || '#888', borderRadius: '2px' }} />
                      </div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
                      <span style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t1)', fontWeight: 600 }}>{fmtNum(s.engagement)}</span>
                      <span style={{ fontFamily: mono, fontSize: '7px', color: sentColor }}>{s.count} items</span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Geography distribution */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>GEOGRAPHIC REACH</div>
            {geoData.length === 0 ? (
              <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)', padding: '20px', textAlign: 'center' }}>NO GEO DATA</div>
            ) : (
              <ResponsiveContainer width="100%" height={Math.max(200, geoData.length * 28)}>
                <BarChart data={geoData} layout="vertical" margin={{ left: 80, right: 20 }}>
                  <XAxis type="number" tick={{ fontSize: 8, fontFamily: mono, fill: '#555f75' }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 9, fontFamily: mono, fill: '#c4cde0' }} width={75} />
                  <Tooltip contentStyle={{ background: '#111827', border: '1px solid var(--b1)', borderRadius: 6, fontFamily: mono, fontSize: 10 }} />
                  <Bar dataKey="value" fill="#7c6dfa" radius={[0, 4, 4, 0]} barSize={14}>
                    {geoData.map((_, i) => <Cell key={i} fill={i < 3 ? '#f97316' : '#7c6dfa'} opacity={1 - i * 0.05} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* ── Row 3: Platform-wise detailed breakdown ──────────────────────── */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '16px', marginBottom: '16px' }}>
          <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>PLATFORM-WISE BREAKDOWN</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '10px' }}>
            {platformStats.map(p => {
              const totalItems = p.count || 1
              const posPct = Math.round(p.positive / totalItems * 100)
              const negPct = Math.round(p.negative / totalItems * 100)
              return (
                <div
                  key={p.platform}
                  onClick={() => setSelectedPlatform(p.platform as Platform)}
                  style={{
                    padding: '14px', borderRadius: '8px', cursor: 'pointer',
                    background: selectedPlatform === p.platform ? `${PLAT_COLORS[p.platform]}10` : 'var(--s2)',
                    border: `1px solid ${selectedPlatform === p.platform ? PLAT_COLORS[p.platform] + '40' : 'var(--b0)'}`,
                    transition: 'all .15s',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: PLAT_COLORS[p.platform] || '#888' }} />
                    <span style={{ fontFamily: mono, fontSize: '9px', color: PLAT_COLORS[p.platform] || 'var(--t1)', fontWeight: 600, letterSpacing: '0.5px' }}>
                      {(PLAT_LABELS[p.platform] || p.platform).toUpperCase()}
                    </span>
                  </div>
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px' }}>
                    <MiniStat label="MENTIONS" value={String(p.count)} />
                    <MiniStat label="REACH" value={fmtNum(p.engagement)} />
                    <MiniStat label="POSITIVE" value={`${posPct}%`} color="#22d3a0" />
                    <MiniStat label="NEGATIVE" value={`${negPct}%`} color="#f03e3e" />
                  </div>
                  {/* Sentiment bar */}
                  <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', marginTop: '8px', background: 'var(--b0)' }}>
                    <div style={{ width: `${posPct}%`, background: '#22d3a0' }} />
                    <div style={{ width: `${100 - posPct - negPct}%`, background: '#8892a4' }} />
                    <div style={{ width: `${negPct}%`, background: '#f03e3e' }} />
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* ── Row 4: Topic Analysis + Competitors ─────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '16px' }}>

          {/* Topic analysis */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>TOPIC ENGAGEMENT</div>
            {topicData.length === 0 ? (
              <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)', padding: '20px', textAlign: 'center' }}>NO TOPIC DATA</div>
            ) : (
              <>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={topicData} margin={{ left: 0, right: 20 }}>
                    <CartesianGrid stroke="var(--b0)" strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 7, fontFamily: mono, fill: '#555f75' }} angle={-45} textAnchor="end" height={60} />
                    <YAxis tick={{ fontSize: 8, fontFamily: mono, fill: '#555f75' }} tickFormatter={v => fmtNum(v)} />
                    <Tooltip contentStyle={{ background: '#111827', border: '1px solid var(--b1)', borderRadius: 6, fontFamily: mono, fontSize: 10 }} />
                    <Bar dataKey="engagement" fill="#f97316" radius={[4, 4, 0, 0]} barSize={20} />
                  </BarChart>
                </ResponsiveContainer>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '10px' }}>
                  {topicData.map(t => (
                    <span key={t.name} style={{ fontFamily: mono, fontSize: '7px', padding: '2px 6px', borderRadius: '10px', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)', color: '#fdba74' }}>
                      {t.name} ({t.count})
                    </span>
                  ))}
                </div>
              </>
            )}
          </div>

          {/* Competitor comparison */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '16px' }}>
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>COMPETITOR AUDIENCE COMPARISON</div>
            {competitors.length === 0 ? (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '30px 20px' }}>
                <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>NO COMPETITOR DATA</span>
                <span style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', textAlign: 'center', lineHeight: 1.6 }}>
                  Add tracked politicians in Settings to see audience comparison
                </span>
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                {/* Self */}
                <CompetitorRow
                  name={account?.politician_name || 'You'}
                  party={account?.party || ''}
                  mentions={totals.mentions}
                  engagement={totals.engagement}
                  sentimentPct={totals.mentions > 0 ? Math.round(totals.positive / totals.mentions * 100) : 0}
                  isSelf
                  maxEng={Math.max(totals.engagement, ...competitors.map(c => c.statements_today ?? 0))}
                />
                {competitors.map(c => (
                  <CompetitorRow
                    key={c.politician.name}
                    name={c.politician.name}
                    party={c.politician.party || ''}
                    mentions={c.statements_today ?? 0}
                    engagement={c.statements_today ?? 0}
                    sentimentPct={50}
                    maxEng={Math.max(totals.engagement, ...competitors.map(cc => cc.statements_today ?? 0))}
                  />
                ))}
              </div>
            )}
          </div>
        </div>

        {/* ── Footer note ──────────────────────────────────────────────────── */}
        <div style={{ textAlign: 'center', padding: '16px', fontFamily: mono, fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px' }}>
          AUDIENCE INTELLIGENCE — DATA REFRESHES EVERY 5 MINUTES · BHARAT<span style={{ color: '#f97316' }}>MONITOR</span> v2.0
        </div>
      </div>
    </div>
  )
}

// ─── Sub-components ──────────────────────────────────────────────────────────

function PlatBtn({ platform, label, color, active, onClick, count }: {
  platform: Platform | 'all'; label: string; color: string; active: boolean; onClick: () => void; count: number
}) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        padding: '5px 10px', borderRadius: '20px', flexShrink: 0,
        border: `1px solid ${active ? color + '50' : 'var(--b1)'}`,
        background: active ? color + '18' : 'transparent',
        color: active ? color : 'var(--t2)',
        fontFamily: mono, fontSize: '8px',
        cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s',
      }}
    >
      {platform !== 'all' && <div style={{ width: 5, height: 5, borderRadius: '50%', background: color, flexShrink: 0 }} />}
      {label}
      <span style={{ fontFamily: mono, fontSize: '7px', opacity: 0.7 }}>({count})</span>
    </button>
  )
}

function MiniStat({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: '6px', color: 'var(--t3)', letterSpacing: '0.5px' }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: '12px', fontWeight: 600, color: color || 'var(--t0)', lineHeight: 1.3 }}>{value}</div>
    </div>
  )
}

function CompetitorRow({ name, party, mentions, engagement, sentimentPct, isSelf, maxEng }: {
  name: string; party: string; mentions: number; engagement: number; sentimentPct: number; isSelf?: boolean; maxEng: number
}) {
  const pct = maxEng > 0 ? Math.max(5, (engagement / maxEng) * 100) : 5
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', borderRadius: '6px',
      background: isSelf ? 'rgba(249,115,22,0.06)' : 'var(--s2)',
      border: `1px solid ${isSelf ? 'rgba(249,115,22,0.2)' : 'var(--b0)'}`,
    }}>
      <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: isSelf ? 'linear-gradient(135deg, #f97316, #ef4444)' : 'var(--s3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '9px', color: isSelf ? '#fff' : 'var(--t2)', fontWeight: 600, flexShrink: 0 }}>
        {name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '10px', color: isSelf ? '#f97316' : 'var(--t0)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {name} {isSelf && <span style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)' }}>· YOU</span>}
        </div>
        <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', marginTop: '2px' }}>{party}</div>
        <div style={{ height: '3px', borderRadius: '2px', background: 'var(--b0)', marginTop: '3px', overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: isSelf ? '#f97316' : 'var(--acc)', borderRadius: '2px' }} />
        </div>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
        <span style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t1)', fontWeight: 600 }}>{mentions > 1000 ? `${(mentions/1000).toFixed(0)}K` : mentions}</span>
        <span style={{ fontFamily: mono, fontSize: '7px', color: sentimentPct >= 50 ? '#22d3a0' : '#f03e3e' }}>{sentimentPct}% pos</span>
      </div>
    </div>
  )
}
