import { useEffect, useMemo, useRef } from 'react'
import { useAccount, useFeedItems, useContradictions, useCompetitors } from '@/hooks/useData'

const mono = '"IBM Plex Mono", monospace'
const DARK = '#0d1018'
const CARD = '#111827'
const BORDER = 'rgba(255,255,255,0.08)'
const ACC = '#f97316'
const GREEN = '#22d3a0'
const RED = '#f03e3e'
const YELLOW = '#f5a623'
const BLUE = '#3d8ef0'
const T0 = '#edf0f8'
const T2 = '#8892a4'
const T3 = '#545f78'

const PLAT: Record<string,string> = { twitter:'#1d9bf0', youtube:'#ff2020', news:'#8892a4', reddit:'#ff4500', instagram:'#e1306c', facebook:'#1877f2', whatsapp:'#25d366' }

function Section({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: '32px', pageBreakInside: 'avoid' }}>
      <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px', borderBottom:`1px solid ${BORDER}`, paddingBottom:'8px' }}>
        <span style={{ fontFamily:mono, fontSize:'10px', color:ACC, fontWeight:700 }}>{n}</span>
        <span style={{ fontFamily:mono, fontSize:'9px', color:T2, letterSpacing:'2px' }}>{title}</span>
      </div>
      {children}
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:'8px', padding:'14px', ...style }}>
      {children}
    </div>
  )
}

function Bar({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.round((value / Math.max(max, 1)) * 100)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'4px 0', borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
      <span style={{ fontFamily:mono, fontSize:'9px', color:T2, width:'140px', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
      <div style={{ flex:1, height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'2px', overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:'2px' }} />
      </div>
      <span style={{ fontFamily:mono, fontSize:'9px', color:T0, minWidth:'28px', textAlign:'right' }}>{value}</span>
    </div>
  )
}

function NewsItem({ item, i }: { item: any; i: number }) {
  const bc = item.bucket==='red'?RED : item.bucket==='yellow'?YELLOW : GREEN
  return (
    <div style={{ padding:'8px 0', borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
      <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
        <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:bc, flexShrink:0, marginTop:'5px' }} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'11px', color:T0, lineHeight:1.5, marginBottom:'3px' }}>{item.headline}</div>
          <div style={{ display:'flex', gap:'8px' }}>
            <span style={{ fontFamily:mono, fontSize:'8px', color:T3 }}>{item.source}</span>
            <span style={{ fontFamily:mono, fontSize:'8px', color:PLAT[item.platform]||T3 }}>{item.platform?.toUpperCase()}</span>
            {item.url && <a href={item.url} style={{ fontFamily:mono, fontSize:'8px', color:BLUE }}>↗ Link</a>}
          </div>
        </div>
      </div>
    </div>
  )
}

