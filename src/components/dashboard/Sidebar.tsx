import { useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Tooltip, Cell } from 'recharts'
import { Link } from 'react-router-dom'
import type { Account, ConstituencyPulse, CompetitorSummary, SchemeSentiment, IssueOwnershipPoint, AIBrief, FeedItem } from '@/types'
import { useDashboardStore } from '@/store'

function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding:'12px 13px', borderBottom:'1px solid var(--b0)' }}>
      <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'8px', color:'var(--t2)', letterSpacing:'2px', marginBottom:'10px', display:'flex', alignItems:'center', justifyContent:'space-between' }}>
        {title}
        {badge && <span style={{ fontSize:'7px', padding:'1px 5px', borderRadius:'2px', background:'var(--s3)', color:'var(--t2)', border:'1px solid var(--b1)' }}>{badge}</span>}
      </div>
      {children}
    </div>
  )
}

function AIAnalysis({ brief }: { brief: AIBrief | null }) {
  if (!brief) return (
    <Section title="AI ANALYSIS" badge="LIVE">
      <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'9px', color:'var(--t3)', textAlign:'center', padding:'12px 0', lineHeight: 1.8 }}>
        Feed loading — AI analysis<br />generates once data arrives.
      </div>
    </Section>
  )
  return (
    <Section title="AI ANALYSIS" badge="LIVE">
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'7px', marginBottom:'7px' }}>
        {[{label:'SITUATION', text: brief.situation_summary},{label:'PATTERN', text: brief.pattern_analysis}].map(p=>(
          <div key={p.label} style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'6px', padding:'8px' }}>
            <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'7px', color:'var(--t2)', letterSpacing:'1px', marginBottom:'4px' }}>{p.label}</div>
            <div style={{ fontSize:'10px', color:'var(--t1)', lineHeight:1.6 }}>{(p.text||'').substring(0,110)}{p.text?.length>110?'…':''}</div>
          </div>
        ))}
      </div>
      {brief.opportunities?.length > 0 && (
        <div style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'6px', padding:'8px' }}>
          <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'7px', color:'var(--t2)', letterSpacing:'1px', marginBottom:'6px' }}>NARRATIVE OPPORTUNITIES</div>
          {brief.opportunities.slice(0,3).map(opp=>(
            <div key={opp.id} style={{ display:'flex', alignItems:'flex-start', gap:'5px', padding:'5px 0', borderBottom:'1px solid var(--b0)' }}>
              <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'7px', padding:'2px 4px', borderRadius:'2px', background:'rgba(249,115,22,0.12)', color:'var(--acc)', flexShrink:0, minWidth:'28px', textAlign:'center' }}>
                {typeof opp.score==='number'?`${opp.score}%`:opp.score}
              </span>
              <div style={{ fontSize:'10px', color:'var(--t1)', lineHeight:1.5 }}>{opp.description?.substring(0,80)}</div>
            </div>
          ))}
        </div>
      )}
    </Section>
  )
}

function SentimentPanel({ feed }: { feed: FeedItem[] }) {
  const total = feed.length || 1
  const pos = feed.filter(f => f.sentiment === 'positive').length
  const neg = feed.filter(f => f.sentiment === 'negative').length
  const neu = total - pos - neg
  const sent = [
    { name:'Positive', value: Math.round((pos / total) * 100), color:'#22d3a0' },
    { name:'Negative', value: Math.round((neg / total) * 100), color:'#f03e3e' },
    { name:'Neutral',  value: Math.round((neu / total) * 100), color:'#2e3650' },
  ]
  return (
    <Section title="SENTIMENT" badge={`${feed.length} ITEMS`}>
      <div style={{ display:'flex', alignItems:'center', gap:'12px' }}>
        <div style={{ flex:1 }}>
          {sent.map(s=>(
            <div key={s.name} style={{ display:'flex', alignItems:'center', gap:'5px', marginBottom:'5px' }}>
              <span style={{ fontSize:'9px', color:'var(--t1)', width:'44px', flexShrink:0 }}>{s.name}</span>
              <div style={{ flex:1, height:'3px', background:'var(--s3)', borderRadius:'3px', overflow:'hidden' }}>
                <div style={{ width:`${s.value}%`, height:'100%', background:s.color, borderRadius:'3px' }}/>
              </div>
              <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'8px', color:'var(--t2)', minWidth:'22px', textAlign:'right' }}>{s.value}%</span>
            </div>
          ))}
        </div>
      </div>
    </Section>
  )
}

