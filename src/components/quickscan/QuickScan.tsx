import { useState, useRef, useEffect } from 'react'

interface ScanResult {
  keyword: string
  sentiment: 'positive' | 'negative' | 'neutral' | 'mixed'
  sentimentScore: number
  volume: string
  topHeadline: string
  topSource: string
  timeAgo: string
  platforms: { name: string; count: number; sentiment: 'pos' | 'neg' | 'neu' }[]
  trend: 'rising' | 'falling' | 'stable'
  aiSummary: string
  relatedTerms: string[]
  urgency: 'high' | 'medium' | 'low'
}

const SCAN_TEMPLATES = [
  { label: 'Name', placeholder: 'e.g. Narendra Modi', icon: '◎' },
  { label: 'Party', placeholder: 'e.g. BJP', icon: '⬡' },
  { label: 'Geography', placeholder: 'e.g. Varanasi, UP', icon: '◈' },
  { label: 'Issue', placeholder: 'e.g. inflation, farmers', icon: '◆' },
  { label: 'Scheme', placeholder: 'e.g. Make in India', icon: '◇' },
]

// Simulated scan results for demo
function generateMockResult(keyword: string, index: number): ScanResult {
  const scenarios: Record<string, ScanResult> = {
    default0: {
      keyword, sentiment: 'mixed', sentimentScore: 68,
      volume: '2.4M mentions', topHeadline: `${keyword} dominates political discourse — supporters rally as opposition mounts pressure`,
      topSource: 'NDTV', timeAgo: '12m ago',
      platforms: [
        { name: 'X/Twitter', count: 891000, sentiment: 'neg' },
        { name: 'Instagram', count: 620000, sentiment: 'pos' },
        { name: 'Facebook', count: 480000, sentiment: 'pos' },
        { name: 'News', count: 410000, sentiment: 'neu' },
      ],
      trend: 'rising', urgency: 'high',
      aiSummary: `"${keyword}" is trending across all major platforms. Opposition campaign driving negative spikes on Twitter while BJP content performs strongly on Instagram and Facebook. Net sentiment positive but declining.`,
      relatedTerms: ['BJP', 'election', 'India', 'development', 'opposition'],
    },
    default1: {
      keyword, sentiment: 'positive', sentimentScore: 81,
      volume: '680K mentions', topHeadline: `${keyword} gains momentum — grassroots support visible across Hindi belt states`,
      topSource: 'ANI', timeAgo: '34m ago',
      platforms: [
        { name: 'X/Twitter', count: 210000, sentiment: 'pos' },
        { name: 'WhatsApp', count: 280000, sentiment: 'pos' },
        { name: 'Facebook', count: 140000, sentiment: 'pos' },
        { name: 'News', count: 50000, sentiment: 'neu' },
      ],
      trend: 'rising', urgency: 'low',
      aiSummary: `"${keyword}" showing strong positive sentiment with WhatsApp forwarding surging in Hindi belt. No coordinated opposition campaign detected. Organic growth pattern.`,
      relatedTerms: ['Viksit Bharat', 'development', 'rural', 'scheme', 'growth'],
    },
    default2: {
      keyword, sentiment: 'negative', sentimentScore: 38,
      volume: '1.1M mentions', topHeadline: `${keyword}: Opposition intensifies campaign — INDIA bloc coordinating cross-platform attack`,
      topSource: 'THE HINDU', timeAgo: '5m ago',
      platforms: [
        { name: 'X/Twitter', count: 520000, sentiment: 'neg' },
        { name: 'Instagram', count: 290000, sentiment: 'neg' },
        { name: 'Facebook', count: 210000, sentiment: 'neg' },
        { name: 'YouTube', count: 80000, sentiment: 'neu' },
      ],
      trend: 'rising', urgency: 'high',
      aiSummary: `"${keyword}" facing coordinated opposition campaign. Negative sentiment dominant across all platforms. Potential crisis narrative forming — monitor closely for escalation in next 2-4 hours.`,
      relatedTerms: ['opposition', 'INDIA bloc', 'Congress', 'protest', 'criticism'],
    },
    default3: {
      keyword, sentiment: 'neutral', sentimentScore: 54,
      volume: '340K mentions', topHeadline: `${keyword} updates: Steady coverage with policy analysis dominating the discourse`,
      topSource: 'ECONOMIC TIMES', timeAgo: '1h ago',
      platforms: [
        { name: 'News', count: 180000, sentiment: 'neu' },
        { name: 'X/Twitter', count: 95000, sentiment: 'neu' },
        { name: 'LinkedIn', count: 65000, sentiment: 'pos' },
      ],
      trend: 'stable', urgency: 'low',
      aiSummary: `"${keyword}" generating balanced coverage. Policy discussion dominant with no strong emotional triggers. Volume stable — not trending. Safe news cycle.`,
      relatedTerms: ['policy', 'government', 'economy', 'analysis', 'data'],
    },
    default4: {
      keyword, sentiment: 'positive', sentimentScore: 74,
      volume: '520K mentions', topHeadline: `${keyword} generating strong grassroots support — regional media coverage positive`,
      topSource: 'MANORAMA', timeAgo: '22m ago',
      platforms: [
        { name: 'WhatsApp', count: 210000, sentiment: 'pos' },
        { name: 'Facebook', count: 170000, sentiment: 'pos' },
        { name: 'X/Twitter', count: 90000, sentiment: 'neu' },
        { name: 'News', count: 50000, sentiment: 'pos' },
      ],
      trend: 'rising', urgency: 'medium',
      aiSummary: `"${keyword}" performing well in regional and vernacular content. WhatsApp circulation strong in target states. Regional language content outperforming English coverage by 3:1.`,
      relatedTerms: ['regional', 'vernacular', 'Hindi belt', 'grassroots', 'local'],
    },
  }
  return scenarios[`default${index % 5}`] || scenarios['default0']
}

