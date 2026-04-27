import { useMemo, useState } from 'react'
import { useAccount, useFeedItems, useCompetitors } from '@/hooks/useData'
import NavBar from '@/components/layout/NavBar'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, PieChart, Pie, Cell, CartesianGrid } from 'recharts'
import type { FeedItem } from '@/types'

const mono = 'IBM Plex Mono, monospace'
const PLAT_COLORS: Record<string, string> = {
  twitter:'#1d9bf0', instagram:'#e1306c', facebook:'#1877f2',
  whatsapp:'#25d366', youtube:'#ff2020', news:'#8892a4', reddit:'#ff4500',
}

function Card({ title, badge, children, style }: { title: string; badge?: string; children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{ background:'var(--s1)', border:'1px solid var(--b2)', borderRadius:'12px', padding:'18px', ...style }}>
      <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'14px' }}>
        <span style={{ fontFamily:mono, fontSize:'9px', color:'var(--t2)', letterSpacing:'1px', flex:1 }}>{title}</span>
        {badge && <span style={{ fontFamily:mono, fontSize:'8px', color:'var(--t3)', padding:'2px 6px', background:'var(--s3)', borderRadius:'4px' }}>{badge}</span>}
      </div>
      {children}
    </div>
  )
}

function PostCard({ item, rank }: { item: FeedItem; rank: number }) {
  const bc = item.bucket==='red'?'#f03e3e':item.bucket==='yellow'?'#f5a623':item.bucket==='blue'?'#3d8ef0':'#8892a4'
  const sc = item.sentiment==='positive'?'#22d3a0':item.sentiment==='negative'?'#f03e3e':'#8892a4'
  return (
    <div style={{ display:'flex', gap:'10px', padding:'10px 8px', borderBottom:'1px solid var(--b0)', transition:'background .12s' }}
      onMouseEnter={e=>{e.currentTarget.style.background='var(--s2)'}}
      onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
      <span style={{ fontFamily:mono, fontSize:'9px', color:'var(--t3)', width:'18px', flexShrink:0, paddingTop:'2px' }}>{rank}</span>
      <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:bc, flexShrink:0, marginTop:'5px' }} />
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:'11px', color:'var(--t0)', lineHeight:1.5, marginBottom:'3px' }}>{item.headline}</div>
        <div style={{ display:'flex', gap:'7px', flexWrap:'wrap', alignItems:'center' }}>
          <span style={{ fontFamily:mono, fontSize:'8px', color:'var(--t3)' }}>{item.source}</span>
          <span style={{ fontFamily:mono, fontSize:'7px', color:PLAT_COLORS[item.platform]||'#8892a4' }}>{item.platform.toUpperCase()}</span>
          <span style={{ fontFamily:mono, fontSize:'7px', color:sc, background:sc+'12', padding:'1px 5px', borderRadius:'3px' }}>{item.sentiment.toUpperCase()}</span>
          {(item.geo_tags||[]).slice(0,2).map(g=><span key={g} style={{ fontFamily:mono, fontSize:'7px', color:'#7c6dfa' }}>📍{g}</span>)}
        </div>
      </div>
      {item.engagement ? <span style={{ fontFamily:mono, fontSize:'9px', color:'var(--t3)', flexShrink:0 }}>{item.engagement>999?`${(item.engagement/1000).toFixed(1)}K`:item.engagement}</span> : null}
      {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily:mono, fontSize:'10px', color:'var(--t3)', textDecoration:'none', flexShrink:0 }} onMouseEnter={e=>{e.currentTarget.style.color='var(--acc)'}} onMouseLeave={e=>{e.currentTarget.style.color='var(--t3)'}}>↗</a>}
    </div>
  )
}

