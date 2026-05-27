// BharatMonitor — Opposition Research Terminal
// PATCHED: VDS quick targets added, sources_used display added

import { useState } from 'react'
import { useAccount } from '@/hooks/useData'
import NavBar from '@/components/layout/NavBar'
import { SUPABASE_URL, ANON_KEY, SERVICE_KEY } from '@/lib/supabase'

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

// ─── QUICK TARGETS ───────────────────────────────────────────────────────────
// Grouped: VDS-specific first, then national targets
const QUICK_TARGETS_VDS = [
  { politician: 'Vishnu Deo Sai',  topic: 'Mahtari Vandan Yojana',    label: 'VDS × Mahtari Vandan' },
  { politician: 'Vishnu Deo Sai',  topic: 'Naxal Bastar security',    label: 'VDS × Naxal/Bastar' },
  { politician: 'Vishnu Deo Sai',  topic: 'tribal land rights',        label: 'VDS × Tribal Land' },
  { politician: 'Vishnu Deo Sai',  topic: 'coal mining Chhattisgarh', label: 'VDS × Coal/Mining' },
  { politician: 'Vishnu Deo Sai',  topic: 'BJP election promises 2023',label: 'VDS × Promises' },
  { politician: 'Vishnu Deo Sai',  topic: 'development Chhattisgarh', label: 'VDS × Development' },
  { politician: 'Bhupesh Baghel',  topic: 'corruption scam',           label: 'Baghel × Corruption' },
  { politician: 'Bhupesh Baghel',  topic: 'Mahadev betting app',       label: 'Baghel × Mahadev' },
  { politician: 'Bhupesh Baghel',  topic: 'governance Chhattisgarh',   label: 'Baghel × Governance' },
]

const QUICK_TARGETS_NATIONAL = [
  { politician: 'Rahul Gandhi',    topic: 'privatisation',             label: 'RG × Privatisation' },
  { politician: 'Rahul Gandhi',    topic: 'farmers protest',           label: 'RG × Farmers' },
  { politician: 'Arvind Kejriwal', topic: 'corruption',                label: 'AK × Corruption' },
  { politician: 'Narendra Modi',   topic: 'China',                     label: 'NM × China' },
  { politician: 'Narendra Modi',   topic: 'inflation',                 label: 'NM × Inflation' },
  { politician: 'Amit Shah',       topic: 'NRC CAA',                   label: 'AS × NRC/CAA' },
]

const FLIP_COLORS: Record<string, string> = {
  complete_reversal: RED,
  partial_shift:     YELLOW,
  contextual_shift:  ACC,
  promise_broken:    PURPLE,
}

const FLIP_LABELS: Record<string, string> = {
  complete_reversal: 'COMPLETE REVERSAL',
  partial_shift:     'PARTIAL SHIFT',
  contextual_shift:  'CONTEXT SHIFT',
  promise_broken:    'BROKEN PROMISE',
}

interface Contradiction {
  title: string
  earlier_position: string
  later_position: string
  flip_type: string
  severity: string
  political_context: string
  best_attack_angle: string
  best_defense_angle: string
}

interface ResearchResult {
  ok: boolean
  politician: string
  topic: string
  searchedAt: string
  totalSources: number
  sources_used?: { newsapi: number; gdelt: number; gdelt_variants: number; bm_feed: number }
  statements: { title: string; snippet: string; source: string; url: string; date: string; sentiment: string }[]
  analysis: {
    summary: string
    overallConsistency: number
    contradictions: Contradiction[]
    keyStatements: { quote: string; date: string; significance: string; sentiment_toward_topic: string }[]
    strategicAssessment: string
    vulnerabilityScore: number
  } | null
  stats: {
    totalStatements: number
    contradictionsFound: number
    vulnerabilityScore: number
    consistencyScore: number
    dateRange: string
  }
}