export default function QuickScan() {
  const [keywords, setKeywords] = useState<string[]>(['', '', '', '', ''])
  const [scanning, setScanning] = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [results, setResults] = useState<ScanResult[]>([])
  const [isOpen, setIsOpen] = useState(false)
  const [scanPhase, setScanPhase] = useState('')
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  function updateKeyword(i: number, val: string) {
    setKeywords(prev => { const n = [...prev]; n[i] = val; return n })
  }

  async function runScan() {
    const activeKws = keywords.filter(k => k.trim())
    if (!activeKws.length) return

    setScanning(true)
    setResults([])
    setScanProgress(0)
    setIsOpen(true)

    const phases = [
      'Querying Google News API…',
      'Scanning Twitter/X real-time…',
      'Analysing Instagram & Facebook…',
      'Processing WhatsApp signals…',
      'Running AI sentiment analysis…',
      'Cross-referencing historical data…',
      'Generating intelligence brief…',
    ]

    let phase = 0
    setScanPhase(phases[0])

    intervalRef.current = setInterval(() => {
      phase++
      if (phase < phases.length) {
        setScanPhase(phases[phase])
        setScanProgress(Math.round((phase / phases.length) * 100))
      }
    }, 600)

    await new Promise(r => setTimeout(r, phases.length * 600 + 400))
    clearInterval(intervalRef.current)

    const mockResults = activeKws.map((kw, i) => generateMockResult(kw, i))
    setResults(mockResults)
    setScanProgress(100)
    setScanPhase('Scan complete')
    setScanning(false)
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  const SENTIMENT_CONFIG = {
    positive: { color: '#22d3a0', bg: 'rgba(34,211,160,0.1)', border: 'rgba(34,211,160,0.2)', label: 'POSITIVE' },
    negative: { color: '#f03e3e', bg: 'rgba(240,62,62,0.1)',  border: 'rgba(240,62,62,0.2)',  label: 'NEGATIVE' },
    neutral:  { color: '#8892a4', bg: 'rgba(136,146,164,0.1)',border: 'rgba(136,146,164,0.2)',label: 'NEUTRAL'  },
    mixed:    { color: '#f5a623', bg: 'rgba(245,166,35,0.1)', border: 'rgba(245,166,35,0.2)', label: 'MIXED'    },
  }
  const URGENCY_CONFIG = {
    high:   { color: '#f03e3e', label: 'HIGH URGENCY' },
    medium: { color: '#f5a623', label: 'WATCH' },
    low:    { color: '#22d3a0', label: 'STABLE' },
  }
  const PLAT_SENT = { pos: '#22d3a0', neg: '#f03e3e', neu: '#8892a4' }

  return (
    <>
      {/* Trigger button — always visible in top bar */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '5px 12px', borderRadius: '6px',
          border: '1px solid rgba(124,109,250,0.35)',
          background: isOpen ? 'rgba(124,109,250,0.15)' : 'rgba(124,109,250,0.08)',
          color: '#a89ef8', fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '8px', letterSpacing: '1px', cursor: 'pointer',
          transition: 'all .15s', flexShrink: 0,
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,109,250,0.2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = isOpen ? 'rgba(124,109,250,0.15)' : 'rgba(124,109,250,0.08)' }}>
        <span style={{ fontSize: '10px' }}>⚡</span>
        QUICK SCAN
      </button>

      {/* Panel */}
      {isOpen && (
        <div style={{
          position: 'fixed', right: 0, top: 0, bottom: 0, width: '480px',
          background: '#0a0d14', borderLeft: '1px solid rgba(124,109,250,0.2)',
          zIndex: 400, display: 'flex', flexDirection: 'column',
          boxShadow: '-20px 0 60px rgba(0,0,0,0.6)',
          animation: 'slideInRight .25s ease-out',
        }}>

          {/* Header */}
          <div style={{ padding: '16px 18px 12px', borderBottom: '1px solid var(--b1)', flexShrink: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '4px' }}>
              <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'rgba(124,109,250,0.15)', border: '1px solid rgba(124,109,250,0.3)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>⚡</div>
              <div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: '#edf0f8', letterSpacing: '1px' }}>QUICK SCAN</div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', marginTop: '1px' }}>AI-POWERED · GOOGLE NEWS · SOCIAL SCAN</div>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ marginLeft: 'auto', background: 'var(--s3)', border: '1px solid var(--b1)', color: 'var(--t2)', width: '24px', height: '24px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '6px', lineHeight: 1.5 }}>
              Enter up to 5 keywords — name, party, constituency, issue, scheme. AI scans Google News, Twitter, Instagram, Facebook, WhatsApp and YouTube in real-time.
            </div>
          </div>

          {/* Keyword inputs */}
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--b1)', flexShrink: 0 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {SCAN_TEMPLATES.map((tmpl, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '60px', display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                    <span style={{ fontSize: '10px', color: 'var(--acc)', opacity: 0.7 }}>{tmpl.icon}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t2)', letterSpacing: '0.5px' }}>{tmpl.label.toUpperCase()}</span>
                  </div>
                  <input
                    value={keywords[i]}
                    onChange={e => updateKeyword(i, e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && !scanning && runScan()}
                    placeholder={tmpl.placeholder}
                    style={{
                      flex: 1, padding: '7px 10px', background: 'var(--s2)',
                      border: `1px solid ${keywords[i] ? 'rgba(124,109,250,0.35)' : 'var(--b1)'}`,
                      borderRadius: '6px', color: 'var(--t0)', fontSize: '12px',
                      fontFamily: 'IBM Plex Mono, monospace', outline: 'none',
                      transition: 'border-color .15s',
                    }}
                    onFocus={e => { e.currentTarget.style.borderColor = 'rgba(124,109,250,0.5)' }}
                    onBlur={e => { e.currentTarget.style.borderColor = keywords[i] ? 'rgba(124,109,250,0.35)' : 'var(--b1)' }}
                  />
                  {keywords[i] && (
                    <button onClick={() => updateKeyword(i, '')} style={{ background: 'none', border: 'none', color: 'var(--t3)', cursor: 'pointer', padding: '0 4px', fontSize: '14px' }}>×</button>
                  )}
                </div>
              ))}
            </div>

            <div style={{ display: 'flex', gap: '8px', marginTop: '12px' }}>
              <button
                onClick={runScan}
                disabled={scanning || !keywords.some(k => k.trim())}
                style={{
                  flex: 1, padding: '10px', border: 'none',
                  borderRadius: '7px', cursor: scanning ? 'not-allowed' : 'pointer',
                  background: scanning ? 'rgba(124,109,250,0.3)' : 'var(--acc)',
                  color: '#fff', fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '10px', letterSpacing: '1px', transition: 'all .15s',
                  opacity: !keywords.some(k => k.trim()) ? 0.4 : 1,
                }}>
                {scanning ? `${scanProgress}% — ${scanPhase}` : '⚡ RUN SCAN'}
              </button>
              {results.length > 0 && !scanning && (
                <button onClick={() => { setResults([]); setKeywords(['','','','','']) }} style={{ padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: '7px', background: 'transparent', color: 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', cursor: 'pointer' }}>CLEAR</button>
              )}
            </div>

            {/* Progress bar */}
            {scanning && (
              <div style={{ marginTop: '8px', height: '2px', background: 'var(--b1)', borderRadius: '2px', overflow: 'hidden' }}>
                <div style={{ height: '100%', background: 'var(--acc)', borderRadius: '2px', width: `${scanProgress}%`, transition: 'width .5s ease' }} />
              </div>
            )}
          </div>

          {/* Results */}
          <div style={{ flex: 1, overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'var(--b2) transparent' }}>
            {results.length === 0 && !scanning && (
              <div style={{ padding: '40px 20px', textAlign: 'center' }}>
                <div style={{ fontSize: '32px', marginBottom: '12px', opacity: 0.3 }}>⚡</div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)', letterSpacing: '1px', lineHeight: 2 }}>
                  ENTER KEYWORDS ABOVE<br />
                  RUN A REAL-TIME SCAN<br />
                  ACROSS ALL PLATFORMS
                </div>
              </div>
            )}

            {scanning && (
              <div style={{ padding: '30px 20px' }}>
                {keywords.filter(k => k.trim()).map((kw, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: `2px solid var(--acc)`, borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: 'var(--t1)' }}>{kw}</span>
                    <span style={{ marginLeft: 'auto', fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)' }}>SCANNING…</span>
                  </div>
                ))}
              </div>
            )}

            {results.map((result, i) => {
              const sc = SENTIMENT_CONFIG[result.sentiment]
              const uc = URGENCY_CONFIG[result.urgency]
              return (
                <div key={i} style={{ borderBottom: '1px solid var(--b0)', padding: '14px 18px' }}>
                  {/* Result header */}
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#edf0f8', fontWeight: 500 }}>"{result.keyword}"</span>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', padding: '2px 5px', borderRadius: '3px', background: uc.color + '18', color: uc.color, border: `1px solid ${uc.color}30` }}>{uc.label}</span>
                      </div>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)' }}>{result.volume} · {result.trend === 'rising' ? '▲ RISING' : result.trend === 'falling' ? '▼ FALLING' : '— STABLE'}</div>
                    </div>
                    {/* Sentiment ring */}
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: sc.bg, border: `2px solid ${sc.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: sc.color, lineHeight: 1 }}>{result.sentimentScore}</div>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '6px', color: sc.color, opacity: 0.8 }}>SCORE</div>
                    </div>
                  </div>

                  {/* Top headline */}
                  <div style={{ padding: '8px 10px', background: 'var(--s2)', borderRadius: '6px', border: '1px solid var(--b1)', marginBottom: '10px' }}>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>TOP HEADLINE</span>
                      <span>{result.topSource} · {result.timeAgo}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--t0)', lineHeight: 1.5 }}>{result.topHeadline}</div>
                  </div>

                  {/* Platform breakdown */}
                  <div style={{ marginBottom: '10px' }}>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px', marginBottom: '6px' }}>PLATFORM BREAKDOWN</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      {result.platforms.map(p => (
                        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', width: '64px', flexShrink: 0 }}>{p.name}</span>
                          <div style={{ flex: 1, height: '3px', background: 'var(--s3)', borderRadius: '3px', overflow: 'hidden' }}>
                            <div style={{ height: '100%', background: PLAT_SENT[p.sentiment], borderRadius: '3px', width: `${Math.min(100, (p.count / result.platforms[0].count) * 100)}%` }} />
                          </div>
                          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: PLAT_SENT[p.sentiment], minWidth: '40px', textAlign: 'right' }}>{(p.count / 1000).toFixed(0)}K</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* AI Summary */}
                  <div style={{ padding: '8px 10px', background: 'rgba(124,109,250,0.06)', border: '1px solid rgba(124,109,250,0.15)', borderRadius: '6px', marginBottom: '8px' }}>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--acc)', letterSpacing: '1px', marginBottom: '4px' }}>◈ AI SUMMARY</div>
                    <div style={{ fontSize: '11px', color: 'var(--t1)', lineHeight: 1.6 }}>{result.aiSummary}</div>
                  </div>

                  {/* Related terms */}
                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {result.relatedTerms.map(term => (
                      <button key={term} onClick={() => {
                        const emptyIdx = keywords.findIndex(k => !k.trim())
                        if (emptyIdx >= 0) updateKeyword(emptyIdx, term)
                      }} style={{ padding: '2px 7px', borderRadius: '20px', border: '1px solid var(--b1)', background: 'transparent', color: 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', cursor: 'pointer', transition: 'all .15s' }}
                        onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(124,109,250,0.3)'; e.currentTarget.style.color = 'var(--acc)' }}
                        onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--b1)'; e.currentTarget.style.color = 'var(--t2)' }}>
                        + {term}
                      </button>
                    ))}
                  </div>
                </div>
              )
            })}

            {results.length > 0 && !scanning && (
              <div style={{ padding: '12px 18px', background: 'rgba(124,109,250,0.05)', borderTop: '1px solid rgba(124,109,250,0.15)' }}>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--acc)', letterSpacing: '1px', marginBottom: '5px' }}>◈ OVERALL AI ASSESSMENT</div>
                <div style={{ fontSize: '11px', color: 'var(--t1)', lineHeight: 1.6 }}>
                  Scanned {results.length} keyword{results.length > 1 ? 's' : ''} across 6 platforms. {results.filter(r => r.urgency === 'high').length > 0 ? `⚡ ${results.filter(r => r.urgency === 'high').length} high-urgency signal${results.filter(r => r.urgency === 'high').length > 1 ? 's' : ''} detected — immediate attention recommended.` : 'No high-urgency signals detected. Situation stable.'} Results refreshed {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST.
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      <style>{`
        @keyframes slideInRight { from { transform: translateX(100%); opacity: 0 } to { transform: translateX(0); opacity: 1 } }
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </>
  )
}
