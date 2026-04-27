import { useAccount, useTrendMetrics, useFeedItems } from '@/hooks/useData'
import NavBar from '@/components/layout/NavBar'
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar, Cell, RadialBarChart, RadialBar, PieChart, Pie } from 'recharts'
import { useMemo, useState, useEffect, useRef } from 'react'

const mono = 'IBM Plex Mono, monospace'

const PLAT_COLORS: Record<string, string> = {
  TWITTER: '#1d9bf0', INSTAGRAM: '#e1306c', FACEBOOK: '#1877f2',
  YOUTUBE: '#ff2020', NEWS: '#8892a4', REDDIT: '#ff4500', WHATSAPP: '#25d366',
}

function Card({ title, badge, children, span2 }: { title: string; badge?: string; children: React.ReactNode; span2?: boolean }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '18px', gridColumn: span2 ? 'span 2' : undefined }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
        <span style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px', flex: 1 }}>{title}</span>
        {badge && <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)', padding: '2px 6px', background: 'var(--s3)', borderRadius: '4px' }}>{badge}</span>}
      </div>
      {children}
    </div>
  )
}

// ─── Word Cloud (Canvas-based) ────────────────────────────────────────────────
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

    const colorMap: Record<string, string> = {
      positive: '#22d3a0', negative: '#f03e3e', neutral: '#8892a4', sarcasm: '#f5a623'
    }

    const sorted = [...words].sort((a, b) => b.count - a.count).slice(0, 50)

    for (const word of sorted) {
      const size = Math.max(10, Math.min(32, 10 + (word.count / max) * 22))
      ctx.font = `${word.count > max * 0.6 ? 700 : 400} ${size}px 'IBM Plex Mono', monospace`
      const tw = ctx.measureText(word.text).width
      const th = size * 1.2

      let placed_ok = false
      for (let attempt = 0; attempt < 150; attempt++) {
        const angle = (attempt * 0.5) * 0.8
        const r = attempt * 4.5
        const cx = W / 2 + r * Math.cos(angle)
        const cy = H / 2 + r * Math.sin(angle) * 0.6
        const x = cx - tw / 2, y = cy - th / 2

        if (x < 4 || x + tw > W - 4 || y < 4 || y + th > H - 4) continue

        const overlap = placed.some(p =>
          x < p.x + p.w + 4 && x + tw + 4 > p.x && y < p.y + p.h + 4 && y + th + 4 > p.y
        )
        if (overlap) continue

        placed.push({ x, y, w: tw, h: th })
        ctx.fillStyle = colorMap[word.sentiment] || '#8892a4'
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
    <div style={{ position: 'relative' }}>
      <canvas ref={canvasRef} width={580} height={280} style={{ width: '100%', height: '280px', display: 'block' }} />
      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', justifyContent: 'center' }}>
        {[['#22d3a0','Positive'],['#f03e3e','Negative'],['#f5a623','Sarcasm'],['#8892a4','Neutral']].map(([c,l]) => (
          <div key={l} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: c }} />
            <span style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)' }}>{l}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Keyword Association Map (SVG force-like) ─────────────────────────────────
function AssociationMap({ nodes, links }: { nodes: { id: string; count: number; sentiment: string }[]; links: { source: string; target: string; strength: number }[] }) {
  const svgRef = useRef<SVGSVGElement>(null)
  const W = 580, H = 300
  const cx = W / 2, cy = H / 2

  const positions = useMemo(() => {
    const pos: Record<string, { x: number; y: number }> = {}
    const main = nodes[0]?.id
    if (!main) return pos
    pos[main] = { x: cx, y: cy }
    const others = nodes.slice(1)
    others.forEach((n, i) => {
      const angle = (i / others.length) * Math.PI * 2
      const r = 80 + Math.random() * 60
      pos[n.id] = { x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) * 0.7 }
    })
    return pos
  }, [nodes])

  const colorMap: Record<string, string> = { positive: '#22d3a0', negative: '#f03e3e', neutral: '#8892a4', sarcasm: '#f5a623' }
  const max = Math.max(...nodes.map(n => n.count), 1)

  return (
    <svg ref={svgRef} width="100%" height={H} viewBox={`0 0 ${W} ${H}`} style={{ display: 'block' }}>
      {links.map((l, i) => {
        const s = positions[l.source], t = positions[l.target]
        if (!s || !t) return null
        return <line key={i} x1={s.x} y1={s.y} x2={t.x} y2={t.y} stroke="rgba(255,255,255,0.08)" strokeWidth={l.strength * 2} strokeDasharray={l.strength < 0.5 ? '4,4' : 'none'} />
      })}
      {nodes.map(n => {
        const p = positions[n.id]
        if (!p) return null
        const r = 14 + (n.count / max) * 20
        const c = colorMap[n.sentiment] || '#8892a4'
        const isMain = n.id === nodes[0]?.id
        return (
          <g key={n.id}>
            <circle cx={p.x} cy={p.y} r={r} fill={c + (isMain ? '30' : '18')} stroke={c} strokeWidth={isMain ? 2 : 1} />
            <text x={p.x} y={p.y + 4} textAnchor="middle" fill={c} fontSize={isMain ? 11 : 9} fontFamily={mono} fontWeight={isMain ? 700 : 400}>{n.id.length > 12 ? n.id.slice(0, 11) + '…' : n.id}</text>
          </g>
        )
      })}
    </svg>
  )
}

// ─── Circular Gauge ───────────────────────────────────────────────────────────
function CircularGauge({ value, max, label, color, sublabel }: { value: number; max: number; label: string; color: string; sublabel?: string }) {
  const pct = Math.min(value / Math.max(max, 1), 1)
  const r = 36, stroke = 8
  const circ = 2 * Math.PI * r
  const dash = pct * circ * 0.75
  const gap = circ - dash
  const rotation = -225

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' }}>
      <svg width={100} height={100} viewBox="0 0 100 100">
        <circle cx={50} cy={50} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={stroke} strokeDasharray={`${circ * 0.75} ${circ * 0.25}`} strokeLinecap="round" transform={`rotate(${rotation} 50 50)`} />
        <circle cx={50} cy={50} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeDasharray={`${dash} ${gap + circ * 0.25}`} strokeLinecap="round" transform={`rotate(${rotation} 50 50)`} style={{ transition: 'stroke-dasharray .6s ease' }} />
        <text x={50} y={48} textAnchor="middle" fill={color} fontSize={16} fontFamily={mono} fontWeight={700}>{value}</text>
        {sublabel && <text x={50} y={62} textAnchor="middle" fill="rgba(255,255,255,0.3)" fontSize={7} fontFamily={mono}>{sublabel}</text>}
      </svg>
      <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', letterSpacing: '0.5px', textAlign: 'center' }}>{label}</span>
    </div>
  )
}