function ConsistencyMeter({ score }: { score: number }) {
  const color = score >= 70 ? GREEN : score >= 40 ? YELLOW : RED
  const label = score >= 70 ? 'CONSISTENT' : score >= 40 ? 'MIXED' : 'INCONSISTENT'
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>CONSISTENCY</span>
        <span style={{ fontFamily: mono, fontSize: '9px', fontWeight: 700, color }}>{score}% {label}</span>
      </div>
      <div style={{ height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: '3px', transition: 'width 1s ease' }} />
      </div>
    </div>
  )
}

function ContradictionCard({ c, index }: { c: Contradiction; index: number }) {
  const [expanded, setExpanded] = useState(index === 0)
  const fc = FLIP_COLORS[c.flip_type] || ACC
  const sevColor = c.severity === 'critical' ? RED : c.severity === 'high' ? YELLOW : c.severity === 'medium' ? ACC : GREEN

  return (
    <div style={{ background: CARD, border: `1px solid ${fc}30`, borderLeft: `3px solid ${fc}`, borderRadius: '10px', overflow: 'hidden' }}>
      <div onClick={() => setExpanded(e => !e)} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: fc + '18', border: `1px solid ${fc}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '11px', fontWeight: 700, color: fc, flexShrink: 0 }}>
          {index + 1}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', gap: '6px', marginBottom: '3px', alignItems: 'center' }}>
            <span style={{ fontFamily: mono, fontSize: '7px', color: fc, background: fc + '12', padding: '1px 6px', borderRadius: '3px', letterSpacing: '0.5px' }}>
              {FLIP_LABELS[c.flip_type] || c.flip_type}
            </span>
            <span style={{ fontFamily: mono, fontSize: '7px', color: sevColor, background: sevColor + '10', padding: '1px 6px', borderRadius: '3px' }}>
              {c.severity?.toUpperCase()}
            </span>
          </div>
          <div style={{ fontSize: '12px', fontWeight: 600, color: T0 }}>{c.title}</div>
        </div>
        <span style={{ fontFamily: mono, fontSize: '10px', color: T3, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '14px 16px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '12px' }}>
            <div style={{ background: GREEN + '08', border: `1px solid ${GREEN}20`, borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: GREEN, letterSpacing: '1px', marginBottom: '6px' }}>EARLIER POSITION</div>
              <div style={{ fontSize: '11px', color: T1, lineHeight: 1.6 }}>{c.earlier_position}</div>
            </div>
            <div style={{ background: RED + '08', border: `1px solid ${RED}20`, borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: RED, letterSpacing: '1px', marginBottom: '6px' }}>CURRENT POSITION</div>
              <div style={{ fontSize: '11px', color: T1, lineHeight: 1.6 }}>{c.later_position}</div>
            </div>
          </div>
          <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginBottom: '5px' }}>POLITICAL CONTEXT</div>
          <div style={{ fontSize: '11px', color: T2, lineHeight: 1.6, marginBottom: '12px' }}>{c.political_context}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div style={{ background: RED + '06', border: `1px solid ${RED}15`, borderRadius: '7px', padding: '10px 12px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: RED, letterSpacing: '1px', marginBottom: '5px' }}>⚔ ATTACK ANGLE</div>
              <div style={{ fontSize: '10px', color: T1, lineHeight: 1.5 }}>{c.best_attack_angle}</div>
            </div>
            <div style={{ background: GREEN + '06', border: `1px solid ${GREEN}15`, borderRadius: '7px', padding: '10px 12px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: GREEN, letterSpacing: '1px', marginBottom: '5px' }}>🛡 DEFENSE ANGLE</div>
              <div style={{ fontSize: '10px', color: T1, lineHeight: 1.5 }}>{c.best_defense_angle}</div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default function OppositionResearchPage() {
  const { data: account } = useAccount()

  const [politician, setPolitician] = useState('')
  const [topic, setTopic]           = useState('')
  const [yearsBack, setYearsBack]   = useState(10)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [result, setResult]         = useState<ResearchResult | null>(null)
  const [activeTab, setActiveTab]   = useState<'overview' | 'contradictions' | 'statements' | 'strategy'>('overview')
  const [history, setHistory]       = useState<{ politician: string; topic: string }[]>([])
  const [quickGroup, setQuickGroup] = useState<'vds' | 'national'>('vds')

  async function runResearch(pol?: string, top?: string) {
    const p = pol || politician, t = top || topic
    if (!p.trim() || !t.trim()) return
    setLoading(true)
    setError('')
    setResult(null)
    try {
      const authKey = SERVICE_KEY || ANON_KEY
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bm-opposition-research`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authKey}`, 'apikey': ANON_KEY },
        body: JSON.stringify({ politician: p, topic: t, accountId: account?.id || 'god-account', yearsBack }),
        signal: AbortSignal.timeout(60_000),
      })
      const data = await res.json()
      if (data.ok) {
        setResult(data)
        setHistory(h => [{ politician: p, topic: t }, ...h.filter(x => !(x.politician === p && x.topic === t))].slice(0, 8))
        setActiveTab('overview')
      } else {
        setError(data.error || 'Research failed')
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  const vulnColor = result
    ? result.stats.vulnerabilityScore >= 70 ? RED
    : result.stats.vulnerabilityScore >= 40 ? YELLOW
    : GREEN
    : T2

  const activeQuickTargets = quickGroup === 'vds' ? QUICK_TARGETS_VDS : QUICK_TARGETS_NATIONAL

  return (
    <div style={{ minHeight: '100vh', background: DARK }}>
      <NavBar />

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '2px', marginBottom: '6px' }}>POLITICAL INTELLIGENCE</div>
          <div style={{ fontSize: '20px', fontWeight: 700, color: T0 }}>Opposition Research Terminal</div>
          <div style={{ fontFamily: mono, fontSize: '9px', color: T2, marginTop: '4px' }}>
            Search any politician × any topic · 10-year historical record · Gemini contradiction analysis · Attack/defense mapping
          </div>
        </div>

        {/* Search bar */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '14px', padding: '20px 22px', marginBottom: '20px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '10px', alignItems: 'end', marginBottom: '14px' }}>
            <div>
              <div style={{ fontFamily: mono, fontSize: '7px', color: T3, letterSpacing: '1px', marginBottom: '5px' }}>POLITICIAN</div>
              <input value={politician} onChange={e => setPolitician(e.target.value)} onKeyDown={e => e.key === 'Enter' && runResearch()}
                placeholder="e.g. Vishnu Deo Sai"
                style={{ width: '100%', padding: '9px 12px', background: CARD2, border: `1px solid ${BORDER}`, borderRadius: '7px', color: T0, fontFamily: mono, fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontFamily: mono, fontSize: '7px', color: T3, letterSpacing: '1px', marginBottom: '5px' }}>TOPIC / ISSUE</div>
              <input value={topic} onChange={e => setTopic(e.target.value)} onKeyDown={e => e.key === 'Enter' && runResearch()}
                placeholder="e.g. Naxal, tribal land, Mahtari Vandan"
                style={{ width: '100%', padding: '9px 12px', background: CARD2, border: `1px solid ${BORDER}`, borderRadius: '7px', color: T0, fontFamily: mono, fontSize: '11px', outline: 'none', boxSizing: 'border-box' }} />
            </div>
            <div>
              <div style={{ fontFamily: mono, fontSize: '7px', color: T3, letterSpacing: '1px', marginBottom: '5px' }}>YEARS BACK</div>
              <select value={yearsBack} onChange={e => setYearsBack(+e.target.value)}
                style={{ padding: '9px 12px', background: CARD2, border: `1px solid ${BORDER}`, borderRadius: '7px', color: T1, fontFamily: mono, fontSize: '10px', cursor: 'pointer' }}>
                {[3, 5, 7, 10, 12].map(y => <option key={y} value={y}>{y} years</option>)}
              </select>
            </div>
            <button onClick={() => runResearch()} disabled={loading || !politician || !topic}
              style={{ padding: '10px 22px', background: loading ? CARD2 : RED + '18', border: `1px solid ${loading ? BORDER : RED + '50'}`, borderRadius: '8px', color: loading ? T2 : RED, fontFamily: mono, fontSize: '9px', fontWeight: 700, cursor: loading || !politician || !topic ? 'not-allowed' : 'pointer', whiteSpace: 'nowrap', height: '38px' }}>
              {loading ? '⚙ RESEARCHING…' : '⚔ RESEARCH'}
            </button>
          </div>

          {/* Quick targets with group toggle */}
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: T3, letterSpacing: '1px' }}>QUICK TARGETS</div>
              <div style={{ display: 'flex', gap: '2px' }}>
                {(['vds', 'national'] as const).map(g => (
                  <button key={g} onClick={() => setQuickGroup(g)}
                    style={{ padding: '2px 8px', borderRadius: '4px', border: `1px solid ${quickGroup === g ? ACC + '60' : BORDER}`, background: quickGroup === g ? ACC + '12' : 'transparent', color: quickGroup === g ? ACC : T3, fontFamily: mono, fontSize: '7px', cursor: 'pointer' }}>
                    {g === 'vds' ? 'CHHATTISGARH' : 'NATIONAL'}
                  </button>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
              {activeQuickTargets.map(qt => (
                <button key={qt.label}
                  onClick={() => { setPolitician(qt.politician); setTopic(qt.topic); runResearch(qt.politician, qt.topic) }}
                  style={{ padding: '4px 10px', borderRadius: '20px', border: `1px solid ${BORDER}`, background: 'transparent', color: T2, fontFamily: mono, fontSize: '8px', cursor: 'pointer', transition: 'all .15s' }}
                  onMouseEnter={e => { (e.target as HTMLElement).style.borderColor = RED; (e.target as HTMLElement).style.color = RED }}
                  onMouseLeave={e => { (e.target as HTMLElement).style.borderColor = BORDER; (e.target as HTMLElement).style.color = T2 }}>
                  {qt.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && (
          <div style={{ background: RED + '10', border: `1px solid ${RED}30`, borderRadius: '8px', padding: '12px 16px', marginBottom: '16px', fontFamily: mono, fontSize: '9px', color: RED }}>
            ⚠ {error}
          </div>
        )}

        {loading && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '56px', textAlign: 'center' }}>
            <div style={{ fontFamily: mono, fontSize: '10px', color: RED, marginBottom: '12px' }}>⚙ RESEARCHING {politician.toUpperCase()} × {topic.toUpperCase()}…</div>
            <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 2.2 }}>
              Searching NewsAPI full-text index…<br />
              Pulling GDELT document archive…<br />
              Searching BharatMonitor feed database…<br />
              Running Gemini contradiction analysis…<br />
              Mapping attack/defense angles…
            </div>
          </div>
        )}

        {!result && !loading && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '56px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>⚔️</div>
            <div style={{ fontFamily: mono, fontSize: '11px', color: T1, marginBottom: '10px' }}>OPPOSITION RESEARCH TERMINAL</div>
            <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 2.2, maxWidth: '540px', margin: '0 auto' }}>
              Enter any politician and topic above, or click a Quick Target.<br />
              The system searches NewsAPI (full article body), GDELT document archive,<br />
              and BharatMonitor's live feed — then runs Gemini AI to find<br />
              contradictions, broken promises, and position shifts.<br /><br />
              Returns: statements timeline · contradiction dossier · vulnerability score<br />
              attack angles · defense angles · strategic assessment
            </div>
            {history.length > 0 && (
              <div style={{ marginTop: '24px' }}>
                <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginBottom: '8px' }}>RECENT SEARCHES</div>
                <div style={{ display: 'flex', gap: '6px', justifyContent: 'center', flexWrap: 'wrap' }}>
                  {history.map((h, i) => (
                    <button key={i} onClick={() => { setPolitician(h.politician); setTopic(h.topic); runResearch(h.politician, h.topic) }}
                      style={{ padding: '5px 12px', borderRadius: '20px', border: `1px solid ${PURPLE}30`, background: PURPLE + '08', color: PURPLE, fontFamily: mono, fontSize: '8px', cursor: 'pointer' }}>
                      {h.politician} × {h.topic}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {result && (
          <div>
            {/* Stats bar */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '10px', marginBottom: '16px' }}>
              {[
                { l: 'SOURCES',        v: result.stats.totalStatements,     c: T0 },
                { l: 'CONTRADICTIONS', v: result.stats.contradictionsFound,  c: result.stats.contradictionsFound > 0 ? RED : GREEN },
                { l: 'VULNERABILITY',  v: `${result.stats.vulnerabilityScore}%`, c: vulnColor },
                { l: 'CONSISTENCY',    v: `${result.stats.consistencyScore}%`,   c: result.stats.consistencyScore >= 70 ? GREEN : YELLOW },
                { l: 'DATE RANGE',     v: result.stats.dateRange,            c: T2 },
              ].map(k => (
                <div key={k.l} style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '12px 14px' }}>
                  <div style={{ fontFamily: mono, fontSize: '7px', color: T3, letterSpacing: '1px', marginBottom: '5px' }}>{k.l}</div>
                  <div style={{ fontFamily: mono, fontSize: '16px', fontWeight: 700, color: k.c, lineHeight: 1 }}>{k.v}</div>
                </div>
              ))}
            </div>

            {/* Source breakdown — shows where data came from */}
            {result.sources_used && (
              <div style={{ background: CARD2, border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '8px 14px', marginBottom: '14px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                <span style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>SOURCES:</span>
                {Object.entries(result.sources_used).map(([k, v]) => (
                  <span key={k} style={{ fontFamily: mono, fontSize: '7px', color: (v as number) > 0 ? GREEN : T3 }}>
                    {k.toUpperCase().replace('_', ' ')} {v}
                  </span>
                ))}
              </div>
            )}

            {/* Subject line */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${RED}`, borderRadius: '10px', padding: '14px 18px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '14px' }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginBottom: '3px' }}>RESEARCH SUBJECT</div>
                <div style={{ fontSize: '14px', fontWeight: 700, color: T0 }}>{result.politician} <span style={{ color: T3 }}>×</span> {result.topic}</div>
              </div>
              <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
                <div style={{ fontFamily: mono, fontSize: '24px', fontWeight: 700, color: vulnColor }}>{result.stats.vulnerabilityScore}</div>
                <div style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>VULNERABILITY SCORE</div>
              </div>
            </div>

            {/* Tab bar */}
            <div style={{ display: 'flex', gap: '2px', borderBottom: `1px solid ${BORDER}`, marginBottom: '20px' }}>
              {([
                ['overview',       'OVERVIEW',       0],
                ['contradictions', 'CONTRADICTIONS', result.analysis?.contradictions?.length || 0],
                ['statements',     'STATEMENTS',     result.statements.length],
                ['strategy',       'STRATEGY',       0],
              ] as const).map(([id, label, count]) => (
                <button key={id} onClick={() => setActiveTab(id as any)}
                  style={{ fontFamily: mono, fontSize: '9px', letterSpacing: '1px', padding: '10px 18px', border: 'none', background: activeTab === id ? RED + '10' : 'transparent', cursor: 'pointer', color: activeTab === id ? RED : T2, borderBottom: `2px solid ${activeTab === id ? RED : 'transparent'}`, marginBottom: '-1px', transition: 'all .15s' }}>
                  {label} {count > 0 && <span style={{ opacity: 0.6 }}>({count})</span>}
                </button>
              ))}
            </div>

            {/* ── OVERVIEW ── */}
            {activeTab === 'overview' && result.analysis && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px' }}>
                    <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '1px', marginBottom: '10px' }}>AI SUMMARY</div>
                    <div style={{ fontSize: '12px', color: T1, lineHeight: 1.7, marginBottom: '14px' }}>{result.analysis.summary}</div>
                    <ConsistencyMeter score={result.analysis.overallConsistency} />
                  </div>
                  {result.analysis.keyStatements?.length > 0 && (
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '18px' }}>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '1px', marginBottom: '10px' }}>KEY STATEMENTS</div>
                      {result.analysis.keyStatements.slice(0, 4).map((s, i) => {
                        const sc = s.sentiment_toward_topic === 'positive' ? GREEN : s.sentiment_toward_topic === 'negative' ? RED : T3
                        return (
                          <div key={i} style={{ padding: '9px 0', borderBottom: i < 3 ? `1px solid ${BORDER}` : 'none' }}>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '3px' }}>
                              <span style={{ fontFamily: mono, fontSize: '7px', color: sc }}>{s.sentiment_toward_topic?.toUpperCase()}</span>
                              {s.date && <span style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>{s.date}</span>}
                            </div>
                            <div style={{ fontSize: '11px', color: T0, lineHeight: 1.5, marginBottom: '3px', fontStyle: 'italic' }}>"{s.quote?.substring(0, 120)}{s.quote?.length > 120 ? '…' : ''}"</div>
                            <div style={{ fontFamily: mono, fontSize: '8px', color: T2 }}>{s.significance}</div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
                  {result.analysis.contradictions?.length > 0 && (
                    <div style={{ background: CARD, border: `1px solid ${RED}20`, borderRadius: '12px', padding: '18px' }}>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: RED, letterSpacing: '1px', marginBottom: '10px' }}>TOP CONTRADICTIONS</div>
                      {result.analysis.contradictions.slice(0, 3).map((c, i) => {
                        const fc = FLIP_COLORS[c.flip_type] || ACC
                        return (
                          <div key={i} style={{ padding: '8px 0', borderBottom: i < 2 ? `1px solid ${BORDER}` : 'none' }}>
                            <div style={{ display: 'flex', gap: '6px', marginBottom: '3px' }}>
                              <span style={{ fontFamily: mono, fontSize: '7px', color: fc, background: fc + '12', padding: '1px 5px', borderRadius: '3px' }}>{FLIP_LABELS[c.flip_type] || c.flip_type}</span>
                            </div>
                            <div style={{ fontSize: '11px', fontWeight: 600, color: T0, marginBottom: '4px' }}>{c.title}</div>
                            <div style={{ fontSize: '10px', color: T2, lineHeight: 1.5 }}>{c.political_context}</div>
                          </div>
                        )
                      })}
                      <button onClick={() => setActiveTab('contradictions')} style={{ marginTop: '10px', fontFamily: mono, fontSize: '8px', color: RED, background: 'none', border: `1px solid ${RED}30`, borderRadius: '5px', padding: '4px 10px', cursor: 'pointer' }}>
                        VIEW ALL {result.analysis.contradictions.length} →
                      </button>
                    </div>
                  )}
                  <div style={{ background: CARD, border: `1px solid ${PURPLE}20`, borderRadius: '12px', padding: '18px' }}>
                    <div style={{ fontFamily: mono, fontSize: '8px', color: PURPLE, letterSpacing: '1px', marginBottom: '10px' }}>STRATEGIC ASSESSMENT</div>
                    <div style={{ fontSize: '12px', color: T1, lineHeight: 1.7 }}>{result.analysis.strategicAssessment}</div>
                  </div>
                </div>
              </div>
            )}

            {/* ── CONTRADICTIONS ── */}
            {activeTab === 'contradictions' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                {!result.analysis?.contradictions?.length ? (
                  <div style={{ background: GREEN + '08', border: `1px solid ${GREEN}25`, borderRadius: '12px', padding: '28px', textAlign: 'center' }}>
                    <div style={{ fontFamily: mono, fontSize: '10px', color: GREEN, marginBottom: '6px' }}>NO MAJOR CONTRADICTIONS FOUND</div>
                    <div style={{ fontFamily: mono, fontSize: '9px', color: T3 }}>Position appears consistent on this topic across the search window.</div>
                  </div>
                ) : result.analysis.contradictions.map((c, i) => <ContradictionCard key={i} c={c} index={i} />)}
              </div>
            )}

            {/* ── STATEMENTS ── */}
            {activeTab === 'statements' && (
              <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
                <div style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
                  <span style={{ fontFamily: mono, fontSize: '9px', color: T2, letterSpacing: '1px' }}>
                    {result.statements.length} SOURCES FOUND · {result.stats.dateRange}
                  </span>
                </div>
                {result.statements.map((s, i) => {
                  const sc = s.sentiment === 'positive' ? GREEN : s.sentiment === 'negative' ? RED : T3
                  return (
                    <div key={i} style={{ padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, transition: 'background .1s' }}
                      onMouseEnter={e => { e.currentTarget.style.background = CARD2 }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}>
                      <div style={{ display: 'flex', gap: '8px', marginBottom: '4px', alignItems: 'center' }}>
                        {s.date && <span style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>{s.date}</span>}
                        <span style={{ fontFamily: mono, fontSize: '7px', color: sc, background: sc + '12', padding: '1px 5px', borderRadius: '3px' }}>{s.sentiment?.toUpperCase()}</span>
                        <span style={{ fontFamily: mono, fontSize: '8px', color: BLUE }}>{s.source}</span>
                      </div>
                      <div style={{ fontSize: '12px', fontWeight: 600, color: T0, marginBottom: '4px' }}>{s.title}</div>
                      <div style={{ fontSize: '11px', color: T2, lineHeight: 1.5 }}>{s.snippet}</div>
                      {s.url && <a href={s.url} target="_blank" rel="noopener noreferrer" style={{ fontFamily: mono, fontSize: '8px', color: BLUE, marginTop: '4px', display: 'inline-block' }}>↗ Source</a>}
                    </div>
                  )
                })}
              </div>
            )}

            {/* ── STRATEGY ── */}
            {activeTab === 'strategy' && result.analysis && (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ background: RED + '06', border: `1px solid ${RED}20`, borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontFamily: mono, fontSize: '9px', color: RED, letterSpacing: '1px', marginBottom: '14px' }}>⚔ ATTACK PLAYBOOK</div>
                  {result.analysis.contradictions?.map((c, i) => c.best_attack_angle && (
                    <div key={i} style={{ padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginBottom: '4px' }}>RE: {c.title}</div>
                      <div style={{ fontSize: '11px', color: T0, lineHeight: 1.6 }}>{c.best_attack_angle}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background: GREEN + '06', border: `1px solid ${GREEN}20`, borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontFamily: mono, fontSize: '9px', color: GREEN, letterSpacing: '1px', marginBottom: '14px' }}>🛡 DEFENSE PLAYBOOK</div>
                  {result.analysis.contradictions?.map((c, i) => c.best_defense_angle && (
                    <div key={i} style={{ padding: '10px 0', borderBottom: `1px solid ${BORDER}` }}>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginBottom: '4px' }}>RE: {c.title}</div>
                      <div style={{ fontSize: '11px', color: T0, lineHeight: 1.6 }}>{c.best_defense_angle}</div>
                    </div>
                  ))}
                </div>
                <div style={{ gridColumn: '1 / -1', background: CARD, border: `1px solid ${PURPLE}20`, borderRadius: '12px', padding: '20px' }}>
                  <div style={{ fontFamily: mono, fontSize: '9px', color: PURPLE, letterSpacing: '1px', marginBottom: '12px' }}>🧠 STRATEGIC ASSESSMENT FOR CAMPAIGN TEAM</div>
                  <div style={{ fontSize: '13px', color: T1, lineHeight: 1.8 }}>{result.analysis.strategicAssessment}</div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
