// BharatMonitor — Comprehensive Intelligence Report v2
// Covers: Account Parameters + Dashboard + Analyse (Trends/Audience/Intelligence/Contradictions)
// + Crisis + National Discourse + Competitor Intelligence
// Fixed: reads accountId from URL param when opened in new tab

import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAccount, useFeedItems, useContradictions, useCompetitors, useTrendMetrics, useConstituencyPulse, useSchemes, useAIBrief } from '@/hooks/useData'
import { supabase } from '@/lib/supabase'
import { useQuery } from '@tanstack/react-query'

const mono   = '"IBM Plex Mono", monospace'
const DARK   = '#0d1018'
const CARD   = '#111827'
const CARD2  = '#161d2c'
const BORDER = 'rgba(255,255,255,0.08)'
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

const PLAT: Record<string,string> = {
  twitter:'#1d9bf0', youtube:'#ff2020', news:'#8892a4',
  reddit:'#ff4500', instagram:'#e1306c', facebook:'#1877f2',
  whatsapp:'#25d366', bluesky:'#0085ff',
}


// ─── CSV Export ───────────────────────────────────────────────────────────────
function exportAllCSV(account: any, feed: any[], contradictions: any[], competitors: any[], schemes: any[]) {
  const timestamp = new Date().toISOString().substring(0, 10)
  const name = (account?.politician_name || 'account').replace(/\s+/g, '_')

  // ── Helper: download a CSV blob ──────────────────────────────────────────
  function downloadCSV(filename: string, rows: string[][], headers: string[]) {
    const escape = (v: any) => {
      const s = String(v ?? '').replace(/"/g, '""')
      return s.includes(',') || s.includes('"') || s.includes('\n') ? `"${s}"` : s
    }
    const lines = [headers.map(escape).join(','), ...rows.map(r => r.map(escape).join(','))]
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  // ── 1. Feed items (all) ──────────────────────────────────────────────────
  downloadCSV(
    `${name}_feed_${timestamp}.csv`,
    feed.map(f => [
      f.published_at?.substring(0, 19) || '',
      f.headline || '',
      f.source || '',
      f.platform || '',
      f.sentiment || '',
      f.bucket || '',
      f.tone || 0,
      f.keyword || '',
      (f.geo_tags || []).join('; '),
      (f.topic_tags || []).join('; '),
      f.url || '',
      f.language || '',
      f.engagement || '',
      f.views || '',
    ]),
    ['published_at','headline','source','platform','sentiment','bucket','tone','keyword','geo_tags','topic_tags','url','language','engagement','views']
  )

  // ── 2. Contradictions ────────────────────────────────────────────────────
  if (contradictions.length > 0) {
    setTimeout(() => {
      downloadCSV(
        `${name}_contradictions_${timestamp}.csv`,
        (contradictions as any[]).map(c => [
          c.created_at?.substring(0, 19) || '',
          c.politician_name || '',
          c.contradiction_type || '',
          c.contradiction_score || '',
          c.historical_quote || '',
          c.historical_date || '',
          c.historical_source || '',
          c.current_quote || '',
          c.reasoning || '',
          c.source_url || '',
        ]),
        ['created_at','politician','type','score','historical_quote','historical_date','historical_source','current_quote','ai_reasoning','source_url']
      )
    }, 300)
  }

  // ── 3. Competitor mentions ────────────────────────────────────────────────
  if (competitors.length > 0) {
    setTimeout(() => {
      const compRows: string[][] = []
      ;(competitors as any[]).map((c: any) => {
        const lastName = c.politician.name.split(' ').slice(-1)[0].toLowerCase()
        const cf = feed.filter(f => f.headline?.toLowerCase().includes(lastName))
        cf.forEach(f => compRows.push([
          c.politician.name,
          c.politician.party || '',
          c.politician.role || '',
          f.published_at?.substring(0, 19) || '',
          f.headline || '',
          f.source || '',
          f.platform || '',
          f.sentiment || '',
          f.bucket || '',
          f.url || '',
        ]))
      })
      if (compRows.length > 0) {
        downloadCSV(
          `${name}_competitor_mentions_${timestamp}.csv`,
          compRows,
          ['competitor_name','party','role','published_at','headline','source','platform','sentiment','bucket','url']
        )
      }
    }, 600)
  }

  // ── 4. Keyword performance summary ───────────────────────────────────────
  setTimeout(() => {
    const kws: string[] = account?.keywords || []
    const kwRows = kws.map(kw => {
      const items = feed.filter(f => f.headline?.toLowerCase().includes(kw.toLowerCase()) || f.keyword === kw)
      const pos = items.filter(f => f.sentiment === 'positive').length
      const neg = items.filter(f => f.sentiment === 'negative').length
      const crisis = items.filter(f => f.bucket === 'red').length
      return [
        kw,
        items.length,
        pos,
        neg,
        items.length - pos - neg,
        crisis,
        Math.round((pos / Math.max(items.length, 1)) * 100) + '%',
      ]
    })
    downloadCSV(
      `${name}_keyword_performance_${timestamp}.csv`,
      kwRows.map(r => r.map(String)),
      ['keyword','total','positive','negative','neutral','crisis','positive_pct']
    )
  }, 900)

  // ── 5. Scheme tracking ───────────────────────────────────────────────────
  if (schemes.length > 0) {
    setTimeout(() => {
      downloadCSV(
        `${name}_schemes_${timestamp}.csv`,
        (schemes as any[]).map(s => [
          s.scheme_name || '',
          s.sentiment_score || '',
          s.mention_count || '',
          s.trend || '',
        ]),
        ['scheme','sentiment_score_pct','mention_count','trend']
      )
    }, 1200)
  }

  // ── 6. Account parameters ────────────────────────────────────────────────
  setTimeout(() => {
    const params = [
      ['politician_name',    account?.politician_name || ''],
      ['party',              account?.party || ''],
      ['designation',        account?.designation || ''],
      ['constituency',       account?.constituency || ''],
      ['constituency_type',  account?.constituency_type || ''],
      ['state',              account?.state || ''],
      ['district',           account?.district || ''],
      ['geo_scope',          (account?.geo_scope as any)?.level || ''],
      ['languages',          (account?.languages || []).join('; ')],
      ['keywords',           (account?.keywords || []).join('; ')],
      ['ministries_tracked', (account?.tracked_ministries || []).map((m: any) => typeof m === 'string' ? m : m.name).join('; ')],
      ['schemes_tracked',    (account?.tracked_schemes || []).map((s: any) => typeof s === 'string' ? s : s.name).join('; ')],
      ['politicians_tracked',(account?.tracked_politicians || []).map((p: any) => `${p.name} (${p.party})`).join('; ')],
      ['watchlist_handles',  (account?.tracked_parties || []).map((h: any) => h.handle).join('; ')],
      ['report_generated',   new Date().toISOString()],
    ]
    downloadCSV(
      `${name}_account_parameters_${timestamp}.csv`,
      params,
      ['parameter', 'value']
    )
  }, 1500)
}

// ─── Reusable primitives ─────────────────────────────────────────────────────

function PageBreak() {
  return <div style={{ pageBreakAfter: 'always', marginBottom: '40px', borderBottom: `2px solid ${BORDER}`, paddingBottom: '20px' }} />
}

function SectionHeader({ n, title, color }: { n: string; title: string; color?: string }) {
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', marginBottom:'14px', borderBottom:`1px solid ${BORDER}`, paddingBottom:'8px' }}>
      <span style={{ fontFamily:mono, fontSize:'10px', color: color || ACC, fontWeight:700 }}>{n}</span>
      <span style={{ fontFamily:mono, fontSize:'9px', color:T2, letterSpacing:'2px' }}>{title}</span>
    </div>
  )
}

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:'8px', padding:'14px', ...style }}>{children}</div>
}