export default function PoliticalTrendsPage() {
  const { data: account } = useAccount()
  const { data: feed = [] } = useFeedItems(account?.id || '')
  const [activeKeyword, setActiveKeyword] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'overview' | 'wordcloud' | 'associations' | 'conversations'>('overview')

  const keywords = account?.keywords || []

  // Signal gauges
  const gauges = useMemo(() => {
    const crisis  = feed.filter(f => f.bucket === 'red').length
    const dev     = feed.filter(f => f.bucket === 'yellow').length
    const bg      = feed.filter(f => f.bucket === 'blue' || f.bucket === 'silver').length
    const opp     = feed.filter(f => f.bucket === 'yellow' && f.sentiment !== 'negative').length
    const total   = Math.max(feed.length, 1)
    return { crisis, dev, bg, opp, total }
  }, [feed])

  // Word cloud data — extract meaningful words
  const wordCloudData = useMemo(() => {
    const counts: Record<string, { count: number; posCount: number; negCount: number; sarcasmCount: number }> = {}
    const stopWords = new Set(['the','a','an','in','on','at','of','to','and','or','for','is','are','was','were','be','been','has','have','had','will','with','this','that','these','those','they','them','their','its','by','from','not','but','as','if','it','he','she','we','you','i','do','did','does','can','could','would','should','may','might','must','shall','no','so','up','out','about','into','than','then','when','where','who','which','what','how','all','both','each','few','more','most','other','some','such','also','even','too','just','very','much','many','any','now','only','same','than','then','there','here','after','before','well','back','over','new','first','last','long','great','little','own','right','big','high','old','next','early','young','important','public','private','real','best','free','never','always','still','again','ago','give','call','come','know','let','look','make','say','see','take','tell','want'])

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
      .map(([text, v]) => ({
        text,
        count: v.count,
        sentiment: v.sarcasmCount > 0 ? 'sarcasm' : v.posCount > v.negCount ? 'positive' : v.negCount > v.posCount ? 'negative' : 'neutral',
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 80)
  }, [feed])

  // Association map — keyword co-occurrences
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
      { id: kw, count: matched.length, sentiment: matched.filter(f=>f.sentiment==='positive').length > matched.filter(f=>f.sentiment==='negative').length ? 'positive' : 'negative' },
      ...topTerms.map(([id, v]) => ({ id, count: v.count, sentiment: v.posCount > v.negCount ? 'positive' : v.negCount > v.posCount ? 'negative' : 'neutral' })),
    ]
    const links = topTerms.map(([id, v]) => ({ source: kw, target: id, strength: Math.min(v.count / matched.length, 1) }))
    return { nodes, links }
  }, [feed, activeKeyword, keywords])

  // Sentiment over time
  const sentimentOverTime = useMemo(() => {
    const byDay: Record<string, { pos: number; neg: number; total: number }> = {}
    feed.forEach(f => {
      const day = f.published_at.substring(0, 10)
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

  // Keyword performance
  const keywordData = useMemo(() =>
    keywords.slice(0, 10).map(kw => {
      const items = feed.filter(f => (f.keyword || '').toLowerCase() === kw.toLowerCase() || f.headline.toLowerCase().includes(kw.toLowerCase()))
      const pos = items.filter(f => f.sentiment === 'positive').length
      const neg = items.filter(f => f.sentiment === 'negative').length
      const crisis = items.filter(f => f.bucket === 'red').length
      return { keyword: kw, total: items.length, positive: pos, negative: neg, crisis, score: items.length ? Math.round((pos / items.length) * 100) : 50 }
    }).sort((a, b) => b.total - a.total)
  , [feed, keywords])

  // Top sources
  const sourceData = useMemo(() => {
    const c: Record<string, number> = {}
    feed.forEach(f => { if (f.source) c[f.source] = (c[f.source] || 0) + 1 })
    return Object.entries(c).map(([s, n]) => ({ source: s, count: n })).sort((a, b) => b.count - a.count).slice(0, 8)
  }, [feed])

  // Top conversations
  const topConversations = useMemo(() =>
    [...feed]
      .filter(f => activeKeyword ? f.headline.toLowerCase().includes(activeKeyword.toLowerCase()) : true)
      .sort((a, b) => {
        const sA = (a.bucket === 'red' ? 100 : a.bucket === 'yellow' ? 50 : 0) + (a.engagement || 0)
        const sB = (b.bucket === 'red' ? 100 : b.bucket === 'yellow' ? 50 : 0) + (b.engagement || 0)
        return sB - sA
      })
      .slice(0, 20)
  , [feed, activeKeyword])

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <NavBar />
      <div style={{ maxWidth: '1260px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Header + KPIs */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '20px' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)', letterSpacing: '2px', marginBottom: '6px' }}>POLITICAL INTELLIGENCE · TRENDS</div>
            <div style={{ fontSize: '20px', fontWeight: 600, color: '#edf0f8' }}>{account?.politician_name || 'Account'}</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '10px' }}>
            {[
              { l: 'ITEMS', v: feed.length, c: 'var(--t0)' },
              { l: 'CRISIS', v: gauges.crisis, c: '#f03e3e' },
              { l: 'DEVELOPING', v: gauges.dev, c: '#f5a623' },
              { l: 'OPP GAPS', v: gauges.opp, c: '#22d3a0' },
            ].map(k => (
              <div key={k.l} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '8px 14px', textAlign: 'center' }}>
                <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', marginBottom: '3px' }}>{k.l}</div>
                <div style={{ fontFamily: mono, fontSize: '18px', fontWeight: 700, color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Intensity Gauges */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '18px', marginBottom: '16px' }}>
          <div style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '16px' }}>SIGNAL INTENSITY</div>
          <div style={{ display: 'flex', justifyContent: 'space-around', flexWrap: 'wrap', gap: '8px' }}>
            <CircularGauge value={gauges.crisis} max={Math.max(feed.length, 1)} label="CRISIS" color="#f03e3e" sublabel="items" />
            <CircularGauge value={gauges.dev} max={Math.max(feed.length, 1)} label="DEVELOPING" color="#f5a623" sublabel="items" />
            <CircularGauge value={gauges.bg} max={Math.max(feed.length, 1)} label="BACKGROUND" color="#3d8ef0" sublabel="items" />
            <CircularGauge value={gauges.opp} max={Math.max(feed.length, 1)} label="OPP GAPS" color="#22d3a0" sublabel="counter" />
            <CircularGauge value={feed.filter(f=>f.sentiment==='positive').length} max={Math.max(feed.length,1)} label="POSITIVE" color="#22d3a0" sublabel="mentions" />
            <CircularGauge value={feed.filter(f=>f.sentiment==='negative').length} max={Math.max(feed.length,1)} label="NEGATIVE" color="#f03e3e" sublabel="mentions" />
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '16px', borderBottom: '1px solid var(--b1)' }}>
          {[['overview','OVERVIEW'],['wordcloud','WORD CLOUD'],['associations','ASSOCIATIONS'],['conversations','TOP CONVERSATIONS']].map(([id, label]) => (
            <button key={id} onClick={() => setActiveTab(id as any)} style={{
              fontFamily: mono, fontSize: '9px', letterSpacing: '0.5px', padding: '8px 14px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: activeTab === id ? 'var(--acc)' : 'var(--t2)',
              borderBottom: `2px solid ${activeTab === id ? 'var(--acc)' : 'transparent'}`,
              marginBottom: '-1px', transition: 'all .15s',
            }}>{label}</button>
          ))}
        </div>

        {/* Tab: Overview */}
        {activeTab === 'overview' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            <Card title="SENTIMENT TREND (14 DAYS)">
              {sentimentOverTime.length > 1 ? (
                <ResponsiveContainer width="100%" height={180}>
                  <AreaChart data={sentimentOverTime}>
                    <defs>
                      <linearGradient id="pg" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#22d3a0" stopOpacity={0.25}/><stop offset="95%" stopColor="#22d3a0" stopOpacity={0}/></linearGradient>
                      <linearGradient id="ng" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="#f03e3e" stopOpacity={0.2}/><stop offset="95%" stopColor="#f03e3e" stopOpacity={0}/></linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="date" tick={{ fill: '#545f78', fontSize: 8, fontFamily: mono }} axisLine={false} tickLine={false} />
                    <YAxis domain={[0,100]} tick={{ fill: '#545f78', fontSize: 8 }} axisLine={false} tickLine={false} unit="%" />
                    <Tooltip contentStyle={{ background: '#121620', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '6px', fontSize: '10px', fontFamily: mono }} />
                    <Area type="monotone" dataKey="positive" name="Positive" stroke="#22d3a0" fill="url(#pg)" strokeWidth={2} />
                    <Area type="monotone" dataKey="negative" name="Negative" stroke="#f03e3e" fill="url(#ng)" strokeWidth={2} />
                  </AreaChart>
                </ResponsiveContainer>
              ) : <div style={{ height: 180, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '9px', color: 'var(--t3)' }}>Need 2+ days of data</div>}
            </Card>

            <Card title="KEYWORD PERFORMANCE">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>
                {keywordData.length > 0 ? keywordData.map(kw => (
                  <div key={kw.keyword} onClick={() => setActiveKeyword(activeKeyword === kw.keyword ? null : kw.keyword)}
                    style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '5px 7px', borderRadius: '5px', cursor: 'pointer', background: activeKeyword === kw.keyword ? 'var(--s3)' : 'transparent', transition: 'background .12s' }}>
                    <span style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t1)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{kw.keyword}</span>
                    {kw.crisis > 0 && <span style={{ fontFamily: mono, fontSize: '7px', color: '#f03e3e', background: 'rgba(240,62,62,0.1)', padding: '1px 5px', borderRadius: '3px' }}>⚡{kw.crisis}</span>}
                    <div style={{ width: '70px', height: '4px', background: 'var(--s3)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${Math.min((kw.total / Math.max(keywordData[0]?.total || 1, 1)) * 100, 100)}%`, background: kw.crisis > 0 ? '#f03e3e' : kw.negative > kw.positive ? '#f5a623' : '#22d3a0', borderRadius: '2px' }} />
                    </div>
                    <span style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t2)', minWidth: '24px', textAlign: 'right' }}>{kw.total}</span>
                  </div>
                )) : <div style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t3)', textAlign: 'center', padding: '24px' }}>No keyword data yet</div>}
              </div>
            </Card>

            <Card title="TOP SOURCES">
              <ResponsiveContainer width="100%" height={180}>
                <BarChart data={sourceData} layout="vertical" margin={{ left: 10, right: 30 }}>
                  <XAxis type="number" tick={{ fill: '#545f78', fontSize: 8 }} axisLine={false} tickLine={false} />
                  <YAxis dataKey="source" type="category" tick={{ fill: '#9aa3b8', fontSize: 8, fontFamily: mono }} axisLine={false} tickLine={false} width={90} />
                  <Tooltip contentStyle={{ background: '#121620', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '6px', fontSize: '10px', fontFamily: mono }} />
                  <Bar dataKey="count" fill="#3d8ef0" fillOpacity={0.8} radius={[0,4,4,0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card title="PLATFORM COVERAGE">
              {(() => {
                const platforms: Record<string,number> = {}
                feed.forEach(f => { platforms[f.platform] = (platforms[f.platform]||0)+1 })
                const data = Object.entries(platforms).map(([name, value]) => ({ name: name.toUpperCase(), value })).sort((a,b)=>b.value-a.value)
                const max = data[0]?.value || 1
                return data.length > 0 ? (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '7px' }}>
                    {data.map(p => (
                      <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontFamily: mono, fontSize: '8px', color: PLAT_COLORS[p.name] || '#8892a4', width: '72px', flexShrink: 0 }}>{p.name}</span>
                        <div style={{ flex: 1, height: '5px', background: 'var(--s3)', borderRadius: '3px', overflow: 'hidden' }}>
                          <div style={{ width: `${(p.value / max) * 100}%`, height: '100%', background: PLAT_COLORS[p.name] || '#8892a4', borderRadius: '3px' }} />
                        </div>
                        <span style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t2)', minWidth: '28px', textAlign: 'right' }}>{p.value}</span>
                      </div>
                    ))}
                  </div>
                ) : <div style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t3)', textAlign: 'center', padding: '24px' }}>No data yet</div>
              })()}
            </Card>
          </div>
        )}

        {/* Tab: Word Cloud */}
        {activeTab === 'wordcloud' && (
          <Card title="KEYWORD WORD CLOUD" badge={`${wordCloudData.length} TERMS`} span2>
            {wordCloudData.length > 0 ? (
              <WordCloud words={wordCloudData} />
            ) : <div style={{ height: 280, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '9px', color: 'var(--t3)' }}>No word data yet — trigger an ingest from dashboard</div>}
            <div style={{ marginTop: '12px', display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {wordCloudData.slice(0, 20).map(w => (
                <span key={w.text} style={{ fontFamily: mono, fontSize: '8px', padding: '3px 8px', borderRadius: '4px', background: w.sentiment === 'positive' ? 'rgba(34,211,160,0.1)' : w.sentiment === 'negative' ? 'rgba(240,62,62,0.1)' : w.sentiment === 'sarcasm' ? 'rgba(245,166,35,0.1)' : 'rgba(136,146,164,0.1)', color: w.sentiment === 'positive' ? '#22d3a0' : w.sentiment === 'negative' ? '#f03e3e' : w.sentiment === 'sarcasm' ? '#f5a623' : '#8892a4', border: `1px solid ${w.sentiment === 'positive' ? 'rgba(34,211,160,0.2)' : w.sentiment === 'negative' ? 'rgba(240,62,62,0.2)' : 'rgba(136,146,164,0.15)'}` }}>
                  {w.text} <span style={{ opacity: 0.6 }}>{w.count}</span>
                </span>
              ))}
            </div>
          </Card>
        )}

        {/* Tab: Associations */}
        {activeTab === 'associations' && (
          <div>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '12px' }}>
              {keywords.map(kw => (
                <button key={kw} onClick={() => setActiveKeyword(activeKeyword === kw ? null : kw)} style={{ fontFamily: mono, fontSize: '8px', padding: '4px 10px', borderRadius: '20px', border: `1px solid ${activeKeyword === kw ? 'var(--acc)' : 'var(--b1)'}`, background: activeKeyword === kw ? 'rgba(249,115,22,0.1)' : 'transparent', color: activeKeyword === kw ? 'var(--acc)' : 'var(--t2)', cursor: 'pointer', transition: 'all .15s' }}>{kw}</button>
              ))}
            </div>
            <Card title={`KEYWORD ASSOCIATIONS — ${activeKeyword || keywords[0] || 'select keyword'}`} badge={`${associationData.nodes.length - 1} connections`} span2>
              {associationData.nodes.length > 1 ? (
                <AssociationMap nodes={associationData.nodes} links={associationData.links} />
              ) : <div style={{ height: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '9px', color: 'var(--t3)' }}>Select a keyword to see associations</div>}
            </Card>
          </div>
        )}

        {/* Tab: Conversations */}
        {activeTab === 'conversations' && (
          <Card title="TOP CONVERSATIONS" badge={`${topConversations.length} ITEMS${activeKeyword ? ` · ${activeKeyword}` : ''}`} span2>
            {activeKeyword && (
              <button onClick={() => setActiveKeyword(null)} style={{ marginBottom: '10px', fontFamily: mono, fontSize: '8px', color: 'var(--acc)', background: 'none', border: '1px solid var(--acc)', borderRadius: '4px', padding: '3px 8px', cursor: 'pointer' }}>✕ Clear filter</button>
            )}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {topConversations.map((item, i) => {
                const bc = item.bucket === 'red' ? '#f03e3e' : item.bucket === 'yellow' ? '#f5a623' : item.bucket === 'blue' ? '#3d8ef0' : '#8892a4'
                return (
                  <div key={item.id} style={{ display: 'flex', gap: '10px', padding: '10px 8px', borderBottom: '1px solid var(--b0)', transition: 'background .12s' }}
                    onMouseEnter={e => { e.currentTarget.style.background = 'var(--s2)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                    <span style={{ fontFamily: mono, fontSize: '9px', color: 'var(--t3)', width: '18px', flexShrink: 0, paddingTop: '2px' }}>{i + 1}</span>
                    <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: bc, flexShrink: 0, marginTop: '5px' }} />
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontSize: '11px', color: 'var(--t0)', lineHeight: 1.5, marginBottom: '3px' }}>{item.headline}</div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>{item.source}</span>
                        <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>·</span>
                        <span style={{ fontFamily: mono, fontSize: '8px', color: PLAT_COLORS[item.platform.toUpperCase()] || '#8892a4' }}>{item.platform.toUpperCase()}</span>
                        {item.keyword && <span style={{ fontFamily: mono, fontSize: '7px', color: '#7c6dfa', background: 'rgba(124,109,250,0.1)', padding: '1px 5px', borderRadius: '3px' }}>#{item.keyword}</span>}
                        {(item.topic_tags || []).slice(0, 2).map(t => <span key={t} style={{ fontFamily: mono, fontSize: '7px', color: '#22d3a0', background: 'rgba(34,211,160,0.08)', padding: '1px 5px', borderRadius: '3px' }}>{t}</span>)}
                      </div>
                    </div>
                    {item.url && (
                      <a href={item.url} target="_blank" rel="noopener noreferrer"
                        style={{ fontFamily: mono, fontSize: '10px', color: 'var(--t3)', textDecoration: 'none', flexShrink: 0, padding: '0 4px' }}
                        onMouseEnter={e => { e.currentTarget.style.color = 'var(--acc)' }}
                        onMouseLeave={e => { e.currentTarget.style.color = 'var(--t3)' }}>↗</a>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  )
}