function PulsePanel({ pulse }: { pulse: ConstituencyPulse }) {
  const issues = pulse.issues || []
  return (
    <Section title="CONSTITUENCY PULSE" badge={(pulse.constituency||'NATIONAL').toUpperCase()}>
      {issues.length === 0 ? (
        <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'9px', color:'var(--t3)', padding:'8px 0' }}>
          Tracking {pulse.constituency || 'National'} — feed data loading…
        </div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'5px' }}>
          {issues.map(issue=>{
            const c = issue.sentiment==='positive'?'#22d3a0':issue.sentiment==='negative'?'#f03e3e':'#3d8ef0'
            const topic = (issue as any).topic||(issue as any).issue||''
            const vol = (issue as any).volume_pct||(issue as any).volume||50
            return (
              <div key={topic} style={{ background:'var(--s2)', border:'1px solid var(--b1)', borderRadius:'6px', padding:'7px' }}>
                <div style={{ fontSize:'10px', color:'var(--t0)', fontWeight:500, marginBottom:'4px' }}>{topic}</div>
                <div style={{ height:'3px', background:'var(--s3)', borderRadius:'3px', overflow:'hidden', marginBottom:'3px' }}>
                  <div style={{ width:`${vol}%`, height:'100%', background:c, borderRadius:'3px' }}/>
                </div>
                <div style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'9px', color:'var(--t2)' }}>{vol}</span>
                  <span style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'8px', color:issue.trend==='up'?'var(--grn)':issue.trend==='down'?'var(--red)':'var(--t3)' }}>
                    {issue.trend==='up'?'▲':issue.trend==='down'?'▼':'—'}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Section>
  )
}

function CompetitorPanel({ competitors }: { competitors: CompetitorSummary[] }) {
  if (!competitors?.length) return (
    <Section title="COMPETITOR MONITOR">
      <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'9px', color:'var(--t3)', padding:'8px 0' }}>No competitors tracked</div>
    </Section>
  )
  return (
    <Section title="COMPETITOR MONITOR">
      {competitors.map(c=>{
        const st = c.status==='contradiction'?{bg:'rgba(245,166,35,0.1)',color:'#f5a623',label:'⚡ CONTRA'}
          :c.status==='rti'?{bg:'rgba(240,62,62,0.1)',color:'#f03e3e',label:'RTI'}
          :c.status==='clear'?{bg:'rgba(34,211,160,0.1)',color:'#22d3a0',label:'CLEAR'}
          :{bg:'rgba(255,255,255,0.04)',color:'#545f78',label:'WATCH'}
        return (
          <div key={c.politician.id} style={{ display:'flex', alignItems:'center', gap:'7px', padding:'6px 0', borderBottom:'1px solid var(--b0)' }}>
            <div style={{ width:'26px', height:'26px', borderRadius:'6px', background:'rgba(61,142,240,0.1)', border:'1px solid rgba(61,142,240,0.2)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', color:'#3d8ef0', fontFamily:'IBM Plex Mono, monospace', flexShrink:0 }}>{c.politician.initials}</div>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontSize:'11px', fontWeight:500, color:'var(--t0)' }}>{c.politician.name}</div>
              <div style={{ fontSize:'8px', color:'var(--t2)', fontFamily:'IBM Plex Mono, monospace', marginTop:'1px' }}>{c.statements_today} stmts</div>
            </div>
            <span style={{ fontSize:'7px', fontFamily:'IBM Plex Mono, monospace', padding:'2px 5px', borderRadius:'3px', background:st.bg, color:st.color, flexShrink:0 }}>{st.label}</span>
          </div>
        )
      })}
    </Section>
  )
}

