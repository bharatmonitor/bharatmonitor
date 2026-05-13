import { useState, useMemo } from 'react'
import type { FeedItem, Account, CompetitorSummary, AIBrief } from '@/types'

// ─── Interfaces ─────────────────────────────────────────────────────────────

interface Props {
  feed: FeedItem[]
  account: Account
  competitors: CompetitorSummary[]
  brief: AIBrief | null
  onClose: () => void
}

// ─── Word frequency extraction ──────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by',
  'from','is','it','as','was','are','this','that','be','has','have','had',
  'not','they','we','he','she','you','i','my','your','our','his','her','its',
  'will','can','would','could','should','may','might','shall','do','does','did',
  'been','being','am','were','more','than','just','also','very','so','up','out',
  'about','if','into','which','their','new','one','all','over','after','before',
  'between','under','when','where','how','who','what','why',
  'rt','via','https','http','www','com','said','says',
])

function extractWords(feed: FeedItem[]): Array<{ word: string; count: number; sentiment: string }> {
  const wordMap = new Map<string, { count: number; pos: number; neg: number }>()
  for (const item of feed) {
    const text = `${item.headline} ${item.body || ''}`.toLowerCase()
    const words = text.replace(/[^\w\s\u0900-\u097F]/g, ' ').split(/\s+/).filter(w => w.length > 3 && !STOP_WORDS.has(w))
    const sentVal = item.sentiment === 'positive' ? 1 : item.sentiment === 'negative' ? -1 : 0
    for (const word of words) {
      const existing = wordMap.get(word)
      if (existing) {
        existing.count++
        if (sentVal > 0) existing.pos++
        if (sentVal < 0) existing.neg++
      } else {
        wordMap.set(word, { count: 1, pos: sentVal > 0 ? 1 : 0, neg: sentVal < 0 ? 1 : 0 })
      }
    }
  }
  return Array.from(wordMap.entries())
    .map(([word, data]) => ({
      word,
      count: data.count,
      sentiment: data.pos > data.neg ? 'positive' : data.neg > data.pos ? 'negative' : 'neutral',
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 60)
}

// ─── Top sources / people extraction ────────────────────────────────────────

interface TopPerson {
  name: string
  platform: string
  mentions: number
  sentiment: 'positive' | 'negative' | 'neutral'
  posCount: number
  negCount: number
  neuCount: number
  lastSeen: string
}

function extractTopPeople(feed: FeedItem[]): TopPerson[] {
  const sourceMap = new Map<string, { platform: string; mentions: number; pos: number; neg: number; neu: number; lastSeen: string }>()
  for (const item of feed) {
    const src = (item.source || '').trim()
    if (!src || src.length < 2) continue
    const key = src.toLowerCase()
    const existing = sourceMap.get(key)
    const sentVal = item.sentiment
    if (existing) {
      existing.mentions++
      if (sentVal === 'positive') existing.pos++
      else if (sentVal === 'negative') existing.neg++
      else existing.neu++
      if (item.published_at > existing.lastSeen) existing.lastSeen = item.published_at
    } else {
      sourceMap.set(key, {
        platform: item.platform,
        mentions: 1,
        pos: sentVal === 'positive' ? 1 : 0,
        neg: sentVal === 'negative' ? 1 : 0,
        neu: sentVal === 'neutral' ? 1 : 0,
        lastSeen: item.published_at,
      })
    }
  }
  return Array.from(sourceMap.entries())
    .map(([_, data]) => ({
      name: _.startsWith('@') ? _ : _,
      platform: data.platform,
      mentions: data.mentions,
      sentiment: (data.pos > data.neg ? 'positive' : data.neg > data.pos ? 'negative' : 'neutral') as TopPerson['sentiment'],
      posCount: data.pos,
      negCount: data.neg,
      neuCount: data.neu,
      lastSeen: data.lastSeen,
    }))
    .sort((a, b) => b.mentions - a.mentions)
    .slice(0, 50)
}

// ─── Platform metrics ───────────────────────────────────────────────────────

interface PlatformMetric {
  platform: string
  total: number
  positive: number
  negative: number
  neutral: number
  engagement: number
  trending: number
  sentimentPct: number
}

function computePlatformMetrics(feed: FeedItem[]): PlatformMetric[] {
  const platMap = new Map<string, { total: number; pos: number; neg: number; neu: number; engagement: number; trending: number }>()
  for (const item of feed) {
    const p = item.platform || 'unknown'
    const existing = platMap.get(p)
    const eng = item.engagement || item.views || 0
    const isTrending = item.is_trending ? 1 : 0
    if (existing) {
      existing.total++
      if (item.sentiment === 'positive') existing.pos++
      else if (item.sentiment === 'negative') existing.neg++
      else existing.neu++
      existing.engagement += eng
      existing.trending += isTrending
    } else {
      platMap.set(p, {
        total: 1,
        pos: item.sentiment === 'positive' ? 1 : 0,
        neg: item.sentiment === 'negative' ? 1 : 0,
        neu: item.sentiment === 'neutral' ? 1 : 0,
        engagement: eng,
        trending: isTrending,
      })
    }
  }
  return Array.from(platMap.entries())
    .map(([plat, data]) => ({
      platform: plat,
      total: data.total,
      positive: data.pos,
      negative: data.neg,
      neutral: data.neu,
      engagement: data.engagement,
      trending: data.trending,
      sentimentPct: data.total ? Math.round((data.pos / data.total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total)
}

// ─── AI "Why" Analysis (client-side inference from feed patterns) ────────────

function generateWhyAnalysis(feed: FeedItem[], brief: AIBrief | null): string[] {
  const insights: string[] = []
  if (!feed.length) return ['No feed data available yet. Connect data sources to start seeing AI insights.']

  const total = feed.length
  const pos = feed.filter(f => f.sentiment === 'positive').length
  const neg = feed.filter(f => f.sentiment === 'negative').length
  const crisis = feed.filter(f => f.bucket === 'red').length
  const sentPct = Math.round((pos / total) * 100)

  // Sentiment analysis
  if (sentPct >= 60) insights.push(`Positive sentiment at ${sentPct}% — driven primarily by ${feed.filter(f => f.sentiment === 'positive').slice(0, 3).map(f => f.source).filter(Boolean).join(', ') || 'multiple sources'}.`)
  else if (sentPct < 40) insights.push(`Sentiment is below 40% positive (${sentPct}%). Negative drivers: ${feed.filter(f => f.sentiment === 'negative').slice(0, 3).map(f => `"${f.headline.slice(0, 50)}"`).join(', ')}.`)

  // Crisis detection
  if (crisis > 0) {
    const crisisTopics = [...new Set(feed.filter(f => f.bucket === 'red').flatMap(f => f.topic_tags || []))].slice(0, 3)
    insights.push(`${crisis} crisis-level items detected${crisisTopics.length ? ` related to: ${crisisTopics.join(', ')}` : ''}. Monitor closely and prepare response.`)
  }

  // Platform concentration
  const platforms = computePlatformMetrics(feed)
  const topPlat = platforms[0]
  if (topPlat && topPlat.total > total * 0.5) {
    insights.push(`${Math.round((topPlat.total / total) * 100)}% of mentions are from ${topPlat.platform}. Consider diversifying monitoring across platforms.`)
  }

  // Volume spikes — look at date clustering
  const dayMap = new Map<string, number>()
  feed.forEach(f => {
    const day = f.published_at.slice(0, 10)
    dayMap.set(day, (dayMap.get(day) || 0) + 1)
  })
  const days = Array.from(dayMap.entries()).sort(([a], [b]) => b.localeCompare(a))
  if (days.length >= 2 && days[0][1] > days[1][1] * 1.5) {
    insights.push(`Volume spike on ${days[0][0]}: ${days[0][1]} items vs ${days[1][1]} previous day (+${Math.round(((days[0][1] - days[1][1]) / days[1][1]) * 100)}%). Investigate what triggered the surge.`)
  }

  // Geo concentration
  const geoTags = feed.flatMap(f => f.geo_tags || [])
  const geoMap = new Map<string, number>()
  geoTags.forEach(g => geoMap.set(g, (geoMap.get(g) || 0) + 1))
  const topGeo = Array.from(geoMap.entries()).sort(([, a], [, b]) => b - a).slice(0, 3)
  if (topGeo.length) {
    insights.push(`Geographic concentration: ${topGeo.map(([g, c]) => `${g} (${c})`).join(', ')}. Consider targeted responses for these regions.`)
  }

  // Brief analysis
  if (brief?.situation_summary) {
    insights.push(`AI Brief: ${brief.situation_summary.slice(0, 200)}`)
  }

  if (insights.length === 0) {
    insights.push('Feed data is being aggregated. Insights will appear as more data accumulates.')
  }

  return insights
}

// ─── Styling constants ──────────────────────────────────────────────────────

const mono = 'IBM Plex Mono, monospace'
const SENT_COLORS = { positive: '#22d3a0', negative: '#f03e3e', neutral: '#8892a4' }
const PLAT_COLORS: Record<string, string> = {
  twitter: '#1d9bf0', instagram: '#e1306c', facebook: '#1877f2',
  youtube: '#ff2020', news: '#8892a4', reddit: '#ff4500', whatsapp: '#25d366',
}

// ─── Main Component ─────────────────────────────────────────────────────────

type Tab = 'overview' | 'audience' | 'platforms' | 'ai' | 'competitors'

export default function AnalyticsPanel({ feed, account, competitors, brief, onClose }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('overview')
  const [peopleFilter, setPeopleFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all')

  const words = useMemo(() => extractWords(feed), [feed])
  const topPeople = useMemo(() => extractTopPeople(feed), [feed])
  const platformMetrics = useMemo(() => computePlatformMetrics(feed), [feed])
  const whyAnalysis = useMemo(() => generateWhyAnalysis(feed, brief), [feed, brief])

  const filteredPeople = useMemo(() =>
    peopleFilter === 'all' ? topPeople : topPeople.filter(p => p.sentiment === peopleFilter)
  , [topPeople, peopleFilter])

  const tabs: { id: Tab; label: string }[] = [
    { id: 'overview', label: 'OVERVIEW' },
    { id: 'audience', label: 'AUDIENCE' },
    { id: 'platforms', label: 'PLATFORMS' },
    { id: 'ai', label: 'AI INSIGHTS' },
    { id: 'competitors', label: 'COMPETITORS' },
  ]

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.88)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '14px', width: '100%', maxWidth: '960px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: '10px', letterSpacing: '2px', color: 'var(--acc)' }}>COMPREHENSIVE ANALYTICS</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t0)', marginTop: '2px' }}>{account.politician_name || 'Dashboard'} — Intelligence Report</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>{feed.length} items analyzed</span>
            <button onClick={onClose} style={{ background: 'var(--s3)', border: '1px solid var(--b1)', color: 'var(--t1)', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontFamily: mono, fontSize: '9px' }}>✕ CLOSE</button>
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', padding: '10px 20px', gap: '4px', borderBottom: '1px solid var(--b1)', flexShrink: 0 }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              flex: 1, padding: '6px 4px', borderRadius: '5px',
              border: `1px solid ${activeTab === t.id ? 'var(--acc)' : 'var(--b1)'}`,
              background: activeTab === t.id ? '#7c6dfa15' : 'transparent',
              color: activeTab === t.id ? 'var(--acc)' : 'var(--t2)',
              fontFamily: mono, fontSize: '8px', letterSpacing: '1px', cursor: 'pointer', transition: 'all .15s',
            }}>{t.label}</button>
          ))}
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {/* ── OVERVIEW TAB ─────────────────────────────────────────── */}
          {activeTab === 'overview' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {/* KPI strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '10px' }}>
                {[
                  { label: 'TOTAL ITEMS', value: feed.length, color: 'var(--t0)' },
                  { label: 'POSITIVE', value: feed.filter(f => f.sentiment === 'positive').length, color: '#22d3a0' },
                  { label: 'NEGATIVE', value: feed.filter(f => f.sentiment === 'negative').length, color: '#f03e3e' },
                  { label: 'CRISIS', value: feed.filter(f => f.bucket === 'red').length, color: '#f03e3e' },
                  { label: 'SOURCES', value: new Set(feed.map(f => f.source)).size, color: 'var(--acc)' },
                ].map(kpi => (
                  <div key={kpi.label} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '12px' }}>
                    <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px', marginBottom: '4px' }}>{kpi.label}</div>
                    <div style={{ fontFamily: mono, fontSize: '22px', fontWeight: 700, color: kpi.color, lineHeight: 1 }}>{kpi.value}</div>
                  </div>
                ))}
              </div>

              {/* Sentiment distribution bar */}
              <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '10px' }}>SENTIMENT DISTRIBUTION</div>
                <div style={{ display: 'flex', height: '20px', borderRadius: '4px', overflow: 'hidden', gap: '2px' }}>
                  {['positive', 'negative', 'neutral'].map(s => {
                    const count = feed.filter(f => f.sentiment === s).length
                    const pct = feed.length ? (count / feed.length) * 100 : 0
                    return pct > 0 ? (
                      <div key={s} style={{
                        width: `${pct}%`, background: SENT_COLORS[s as keyof typeof SENT_COLORS],
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontFamily: mono, fontSize: '7px', color: '#fff', minWidth: '30px',
                      }}>{Math.round(pct)}%</div>
                    ) : null
                  })}
                </div>
              </div>

              {/* Word Cloud (CSS-based) */}
              <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '10px' }}>KEYWORD CLOUD — TOP TOPICS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', alignItems: 'baseline', justifyContent: 'center', padding: '8px 0' }}>
                  {words.slice(0, 40).map((w, i) => {
                    const maxCount = words[0]?.count || 1
                    const scale = 0.6 + (w.count / maxCount) * 1.4
                    const color = SENT_COLORS[w.sentiment as keyof typeof SENT_COLORS] || 'var(--t1)'
                    return (
                      <span key={w.word} style={{
                        fontFamily: mono, fontSize: `${Math.round(10 * scale)}px`,
                        color, opacity: 0.7 + (w.count / maxCount) * 0.3,
                        padding: '2px 4px', cursor: 'default',
                        transition: 'opacity .15s',
                      }} title={`${w.word}: ${w.count} mentions (${w.sentiment})`}>
                        {w.word}
                      </span>
                    )
                  })}
                </div>
                {words.length === 0 && (
                  <div style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t3)', textAlign: 'center', padding: '16px' }}>
                    No keyword data yet — feed items will populate this cloud
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── AUDIENCE TAB ─────────────────────────────────────────── */}
          {activeTab === 'audience' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t2)', lineHeight: 1.8 }}>
                Top {filteredPeople.length} sources/people by mention volume — derived from live feed. Filter by sentiment to see who's driving positive, negative, or neutral conversation.
              </div>

              {/* Sentiment filter */}
              <div style={{ display: 'flex', gap: '6px' }}>
                {(['all', 'positive', 'negative', 'neutral'] as const).map(s => (
                  <button key={s} onClick={() => setPeopleFilter(s)} style={{
                    flex: 1, padding: '6px', borderRadius: '5px',
                    border: `1px solid ${peopleFilter === s ? (s === 'all' ? 'var(--acc)' : SENT_COLORS[s] + '60') : 'var(--b1)'}`,
                    background: peopleFilter === s ? (s === 'all' ? '#7c6dfa15' : SENT_COLORS[s] + '15') : 'transparent',
                    color: peopleFilter === s ? (s === 'all' ? 'var(--acc)' : SENT_COLORS[s]) : 'var(--t2)',
                    fontFamily: mono, fontSize: '8px', cursor: 'pointer', textTransform: 'uppercase',
                  }}>
                    {s} {s !== 'all' ? `(${topPeople.filter(p => p.sentiment === s).length})` : `(${topPeople.length})`}
                  </button>
                ))}
              </div>

              {/* People list */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                {filteredPeople.slice(0, 50).map((person, idx) => (
                  <div key={person.name} style={{
                    background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '10px 12px',
                    display: 'flex', alignItems: 'center', gap: '10px',
                  }}>
                    <div style={{
                      width: '28px', height: '28px', borderRadius: '7px',
                      background: `${PLAT_COLORS[person.platform] || '#888'}18`,
                      border: `1px solid ${PLAT_COLORS[person.platform] || '#888'}30`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: mono, fontSize: '9px', color: PLAT_COLORS[person.platform] || '#888', flexShrink: 0,
                    }}>
                      {idx + 1}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {person.name}
                      </div>
                      <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', marginTop: '2px' }}>
                        {person.platform} · {person.mentions} mentions · {person.posCount}+ {person.negCount}− {person.neuCount}○
                      </div>
                    </div>
                    <div style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: SENT_COLORS[person.sentiment], flexShrink: 0,
                    }} title={person.sentiment} />
                  </div>
                ))}
              </div>
              {filteredPeople.length === 0 && (
                <div style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t3)', textAlign: 'center', padding: '24px' }}>
                  No sources found for this filter. Feed data will populate as items arrive.
                </div>
              )}
            </div>
          )}

          {/* ── PLATFORMS TAB ─────────────────────────────────────────── */}
          {activeTab === 'platforms' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {platformMetrics.map(pm => {
                const color = PLAT_COLORS[pm.platform] || '#888'
                return (
                  <div key={pm.platform} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '14px 16px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: color }} />
                      <div style={{ fontFamily: mono, fontSize: '10px', color: 'var(--t0)', letterSpacing: '1px', textTransform: 'uppercase', fontWeight: 600 }}>{pm.platform}</div>
                      <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', marginLeft: 'auto' }}>{pm.total} items</span>
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '8px' }}>
                      {[
                        { l: 'SENTIMENT', v: `${pm.sentimentPct}%`, c: pm.sentimentPct >= 50 ? '#22d3a0' : '#f03e3e' },
                        { l: 'POSITIVE', v: pm.positive, c: '#22d3a0' },
                        { l: 'NEGATIVE', v: pm.negative, c: '#f03e3e' },
                        { l: 'ENGAGEMENT', v: pm.engagement > 1000 ? `${(pm.engagement / 1000).toFixed(0)}K` : pm.engagement, c: color },
                        { l: 'TRENDING', v: pm.trending, c: 'var(--yel)' },
                      ].map(m => (
                        <div key={m.l}>
                          <div style={{ fontFamily: mono, fontSize: '6px', color: 'var(--t3)', letterSpacing: '0.5px' }}>{m.l}</div>
                          <div style={{ fontFamily: mono, fontSize: '14px', fontWeight: 700, color: m.c as string, lineHeight: 1.3 }}>{m.v}</div>
                        </div>
                      ))}
                    </div>
                    {/* Sentiment bar for this platform */}
                    <div style={{ display: 'flex', height: '4px', borderRadius: '2px', overflow: 'hidden', gap: '1px', marginTop: '8px' }}>
                      {pm.positive > 0 && <div style={{ width: `${(pm.positive / pm.total) * 100}%`, background: '#22d3a0' }} />}
                      {pm.negative > 0 && <div style={{ width: `${(pm.negative / pm.total) * 100}%`, background: '#f03e3e' }} />}
                      {pm.neutral > 0 && <div style={{ width: `${(pm.neutral / pm.total) * 100}%`, background: '#2e3650' }} />}
                    </div>
                  </div>
                )
              })}
              {platformMetrics.length === 0 && (
                <div style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t3)', textAlign: 'center', padding: '24px' }}>
                  No platform data yet. Connect data sources to start tracking.
                </div>
              )}
            </div>
          )}

          {/* ── AI INSIGHTS TAB ──────────────────────────────────────── */}
          {activeTab === 'ai' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--acc)', letterSpacing: '1px', marginBottom: '4px' }}>
                ◈ AI-POWERED ANALYSIS — WHY BEHIND THE DATA
              </div>
              {whyAnalysis.map((insight, i) => (
                <div key={i} style={{
                  background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '14px 16px',
                  display: 'flex', gap: '10px', alignItems: 'flex-start',
                }}>
                  <div style={{
                    width: '24px', height: '24px', borderRadius: '6px',
                    background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.2)',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: mono, fontSize: '9px', color: '#f97316', flexShrink: 0,
                  }}>{i + 1}</div>
                  <div style={{ fontSize: '11px', color: 'var(--t0)', lineHeight: 1.7 }}>{insight}</div>
                </div>
              ))}

              {/* Recommendations */}
              <div style={{ marginTop: '8px', background: 'rgba(124,109,250,0.06)', border: '1px solid rgba(124,109,250,0.2)', borderRadius: '8px', padding: '14px 16px' }}>
                <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--acc)', letterSpacing: '1px', marginBottom: '8px' }}>RECOMMENDATIONS</div>
                <div style={{ fontSize: '11px', color: 'var(--t1)', lineHeight: 1.7 }}>
                  {feed.length === 0
                    ? 'Connect data sources (Google CSE, Supabase edge functions, RSS feeds) to start receiving AI-powered recommendations.'
                    : feed.filter(f => f.bucket === 'red').length > 0
                    ? 'Prioritize responding to crisis-level items. Draft counter-narratives for negative coverage. Amplify positive stories through social channels.'
                    : 'Sentiment is stable. Continue monitoring. Consider proactive content around top positive keywords to maintain momentum.'
                  }
                </div>
              </div>
            </div>
          )}

          {/* ── COMPETITORS TAB ──────────────────────────────────────── */}
          {activeTab === 'competitors' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {competitors.length === 0 ? (
                <div style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t3)', textAlign: 'center', padding: '24px' }}>
                  No competitors configured. Add tracked politicians in Settings → Tracking to enable competitor benchmarking.
                </div>
              ) : (
                competitors.map(c => (
                  <div key={c.politician.id} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '14px 16px', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{
                      width: '36px', height: '36px', borderRadius: '9px',
                      background: c.politician.is_competitor ? 'rgba(240,62,62,0.1)' : 'rgba(34,211,160,0.1)',
                      border: `1px solid ${c.politician.is_competitor ? 'rgba(240,62,62,0.2)' : 'rgba(34,211,160,0.2)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: mono, fontSize: '12px', color: c.politician.is_competitor ? '#f03e3e' : '#22d3a0', flexShrink: 0,
                    }}>{c.politician.initials}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--t0)' }}>{c.politician.name}</div>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', marginTop: '2px' }}>
                        {c.politician.party} · {c.statements_today} statements · {c.contradictions_flagged} contradictions flagged
                      </div>
                    </div>
                    <span style={{
                      fontFamily: mono, fontSize: '7px', padding: '3px 8px', borderRadius: '4px',
                      background: c.status === 'contradiction' ? 'rgba(245,166,35,0.1)' : c.status === 'clear' ? 'rgba(34,211,160,0.1)' : 'rgba(255,255,255,0.04)',
                      color: c.status === 'contradiction' ? '#f5a623' : c.status === 'clear' ? '#22d3a0' : 'var(--t3)',
                    }}>{c.status.toUpperCase()}</span>
                  </div>
                ))
              )}
              <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)', lineHeight: 1.7, padding: '8px 0' }}>
                Competitor benchmarking compares your mentions, sentiment, and narrative ownership against tracked politicians. Full benchmarking requires Supabase edge functions to be deployed with ingestion for competitor keywords.
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}
