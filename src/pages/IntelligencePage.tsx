// BharatMonitor — Social Media Intelligence Report Page
// Generates GovernanceVibe-style topic cluster reports using AI
// Includes full PDF download with dark theme

import { useState, useMemo, useRef } from 'react'
import { useAccount, useFeedItems } from '@/hooks/useData'
import NavBar from '@/components/layout/NavBar'
import { ANON_KEY, SUPABASE_URL } from '@/lib/supabase'

const mono = '"IBM Plex Mono", monospace'
const DARK    = '#0d1018'
const CARD    = '#111827'
const CARD2   = '#161d2c'
const BORDER  = 'rgba(255,255,255,0.07)'
const ACC     = '#f97316'
const GREEN   = '#22d3a0'
const RED     = '#f03e3e'
const YELLOW  = '#f5a623'
const BLUE    = '#3d8ef0'
const T0      = '#edf0f8'
const T1      = '#c8d0e0'
const T2      = '#8892a4'
const T3      = '#545f78'

interface TopicCluster {
  title: string
  postCount: number
  percentage: number
  positiveCount: number
  negativeCount: number
  topPositiveSources: { name: string; count: number }[]
  topNegativeSources: { name: string; count: number }[]
  narrativePoints: string[]
  sampleItems: { headline: string; source: string; platform: string; sentiment: string; url: string; published_at: string }[]
}

interface IntelReport {
  accountId: string
  generatedAt: string
  dateRange: { from: string; to: string }
  totalPosts: number
  topicCount: number
  topics: TopicCluster[]
  conclusions: { title: string; body: string }[]
}

function TopicBar({ topic, index, total }: { topic: TopicCluster; index: number; total: number }) {
  const pct = Math.min((topic.postCount / Math.max(total, 1)) * 100, 100)
  const negPct = topic.positiveCount + topic.negativeCount > 0
    ? Math.round(topic.negativeCount / (topic.positiveCount + topic.negativeCount) * 100)
    : 50
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '5px 0', borderBottom: `1px solid ${BORDER}` }}>
      <span style={{ fontFamily: mono, fontSize: '9px', color: T3, width: '18px', flexShrink: 0 }}>{index + 1}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: '11px', color: T1, marginBottom: '3px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{topic.title}</div>
        <div style={{ height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: negPct > 60 ? RED : negPct > 40 ? YELLOW : GREEN, borderRadius: '2px' }} />
        </div>
      </div>
      <span style={{ fontFamily: mono, fontSize: '9px', color: T2, minWidth: '36px', textAlign: 'right' }}>{topic.postCount}</span>
      <span style={{ fontFamily: mono, fontSize: '9px', color: T3, minWidth: '36px', textAlign: 'right' }}>{topic.percentage}%</span>
    </div>
  )
}

function SourceBadge({ name, count, color }: { name: string; count: number; color: string }) {
  return (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', padding: '2px 8px', background: color + '12', border: `1px solid ${color}25`, borderRadius: '20px', fontFamily: mono, fontSize: '8px', color, margin: '2px' }}>
      {name} <span style={{ color: color + '99' }}>({count})</span>
    </span>
  )
}

