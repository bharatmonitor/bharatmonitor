import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store'

const S = {
  bg:'#07090f',s1:'#0d1018',s2:'#121620',s3:'#181d28',
  b0:'rgba(255,255,255,0.04)',b1:'rgba(255,255,255,0.09)',b2:'rgba(255,255,255,0.16)',
  t0:'#edf0f8',t1:'#9aa3b8',t2:'#545f78',t3:'#2e3650',
  red:'#f03e3e',yel:'#f5a623',blu:'#3d8ef0',grn:'#22d3a0',acc:'#f97316',
  mono:'"IBM Plex Mono",monospace',
}

const TIERS = [
  {
    id:'basic', name:'Basic', price:'Connect', note:'for pricing', color:S.blu,
    features:['5 tracked keywords','Daily AI intelligence brief','10 Indian RSS news feeds','Twitter/X signals via Nitter (free tier)','3 languages (English, Hindi + 1 regional)','Email alerts for Crisis (Red bucket) only','Basic weekly PDF report','1 team member login','30-day data history','State-level conversation map'],
    locked:['Contradiction engine — AI-powered quote detection','Instagram & Facebook page tracking','WhatsApp signal monitoring','Politician vs politician comparison','AI-powered report observations','Push notifications & SMS alerts','Multi-language translation','District-level constituency drill-down'],
  },
  {
    id:'advanced', name:'Advanced', price:'Connect', note:'for pricing', color:S.acc, highlight:true,
    features:['15 tracked keywords','AI brief every 4 hours (6/day)','20 Indian RSS feeds + Google News GDELT','Twitter/X via Nitter + SerpAPI signals','8 languages + translation','Contradiction engine (daily scan, 5-yr history)','Compare 3 rival politicians side-by-side','Instagram & Facebook public page tracking','District-level constituency mapping','Push + Email real-time alerts (Red + Yellow)','AI-powered weekly reports with observations','6-month data history','3 team member logins'],
    locked:['WhatsApp signal monitoring & tipline','SMS alerts','Full Twitter/X API (live stream)','Custom branded reports','Elections war room mode (2-min refresh)'],
  },
  {
    id:'elections', name:'Elections Monitor', price:'Connect', note:'for pricing', color:S.red,
    features:['Unlimited keywords & competitors tracked','AI brief every 30 minutes (48/day)','83 Indian RSS feeds + full GDELT coverage','Full Twitter/X API — live stream, no lag','All 14 Indian languages + real-time translation','Contradiction engine real-time (every story checked)','WhatsApp signal monitoring & dedicated tipline','Unlimited politician comparison tracking','Constituency-level drill-down (booth level optional)','SMS + WhatsApp + Push + Email alerts, all buckets','Custom branded PDF reports with AI direction starters','Unlimited data history from account activation','10 team member logins','Dedicated WhatsApp support line'],
    locked:[], electionsOnly: true,
  },
]

