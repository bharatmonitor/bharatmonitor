// BharatMonitor — Unified Analysis Page (v29)
// Merges: PoliticalTrendsPage + AudiencePage + IntelligencePage + NarrativeGapsPage
// 4 tabs: TRENDS | AUDIENCE | INTELLIGENCE | CONTRADICTIONS

import { useMemo, useState, useEffect, useRef } from 'react'
import {
  useAccount, useFeedItems, useCompetitors, useContradictions,
} from '@/hooks/useData'
import NavBar from '@/components/layout/NavBar'
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, BarChart, Bar, Cell, PieChart, Pie,
} from 'recharts'
import { ANON_KEY, SUPABASE_URL } from '@/lib/supabase'
import type { FeedItem } from '@/types'

// ─── Design tokens ────────────────────────────────────────────────────────────
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
const T0     = '#edf0f8'
const T1     = '#c8d0e0'
const T2     = '#8892a4'
const T3     = '#545f78'

const PLAT_COLORS: Record<string, string> = {
  TWITTER:'#1d9bf0', twitter:'#1d9bf0',
  INSTAGRAM:'#e1306c', instagram:'#e1306c',
  FACEBOOK:'#1877f2', facebook:'#1877f2',
  WHATSAPP:'#25d366', whatsapp:'#25d366',
  YOUTUBE:'#ff2020', youtube:'#ff2020',
  NEWS:'#8892a4', news:'#8892a4',
  REDDIT:'#ff4500', reddit:'#ff4500',
  BLUESKY:'#0085ff', bluesky:'#0085ff',
}

// ─── Shared sub-components ───────────────────────────────────────────────────

function SectionCard({
  title, badge, children, style,
}: {
  title: string; badge?: string; children: React.ReactNode; style?: React.CSSProperties
}) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', ...style }}>
      <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontFamily: mono, fontSize: '9px', color: T2, letterSpacing: '1px', flex: 1 }}>{title}</span>
        {badge && <span style={{ fontFamily: mono, fontSize: '8px', color: T3, padding: '2px 6px', background: CARD2, borderRadius: '4px' }}>{badge}</span>}
      </div>
      <div style={{ padding: '14px 16px' }}>{children}</div>
    </div>
  )
}

function FeedRow({ item, rank }: { item: FeedItem; rank: number }) {
  const bc = item.bucket === 'red' ? RED : item.bucket === 'yellow' ? YELLOW : item.bucket === 'blue' ? BLUE : T3
  const sc = item.sentiment === 'positive' ? GREEN : item.sentiment === 'negative' ? RED : T3
  return (
    <div
      style={{ display: 'flex', gap: '10px', padding: '10px 8px', borderBottom: `1px solid ${BORDER}`, transition: 'background .12s' }}
      onMouseEnter={e => { e.currentTarget.style.background = CARD2 }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      <span style={{ fontFamily: mono, fontSize: '9px', color: T3, width: '18px', flexShrink: 0, paddingTop: '2px' }}>{rank}</span>
      <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: bc, flexShrink: 0, marginTop: '5px' }} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: T0, lineHeight: 1.5, marginBottom: '3px' }}>{item.headline}</div>
        <div style={{ display: 'flex', gap: '7px', flexWrap: 'wrap', alignItems: 'center' }}>
          <span style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>{item.source}</span>
          <span style={{ fontFamily: mono, fontSize: '7px', color: PLAT_COLORS[item.platform] || T2 }}>{item.platform?.toUpperCase()}</span>
          <span style={{ fontFamily: mono, fontSize: '7px', color: sc, background: sc + '12', padding: '1px 5px', borderRadius: '3px' }}>{item.sentiment?.toUpperCase()}</span>
          {(item.geo_tags || []).slice(0, 2).map(g => <span key={g} style={{ fontFamily: mono, fontSize: '7px', color: '#7c6dfa' }}>📍{g}</span>)}
        </div>
      </div>
      {!!item.engagement && <span style={{ fontFamily: mono, fontSize: '9px', color: T3, flexShrink: 0 }}>{item.engagement > 999 ? `${(item.engagement / 1000).toFixed(1)}K` : item.engagement}</span>}
      {item.url && (
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          style={{ fontFamily: mono, fontSize: '10px', color: T3, textDecoration: 'none', flexShrink: 0 }}
          onMouseEnter={e => { e.currentTarget.style.color = ACC }}
          onMouseLeave={e => { e.currentTarget.style.color = T3 }}>↗</a>
      )}
    </div>
  )
}

