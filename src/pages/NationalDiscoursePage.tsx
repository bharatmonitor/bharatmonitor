// BharatMonitor — National Discourse Page
// Full-page GovernanceVibe-style intelligence view
// Tracks 150 journalist/politician handles + 64 national keywords
// Shows live feed, topic clusters, volume by keyword category, watchlist activity

import { useState, useMemo, useEffect } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useFeedItems, useAccount } from '@/hooks/useData'
import NavBar from '@/components/layout/NavBar'
import { POLITICAL_WATCHLIST, NATIONAL_DISCOURSE_KEYWORDS, getNationalKeywordsForCycle } from '@/lib/nationalDiscourse'
import { ANON_KEY, SUPABASE_URL, SERVICE_KEY } from '@/lib/supabase'
import type { FeedItem } from '@/types'

// ─── Design tokens ─────────────────────────────────────────────────────────────
const mono   = '"IBM Plex Mono", monospace'
const DARK   = '#0d1018'
const CARD   = '#111827'
const CARD2  = '#161d2c'
const BORDER = 'rgba(255,255,255,0.07)'
const ACC    = '#f97316'
const GREEN  = '#22d3a0'
const RED    = '#f03e3e'
const YELLOW = '#f5a623'
const BLUE   = '#3d8ef0'
const PURPLE = '#7c6dfa'
const T0     = '#edf0f8'
const T1     = '#c8d0e0'
const T2     = '#8892a4'
const T3     = '#545f78'

const PLAT_COLORS: Record<string, string> = {
  twitter: '#1d9bf0', news: '#8892a4', reddit: '#ff4500',
  bluesky: '#0085ff', youtube: '#ff2020', instagram: '#e1306c',
}

const CATEGORY_COLORS: Record<string, string> = {
  governance: ACC, opposition: RED, economy: GREEN,
  social: PURPLE, elections: YELLOW, institutional: BLUE,
  geopolitics: '#00c9a7', crisis: '#ff6b6b',
}

// ─── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, color, sub }: { label: string; value: string | number; color: string; sub?: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '14px 16px' }}>
      <div style={{ fontFamily: mono, fontSize: '7px', color: T3, letterSpacing: '1px', marginBottom: '6px' }}>{label}</div>
      <div style={{ fontFamily: mono, fontSize: '22px', fontWeight: 700, color, lineHeight: 1 }}>{value}</div>
      {sub && <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginTop: '4px' }}>{sub}</div>}
    </div>
  )
}