export default function IntelligencePage() {
  const { data: account } = useAccount()
  const { data: feed = [] } = useFeedItems(account?.id || '')
  const [report, setReport]       = useState<IntelReport | null>(null)
  const [loading, setLoading]     = useState(false)
  const [error, setError]         = useState('')
  const [dateFrom, setDateFrom]   = useState('')
  const [dateTo, setDateTo]       = useState('')
  const [expandedTopic, setExpandedTopic] = useState<number | null>(null)
  const [reportMode, setReportMode] = useState<'account'|'national'>('account')
  const reportRef = useRef<HTMLDivElement>(null)

  async function generateReport() {
    if (!account?.id) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bm-intelligence-report`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey':        ANON_KEY,
        },
        body: JSON.stringify({
          accountId: account.id,
          dateFrom: dateFrom || undefined,
          dateTo:   dateTo   || undefined,
          maxItems: 150,
          nationalMode: reportMode === 'national',
        }),
      })
      const data = await res.json()
      if (!res.ok || data.error) {
        setError(data.error || 'Generation failed')
        return
      }
      setReport(data)
    } catch (e: any) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  function handlePrint() { window.print() }

  const formattedDate = report
    ? new Date(report.generatedAt).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' })
    : ''

  const dateLabel = report
    ? `${report.dateRange.from} — ${report.dateRange.to}`
    : ''

  return (
    <div style={{ minHeight: '100vh', background: DARK }}>
      <NavBar />
      <div className="no-print" style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px', flexWrap: 'wrap' }}>
          <div>
            <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '2px', marginBottom: '4px' }}>SOCIAL MEDIA INTELLIGENCE</div>
            <div style={{ fontSize: '18px', fontWeight: 700, color: T0 }}>Intelligence Report Generator</div>
          </div>
          <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>FROM DATE</label>
              <input type="date" value={dateFrom} onChange={e => setDateFrom(e.target.value)}
                style={{ background: CARD, border: `1px solid ${BORDER}`, color: T1, borderRadius: '5px', padding: '4px 8px', fontFamily: mono, fontSize: '10px' }} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              <label style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>TO DATE</label>
              <input type="date" value={dateTo} onChange={e => setDateTo(e.target.value)}
                style={{ background: CARD, border: `1px solid ${BORDER}`, color: T1, borderRadius: '5px', padding: '4px 8px', fontFamily: mono, fontSize: '10px' }} />
            </div>
            <div style={{ display:'flex', gap:'4px', alignSelf:'flex-end' }}>
              {(['account','national'] as const).map(m => (
                <button key={m} onClick={() => setReportMode(m)} style={{ padding:'5px 12px', border:`1px solid ${reportMode===m?'var(--acc)':'rgba(255,255,255,0.1)'}`, borderRadius:'6px', background:reportMode===m?'rgba(249,115,22,0.1)':'transparent', color:reportMode===m?'var(--acc)':'var(--t2)', fontFamily:'"IBM Plex Mono",monospace', fontSize:'8px', cursor:'pointer', letterSpacing:'0.5px', textTransform:'uppercase' }}>
                  {m === 'account' ? '👤 Account Keywords' : '🇮🇳 National Discourse'}
                </button>
              ))}
            </div>
            <button onClick={generateReport} disabled={loading}
              style={{ padding: '10px 20px', background: loading ? CARD : ACC, color: '#fff', border: 'none', borderRadius: '8px', cursor: loading ? 'not-allowed' : 'pointer', fontFamily: mono, fontSize: '10px', fontWeight: 700, alignSelf: 'flex-end', opacity: loading ? 0.7 : 1 }}>
              {loading ? '⚙ GENERATING…' : '⚡ GENERATE REPORT'}
            </button>
            {report && (
              <button onClick={handlePrint}
                style={{ padding: '10px 16px', background: 'transparent', color: GREEN, border: `1px solid ${GREEN}40`, borderRadius: '8px', cursor: 'pointer', fontFamily: mono, fontSize: '10px', alignSelf: 'flex-end' }}>
                ⬇ SAVE PDF
              </button>
            )}
          </div>
        </div>

        {loading && (
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

        {error && (
          <div style={{ background: 'rgba(240,62,62,0.08)', border: `1px solid ${RED}30`, borderRadius: '10px', padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ fontFamily: mono, fontSize: '9px', color: RED }}>⚠ {error}</div>
          </div>
        )}

        {!report && !loading && (
          <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', padding: '48px', textAlign: 'center' }}>
            <div style={{ fontSize: '24px', marginBottom: '12px' }}>📊</div>
            <div style={{ fontFamily: mono, fontSize: '11px', color: T1, marginBottom: '8px' }}>SOCIAL MEDIA INTELLIGENCE REPORT</div>
            <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 2, maxWidth: '500px', margin: '0 auto' }}>
              AI clusters your tracked feed into topic groups.<br />
              Identifies positive vs negative narrative drivers.<br />
              Shows top sources per topic with post counts.<br />
              Generates 5 strategic conclusions for the war room.<br />
              <br />
              Select date range (optional) and click Generate.
            </div>
          </div>
        )}
      </div>

      {/* Report output — shown in both screen and print */}
      {report && (
        <div ref={reportRef} style={{ maxWidth: '1100px', margin: '0 auto', padding: '0 20px 48px' }}>

          {/* Cover */}
          <div style={{ borderBottom: `2px solid ${ACC}`, paddingBottom: '24px', marginBottom: '32px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px' }}>
              <div>
                <div style={{ fontFamily: mono, fontSize: '9px', color: ACC, letterSpacing: '3px', marginBottom: '6px' }}>SOCIAL MEDIA INTELLIGENCE REPORT</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: T0, marginBottom: '4px' }}>{dateLabel.toUpperCase()}</div>
                <div style={{ fontFamily: mono, fontSize: '10px', color: T2 }}>
                  Prevailing social media narratives and public discourse trends across India's political landscape — reorganised by topic with inferences drawn from pattern data.
                </div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0, marginLeft: '20px' }}>
                <div style={{ fontFamily: mono, fontSize: '24px', fontWeight: 700, color: T0 }}>{report.totalPosts}</div>
                <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>TOTAL ITEMS</div>
                <div style={{ fontFamily: mono, fontSize: '16px', fontWeight: 700, color: ACC, marginTop: '6px' }}>{report.topicCount}</div>
                <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>TOPIC CLUSTERS</div>
              </div>
            </div>

            {/* Topic volume bars */}
            <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '10px', padding: '16px' }}>
              <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '1px', marginBottom: '12px' }}>DISCOURSE VOLUME BY TOPIC</div>
              {report.topics.map((t, i) => (
                <TopicBar key={i} topic={t} index={i} total={report.totalPosts} />
              ))}
            </div>
          </div>

          {/* Detailed topic breakdown */}
          <div style={{ fontFamily: mono, fontSize: '9px', color: T3, letterSpacing: '2px', marginBottom: '20px' }}>DETAILED TOPIC BREAKDOWN</div>

          {report.topics.map((topic, i) => {
            const isExpanded = expandedTopic === i
            const negPct = (topic.positiveCount + topic.negativeCount) > 0
              ? Math.round(topic.negativeCount / (topic.positiveCount + topic.negativeCount) * 100)
              : 50

            return (
              <div key={i} style={{ marginBottom: '24px', background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden' }}>
                {/* Topic header */}
                <div style={{ padding: '16px 18px', borderBottom: `1px solid ${BORDER}`, display: 'flex', alignItems: 'center', gap: '12px', cursor: 'pointer' }}
                  onClick={() => setExpandedTopic(isExpanded ? null : i)}>
                  <span style={{ fontFamily: mono, fontSize: '10px', color: ACC, fontWeight: 700, flexShrink: 0 }}>Topic {i + 1}</span>
                  <span style={{ fontSize: '13px', fontWeight: 600, color: T0, flex: 1 }}>{topic.title}</span>
                  <span style={{ fontFamily: mono, fontSize: '10px', color: T2, flexShrink: 0 }}>{topic.postCount} posts · {topic.percentage}%</span>
                  <span style={{ fontFamily: mono, fontSize: '9px', color: T3, flexShrink: 0 }}>{isExpanded ? '▲' : '▼'}</span>
                </div>

                <div style={{ padding: '16px 18px' }}>
                  {/* Sentiment bar */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '14px' }}>
                    <div style={{ flex: 1, height: '6px', background: 'rgba(255,255,255,0.06)', borderRadius: '3px', overflow: 'hidden', display: 'flex' }}>
                      <div style={{ width: `${100 - negPct}%`, height: '100%', background: GREEN }} />
                      <div style={{ width: `${negPct}%`, height: '100%', background: RED }} />
                    </div>
                    <span style={{ fontFamily: mono, fontSize: '8px', color: GREEN, flexShrink: 0 }}>+{topic.positiveCount} PRAISE</span>
                    <span style={{ fontFamily: mono, fontSize: '8px', color: RED, flexShrink: 0 }}>-{topic.negativeCount} ATTACK</span>
                  </div>

                  {/* Positive sources */}
                  {topic.topPositiveSources.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: GREEN, letterSpacing: '1px', marginBottom: '5px' }}>PRAISE / DEFENSE ({topic.positiveCount})</div>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginBottom: '4px' }}>Top Positive Drivers: {topic.topPositiveSources.map(s => `${s.name} (${s.count})`).join(', ')}</div>
                    </div>
                  )}

                  {/* Negative sources */}
                  {topic.topNegativeSources.length > 0 && (
                    <div style={{ marginBottom: '12px' }}>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: RED, letterSpacing: '1px', marginBottom: '5px' }}>CRITICISMS / ATTACKS ({topic.negativeCount})</div>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginBottom: '4px' }}>Top Negative Drivers: {topic.topNegativeSources.map(s => `${s.name} (${s.count})`).join(', ')}</div>
                    </div>
                  )}

                  {/* Narrative bullets */}
                  {topic.narrativePoints.length > 0 && (
                    <div>
                      {topic.narrativePoints.map((pt, j) => (
                        <div key={j} style={{ display: 'flex', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ color: ACC, flexShrink: 0, marginTop: '1px' }}>-</span>
                          <span style={{ fontSize: '11px', color: T1, lineHeight: 1.6 }}>{pt}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Sample items (expanded) */}
                  {isExpanded && topic.sampleItems.length > 0 && (
                    <div style={{ marginTop: '14px', borderTop: `1px solid ${BORDER}`, paddingTop: '14px' }}>
                      <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '1px', marginBottom: '8px' }}>SAMPLE ITEMS</div>
                      {topic.sampleItems.map((item, k) => {
                        const sc = item.sentiment === 'positive' ? GREEN : item.sentiment === 'negative' ? RED : T3
                        return (
                          <div key={k} style={{ padding: '6px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                            <div style={{ fontSize: '10px', color: T1, lineHeight: 1.5, marginBottom: '2px' }}>{item.headline}</div>
                            <div style={{ display: 'flex', gap: '8px' }}>
                              <span style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>{item.source}</span>
                              <span style={{ fontFamily: mono, fontSize: '7px', color: T3 }}>·</span>
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

          {/* Overall conclusions */}
          {report.conclusions.length > 0 && (
            <div style={{ marginTop: '32px' }}>
              <div style={{ fontFamily: mono, fontSize: '9px', color: T3, letterSpacing: '2px', marginBottom: '20px' }}>OVERALL CONCLUSIONS</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
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
          <div style={{ marginTop: '32px', borderTop: `1px solid ${BORDER}`, paddingTop: '16px', display: 'flex', justifyContent: 'space-between' }}>
            <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>
              BHARATMONITOR · POLITICAL INTELLIGENCE PLATFORM · CONFIDENTIAL
            </div>
            <div style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>
              Generated {formattedDate} IST · {account?.politician_name}
            </div>
          </div>
        </div>
      )}

      <style>{`
        @media print {
          .no-print { display: none !important; }
          * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
          body { background: #0d1018 !important; }
          @page { margin: 12mm; size: A4; }
        }
      `}</style>
    </div>
  )
}
