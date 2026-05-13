// BharatMonitor — Crisis Early Warning System
// Predictive detection: identifies pre-crisis patterns 6-12h before they escalate
// Uses velocity analysis, journalist swarm detection, escalation phrases, archetype matching + Gemini

import { useState, useEffect, useMemo } from 'react'
import { useAccount, useFeedItems } from '@/hooks/useData'
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

const RISK_CONFIG = {
  CRITICAL: { color: RED,    bg: RED + '12',    label: 'CRITICAL', pulse: true  },
  HIGH:     { color: YELLOW, bg: YELLOW + '10', label: 'HIGH',     pulse: true  },
  MEDIUM:   { color: ACC,    bg: ACC + '10',    label: 'MEDIUM',   pulse: false },
  LOW:      { color: GREEN,  bg: GREEN + '08',  label: 'LOW',      pulse: false },
}

const SIGNAL_ICONS: Record<string, string> = {
  VELOCITY_SPIKE:      '⚡',
  JOURNALIST_SWARM:    '📡',
  ESCALATION_CHAIN:    '📈',
  ESCALATION_PHRASES:  '🔥',
  ARCHETYPE_MATCH:     '🔄',
  OPPOSITION_SURGE:    '⚔️',
}

interface CrisisSignal {
  type: string
  severity: 'critical' | 'high' | 'medium' | 'low'
  score: number
  headline: string
  detail: string
  items: string[]
}

interface CrisisResult {
  ok: boolean
  overallRiskScore: number
  riskLevel: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW'
  signals: CrisisSignal[]
  summary: string
  analysedAt: string
  itemsAnalysed: number
  aiAnalysis?: {
    riskScore: number
    primaryThreat: string
    signals: string[]
    recommendedActions: string[]
    timeToImpact: string
    confidence: number
  }
}

function RiskMeter({ score }: { score: number }) {
  const level = score >= 75 ? 'CRITICAL' : score >= 50 ? 'HIGH' : score >= 25 ? 'MEDIUM' : 'LOW'
  const cfg = RISK_CONFIG[level]
  const angle = -135 + (score / 100) * 270

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px' }}>
      <svg width={200} height={120} viewBox="0 0 200 120">
        {/* Gauge track */}
        <path d="M 20 100 A 80 80 0 0 1 180 100" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={14} strokeLinecap="round" />
        {/* Gauge fill */}
        {score > 0 && (
          <path
            d="M 20 100 A 80 80 0 0 1 180 100"
            fill="none"
            stroke={cfg.color}
            strokeWidth={14}
            strokeLinecap="round"
            strokeDasharray={`${(score / 100) * 251} 251`}
            style={{ filter: `drop-shadow(0 0 6px ${cfg.color}60)` }}
          />
        )}
        {/* Needle */}
        <g transform={`rotate(${angle}, 100, 100)`}>
          <line x1={100} y1={100} x2={100} y2={30} stroke={cfg.color} strokeWidth={2.5} strokeLinecap="round" />
          <circle cx={100} cy={100} r={5} fill={cfg.color} />
        </g>
        {/* Labels */}
        <text x={16} y={116} fill={T3} fontSize={8} fontFamily={mono}>LOW</text>
        <text x={155} y={116} fill={T3} fontSize={8} fontFamily={mono}>HIGH</text>
        {/* Score */}
        <text x={100} y={95} textAnchor="middle" fill={cfg.color} fontSize={28} fontFamily={mono} fontWeight={700}>{score}</text>
      </svg>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        {cfg.pulse && (
          <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: cfg.color, animation: 'pulse-ring 1.5s ease-out infinite', flexShrink: 0 }} />
        )}
        <span style={{ fontFamily: mono, fontSize: '12px', fontWeight: 700, color: cfg.color, letterSpacing: '2px' }}>
          {cfg.label} RISK
        </span>
      </div>
    </div>
  )
}

