// ReportPage — comprehensive multi-page PDF report
// Opened in a new tab, shows all data from all sections
// with a "Save as PDF" button (uses window.print)

import { useEffect, useMemo, useState } from 'react'
import { useAccount, useFeedItems, useTrendMetrics, useCompetitors, useContradictions } from '@/hooks/useData'

const mono = '"IBM Plex Mono", monospace'

export default function ReportPage() {
  const { data: account }       = useAccount()
  const { data: feed = [] }     = useFeedItems(account?.id || '')
  const { data: trends = [] }   = useTrendMetrics(account?.id || '')
  const { data: competitors = [] } = useCompetitors(account)
  const { data: contradictions = [] } = useContradictions(account?.id || '')
  const [printing, setPrinting] = useState(false)

  const generatedAt = new Date().toLocaleString('en-IN', {
    day: '2-digit', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit', hour12: true, timeZone: 'Asia/Kolkata'
  })

  // Computed analytics
  const analytics = useMemo(() => {
    const pos     = feed.filter(f => f.sentiment === 'positive').length
    const neg     = feed.filter(f => f.sentiment === 'negative').length
    const neu     = feed.filter(f => f.sentiment === 'neutral').length
    const crisis  = feed.filter(f => f.bucket === 'red').length
    const dev     = feed.filter(f => f.bucket === 'yellow').length
    const bg      = feed.filter(f => f.bucket === 'blue' || f.bucket === 'silver').length
    const total   = Math.max(feed.length, 1)
    const topSources = Object.entries(
      feed.reduce((a, f) => { a[f.source] = (a[f.source]||0)+1; return a }, {} as Record<string,number>)
    ).sort(([,a],[,b]) => b-a).slice(0, 8)
    const topGeo = Object.entries(
      feed.flatMap(f => f.geo_tags||[]).reduce((a, g) => { a[g] = (a[g]||0)+1; return a }, {} as Record<string,number>)
    ).sort(([,a],[,b]) => b-a).slice(0, 8)
    const topTopics = Object.entries(
      feed.flatMap(f => f.topic_tags||[]).reduce((a, t) => { a[t] = (a[t]||0)+1; return a }, {} as Record<string,number>)
    ).sort(([,a],[,b]) => b-a).slice(0, 8)
    const platforms = Object.entries(
      feed.reduce((a, f) => { a[f.platform] = (a[f.platform]||0)+1; return a }, {} as Record<string,number>)
    ).sort(([,a],[,b]) => b-a)
    const crisisItems  = feed.filter(f => f.bucket === 'red').slice(0, 5)
    const devItems     = feed.filter(f => f.bucket === 'yellow').slice(0, 5)
    const posItems     = feed.filter(f => f.sentiment === 'positive').slice(0, 5)
    const negItems     = feed.filter(f => f.sentiment === 'negative').slice(0, 5)
    return { pos, neg, neu, crisis, dev, bg, total: feed.length,
      posPct: Math.round(pos/total*100), negPct: Math.round(neg/total*100), neuPct: Math.round(neu/total*100),
      topSources, topGeo, topTopics, platforms, crisisItems, devItems, posItems, negItems }
  }, [feed])

  function handlePrint() {
    setPrinting(true)
    setTimeout(() => { window.print(); setPrinting(false) }, 200)
  }

  return (
    <div style={{ fontFamily: mono, background: '#fff', color: '#111', minHeight: '100vh' }}>

      {/* Print button — hidden in PDF */}
      <div className="no-print" style={{
        position: 'fixed', top: '16px', right: '16px', zIndex: 1000,
        display: 'flex', gap: '8px',
      }}>
        <button onClick={handlePrint} style={{
          padding: '10px 20px', background: '#f97316', color: '#fff', border: 'none',
          borderRadius: '8px', cursor: 'pointer', fontFamily: mono, fontSize: '12px',
          fontWeight: 700, letterSpacing: '0.5px', boxShadow: '0 2px 12px rgba(249,115,22,0.4)',
        }}>⬇ SAVE AS PDF</button>
        <button onClick={() => window.close()} style={{
          padding: '10px 16px', background: 'transparent', color: '#666', border: '1px solid #ddd',
          borderRadius: '8px', cursor: 'pointer', fontFamily: mono, fontSize: '12px',
        }}>✕ CLOSE</button>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '48px 40px' }}>

        {/* Cover */}
        <div style={{ borderBottom: '3px solid #f97316', paddingBottom: '32px', marginBottom: '40px' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: '24px' }}>
            <div>
              <div style={{ fontSize: '11px', letterSpacing: '3px', color: '#f97316', marginBottom: '8px' }}>POLITICAL INTELLIGENCE REPORT</div>
              <div style={{ fontSize: '28px', fontWeight: 700, color: '#0d1018', marginBottom: '6px' }}>{account?.politician_name || 'Account'}</div>
              <div style={{ fontSize: '13px', color: '#666' }}>
                {[account?.designation, account?.party, account?.constituency, account?.state].filter(Boolean).join(' · ')}
              </div>
            </div>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: '11px', letterSpacing: '2px', color: '#999', marginBottom: '4px' }}>GENERATED</div>
              <div style={{ fontSize: '12px', color: '#333' }}>{generatedAt} IST</div>
              <div style={{ fontSize: '11px', color: '#999', marginTop: '4px' }}>BharatMonitor v2.0</div>
            </div>
          </div>

          {/* KPI strip */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '12px' }}>
            {[
              { l: 'TOTAL ITEMS', v: analytics.total, c: '#0d1018' },
              { l: 'CRISIS', v: analytics.crisis, c: '#dc2626' },
              { l: 'DEVELOPING', v: analytics.dev, c: '#d97706' },
              { l: 'POSITIVE', v: `${analytics.posPct}%`, c: '#059669' },
              { l: 'NEGATIVE', v: `${analytics.negPct}%`, c: '#dc2626' },
              { l: 'CONTRADICTIONS', v: contradictions.length, c: '#d97706' },
            ].map(k => (
              <div key={k.l} style={{ background: '#f8f8f8', border: '1px solid #eee', borderRadius: '8px', padding: '10px 12px', textAlign: 'center' }}>
                <div style={{ fontSize: '8px', letterSpacing: '1px', color: '#999', marginBottom: '5px' }}>{k.l}</div>
                <div style={{ fontSize: '20px', fontWeight: 700, color: k.c }}>{k.v}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Section helper */}
        {(() => {
          function Section({ title, children }: { title: string; children: React.ReactNode }) {
            return (
              <div style={{ marginBottom: '36px', pageBreakInside: 'avoid' }}>
                <div style={{ fontSize: '10px', letterSpacing: '2px', color: '#f97316', fontWeight: 700, marginBottom: '14px', borderBottom: '1px solid #f0f0f0', paddingBottom: '8px' }}>
                  {title}
                </div>
                {children}
              </div>
            )
          }

          function Row({ label, value, bar, color }: { label: string; value: string | number; bar?: number; color?: string }) {
            return (
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '5px 0', borderBottom: '1px solid #f5f5f5' }}>
                <span style={{ fontSize: '11px', color: '#444', width: '200px', flexShrink: 0 }}>{label}</span>
                {bar !== undefined && (
                  <div style={{ flex: 1, height: '4px', background: '#f0f0f0', borderRadius: '2px', overflow: 'hidden' }}>
                    <div style={{ width: `${Math.min(bar, 100)}%`, height: '100%', background: color || '#f97316', borderRadius: '2px' }} />
                  </div>
                )}
                <span style={{ fontSize: '11px', fontWeight: 600, color: color || '#0d1018', minWidth: '40px', textAlign: 'right' }}>{value}</span>
              </div>
            )
          }

          function NewsItem({ item, i }: { item: any; i: number }) {
            const bc = item.bucket==='red'?'#dc2626':item.bucket==='yellow'?'#d97706':'#059669'
            return (
              <div style={{ padding: '10px 12px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', marginBottom: '6px' }}>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'flex-start' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: bc, flexShrink: 0, marginTop: '4px' }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '11px', color: '#222', lineHeight: 1.5, marginBottom: '3px' }}>{item.headline}</div>
                    <div style={{ fontSize: '10px', color: '#999' }}>{item.source} · {item.platform} · {new Date(item.published_at).toLocaleDateString('en-IN')}</div>
                  </div>
                </div>
              </div>
            )
          }

          const maxSource = Math.max(...analytics.topSources.map(([,n])=>n), 1)
          const maxGeo    = Math.max(...analytics.topGeo.map(([,n])=>n), 1)

          return (
            <>
              {/* Executive Summary */}
              <Section title="01. EXECUTIVE SUMMARY">
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
                  <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#999', marginBottom: '8px' }}>SITUATION</div>
                    <div style={{ fontSize: '12px', color: '#333', lineHeight: 1.7 }}>
                      Live monitoring active. {analytics.total} items tracked across {analytics.platforms.length} platforms.
                      {analytics.crisis > 0 ? ` ⚠ ${analytics.crisis} crisis signals detected.` : ' No active crisis signals.'}
                      {analytics.posPct > 50 ? ' Overall sentiment is positive.' : analytics.negPct > 30 ? ' Elevated negative sentiment — monitor closely.' : ' Sentiment is broadly neutral.'}
                    </div>
                  </div>
                  <div style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '8px', padding: '14px' }}>
                    <div style={{ fontSize: '10px', letterSpacing: '1px', color: '#999', marginBottom: '8px' }}>PATTERN ANALYSIS</div>
                    <div style={{ fontSize: '12px', color: '#333', lineHeight: 1.7 }}>
                      {analytics.dev > 0 ? `${analytics.dev} developing stories require attention.` : 'No significant developing stories.'} 
                      {competitors.length > 0 ? ` ${competitors.length} competitor(s) tracked.` : ''}
                      {contradictions.length > 0 ? ` ${contradictions.length} contradiction(s) flagged by AI.` : ' No contradictions detected in current data.'}
                    </div>
                  </div>
                </div>

                {/* Sentiment bars */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                  {[
                    { l: 'Positive', v: analytics.posPct, c: '#059669' },
                    { l: 'Negative', v: analytics.negPct, c: '#dc2626' },
                    { l: 'Neutral',  v: analytics.neuPct, c: '#6b7280' },
                  ].map(s => (
                    <div key={s.l} style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', padding: '10px 12px' }}>
                      <div style={{ fontSize: '10px', color: '#999', marginBottom: '5px' }}>{s.l}</div>
                      <div style={{ height: '4px', background: '#eee', borderRadius: '2px', overflow: 'hidden', marginBottom: '5px' }}>
                        <div style={{ width: `${s.v}%`, height: '100%', background: s.c }} />
                      </div>
                      <div style={{ fontSize: '16px', fontWeight: 700, color: s.c }}>{s.v}%</div>
                    </div>
                  ))}
                </div>
              </Section>

              {/* Crisis Items */}
              {analytics.crisisItems.length > 0 && (
                <Section title="02. CRISIS SIGNALS">
                  {analytics.crisisItems.map((item, i) => <NewsItem key={item.id} item={item} i={i} />)}
                </Section>
              )}

              {/* Developing */}
              {analytics.devItems.length > 0 && (
                <Section title="03. DEVELOPING STORIES">
                  {analytics.devItems.map((item, i) => <NewsItem key={item.id} item={item} i={i} />)}
                </Section>
              )}

              {/* Platform coverage */}
              <Section title="04. PLATFORM COVERAGE">
                {analytics.platforms.map(([p, n]) => (
                  <Row key={p} label={p.toUpperCase()} value={n} bar={Math.round((n / Math.max(...analytics.platforms.map(([,v])=>v), 1)) * 100)} color="#1d4ed8" />
                ))}
              </Section>

              {/* Top sources */}
              <Section title="05. TOP SOURCES">
                {analytics.topSources.map(([s, n]) => (
                  <Row key={s} label={s} value={n} bar={Math.round((n/maxSource)*100)} color="#f97316" />
                ))}
              </Section>

              {/* Geography */}
              {analytics.topGeo.length > 0 && (
                <Section title="06. GEOGRAPHIC SIGNALS">
                  {analytics.topGeo.map(([g, n]) => (
                    <Row key={g} label={g} value={n} bar={Math.round((n/maxGeo)*100)} color="#7c3aed" />
                  ))}
                </Section>
              )}

              {/* Positive highlights */}
              {analytics.posItems.length > 0 && (
                <Section title="07. POSITIVE COVERAGE HIGHLIGHTS">
                  {analytics.posItems.map((item, i) => <NewsItem key={item.id} item={item} i={i} />)}
                </Section>
              )}

              {/* Negative highlights */}
              {analytics.negItems.length > 0 && (
                <Section title="08. NEGATIVE COVERAGE — MONITOR">
                  {analytics.negItems.map((item, i) => <NewsItem key={item.id} item={item} i={i} />)}
                </Section>
              )}

              {/* Contradictions */}
              {contradictions.length > 0 && (
                <Section title="09. AI QUOTE INTELLIGENCE — CONTRADICTIONS">
                  {contradictions.slice(0, 5).map((c: any, i: number) => (
                    <div key={c.id} style={{ padding: '12px', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: '6px', marginBottom: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
                        <span style={{ fontSize: '10px', letterSpacing: '1px', color: '#d97706', fontWeight: 700 }}>
                          {c.contradiction_type?.toUpperCase().replace('_',' ')}
                        </span>
                        <span style={{ fontSize: '10px', color: '#d97706', marginLeft: 'auto' }}>{c.contradiction_score}% confidence</span>
                      </div>
                      <div style={{ fontSize: '11px', color: '#444', marginBottom: '5px' }}>
                        <strong>Current:</strong> "{(c.current_quote||'').substring(0,120)}"
                      </div>
                      <div style={{ fontSize: '11px', color: '#666' }}>
                        <strong>Historical ({(c.historical_date||'').substring(0,7)}):</strong> "{(c.historical_quote||'').substring(0,120)}"
                        {c.historical_source && <span style={{ color: '#999' }}> — {c.historical_source}</span>}
                      </div>
                      {c.reasoning && (
                        <div style={{ fontSize: '10px', color: '#999', marginTop: '5px', fontStyle: 'italic' }}>
                          AI: {c.reasoning}
                        </div>
                      )}
                    </div>
                  ))}
                </Section>
              )}

              {/* Competitors */}
              {competitors.length > 0 && (
                <Section title="10. COMPETITOR INTELLIGENCE">
                  {competitors.map(c => {
                    const cf = feed.filter(f => f.headline.toLowerCase().includes(c.politician.name.split(' ').slice(-1)[0].toLowerCase()))
                    const pos = cf.filter(f=>f.sentiment==='positive').length
                    const neg = cf.filter(f=>f.sentiment==='negative').length
                    return (
                      <div key={c.politician.id} style={{ padding: '10px 12px', background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', marginBottom: '8px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                          <span style={{ fontSize: '12px', fontWeight: 600, color: '#222', flex: 1 }}>{c.politician.name}</span>
                          <span style={{ fontSize: '10px', color: '#999' }}>{c.politician.party}</span>
                          <span style={{ fontSize: '10px', color: '#0d1018', fontWeight: 600 }}>{cf.length} mentions</span>
                        </div>
                        <div style={{ display: 'flex', gap: '12px' }}>
                          <span style={{ fontSize: '10px', color: '#059669' }}>+{pos} positive</span>
                          <span style={{ fontSize: '10px', color: '#dc2626' }}>-{neg} negative</span>
                          <span style={{ fontSize: '10px', color: '#dc2626' }}>{cf.filter(f=>f.bucket==='red').length} crisis</span>
                        </div>
                      </div>
                    )
                  })}
                </Section>
              )}

              {/* Topics */}
              {analytics.topTopics.length > 0 && (
                <Section title="11. TOP TOPICS">
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                    {analytics.topTopics.map(([t, n]) => (
                      <div key={t} style={{ background: '#fafafa', border: '1px solid #eee', borderRadius: '6px', padding: '8px 10px', textAlign: 'center' }}>
                        <div style={{ fontSize: '12px', fontWeight: 700, color: '#f97316' }}>{n}</div>
                        <div style={{ fontSize: '10px', color: '#666', marginTop: '2px' }}>{t}</div>
                      </div>
                    ))}
                  </div>
                </Section>
              )}

              {/* Footer */}
              <div style={{ borderTop: '1px solid #eee', paddingTop: '24px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ fontSize: '10px', color: '#999' }}>
                  BHARATMONITOR v2.0 · POLITICAL INTELLIGENCE PLATFORM · CONFIDENTIAL
                </div>
                <div style={{ fontSize: '10px', color: '#999' }}>
                  Generated {generatedAt} IST · Data covers last 7 days
                </div>
              </div>
            </>
          )
        })()}
      </div>

      <style>{`
        @media print {
          .no-print { display: none !important; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          @page { margin: 15mm; size: A4; }
        }
      `}</style>
    </div>
  )
}