function FeedRow({ item, rank }: { item: FeedItem; rank: number }) {
  const bc = item.bucket === 'red' ? RED : item.bucket === 'yellow' ? YELLOW : item.bucket === 'blue' ? BLUE : T3
  const sc = item.sentiment === 'positive' ? GREEN : item.sentiment === 'negative' ? RED : T3
  return (
    <div style={{ display: 'flex', gap: '10px', padding: '9px 10px', borderBottom: `1px solid ${BORDER}`, transition: 'background .12s', cursor: 'pointer' }}
      onMouseEnter={e => { e.currentTarget.style.background = CARD2 }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      onClick={() => item.url && window.open(item.url, '_blank')}>
      <span style={{ fontFamily: mono, fontSize: '9px', color: T3, width: '18px', flexShrink: 0, paddingTop: '2px' }}>{rank}</span>
      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: bc, flexShrink: 0, marginTop: '6px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: T0, lineHeight: 1.5, marginBottom: '3px' }}>{item.headline}</div>
        <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
          <span style={{ fontFamily: mono, fontSize: '8px', color: PLAT_COLORS[item.platform] || T2 }}>{item.platform?.toUpperCase()}</span>
          <span style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>{item.source}</span>
          <span style={{ fontFamily: mono, fontSize: '7px', color: sc, background: sc + '12', padding: '1px 5px', borderRadius: '3px' }}>{item.sentiment?.toUpperCase()}</span>
          {item.keyword && <span style={{ fontFamily: mono, fontSize: '7px', color: PURPLE }}>{item.keyword}</span>}
        </div>
      </div>
      {(item.engagement || 0) > 0 && (
        <span style={{ fontFamily: mono, fontSize: '8px', color: T3, flexShrink: 0, alignSelf: 'center' }}>
          {(item.engagement || 0) > 999 ? `${((item.engagement || 0) / 1000).toFixed(1)}K` : item.engagement}
        </span>
      )}
    </div>
  )
}

// ─── Main Page ─────────────────────────────────────────────────────────────────

export default function NationalDiscoursePage() {
  const { data: account } = useAccount()
  const accountId = account?.id || ''
  const { data: allFeed = [] } = useFeedItems(accountId)
  const qc = useQueryClient()

  const [running, setRunning]         = useState(false)
  const [lastInserted, setLastInserted] = useState(0)
  const [error, setError]             = useState('')
  const [activeTab, setActiveTab]     = useState<'feed' | 'keywords' | 'watchlist' | 'report'>('feed')
  const [activeCat, setActiveCat]     = useState<string>('all')
  const [reportMode, setReportMode]   = useState<'topics' | 'handles'>('topics')
  const [lastRunTime, setLastRunTime] = useState<string | null>(null)

  // Filter to national_mode items only
  const nationalFeed = useMemo(() =>
    allFeed.filter(f => (f as any).national_mode === true || f.keyword?.toLowerCase().includes('modi') || f.keyword?.toLowerCase().includes('congress'))
      .slice(0, 300)
  , [allFeed])

  // Category filter
  const filteredFeed = useMemo(() => {
    if (activeCat === 'all') return nationalFeed
    const kws = NATIONAL_DISCOURSE_KEYWORDS[activeCat] || []
    return nationalFeed.filter(f =>
      kws.some(kw => f.headline?.toLowerCase().includes(kw.toLowerCase()) || f.keyword?.toLowerCase().includes(kw.toLowerCase()))
    )
  }, [nationalFeed, activeCat])

  // Volume by category
  const categoryVolume = useMemo(() =>
    Object.entries(NATIONAL_DISCOURSE_KEYWORDS).map(([cat, kws]) => {
      const items = nationalFeed.filter(f =>
        kws.some(kw => f.headline?.toLowerCase().includes(kw.toLowerCase()) || f.keyword?.toLowerCase().includes(kw.toLowerCase()))
      )
      const pos = items.filter(f => f.sentiment === 'positive').length
      const neg = items.filter(f => f.sentiment === 'negative').length
      return { cat, count: items.length, pos, neg, score: items.length ? Math.round(50 + ((pos - neg) / items.length) * 50) : 50 }
    }).sort((a, b) => b.count - a.count)
  , [nationalFeed])

  const maxCatCount = Math.max(...categoryVolume.map(c => c.count), 1)

  // Top handles in feed
  const handleActivity = useMemo(() => {
    const counts: Record<string, { count: number; pos: number; neg: number; handle: string }> = {}
    nationalFeed.forEach(f => {
      const h = f.source?.replace('@', '') || ''
      if (!h || h.length < 3) return
      if (!counts[h]) counts[h] = { count: 0, pos: 0, neg: 0, handle: f.source || h }
      counts[h].count++
      if (f.sentiment === 'positive') counts[h].pos++
      if (f.sentiment === 'negative') counts[h].neg++
    })
    return Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 20)
  }, [nationalFeed])

  // Topic clusters (top 10 topics from topic_tags)
  const topicClusters = useMemo(() => {
    const topics: Record<string, { count: number; pos: number; neg: number; items: FeedItem[] }> = {}
    nationalFeed.forEach(f => {
      (f.topic_tags || []).forEach(tag => {
        if (!topics[tag]) topics[tag] = { count: 0, pos: 0, neg: 0, items: [] }
        topics[tag].count++
        topics[tag].items.push(f)
        if (f.sentiment === 'positive') topics[tag].pos++
        if (f.sentiment === 'negative') topics[tag].neg++
      })
    })
    return Object.entries(topics).map(([topic, d]) => ({ topic, ...d })).sort((a, b) => b.count - a.count).slice(0, 12)
  }, [nationalFeed])

  // Sentiment stats
  const stats = useMemo(() => {
    const pos = nationalFeed.filter(f => f.sentiment === 'positive').length
    const neg = nationalFeed.filter(f => f.sentiment === 'negative').length
    const crisis = nationalFeed.filter(f => f.bucket === 'red').length
    const developing = nationalFeed.filter(f => f.bucket === 'yellow').length
    return { total: nationalFeed.length, pos, neg, crisis, developing, neutral: nationalFeed.length - pos - neg }
  }, [nationalFeed])

  // All watchlist handles
  const allHandles = [...POLITICAL_WATCHLIST.journalists, ...POLITICAL_WATCHLIST.politicians_tracked]
  // Account custom watchlist
  const customHandles = account?.watchlist_handles || []
  // Combined
  const totalHandles = allHandles.length + customHandles.length

  async function runNationalIngest() {
    if (!accountId) return
    setRunning(true)
    setError('')
    try {
      const authKey = SERVICE_KEY || ANON_KEY
      const cycleIndex = Math.floor(Date.now() / 3_600_000)
      const keywords = getNationalKeywordsForCycle(cycleIndex)

      const res = await fetch(`${SUPABASE_URL}/functions/v1/bm-ingest-v2`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${authKey}`,
          'apikey': ANON_KEY,
        },
        body: JSON.stringify({
          accountId,
          politicianName: account?.politician_name || 'National',
          keywords,
          nationalMode: true,
          maxPerSource: 20,
          watchlistHandles: [
            ...POLITICAL_WATCHLIST.journalists.slice(0, 15).map(h => ({ handle: h, platform: 'twitter', is_active: true })),
            ...customHandles.filter(h => h.is_active),
          ],
        }),
        signal: AbortSignal.timeout(90_000),
      })
      const data = await res.json()
      if (data.ok) {
        setLastInserted(data.inserted || 0)
        setLastRunTime(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }))
        qc.invalidateQueries({ queryKey: ['feed', accountId] })
      } else {
        setError(data.error || 'Ingest failed')
      }
    } catch (e: any) {
      setError(e.message)
    }
    setRunning(false)
  }

  const TABS = [
    { id: 'feed',     label: 'LIVE FEED',   icon: '◉', count: filteredFeed.length },
    { id: 'keywords', label: 'KEYWORDS',    icon: '◈', count: Object.values(NATIONAL_DISCOURSE_KEYWORDS).flat().length },
    { id: 'watchlist',label: 'WATCHLIST',   icon: '◎', count: totalHandles },
    { id: 'report',   label: 'INTELLIGENCE',icon: '⚙', count: topicClusters.length },
  ]

  return (
    <div style={{ minHeight: '100vh', background: DARK }}>
      <NavBar />

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '24px' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '2px', marginBottom: '6px' }}>NATIONAL POLITICAL INTELLIGENCE</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: T0 }}>National Discourse Monitor</div>
            <div style={{ fontFamily: mono, fontSize: '9px', color: T2, marginTop: '4px' }}>
              GovernanceVibe methodology · {totalHandles} handles tracked · {Object.values(NATIONAL_DISCOURSE_KEYWORDS).flat().length} keywords · rotating hourly
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {lastRunTime && <span style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>Last run: {lastRunTime} IST · +{lastInserted} items</span>}
            {error && <span style={{ fontFamily: mono, fontSize: '8px', color: RED }}>{error}</span>}
            <button onClick={runNationalIngest} disabled={running}
              style={{ padding: '10px 20px', background: running ? CARD2 : `rgba(124,109,250,0.15)`, border: `1px solid ${running ? BORDER : PURPLE + '60'}`, borderRadius: '8px', color: running ? T2 : PURPLE, fontFamily: mono, fontSize: '9px', fontWeight: 700, cursor: running ? 'not-allowed' : 'pointer', letterSpacing: '0.5px', transition: 'all .15s' }}>
              {running ? '⚙ FETCHING…' : '↺ FETCH NOW'}
            </button>
          </div>
        </div>

        {/* KPI strip */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px', marginBottom: '24px' }}>
          <StatCard label="TOTAL ITEMS"  value={stats.total}     color={T0}    />
          <StatCard label="CRISIS"       value={stats.crisis}    color={RED}   sub="red bucket" />
          <StatCard label="DEVELOPING"   value={stats.developing} color={YELLOW} sub="yellow bucket" />
          <StatCard label="POSITIVE"     value={stats.pos}       color={GREEN} />
          <StatCard label="NEGATIVE"     value={stats.neg}       color={RED}   />
          <StatCard label="HANDLES"      value={totalHandles}    color={PURPLE} sub="tracked accounts" />
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '2px', borderBottom: `1px solid ${BORDER}`, marginBottom: '24px' }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id as any)}
              style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '1px', padding: '10px 18px', border: 'none', background: activeTab === t.id ? `rgba(124,109,250,0.1)` : 'transparent', cursor: 'pointer', color: activeTab === t.id ? PURPLE : T2, borderBottom: `2px solid ${activeTab === t.id ? PURPLE : 'transparent'}`, marginBottom: '-1px', transition: 'all .15s' }}>
              {t.icon} {t.label} <span style={{ opacity: 0.6 }}>({t.count})</span>
            </button>
          ))}
        </div>

        {/* ── TAB: LIVE FEED ── */}
        {activeTab === 'feed' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(180px, 220px) 1fr', gap: '16px' }}>
            {/* Category filter sidebar */}
            <div>
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontFamily: mono, fontSize: '9px', color: T2, letterSpacing: '1px' }}>FILTER BY CATEGORY</span>
                </div>
                <div style={{ padding: '8px' }}>
                  <button onClick={() => setActiveCat('all')}
                    style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '6px', border: 'none', background: activeCat === 'all' ? PURPLE + '18' : 'transparent', color: activeCat === 'all' ? PURPLE : T2, fontFamily: mono, fontSize: '9px', cursor: 'pointer', marginBottom: '2px' }}>
                    ALL CATEGORIES ({nationalFeed.length})
                  </button>
                  {Object.entries(NATIONAL_DISCOURSE_KEYWORDS).map(([cat, kws]) => {
                    const count = nationalFeed.filter(f => kws.some(kw => f.headline?.toLowerCase().includes(kw.toLowerCase()))).length
                    const c = CATEGORY_COLORS[cat] || T2
                    return (
                      <button key={cat} onClick={() => setActiveCat(cat)}
                        style={{ width: '100%', textAlign: 'left', padding: '7px 10px', borderRadius: '6px', border: 'none', background: activeCat === cat ? c + '15' : 'transparent', color: activeCat === cat ? c : T2, fontFamily: mono, fontSize: '8px', cursor: 'pointer', marginBottom: '2px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ textTransform: 'uppercase', letterSpacing: '0.5px' }}>{cat}</span>
                        <span style={{ opacity: 0.7 }}>{count}</span>
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* Volume chart */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', marginTop: '12px' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontFamily: mono, fontSize: '9px', color: T2, letterSpacing: '1px' }}>DISCOURSE VOLUME</span>
                </div>
                <div style={{ padding: '12px' }}>
                  {categoryVolume.map(cv => {
                    const c = CATEGORY_COLORS[cv.cat] || T2
                    return (
                      <div key={cv.cat} style={{ marginBottom: '8px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '2px' }}>
                          <span style={{ fontFamily: mono, fontSize: '7px', color: c, textTransform: 'uppercase' }}>{cv.cat}</span>
                          <span style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>{cv.count}</span>
                        </div>
                        <div style={{ height: '3px', background: 'rgba(255,255,255,0.05)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${(cv.count / maxCatCount) * 100}%`, background: c, borderRadius: '2px' }} />
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            {/* Feed */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span style={{ fontFamily: mono, fontSize: '9px', color: T2, letterSpacing: '1px', flex: 1 }}>
                  NATIONAL FEED {activeCat !== 'all' && `— ${activeCat.toUpperCase()}`}
                </span>
                <span style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>{filteredFeed.length} items</span>
              </div>
              {filteredFeed.length === 0 ? (
                <div style={{ padding: '48px', textAlign: 'center' }}>
                  <div style={{ fontSize: '24px', marginBottom: '10px' }}>📡</div>
                  <div style={{ fontFamily: mono, fontSize: '10px', color: T1, marginBottom: '8px' }}>No national discourse data yet</div>
                  <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 2 }}>
                    Click FETCH NOW to pull data from {totalHandles} tracked handles<br />
                    and {Object.values(NATIONAL_DISCOURSE_KEYWORDS).flat().length} national keywords.
                  </div>
                </div>
              ) : (
                filteredFeed.map((item, i) => <FeedRow key={item.id} item={item} rank={i + 1} />)
              )}
            </div>
          </div>
        )}

        {/* ── TAB: KEYWORDS ── */}
        {activeTab === 'keywords' && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '16px' }}>
            {Object.entries(NATIONAL_DISCOURSE_KEYWORDS).map(([cat, kws]) => {
              const c = CATEGORY_COLORS[cat] || T2
              const vol = categoryVolume.find(cv => cv.cat === cat)
              return (
                <div key={cat} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c }} />
                    <span style={{ fontFamily: mono, fontSize: '9px', color: c, letterSpacing: '1px', textTransform: 'uppercase', flex: 1 }}>{cat}</span>
                    {vol && (
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>{vol.count} items</span>
                        <span style={{ fontFamily: mono, fontSize: '7px', color: GREEN }}>+{vol.pos}</span>
                        <span style={{ fontFamily: mono, fontSize: '7px', color: RED }}>-{vol.neg}</span>
                      </div>
                    )}
                  </div>
                  <div style={{ padding: '12px 14px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                    {kws.map(kw => {
                      const kwCount = nationalFeed.filter(f => f.headline?.toLowerCase().includes(kw.toLowerCase()) || f.keyword?.toLowerCase().includes(kw.toLowerCase())).length
                      return (
                        <span key={kw} onClick={() => { setActiveCat(cat); setActiveTab('feed') }}
                          style={{ fontFamily: mono, fontSize: '8px', padding: '3px 8px', borderRadius: '20px', background: c + '12', border: `1px solid ${c}25`, color: kwCount > 0 ? c : T3, cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: '4px' }}>
                          {kw}
                          {kwCount > 0 && <span style={{ opacity: 0.7, fontSize: '7px' }}>({kwCount})</span>}
                        </span>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* ── TAB: WATCHLIST ── */}
        {activeTab === 'watchlist' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {/* Journalists */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
              <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
                <span style={{ fontFamily: mono, fontSize: '9px', color: '#1d9bf0', letterSpacing: '1px' }}>
                  JOURNALISTS & COMMENTATORS ({POLITICAL_WATCHLIST.journalists.length})
                </span>
              </div>
              <div style={{ padding: '14px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {POLITICAL_WATCHLIST.journalists.map(h => {
                  const activity = handleActivity.find(a => a.handle === h || a.handle === h.replace('@', '') || `@${a.handle}` === h)
                  return (
                    <div key={h}
                      style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: activity ? '#1d9bf015' : 'rgba(255,255,255,0.04)', border: `1px solid ${activity ? '#1d9bf030' : BORDER}` }}>
                      <span style={{ fontFamily: mono, fontSize: '8px', color: activity ? '#1d9bf0' : T3 }}>{h}</span>
                      {activity && <span style={{ fontFamily: mono, fontSize: '7px', color: '#1d9bf080' }}>{activity.count}</span>}
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Politicians */}
            <div>
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '14px' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontFamily: mono, fontSize: '9px', color: ACC, letterSpacing: '1px' }}>
                    POLITICAL ACCOUNTS ({POLITICAL_WATCHLIST.politicians_tracked.length})
                  </span>
                </div>
                <div style={{ padding: '14px', display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {POLITICAL_WATCHLIST.politicians_tracked.map(h => {
                    const activity = handleActivity.find(a => `@${a.handle}` === h || a.handle === h.replace('@', ''))
                    return (
                      <div key={h}
                        style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '3px 8px', borderRadius: '20px', background: activity ? ACC + '12' : 'rgba(255,255,255,0.04)', border: `1px solid ${activity ? ACC + '30' : BORDER}` }}>
                        <span style={{ fontFamily: mono, fontSize: '8px', color: activity ? ACC : T3 }}>{h}</span>
                        {activity && <span style={{ fontFamily: mono, fontSize: '7px', color: ACC + '80' }}>{activity.count}</span>}
                      </div>
                    )
                  })}
                </div>
              </div>

              {/* Account custom watchlist */}
              {customHandles.length > 0 && (
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
                  <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
                    <span style={{ fontFamily: mono, fontSize: '9px', color: GREEN, letterSpacing: '1px' }}>
                      YOUR CUSTOM WATCHLIST ({customHandles.length})
                    </span>
                  </div>
                  <div style={{ padding: '14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                    {customHandles.map(h => {
                      const activity = handleActivity.find(a => a.handle === h.handle.replace('@', ''))
                      const c = h.category === 'journalist' ? '#1d9bf0' : h.category === 'politician' ? ACC : h.category === 'influencer' ? PURPLE : GREEN
                      return (
                        <div key={h.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 10px', background: CARD2, borderRadius: '7px', border: `1px solid ${h.is_active ? c + '25' : BORDER}`, opacity: h.is_active ? 1 : 0.5 }}>
                          <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: h.is_active ? GREEN : T3, flexShrink: 0 }} />
                          <span style={{ fontFamily: mono, fontSize: '9px', color: c, flex: 1 }}>{h.handle}</span>
                          {h.display_name && <span style={{ fontFamily: mono, fontSize: '8px', color: T2 }}>{h.display_name}</span>}
                          <span style={{ fontFamily: mono, fontSize: '7px', padding: '1px 5px', background: c + '12', borderRadius: '3px', color: c }}>{h.category}</span>
                          {activity && <span style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>{activity.count} items</span>}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {/* Top active handles */}
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', marginTop: '14px' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontFamily: mono, fontSize: '9px', color: T2, letterSpacing: '1px' }}>MOST ACTIVE IN CURRENT FEED</span>
                </div>
                <div style={{ padding: '10px' }}>
                  {handleActivity.slice(0, 12).map((h, i) => {
                    const sentScore = Math.round(h.pos / Math.max(h.count, 1) * 100)
                    return (
                      <div key={h.handle} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 6px', borderRadius: '5px', marginBottom: '2px' }}
                        onMouseEnter={e => { e.currentTarget.style.background = CARD2 }}
                        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                        <span style={{ fontFamily: mono, fontSize: '8px', color: T3, width: '16px' }}>{i + 1}</span>
                        <span style={{ fontFamily: mono, fontSize: '9px', color: T1, flex: 1 }}>@{h.handle}</span>
                        <span style={{ fontFamily: mono, fontSize: '7px', color: sentScore > 55 ? GREEN : sentScore < 45 ? RED : T3 }}>{sentScore}%</span>
                        <span style={{ fontFamily: mono, fontSize: '9px', color: T2, minWidth: '24px', textAlign: 'right' }}>{h.count}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── TAB: INTELLIGENCE REPORT ── */}
        {activeTab === 'report' && (
          <div>
            <div style={{ display: 'flex', gap: '4px', marginBottom: '20px' }}>
              {(['topics', 'handles'] as const).map(m => (
                <button key={m} onClick={() => setReportMode(m)}
                  style={{ padding: '7px 14px', border: `1px solid ${reportMode === m ? PURPLE : BORDER}`, borderRadius: '6px', background: reportMode === m ? PURPLE + '15' : 'transparent', color: reportMode === m ? PURPLE : T2, fontFamily: mono, fontSize: '8px', cursor: 'pointer', textTransform: 'uppercase' }}>
                  {m === 'topics' ? '⚙ TOPIC CLUSTERS' : '◎ HANDLE ANALYSIS'}
                </button>
              ))}
            </div>

            {reportMode === 'topics' && (
              <div>
                {/* Cover stats */}
                <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${PURPLE}`, borderRadius: '12px', padding: '20px 24px', marginBottom: '20px', display: 'flex', gap: '32px', alignItems: 'center' }}>
                  <div>
                    <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '2px', marginBottom: '4px' }}>SOCIAL MEDIA INTELLIGENCE REPORT</div>
                    <div style={{ fontSize: '16px', fontWeight: 700, color: T0 }}>National Discourse — {new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })}</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: '28px', fontWeight: 700, color: T0 }}>{stats.total}</div>
                    <div style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>TOTAL ITEMS</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: '28px', fontWeight: 700, color: PURPLE }}>{topicClusters.length}</div>
                    <div style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>TOPIC CLUSTERS</div>
                  </div>
                  <div style={{ textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: '28px', fontWeight: 700, color: RED }}>{stats.crisis}</div>
                    <div style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>CRISIS SIGNALS</div>
                  </div>
                </div>

                {/* Topic breakdown */}
                {topicClusters.length === 0 ? (
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: '10px', color: T1, marginBottom: '8px' }}>No topic data yet</div>
                    <div style={{ fontFamily: mono, fontSize: '9px', color: T3 }}>Click FETCH NOW to pull national discourse data</div>
                  </div>
                ) : (
                  topicClusters.map((tc, i) => {
                    const negPct = (tc.pos + tc.neg) > 0 ? Math.round(tc.neg / (tc.pos + tc.neg) * 100) : 50
                    return (
                      <div key={tc.topic} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '12px' }}>
                        <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '12px' }}>
                          <span style={{ fontFamily: mono, fontSize: '10px', color: PURPLE, fontWeight: 700 }}>Topic {i + 1}</span>
                          <span style={{ fontSize: '13px', fontWeight: 600, color: T0, flex: 1 }}>{tc.topic}</span>
                          <span style={{ fontFamily: mono, fontSize: '10px', color: T2 }}>{tc.count} posts</span>
                          <span style={{ fontFamily: mono, fontSize: '9px', color: T3 }}>{Math.round(tc.count / Math.max(stats.total, 1) * 100)}%</span>
                        </div>
                        <div style={{ padding: '14px 18px' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                            <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                              <div style={{ width: `${100 - negPct}%`, height: '100%', background: GREEN }} />
                              <div style={{ width: `${negPct}%`, height: '100%', background: RED }} />
                            </div>
                            <span style={{ fontFamily: mono, fontSize: '8px', color: GREEN }}>+{tc.pos} PRAISE</span>
                            <span style={{ fontFamily: mono, fontSize: '8px', color: RED }}>-{tc.neg} ATTACK</span>
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                            {tc.items.slice(0, 4).map(item => (
                              <div key={item.id} style={{ display: 'flex', gap: '8px', padding: '5px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                                <span style={{ fontFamily: mono, fontSize: '7px', color: item.sentiment === 'positive' ? GREEN : item.sentiment === 'negative' ? RED : T3, flexShrink: 0 }}>{item.sentiment === 'positive' ? '↑' : item.sentiment === 'negative' ? '↓' : '→'}</span>
                                <span style={{ fontSize: '10px', color: T1, lineHeight: 1.5, flex: 1 }}>{item.headline?.substring(0, 100)}</span>
                                <span style={{ fontFamily: mono, fontSize: '7px', color: T3, flexShrink: 0 }}>{item.source}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    )
                  })
                )}
              </div>
            )}

            {reportMode === 'handles' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                {handleActivity.map((h, i) => {
                  const sentScore = Math.round(h.pos / Math.max(h.count, 1) * 100)
                  const isWatchlisted = allHandles.includes(`@${h.handle}`) || allHandles.includes(h.handle)
                  return (
                    <div key={h.handle} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '14px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: '#1d9bf015', border: '1px solid #1d9bf030', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '10px', fontWeight: 700, color: '#1d9bf0', flexShrink: 0 }}>{i + 1}</div>
                        <div style={{ flex: 1 }}>
                          <div style={{ fontFamily: mono, fontSize: '10px', color: T0 }}>@{h.handle}</div>
                          {isWatchlisted && <div style={{ fontFamily: mono, fontSize: '7px', color: PURPLE }}>WATCHLISTED</div>}
                        </div>
                        <div style={{ textAlign: 'right' }}>
                          <div style={{ fontFamily: mono, fontSize: '14px', fontWeight: 700, color: T0 }}>{h.count}</div>
                          <div style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>posts</div>
                        </div>
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden', display: 'flex' }}>
                          <div style={{ width: `${sentScore}%`, height: '100%', background: GREEN }} />
                          <div style={{ width: `${100 - sentScore}%`, height: '100%', background: RED }} />
                        </div>
                        <span style={{ fontFamily: mono, fontSize: '7px', color: sentScore > 55 ? GREEN : sentScore < 45 ? RED : T3 }}>{sentScore}% pos</span>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