function SignalCard({ signal, expanded, onToggle }: { signal: CrisisSignal; expanded: boolean; onToggle: () => void }) {
  const sevColor = signal.severity === 'critical' ? RED : signal.severity === 'high' ? YELLOW : signal.severity === 'medium' ? ACC : GREEN
  const icon = SIGNAL_ICONS[signal.type] || '⚠'

  return (
    <div style={{ background: CARD, border: `1px solid ${sevColor}30`, borderLeft: `3px solid ${sevColor}`, borderRadius: '10px', overflow: 'hidden', transition: 'all .2s' }}>
      <div onClick={onToggle} style={{ padding: '14px 16px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span style={{ fontSize: '18px', flexShrink: 0 }}>{icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
            <span style={{ fontFamily: mono, fontSize: '7px', color: sevColor, background: sevColor + '15', padding: '2px 7px', borderRadius: '4px', letterSpacing: '1px', flexShrink: 0 }}>
              {signal.severity.toUpperCase()}
            </span>
            <span style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>{signal.type.replace(/_/g, ' ')}</span>
            <span style={{ fontFamily: mono, fontSize: '9px', fontWeight: 700, color: sevColor, marginLeft: 'auto' }}>{signal.score}</span>
          </div>
          <div style={{ fontSize: '12px', color: T0, fontWeight: 600 }}>{signal.headline}</div>
          <div style={{ fontFamily: mono, fontSize: '9px', color: T2, marginTop: '2px' }}>{signal.detail}</div>
        </div>
        <span style={{ fontFamily: mono, fontSize: '10px', color: T3, flexShrink: 0 }}>{expanded ? '▲' : '▼'}</span>
      </div>
      {expanded && signal.items.length > 0 && (
        <div style={{ borderTop: `1px solid ${BORDER}`, padding: '10px 16px' }}>
          <div style={{ fontFamily: mono, fontSize: '7px', color: T3, letterSpacing: '1px', marginBottom: '6px' }}>TRIGGERING ITEMS</div>
          {signal.items.map((item, i) => (
            <div key={i} style={{ display: 'flex', gap: '8px', padding: '4px 0', borderBottom: i < signal.items.length - 1 ? `1px solid rgba(255,255,255,0.04)` : 'none' }}>
              <span style={{ fontFamily: mono, fontSize: '8px', color: sevColor, flexShrink: 0 }}>→</span>
              <span style={{ fontSize: '10px', color: T1, lineHeight: 1.5 }}>{item}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function TimelineChart({ feed }: { feed: any[] }) {
  const buckets = useMemo(() => {
    const hours: Record<number, { total: number; neg: number; crisis: number }> = {}
    const now = Date.now()
    for (let i = 0; i < 24; i++) hours[i] = { total: 0, neg: 0, crisis: 0 }
    feed.forEach(f => {
      const hoursAgo = Math.floor((now - new Date(f.published_at).getTime()) / 3_600_000)
      if (hoursAgo >= 0 && hoursAgo < 24) {
        hours[hoursAgo].total++
        if (f.sentiment === 'negative') hours[hoursAgo].neg++
        if (f.bucket === 'red') hours[hoursAgo].crisis++
      }
    })
    return Object.entries(hours).reverse().map(([h, d]) => ({ hour: parseInt(h), label: `${h}h`, ...d }))
  }, [feed])

  const maxTotal = Math.max(...buckets.map(b => b.total), 1)
  const W = 680, H = 80

  return (
    <svg width="100%" height={H + 20} viewBox={`0 0 ${W} ${H + 20}`} style={{ display: 'block' }}>
      {buckets.map((b, i) => {
        const x = (i / buckets.length) * W
        const bw = W / buckets.length - 2
        const totalH = (b.total / maxTotal) * H
        const negH   = (b.neg    / maxTotal) * H
        const crisH  = (b.crisis / maxTotal) * H
        return (
          <g key={i}>
            {/* Total bar */}
            {totalH > 0 && <rect x={x} y={H - totalH} width={bw} height={totalH} fill={BLUE} fillOpacity={0.15} rx={2} />}
            {/* Negative bar */}
            {negH > 0 && <rect x={x} y={H - negH} width={bw} height={negH} fill={YELLOW} fillOpacity={0.5} rx={2} />}
            {/* Crisis bar */}
            {crisH > 0 && <rect x={x} y={H - crisH} width={bw} height={crisH} fill={RED} fillOpacity={0.8} rx={2} />}
            {/* Hour label every 6h */}
            {i % 6 === 0 && (
              <text x={x + bw / 2} y={H + 14} textAnchor="middle" fill={T3} fontSize={7} fontFamily={mono}>
                -{b.hour}h
              </text>
            )}
          </g>
        )
      })}
      {/* NOW marker */}
      <line x1={W - W / 24} y1={0} x2={W - W / 24} y2={H} stroke={ACC} strokeWidth={1.5} strokeDasharray="3,3" />
      <text x={W - W / 24 + 4} y={10} fill={ACC} fontSize={7} fontFamily={mono}>NOW</text>
      {/* Legend */}
      <g transform={`translate(4, ${H + 4})`}>
        {[[BLUE, 'Total'], [YELLOW, 'Negative'], [RED, 'Crisis']].map(([c, l], i) => (
          <g key={l as string} transform={`translate(${i * 70}, 0)`}>
            <rect x={0} y={-6} width={8} height={8} fill={c as string} fillOpacity={0.8} rx={1} />
            <text x={11} y={1} fill={T3} fontSize={7} fontFamily={mono}>{l}</text>
          </g>
        ))}
      </g>
    </svg>
  )
}

export default function CrisisEarlyWarningPage() {
  const { data: account } = useAccount()
  const { data: feed = [] } = useFeedItems(account?.id || '')

  const [result, setResult]         = useState<CrisisResult | null>(null)
  const [loading, setLoading]       = useState(false)
  const [error, setError]           = useState('')
  const [expandedSignal, setExpandedSignal] = useState<number | null>(null)
  const [lookback, setLookback]     = useState(12)
  const [autoScan, setAutoScan]     = useState(false)
  const [lastScan, setLastScan]     = useState<string | null>(null)

  async function runScan() {
    if (!account?.id) return
    setLoading(true)
    setError('')
    try {
      const authKey = SERVICE_KEY || ANON_KEY
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bm-crisis-predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authKey}`, 'apikey': ANON_KEY },
        body: JSON.stringify({ accountId: account.id, accountName: account.politician_name, lookbackHours: lookback }),
        signal: AbortSignal.timeout(60_000),
      })
      const data = await res.json()
      if (data.ok) {
        setResult(data)
        setLastScan(new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit' }))
      } else {
        setError(data.error || 'Scan failed')
      }
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  // Auto scan every 30 min if enabled
  useEffect(() => {
    if (!autoScan) return
    const interval = setInterval(runScan, 30 * 60_000)
    return () => clearInterval(interval)
  }, [autoScan, account?.id])

  const cfg = result ? RISK_CONFIG[result.riskLevel] : RISK_CONFIG.LOW

  return (
    <div style={{ minHeight: '100vh', background: DARK }}>
      <NavBar />

      <style>{`
        @keyframes pulse-ring {
          0% { box-shadow: 0 0 0 0 currentColor; opacity: 1; }
          70% { box-shadow: 0 0 0 8px transparent; opacity: 0; }
          100% { box-shadow: 0 0 0 0 transparent; opacity: 0; }
        }
        @keyframes blink { 0%,100% { opacity:1 } 50% { opacity:0.3 } }
      `}</style>

      <div style={{ maxWidth: '1280px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'flex-end', gap: '16px', marginBottom: '28px' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '2px', marginBottom: '6px' }}>PREDICTIVE INTELLIGENCE</div>
            <div style={{ fontSize: '20px', fontWeight: 700, color: T0 }}>Crisis Early Warning System</div>
            <div style={{ fontFamily: mono, fontSize: '9px', color: T2, marginTop: '4px' }}>
              Detects pre-crisis patterns 6–12 hours before escalation · 5 signal types · Gemini AI analysis
            </div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            {lastScan && <span style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>Last scan: {lastScan} IST</span>}
            {/* Lookback selector */}
            <div style={{ display: 'flex', gap: '2px' }}>
              {[6, 12, 24].map(h => (
                <button key={h} onClick={() => setLookback(h)}
                  style={{ padding: '5px 10px', border: `1px solid ${lookback === h ? PURPLE : BORDER}`, background: lookback === h ? PURPLE + '15' : 'transparent', color: lookback === h ? PURPLE : T3, fontFamily: mono, fontSize: '8px', cursor: 'pointer', borderRadius: '4px' }}>
                  {h}H
                </button>
              ))}
            </div>
            {/* Auto scan toggle */}
            <button onClick={() => setAutoScan(a => !a)}
              style={{ padding: '5px 12px', border: `1px solid ${autoScan ? GREEN : BORDER}`, background: autoScan ? GREEN + '12' : 'transparent', color: autoScan ? GREEN : T3, fontFamily: mono, fontSize: '8px', cursor: 'pointer', borderRadius: '4px' }}>
              {autoScan ? '◉ AUTO ON' : '◯ AUTO OFF'}
            </button>
            <button onClick={runScan} disabled={loading}
              style={{ padding: '10px 20px', background: loading ? CARD2 : RED + '18', border: `1px solid ${loading ? BORDER : RED + '50'}`, borderRadius: '8px', color: loading ? T2 : RED, fontFamily: mono, fontSize: '9px', fontWeight: 700, cursor: loading ? 'not-allowed' : 'pointer', letterSpacing: '0.5px' }}>
              {loading ? '⚙ SCANNING…' : '⚡ SCAN NOW'}
            </button>
          </div>
        </div>

        {error && (
          <div style={{ background: RED + '10', border: `1px solid ${RED}30`, borderRadius: '8px', padding: '12px 16px', marginBottom: '20px', fontFamily: mono, fontSize: '9px', color: RED }}>
            ⚠ {error}
          </div>
        )}

        {/* 24h activity timeline — always visible */}
        <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '16px 18px', marginBottom: '20px' }}>
          <div style={{ fontFamily: mono, fontSize: '9px', color: T2, letterSpacing: '1px', marginBottom: '12px' }}>24-HOUR ACTIVITY TIMELINE — {feed.length} items tracked</div>
          <TimelineChart feed={feed} />
        </div>

        {!result && !loading && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '56px', textAlign: 'center' }}>
            <div style={{ fontSize: '36px', marginBottom: '16px' }}>🛡️</div>
            <div style={{ fontFamily: mono, fontSize: '11px', color: T1, marginBottom: '10px' }}>CRISIS EARLY WARNING SYSTEM</div>
            <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 2.2, maxWidth: '500px', margin: '0 auto' }}>
              Analyses your feed for 5 types of pre-crisis signals:<br />
              <span style={{ color: YELLOW }}>⚡ Velocity Spike</span> — volume accelerating beyond baseline<br />
              <span style={{ color: BLUE }}>📡 Journalist Swarm</span> — multiple watchlisted journalists covering same story<br />
              <span style={{ color: RED }}>📈 Escalation Chain</span> — negative sentiment climbing across time windows<br />
              <span style={{ color: ACC }}>🔥 Escalation Phrases</span> — pre-crisis linguistic markers detected<br />
              <span style={{ color: PURPLE }}>🔄 Archetype Match</span> — pattern matches historical crisis archetypes<br /><br />
              Click SCAN NOW to run analysis on the last {lookback} hours.
            </div>
          </div>
        )}

        {loading && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '56px', textAlign: 'center' }}>
            <div style={{ width: '36px', height: '36px', borderRadius: '50%', border: `3px solid ${RED}`, borderTopColor: 'transparent', animation: 'blink 0.8s linear infinite', margin: '0 auto 16px' }} />
            <div style={{ fontFamily: mono, fontSize: '10px', color: RED, marginBottom: '8px' }}>ANALYSING FEED…</div>
            <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 2 }}>
              Checking velocity patterns…<br />
              Detecting journalist swarms…<br />
              Scanning escalation phrases…<br />
              Matching crisis archetypes…<br />
              Running Gemini deep analysis…
            </div>
          </div>
        )}

        {result && (
          <div>
            {/* Risk overview */}
            <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr', gap: '16px', marginBottom: '20px' }}>
              {/* Gauge */}
              <div style={{ background: cfg.bg, border: `1px solid ${cfg.color}30`, borderRadius: '14px', padding: '24px 16px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '16px' }}>
                <RiskMeter score={result.overallRiskScore} />
                <div style={{ textAlign: 'center', padding: '0 8px' }}>
                  <div style={{ fontFamily: mono, fontSize: '9px', color: T2, lineHeight: 1.8 }}>
                    {result.itemsAnalysed} items analysed<br />
                    {result.signals.length} signals detected<br />
                    Lookback: {lookback}h
                  </div>
                </div>
              </div>

              {/* Summary + AI analysis */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                <div style={{ background: CARD, border: `1px solid ${cfg.color}30`, borderRadius: '12px', padding: '18px 20px' }}>
                  <div style={{ fontFamily: mono, fontSize: '8px', color: cfg.color, letterSpacing: '1px', marginBottom: '8px' }}>THREAT ASSESSMENT</div>
                  <div style={{ fontSize: '14px', color: T0, lineHeight: 1.6, marginBottom: '12px' }}>{result.summary}</div>
                  {result.aiAnalysis && (
                    <>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: '8px', marginBottom: '12px' }}>
                        {[
                          { l: 'AI RISK SCORE', v: result.aiAnalysis.riskScore, c: cfg.color },
                          { l: 'CONFIDENCE',    v: `${Math.round(result.aiAnalysis.confidence * 100)}%`, c: BLUE },
                          { l: 'TIME TO IMPACT', v: result.aiAnalysis.timeToImpact, c: YELLOW },
                        ].map(k => (
                          <div key={k.l} style={{ background: CARD2, borderRadius: '6px', padding: '8px 10px', textAlign: 'center' }}>
                            <div style={{ fontFamily: mono, fontSize: '7px', color: T3, marginBottom: '3px' }}>{k.l}</div>
                            <div style={{ fontFamily: mono, fontSize: '13px', fontWeight: 700, color: k.c }}>{k.v}</div>
                          </div>
                        ))}
                      </div>
                    </>
                  )}
                </div>

                {result.aiAnalysis && (
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '14px 16px' }}>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: YELLOW, letterSpacing: '1px', marginBottom: '8px' }}>AI SIGNALS</div>
                      {result.aiAnalysis.signals.map((s, i) => (
                        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px' }}>
                          <span style={{ color: YELLOW, flexShrink: 0, fontFamily: mono, fontSize: '9px' }}>·</span>
                          <span style={{ fontSize: '10px', color: T1, lineHeight: 1.5 }}>{s}</span>
                        </div>
                      ))}
                    </div>
                    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '14px 16px' }}>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: GREEN, letterSpacing: '1px', marginBottom: '8px' }}>RECOMMENDED ACTIONS</div>
                      {result.aiAnalysis.recommendedActions.map((a, i) => (
                        <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '5px' }}>
                          <span style={{ color: GREEN, flexShrink: 0, fontFamily: mono, fontSize: '9px' }}>{i + 1}.</span>
                          <span style={{ fontSize: '10px', color: T1, lineHeight: 1.5 }}>{a}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Signals breakdown */}
            {result.signals.length > 0 ? (
              <div>
                <div style={{ fontFamily: mono, fontSize: '9px', color: T3, letterSpacing: '2px', marginBottom: '12px' }}>
                  DETECTED SIGNALS ({result.signals.length})
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {result.signals.map((signal, i) => (
                    <SignalCard
                      key={i}
                      signal={signal}
                      expanded={expandedSignal === i}
                      onToggle={() => setExpandedSignal(expandedSignal === i ? null : i)}
                    />
                  ))}
                </div>
              </div>
            ) : (
              <div style={{ background: GREEN + '08', border: `1px solid ${GREEN}25`, borderRadius: '12px', padding: '28px', textAlign: 'center' }}>
                <div style={{ fontSize: '24px', marginBottom: '8px' }}>✓</div>
                <div style={{ fontFamily: mono, fontSize: '10px', color: GREEN, marginBottom: '6px' }}>NO PRE-CRISIS SIGNALS DETECTED</div>
                <div style={{ fontFamily: mono, fontSize: '9px', color: T3 }}>Feed is clear for the last {lookback} hours. Next auto-scan in 30 minutes.</div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