function Bar({ label, value, max, color, sub }: { label:string; value:number; max:number; color:string; sub?:string }) {
  const pct = Math.round((value / Math.max(max,1)) * 100)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'10px', padding:'5px 0', borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
      <span style={{ fontFamily:mono, fontSize:'9px', color:T2, width:'150px', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{label}</span>
      <div style={{ flex:1, height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'2px', overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:'2px' }} />
      </div>
      <span style={{ fontFamily:mono, fontSize:'9px', color:T0, minWidth:'28px', textAlign:'right' }}>{value}</span>
      {sub && <span style={{ fontFamily:mono, fontSize:'8px', color:T3, minWidth:'32px', textAlign:'right' }}>{sub}</span>}
    </div>
  )
}

function FeedItem({ item }: { item:any }) {
  const bc = item.bucket==='red'?RED : item.bucket==='yellow'?YELLOW : item.bucket==='blue'?BLUE : GREEN
  const sc = item.sentiment==='positive'?GREEN : item.sentiment==='negative'?RED : T3
  return (
    <div style={{ padding:'8px 0', borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
      <div style={{ display:'flex', gap:'8px', alignItems:'flex-start' }}>
        <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:bc, flexShrink:0, marginTop:'5px' }} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:'11px', color:T0, lineHeight:1.5, marginBottom:'3px' }}>{item.headline}</div>
          <div style={{ display:'flex', gap:'8px', flexWrap:'wrap' }}>
            {item.date && <span style={{ fontFamily:mono, fontSize:'7px', color:T3 }}>{item.date?.substring?.(0,10) || item.published_at?.substring?.(0,10)}</span>}
            <span style={{ fontFamily:mono, fontSize:'7px', color:T3 }}>{item.source}</span>
            <span style={{ fontFamily:mono, fontSize:'7px', color:PLAT[item.platform]||T3 }}>{item.platform?.toUpperCase()}</span>
            <span style={{ fontFamily:mono, fontSize:'7px', color:sc, background:sc+'12', padding:'1px 4px', borderRadius:'3px' }}>{item.sentiment?.toUpperCase()}</span>
            {item.url && <a href={item.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily:mono, fontSize:'7px', color:BLUE }}>↗</a>}
          </div>
        </div>
      </div>
    </div>
  )
}

function KPI({ label, value, color, width }: { label:string; value:string|number; color:string; width?:string }) {
  return (
    <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:'8px', padding:'10px 12px', textAlign:'center', minWidth: width||'auto' }}>
      <div style={{ fontFamily:mono, fontSize:'7px', color:T3, letterSpacing:'1px', marginBottom:'4px' }}>{label}</div>
      <div style={{ fontFamily:mono, fontSize:'18px', fontWeight:700, color }}>{value}</div>
    </div>
  )
}

function Tag({ text, color }: { text:string; color?:string }) {
  const c = color || T2
  return (
    <span style={{ fontFamily:mono, fontSize:'8px', padding:'2px 8px', borderRadius:'4px', border:`1px solid ${c}30`, background:c+'10', color:c, marginRight:'4px', marginBottom:'4px', display:'inline-block' }}>
      {text}
    </span>
  )
}

// ─── Extra data hook — pulls bm_analysis for AI brief ───────────────────────
function useAnalysisReport(accountId: string) {
  return useQuery({
    queryKey: ['report-analysis', accountId],
    queryFn: async () => {
      if (!accountId) return null
      const { data } = await supabase.from('bm_analysis').select('*')
        .eq('account_id', accountId).order('created_at', { ascending: false }).limit(1).maybeSingle()
      return data || null
    },
    enabled: !!accountId,
    staleTime: 5 * 60_000,
  })
}

// ─── PERSONA DEFINITIONS (mirrors AnalysePage) ───────────────────────────────
const PERSONAS = [
  { id:'rural',       label:'Rural Voters',       icon:'🌾', color:GREEN,   keywords:['village','rural','farmer','kisan','gram','panchayat','mgnrega','pm kisan','agri','irrigation','crop','msp'] },
  { id:'urban',       label:'Urban Middle Class', icon:'🏙️', color:BLUE,    keywords:['city','urban','metro','inflation','income','jobs','startup','it sector','middle class','gst','housing','emi'] },
  { id:'youth',       label:'Youth (18-35)',       icon:'⚡', color:PURPLE,  keywords:['youth','student','unemployment','jobs','education','college','neet','exam','skill','internship'] },
  { id:'women',       label:'Women Voters',        icon:'👩', color:'#e1306c', keywords:['women','woman','mahila','reservation','safety','beti','girl','female','gender','health','maternity'] },
  { id:'ideological', label:'Ideological Core',   icon:'🇮🇳', color:YELLOW,  keywords:['temple','mandir','ram','ayodhya','hindutva','nationalism','bharat','hindu','religion','patriot'] },
  { id:'business',    label:'Business Community', icon:'💼', color:ACC,     keywords:['business','industry','msme','gst','trade','export','investment','entrepreneur','manufacturing'] },
  { id:'minority',    label:'Minority Outreach',  icon:'🤝', color:'#9c59d1', keywords:['minority','muslim','christian','sikh','dalit','obc','tribal','adivasi','sc','st','reservation'] },
  { id:'senior',      label:'Senior Citizens',    icon:'👴', color:'#60a5fa', keywords:['pension','elderly','senior','ayushman','health','hospital','old age'] },
]