export default function ReportPage() {
  const { data: account } = useAccount()
  const { data: feed = [] } = useFeedItems(account?.id || '')
  const { data: contradictions = [] } = useContradictions(account?.id || '')
  const { data: competitors = [] } = useCompetitors(account)

  const generated = new Date().toLocaleString('en-IN', { timeZone:'Asia/Kolkata', day:'2-digit', month:'long', year:'numeric', hour:'2-digit', minute:'2-digit' })

  const stats = useMemo(() => {
    const total = feed.length, t = Math.max(total, 1)
    const pos   = feed.filter(f=>f.sentiment==='positive').length
    const neg   = feed.filter(f=>f.sentiment==='negative').length
    const crisis= feed.filter(f=>f.bucket==='red').length
    const dev   = feed.filter(f=>f.bucket==='yellow').length
    const platCounts: Record<string,number> = {}
    const sourceCounts: Record<string,number> = {}
    const geoCounts: Record<string,number> = {}
    const topicCounts: Record<string,number> = {}
    feed.forEach(f => {
      platCounts[f.platform]  = (platCounts[f.platform]  || 0) + 1
      if (f.source) sourceCounts[f.source] = (sourceCounts[f.source] || 0) + 1
      ;(f.geo_tags   || []).forEach((g: string) => geoCounts[g]   = (geoCounts[g]   || 0) + 1)
      ;(f.topic_tags || []).forEach((t: string) => topicCounts[t] = (topicCounts[t] || 0) + 1)
    })
    const sortedSources = Object.entries(sourceCounts).sort(([,a],[,b])=>b-a).slice(0,8)
    const sortedGeo     = Object.entries(geoCounts).sort(([,a],[,b])=>b-a).slice(0,8)
    const sortedTopics  = Object.entries(topicCounts).sort(([,a],[,b])=>b-a).slice(0,8)
    const sortedPlats   = Object.entries(platCounts).sort(([,a],[,b])=>b-a)
    return {
      total, pos, neg, neu: total-pos-neg, crisis, dev, bg: total-crisis-dev,
      posPct: Math.round(pos/t*100), negPct: Math.round(neg/t*100), neuPct: Math.round((total-pos-neg)/t*100),
      sortedSources, sortedGeo, sortedTopics, sortedPlats,
      crisisItems:  feed.filter(f=>f.bucket==='red').slice(0,6),
      devItems:     feed.filter(f=>f.bucket==='yellow').slice(0,6),
      posItems:     feed.filter(f=>f.sentiment==='positive').slice(0,5),
      negItems:     feed.filter(f=>f.sentiment==='negative').slice(0,5),
    }
  }, [feed])

  return (
    <div style={{ background:DARK, color:T0, minHeight:'100vh', fontFamily:'system-ui, sans-serif' }}>

      {/* Print button */}
      <div className="no-print" style={{ position:'fixed', top:'16px', right:'16px', zIndex:1000, display:'flex', gap:'8px' }}>
        <button onClick={() => window.print()} style={{ padding:'10px 20px', background:ACC, color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontFamily:mono, fontSize:'11px', fontWeight:700, boxShadow:`0 4px 16px rgba(249,115,22,0.4)` }}>
          ⬇ SAVE AS PDF
        </button>
        <button onClick={() => window.close()} style={{ padding:'10px 14px', background:'transparent', color:T2, border:`1px solid ${BORDER}`, borderRadius:'8px', cursor:'pointer', fontFamily:mono, fontSize:'11px' }}>
          ✕ CLOSE
        </button>
      </div>

      <div style={{ maxWidth:'960px', margin:'0 auto', padding:'48px 36px' }}>

        {/* Cover */}
        <div style={{ marginBottom:'40px', paddingBottom:'28px', borderBottom:`2px solid ${ACC}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'24px' }}>
            <div>
              <div style={{ fontFamily:mono, fontSize:'10px', color:ACC, letterSpacing:'3px', marginBottom:'8px' }}>BHARATMONITOR · POLITICAL INTELLIGENCE REPORT</div>
              <div style={{ fontSize:'26px', fontWeight:700, color:T0, marginBottom:'5px' }}>{account?.politician_name || 'Account'}</div>
              <div style={{ fontSize:'12px', color:T2 }}>{[account?.party, account?.designation, account?.constituency, account?.state].filter(Boolean).join(' · ')}</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:mono, fontSize:'9px', color:T3, marginBottom:'4px' }}>GENERATED</div>
              <div style={{ fontFamily:mono, fontSize:'11px', color:T2 }}>{generated} IST</div>
              <div style={{ fontFamily:mono, fontSize:'9px', color:T3, marginTop:'4px' }}>CONFIDENTIAL</div>
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'10px' }}>
            {[
              { l:'TOTAL', v:stats.total, c:T0 },
              { l:'CRISIS', v:stats.crisis, c:RED },
              { l:'DEVELOPING', v:stats.dev, c:YELLOW },
              { l:'POSITIVE', v:`${stats.posPct}%`, c:GREEN },
              { l:'NEGATIVE', v:`${stats.negPct}%`, c:RED },
              { l:'CONTRADICTIONS', v:contradictions.length, c:YELLOW },
            ].map(k => (
              <div key={k.l} style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:'8px', padding:'10px 12px', textAlign:'center' }}>
                <div style={{ fontFamily:mono, fontSize:'7px', color:T3, letterSpacing:'1px', marginBottom:'4px' }}>{k.l}</div>
                <div style={{ fontFamily:mono, fontSize:'20px', fontWeight:700, color:k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* 01 Executive Summary */}
        <Section n="01" title="EXECUTIVE SUMMARY">
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'14px' }}>
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'8px' }}>SITUATION</div>
              <div style={{ fontSize:'12px', color:T2, lineHeight:1.7 }}>
                {stats.total} items monitored across {stats.sortedPlats.length} platforms.
                {stats.crisis > 0 ? ` ⚡ ${stats.crisis} crisis signal${stats.crisis>1?'s':''} active.` : ' No active crisis signals.'}
                {stats.posPct > 50 ? ' Sentiment broadly positive.' : stats.negPct > 30 ? ' Elevated negative sentiment.' : ' Sentiment neutral.'}
              </div>
            </Card>
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'8px' }}>AI ANALYSIS</div>
              <div style={{ fontSize:'12px', color:T2, lineHeight:1.7 }}>
                {stats.dev > 0 ? `${stats.dev} developing stories need monitoring.` : 'No significant developing stories.'}
                {competitors.length > 0 ? ` ${competitors.length} competitors tracked.` : ''}
                {contradictions.length > 0 ? ` ${contradictions.length} AI contradiction${contradictions.length>1?'s':''} flagged.` : ' No contradictions detected.'}
              </div>
            </Card>
          </div>
          {/* Sentiment visual */}
          <Card>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:'12px' }}>
              {[{l:'POSITIVE',v:stats.posPct,c:GREEN},{l:'NEGATIVE',v:stats.negPct,c:RED},{l:'NEUTRAL',v:stats.neuPct,c:T3}].map(s=>(
                <div key={s.l}>
                  <div style={{ display:'flex', justifyContent:'space-between', marginBottom:'4px' }}>
                    <span style={{ fontFamily:mono, fontSize:'8px', color:s.c }}>{s.l}</span>
                    <span style={{ fontFamily:mono, fontSize:'10px', fontWeight:700, color:s.c }}>{s.v}%</span>
                  </div>
                  <div style={{ height:'5px', background:'rgba(255,255,255,0.06)', borderRadius:'3px', overflow:'hidden' }}>
                    <div style={{ width:`${s.v}%`, height:'100%', background:s.c, borderRadius:'3px' }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </Section>

        {/* 02 Crisis */}
        {stats.crisisItems.length > 0 && (
          <Section n="02" title="CRISIS SIGNALS">
            <Card style={{ borderLeft:`3px solid ${RED}` }}>
              {stats.crisisItems.map((item, i) => <NewsItem key={item.id} item={item} i={i} />)}
            </Card>
          </Section>
        )}

        {/* 03 Developing */}
        {stats.devItems.length > 0 && (
          <Section n="03" title="DEVELOPING STORIES">
            <Card style={{ borderLeft:`3px solid ${YELLOW}` }}>
              {stats.devItems.map((item, i) => <NewsItem key={item.id} item={item} i={i} />)}
            </Card>
          </Section>
        )}

        {/* 04 Platform breakdown */}
        <Section n="04" title="PLATFORM COVERAGE">
          <Card>
            {stats.sortedPlats.map(([p, n]) => (
              <Bar key={p} label={p.toUpperCase()} value={n} max={stats.sortedPlats[0]?.[1] || 1} color={PLAT[p] || T2} />
            ))}
          </Card>
        </Section>

        {/* 05 Sources */}
        <Section n="05" title="TOP SOURCES">
          <Card>
            {stats.sortedSources.map(([s, n]) => (
              <Bar key={s} label={s} value={n} max={stats.sortedSources[0]?.[1] || 1} color={ACC} />
            ))}
          </Card>
        </Section>

        {/* 06 Geography */}
        {stats.sortedGeo.length > 0 && (
          <Section n="06" title="GEOGRAPHIC SIGNALS">
            <Card>
              {stats.sortedGeo.map(([g, n]) => (
                <Bar key={g} label={g} value={n} max={stats.sortedGeo[0]?.[1] || 1} color={BLUE} />
              ))}
            </Card>
          </Section>
        )}

        {/* 07 Topics */}
        {stats.sortedTopics.length > 0 && (
          <Section n="07" title="TOP TOPICS">
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
              {stats.sortedTopics.map(([t, n]) => (
                <Card key={t} style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:mono, fontSize:'16px', fontWeight:700, color:ACC }}>{n}</div>
                  <div style={{ fontFamily:mono, fontSize:'9px', color:T2, marginTop:'3px' }}>{t}</div>
                </Card>
              ))}
            </div>
          </Section>
        )}

        {/* 08 Positive */}
        {stats.posItems.length > 0 && (
          <Section n="08" title="POSITIVE COVERAGE">
            <Card style={{ borderLeft:`3px solid ${GREEN}` }}>
              {stats.posItems.map((item, i) => <NewsItem key={item.id} item={item} i={i} />)}
            </Card>
          </Section>
        )}

        {/* 09 Negative */}
        {stats.negItems.length > 0 && (
          <Section n="09" title="NEGATIVE COVERAGE — MONITOR">
            <Card style={{ borderLeft:`3px solid ${RED}` }}>
              {stats.negItems.map((item, i) => <NewsItem key={item.id} item={item} i={i} />)}
            </Card>
          </Section>
        )}

        {/* 10 Contradictions */}
        {contradictions.length > 0 && (
          <Section n="10" title="AI QUOTE INTELLIGENCE">
            {(contradictions as any[]).slice(0, 6).map((c: any) => (
              <Card key={c.id} style={{ marginBottom:'10px', borderLeft:`3px solid ${YELLOW}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                  <span style={{ fontFamily:mono, fontSize:'9px', color:YELLOW, fontWeight:700 }}>
                    {(c.contradiction_type||'').toUpperCase().replace('_',' ')} · {c.contradiction_score}%
                  </span>
                  <span style={{ fontFamily:mono, fontSize:'9px', color:T3, marginLeft:'auto' }}>{c.politician_name}</span>
                </div>
                <div style={{ fontSize:'11px', color:T2, marginBottom:'6px', fontStyle:'italic' }}>
                  "{(c.current_quote||'').substring(0,120)}…"
                </div>
                <div style={{ padding:'6px 10px', background:'rgba(245,166,35,0.06)', borderRadius:'5px', border:`1px solid rgba(245,166,35,0.15)` }}>
                  <div style={{ fontFamily:mono, fontSize:'8px', color:T3, marginBottom:'3px' }}>
                    {(c.historical_date||'').substring(0,7)} · {c.historical_source}
                  </div>
                  <div style={{ fontSize:'10px', color:T2 }}>"{(c.historical_quote||'').substring(0,120)}…"</div>
                </div>
                {c.reasoning && <div style={{ fontFamily:mono, fontSize:'8px', color:T3, marginTop:'5px' }}>AI: {c.reasoning}</div>}
              </Card>
            ))}
          </Section>
        )}

        {/* 11 Competitors */}
        {competitors.length > 0 && (
          <Section n="11" title="COMPETITOR INTELLIGENCE">
            {(competitors as any[]).map(c => {
              const cf = feed.filter(f => f.headline.toLowerCase().includes(c.politician.name.split(' ').slice(-1)[0].toLowerCase()))
              const pos = cf.filter(f=>f.sentiment==='positive').length
              const neg = cf.filter(f=>f.sentiment==='negative').length
              const score = Math.round(50 + ((pos-neg)/Math.max(cf.length,1))*50)
              return (
                <Card key={c.politician.id} style={{ marginBottom:'10px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'8px' }}>
                    <div style={{ width:'28px', height:'28px', borderRadius:'50%', background:`${ACC}15`, border:`1px solid ${ACC}30`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:mono, fontSize:'9px', color:ACC, fontWeight:700, flexShrink:0 }}>
                      {c.politician.initials || c.politician.name.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'12px', fontWeight:600, color:T0 }}>{c.politician.name}</div>
                      <div style={{ fontFamily:mono, fontSize:'9px', color:T3 }}>{c.politician.party} · {c.politician.role}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:mono, fontSize:'16px', fontWeight:700, color:score>=55?GREEN:score<=45?RED:YELLOW }}>{score}%</div>
                      <div style={{ fontFamily:mono, fontSize:'8px', color:T3 }}>{cf.length} mentions</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px' }}>
                    {[{l:'TOTAL',v:cf.length,c:T0},{l:'POSITIVE',v:pos,c:GREEN},{l:'NEGATIVE',v:neg,c:RED},{l:'CRISIS',v:cf.filter(f=>f.bucket==='red').length,c:RED}].map(k=>(
                      <div key={k.l} style={{ textAlign:'center', padding:'5px', background:'rgba(255,255,255,0.03)', borderRadius:'5px' }}>
                        <div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginBottom:'2px' }}>{k.l}</div>
                        <div style={{ fontFamily:mono, fontSize:'13px', fontWeight:700, color:k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                </Card>
              )
            })}
          </Section>
        )}

        {/* Footer */}
        <div style={{ borderTop:`1px solid ${BORDER}`, paddingTop:'20px', display:'flex', justifyContent:'space-between' }}>
          <div style={{ fontFamily:mono, fontSize:'8px', color:T3 }}>BHARATMONITOR v2.0 · POLITICAL INTELLIGENCE PLATFORM · CONFIDENTIAL</div>
          <div style={{ fontFamily:mono, fontSize:'8px', color:T3 }}>Generated {generated} IST · Data covers last 7 days</div>
        </div>
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body { background: #0d1018 !important; }
          @page { margin: 12mm; size: A4; background: #0d1018; }
        }
      `}</style>
    </div>
  )
}