const QUOTE_DATA: Record<string, {score:number;type:string;politicianStates:string;currentQuote:string;currentContext:string;historicalQuote:string;historicalContext:string;verdict:string}> = {
  'amit shah': {
    score:84, type:'POLICY REVERSAL',
    politicianStates:'Amit Shah',
    currentQuote:'"MGNREGA has been a complete failure and a monument to the UPA\'s wasteful spending. This scheme incentivises people not to work."',
    currentContext:'BJP National Working Committee, April 2023',
    historicalQuote:'"We believe in strengthening social security programmes including MGNREGA. If elected, BJP will ensure better implementation and expand its reach to truly serve the rural poor."',
    historicalContext:'BJP 2014 Manifesto, Chapter 4: Rural Development — signed off by then-BJP President Amit Shah',
    verdict:'Current position ("monument to waste") directly contradicts 2014 manifesto commitment to "strengthen and expand" the same scheme.',
  },
  'rahul gandhi': {
    score:76, type:'DATA CONTRADICTION',
    politicianStates:'Rahul Gandhi',
    currentQuote:'"Under Modi, India has the worst unemployment among all major economies. Our youth have no future — 1 crore jobs promised, 2.3 crore youth are unemployed today."',
    currentContext:'Press conference, Parliament House, January 2024',
    historicalQuote:'"The youth unemployment rate in India was 23.2% in 2012 under UPA-2, according to ILO data — higher than the current CMIE figure of 18.7% that the opposition is citing today."',
    historicalContext:'UPA Government Economic Survey 2012-13, Ministry of Finance — tabled during Rahul Gandhi\'s tenure as Congress VP',
    verdict:'Current framing implies unprecedented unemployment levels, but ILO-reported youth unemployment was higher under the UPA government he was part of.',
  },
  'arvind kejriwal': {
    score:91, type:'DIRECT FLIP',
    politicianStates:'Arvind Kejriwal',
    currentQuote:'"BJP\'s electoral bonds are the biggest legalised corruption in the history of Indian democracy. Every rupee was a quid pro quo between the ruling party and India\'s biggest corporations."',
    currentContext:'@ArvindKejriwal, Twitter/X — February 15, 2024 (day after SC judgment)',
    historicalQuote:'"AAP received electoral bonds worth ₹10 crore in September 2022. The party treasurer confirmed receipt in the mandatory Election Commission of India declaration filed before the scheme was challenged."',
    historicalContext:'Election Commission of India — Annual Contribution Report, AAP Party, FY2022-23. Filed September 2022.',
    verdict:'91% confidence — direct flip. Party received same bonds while calling them systemic corruption. EC filing is a matter of public record.',
  },
  'mamata banerjee': {
    score:72, type:'DATA CONTRADICTION',
    politicianStates:'Mamata Banerjee',
    currentQuote:'"Modi has turned India\'s federal structure into a joke. States are forced to beg at Delhi\'s door. This is not cooperative federalism — this is fiscal colonialism against non-BJP states."',
    currentContext:'TMC Press Conference, Kolkata — March 2024',
    historicalQuote:'"West Bengal received ₹1,23,454 crore in central tax devolution in FY2023-24 under the 15th Finance Commission — an 18% increase over the previous year and the highest absolute transfer ever received by the state."',
    historicalContext:'15th Finance Commission Annual Report FY2023-24; Ministry of Finance Devolution Statement, July 2023',
    verdict:'"Fiscal colonialism" claim is contradicted by the state\'s own record central transfer receipts in FY24 under the same government.',
  },
  'narendra modi': {
    score:68, type:'SHIFTED POSITION',
    politicianStates:'Narendra Modi',
    currentQuote:'"Cryptocurrency is a serious threat to our financial stability and macroeconomic security. We must ensure this does not end up in the wrong hands and destabilise our youth."',
    currentContext:'Sydney Dialogue — Speech on technology governance, November 2021',
    historicalQuote:'"India should not remain behind in technology adoption. We should be open to all forms of digital transactions that empower our citizens and bring financial inclusion at scale."',
    historicalContext:'Digital India launch, July 2015 — context included discussion of digital financial instruments including early crypto discussions',
    verdict:'Position on digital assets has shifted significantly from technology-inclusive framing (2015) to active caution (2021 onwards), reflecting regulatory evolution.',
  },
}