// ─────────────────────────────────────────────────────────────────────────────
//  MAIN REPORT COMPONENT
// ─────────────────────────────────────────────────────────────────────────────
export default function ReportPage() {
  const [searchParams] = useSearchParams()
  const { data: account } = useAccount()
  // Falls back to URL param when opened in new tab (no auth session)
  const accountId = account?.id || searchParams.get('accountId') || ''

  const { data: feed = [] }          = useFeedItems(accountId)
  const { data: contradictions = [] } = useContradictions(accountId)
  const { data: competitors = [] }    = useCompetitors(account)
  const { data: trends = [] }         = useTrendMetrics(accountId)
  const { data: pulse }               = useConstituencyPulse(accountId, account)
  const { data: schemes = [] }        = useSchemes(accountId, account)
  const { data: aiBrief }             = useAIBrief(accountId)
  const { data: analysis }            = useAnalysisReport(accountId)

  const generated = new Date().toLocaleString('en-IN', {
    timeZone:'Asia/Kolkata', day:'2-digit', month:'long',
    year:'numeric', hour:'2-digit', minute:'2-digit',
  })

  // ── Core feed stats ───────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const total = feed.length, t = Math.max(total,1)
    const pos   = feed.filter(f=>f.sentiment==='positive').length
    const neg   = feed.filter(f=>f.sentiment==='negative').length
    const neu   = total - pos - neg
    const crisis= feed.filter(f=>f.bucket==='red').length
    const dev   = feed.filter(f=>f.bucket==='yellow').length

    const platCounts:   Record<string,number> = {}
    const sourceCounts: Record<string,number> = {}
    const geoCounts:    Record<string,number> = {}
    const topicCounts:  Record<string,number> = {}
    const keywordCounts:Record<string,{total:number;pos:number;neg:number;crisis:number}> = {}

    feed.forEach(f => {
      platCounts[f.platform]  = (platCounts[f.platform]||0)+1
      if (f.source) sourceCounts[f.source] = (sourceCounts[f.source]||0)+1
      ;(f.geo_tags||[]).forEach((g:string)=> geoCounts[g]=(geoCounts[g]||0)+1)
      ;(f.topic_tags||[]).forEach((tp:string)=> topicCounts[tp]=(topicCounts[tp]||0)+1)
      const kw = f.keyword || 'general'
      if (!keywordCounts[kw]) keywordCounts[kw]={total:0,pos:0,neg:0,crisis:0}
      keywordCounts[kw].total++
      if (f.sentiment==='positive') keywordCounts[kw].pos++
      if (f.sentiment==='negative') keywordCounts[kw].neg++
      if (f.bucket==='red') keywordCounts[kw].crisis++
    })

    return {
      total, pos, neg, neu, crisis, dev,
      posPct: Math.round(pos/t*100),
      negPct: Math.round(neg/t*100),
      neuPct: Math.round(neu/t*100),
      sortedPlats:   Object.entries(platCounts).sort(([,a],[,b])=>b-a),
      sortedSources: Object.entries(sourceCounts).sort(([,a],[,b])=>b-a).slice(0,10),
      sortedGeo:     Object.entries(geoCounts).sort(([,a],[,b])=>b-a).slice(0,10),
      sortedTopics:  Object.entries(topicCounts).sort(([,a],[,b])=>b-a).slice(0,10),
      sortedKw:      Object.entries(keywordCounts).sort(([,a],[,b])=>b.total-a.total).slice(0,12),
      crisisItems:   feed.filter(f=>f.bucket==='red').slice(0,8),
      devItems:      feed.filter(f=>f.bucket==='yellow').slice(0,8),
      posItems:      feed.filter(f=>f.sentiment==='positive').slice(0,6),
      negItems:      feed.filter(f=>f.sentiment==='negative').slice(0,6),
    }
  }, [feed])

  // ── Persona analysis (mirrors AnalysePage) ────────────────────────────────
  const personaStats = useMemo(() =>
    PERSONAS.map(p => {
      const matched = feed.filter(f => {
        const text = `${f.headline} ${(f.topic_tags||[]).join(' ')} ${(f.geo_tags||[]).join(' ')}`.toLowerCase()
        return p.keywords.some(k => text.includes(k))
      })
      const pos = matched.filter(f=>f.sentiment==='positive').length
      const neg = matched.filter(f=>f.sentiment==='negative').length
      const score = Math.round(50 + ((pos-neg)/Math.max(matched.length,1))*50)
      return { ...p, count:matched.length, pos, neg, score }
    }).sort((a,b)=>b.count-a.count)
  , [feed])

  // ── Trend data points ─────────────────────────────────────────────────────
  const trendPoints = trends[0]?.data_points || []

  // ── Keyword gap analysis ──────────────────────────────────────────────────
  const kwGaps = useMemo(() => {
    const kws: string[] = account?.keywords || []
    return kws.map(kw => {
      const items = feed.filter(f => f.headline?.toLowerCase().includes(kw.toLowerCase()) || f.keyword===kw)
      const pos = items.filter(f=>f.sentiment==='positive').length
      return { kw, count:items.length, posPct:Math.round((pos/Math.max(items.length,1))*100), gap:items.length<3 }
    }).sort((a,b)=>a.count-b.count)
  }, [feed, account?.keywords])

  // ── Section numbering ─────────────────────────────────────────────────────
  let sectionNum = 0
  const S = (title: string, color?: string) => {
    sectionNum++
    return <SectionHeader n={String(sectionNum).padStart(2,'0')} title={title} color={color} />
  }

  return (
    <div style={{ background:DARK, color:T0, minHeight:'100vh', fontFamily:'system-ui, sans-serif' }}>

      {/* ── Print controls ── */}
      <div className="no-print" style={{ position:'fixed', top:'16px', right:'16px', zIndex:1000, display:'flex', gap:'8px' }}>
        <button onClick={()=>window.print()} style={{ padding:'10px 20px', background:ACC, color:'#fff', border:'none', borderRadius:'8px', cursor:'pointer', fontFamily:mono, fontSize:'11px', fontWeight:700, boxShadow:`0 4px 16px rgba(249,115,22,0.4)` }}>
          ⬇ SAVE AS PDF
        </button>
        <button
          onClick={() => exportAllCSV(account, feed, contradictions, competitors, schemes)}
          title="Downloads 6 CSV files: feed, contradictions, competitor mentions, keyword performance, schemes, account parameters"
          style={{ padding:'10px 20px', background:'transparent', color:GREEN, border:`1px solid ${GREEN}50`, borderRadius:'8px', cursor:'pointer', fontFamily:mono, fontSize:'11px', fontWeight:700 }}>
          ⬇ EXPORT CSV
        </button>
        <button onClick={()=>window.close()} style={{ padding:'10px 14px', background:'transparent', color:T2, border:`1px solid ${BORDER}`, borderRadius:'8px', cursor:'pointer', fontFamily:mono, fontSize:'11px' }}>
          ✕ CLOSE
        </button>
      </div>

      <div style={{ maxWidth:'960px', margin:'0 auto', padding:'48px 36px' }}>

        {/* ══════════════════════════════════════════════════════════════
            COVER PAGE
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom:'48px', paddingBottom:'32px', borderBottom:`2px solid ${ACC}` }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'28px' }}>
            <div>
              <div style={{ fontFamily:mono, fontSize:'9px', color:ACC, letterSpacing:'3px', marginBottom:'8px' }}>BHARATMONITOR · POLITICAL INTELLIGENCE REPORT</div>
              <div style={{ fontSize:'28px', fontWeight:700, color:T0, marginBottom:'6px' }}>{account?.politician_name || 'Account'}</div>
              <div style={{ fontSize:'13px', color:T2 }}>{[account?.party, account?.designation, account?.constituency, account?.state].filter(Boolean).join(' · ')}</div>
              <div style={{ fontFamily:mono, fontSize:'10px', color:T3, marginTop:'8px' }}>CONFIDENTIAL · FOR AUTHORISED USE ONLY</div>
            </div>
            <div style={{ textAlign:'right' }}>
              <div style={{ fontFamily:mono, fontSize:'9px', color:T3, marginBottom:'4px' }}>GENERATED</div>
              <div style={{ fontFamily:mono, fontSize:'11px', color:T2 }}>{generated} IST</div>
              <div style={{ fontFamily:mono, fontSize:'9px', color:T3, marginTop:'8px' }}>BHARATMONITOR.ONLINE</div>
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(7,1fr)', gap:'8px', marginBottom:'16px' }}>
            <KPI label="TOTAL ITEMS"    value={stats.total}          color={T0}     />
            <KPI label="CRISIS"         value={stats.crisis}         color={RED}    />
            <KPI label="DEVELOPING"     value={stats.dev}            color={YELLOW} />
            <KPI label="POSITIVE"       value={`${stats.posPct}%`}   color={GREEN}  />
            <KPI label="NEGATIVE"       value={`${stats.negPct}%`}   color={RED}    />
            <KPI label="CONTRADICTIONS" value={contradictions.length} color={YELLOW} />
            <KPI label="COMPETITORS"    value={competitors.length}   color={PURPLE} />
          </div>

          {/* Table of contents */}
          <Card>
            <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'10px' }}>TABLE OF CONTENTS</div>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'4px 20px' }}>
              {[
                '01 — ACCOUNT PARAMETERS',
                '02 — EXECUTIVE SUMMARY',
                '03 — CRISIS SIGNALS',
                '04 — DEVELOPING STORIES',
                '05 — SENTIMENT ANALYSIS',
                '06 — KEYWORD PERFORMANCE',
                '07 — PLATFORM COVERAGE',
                '08 — TOP SOURCES',
                '09 — GEOGRAPHIC SIGNALS',
                '10 — TOPIC COVERAGE',
                '11 — AUDIENCE PERSONAS',
                '12 — SCHEME TRACKING',
                '13 — SENTIMENT TREND',
                '14 — CONSTITUENCY PULSE',
                '15 — AI INTELLIGENCE BRIEF',
                '16 — POSITIVE COVERAGE',
                '17 — NEGATIVE COVERAGE',
                '18 — KEYWORD COVERAGE GAPS',
                '19 — COMPETITOR INTELLIGENCE',
                '20 — AI CONTRADICTIONS',
              ].map(item => (
                <div key={item} style={{ fontFamily:mono, fontSize:'8px', color:T2, padding:'3px 0', borderBottom:`1px solid rgba(255,255,255,0.03)` }}>{item}</div>
              ))}
            </div>
          </Card>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 01 — ACCOUNT PARAMETERS
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
          {S('ACCOUNT PARAMETERS')}

          {/* Profile */}
          <Card style={{ marginBottom:'12px' }}>
            <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'10px' }}>POLITICIAN PROFILE</div>
            <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'10px' }}>
              {[
                { l:'FULL NAME',     v: account?.politician_name || '—' },
                { l:'INITIALS',      v: account?.politician_initials || '—' },
                { l:'PARTY',         v: account?.party || '—' },
                { l:'DESIGNATION',   v: account?.designation || '—' },
                { l:'SEAT TYPE',     v: account?.constituency_type || '—' },
                { l:'CONSTITUENCY',  v: account?.constituency || '—' },
                { l:'DISTRICT',      v: account?.district || '—' },
                { l:'STATE',         v: account?.state || '—' },
                { l:'CONTACT EMAIL', v: account?.contact_email || '—' },
              ].map(row => (
                <div key={row.l} style={{ padding:'8px 10px', background:CARD2, borderRadius:'6px' }}>
                  <div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginBottom:'3px' }}>{row.l}</div>
                  <div style={{ fontSize:'11px', color:T0, fontWeight:600 }}>{row.v}</div>
                </div>
              ))}
            </div>
          </Card>

          {/* Keywords */}
          <Card style={{ marginBottom:'12px' }}>
            <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'8px' }}>
              TRACKING KEYWORDS ({(account?.keywords||[]).length})
            </div>
            <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
              {(account?.keywords||[]).map((k:string) => <Tag key={k} text={k} color={ACC} />)}
              {!(account?.keywords||[]).length && <span style={{ fontFamily:mono, fontSize:'9px', color:T3 }}>No keywords configured</span>}
            </div>
          </Card>

          {/* Tracked items grid */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'8px' }}>
                MINISTRIES TRACKED ({(account?.tracked_ministries||[]).length})
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                {(account?.tracked_ministries||[]).map((m:any) => <Tag key={typeof m==='string'?m:m.name} text={typeof m==='string'?m:m.name} color={BLUE} />)}
                {!(account?.tracked_ministries||[]).length && <span style={{ fontFamily:mono, fontSize:'9px', color:T3 }}>None</span>}
              </div>
            </Card>
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'8px' }}>
                SCHEMES TRACKED ({(account?.tracked_schemes||[]).length})
              </div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                {(account?.tracked_schemes||[]).map((s:any) => <Tag key={typeof s==='string'?s:s.name} text={typeof s==='string'?s:s.name} color={GREEN} />)}
                {!(account?.tracked_schemes||[]).length && <span style={{ fontFamily:mono, fontSize:'9px', color:T3 }}>None</span>}
              </div>
            </Card>
          </div>

          {/* Social watchlist */}
          {(account?.tracked_parties||[]).length > 0 && (
            <Card style={{ marginBottom:'12px' }}>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'8px' }}>
                SOCIAL MEDIA WATCHLIST ({(account?.tracked_parties||[]).length} handles)
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(3,1fr)', gap:'6px' }}>
                {(account?.tracked_parties||[]).map((h:any,i:number) => (
                  <div key={i} style={{ padding:'6px 8px', background:CARD2, borderRadius:'5px' }}>
                    <div style={{ fontFamily:mono, fontSize:'8px', color: PLAT[h.platform]||T2 }}>{h.handle}</div>
                    <div style={{ fontFamily:mono, fontSize:'7px', color:T3 }}>{h.platform?.toUpperCase()} · {h.type}</div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Competitors configured */}
          {(account?.tracked_politicians||[]).length > 0 && (
            <Card style={{ marginBottom:'12px' }}>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'8px' }}>
                POLITICIANS TRACKED ({(account?.tracked_politicians||[]).length})
              </div>
              <div style={{ display:'grid', gridTemplateColumns:'repeat(2,1fr)', gap:'6px' }}>
                {(account?.tracked_politicians||[]).map((p:any,i:number) => (
                  <div key={i} style={{ padding:'6px 10px', background:CARD2, borderRadius:'5px', display:'flex', gap:'8px', alignItems:'center' }}>
                    <div style={{ width:'24px', height:'24px', borderRadius:'50%', background:ACC+'15', border:`1px solid ${ACC}30`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:mono, fontSize:'8px', color:ACC, flexShrink:0 }}>
                      {(p.name||'?').slice(0,2).toUpperCase()}
                    </div>
                    <div>
                      <div style={{ fontSize:'10px', color:T0, fontWeight:600 }}>{p.name}</div>
                      <div style={{ fontFamily:mono, fontSize:'7px', color:T3 }}>{p.party} · {p.role}</div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Geo scope + Languages */}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px' }}>
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'8px' }}>GEO SCOPE</div>
              <div style={{ fontSize:'11px', color:T0, marginBottom:'4px' }}>{(account?.geo_scope as any)?.level?.toUpperCase() || '—'}</div>
              <div style={{ fontFamily:mono, fontSize:'9px', color:T2 }}>{(account?.geo_scope as any)?.state || ''}</div>
              {(account?.geo_scope as any)?.cities?.length > 0 && (
                <div style={{ display:'flex', flexWrap:'wrap', gap:'3px', marginTop:'6px' }}>
                  {((account?.geo_scope as any)?.cities||[]).map((c:string) => <Tag key={c} text={c} />)}
                </div>
              )}
            </Card>
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'8px' }}>LANGUAGES TRACKED</div>
              <div style={{ display:'flex', flexWrap:'wrap', gap:'4px' }}>
                {(account?.languages||[]).map((l:string) => <Tag key={l} text={l.toUpperCase()} color={BLUE} />)}
                {!(account?.languages||[]).length && <span style={{ fontFamily:mono, fontSize:'9px', color:T3 }}>Not configured</span>}
              </div>
            </Card>
          </div>
        </div>

        <PageBreak />

        {/* ══════════════════════════════════════════════════════════════
            SECTION 02 — EXECUTIVE SUMMARY
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
          {S('EXECUTIVE SUMMARY')}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'8px' }}>SITUATION</div>
              <div style={{ fontSize:'12px', color:T2, lineHeight:1.7 }}>
                {stats.total} items monitored across {stats.sortedPlats.length} platforms.
                {stats.crisis>0 ? ` ⚡ ${stats.crisis} crisis signal${stats.crisis>1?'s':''} active.` : ' No active crisis signals.'}
                {stats.posPct>50 ? ' Overall sentiment broadly positive.' : stats.negPct>30 ? ' Elevated negative sentiment requires attention.' : ' Sentiment is neutral.'}
                {` ${stats.dev} developing stories under watch.`}
              </div>
            </Card>
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'8px' }}>AI ASSESSMENT</div>
              <div style={{ fontSize:'12px', color:T2, lineHeight:1.7 }}>
                {aiBrief?.situation_summary || analysis?.summary || 'Intelligence brief not yet generated. Trigger an ingest from the dashboard.'}
              </div>
            </Card>
          </div>
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
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 03 — CRISIS SIGNALS
        ══════════════════════════════════════════════════════════════ */}
        {stats.crisisItems.length > 0 && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('CRISIS SIGNALS', RED)}
            <Card style={{ borderLeft:`3px solid ${RED}` }}>
              {stats.crisisItems.map((item,i) => <FeedItem key={item.id||i} item={item} />)}
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 04 — DEVELOPING STORIES
        ══════════════════════════════════════════════════════════════ */}
        {stats.devItems.length > 0 && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('DEVELOPING STORIES', YELLOW)}
            <Card style={{ borderLeft:`3px solid ${YELLOW}` }}>
              {stats.devItems.map((item,i) => <FeedItem key={item.id||i} item={item} />)}
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 05 — SENTIMENT ANALYSIS
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
          {S('SENTIMENT ANALYSIS')}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'12px' }}>
            <KPI label="POSITIVE"    value={stats.pos}         color={GREEN}  />
            <KPI label="NEGATIVE"    value={stats.neg}         color={RED}    />
            <KPI label="NEUTRAL"     value={stats.neu}         color={T2}     />
            <KPI label="CRISIS ITEMS" value={stats.crisis}    color={RED}    />
          </div>
          {trendPoints.length > 1 && (
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'10px' }}>SENTIMENT TREND — LAST 7 DAYS</div>
              <div style={{ display:'flex', alignItems:'flex-end', gap:'4px', height:'80px' }}>
                {trendPoints.map((p:any,i:number) => {
                  const max = Math.max(...trendPoints.map((x:any)=>x.value), 1)
                  const h = Math.round((p.value/max)*70)
                  const c = p.value>=60?GREEN:p.value<=40?RED:YELLOW
                  return (
                    <div key={i} style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:'4px' }}>
                      <div style={{ width:'100%', height:`${h}px`, background:c, borderRadius:'3px 3px 0 0', minHeight:'4px', opacity:0.8 }} />
                      <span style={{ fontFamily:mono, fontSize:'7px', color:T3 }}>{p.date?.substring(5)||''}</span>
                    </div>
                  )
                })}
              </div>
            </Card>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 06 — KEYWORD PERFORMANCE
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
          {S('KEYWORD PERFORMANCE')}
          <Card>
            {stats.sortedKw.length > 0
              ? stats.sortedKw.map(([kw, d]) => (
                  <div key={kw} style={{ padding:'6px 0', borderBottom:`1px solid rgba(255,255,255,0.04)`, display:'flex', alignItems:'center', gap:'10px' }}>
                    <span style={{ fontFamily:mono, fontSize:'9px', color:T1, width:'160px', flexShrink:0, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{kw}</span>
                    <div style={{ flex:1, height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'2px', overflow:'hidden' }}>
                      <div style={{ width:`${Math.min((d.total/Math.max(stats.sortedKw[0]?.[1]?.total||1,1))*100,100)}%`, height:'100%', background:d.crisis>0?RED:d.neg>d.pos?YELLOW:GREEN, borderRadius:'2px' }} />
                    </div>
                    <span style={{ fontFamily:mono, fontSize:'9px', color:T0, minWidth:'28px', textAlign:'right' }}>{d.total}</span>
                    <span style={{ fontFamily:mono, fontSize:'8px', color:GREEN, minWidth:'30px', textAlign:'right' }}>+{d.pos}</span>
                    <span style={{ fontFamily:mono, fontSize:'8px', color:RED, minWidth:'30px', textAlign:'right' }}>-{d.neg}</span>
                    {d.crisis>0 && <span style={{ fontFamily:mono, fontSize:'7px', color:RED, background:RED+'15', padding:'1px 5px', borderRadius:'3px' }}>⚡{d.crisis}</span>}
                  </div>
                ))
              : <div style={{ fontFamily:mono, fontSize:'9px', color:T3, textAlign:'center', padding:'24px' }}>No keyword data yet</div>
            }
          </Card>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 07 — PLATFORM COVERAGE
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
          {S('PLATFORM COVERAGE')}
          <Card>
            {stats.sortedPlats.map(([p,n]) => (
              <Bar key={p} label={p.toUpperCase()} value={n} max={stats.sortedPlats[0]?.[1]||1} color={PLAT[p]||T2} />
            ))}
          </Card>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 08 — TOP SOURCES
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
          {S('TOP SOURCES')}
          <Card>
            {stats.sortedSources.map(([s,n]) => (
              <Bar key={s} label={s} value={n} max={stats.sortedSources[0]?.[1]||1} color={ACC} />
            ))}
          </Card>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 09 — GEOGRAPHIC SIGNALS
        ══════════════════════════════════════════════════════════════ */}
        {stats.sortedGeo.length > 0 && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('GEOGRAPHIC SIGNALS')}
            <Card>
              {stats.sortedGeo.map(([g,n]) => {
                const geoFeed = feed.filter(f=>(f.geo_tags||[]).includes(g))
                const pos = geoFeed.filter(f=>f.sentiment==='positive').length
                const score = Math.round((pos/Math.max(geoFeed.length,1))*100)
                const c = score>=60?GREEN:score<=40?RED:YELLOW
                return <Bar key={g} label={g} value={n} max={stats.sortedGeo[0]?.[1]||1} color={BLUE} sub={`${score}%`} />
              })}
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 10 — TOPIC COVERAGE
        ══════════════════════════════════════════════════════════════ */}
        {stats.sortedTopics.length > 0 && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('TOPIC COVERAGE')}
            <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'8px' }}>
              {stats.sortedTopics.map(([t,n]) => (
                <Card key={t} style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:mono, fontSize:'18px', fontWeight:700, color:ACC }}>{n}</div>
                  <div style={{ fontFamily:mono, fontSize:'9px', color:T2, marginTop:'3px' }}>{t}</div>
                </Card>
              ))}
            </div>
          </div>
        )}

        <PageBreak />

        {/* ══════════════════════════════════════════════════════════════
            SECTION 11 — AUDIENCE PERSONAS
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
          {S('AUDIENCE PERSONAS')}
          <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'12px' }}>
            {personaStats.map(p => (
              <div key={p.id} style={{ background:CARD, border:`1px solid ${p.color}25`, borderRadius:'8px', padding:'12px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'6px' }}>
                  <span>{p.icon}</span>
                  <span style={{ fontSize:'10px', fontWeight:600, color:T0 }}>{p.label}</span>
                </div>
                <div style={{ fontFamily:mono, fontSize:'16px', fontWeight:700, color:p.color, marginBottom:'4px' }}>{p.score}%</div>
                <div style={{ fontFamily:mono, fontSize:'8px', color:T3, marginBottom:'4px' }}>{p.count} mentions</div>
                <div style={{ height:'3px', background:'rgba(255,255,255,0.06)', borderRadius:'2px', overflow:'hidden' }}>
                  <div style={{ width:`${Math.min((p.count/Math.max(personaStats[0]?.count||1,1))*100,100)}%`, height:'100%', background:p.color, borderRadius:'2px' }} />
                </div>
                <div style={{ display:'flex', gap:'6px', marginTop:'4px' }}>
                  <span style={{ fontFamily:mono, fontSize:'7px', color:GREEN }}>+{p.pos}</span>
                  <span style={{ fontFamily:mono, fontSize:'7px', color:RED }}>-{p.neg}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════
            SECTION 12 — SCHEME TRACKING
        ══════════════════════════════════════════════════════════════ */}
        {schemes.length > 0 && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('SCHEME TRACKING')}
            <Card>
              {schemes.map((s:any) => (
                <div key={s.scheme_name} style={{ padding:'7px 0', borderBottom:`1px solid rgba(255,255,255,0.04)`, display:'flex', alignItems:'center', gap:'12px' }}>
                  <span style={{ fontFamily:mono, fontSize:'9px', color:T1, flex:1 }}>{s.scheme_name}</span>
                  <div style={{ width:'120px', height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'2px', overflow:'hidden' }}>
                    <div style={{ width:`${s.sentiment_score}%`, height:'100%', background:s.sentiment_score>=60?GREEN:s.sentiment_score<=40?RED:YELLOW, borderRadius:'2px' }} />
                  </div>
                  <span style={{ fontFamily:mono, fontSize:'9px', color:T2, minWidth:'32px', textAlign:'right' }}>{s.sentiment_score}%</span>
                  <span style={{ fontFamily:mono, fontSize:'8px', color:T3, minWidth:'32px', textAlign:'right' }}>{s.mention_count} items</span>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 13 — SENTIMENT TREND
        ══════════════════════════════════════════════════════════════ */}
        {trendPoints.length > 0 && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('SENTIMENT TREND — 7-DAY DETAIL')}
            <Card>
              <div style={{ display:'grid', gridTemplateColumns:`repeat(${trendPoints.length},1fr)`, gap:'8px' }}>
                {trendPoints.map((p:any,i:number) => {
                  const c = p.value>=60?GREEN:p.value<=40?RED:YELLOW
                  const delta = i>0 ? p.value - trendPoints[i-1].value : 0
                  return (
                    <div key={i} style={{ textAlign:'center', padding:'10px 6px', background:CARD2, borderRadius:'6px' }}>
                      <div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginBottom:'4px' }}>{p.date}</div>
                      <div style={{ fontFamily:mono, fontSize:'16px', fontWeight:700, color:c }}>{p.value}</div>
                      {delta!==0 && <div style={{ fontFamily:mono, fontSize:'8px', color:delta>0?GREEN:RED }}>{delta>0?'+':''}{delta}</div>}
                    </div>
                  )
                })}
              </div>
              {trends[0] && (
                <div style={{ display:'flex', gap:'16px', marginTop:'12px', padding:'10px', background:CARD2, borderRadius:'6px' }}>
                  <div><div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginBottom:'2px' }}>CURRENT</div><div style={{ fontFamily:mono, fontSize:'14px', color:T0, fontWeight:700 }}>{trends[0].current_value}</div></div>
                  <div><div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginBottom:'2px' }}>7-DAY DELTA</div><div style={{ fontFamily:mono, fontSize:'14px', color:trends[0].delta_7d>=0?GREEN:RED, fontWeight:700 }}>{trends[0].delta_7d>=0?'+':''}{trends[0].delta_7d}</div></div>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 14 — CONSTITUENCY PULSE
        ══════════════════════════════════════════════════════════════ */}
        {pulse && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('CONSTITUENCY PULSE')}
            <div style={{ display:'grid', gridTemplateColumns:'auto 1fr', gap:'12px' }}>
              <Card style={{ textAlign:'center', minWidth:'120px' }}>
                <div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginBottom:'4px' }}>OVERALL SENTIMENT</div>
                <div style={{ fontFamily:mono, fontSize:'32px', fontWeight:700, color:pulse.overall_sentiment>=60?GREEN:pulse.overall_sentiment<=40?RED:YELLOW }}>{pulse.overall_sentiment}%</div>
                <div style={{ fontFamily:mono, fontSize:'8px', color:T2, marginTop:'4px' }}>{pulse.constituency}</div>
                <div style={{ fontFamily:mono, fontSize:'7px', color:T3 }}>{pulse.state}</div>
              </Card>
              <Card>
                <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'10px' }}>ISSUE BREAKDOWN</div>
                {pulse.issues.map((issue:any) => {
                  const c = issue.sentiment==='positive'?GREEN:issue.sentiment==='negative'?RED:YELLOW
                  return (
                    <div key={issue.topic} style={{ display:'flex', alignItems:'center', gap:'10px', padding:'4px 0', borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
                      <span style={{ fontFamily:mono, fontSize:'9px', color:T1, width:'140px', flexShrink:0 }}>{issue.topic}</span>
                      <div style={{ flex:1, height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'2px', overflow:'hidden' }}>
                        <div style={{ width:`${issue.volume_pct}%`, height:'100%', background:c, borderRadius:'2px' }} />
                      </div>
                      <span style={{ fontFamily:mono, fontSize:'8px', color:c, minWidth:'60px', textAlign:'right' }}>{issue.sentiment?.toUpperCase()}</span>
                    </div>
                  )
                })}
              </Card>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 15 — AI INTELLIGENCE BRIEF
        ══════════════════════════════════════════════════════════════ */}
        <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
          {S('AI INTELLIGENCE BRIEF', BLUE)}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'12px', marginBottom:'12px' }}>
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:BLUE, letterSpacing:'1px', marginBottom:'8px' }}>SITUATION SUMMARY</div>
              <div style={{ fontSize:'12px', color:T1, lineHeight:1.7 }}>
                {aiBrief?.situation_summary || analysis?.summary || 'Brief not yet generated. Click Generate on the Analyse page.'}
              </div>
            </Card>
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:PURPLE, letterSpacing:'1px', marginBottom:'8px' }}>PATTERN ANALYSIS</div>
              <div style={{ fontSize:'12px', color:T1, lineHeight:1.7 }}>
                {aiBrief?.pattern_analysis || analysis?.opposition_activity || 'No pattern data yet.'}
              </div>
            </Card>
          </div>
          {/* Top narratives from AI analysis */}
          {analysis?.top_narratives?.length > 0 && (
            <Card>
              <div style={{ fontFamily:mono, fontSize:'8px', color:T3, letterSpacing:'1px', marginBottom:'10px' }}>TOP NARRATIVES</div>
              {(analysis.top_narratives||[]).slice(0,5).map((n:string,i:number) => (
                <div key={i} style={{ display:'flex', gap:'8px', padding:'6px 0', borderBottom:`1px solid rgba(255,255,255,0.04)` }}>
                  <span style={{ fontFamily:mono, fontSize:'9px', color:ACC, flexShrink:0 }}>{i+1}.</span>
                  <span style={{ fontSize:'11px', color:T1, lineHeight:1.6 }}>{n}</span>
                </div>
              ))}
            </Card>
          )}
        </div>

        <PageBreak />

        {/* ══════════════════════════════════════════════════════════════
            SECTION 16 — POSITIVE COVERAGE
        ══════════════════════════════════════════════════════════════ */}
        {stats.posItems.length > 0 && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('POSITIVE COVERAGE', GREEN)}
            <Card style={{ borderLeft:`3px solid ${GREEN}` }}>
              {stats.posItems.map((item,i) => <FeedItem key={item.id||i} item={item} />)}
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 17 — NEGATIVE COVERAGE
        ══════════════════════════════════════════════════════════════ */}
        {stats.negItems.length > 0 && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('NEGATIVE COVERAGE — MONITOR', RED)}
            <Card style={{ borderLeft:`3px solid ${RED}` }}>
              {stats.negItems.map((item,i) => <FeedItem key={item.id||i} item={item} />)}
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 18 — KEYWORD COVERAGE GAPS
        ══════════════════════════════════════════════════════════════ */}
        {kwGaps.length > 0 && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('KEYWORD COVERAGE GAPS', YELLOW)}
            <Card>
              {kwGaps.map(g => (
                <div key={g.kw} style={{ padding:'7px 10px', marginBottom:'6px', background:g.gap?RED+'08':CARD2, border:`1px solid ${g.gap?RED+'25':BORDER}`, borderRadius:'6px', display:'flex', alignItems:'center', gap:'10px' }}>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'11px', color:T0, marginBottom:'2px' }}>{g.kw}</div>
                    <div style={{ fontFamily:mono, fontSize:'8px', color:T3 }}>{g.count} items · {g.posPct}% positive</div>
                  </div>
                  {g.gap && <span style={{ fontFamily:mono, fontSize:'7px', padding:'2px 6px', borderRadius:'3px', background:RED+'12', color:RED, border:`1px solid ${RED}25` }}>COVERAGE GAP</span>}
                  <div style={{ fontFamily:mono, fontSize:'14px', color:g.count>5?GREEN:g.count>0?YELLOW:RED, fontWeight:600 }}>{g.count}</div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 19 — COMPETITOR INTELLIGENCE
        ══════════════════════════════════════════════════════════════ */}
        {competitors.length > 0 && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('COMPETITOR INTELLIGENCE', PURPLE)}
            {(competitors as any[]).map((c:any) => {
              const lastName = c.politician.name.split(' ').slice(-1)[0].toLowerCase()
              const cf = feed.filter(f=>f.headline.toLowerCase().includes(lastName))
              const pos = cf.filter(f=>f.sentiment==='positive').length
              const neg = cf.filter(f=>f.sentiment==='negative').length
              const score = Math.round(50 + ((pos-neg)/Math.max(cf.length,1))*50)
              return (
                <Card key={c.politician.id||c.politician.name} style={{ marginBottom:'12px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:'12px', marginBottom:'10px' }}>
                    <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:ACC+'15', border:`1px solid ${ACC}30`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:mono, fontSize:'10px', color:ACC, fontWeight:700, flexShrink:0 }}>
                      {c.politician.initials || c.politician.name.slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:'13px', fontWeight:600, color:T0 }}>{c.politician.name}</div>
                      <div style={{ fontFamily:mono, fontSize:'9px', color:T3 }}>{c.politician.party} · {c.politician.role}</div>
                    </div>
                    <div style={{ textAlign:'right' }}>
                      <div style={{ fontFamily:mono, fontSize:'20px', fontWeight:700, color:score>=55?GREEN:score<=45?RED:YELLOW }}>{score}%</div>
                      <div style={{ fontFamily:mono, fontSize:'8px', color:T3 }}>sentiment score · {cf.length} mentions</div>
                    </div>
                  </div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'6px', marginBottom:'10px' }}>
                    {[{l:'TOTAL',v:cf.length,c:T0},{l:'POSITIVE',v:pos,c:GREEN},{l:'NEGATIVE',v:neg,c:RED},{l:'CRISIS',v:cf.filter(f=>f.bucket==='red').length,c:RED}].map(k=>(
                      <div key={k.l} style={{ textAlign:'center', padding:'6px', background:CARD2, borderRadius:'5px' }}>
                        <div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginBottom:'2px' }}>{k.l}</div>
                        <div style={{ fontFamily:mono, fontSize:'14px', fontWeight:700, color:k.c }}>{k.v}</div>
                      </div>
                    ))}
                  </div>
                  {cf.slice(0,3).map((item,i) => <FeedItem key={item.id||i} item={item} />)}
                </Card>
              )
            })}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════
            SECTION 20 — AI CONTRADICTIONS
        ══════════════════════════════════════════════════════════════ */}
        {contradictions.length > 0 && (
          <div style={{ marginBottom:'32px', pageBreakInside:'avoid' }}>
            {S('AI CONTRADICTION INTELLIGENCE', YELLOW)}
            {(contradictions as any[]).slice(0,8).map((c:any) => (
              <Card key={c.id} style={{ marginBottom:'10px', borderLeft:`3px solid ${YELLOW}` }}>
                <div style={{ display:'flex', alignItems:'center', gap:'8px', marginBottom:'8px' }}>
                  <span style={{ fontFamily:mono, fontSize:'9px', color:YELLOW, fontWeight:700 }}>
                    {(c.contradiction_type||'').toUpperCase().replace(/_/g,' ')} · {c.contradiction_score}%
                  </span>
                  <span style={{ fontFamily:mono, fontSize:'9px', color:T3, marginLeft:'auto' }}>{c.politician_name}</span>
                </div>
                {c.historical_quote && (
                  <div style={{ background:CARD2, borderRadius:'6px', padding:'8px 10px', marginBottom:'8px' }}>
                    <div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginBottom:'3px' }}>HISTORICAL · {c.historical_date?.substring?.(0,7)} · {c.historical_source}</div>
                    <div style={{ fontSize:'10px', color:T1, lineHeight:1.6 }}>"{(c.historical_quote||'').substring(0,150)}{c.historical_quote?.length>150?'…':''}"</div>
                  </div>
                )}
                {c.current_quote && (
                  <div style={{ background:RED+'08', border:`1px solid ${RED}20`, borderRadius:'6px', padding:'8px 10px', marginBottom:'8px' }}>
                    <div style={{ fontFamily:mono, fontSize:'7px', color:RED, marginBottom:'3px' }}>CURRENT POSITION</div>
                    <div style={{ fontSize:'10px', color:T1, lineHeight:1.6 }}>"{(c.current_quote||'').substring(0,150)}{c.current_quote?.length>150?'…':''}"</div>
                  </div>
                )}
                {c.reasoning && <div style={{ fontFamily:mono, fontSize:'8px', color:T3 }}>AI: {c.reasoning}</div>}
              </Card>
            ))}
          </div>
        )}

        {/* ── Footer ── */}
        <div style={{ borderTop:`1px solid ${BORDER}`, paddingTop:'20px', display:'flex', justifyContent:'space-between', marginTop:'40px' }}>
          <div style={{ fontFamily:mono, fontSize:'8px', color:T3 }}>BHARATMONITOR v2.0 · POLITICAL INTELLIGENCE PLATFORM · CONFIDENTIAL</div>
          <div style={{ fontFamily:mono, fontSize:'8px', color:T3 }}>Generated {generated} IST · {account?.politician_name || accountId}</div>
        </div>

      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; color-adjust: exact !important; }
          body { background: #0d1018 !important; }
          @page { margin: 10mm; size: A4; background: #0d1018; }
        }
      `}</style>
    </div>
  )
}