function SchemePanel({ schemes }: { schemes: SchemeSentiment[] }) {
  if (!schemes?.length) return null
  return (
    <Section title="SCHEME SENTIMENT" badge="NATIONAL">
      <div style={{ height:'130px' }}>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={schemes} layout="vertical" margin={{ top:2, right:2, bottom:2, left:4 }}>
            <XAxis type="number" domain={[0,100]} tick={{ fill:'#545f78', fontSize:8 }} axisLine={false} tickLine={false}/>
            <YAxis dataKey="scheme_name" type="category" tick={{ fill:'#9aa3b8', fontSize:8, fontFamily:'IBM Plex Mono' }} axisLine={false} tickLine={false} width={70} tickFormatter={(v: string) => v.length > 10 ? v.slice(0, 9) + '…' : v}/>
            <Tooltip contentStyle={{ background:'#121620', border:'1px solid rgba(255,255,255,0.13)', borderRadius:'6px', fontSize:'10px' }}/>
            <Bar dataKey="sentiment_score" radius={[0,3,3,0]}>
              {schemes.map(s=>(<Cell key={s.scheme_name} fill={s.sentiment_score>=70?'#22d3a0':s.sentiment_score>=50?'#f97316':'#f03e3e'} fillOpacity={0.85}/>))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  )
}

// Social Handle interface
interface SocialHandle {
  handle: string
  platform: 'twitter' | 'instagram' | 'reddit'
  displayName: string
  followers: number
  posts: number
  sentiment: 'positive' | 'negative' | 'neutral'
  recentActivity: string
}

// Platform icons and colors
const PLATFORM_CONFIG = {
  twitter: { icon: '𝕏', color: '#1DA1F2', label: 'Twitter/X' },
  instagram: { icon: '📸', color: '#E4405F', label: 'Instagram' },
  reddit: { icon: '🔴', color: '#FF4500', label: 'Reddit' },
}

function formatFollowers(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function SocialHandlesPanel({ account, feed }: { account: Account; feed: FeedItem[] }) {
  const [activeTab, setActiveTab] = useState<'all' | 'twitter' | 'instagram' | 'reddit'>('all')
  const [sortBy, setSortBy] = useState<'followers' | 'posts'>('followers')

  // Derive handles from actual feed data — aggregate by source + platform
  const derivedHandles: SocialHandle[] = (() => {
    const sourceMap = new Map<string, { platform: SocialHandle['platform']; count: number; sentiments: string[]; lastSeen: string }>()
    for (const item of feed) {
      const plat = item.platform as string
      if (!['twitter', 'instagram', 'reddit'].includes(plat)) continue
      const src = item.source || 'unknown'
      const key = `${plat}:${src}`
      const existing = sourceMap.get(key)
      if (existing) {
        existing.count++
        existing.sentiments.push(item.sentiment)
        if (item.published_at > existing.lastSeen) existing.lastSeen = item.published_at
      } else {
        sourceMap.set(key, { platform: plat as SocialHandle['platform'], count: 1, sentiments: [item.sentiment], lastSeen: item.published_at })
      }
    }
    return Array.from(sourceMap.entries()).map(([key, val]) => {
      const src = key.split(':').slice(1).join(':')
      const posCount = val.sentiments.filter(s => s === 'positive').length
      const negCount = val.sentiments.filter(s => s === 'negative').length
      const majorSent = posCount > negCount ? 'positive' : negCount > posCount ? 'negative' : 'neutral'
      const ago = Math.round((Date.now() - new Date(val.lastSeen).getTime()) / 3600000)
      return {
        handle: src.startsWith('@') ? src : `@${src}`,
        platform: val.platform,
        displayName: src.replace(/^@/, ''),
        followers: 0,
        posts: val.count,
        sentiment: majorSent as SocialHandle['sentiment'],
        recentActivity: ago < 1 ? 'just now' : `${ago}h ago`,
      }
    })
  })()

  // Filter and sort handles
  const filteredHandles = derivedHandles
    .filter(h => activeTab === 'all' || h.platform === activeTab)
    .sort((a, b) => sortBy === 'followers' ? b.followers - a.followers : b.posts - a.posts)

  const platformCounts = {
    twitter: derivedHandles.filter(h => h.platform === 'twitter').length,
    instagram: derivedHandles.filter(h => h.platform === 'instagram').length,
    reddit: derivedHandles.filter(h => h.platform === 'reddit').length,
  }

  return (
    <Section title="PEOPLE / AUDIENCE" badge={derivedHandles.length > 0 ? `${derivedHandles.length} SOURCES` : 'LIVE'}>
      {/* Platform tabs */}
      <div style={{ display:'flex', gap:'3px', marginBottom:'8px' }}>
        {(['all', 'twitter', 'instagram', 'reddit'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            style={{
              flex: 1,
              padding: '4px 2px',
              border: `1px solid ${activeTab === tab ? 'rgba(249,115,22,0.4)' : 'var(--b1)'}`,
              borderRadius: '4px',
              background: activeTab === tab ? 'rgba(249,115,22,0.1)' : 'transparent',
              color: activeTab === tab ? 'var(--acc)' : 'var(--t2)',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '7px',
              cursor: 'pointer',
              textTransform: 'uppercase',
            }}
          >
            {tab === 'all' ? 'ALL' : PLATFORM_CONFIG[tab].icon} {tab === 'all' ? '' : platformCounts[tab]}
          </button>
        ))}
      </div>

      {/* Sort toggle */}
      <div style={{ display:'flex', gap:'4px', marginBottom:'8px' }}>
        <button
          onClick={() => setSortBy('followers')}
          style={{
            flex: 1,
            padding: '3px 6px',
            border: `1px solid ${sortBy === 'followers' ? 'rgba(61,142,240,0.4)' : 'var(--b1)'}`,
            borderRadius: '3px',
            background: sortBy === 'followers' ? 'rgba(61,142,240,0.1)' : 'transparent',
            color: sortBy === 'followers' ? '#3d8ef0' : 'var(--t3)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '7px',
            cursor: 'pointer',
          }}
        >
          BY FOLLOWERS
        </button>
        <button
          onClick={() => setSortBy('posts')}
          style={{
            flex: 1,
            padding: '3px 6px',
            border: `1px solid ${sortBy === 'posts' ? 'rgba(34,211,160,0.4)' : 'var(--b1)'}`,
            borderRadius: '3px',
            background: sortBy === 'posts' ? 'rgba(34,211,160,0.1)' : 'transparent',
            color: sortBy === 'posts' ? '#22d3a0' : 'var(--t3)',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '7px',
            cursor: 'pointer',
          }}
        >
          BY POSTS
        </button>
      </div>

      {/* Handle list */}
      <div style={{ maxHeight: '240px', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>
        {filteredHandles.slice(0, 8).map(h => {
          const pc = PLATFORM_CONFIG[h.platform]
          const sentColor = h.sentiment === 'positive' ? '#22d3a0' : h.sentiment === 'negative' ? '#f03e3e' : '#3d8ef0'
          return (
            <div
              key={h.handle}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '7px',
                padding: '6px 4px',
                borderBottom: '1px solid var(--b0)',
                cursor: 'pointer',
              }}
              title={`${h.displayName} - ${formatFollowers(h.followers)} followers, ${h.posts} posts about topic`}
            >
              {/* Platform icon */}
              <div
                style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: '5px',
                  background: `${pc.color}18`,
                  border: `1px solid ${pc.color}30`,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '10px',
                  flexShrink: 0,
                }}
              >
                {pc.icon}
              </div>

              {/* Handle info */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '10px', fontWeight: 500, color: 'var(--t0)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {h.handle}
                </div>
                <div style={{ fontSize: '8px', color: 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', marginTop: '1px' }}>
                  {formatFollowers(h.followers)} · {h.posts} posts · {h.recentActivity}
                </div>
              </div>

              {/* Sentiment indicator */}
              <div
                style={{
                  width: '6px',
                  height: '6px',
                  borderRadius: '50%',
                  background: sentColor,
                  flexShrink: 0,
                }}
                title={`${h.sentiment} sentiment`}
              />
            </div>
          )
        })}
      </div>

      {/* Summary stats */}
      <div style={{ 
        marginTop: '8px', 
        padding: '6px 8px', 
        background: 'rgba(249,115,22,0.05)', 
        border: '1px solid rgba(249,115,22,0.15)', 
        borderRadius: '5px' 
      }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px' }}>
          {(['twitter', 'instagram', 'reddit'] as const).map(p => {
            const handles = derivedHandles.filter(h => h.platform === p)
            const totalFollowers = handles.reduce((s, h) => s + h.followers, 0)
            const totalPosts = handles.reduce((s, h) => s + h.posts, 0)
            return (
              <div key={p} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '11px' }}>{PLATFORM_CONFIG[p].icon}</div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t0)', marginTop: '2px' }}>
                  {formatFollowers(totalFollowers)}
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)' }}>
                  {totalPosts} posts
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </Section>
  )
}

function KeywordsPanel({ account }: { account: Account }) {
  const kws = account?.keywords || []
  if (!kws.length) return null
  return (
    <Section title="TRACKED KEYWORDS" badge={`${kws.length}`}>
      <div style={{ display:'flex', flexWrap:'wrap', gap:'5px' }}>
        {kws.map(kw=>(
          <Link key={kw} to={`/keywords/${encodeURIComponent(kw)}`}
            style={{ padding:'3px 8px', borderRadius:'4px', background:'rgba(249,115,22,0.08)', border:'1px solid rgba(249,115,22,0.2)', color:'#fdba74', fontFamily:'IBM Plex Mono, monospace', fontSize:'8px', textDecoration:'none' }}>
            ⚡ {kw}
          </Link>
        ))}
      </div>
    </Section>
  )
}

interface Props {
  pulse: ConstituencyPulse
  competitors: CompetitorSummary[]
  schemes: SchemeSentiment[]
  issueOwnership: IssueOwnershipPoint[]
  account: Account
  brief: AIBrief | null
  feed: FeedItem[]
}

export default function Sidebar({ pulse, competitors, schemes, account, brief, feed }: Props) {
  const { geoScope, setGeoScope } = useDashboardStore()
  return (
    <div style={{ background:'var(--s1)', display:'flex', flexDirection:'column', overflowY:'auto', scrollbarWidth:'thin', scrollbarColor:'rgba(255,255,255,0.1) transparent', minHeight:0 }}>
      <div style={{ padding:'7px 12px', borderBottom:'1px solid var(--b0)', display:'flex', gap:'4px', flexShrink:0 }}>
        {(['national','state','constituency'] as const).map(g=>(
          <button key={g} onClick={()=>setGeoScope(g)} style={{ flex:1, padding:'4px', border:`1px solid ${geoScope===g?'rgba(249,115,22,0.4)':'var(--b1)'}`, borderRadius:'4px', background:geoScope===g?'rgba(249,115,22,0.1)':'transparent', color:geoScope===g?'var(--acc)':'var(--t2)', fontFamily:'IBM Plex Mono, monospace', fontSize:'7px', cursor:'pointer', textTransform:'uppercase' }}>
            {g}
          </button>
        ))}
      </div>
      <KeywordsPanel account={account} />
      <AIAnalysis brief={brief} />
      <SentimentPanel feed={feed} />
      <PulsePanel pulse={pulse} />
      <CompetitorPanel competitors={competitors} />
      <SocialHandlesPanel account={account} feed={feed} />
      <SchemePanel schemes={schemes} />
      <div style={{ padding:'12px 13px', textAlign:'center', flexShrink:0 }}>
        <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'8px', color:'var(--t3)', lineHeight:1.9 }}>
          BharatMonitor · Political Intelligence<br/>
          <a href="mailto:ankit@hertzmsc.com" style={{ color:'var(--acc)' }}>ankit@hertzmsc.com</a>
        </div>
      </div>
    </div>
  )
}