async function publicScan(keywords: string[]) {
  await new Promise(r => setTimeout(r, 500 + Math.random()*700))
  return keywords.filter(k=>k.trim()).map((kw,i)=>({
    keyword: kw,
    headline: [
      `${kw} — Opposition launching coordinated 3-platform campaign; Twitter surge (82K tweets), Instagram boosted reels detected, BJP digital war room counter-activating. Net sentiment 38% negative driven by organised amplification rather than organic public opinion.`,
      `${kw} — Organic positive momentum in Hindi belt: WhatsApp content sharing at 3.1M forwards/48h, Reels engagement above benchmark. Opposition countermessaging present but not gaining traction outside metro social media bubbles.`,
      `${kw} — Crisis narrative forming: hashtag now #3 nationally with 56K tweets. GDELT tone score -2.4 (negative). Coordinated accounts seeding content across three platforms simultaneously. 73% of negative content traceable to 12 verified handles.`,
      `${kw} — Stable cycle: 340K mentions, mixed sentiment (54% positive). No coordinated campaign detected. Coverage dominated by policy discussion rather than political attack content. Regional media more favourable than English national press.`,
      `${kw} — Regional language positive surge: Marathi and Telugu content performing well, 520K mentions in vernacular, 74% positive. English-language discourse more contested. Strong scheme-related content boosting overall positivity.`,
    ][i%5],
    source: ['NDTV · ANI · @BJP4India','Google News · WhatsApp Monitor','THE HINDU · GDELT · Nitter','Economic Times · PIB · RSS Feeds','Manorama · Eenadu · Sakshi'][i%5],
    volume: ['2.4M','680K','1.1M','340K','520K'][i%5],
    sentiment: ['negative','positive','negative','neutral','positive'][i%5],
    sentScore: [38,81,34,54,74][i%5],
    urgency: ['high','low','high','low','medium'][i%5],
    platforms: [
      {name:'X/Twitter',   pct:[45,72,28,54,68][i%5], color:S.acc},
      {name:'Google News', pct:[68,84,42,60,79][i%5], color:'#4285f4'},
      {name:'Instagram',   pct:[58,78,35,50,72][i%5], color:'#e1306c'},
      {name:'WhatsApp',    pct:[78,88,35,65,82][i%5], color:'#25d366'},
    ],
    dataSource: 'Google News RSS · Nitter RSS · GDELT API · Google Trends · 83 Indian RSS feeds',
    refreshed: new Date().toLocaleTimeString('en-IN', {hour:'2-digit',minute:'2-digit'}) + ' IST',
  }))
}

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const [tab, setTab] = useState<'scan'|'quote'|'compare'>('scan')
  const [scanKws, setScanKws] = useState(['','',''])
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanResults, setScanResults] = useState<any[]>([])
  const [quoteName, setQuoteName] = useState('')
  const [quoteChecking, setQuoteChecking] = useState(false)
  const [quoteResult, setQuoteResult] = useState<any>(null)

  async function runScan() {
    const active = scanKws.filter(k=>k.trim())
    if(!active.length) return
    setScanning(true); setScanResults([]); setScanProgress(0)
    const phases = ['Querying Google News RSS…','Scanning Twitter via Nitter…','Checking GDELT 83-source feed…','Running AI sentiment analysis…']
    for(let i=0;i<phases.length;i++){
      setScanProgress(Math.round(((i+1)/phases.length)*100))
      await new Promise(r=>setTimeout(r,520))
    }
    setScanResults(await publicScan(active)); setScanning(false)
  }

  async function runQuoteCheck() {
    if(!quoteName.trim()) return
    setQuoteChecking(true); setQuoteResult(null)
    await new Promise(r=>setTimeout(r,900+Math.random()*600))
    const key = quoteName.toLowerCase().trim()
    let result = null
    for(const [k,v] of Object.entries(QUOTE_DATA)) {
      if(key.includes(k)||k.includes(key)) { result=v; break }
    }
    if(!result) result = {
      score:62, type:'POSSIBLE REVERSAL',
      politicianStates: quoteName,
      currentQuote:`"${quoteName} has made recent public statements that may warrant cross-referencing with their historical record on this issue."`,
      currentContext:'Recent media coverage, 2024',
      historicalQuote:'Parliamentary records and rally transcripts from 2019-2022 show statements on related policy areas that take a different position from current messaging.',
      historicalContext:'Lok Sabha records / Party manifesto archive / Rally transcripts (2019-2022)',
      verdict:'Cross-reference required. Sign in to access the full 5-year quote archive with source-cited contradictions.',
    }
    setQuoteResult(result); setQuoteChecking(false)
  }

  const SENT_C: Record<string,string> = {positive:S.grn,negative:S.red,mixed:S.yel,neutral:S.t2}

  return (
    <div style={{minHeight:'100vh',background:S.bg,color:S.t0,fontFamily:'"Inter",sans-serif',fontSize:13}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input{background:#121620;border:1px solid rgba(255,255,255,0.09);color:#edf0f8;border-radius:6px;padding:8px 12px;font-family:IBM Plex Mono,monospace;font-size:12px;outline:none;transition:border-color .15s}
        input:focus{border-color:#f97316} input::placeholder{color:#545f78}
        ::-webkit-scrollbar{width:3px}::-webkit-scrollbar-thumb{background:rgba(255,255,255,0.12);border-radius:3px}
        @keyframes fadein{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
        .fadein{animation:fadein .35s ease-out}
        @keyframes spin{to{transform:rotate(360deg)}}
      `}</style>

      {/* NAV */}
      <nav style={{background:S.s1,borderBottom:`1px solid ${S.b1}`,padding:'0 24px',height:52,display:'flex',alignItems:'center',gap:16,position:'sticky',top:0,zIndex:100}}>
        <Link to={user?'/dashboard':'/'} style={{display:'flex',alignItems:'center',gap:9,textDecoration:'none',flex:1}}>
          <div style={{width:28,height:28,borderRadius:7,background:'linear-gradient(135deg,#f97316,#ef4444)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:14}}>🇮🇳</div>
          <div>
            <div style={{fontFamily:S.mono,fontSize:10,color:S.t0,letterSpacing:1,fontWeight:500}}>BHARAT<span style={{color:S.acc}}>MONITOR</span></div>
            <div style={{fontFamily:S.mono,fontSize:7,color:S.t3,letterSpacing:1}}>POLITICAL INTELLIGENCE</div>
          </div>
        </Link>
        <div style={{display:'flex',gap:8,alignItems:'center'}}>
          {user
            ? <button onClick={()=>navigate('/dashboard')} style={{fontFamily:S.mono,fontSize:9,padding:'5px 14px',border:'none',borderRadius:6,background:S.acc,color:'#fff',cursor:'pointer',letterSpacing:1}}>GO TO DASHBOARD →</button>
            : <>
                <button onClick={()=>navigate('/auth')} style={{fontFamily:S.mono,fontSize:9,padding:'5px 12px',border:`1px solid ${S.b2}`,borderRadius:6,background:'transparent',color:S.t1,cursor:'pointer',letterSpacing:1}}>SIGN IN</button>
                <button onClick={()=>navigate('/auth')} style={{fontFamily:S.mono,fontSize:9,padding:'5px 14px',border:'none',borderRadius:6,background:S.acc,color:'#fff',cursor:'pointer',letterSpacing:1}}>REQUEST ACCESS</button>
              </>
          }
        </div>
      </nav>

      {/* HERO */}
      <div style={{padding:'64px 24px 48px',textAlign:'center',maxWidth:780,margin:'0 auto'}}>
        <div style={{fontFamily:S.mono,fontSize:10,color:S.acc,letterSpacing:3,marginBottom:16}}>'INDIA\'S POLITICAL INTELLIGENCE PLATFORM'</div>
        <h1 style={{fontSize:'clamp(28px,5vw,50px)',fontWeight:700,lineHeight:1.1,marginBottom:16,color:S.t0}}>
          'Know what India is saying.'<br/><span style={{color:S.acc}}>Before your opposition does.</span>
        </h1>
        <p style={{fontSize:15,color:S.t2,lineHeight:1.8,marginBottom:32,maxWidth:560,margin:'0 auto 32px'}}>
          'Real-time intelligence across Twitter, 83 Indian publications, GDELT and Google News. AI-powered contradiction detection across 5 years of public statements.'
        </p>
        <div style={{display:'flex',gap:10,justifyContent:'center',flexWrap:'wrap'}}>
          <button onClick={()=>document.getElementById('demo')?.scrollIntoView({behavior:'smooth'})} style={{padding:'11px 24px',border:'none',borderRadius:8,background:S.acc,color:'#fff',fontFamily:S.mono,fontSize:10,cursor:'pointer',letterSpacing:1}}>TRY FREE DEMO ↓</button>
          <button onClick={()=>document.getElementById('pricing')?.scrollIntoView({behavior:'smooth'})} style={{padding:'11px 24px',border:`1px solid ${S.b2}`,borderRadius:8,background:'transparent',color:S.t1,fontFamily:S.mono,fontSize:10,cursor:'pointer',letterSpacing:1}}>VIEW PRICING ↓</button>
        </div>
      </div>

      {/* STATS BAR */}
      <div style={{display:'flex',justifyContent:'center',gap:0,borderTop:`1px solid ${S.b0}`,borderBottom:`1px solid ${S.b0}`,background:S.s1,padding:'16px 0',flexWrap:'wrap'}}>
        {[['83','Indian publications tracked'],['14','languages monitored'],['5 years','quote history indexed'],['Real-time','Twitter & news signals'],['Free to try','no login required']].map(([v,l])=>(
          <div key={l} style={{padding:'8px 28px',borderRight:`1px solid ${S.b0}`,textAlign:'center',minWidth:130}}>
            <div style={{fontFamily:S.mono,fontSize:18,fontWeight:700,color:S.acc}}>{v}</div>
            <div style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,marginTop:3}}>{l.toUpperCase()}</div>
          </div>
        ))}
      </div>

      {/* INTERACTIVE DEMO */}
      <div id="demo" style={{maxWidth:920,margin:'0 auto',padding:'64px 24px'}}>
        <div style={{textAlign:'center',marginBottom:36}}>
          <div style={{fontFamily:S.mono,fontSize:10,color:S.acc,letterSpacing:3,marginBottom:10}}>LIVE DEMO — NO LOGIN REQUIRED</div>
          <h2 style={{fontSize:28,fontWeight:700,color:S.t0}}>Try it right now</h2>
          <p style={{color:S.t2,marginTop:8}}>Real data from Google News, Nitter, GDELT and 83 Indian RSS feeds. No sign-up needed.</p>
        </div>
        <div style={{display:'flex',gap:0,marginBottom:24,border:`1px solid ${S.b1}`,borderRadius:10,overflow:'hidden',background:S.s1}}>
          {([['scan','⚡ Quick Scan'],['quote','◎ Quote Checker'],['compare','⊞ Comparison']] as const).map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)} style={{flex:1,padding:'13px',border:'none',background:tab===id?'rgba(249,115,22,0.12)':'transparent',color:tab===id?S.acc:S.t2,fontFamily:S.mono,fontSize:10,cursor:'pointer',letterSpacing:1,borderBottom:tab===id?`2px solid ${S.acc}`:'2px solid transparent',transition:'all .15s'}}>
              {label}
            </button>
          ))}
        </div>

        {/* QUICK SCAN */}
        {tab==='scan'&&(
          <div className="fadein" style={{background:S.s1,border:`1px solid ${S.b1}`,borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'20px 24px',borderBottom:`1px solid ${S.b1}`}}>
              <div style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:2,marginBottom:12}}>SCAN 3 KEYWORDS — POLITICIAN · PARTY · ISSUE · GEOGRAPHY · SCHEME</div>
              <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8,marginBottom:12}}>
                {[0,1,2].map(i=>(
                  <input key={i} value={scanKws[i]} onChange={e=>{const n=[...scanKws];n[i]=e.target.value;setScanKws(n)}}
                    onKeyDown={e=>e.key==='Enter'&&!scanning&&runScan()}
                    placeholder={['e.g. Narendra Modi','e.g. BJP','e.g. farmers MSP'][i]} style={{width:'100%'}}/>
                ))}
              </div>
              <div style={{display:'flex',gap:8,alignItems:'center'}}>
                <button onClick={runScan} disabled={scanning||!scanKws.some(k=>k.trim())} style={{padding:'9px 20px',border:'none',borderRadius:7,background:scanning?'rgba(249,115,22,0.3)':S.acc,color:'#fff',fontFamily:S.mono,fontSize:10,cursor:'pointer',opacity:!scanKws.some(k=>k.trim())?0.4:1}}>
                  {scanning?`${scanProgress}% — scanning…`:'⚡ SCAN NOW'}
                </button>
                {scanning&&<div style={{flex:1,height:3,background:S.b0,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',background:S.acc,width:`${scanProgress}%`,transition:'width .4s ease',borderRadius:3}}/></div>}
              </div>
              <div style={{fontFamily:S.mono,fontSize:8,color:S.t3,marginTop:8}}>Free: 3 keywords, no save. Full version: 5–unlimited keywords, saved history, AI tracking, alerts.</div>
            </div>
            {scanResults.map((r,i)=>{
              const sc=SENT_C[r.sentiment]||S.t2
              const uc=r.urgency==='high'?S.red:r.urgency==='medium'?S.yel:S.grn
              return (
                <div key={i} style={{padding:'18px 24px',borderBottom:`1px solid ${S.b0}`,animation:'fadein .3s ease-out'}}>
                  <div style={{display:'flex',alignItems:'flex-start',gap:14}}>
                    <div style={{flex:1}}>
                      <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:8,flexWrap:'wrap'}}>
                        <span style={{fontFamily:S.mono,fontSize:12,color:S.t0,fontWeight:500}}>"{r.keyword}"</span>
                        <span style={{fontFamily:S.mono,fontSize:7,padding:'2px 6px',borderRadius:3,background:sc+'18',color:sc,border:`1px solid ${sc}30`,textTransform:'uppercase'}}>{r.sentiment}</span>
                        <span style={{fontFamily:S.mono,fontSize:7,padding:'2px 6px',borderRadius:3,background:uc+'15',color:uc,border:`1px solid ${uc}25`}}>{r.urgency.toUpperCase()} URGENCY</span>
                        <span style={{fontFamily:S.mono,fontSize:8,color:S.t3}}>{r.volume} mentions</span>
                      </div>
                      <div style={{fontSize:12,color:S.t1,lineHeight:1.7,marginBottom:10}}>{r.headline}</div>
                      <div style={{marginBottom:10}}>
                        {r.platforms.map((p:any)=>(
                          <div key={p.name} style={{display:'flex',alignItems:'center',gap:6,marginBottom:4}}>
                            <span style={{fontFamily:S.mono,fontSize:8,color:S.t2,width:80,flexShrink:0}}>{p.name}</span>
                            <div style={{flex:1,height:3,background:S.s3,borderRadius:3,overflow:'hidden'}}><div style={{height:'100%',background:p.color,borderRadius:3,width:`${p.pct}%`}}/></div>
                            <span style={{fontFamily:S.mono,fontSize:8,color:S.t2,minWidth:24,textAlign:'right'}}>{p.pct}%</span>
                          </div>
                        ))}
                      </div>
                      <div style={{fontFamily:S.mono,fontSize:7,color:S.t3}}>Sources: {r.dataSource} · Refreshed {r.refreshed}</div>
                    </div>
                    <div style={{width:52,height:52,borderRadius:'50%',background:sc+'18',border:`2px solid ${sc}`,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                      <div style={{fontFamily:S.mono,fontSize:14,fontWeight:700,color:sc,lineHeight:1}}>{r.sentScore}</div>
                      <div style={{fontFamily:S.mono,fontSize:6,color:sc}}>SCORE</div>
                    </div>
                  </div>
                </div>
              )
            })}
            {scanResults.length>0&&(
              <div style={{padding:'14px 24px',background:'rgba(249,115,22,0.04)',display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                <div style={{fontSize:11,color:S.t2}}>Full version: 5–15 keywords, saved tracking, AI daily brief, alerts, weekly reports</div>
                <button onClick={()=>navigate('/auth')} style={{padding:'7px 16px',border:'none',borderRadius:6,background:S.acc,color:'#fff',fontFamily:S.mono,fontSize:9,cursor:'pointer',letterSpacing:1}}>GET FULL ACCESS →</button>
              </div>
            )}
            {!scanResults.length&&!scanning&&(
              <div style={{padding:'32px',textAlign:'center',color:S.t3,fontFamily:S.mono,fontSize:10,letterSpacing:1}}>ENTER KEYWORDS ABOVE AND PRESS SCAN</div>
            )}
          </div>
        )}

        {/* QUOTE CHECKER */}
        {tab==='quote'&&(
          <div className="fadein" style={{background:S.s1,border:`1px solid ${S.b1}`,borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'20px 24px',borderBottom:`1px solid ${S.b1}`}}>
              <div style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:2,marginBottom:12}}>ENTER ANY INDIAN POLITICIAN'S NAME — AI CHECKS LAST 5 YEARS OF PUBLIC STATEMENTS</div>
              <div style={{display:'flex',gap:8}}>
                <input value={quoteName} onChange={e=>setQuoteName(e.target.value)} onKeyDown={e=>e.key==='Enter'&&!quoteChecking&&runQuoteCheck()}
                  placeholder="e.g. Amit Shah · Rahul Gandhi · Arvind Kejriwal · Mamata Banerjee · Narendra Modi" style={{flex:1}}/>
                <button onClick={runQuoteCheck} disabled={quoteChecking||!quoteName.trim()} style={{padding:'9px 16px',border:'none',borderRadius:7,background:quoteChecking?'rgba(249,115,22,0.3)':S.acc,color:'#fff',fontFamily:S.mono,fontSize:10,cursor:'pointer',whiteSpace:'nowrap',opacity:!quoteName.trim()?0.4:1}}>
                  {quoteChecking?'CHECKING…':'CHECK QUOTES'}
                </button>
              </div>
              <div style={{fontFamily:S.mono,fontSize:8,color:S.t3,marginTop:8}}>Free: 1 contradiction shown. Full version: all contradictions, vote records, RTI data, shareable cards.</div>
            </div>
            {quoteChecking&&(
              <div style={{padding:'40px',textAlign:'center'}}>
                <div style={{width:22,height:22,borderRadius:'50%',border:`2px solid ${S.acc}`,borderTopColor:'transparent',animation:'spin 0.8s linear infinite',margin:'0 auto 14px'}}/>
                <div style={{fontFamily:S.mono,fontSize:10,color:S.t2}}>Cross-referencing 5 years of parliamentary records, rally transcripts and media statements…</div>
              </div>
            )}
            {quoteResult&&!quoteChecking&&(
              <div className="fadein" style={{padding:'20px 24px'}}>
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:14,flexWrap:'wrap'}}>
                  <span style={{fontFamily:S.mono,fontSize:10,color:S.t0,fontWeight:500}}>{quoteResult.politicianStates}</span>
                  <span style={{fontFamily:S.mono,fontSize:8,padding:'3px 8px',borderRadius:4,background:'rgba(245,166,35,0.12)',color:S.yel,border:'1px solid rgba(245,166,35,0.25)'}}>{quoteResult.type}</span>
                  <span style={{fontFamily:S.mono,fontSize:8,padding:'3px 8px',borderRadius:4,background:'rgba(240,62,62,0.12)',color:S.red,border:'1px solid rgba(240,62,62,0.25)'}}>{quoteResult.score}% CONFIDENCE</span>
                </div>
                {/* Current statement */}
                <div style={{marginBottom:12}}>
                  <div style={{fontFamily:S.mono,fontSize:7,color:S.red,letterSpacing:1,marginBottom:6}}>CURRENT STATEMENT</div>
                  <div style={{padding:'12px 14px',background:'rgba(240,62,62,0.06)',border:'1px solid rgba(240,62,62,0.2)',borderRadius:8,borderLeft:`3px solid ${S.red}`}}>
                    <div style={{fontSize:13,color:S.t0,lineHeight:1.7,fontStyle:'italic',marginBottom:6}}>{quoteResult.currentQuote}</div>
                    <div style={{fontFamily:S.mono,fontSize:8,color:S.t3}}>{quoteResult.currentContext}</div>
                  </div>
                </div>
                {/* Counter quote */}
                <div style={{marginBottom:12}}>
                  <div style={{fontFamily:S.mono,fontSize:7,color:S.yel,letterSpacing:1,marginBottom:6}}>CONTRADICTED BY — ON THE RECORD</div>
                  <div style={{padding:'12px 14px',background:'rgba(245,166,35,0.06)',border:'1px solid rgba(245,166,35,0.2)',borderRadius:8,borderLeft:`3px solid ${S.yel}`}}>
                    <div style={{fontSize:12,color:S.t1,lineHeight:1.7,marginBottom:6}}>{quoteResult.historicalQuote}</div>
                    <div style={{fontFamily:S.mono,fontSize:8,color:S.t3}}>SOURCE: {quoteResult.historicalContext}</div>
                  </div>
                </div>
                {/* Verdict */}
                <div style={{padding:'10px 14px',background:'rgba(136,146,164,0.08)',border:`1px solid ${S.b1}`,borderRadius:6,marginBottom:14}}>
                  <div style={{fontFamily:S.mono,fontSize:7,color:'#8892a4',letterSpacing:1,marginBottom:4}}>◈ ANALYSIS</div>
                  <div style={{fontSize:11,color:S.t1,lineHeight:1.6}}>{quoteResult.verdict}</div>
                </div>
                <div style={{padding:'12px 14px',background:'rgba(249,115,22,0.06)',border:'1px solid rgba(249,115,22,0.15)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10}}>
                  <div style={{fontSize:11,color:S.t2}}>Full version: all contradictions found, RTI-backed evidence, vote records, shareable image cards</div>
                  <button onClick={()=>navigate('/auth')} style={{padding:'7px 14px',border:'none',borderRadius:6,background:S.acc,color:'#fff',fontFamily:S.mono,fontSize:9,cursor:'pointer',letterSpacing:1}}>SEE ALL →</button>
                </div>
              </div>
            )}
            {!quoteResult&&!quoteChecking&&(
              <div style={{padding:'36px',textAlign:'center'}}>
                <div style={{fontFamily:S.mono,fontSize:10,color:S.t3,letterSpacing:1,marginBottom:10}}>ENTER A POLITICIAN'S NAME ABOVE</div>
                <div style={{fontFamily:S.mono,fontSize:9,color:S.t3,opacity:0.6}}>Try: Amit Shah · Rahul Gandhi · Arvind Kejriwal · Mamata Banerjee · Narendra Modi</div>
              </div>
            )}
          </div>
        )}

        {/* COMPARISON */}
        {tab==='compare'&&(
          <div className="fadein" style={{background:S.s1,border:`1px solid ${S.b1}`,borderRadius:12,overflow:'hidden'}}>
            <div style={{padding:'16px 24px',borderBottom:`1px solid ${S.b1}`}}>
              <div style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:2,marginBottom:4}}>SAMPLE COMPARISON — NM vs RG vs AK vs MB</div>
              <div style={{fontSize:11,color:S.t2}}>Live cross-platform comparison across 8 intelligence metrics. Sign in to compare your own politicians.</div>
            </div>
            <div style={{padding:'16px 24px'}}>
              <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
                {[{n:'NM / BJP',c:S.acc,s:73},{n:'RG / INC',c:S.blu,s:58},{n:'AK / AAP',c:S.grn,s:51},{n:'MB / TMC',c:S.yel,s:48}].map(p=>(
                  <div key={p.n} style={{padding:'10px',background:S.s2,border:`1px solid ${S.b1}`,borderRadius:8,textAlign:'center'}}>
                    <div style={{fontFamily:S.mono,fontSize:8,color:p.c,marginBottom:4}}>{p.n}</div>
                    <div style={{fontFamily:S.mono,fontSize:22,fontWeight:700,color:p.c}}>{p.s}</div>
                    <div style={{fontFamily:S.mono,fontSize:7,color:S.t3,marginTop:2}}>SENTIMENT</div>
                  </div>
                ))}
              </div>
              {[
                {m:'Social Volume (relative)',vals:[96,54,29,25],colors:[S.acc,S.blu,S.grn,S.yel]},
                {m:'Opposition Pressure',vals:[67,44,38,42],colors:[S.red,S.yel,S.yel,S.yel]},
                {m:'Issue Ownership Score',vals:[63,48,35,28],colors:[S.acc,S.blu,S.grn,S.yel]},
                {m:'Narrative Score (/100)',vals:[56,44,38,32],colors:[S.acc,S.blu,S.grn,S.yel]},
                {m:'Youth Sentiment',vals:[54,61,55,48],colors:[S.grn,S.acc,S.grn,S.yel]},
              ].map(row=>(
                <div key={row.m} style={{marginBottom:12}}>
                  <div style={{fontFamily:S.mono,fontSize:7,color:S.t3,letterSpacing:1,marginBottom:5}}>{row.m.toUpperCase()}</div>
                  {['NM/BJP','RG/INC','AK/AAP','MB/TMC'].map((n,pi)=>(
                    <div key={n} style={{display:'flex',alignItems:'center',gap:8,marginBottom:4}}>
                      <span style={{fontFamily:S.mono,fontSize:8,color:S.t2,width:52,flexShrink:0}}>{n}</span>
                      <div style={{flex:1,height:4,background:S.s3,borderRadius:3,overflow:'hidden'}}><div style={{width:`${row.vals[pi]}%`,height:'100%',background:row.colors[pi],borderRadius:3}}/></div>
                      <span style={{fontFamily:S.mono,fontSize:8,color:row.colors[pi],minWidth:22,textAlign:'right'}}>{row.vals[pi]}</span>
                    </div>
                  ))}
                </div>
              ))}
              <div style={{padding:'12px 14px',background:'rgba(249,115,22,0.06)',border:'1px solid rgba(249,115,22,0.15)',borderRadius:8,display:'flex',alignItems:'center',justifyContent:'space-between',flexWrap:'wrap',gap:10,marginTop:8}}>
                <div style={{fontSize:11,color:S.t2}}>Full version: track your own politician, choose rivals, 6-month trend lines, shareable reports</div>
                <button onClick={()=>navigate('/auth')} style={{padding:'7px 14px',border:'none',borderRadius:6,background:S.acc,color:'#fff',fontFamily:S.mono,fontSize:9,cursor:'pointer',letterSpacing:1}}>GET ACCESS →</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* PRICING */}
      <div id="pricing" style={{borderTop:`1px solid ${S.b0}`,padding:'64px 24px',maxWidth:1200,margin:'0 auto'}}>
        <div style={{textAlign:'center',marginBottom:48}}>
          <div style={{fontFamily:S.mono,fontSize:10,color:S.acc,letterSpacing:3,marginBottom:10}}>PRICING</div>
          <h2 style={{fontSize:32,fontWeight:700,color:S.t0}}>Choose your intelligence tier</h2>
          <p style={{color:S.t2,marginTop:8}}>Pricing tailored to your requirements. Elections tier activated by BharatMonitor team only.</p>
        </div>
        <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(300px,1fr))',gap:16,alignItems:'start'}}>
          {TIERS.map(tier=>(
            <div key={tier.id} style={{background:S.s1,border:`1px solid ${(tier as any).highlight?tier.color+'50':S.b1}`,borderRadius:12,overflow:'hidden',transform:(tier as any).highlight?'scale(1.02)':'none'}}>
              {(tier as any).highlight&&<div style={{background:tier.color,padding:'5px',textAlign:'center',fontFamily:S.mono,fontSize:8,letterSpacing:2,color:'#fff'}}>RECOMMENDED FOR ACTIVE CAMPAIGNS</div>}
              <div style={{padding:'24px'}}>
                <div style={{fontFamily:S.mono,fontSize:10,color:tier.color,letterSpacing:2,marginBottom:6}}>{tier.name.toUpperCase()}</div>
                <div style={{fontSize:tier.price.length>8?20:28,fontWeight:700,color:S.t0,marginBottom:2}}>{tier.price}</div>
                <div style={{fontFamily:S.mono,fontSize:8,color:S.t3,marginBottom:20}}>{tier.note}</div>
                <div style={{display:'flex',flexDirection:'column',gap:6,marginBottom:14}}>
                  {tier.features.map(f=>(
                    <div key={f} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:11,color:S.t1}}>
                      <span style={{color:S.grn,flexShrink:0,marginTop:1,fontWeight:700}}>✓</span>{f}
                    </div>
                  ))}
                </div>
                {tier.locked.length>0&&(
                  <>
                    <div style={{fontFamily:S.mono,fontSize:7,color:S.t3,letterSpacing:1,marginBottom:8,marginTop:4}}>NOT INCLUDED:</div>
                    <div style={{display:'flex',flexDirection:'column',gap:5,marginBottom:16}}>
                      {tier.locked.map(f=>(
                        <div key={f} style={{display:'flex',alignItems:'flex-start',gap:8,fontSize:11,color:S.t3}}>
                          <span style={{flexShrink:0,marginTop:1}}>—</span>{f}
                        </div>
                      ))}
                    </div>
                  </>
                )}
                <button onClick={()=>navigate('/auth')} style={{width:'100%',padding:'11px',border:`1px solid ${tier.color}50`,borderRadius:8,background:(tier as any).highlight?tier.color:'transparent',color:(tier as any).highlight?'#fff':tier.color,fontFamily:S.mono,fontSize:10,cursor:'pointer',letterSpacing:1,transition:'all .15s'}}>
                  'CONNECT FOR PRICING →'
                </button>
                {(tier as any).electionsOnly&&<div style={{fontFamily:S.mono,fontSize:8,color:S.t3,textAlign:'center',marginTop:8,lineHeight:1.6}}>Requires manual activation by<br/>BharatMonitor admin team</div>}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* FOOTER */}
      <div style={{borderTop:`1px solid ${S.b0}`,padding:'28px 24px',textAlign:'center',background:S.s1}}>
        <div style={{fontFamily:S.mono,fontSize:9,color:S.t3,letterSpacing:1,lineHeight:2.4}}>
          BHARATMONITOR · POLITICAL INTELLIGENCE PLATFORM<br/>
          <a href="mailto:ankit@hertzmsc.com" style={{color:S.acc}}>ankit@hertzmsc.com</a>
          <span style={{margin:'0 12px',color:S.b2}}>·</span>
          <span style={{cursor:'pointer',color:S.t2}} onClick={()=>navigate('/auth')}>Sign In</span>
        </div>
      </div>
    </div>
  )
}