// ─── Word Cloud ───────────────────────────────────────────────────────────────
function WordCloud({ words }: { words: { text: string; count: number; sentiment: string }[] }) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas || !words.length) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const W = canvas.width, H = canvas.height
    ctx.clearRect(0, 0, W, H)
    const max = Math.max(...words.map(w => w.count), 1)
    const placed: { x: number; y: number; w: number; h: number }[] = []
    const colorMap: Record<string, string> = { positive: GREEN, negative: RED, neutral: T2, sarcasm: YELLOW }
    const sorted = [...words].sort((a, b) => b.count - a.count).slice(0, 50)
    for (const word of sorted) {
      const size = Math.max(10, Math.min(32, 10 + (word.count / max) * 22))
      ctx.font = `${word.count > max * 0.6 ? 700 : 400} ${size}px 'IBM Plex Mono', monospace`
      const tw = ctx.measureText(word.text).width
      const th = size * 1.2
      let placed_ok = false
      for (let attempt = 0; attempt < 150; attempt++) {
        const angle = attempt * 0.5 * 0.8
        const r = attempt * 4.5
        const cx = W / 2 + r * Math.cos(angle)
        const cy = H / 2 + r * Math.sin(angle) * 0.6
        const x = cx - tw / 2, y = cy - th / 2
        if (x < 4 || x + tw > W - 4 || y < 4 || y + th > H - 4) continue
        const overlap = placed.some(p => x < p.x + p.w + 4 && x + tw + 4 > p.x && y < p.y + p.h + 4 && y + th + 4 > p.y)
        if (overlap) continue
        placed.push({ x, y, w: tw, h: th })
        ctx.fillStyle = colorMap[word.sentiment] || T2
        ctx.globalAlpha = 0.7 + (word.count / max) * 0.3
        ctx.fillText(word.text, x, y + size)
        placed_ok = true
        break
      }
      if (!placed_ok && sorted.indexOf(word) > 20) break
    }
    ctx.globalAlpha = 1
  }, [words])
  return (
    <div>
      <canvas ref={canvasRef} width={760} height={280} style={{ width: '100%', height: '280px', display: 'block' }} />
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'center' }}>
        {([[GREEN, 'Positive'], [RED, 'Negative'], [YELLOW, 'Sarcasm'], [T2, 'Neutral']] as [string, string][]).map(([c, l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
            <span style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Association Map ──────────────────────────────────────────────────────────
function AssociationMap({ nodes, links }: { nodes: { id: string; count: number; sentiment: string }[]; links: { source: string; target: string; strength: number }[] }) {
  const W = 680, H = 300, cx = W / 2, cy = H / 2
  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {}
    const main = nodes[0]?.id
    if (!main) return pos
    pos[main] = { x: cx, y: cy }
    nodes.slice(1).forEach((n, i) => {
      const angle = (i / (nodes.length - 1)) * Math.PI * 2
      const r = 90 + Math.random() * 50
      pos[n.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) * 0.65 }
    })
    return pos
  }, [nodes])
  const colorMap: Record<string, string> = { positive: GREEN, negative: RED, neutral: T2, sarcasm: YELLOW }
  const max = Math.max(...nodes.map(n => n.count), 1)
  return (
    <svg width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {links.map((l, i) => {
        const s = positions[l.source], t = positions[l.target]
        if (!s || !t) return null
        return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="rgba(255,255,255,0.07)" strokeWidth={l.strength * 2.5} strokeDasharray={l.strength < 0.4 ? '4,4' : 'none'} />
      })}
      {nodes.map(n => {
        const p = positions[n.id]
        if (!p) return null
        const r = 14 + (n.count / max) * 20
        const c = colorMap[n.sentiment] || T2
        const isMain = n.id === nodes[0]?.id
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r={r} fill={c + (isMain ? '30' : '18')} stroke={c} strokeWidth={isMain ? 2 : 1} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fill={c} fontSize={isMain ? 11 : 9} fontFamily={mono} fontWeight={isMain ? 700 : 400}>
              {n.id.length > 12 ? n.id.slice(0, 11) + '…' : n.id}
            </text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Circular Gauge ───────────────────────────────────────────────────────────
function CircularGauge({ value, max, label, color, sublabel }: { value: number; max: number; label: string; color: string; sublabel?: string }) {
  const pct = Math.min(value / Math.max(max, 1), 1)
  const r = 36, stroke = 8, circ = 2 * Math.PI * r
  const dash = pct * circ * 0.75
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke}
          strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeLinecap="round" transform="rotate(-225 50 50)" />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={stroke}
          strokeDasharray={`${dash} ${circ - dash + circ * 0.25}`} strokeLinecap="round" transform="rotate(-225 50 50)"
          style={{ transition: 'stroke-dasharray .6s ease' }} />
        <text x={50} y={48} textAnchor="middle" fill={color} fontSize={16} fontFamily={mono} fontWeight={700}>{value}</text>
        {sublabel && <text x={50} y={62} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={7} fontFamily={mono}>{sublabel}</text>}
      </svg>
      <span style={{ fontFamily: mono, fontSize: '8px', color: T2, letterSpacing: '0.5px', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

// ─── Intelligence types ───────────────────────────────────────────────────────
interface TopicCluster {
  title: string; postCount: number; percentage: number
  positiveCount: number; negativeCount: number
  topPositiveSources: { name: string; count: number }[]
  topNegativeSources: { name: string; count: number }[]
  narrativePoints: string[]
  sampleItems: { headline: string; source: string; platform: string; sentiment: string; url: string; published_at: string }[]
}
interface IntelReport {
  accountId: string; generatedAt: string; dateRange: { from: string; to: string }
  totalPosts: number; topicCount: number
  topics: TopicCluster[]; conclusions: { title: string; body: string }[]
}

// ─── Persona definitions ──────────────────────────────────────────────────────
const PERSONA_DEFS = [
  { id: 'rural',       label: 'Rural Voters',       icon: '🌾', color: GREEN,   desc: 'Agricultural communities, village-level support', keywords: ['village','rural','farmer','kisan','gram','panchayat','mgnrega','pm kisan','agri','irrigation','crop','msp'] },
  { id: 'urban',       label: 'Urban Middle Class', icon: '🏙️', color: BLUE,    desc: 'Urban professionals, aspirational voters',        keywords: ['city','urban','metro','inflation','income','jobs','startup','it sector','middle class','gst','housing','emi'] },
  { id: 'youth',       label: 'Youth (18-35)',       icon: '⚡', color: '#7c6dfa', desc: 'First-time voters, students, job-seekers',       keywords: ['youth','student','unemployment','jobs','education','college','neet','exam','skill','internship'] },
  { id: 'women',       label: 'Women Voters',        icon: '👩', color: '#e1306c', desc: 'Women-focused issues, safety, welfare schemes', keywords: ['women','woman','mahila','reservation','safety','beti','girl','female','gender','health','maternity'] },
  { id: 'ideological', label: 'Ideological Core',   icon: '🇮🇳', color: YELLOW, desc: 'Core base, high-loyalty supporters',              keywords: ['temple','mandir','ram','ayodhya','hindutva','nationalism','bharat','hindu','religion','patriot'] },
  { id: 'business',    label: 'Business Community', icon: '💼', color: ACC,     desc: 'Traders, industrialists, business owners',        keywords: ['business','industry','msme','gst','trade','export','investment','entrepreneur','manufacturing'] },
  { id: 'minority',    label: 'Minority Outreach',  icon: '🤝', color: '#9c59d1', desc: 'Minority communities, inclusive governance',    keywords: ['minority','muslim','christian','sikh','buddhist','dalit','obc','tribal','adivasi','sc','st','reservation'] },
  { id: 'senior',      label: 'Senior Citizens',    icon: '👴', color: '#60a5fa', desc: 'Pension, healthcare, welfare beneficiaries',    keywords: ['pension','elderly','senior','senior citizen','ayushman','health','hospital','old age'] },
]

// ─────────────────────────────────────────────────────────────────────────────
//  Main Page
// ─────────────────────────────────────────────────────────────────────────────
export default function AnalysePage() {
  const { data: account } = useAccount()
  const { data: feed = [] } = useFeedItems(account?.id || '')
  const { data: competitors = [] } = useCompetitors(account)
  const { data: contradictions = [] } = useContradictions(account?.id || '')

  // Top-level tab
  const [mainTab, setMainTab] = useState<'trends' | 'audience' | 'intelligence' | 'contradictions'>('trends')

  // ── TRENDS state ────────────────────────────────────────────────────────
  const [trendsTab, setTrendsTab] = useState<'overview' | 'wordcloud' | 'associations' | 'conversations'>('overview')
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null)

  // ── AUDIENCE state ──────────────────────────────────────────────────────
  const [audienceTab, setAudienceTab] = useState<'overview' | 'personas' | 'posts' | 'geography' | 'competition'>('overview')
  const [selectedPersona, setSelectedPersona] = useState<string | null>(null)
  const [postFilter, setPostFilter] = useState<'all' | 'positive' | 'negative' | 'neutral'>('all')

  // ── INTELLIGENCE state ──────────────────────────────────────────────────
  const [report, setReport] = useState<IntelReport | null>(null)
  const [intelLoading, setIntelLoading] = useState(false)
  const [intelError, setIntelError] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [reportMode, setReportMode] = useState<'account' | 'national'>('account')
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null)

  // ── CONTRADICTIONS state ────────────────────────────────────────────────
  const [contraFilter, setContraFilter] = useState<'all' | string>('all')

  const keywords = account?.keywords || []

  // ═══════════════════════════════════════════════════════════════════════
  //  Memos — TRENDS
  // ═══════════════════════════════════════════════════════════════════════
  const gauges = useMemo(() => {
    const crisis = feed.filter(f => f.bucket === 'red').length
    const dev    = feed.filter(f => f.bucket === 'yellow').length
    const bg     = feed.filter(f => f.bucket === 'blue' || f.bucket === 'silver').length
    const opp    = feed.filter(f => f.bucket === 'yellow' && f.sentiment !== 'negative').length
    return { crisis, dev, bg, opp }
  }, [feed])

  const stopWords = useMemo(() => new Set(['the','a','an','in','on','at','of','to','and','or','for','is','are','was','were','be','been','has','have','had','will','with','this','that','these','those','they','them','their','its','by','from','not','but','as','if','it','he','she','we','you','i','do','did','does','can','could','would','should','may','might','must','shall','no','so','up','out','about','into','than','then','when','where','who','which','what','how','all','both','each','few','more','most','other','some','such','also','even','too','just','very','much','many','any','now','only','same','there','here','after','before','well','back','over','new','first','last','long','great','little','own','right','big','high','old','next','early','young','public','private','real','best','free','never','always','still','again','ago','give','call','come','know','let','look','make','say','see','take','tell','want']), [])

  const wordCloudData = useMemo(() => {
    const counts: Record<string, { count: number; posCount: number; negCount: number; sarcasmCount: number }> = {}
    feed.forEach(f => {
      const text = `${f.headline} ${f.body || ''}`
      const isSarcasm = /\b(claims|promises|pledges|vows|says he|insists|denies)\b/i.test(text) && f.sentiment === 'negative'
      const words = text.toLowerCase().match(/[a-z]{4,}/g) || []
      words.forEach(w => {
        if (stopWords.has(w)) return
        if (!counts[w]) counts[w] = { count: 0, posCount: 0, negCount: 0, sarcasmCount: 0 }
        counts[w].count++
        if (isSarcasm) counts[w].sarcasmCount++
        else if (f.sentiment === 'positive') counts[w].posCount++
        else if (f.sentiment === 'negative') counts[w].negCount++
      })
    })
    return Object.entries(counts)
      .filter(([, v]) => v.count >= 2)
      .map(([text, v]) => ({ text, count: v.count, sentiment: v.sarcasmCount > 0 ? 'sarcasm' : v.posCount > v.negCount ? 'positive' : v.negCount > v.posCount ? 'negative' : 'neutral' }))
      .sort((a, b) => b.count - a.count).slice(0, 80)
  }, [feed, stopWords])

  const associationData = useMemo(() => {
    const kw = activeKeyword || keywords[0]
    if (!kw) return { nodes: [], links: [] }
    const matched = feed.filter(f => f.headline.toLowerCase().includes(kw.toLowerCase()) || f.keyword === kw)
    const coTerms: Record<string, { count: number; posCount: number; negCount: number }> = {}
    matched.forEach(f => {
      const words = `${f.headline} ${(f.topic_tags || []).join(' ')} ${(f.geo_tags || []).join(' ')}`.match(/[A-Z][a-z]{3,}|[A-Z]{2,}/g) || []
      words.forEach(w => {
        if (w.toLowerCase() === kw.toLowerCase()) return
        if (!coTerms[w]) coTerms[w] = { count: 0, posCount: 0, negCount: 0 }
        coTerms[w].count++
        if (f.sentiment === 'positive') coTerms[w].posCount++
        if (f.sentiment === 'negative') coTerms[w].negCount++
      })
    })
    const topTerms = Object.entries(coTerms).sort(([, a], [, b]) => b.count - a.count).slice(0, 14)
    const nodes = [
      { id: kw, count: matched.length, sentiment: matched.filter(f => f.sentiment === 'positive').length > matched.filter(f => f.sentiment === 'negative').length ? 'positive' : 'negative' },
      ...topTerms.map(([id, v]) => ({ id, count: v.count, sentiment: v.posCount > v.negCount ? 'positive' : v.negCount > v.posCount ? 'negative' : 'neutral' })),
    ]
    const links = topTerms.map(([id, v]) => ({ source: kw, target: id, strength: Math.min(v.count / Math.max(matched.length, 1), 1) }))
    return { nodes, links }
  }, [feed, activeKeyword, keywords])

  const sentimentOverTime = useMemo(() => {
    const byDay: Record<string, { pos: number; neg: number; total: number }> = {}
    feed.forEach(f => {
      const day = f.published_at?.substring(0, 10) || ''
      if (!day) return
      if (!byDay[day]) byDay[day] = { pos: 0, neg: 0, total: 0 }
      byDay[day].total++
      if (f.sentiment === 'positive') byDay[day].pos++
      if (f.sentiment === 'negative') byDay[day].neg++
    })
    return Object.entries(byDay).sort(([a], [b]) => a.localeCompare(b)).slice(-14).map(([date, d]) => ({
      date: date.substring(5),
      positive: Math.round(d.pos / d.total * 100),
      negative: Math.round(d.neg / d.total * 100),
      volume: d.total,
    }))
  }, [feed])

  const keywordData = useMemo(() =>
    keywords.slice(0, 10).map(kw => {
      const items = feed.filter(f => (f.keyword || '').toLowerCase() === kw.toLowerCase() || f.headline.toLowerCase().includes(kw.toLowerCase()))
      const pos = items.filter(f => f.sentiment === 'positive').length
      const neg = items.filter(f => f.sentiment === 'negative').length
      const crisis = items.filter(f => f.bucket === 'red').length
      return { keyword: kw, total: items.length, positive: pos, negative: neg, crisis, score: items.length ? Math.round((pos / items.length) * 100) : 50 }
    }).sort((a, b) => b.total - a.total)
  , [feed, keywords])

  const sourceData = useMemo(() => {
    const c: Record<string, number> = {}
    feed.forEach(f => { if (f.source) c[f.source] = (c[f.source] || 0) + 1 })
    return Object.entries(c).map(([source, count]) => ({ source, count })).sort((a, b) => b.count - a.count).slice(0, 8)
  }, [feed])

  const topConversations = useMemo(() =>
    [...feed]
      .filter(f => activeKeyword ? f.headline.toLowerCase().includes(activeKeyword.toLowerCase()) : true)
      .sort((a, b) => ((b.bucket === 'red' ? 100 : b.bucket === 'yellow' ? 50 : 0) + (b.engagement || 0)) - ((a.bucket === 'red' ? 100 : a.bucket === 'yellow' ? 50 : 0) + (a.engagement || 0)))
      .slice(0, 20)
  , [feed, activeKeyword])

  // ═══════════════════════════════════════════════════════════════════════
  //  Memos — AUDIENCE
  // ═══════════════════════════════════════════════════════════════════════
  const personas = useMemo(() =>
    PERSONA_DEFS.map(p => {
      const matched = feed.filter(f => {
        const text = `${f.headline} ${f.body || ''} ${(f.topic_tags || []).join(' ')} ${(f.geo_tags || []).join(' ')}`.toLowerCase()
        return p.keywords.some(k => text.includes(k))
      })
      const pos = matched.filter(f => f.sentiment === 'positive').length
      const neg = matched.filter(f => f.sentiment === 'negative').length
      const total = Math.max(matched.length, 1)
      return { ...p, count: matched.length, positive: pos, negative: neg, neutral: matched.length - pos - neg, score: Math.round(50 + ((pos - neg) / total) * 50), items: matched.slice(0, 6) }
    }).sort((a, b) => b.count - a.count)
  , [feed])

  const topPosts = useMemo(() => {
    const filtered = postFilter === 'all' ? feed : feed.filter(f => f.sentiment === postFilter)
    return [...filtered].sort((a, b) => {
      const priority = (f: FeedItem) => (f.bucket === 'red' ? 300 : f.bucket === 'yellow' ? 200 : f.bucket === 'blue' ? 100 : 0) + (f.engagement || 0) + (f.views || 0) / 10
      return priority(b) - priority(a)
    }).slice(0, 30)
  }, [feed, postFilter])

  const geoData = useMemo(() => {
    const c: Record<string, { count: number; pos: number; neg: number }> = {}
    feed.forEach(f => (f.geo_tags || []).forEach(g => {
      if (!c[g]) c[g] = { count: 0, pos: 0, neg: 0 }
      c[g].count++
      if (f.sentiment === 'positive') c[g].pos++
      if (f.sentiment === 'negative') c[g].neg++
    }))
    return Object.entries(c).map(([geo, s]) => ({ geo, ...s, score: Math.round(50 + ((s.pos - s.neg) / Math.max(s.count, 1)) * 50) })).sort((a, b) => b.count - a.count).slice(0, 15)
  }, [feed])

  const platformStats = useMemo(() => {
    const s: Record<string, { count: number; pos: number; neg: number; engagement: number }> = {}
    feed.forEach(f => {
      if (!s[f.platform]) s[f.platform] = { count: 0, pos: 0, neg: 0, engagement: 0 }
      s[f.platform].count++
      s[f.platform].engagement += (f.engagement || 0)
      if (f.sentiment === 'positive') s[f.platform].pos++
      if (f.sentiment === 'negative') s[f.platform].neg++
    })
    return Object.entries(s).map(([platform, v]) => ({ platform, ...v })).sort((a, b) => b.count - a.count)
  }, [feed])

  const topicData = useMemo(() => {
    const c: Record<string, { count: number; pos: number; neg: number }> = {}
    feed.forEach(f => (f.topic_tags || []).forEach(t => {
      if (!c[t]) c[t] = { count: 0, pos: 0, neg: 0 }
      c[t].count++
      if (f.sentiment === 'positive') c[t].pos++
      if (f.sentiment === 'negative') c[t].neg++
    }))
    return Object.entries(c).map(([topic, v]) => ({ topic, ...v, score: Math.round(50 + ((v.pos - v.neg) / Math.max(v.count, 1)) * 50) })).sort((a, b) => b.count - a.count).slice(0, 12)
  }, [feed])

  const totalEng = useMemo(() => feed.reduce((s, f) => s + (f.engagement || 0), 0), [feed])
  const selectedPersonaData = personas.find(p => p.id === selectedPersona)

  // ═══════════════════════════════════════════════════════════════════════
  //  Memos — NARRATIVES
  // ═══════════════════════════════════════════════════════════════════════
  const topicGaps = useMemo(() => {
    const kws = account?.keywords || []
    return kws.map(kw => {
      const items = feed.filter(f => f.headline?.toLowerCase().includes(kw.toLowerCase()) || (f as any).keyword === kw)
      const positive = items.filter(f => f.sentiment === 'positive').length
      return { keyword: kw, count: items.length, positivePct: Math.round((positive / Math.max(items.length, 1)) * 100), gap: items.length < 3 }
    }).sort((a, b) => a.count - b.count)
  }, [feed, account?.keywords])

  const pressureItems = feed.filter(f => f.bucket === 'red' || f.bucket === 'yellow').slice(0, 8)

  // ═══════════════════════════════════════════════════════════════════════
  //  Memos — CONTRADICTIONS
  // ═══════════════════════════════════════════════════════════════════════
  const contraTypes = useMemo(() => {
    const types = new Set<string>()
    ;(contradictions as any[]).forEach(c => { if (c.contradiction_type) types.add(c.contradiction_type) })
    return Array.from(types)
  }, [contradictions])

  const filteredContradictions = useMemo(() =>
    contraFilter === 'all' ? contradictions as any[] : (contradictions as any[]).filter(c => c.contradiction_type === contraFilter)
  , [contradictions, contraFilter])

  // ═══════════════════════════════════════════════════════════════════════
  //  Intelligence
  // ═══════════════════════════════════════════════════════════════════════
  async function generateReport() {
    if (!account?.id) return
    setIntelLoading(true)
    setIntelError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bm-intelligence-report`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY },
        body: JSON.stringify({ accountId: account.id, dateFrom: dateFrom || undefined, dateTo: dateTo || undefined, maxItems: 150, nationalMode: reportMode === 'national' }),
      })
      const data = await res.json()
      if (!res.ok || data.error) { setIntelError(data.error || 'Generation failed'); return }
      setReport(data)
    } catch (e: any) {
      setIntelError(e.message)
    } finally {
      setIntelLoading(false)
    }
  }

  const formattedDate = report
    ? new Date(report.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''

  // ─────────────────────────────────────────────────────────────────────────────
  //  RENDER
  // ─────────────────────────────────────────────────────────────────────────────

  const MAIN_TABS: { id: typeof mainTab; label: string; icon: string }[] = [
    { id: 'trends',         label: 'TRENDS',          icon: '◈' },
    { id: 'audience',       label: 'AUDIENCE',         icon: '◎' },
    { id: 'intelligence',   label: 'INTELLIGENCE',     icon: '⚙' },
    { id: 'contradictions', label: 'CONTRADICTIONS',   icon: '⚡' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: DARK }}>
      <NavBar />

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Page header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '2px', marginBottom: '6px' }}>POLITICAL INTELLIGENCE</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: T0 }}>{account?.politician_name || 'Account'} — Analysis</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            {[
              { l: 'ITEMS',      v: feed.length,                                        c: T0    },
              { l: 'CRISIS',     v: gauges.crisis,                                      c: RED   },
              { l: 'DEVELOPING', v: gauges.dev,                                         c: YELLOW },
              { l: 'POSITIVE',   v: feed.filter(f => f.sentiment === 'positive').length, c: GREEN },
            ].map(k => (
              <div key={k.l} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '8px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: mono, fontSize: '7px', color: T3, marginBottom: '3px' }}>{k.l}</div>
                <div style={{ fontFamily: mono, fontSize: '18px', fontWeight: 700, color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Main tab bar ── */}
        <div style={{ display: 'flex', gap: '2px', borderBottom: `1px solid ${BORDER}`, marginBottom: '24px' }}>
          {MAIN_TABS.map(t => (
            <button key={t.id} onClick={() => setMainTab(t.id)}
              style={{
                fontFamily: mono, fontSize: '9px', letterSpacing: '1px', padding: '10px 18px',
                border: 'none', background: mainTab === t.id ? `rgba(249,115,22,0.1)` : 'transparent',
                cursor: 'pointer',
                color: mainTab === t.id ? ACC : T2,
                borderBottom: `2px solid ${mainTab === t.id ? ACC : 'transparent'}`,
                marginBottom: '-1px', transition: 'all .15s',
              }}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>

        {/* ════════════════════════════════════════════════════════════════
            TAB: TRENDS
        ════════════════════════════════════════════════════════════════ */}
        {mainTab === 'trends' && (
          <div>
            {/* Signal intensity */}
            <SectionCard title="SIGNAL INTENSITY" style={{ marginBottom: '20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '8px' }}>
                <CircularGauge value={gauges.crisis} max={Math.max(feed.length, 1)} label="CRISIS"      color={RED}    sublabel="items" />
                <CircularGauge value={gauges.dev}    max={Math.max(feed.length, 1)} label="DEVELOPING"  color={YELLOW} sublabel="items" />
                <CircularGauge value={gauges.bg}     max={Math.max(feed.length, 1)} label="BACKGROUND"  color={BLUE}   sublabel="items" />
                <CircularGauge value={gauges.opp}    max={Math.max(feed.length, 1)} label="OPP GAPS"    color={GREEN}  sublabel="counter" />
                <CircularGauge value={feed.filter(f => f.sentiment === 'positive').length} max={Math.max(feed.length, 1)} label="POSITIVE" color={GREEN} sublabel="mentions" />
                <CircularGauge value={feed.filter(f => f.sentiment === 'negative').length} max={Math.max(feed.length, 1)} label="NEGATIVE" color={RED}   sublabel="mentions" />
              </div>
            </SectionCard>

            {/* Trends inner tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: `1px solid ${BORDER}` }}>
              {[['overview','OVERVIEW'],['wordcloud','WORD CLOUD'],['associations','ASSOCIATIONS'],['conversations','TOP CONVERSATIONS']].map(([id, label]) => (
                <button key={id} onClick={() => setTrendsTab(id as any)} style={{ fontFamily: mono, fontSize: '8px', letterSpacing: '0.5px', padding: '7px 14px', border: 'none', background: 'transparent', cursor: 'pointer', color: trendsTab === id ? ACC : T2, borderBottom: `2px solid ${trendsTab === id ? ACC : 'transparent'}`, marginBottom: '-1px', transition: 'all .15s' }}>{label}</button>
              ))}
            </div>

            {/* Trends: OVERVIEW */}
            {trendsTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <SectionCard title="SENTIMENT TREND (14 DAYS)">
                  {sentimentOverTime.length > 1 ? (
                    <ResponsiveContainer width="100%" height={200}>
                      <AreaChart data={sentimentOverTime}>
                        <defs>
                          <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={GREEN} stopOpacity={0.25} /><stop offset="95%" stopColor={GREEN} stopOpacity={0} /></linearGradient>
                          <linearGradient id="ng" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor={RED} stopOpacity={0.2} /><stop offset="95%" stopColor={RED} stopOpacity={0} /></linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="date" tick={{ fill: T3, fontSize: 8, fontFamily: mono }} axisLine={false} tickLine={false} />
                        <YAxis domain={[0, 100]} tick={{ fill: T3, fontSize: 8 }} axisLine={false} tickLine={false} unit="%" />
                        <Tooltip contentStyle={{ background: '#121620', border: `1px solid ${BORDER}`, borderRadius: '6px', fontSize: '10px', fontFamily: mono }} />
                        <Area type="monotone" dataKey="positive" name="Positive" stroke={GREEN} fill="url(#pg)" strokeWidth={2} />
                        <Area type="monotone" dataKey="negative" name="Negative" stroke={RED}   fill="url(#ng)" strokeWidth={2} />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : <div style={{ height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '9px', color: T3 }}>Need 2+ days of data</div>}
                </SectionCard>

                <SectionCard title="KEYWORD PERFORMANCE">
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                    {keywordData.length > 0 ? keywordData.map(kw => (
                      <div key={kw.keyword}
                        onClick={() => setActiveKeyword(activeKeyword === kw.keyword ? null : kw.keyword)}
                        style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 7px', borderRadius: '5px', cursor: 'pointer', background: activeKeyword === kw.keyword ? CARD2 : 'transparent', transition: 'background .12s' }}>
                        <span style={{ fontFamily: mono, fontSize: '9px', color: T1, flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.keyword}</span>
                        {kw.crisis > 0 && <span style={{ fontFamily: mono, fontSize: '7px', color: RED, background: RED + '15', padding: '1px 5px', borderRadius: '3px' }}>⚡{kw.crisis}</span>}
                        <div style={{ width: '70px', height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                          <div style={{ height: '100%', width: `${Math.min((kw.total / Math.max(keywordData[0]?.total || 1, 1)) * 100, 100)}%`, background: kw.crisis > 0 ? RED : kw.negative > kw.positive ? YELLOW : GREEN, borderRadius: '2px' }} />
                        </div>
                        <span style={{ fontFamily: mono, fontSize: '9px', color: T2, minWidth: '24px', textAlign: 'right' }}>{kw.total}</span>
                      </div>
                    )) : <div style={{ fontFamily: mono, fontSize: '9px', color: T3, textAlign: 'center', padding: '24px' }}>No keyword data yet</div>}
                  </div>
                </SectionCard>

                <SectionCard title="TOP SOURCES">
                  <ResponsiveContainer width="100%" height={200}>
                    <BarChart data={sourceData} layout="vertical" margin={{ left: 10, right: 30 }}>
                      <XAxis type="number" tick={{ fill: T3, fontSize: 8 }} axisLine={false} tickLine={false} />
                      <YAxis dataKey="source" type="category" tick={{ fill: T1, fontSize: 8, fontFamily: mono }} axisLine={false} tickLine={false} width={90} />
                      <Tooltip contentStyle={{ background: '#121620', border: `1px solid ${BORDER}`, borderRadius: '6px', fontSize: '10px', fontFamily: mono }} />
                      <Bar dataKey="count" fill={BLUE} fillOpacity={0.8} radius={[0, 4, 4, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </SectionCard>

                <SectionCard title="PLATFORM COVERAGE">
                  {(() => {
                    const platforms: Record<string, number> = {}
                    feed.forEach(f => { platforms[f.platform] = (platforms[f.platform] || 0) + 1 })
                    const data = Object.entries(platforms).map(([name, value]) => ({ name: name.toUpperCase(), value })).sort((a, b) => b.value - a.value)
                    const max = data[0]?.value || 1
                    return data.length > 0 ? (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                        {data.map(p => (
                          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: mono, fontSize: '8px', color: PLAT_COLORS[p.name] || T2, width: '72px', flexShrink: 0 }}>{p.name}</span>
                            <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${(p.value / max) * 100}%`, height: '100%', background: PLAT_COLORS[p.name] || T2, borderRadius: '3px' }} />
                            </div>
                            <span style={{ fontFamily: mono, fontSize: '9px', color: T2, minWidth: '28px', textAlign: 'right' }}>{p.value}</span>
                          </div>
                        ))}
                      </div>
                    ) : <div style={{ fontFamily: mono, fontSize: '9px', color: T3, textAlign: 'center', padding: '24px' }}>No data yet</div>
                  })()}
                </SectionCard>
              </div>
            )}

            {/* Trends: WORD CLOUD */}
            {trendsTab === 'wordcloud' && (
              <SectionCard title="KEYWORD WORD CLOUD" badge={`${wordCloudData.length} TERMS`}>
                {wordCloudData.length > 0
                  ? <WordCloud words={wordCloudData} />
                  : <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '9px', color: T3 }}>No word data yet — trigger an ingest from dashboard</div>}
                <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {wordCloudData.slice(0, 20).map(w => (
                    <span key={w.text} style={{ fontFamily: mono, fontSize: '8px', padding: '3px 8px', borderRadius: '4px', background: w.sentiment === 'positive' ? GREEN + '18' : w.sentiment === 'negative' ? RED + '18' : w.sentiment === 'sarcasm' ? YELLOW + '18' : T2 + '18', color: w.sentiment === 'positive' ? GREEN : w.sentiment === 'negative' ? RED : w.sentiment === 'sarcasm' ? YELLOW : T2, border: `1px solid ${w.sentiment === 'positive' ? GREEN : w.sentiment === 'negative' ? RED : T2}20` }}>
                      {w.text} <span style={{ opacity: 0.6 }}>{w.count}</span>
                    </span>
                  ))}
                </div>
              </SectionCard>
            )}

            {/* Trends: ASSOCIATIONS */}
            {trendsTab === 'associations' && (
              <div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  {keywords.map(kw => (
                    <button key={kw} onClick={() => setActiveKeyword(activeKeyword === kw ? null : kw)}
                      style={{ fontFamily: mono, fontSize: '8px', padding: '4px 10px', borderRadius: '20px', border: `1px solid ${activeKeyword === kw ? ACC : BORDER}`, background: activeKeyword === kw ? ACC + '18' : 'transparent', color: activeKeyword === kw ? ACC : T2, cursor: 'pointer', transition: 'all .15s' }}>{kw}</button>
                  ))}
                </div>
                <SectionCard title={`KEYWORD ASSOCIATIONS — ${activeKeyword || keywords[0] || 'select keyword'}`} badge={`${associationData.nodes.length - 1} connections`}>
                  {associationData.nodes.length > 1
                    ? <AssociationMap nodes={associationData.nodes} links={associationData.links} />
                    : <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '9px', color: T3 }}>Select a keyword to see associations</div>}
                </SectionCard>
              </div>
            )}

            {/* Trends: CONVERSATIONS */}
            {trendsTab === 'conversations' && (
              <SectionCard title="TOP CONVERSATIONS" badge={`${topConversations.length} ITEMS${activeKeyword ? ` · ${activeKeyword}` : ''}`}>
                {activeKeyword && (
                  <button onClick={() => setActiveKeyword(null)} style={{ marginBottom: '10px', fontFamily: mono, fontSize: '8px', color: ACC, background: 'none', border: `1px solid ${ACC}`, borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}>✕ Clear filter</button>
                )}
                {topConversations.map((item, i) => <FeedRow key={item.id} item={item} rank={i + 1} />)}
              </SectionCard>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: AUDIENCE
        ════════════════════════════════════════════════════════════════ */}
        {mainTab === 'audience' && (
          <div>
            {/* KPIs */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: '10px', marginBottom: '20px' }}>
              {[
                { l: 'COVERAGE',    v: feed.length,                                             c: T0    },
                { l: 'POSITIVE',    v: feed.filter(f => f.sentiment === 'positive').length,      c: GREEN  },
                { l: 'NEGATIVE',    v: feed.filter(f => f.sentiment === 'negative').length,      c: RED    },
                { l: 'ENGAGEMENT',  v: totalEng > 0 ? `${(totalEng / 1000).toFixed(1)}K` : '—', c: '#7c6dfa' },
                { l: 'PLATFORMS',   v: platformStats.length,                                     c: YELLOW },
                { l: 'GEO SIGNALS', v: geoData.length,                                          c: BLUE   },
              ].map(k => (
                <div key={k.l} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '10px 12px' }}>
                  <div style={{ fontFamily: mono, fontSize: '7px', color: T3, letterSpacing: '1px', marginBottom: '5px' }}>{k.l}</div>
                  <div style={{ fontFamily: mono, fontSize: '20px', fontWeight: 700, color: k.c, lineHeight: 1 }}>{k.v}</div>
                </div>
              ))}
            </div>

            {/* Audience inner tabs */}
            <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: `1px solid ${BORDER}` }}>
              {[['overview','OVERVIEW'],['personas','PERSONAS'],['posts','TOP POSTS'],['geography','GEOGRAPHY'],['competition','COMPETITION']].map(([id, label]) => (
                <button key={id} onClick={() => setAudienceTab(id as any)} style={{ fontFamily: mono, fontSize: '8px', letterSpacing: '0.5px', padding: '7px 14px', border: 'none', background: 'transparent', cursor: 'pointer', color: audienceTab === id ? ACC : T2, borderBottom: `2px solid ${audienceTab === id ? ACC : 'transparent'}`, marginBottom: '-1px', transition: 'all .15s' }}>{label}</button>
              ))}
            </div>

            {/* Audience: OVERVIEW */}
            {audienceTab === 'overview' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <SectionCard title="PLATFORM PERFORMANCE">
                  {platformStats.map(p => {
                    const max = platformStats[0]?.count || 1
                    const c = PLAT_COLORS[p.platform] || T2
                    const sentScore = Math.round(p.pos / Math.max(p.count, 1) * 100)
                    return (
                      <div key={p.platform} style={{ marginBottom: '10px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                          <span style={{ fontFamily: mono, fontSize: '9px', color: c, width: '72px', flexShrink: 0 }}>{p.platform.toUpperCase()}</span>
                          <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ width: `${(p.count / max) * 100}%`, height: '100%', background: c, borderRadius: '3px' }} />
                          </div>
                          <span style={{ fontFamily: mono, fontSize: '9px', color: T1, minWidth: '28px', textAlign: 'right' }}>{p.count}</span>
                        </div>
                        <div style={{ display: 'flex', gap: '8px', marginLeft: '80px' }}>
                          <span style={{ fontFamily: mono, fontSize: '7px', color: GREEN }}>+{p.pos}</span>
                          <span style={{ fontFamily: mono, fontSize: '7px', color: RED }}>-{p.neg}</span>
                          <span style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>{sentScore}% pos</span>
                          {p.engagement > 0 && <span style={{ fontFamily: mono, fontSize: '7px', color: c }}>{(p.engagement / 1000).toFixed(1)}K eng</span>}
                        </div>
                      </div>
                    )
                  })}
                </SectionCard>

                <SectionCard title="TOP TOPICS IN COVERAGE">
                  {topicData.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {topicData.map(t => {
                        const max = topicData[0]?.count || 1
                        const c = t.score >= 60 ? GREEN : t.score <= 40 ? RED : YELLOW
                        return (
                          <div key={t.topic} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: mono, fontSize: '9px', color: T1, width: '90px', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.topic}</span>
                            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${(t.count / max) * 100}%`, height: '100%', background: c, borderRadius: '2px' }} />
                            </div>
                            <span style={{ fontFamily: mono, fontSize: '9px', color: T2, minWidth: '24px', textAlign: 'right' }}>{t.count}</span>
                            <span style={{ fontFamily: mono, fontSize: '8px', color: c, minWidth: '32px', textAlign: 'right' }}>{t.score}%</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : <div style={{ fontFamily: mono, fontSize: '9px', color: T3, textAlign: 'center', padding: '24px' }}>No topic data yet</div>}
                </SectionCard>

                <SectionCard title="SENTIMENT PIE">
                  {feed.length > 0 ? (() => {
                    const pos = feed.filter(f => f.sentiment === 'positive').length
                    const neg = feed.filter(f => f.sentiment === 'negative').length
                    const neu = feed.filter(f => f.sentiment === 'neutral').length
                    const data = [{ name: 'Positive', value: pos, color: GREEN }, { name: 'Negative', value: neg, color: RED }, { name: 'Neutral', value: neu, color: '#4a5568' }]
                    return (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                        <ResponsiveContainer width={160} height={160}>
                          <PieChart>
                            <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                              {data.map((d, i) => <Cell key={i} fill={d.color} fillOpacity={0.85} />)}
                            </Pie>
                            <Tooltip contentStyle={{ background: '#121620', border: `1px solid ${BORDER}`, borderRadius: '6px', fontSize: '10px', fontFamily: mono }} />
                          </PieChart>
                        </ResponsiveContainer>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                          {data.map(d => (
                            <div key={d.name}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                                <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: d.color }} />
                                <span style={{ fontFamily: mono, fontSize: '9px', color: T1 }}>{d.name}</span>
                              </div>
                              <div style={{ fontFamily: mono, fontSize: '16px', fontWeight: 700, color: d.color, marginLeft: '14px' }}>{d.value}</div>
                              <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginLeft: '14px' }}>{Math.round(d.value / feed.length * 100)}%</div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )
                  })() : <div style={{ fontFamily: mono, fontSize: '9px', color: T3, textAlign: 'center', padding: '24px' }}>No data yet</div>}
                </SectionCard>

                <SectionCard title="GEO SIGNAL STRENGTH">
                  {geoData.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {geoData.slice(0, 8).map(g => {
                        const max = geoData[0]?.count || 1
                        const c = g.score >= 60 ? GREEN : g.score <= 40 ? RED : YELLOW
                        return (
                          <div key={g.geo} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: mono, fontSize: '9px', color: T1, width: '80px', flexShrink: 0 }}>{g.geo}</span>
                            <div style={{ flex: 1, height: '4px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${(g.count / max) * 100}%`, height: '100%', background: c, borderRadius: '2px' }} />
                            </div>
                            <span style={{ fontFamily: mono, fontSize: '9px', color: T2, minWidth: '24px', textAlign: 'right' }}>{g.count}</span>
                            <span style={{ fontFamily: mono, fontSize: '8px', color: c, minWidth: '32px', textAlign: 'right' }}>{g.score}%</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : <div style={{ fontFamily: mono, fontSize: '9px', color: T3, textAlign: 'center', padding: '24px' }}>No geo signals yet</div>}
                </SectionCard>
              </div>
            )}

            {/* Audience: PERSONAS */}
            {audienceTab === 'personas' && (
              <div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '10px', marginBottom: '16px' }}>
                  {personas.map(p => (
                    <div key={p.id}
                      onClick={() => setSelectedPersona(selectedPersona === p.id ? null : p.id)}
                      style={{ background: selectedPersona === p.id ? CARD2 : CARD, border: `1px solid ${selectedPersona === p.id ? p.color + '60' : BORDER}`, borderRadius: '10px', padding: '14px', cursor: 'pointer', transition: 'all .15s' }}
                      onMouseEnter={e => { e.currentTarget.style.borderColor = p.color + '40' }}
                      onMouseLeave={e => { e.currentTarget.style.borderColor = selectedPersona === p.id ? p.color + '60' : BORDER }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '16px' }}>{p.icon}</span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: '11px', fontWeight: 600, color: T0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{p.label}</div>
                          <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>{p.count} mentions</div>
                        </div>
                        <div style={{ width: '32px', height: '32px', borderRadius: '50%', background: p.color + '15', border: `2px solid ${p.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '10px', fontWeight: 700, color: p.color, flexShrink: 0 }}>{p.score}</div>
                      </div>
                      <div style={{ fontSize: '9px', color: T2, lineHeight: 1.5, marginBottom: '8px' }}>{p.desc}</div>
                      <div style={{ display: 'flex', gap: '6px', marginBottom: '6px' }}>
                        <span style={{ fontFamily: mono, fontSize: '7px', color: GREEN }}>+{p.positive}</span>
                        <span style={{ fontFamily: mono, fontSize: '7px', color: RED }}>-{p.negative}</span>
                        <span style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>~{p.neutral} neu</span>
                      </div>
                      <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                        <div style={{ width: `${Math.min((p.count / Math.max(personas[0]?.count || 1, 1)) * 100, 100)}%`, height: '100%', background: p.color, borderRadius: '2px' }} />
                      </div>
                    </div>
                  ))}
                </div>
                {selectedPersonaData && (
                  <SectionCard title={`${selectedPersonaData.icon} ${selectedPersonaData.label.toUpperCase()} — TOP CONVERSATIONS`} badge={`${selectedPersonaData.count} ITEMS · SENTIMENT ${selectedPersonaData.score}%`}>
                    {selectedPersonaData.items.length > 0
                      ? selectedPersonaData.items.map((item, i) => <FeedRow key={item.id} item={item} rank={i + 1} />)
                      : <div style={{ fontFamily: mono, fontSize: '9px', color: T3, padding: '16px', textAlign: 'center' }}>No conversations for this segment yet</div>}
                  </SectionCard>
                )}
              </div>
            )}

            {/* Audience: TOP POSTS */}
            {audienceTab === 'posts' && (
              <div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '12px' }}>
                  {[['all','ALL'],['positive','POSITIVE'],['negative','NEGATIVE'],['neutral','NEUTRAL']].map(([id, label]) => (
                    <button key={id} onClick={() => setPostFilter(id as any)}
                      style={{ fontFamily: mono, fontSize: '8px', padding: '5px 12px', border: `1px solid ${postFilter === id ? ACC : BORDER}`, borderRadius: '20px', background: postFilter === id ? ACC + '18' : 'transparent', color: postFilter === id ? ACC : T2, cursor: 'pointer', transition: 'all .15s' }}>
                      {label} ({id === 'all' ? feed.length : feed.filter(f => f.sentiment === id).length})
                    </button>
                  ))}
                </div>
                <SectionCard title={`TOP POSTS — ${postFilter.toUpperCase()}`} badge={`${topPosts.length} items`}>
                  {topPosts.map((item, i) => <FeedRow key={item.id} item={item} rank={i + 1} />)}
                </SectionCard>
              </div>
            )}

            {/* Audience: GEOGRAPHY */}
            {audienceTab === 'geography' && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px' }}>
                <SectionCard title="GEO SIGNAL STRENGTH — ALL REGIONS">
                  {geoData.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                      {geoData.map(g => {
                        const max = geoData[0]?.count || 1
                        const c = g.score >= 60 ? GREEN : g.score <= 40 ? RED : YELLOW
                        return (
                          <div key={g.geo} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                            <span style={{ fontFamily: mono, fontSize: '9px', color: T1, width: '90px', flexShrink: 0 }}>{g.geo}</span>
                            <div style={{ flex: 1, height: '5px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ width: `${(g.count / max) * 100}%`, height: '100%', background: c, borderRadius: '3px' }} />
                            </div>
                            <span style={{ fontFamily: mono, fontSize: '9px', color: T2, minWidth: '24px', textAlign: 'right' }}>{g.count}</span>
                            <span style={{ fontFamily: mono, fontSize: '8px', color: c, minWidth: '36px', textAlign: 'right' }}>{g.score}%</span>
                          </div>
                        )
                      })}
                    </div>
                  ) : <div style={{ fontFamily: mono, fontSize: '9px', color: T3, textAlign: 'center', padding: '24px' }}>No geo data yet. Geo signals are extracted from feed headlines automatically.</div>}
                </SectionCard>

                <SectionCard title="SENTIMENT BY REGION">
                  {geoData.length > 0 ? (
                    <ResponsiveContainer width="100%" height={300}>
                      <BarChart data={geoData.slice(0, 10)} margin={{ left: 0, right: 10, top: 5, bottom: 40 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                        <XAxis dataKey="geo" tick={{ fill: T3, fontSize: 7, fontFamily: mono }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                        <YAxis domain={[0, 100]} tick={{ fill: T3, fontSize: 7 }} axisLine={false} tickLine={false} />
                        <Tooltip contentStyle={{ background: '#121620', border: `1px solid ${BORDER}`, borderRadius: '6px', fontSize: '10px', fontFamily: mono }} />
                        <Bar dataKey="score" name="Sentiment Score" radius={[3, 3, 0, 0]}>
                          {geoData.slice(0, 10).map((g, i) => <Cell key={i} fill={g.score >= 60 ? GREEN : g.score <= 40 ? RED : YELLOW} fillOpacity={0.85} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  ) : <div style={{ fontFamily: mono, fontSize: '9px', color: T3, textAlign: 'center', padding: '24px' }}>No data yet</div>}
                </SectionCard>
              </div>
            )}

            {/* Audience: COMPETITION */}
            {audienceTab === 'competition' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {competitors.length === 0 ? (
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 2.5 }}>
                      No competitors tracked yet.<br />
                      Add them under Settings → Tracking → Politicians → mark as competitor.
                    </div>
                  </div>
                ) : competitors.map((c: any) => {
                  const cf = feed.filter(f => f.headline.toLowerCase().includes(c.politician.name.split(' ').slice(-1)[0].toLowerCase()))
                  const pos = cf.filter(f => f.sentiment === 'positive').length
                  const neg = cf.filter(f => f.sentiment === 'negative').length
                  const score = Math.round(50 + ((pos - neg) / Math.max(cf.length, 1)) * 50)
                  return (
                    <SectionCard key={c.politician.id} title={`${c.politician.name} — ${c.politician.party}`} badge={`${cf.length} mentions`}>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px', marginBottom: '14px' }}>
                        {[
                          { l: 'MENTIONS',   v: cf.length,                                c: T0    },
                          { l: 'SENTIMENT',  v: `${score}%`,                              c: score >= 55 ? GREEN : score <= 45 ? RED : YELLOW },
                          { l: 'CRISIS',     v: cf.filter(f => f.bucket === 'red').length, c: RED   },
                          { l: 'DEVELOPING', v: cf.filter(f => f.bucket === 'yellow').length, c: YELLOW },
                          { l: 'POSITIVE',   v: pos,                                       c: GREEN  },
                        ].map(k => (
                          <div key={k.l} style={{ background: CARD2, borderRadius: '6px', padding: '8px 10px', textAlign: 'center' }}>
                            <div style={{ fontFamily: mono, fontSize: '7px', color: T3, marginBottom: '3px' }}>{k.l}</div>
                            <div style={{ fontFamily: mono, fontSize: '16px', fontWeight: 700, color: k.c }}>{k.v}</div>
                          </div>
                        ))}
                      </div>
                      {cf.slice(0, 5).map((item, i) => <FeedRow key={item.id} item={item} rank={i + 1} />)}
                    </SectionCard>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: INTELLIGENCE
        ════════════════════════════════════════════════════════════════ */}
        {mainTab === 'intelligence' && (
          <div>
            {/* Controls */}
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: '10px', marginBottom: '24px', flexWrap: 'wrap', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px 18px' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>FROM DATE</label>
                <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                  style={{ background: CARD2, border: `1px solid ${BORDER}`, color: T1, borderRadius: '5px', padding: '5px 10px', fontFamily: mono, fontSize: '10px' }} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <label style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>TO DATE</label>
                <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                  style={{ background: CARD2, border: `1px solid ${BORDER}`, color: T1, borderRadius: '5px', padding: '5px 10px', fontFamily: mono, fontSize: '10px' }} />
              </div>
              <div style={{ display: 'flex', gap: '4px' }}>
                {(['account', 'national'] as const).map(m => (
                  <button key={m} onClick={() => setReportMode(m)}
                    style={{ padding: '7px 12px', border: `1px solid ${reportMode === m ? ACC : BORDER}`, borderRadius: '6px', background: reportMode === m ? ACC + '18' : 'transparent', color: reportMode === m ? ACC : T2, fontFamily: mono, fontSize: '8px', cursor: 'pointer', letterSpacing: '0.5px', textTransform: 'uppercase' }}>
                    {m === 'account' ? '👤 Account Keywords' : '🇮🇳 National Discourse'}
                  </button>
                ))}
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
                <button onClick={generateReport} disabled={intelLoading}
                  style={{ padding: '10px 20px', background: intelLoading ? CARD2 : ACC, color: '#fff', border: 'none', borderRadius: '8px', cursor: intelLoading ? 'not-allowed' : 'pointer', fontFamily: mono, fontSize: '10px', fontWeight: 700, opacity: intelLoading ? 0.7 : 1 }}>
                  {intelLoading ? '⚙ GENERATING…' : '⚡ GENERATE REPORT'}
                </button>
                {report && (
                  <button onClick={() => window.print()}
                    style={{ padding: '10px 16px', background: 'transparent', color: GREEN, border: `1px solid ${GREEN}40`, borderRadius: '8px', cursor: 'pointer', fontFamily: mono, fontSize: '10px' }}>
                    ⬇ SAVE PDF
                  </button>
                )}
              </div>
            </div>

            {intelLoading && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
                <div style={{ fontFamily: mono, fontSize: '11px', color: ACC, marginBottom: '12px' }}>⚙ AI ANALYSIS IN PROGRESS</div>
                <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 2 }}>
                  Clustering {feed.length} feed items into topic groups…<br />
                  Scoring positive vs negative narratives per cluster…<br />
                  Generating strategic conclusions…<br />
                  This takes 30–60 seconds.
                </div>
              </div>
            )}

            {intelError && (
              <div style={{ background: RED + '10', border: `1px solid ${RED}30`, borderRadius: '10px', padding: '16px 20px', marginBottom: '20px' }}>
                <div style={{ fontFamily: mono, fontSize: '9px', color: RED }}>⚠ {intelError}</div>
              </div>
            )}

            {!report && !intelLoading && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '56px', textAlign: 'center' }}>
                <div style={{ fontSize: '28px', marginBottom: '12px' }}>📊</div>
                <div style={{ fontFamily: mono, fontSize: '11px', color: T1, marginBottom: '8px' }}>SOCIAL MEDIA INTELLIGENCE REPORT</div>
                <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 2, maxWidth: '500px', margin: '0 auto' }}>
                  AI clusters your tracked feed into topic groups.<br />
                  Identifies positive vs negative narrative drivers.<br />
                  Shows top sources per topic with post counts.<br />
                  Generates 5 strategic conclusions for the war room.<br /><br />
                  Select date range (optional) and click Generate.
                </div>
              </div>
            )}

            {report && (
              <div>
                {/* Cover */}
                <div style={{ borderBottom: `2px solid ${ACC}`, paddingBottom: '24px', marginBottom: '28px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
                    <div>
                      <div style={{ fontFamily: mono, fontSize: '9px', color: ACC, letterSpacing: '3px', marginBottom: '6px' }}>SOCIAL MEDIA INTELLIGENCE REPORT</div>
                      <div style={{ fontSize: '18px', fontWeight: 700, color: T0, marginBottom: '4px' }}>{report.dateRange.from} — {report.dateRange.to}</div>
                      <div style={{ fontFamily: mono, fontSize: '10px', color: T2 }}>Prevailing social media narratives and public discourse trends across India's political landscape.</div>
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '20px' }}>
                      <div style={{ fontFamily: mono, fontSize: '28px', fontWeight: 700, color: T0 }}>{report.totalPosts}</div>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>TOTAL ITEMS</div>
                      <div style={{ fontFamily: mono, fontSize: '18px', fontWeight: 700, color: ACC, marginTop: '6px' }}>{report.topicCount}</div>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>TOPIC CLUSTERS</div>
                    </div>
                  </div>
                  {/* Topic volume bars */}
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px' }}>
                    <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '1px', marginBottom: '12px' }}>DISCOURSE VOLUME BY TOPIC</div>
                    {report.topics.map((t, i) => {
                      const pct = Math.min((t.postCount / Math.max(report.totalPosts, 1)) * 100, 100)
                      const negPct = (t.positiveCount + t.negativeCount) > 0 ? Math.round(t.negativeCount / (t.positiveCount + t.negativeCount) * 100) : 50
                      return (
                        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
                          <span style={{ fontFamily: mono, fontSize: '9px', color: T3, width: '18px', flexShrink: 0 }}>{i + 1}</span>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ fontSize: '11px', color: T1, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</div>
                            <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                              <div style={{ width: `${pct}%`, height: '100%', background: negPct > 60 ? RED : negPct > 40 ? YELLOW : GREEN, borderRadius: '2px' }} />
                            </div>
                          </div>
                          <span style={{ fontFamily: mono, fontSize: '9px', color: T2, minWidth: '36px', textAlign: 'right' }}>{t.postCount}</span>
                          <span style={{ fontFamily: mono, fontSize: '9px', color: T3, minWidth: '36px', textAlign: 'right' }}>{t.percentage}%</span>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Topic breakdowns */}
                <div style={{ fontFamily: mono, fontSize: '9px', color: T3, letterSpacing: '2px', marginBottom: '16px' }}>DETAILED TOPIC BREAKDOWN</div>
                {report.topics.map((topic, i) => {
                  const isExpanded = expandedTopic === i
                  const negPct = (topic.positiveCount + topic.negativeCount) > 0 ? Math.round(topic.negativeCount / (topic.positiveCount + topic.negativeCount) * 100) : 50
                  return (
                    <div key={i} style={{ marginBottom: '16px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
                      <div style={{ padding: '14px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                        onClick={() => setExpandedTopic(isExpanded ? null : i)}>
                        <span style={{ fontFamily: mono, fontSize: '10px', color: ACC, fontWeight: 700, flexShrink: 0 }}>Topic {i + 1}</span>
                        <span style={{ fontSize: '13px', fontWeight: 600, color: T0, flex: 1 }}>{topic.title}</span>
                        <span style={{ fontFamily: mono, fontSize: '10px', color: T2, flexShrink: 0 }}>{topic.postCount} posts · {topic.percentage}%</span>
                        <span style={{ fontFamily: mono, fontSize: '9px', color: T3, flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                      </div>
                      <div style={{ padding: '14px 18px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
                          <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                            <div style={{ width: `${100 - negPct}%`, height: '100%', background: GREEN }} />
                            <div style={{ width: `${negPct}%`, height: '100%', background: RED }} />
                          </div>
                          <span style={{ fontFamily: mono, fontSize: '8px', color: GREEN, flexShrink: 0 }}>+{topic.positiveCount} PRAISE</span>
                          <span style={{ fontFamily: mono, fontSize: '8px', color: RED, flexShrink: 0 }}>-{topic.negativeCount} ATTACK</span>
                        </div>
                        {topic.topPositiveSources.length > 0 && (
                          <div style={{ marginBottom: '8px' }}>
                            <div style={{ fontFamily: mono, fontSize: '8px', color: GREEN, letterSpacing: '1px', marginBottom: '4px' }}>PRAISE / DEFENSE ({topic.positiveCount})</div>
                            <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>Top Positive: {topic.topPositiveSources.map(s => `${s.name} (${s.count})`).join(', ')}</div>
                          </div>
                        )}
                        {topic.topNegativeSources.length > 0 && (
                          <div style={{ marginBottom: '10px' }}>
                            <div style={{ fontFamily: mono, fontSize: '8px', color: RED, letterSpacing: '1px', marginBottom: '4px' }}>CRITICISMS / ATTACKS ({topic.negativeCount})</div>
                            <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>Top Negative: {topic.topNegativeSources.map(s => `${s.name} (${s.count})`).join(', ')}</div>
                          </div>
                        )}
                        {topic.narrativePoints.map((pt, j) => (
                          <div key={j} style={{ display: 'flex', gap: '8px', marginBottom: '5px' }}>
                            <span style={{ color: ACC, flexShrink: 0 }}>-</span>
                            <span style={{ fontSize: '11px', color: T1, lineHeight: 1.6 }}>{pt}</span>
                          </div>
                        ))}
                        {isExpanded && topic.sampleItems.length > 0 && (
                          <div style={{ marginTop: '12px', borderTop: `1px solid ${BORDER}`, paddingTop: '12px' }}>
                            <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '1px', marginBottom: '8px' }}>SAMPLE ITEMS</div>
                            {topic.sampleItems.map((item, k) => {
                              const sc = item.sentiment === 'positive' ? GREEN : item.sentiment === 'negative' ? RED : T3
                              return (
                                <div key={k} style={{ padding: '6px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                                  <div style={{ fontSize: '10px', color: T1, lineHeight: 1.5, marginBottom: '2px' }}>{item.headline}</div>
                                  <div style={{ display: 'flex', gap: '8px' }}>
                                    <span style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>{item.source}</span>
                                    <span style={{ fontFamily: mono, fontSize: '7px', color: sc }}>{item.sentiment?.toUpperCase()}</span>
                                    {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mono, fontSize: '7px', color: BLUE }}>↗</a>}
                                  </div>
                                </div>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )
                })}

                {/* Conclusions */}
                {report.conclusions.length > 0 && (
                  <div style={{ marginTop: '28px' }}>
                    <div style={{ fontFamily: mono, fontSize: '9px', color: T3, letterSpacing: '2px', marginBottom: '16px' }}>OVERALL CONCLUSIONS</div>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '14px' }}>
                      {report.conclusions.map((c, i) => (
                        <div key={i} style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${ACC}`, borderRadius: '10px', padding: '16px 18px' }}>
                          <div style={{ fontFamily: mono, fontSize: '9px', color: ACC, fontWeight: 700, letterSpacing: '1px', marginBottom: '10px' }}>{c.title}</div>
                          <div style={{ fontSize: '11px', color: T2, lineHeight: 1.7 }}>{c.body}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Footer */}
                <div style={{ marginTop: '28px', borderTop: `1px solid ${BORDER}`, paddingTop: '14px', display: 'flex', justifyContent: 'space-between' }}>
                  <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>BHARATMONITOR · POLITICAL INTELLIGENCE PLATFORM · CONFIDENTIAL</div>
                  <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>Generated {formattedDate} IST · {account?.politician_name}</div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ════════════════════════════════════════════════════════════════
            TAB: CONTRADICTIONS
        ════════════════════════════════════════════════════════════════ */}
        {mainTab === 'contradictions' && (
          <div>
            {/* Contradiction header + type filter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '20px', flexWrap: 'wrap' }}>
              <div style={{ fontFamily: mono, fontSize: '9px', color: T2 }}>
                ⚡ {filteredContradictions.length} contradiction{filteredContradictions.length !== 1 ? 's' : ''} detected (2014–present)
              </div>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginLeft: 'auto' }}>
                {['all', ...contraTypes].map(t => (
                  <button key={t} onClick={() => setContraFilter(t)}
                    style={{ fontFamily: mono, fontSize: '7px', padding: '4px 10px', borderRadius: '20px', border: `1px solid ${contraFilter === t ? YELLOW : BORDER}`, background: contraFilter === t ? YELLOW + '15' : 'transparent', color: contraFilter === t ? YELLOW : T2, cursor: 'pointer', transition: 'all .15s', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    {t === 'all' ? `ALL (${(contradictions as any[]).length})` : t.replace(/_/g, ' ')}
                  </button>
                ))}
              </div>
            </div>

            {/* Contradiction + Narrative gaps — two-column layout */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '16px', marginBottom: '16px' }}>
              {/* Contradictions list */}
              <div>
                {filteredContradictions.length === 0 ? (
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '32px', textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 2.5 }}>
                      No contradictions detected yet.<br />
                      The AI engine scans for these automatically.<br />
                      Trigger an ingest from the dashboard to populate.
                    </div>
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                    {filteredContradictions.map((c: any) => (
                      <div key={c.id} style={{ background: CARD, border: `1px solid ${YELLOW}25`, borderRadius: '10px', padding: '14px 16px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                          <span style={{ fontFamily: mono, fontSize: '7px', color: YELLOW, background: YELLOW + '15', padding: '2px 7px', borderRadius: '4px', letterSpacing: '0.5px' }}>
                            {c.contradiction_type?.replace(/_/g, ' ').toUpperCase()}
                          </span>
                          <span style={{ fontFamily: mono, fontSize: '11px', fontWeight: 700, color: YELLOW, marginLeft: 'auto' }}>{c.contradiction_score}%</span>
                        </div>
                        <div style={{ fontSize: '12px', color: T0, fontWeight: 600, marginBottom: '6px' }}>{c.politician_name}</div>
                        {c.historical_quote && (
                          <div style={{ background: CARD2, borderRadius: '6px', padding: '8px 10px', marginBottom: '8px' }}>
                            <div style={{ fontFamily: mono, fontSize: '7px', color: T3, marginBottom: '3px', letterSpacing: '1px' }}>HISTORICAL POSITION</div>
                            <div style={{ fontSize: '10px', color: T1, lineHeight: 1.6 }}>"{c.historical_quote?.substring(0, 120)}…"</div>
                          </div>
                        )}
                        {c.current_quote && (
                          <div style={{ background: RED + '08', border: `1px solid ${RED}20`, borderRadius: '6px', padding: '8px 10px', marginBottom: '8px' }}>
                            <div style={{ fontFamily: mono, fontSize: '7px', color: RED, marginBottom: '3px', letterSpacing: '1px' }}>CURRENT POSITION</div>
                            <div style={{ fontSize: '10px', color: T1, lineHeight: 1.6 }}>"{c.current_quote?.substring(0, 120)}…"</div>
                          </div>
                        )}
                        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                          {c.source_url && <a href={c.source_url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mono, fontSize: '8px', color: BLUE }}>↗ Source</a>}
                          <span style={{ fontFamily: mono, fontSize: '7px', color: T3, marginLeft: 'auto' }}>{c.created_at?.substring(0, 10)}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Narrative gaps + pressure points */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                <SectionCard title="KEYWORD COVERAGE GAPS">
                  {topicGaps.length === 0 ? (
                    <div style={{ padding: '20px', textAlign: 'center', fontFamily: mono, fontSize: '9px', color: T3 }}>
                      No keywords configured. Add keywords in Settings → Account Profile.
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                      {topicGaps.map(g => (
                        <div key={g.keyword}
                          style={{ padding: '9px 12px', background: g.gap ? RED + '08' : CARD2, border: `1px solid ${g.gap ? RED + '25' : BORDER}`, borderRadius: '7px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                          <div style={{ flex: 1 }}>
                            <div style={{ fontSize: '11px', color: T0, marginBottom: '2px' }}>{g.keyword}</div>
                            <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>{g.count} items · {g.positivePct}% positive</div>
                          </div>
                          {g.gap && <span style={{ fontFamily: mono, fontSize: '7px', padding: '2px 5px', borderRadius: '3px', background: RED + '12', color: RED, border: `1px solid ${RED}25` }}>GAP</span>}
                          <div style={{ fontFamily: mono, fontSize: '11px', color: g.count > 5 ? GREEN : g.count > 0 ? YELLOW : RED, fontWeight: 600 }}>{g.count}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </SectionCard>

                <SectionCard title="ACTIVE PRESSURE POINTS" badge={`${pressureItems.length} items`}>
                  {pressureItems.length === 0 ? (
                    <div style={{ padding: '16px', textAlign: 'center', fontFamily: mono, fontSize: '9px', color: T3 }}>No crisis or developing signals — situation stable.</div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                      {pressureItems.map(item => {
                        const c = item.bucket === 'red' ? RED : YELLOW
                        return (
                          <div key={item.id} onClick={() => item.url && window.open(item.url, '_blank')}
                            style={{ padding: '9px 12px', background: c + '08', border: `1px solid ${c}20`, borderRadius: '7px', cursor: 'pointer' }}>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                              <span style={{ fontFamily: mono, fontSize: '7px', color: c }}>{item.bucket.toUpperCase()}</span>
                              <span style={{ fontFamily: mono, fontSize: '7px', color: T3, marginLeft: 'auto' }}>{item.platform}</span>
                            </div>
                            <div style={{ fontSize: '10px', color: T0, lineHeight: 1.5 }}>{item.headline?.substring(0, 90)}</div>
                            <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginTop: '3px' }}>{item.source}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </SectionCard>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @media print {
          nav, .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #0d1018 !important; }
          @page { margin: 12mm; size: A4; }
        }
      `}</style>
    </div>
  )
}