// Persona definitions
const PERSONA_DEFS = [
  { id:'rural',      label:'Rural Voters',       icon:'🌾', color:'#22d3a0', desc:'Agricultural communities, village-level support', keywords:['village','rural','farmer','kisan','gram','panchayat','mgnrega','pm kisan','agri','irrigation','crop','msp'] },
  { id:'urban',      label:'Urban Middle Class',  icon:'🏙️', color:'#3d8ef0', desc:'Urban professionals, aspirational voters',      keywords:['city','urban','metro','inflation','income','jobs','startup','it sector','middle class','gst','housing','emi'] },
  { id:'youth',      label:'Youth (18-35)',        icon:'⚡', color:'#7c6dfa', desc:'First-time voters, students, job-seekers',       keywords:['youth','student','unemployment','jobs','education','college','university','neet','exam','skill','internship'] },
  { id:'women',      label:'Women Voters',         icon:'👩', color:'#e1306c', desc:'Women-focused issues, safety, welfare schemes',  keywords:['women','woman','mahila','reservation','safety','beti','girl','female','gender','swachh','health','maternity'] },
  { id:'ideological',label:'Ideological Core',    icon:'🇮🇳', color:'#f5a623', desc:'Core base, high-loyalty supporters',             keywords:['temple','mandir','ram','ayodhya','hindutva','nationalism','bharat','hindu','religion','patriot','deshhit'] },
  { id:'business',   label:'Business Community',  icon:'💼', color:'#f97316', desc:'Traders, industrialists, business owners',       keywords:['business','industry','msme','gst','trade','export','investment','entrepreneur','manufacturing','startup'] },
  { id:'minority',   label:'Minority Outreach',   icon:'🤝', color:'#9c59d1', desc:'Minority communities, inclusive governance',     keywords:['minority','muslim','christian','sikh','buddhist','dalit','obc','tribal','adivasi','sc','st','reservation'] },
  { id:'senior',     label:'Senior Citizens',      icon:'👴', color:'#60a5fa', desc:'Pension, healthcare, welfare beneficiaries',     keywords:['pension','elderly','senior','senior citizen','ayushman','health','hospital','old age','ayushman bharat'] },
]

export default function AudiencePage() {
  const { data: account } = useAccount()
  const { data: feed = [] } = useFeedItems(account?.id || '')
  const { data: competitors = [] } = useCompetitors(account)
  const [selectedPersona, setSelectedPersona] = useState<string|null>(null)
  const [activeTab, setActiveTab] = useState<'overview'|'personas'|'posts'|'geography'|'competition'>('overview')
  const [postFilter, setPostFilter] = useState<'all'|'positive'|'negative'|'neutral'>('all')

  // Personas
  const personas = useMemo(() =>
    PERSONA_DEFS.map(p => {
      const matched = feed.filter(f => {
        const text = `${f.headline} ${f.body||''} ${(f.topic_tags||[]).join(' ')} ${(f.geo_tags||[]).join(' ')}`.toLowerCase()
        return p.keywords.some(k => text.includes(k))
      })
      const pos = matched.filter(f=>f.sentiment==='positive').length
      const neg = matched.filter(f=>f.sentiment==='negative').length
      const total = Math.max(matched.length,1)
      return { ...p, count:matched.length, positive:pos, negative:neg, neutral:matched.length-pos-neg, score:Math.round(50+((pos-neg)/total)*50), items:matched.slice(0,6) }
    }).sort((a,b)=>b.count-a.count)
  , [feed])

  // Top posts by sentiment
  const topPosts = useMemo(() => {
    const filtered = postFilter==='all' ? feed : feed.filter(f=>f.sentiment===postFilter)
    return [...filtered].sort((a,b)=>{
      const priority = (f: FeedItem) => (f.bucket==='red'?300:f.bucket==='yellow'?200:f.bucket==='blue'?100:0) + (f.engagement||0) + (f.views||0)/10
      return priority(b) - priority(a)
    }).slice(0,30)
  }, [feed, postFilter])

  // Geography
  const geoData = useMemo(() => {
    const c: Record<string,{count:number;pos:number;neg:number}> = {}
    feed.forEach(f => (f.geo_tags||[]).forEach(g => {
      if (!c[g]) c[g]={count:0,pos:0,neg:0}
      c[g].count++
      if (f.sentiment==='positive') c[g].pos++
      if (f.sentiment==='negative') c[g].neg++
    }))
    return Object.entries(c).map(([geo,s])=>({geo,...s,score:Math.round(50+((s.pos-s.neg)/Math.max(s.count,1))*50)})).sort((a,b)=>b.count-a.count).slice(0,15)
  }, [feed])

  // Platform stats
  const platformStats = useMemo(() => {
    const s: Record<string,{count:number;pos:number;neg:number;engagement:number}> = {}
    feed.forEach(f => {
      if (!s[f.platform]) s[f.platform]={count:0,pos:0,neg:0,engagement:0}
      s[f.platform].count++
      s[f.platform].engagement+=(f.engagement||0)
      if (f.sentiment==='positive') s[f.platform].pos++
      if (f.sentiment==='negative') s[f.platform].neg++
    })
    return Object.entries(s).map(([p,v])=>({platform:p,...v})).sort((a,b)=>b.count-a.count)
  }, [feed])

  // Topic data
  const topicData = useMemo(() => {
    const c: Record<string,{count:number;pos:number;neg:number}> = {}
    feed.forEach(f=>(f.topic_tags||[]).forEach(t=>{
      if (!c[t]) c[t]={count:0,pos:0,neg:0}
      c[t].count++
      if(f.sentiment==='positive') c[t].pos++
      if(f.sentiment==='negative') c[t].neg++
    }))
    return Object.entries(c).map(([t,v])=>({topic:t,...v,score:Math.round(50+((v.pos-v.neg)/Math.max(v.count,1))*50)})).sort((a,b)=>b.count-a.count).slice(0,12)
  }, [feed])

  const totalEng = useMemo(()=>feed.reduce((s,f)=>s+(f.engagement||0),0),[feed])
  const totalViews = useMemo(()=>feed.reduce((s,f)=>s+(f.views||0),0),[feed])
  const selectedPersonaData = personas.find(p=>p.id===selectedPersona)

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <NavBar />
      <div style={{ maxWidth:'1260px', margin:'0 auto', padding:'24px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom:'20px' }}>
          <div style={{ fontFamily:mono, fontSize:'8px', color:'var(--t3)', letterSpacing:'2px', marginBottom:'6px' }}>AUDIENCE INTELLIGENCE</div>
          <div style={{ fontSize:'20px', fontWeight:600, color:'#edf0f8' }}>{account?.politician_name||'Account'} — Audience & Reach Analysis</div>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(6,1fr)', gap:'10px', marginBottom:'20px' }}>
          {[
            { l:'COVERAGE',   v:feed.length,                                             c:'var(--t0)' },
            { l:'POSITIVE',   v:feed.filter(f=>f.sentiment==='positive').length,          c:'#22d3a0'   },
            { l:'NEGATIVE',   v:feed.filter(f=>f.sentiment==='negative').length,          c:'#f03e3e'   },
            { l:'ENGAGEMENT', v:totalEng>0?`${(totalEng/1000).toFixed(1)}K`:'—',          c:'#7c6dfa'   },
            { l:'PLATFORMS',  v:platformStats.length,                                     c:'#f5a623'   },
            { l:'GEO SIGNALS',v:geoData.length,                                           c:'#3d8ef0'   },
          ].map(k=>(
            <div key={k.l} style={{ background:'var(--s1)', border:'1px solid var(--b2)', borderRadius:'10px', padding:'10px 12px' }}>
              <div style={{ fontFamily:mono, fontSize:'7px', color:'var(--t3)', letterSpacing:'1px', marginBottom:'5px' }}>{k.l}</div>
              <div style={{ fontFamily:mono, fontSize:'20px', fontWeight:700, color:k.c, lineHeight:1 }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'4px', marginBottom:'16px', borderBottom:'1px solid var(--b1)' }}>
          {[['overview','OVERVIEW'],['personas','PERSONAS'],['posts','TOP POSTS'],['geography','GEOGRAPHY'],['competition','COMPETITION']].map(([id,label])=>(
            <button key={id} onClick={()=>setActiveTab(id as any)} style={{ fontFamily:mono, fontSize:'9px', letterSpacing:'0.5px', padding:'8px 14px', border:'none', background:'transparent', cursor:'pointer', color:activeTab===id?'var(--acc)':'var(--t2)', borderBottom:`2px solid ${activeTab===id?'var(--acc)':'transparent'}`, marginBottom:'-1px', transition:'all .15s' }}>{label}</button>
          ))}
        </div>

        {/* OVERVIEW */}
        {activeTab==='overview' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            <Card title="PLATFORM PERFORMANCE">
              {platformStats.map(p=>{
                const max=platformStats[0]?.count||1
                const c=PLAT_COLORS[p.platform]||'#8892a4'
                const sentScore=Math.round(p.pos/Math.max(p.count,1)*100)
                return (
                  <div key={p.platform} style={{ marginBottom:'10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'3px' }}>
                      <span style={{ fontFamily:mono, fontSize:'9px', color:c, width:'72px', flexShrink:0 }}>{p.platform.toUpperCase()}</span>
                      <div style={{ flex:1, height:'5px', background:'var(--s3)', borderRadius:'3px', overflow:'hidden' }}>
                        <div style={{ width:`${(p.count/max)*100}%`, height:'100%', background:c, borderRadius:'3px' }} />
                      </div>
                      <span style={{ fontFamily:mono, fontSize:'9px', color:'var(--t1)', minWidth:'28px', textAlign:'right' }}>{p.count}</span>
                    </div>
                    <div style={{ display:'flex', gap:'8px', marginLeft:'80px' }}>
                      <span style={{ fontFamily:mono, fontSize:'7px', color:'#22d3a0' }}>+{p.pos}</span>
                      <span style={{ fontFamily:mono, fontSize:'7px', color:'#f03e3e' }}>-{p.neg}</span>
                      <span style={{ fontFamily:mono, fontSize:'7px', color:'var(--t3)' }}>{sentScore}% pos</span>
                      {p.engagement>0&&<span style={{ fontFamily:mono, fontSize:'7px', color:c }}>{(p.engagement/1000).toFixed(1)}K eng</span>}
                    </div>
                  </div>
                )
              })}
            </Card>

            <Card title="TOP TOPICS IN COVERAGE">
              {topicData.length>0?(
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {topicData.map(t=>{
                    const max=topicData[0]?.count||1
                    const c=t.score>=60?'#22d3a0':t.score<=40?'#f03e3e':'#f5a623'
                    return (
                      <div key={t.topic} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontFamily:mono, fontSize:'9px', color:'var(--t1)', width:'90px', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.topic}</span>
                        <div style={{ flex:1, height:'4px', background:'var(--s3)', borderRadius:'2px', overflow:'hidden' }}>
                          <div style={{ width:`${(t.count/max)*100}%`, height:'100%', background:c, borderRadius:'2px' }} />
                        </div>
                        <span style={{ fontFamily:mono, fontSize:'9px', color:'var(--t2)', minWidth:'24px', textAlign:'right' }}>{t.count}</span>
                        <span style={{ fontFamily:mono, fontSize:'8px', color:c, minWidth:'32px', textAlign:'right' }}>{t.score}%</span>
                      </div>
                    )
                  })}
                </div>
              ):<div style={{ fontFamily:mono, fontSize:'9px', color:'var(--t3)', textAlign:'center', padding:'24px' }}>No topic data yet</div>}
            </Card>

            <Card title="SENTIMENT PIE" style={{ display:'flex', flexDirection:'column' }}>
              {feed.length>0?(()=>{
                const pos=feed.filter(f=>f.sentiment==='positive').length
                const neg=feed.filter(f=>f.sentiment==='negative').length
                const neu=feed.filter(f=>f.sentiment==='neutral').length
                const data=[{name:'Positive',value:pos,color:'#22d3a0'},{name:'Negative',value:neg,color:'#f03e3e'},{name:'Neutral',value:neu,color:'#4a5568'}]
                return (
                  <div style={{ display:'flex', alignItems:'center', gap:'16px' }}>
                    <ResponsiveContainer width={160} height={160}>
                      <PieChart>
                        <Pie data={data} cx="50%" cy="50%" innerRadius={45} outerRadius={70} dataKey="value" strokeWidth={0}>
                          {data.map((d,i)=><Cell key={i} fill={d.color} fillOpacity={0.85}/>)}
                        </Pie>
                        <Tooltip contentStyle={{ background:'#121620', border:'1px solid rgba(255,255,255,0.13)', borderRadius:'6px', fontSize:'10px', fontFamily:mono }} />
                      </PieChart>
                    </ResponsiveContainer>
                    <div style={{ display:'flex', flexDirection:'column', gap:'10px' }}>
                      {data.map(d=>(
                        <div key={d.name}>
                          <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'2px' }}>
                            <div style={{ width:'8px', height:'8px', borderRadius:'50%', background:d.color, flexShrink:0 }} />
                            <span style={{ fontFamily:mono, fontSize:'9px', color:'var(--t1)' }}>{d.name}</span>
                          </div>
                          <div style={{ fontFamily:mono, fontSize:'16px', fontWeight:700, color:d.color, marginLeft:'14px' }}>{d.value}</div>
                          <div style={{ fontFamily:mono, fontSize:'8px', color:'var(--t3)', marginLeft:'14px' }}>{Math.round(d.value/feed.length*100)}%</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )
              })():<div style={{ fontFamily:mono, fontSize:'9px', color:'var(--t3)', textAlign:'center', padding:'24px' }}>No data yet</div>}
            </Card>

            <Card title="GEO SIGNAL STRENGTH">
              {geoData.length>0?(
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {geoData.slice(0,8).map(g=>{
                    const max=geoData[0]?.count||1
                    const c=g.score>=60?'#22d3a0':g.score<=40?'#f03e3e':'#f5a623'
                    return (
                      <div key={g.geo} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontFamily:mono, fontSize:'9px', color:'var(--t1)', width:'80px', flexShrink:0 }}>{g.geo}</span>
                        <div style={{ flex:1, height:'4px', background:'var(--s3)', borderRadius:'2px', overflow:'hidden' }}>
                          <div style={{ width:`${(g.count/max)*100}%`, height:'100%', background:c, borderRadius:'2px' }} />
                        </div>
                        <span style={{ fontFamily:mono, fontSize:'9px', color:'var(--t2)', minWidth:'24px', textAlign:'right' }}>{g.count}</span>
                        <span style={{ fontFamily:mono, fontSize:'8px', color:c, minWidth:'32px', textAlign:'right' }}>{g.score}%</span>
                      </div>
                    )
                  })}
                </div>
              ):<div style={{ fontFamily:mono, fontSize:'9px', color:'var(--t3)', textAlign:'center', padding:'24px' }}>No geo data detected in feed</div>}
            </Card>
          </div>
        )}

        {/* PERSONAS */}
        {activeTab==='personas' && (
          <div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'16px' }}>
              {personas.map(p=>(
                <div key={p.id} onClick={()=>setSelectedPersona(selectedPersona===p.id?null:p.id)}
                  style={{ background:selectedPersona===p.id?'var(--s2)':'var(--s1)', border:`1px solid ${selectedPersona===p.id?p.color+'60':'var(--b2)'}`, borderRadius:'10px', padding:'14px', cursor:'pointer', transition:'all .15s' }}
                  onMouseEnter={e=>{e.currentTarget.style.borderColor=p.color+'40'}}
                  onMouseLeave={e=>{e.currentTarget.style.borderColor=selectedPersona===p.id?p.color+'60':'var(--b2)'}}>
                  <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                    <span style={{ fontSize:'16px' }}>{p.icon}</span>
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:'11px', fontWeight:600, color:'var(--t0)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{p.label}</div>
                      <div style={{ fontFamily:mono, fontSize:'8px', color:'var(--t3)' }}>{p.count} mentions</div>
                    </div>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:p.color+'15', border:`2px solid ${p.color}40`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:mono, fontSize:'10px', fontWeight:700, color:p.color, flexShrink:0 }}>{p.score}</div>
                  </div>
                  <div style={{ fontSize:'9px', color:'var(--t2)', lineHeight:1.5, marginBottom:'8px' }}>{p.desc}</div>
                  <div style={{ display:'flex', gap:'6px', marginBottom:'6px' }}>
                    <span style={{ fontFamily:mono, fontSize:'7px', color:'#22d3a0' }}>+{p.positive}</span>
                    <span style={{ fontFamily:mono, fontSize:'7px', color:'#f03e3e' }}>-{p.negative}</span>
                    <span style={{ fontFamily:mono, fontSize:'7px', color:'var(--t3)' }}>~{p.neutral} neu</span>
                  </div>
                  <div style={{ height:'3px', background:'var(--s3)', borderRadius:'2px', overflow:'hidden' }}>
                    <div style={{ width:`${Math.min((p.count/Math.max(personas[0]?.count||1,1))*100,100)}%`, height:'100%', background:p.color, borderRadius:'2px' }} />
                  </div>
                </div>
              ))}
            </div>

            {selectedPersonaData && (
              <Card title={`${selectedPersonaData.icon} ${selectedPersonaData.label.toUpperCase()} — TOP CONVERSATIONS`} badge={`${selectedPersonaData.count} ITEMS · SENTIMENT ${selectedPersonaData.score}%`}>
                {selectedPersonaData.items.length>0?(
                  <div>
                    {selectedPersonaData.items.map((item,i)=><PostCard key={item.id} item={item} rank={i+1} />)}
                  </div>
                ):<div style={{ fontFamily:mono, fontSize:'9px', color:'var(--t3)', padding:'16px', textAlign:'center' }}>No conversations for this segment yet</div>}
              </Card>
            )}
          </div>
        )}

        {/* TOP POSTS */}
        {activeTab==='posts' && (
          <div>
            <div style={{ display:'flex', gap:'6px', marginBottom:'12px' }}>
              {[['all','ALL'],['positive','POSITIVE'],['negative','NEGATIVE'],['neutral','NEUTRAL']].map(([id,label])=>(
                <button key={id} onClick={()=>setPostFilter(id as any)} style={{ fontFamily:mono, fontSize:'8px', padding:'5px 12px', border:`1px solid ${postFilter===id?'var(--acc)':'var(--b1)'}`, borderRadius:'20px', background:postFilter===id?'rgba(249,115,22,0.1)':'transparent', color:postFilter===id?'var(--acc)':'var(--t2)', cursor:'pointer', transition:'all .15s' }}>{label} ({id==='all'?feed.length:feed.filter(f=>f.sentiment===id).length})</button>
              ))}
            </div>
            <Card title={`TOP POSTS — ${postFilter.toUpperCase()}`} badge={`${topPosts.length} items`}>
              {topPosts.map((item,i)=><PostCard key={item.id} item={item} rank={i+1} />)}
            </Card>
          </div>
        )}

        {/* GEOGRAPHY */}
        {activeTab==='geography' && (
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'16px' }}>
            <Card title="GEO SIGNAL STRENGTH — ALL REGIONS">
              {geoData.length>0?(
                <div style={{ display:'flex', flexDirection:'column', gap:'6px' }}>
                  {geoData.map(g=>{
                    const max=geoData[0]?.count||1
                    const c=g.score>=60?'#22d3a0':g.score<=40?'#f03e3e':'#f5a623'
                    return (
                      <div key={g.geo} style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                        <span style={{ fontFamily:mono, fontSize:'9px', color:'var(--t1)', width:'90px', flexShrink:0 }}>{g.geo}</span>
                        <div style={{ flex:1, height:'5px', background:'var(--s3)', borderRadius:'3px', overflow:'hidden' }}>
                          <div style={{ width:`${(g.count/max)*100}%`, height:'100%', background:c, borderRadius:'3px' }} />
                        </div>
                        <span style={{ fontFamily:mono, fontSize:'9px', color:'var(--t2)', minWidth:'24px', textAlign:'right' }}>{g.count}</span>
                        <span style={{ fontFamily:mono, fontSize:'8px', color:c, minWidth:'36px', textAlign:'right' }}>{g.score}%</span>
                      </div>
                    )
                  })}
                </div>
              ):<div style={{ fontFamily:mono, fontSize:'9px', color:'var(--t3)', textAlign:'center', padding:'24px' }}>No geo data yet. Geo signals are extracted from feed headlines automatically.</div>}
            </Card>

            <Card title="SENTIMENT BY REGION">
              {geoData.length>0?(
                <ResponsiveContainer width="100%" height={280}>
                  <BarChart data={geoData.slice(0,10)} margin={{ left:0, right:10, top:5, bottom:40 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.04)" />
                    <XAxis dataKey="geo" tick={{ fill:'#545f78', fontSize:7, fontFamily:mono }} axisLine={false} tickLine={false} angle={-30} textAnchor="end" interval={0} />
                    <YAxis domain={[0,100]} tick={{ fill:'#545f78', fontSize:7 }} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{ background:'#121620', border:'1px solid rgba(255,255,255,0.13)', borderRadius:'6px', fontSize:'10px', fontFamily:mono }} />
                    <Bar dataKey="score" name="Sentiment Score" radius={[3,3,0,0]}>
                      {geoData.slice(0,10).map((g,i)=>(
                        <Cell key={i} fill={g.score>=60?'#22d3a0':g.score<=40?'#f03e3e':'#f5a623'} fillOpacity={0.85} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              ):<div style={{ fontFamily:mono, fontSize:'9px', color:'var(--t3)', textAlign:'center', padding:'24px' }}>No data yet</div>}
            </Card>
          </div>
        )}

        {/* COMPETITION */}
        {activeTab==='competition' && (
          <div style={{ display:'flex', flexDirection:'column', gap:'12px' }}>
            {competitors.length===0?(
              <div style={{ background:'var(--s1)', border:'1px solid var(--b2)', borderRadius:'12px', padding:'32px', textAlign:'center' }}>
                <div style={{ fontFamily:mono, fontSize:'9px', color:'var(--t3)', lineHeight:2.5 }}>
                  No competitors tracked yet.<br/>
                  Add them under Settings → Tracking → Politicians → mark as competitor.
                </div>
              </div>
            ):competitors.map(c=>{
              const cf=feed.filter(f=>f.headline.toLowerCase().includes(c.politician.name.split(' ').slice(-1)[0].toLowerCase()))
              const pos=cf.filter(f=>f.sentiment==='positive').length
              const neg=cf.filter(f=>f.sentiment==='negative').length
              const score=Math.round(50+((pos-neg)/Math.max(cf.length,1))*50)
              return (
                <Card key={c.politician.id} title={`${c.politician.name} — ${c.politician.party}`} badge={`${cf.length} mentions`}>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'8px', marginBottom:'14px' }}>
                    {[
                      { l:'MENTIONS',  v:cf.length,                               c:'var(--t0)'  },
                      { l:'SENTIMENT', v:`${score}%`,                             c:score>=55?'#22d3a0':score<=45?'#f03e3e':'#f5a623' },
                      { l:'CRISIS',    v:cf.filter(f=>f.bucket==='red').length,   c:'#f03e3e'    },
                      { l:'DEVELOPING',v:cf.filter(f=>f.bucket==='yellow').length,c:'#f5a623'    },
                      { l:'POSITIVE',  v:pos,                                     c:'#22d3a0'    },
                    ].map(k=>(
                      <div key={k.l} style={{ background:'var(--s2)', borderRadius:'6px', padding:'8px 10px', textAlign:'center' }}>
                        <div style={{ fontFamily:mono, fontSize:'7px', color:'var(--t3)', marginBottom:'3px' }}>{k.l}</div>
                        <div style={{ fontFamily:mono, fontSize:'16px', fontWeight:700, color:k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                  <div>
                    {cf.slice(0,5).map((item,i)=><PostCard key={item.id} item={item} rank={i+1} />)}
                  </div>
                </Card>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
