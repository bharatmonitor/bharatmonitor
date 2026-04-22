import { useState, useRef, useEffect } from 'react'
import { clientFetchNews } from '@/lib/clientIngest'
import { sweepAllTwitterSources } from '@/lib/twitterSources'

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
  { label: 'Name',      placeholder: 'e.g. Narendra Modi',    icon: '◎' },
  { label: 'Party',     placeholder: 'e.g. BJP',              icon: '⬡' },
  { label: 'Geography', placeholder: 'e.g. Varanasi, UP',     icon: '◈' },
  { label: 'Issue',     placeholder: 'e.g. inflation, farmers', icon: '◆' },
  { label: 'Scheme',    placeholder: 'e.g. Make in India',    icon: '◇' },
]

const SENTIMENT_CONFIG = {
  positive: { color: '#22d3a0', bg: 'rgba(34,211,160,0.1)',   label: 'POSITIVE' },
  negative: { color: '#f03e3e', bg: 'rgba(240,62,62,0.1)',    label: 'NEGATIVE' },
  neutral:  { color: '#8892a4', bg: 'rgba(136,146,164,0.1)',  label: 'NEUTRAL'  },
  mixed:    { color: '#f5a623', bg: 'rgba(245,166,35,0.1)',   label: 'MIXED'    },
}
const URGENCY_CONFIG = {
  high:   { color: '#f03e3e', label: 'HIGH URGENCY' },
  medium: { color: '#f5a623', label: 'WATCH'        },
  low:    { color: '#22d3a0', label: 'STABLE'       },
}
const PLAT_SENT = { pos: '#22d3a0', neg: '#f03e3e', neu: '#8892a4' }

const SCAN_ACCOUNT = 'quickscan-live'

export default function QuickScan() {
  const [isOpen,       setIsOpen]       = useState(false)
  const [keywords,     setKeywords]     = useState(['', '', '', '', ''])
  const [scanning,     setScanning]     = useState(false)
  const [scanProgress, setScanProgress] = useState(0)
  const [scanPhase,    setScanPhase]    = useState('')
  const [results,      setResults]      = useState<ScanResult[]>([])
  const intervalRef = useRef<ReturnType<typeof setInterval>>()

  function updateKeyword(i: number, val: string) {
    setKeywords(prev => { const n = [...prev]; n[i] = val; return n })
  }

  async function runScan() {
    const activeKws = keywords.filter(k => k.trim())
    if (!activeKws.length) return

    setScanning(true)
    setResults([])
    setScanProgress(10)
    setIsOpen(true)

    const phases = [
      'Querying Google News RSS…',
      'Scanning Twitter/X via XPOZ + GetX…',
      'Fetching YouTube data…',
      'Scanning Reddit India…',
      'Running sentiment analysis…',
      'Building intelligence brief…',
    ]
    let phaseIdx = 0
    setScanPhase(phases[0])
    intervalRef.current = setInterval(() => {
      phaseIdx = Math.min(phaseIdx + 1, phases.length - 1)
      setScanPhase(phases[phaseIdx])
      setScanProgress(prev => Math.min(prev + 14, 88))
    }, 900)

    try {
      // Run all sources in parallel — client-side, no edge function needed
      const [newsItems, twitterItems] = await Promise.allSettled([
        clientFetchNews(SCAN_ACCOUNT, activeKws, 15),
        sweepAllTwitterSources(activeKws, SCAN_ACCOUNT, { maxPerKeyword: 15, dateRange: 'week' }),
      ])

      const news    = newsItems.status    === 'fulfilled' ? newsItems.value    : []
      const twitter = twitterItems.status === 'fulfilled' ? twitterItems.value : []
      const allItems = [...news, ...twitter]

      // Build per-keyword results
      const liveResults: ScanResult[] = activeKws.map(kw => {
        const kwLower = kw.toLowerCase()
        const matched = allItems.filter(item =>
          item.headline?.toLowerCase().includes(kwLower) ||
          item.body?.toLowerCase().includes(kwLower) ||
          item.keyword?.toLowerCase() === kwLower
        )

        // Sentiment scoring
        const pos     = matched.filter(i => i.sentiment === 'positive').length
        const neg     = matched.filter(i => i.sentiment === 'negative').length
        const total   = Math.max(matched.length, 1)
        const posRatio = pos / total
        const negRatio = neg / total
        const score   = Math.round(50 + (posRatio - negRatio) * 50)

        const sentiment: ScanResult['sentiment'] =
          posRatio > 0.6                      ? 'positive' :
          negRatio > 0.6                      ? 'negative' :
          posRatio > 0.25 && negRatio > 0.25  ? 'mixed'    : 'neutral'

        const urgency: ScanResult['urgency'] =
          matched.filter(i => i.bucket === 'red').length > 2    ? 'high'   :
          matched.filter(i => i.bucket === 'yellow').length > 2 ? 'medium' : 'low'

        const twitterMatched = matched.filter(i => i.platform === 'twitter')
        const newsMatched    = matched.filter(i => i.platform === 'news')
        const ytMatched      = matched.filter(i => i.platform === 'youtube')
        const redditMatched  = matched.filter(i => i.platform === 'reddit')

        const top       = matched[0]
        const topDate   = top?.published_at ? new Date(top.published_at) : null
        const timeAgo   = topDate ? topDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }) : '—'

        // Related terms from topic tags
        const relatedTerms = [
          ...new Set(
            matched.flatMap(i => [...(i.topic_tags || []), ...(i.geo_tags || [])])
          ),
        ].filter(t => t.toLowerCase() !== kwLower).slice(0, 5)

        const avgTone = matched.length
          ? matched.reduce((s, i) => s + (i.tone || 0), 0) / matched.length
          : 0

        return {
          keyword:      kw,
          sentiment,
          sentimentScore: Math.max(0, Math.min(100, score)),
          urgency,
          topHeadline:  top?.headline || `Scanned "${kw}" across all platforms.`,
          topSource:    top?.source   || '—',
          timeAgo,
          volume:       matched.length > 0 ? `${matched.length} results` : 'No results',
          trend:        (avgTone > 0.5 ? 'rising' : avgTone < -0.5 ? 'falling' : 'stable') as ScanResult['trend'],
          aiSummary:    matched.length > 0
            ? `Found ${matched.length} items for "${kw}" — ${newsMatched.length} news, ${twitterMatched.length} X posts, ${ytMatched.length} YouTube, ${redditMatched.length} Reddit. Avg sentiment: ${sentiment}.${urgency === 'high' ? ' ⚡ Crisis signals detected — monitor closely.' : ''}`
            : `No live results found for "${kw}". Try broader keywords or check your API keys.`,
          relatedTerms: relatedTerms.length > 0 ? relatedTerms : ['India', 'BJP', 'politics', 'news'],
          platforms: [
            { name: 'X/Twitter', count: twitterMatched.length, sentiment: (twitterMatched.filter(i=>i.sentiment==='positive').length > twitterMatched.filter(i=>i.sentiment==='negative').length ? 'pos' : 'neg') as 'pos'|'neg'|'neu' },
            { name: 'News',      count: newsMatched.length,    sentiment: 'neu' as const },
            { name: 'YouTube',   count: ytMatched.length,      sentiment: 'neu' as const },
            { name: 'Reddit',    count: redditMatched.length,  sentiment: 'neu' as const },
          ].filter(p => p.count > 0),
        }
      })

      clearInterval(intervalRef.current)
      setResults(liveResults)
      setScanProgress(100)
      setScanPhase('Scan complete')
    } catch (err) {
      clearInterval(intervalRef.current)
      setResults(activeKws.map(kw => ({
        keyword: kw, sentiment: 'neutral' as const, sentimentScore: 0,
        volume: '—', topHeadline: 'Fetch failed — check your connection and API keys.',
        topSource: '—', timeAgo: '—', platforms: [],
        trend: 'stable' as const, urgency: 'low' as const,
        aiSummary: `Scan failed for "${kw}". Check browser console for details.`,
        relatedTerms: [],
      })))
      setScanProgress(100)
    }
    setScanning(false)
  }

  useEffect(() => () => clearInterval(intervalRef.current), [])

  return (
    <>
      {/* Trigger button */}
      <button
        onClick={() => setIsOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: '5px',
          padding: '5px 10px', borderRadius: '6px',
          background: 'rgba(124,109,250,0.12)', border: '1px solid rgba(124,109,250,0.28)',
          color: '#a89ef8', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace',
          fontSize: '8px', letterSpacing: '0.5px', transition: 'all .15s',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,109,250,0.2)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,109,250,0.12)' }}
      >
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
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', marginTop: '1px' }}>LIVE · XPOZ + GETX + GOOGLE NEWS + REDDIT</div>
              </div>
              <button onClick={() => setIsOpen(false)} style={{ marginLeft: 'auto', background: 'var(--s3)', border: '1px solid var(--b1)', color: 'var(--t2)', width: '24px', height: '24px', borderRadius: '5px', cursor: 'pointer', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>×</button>
            </div>
            <div style={{ fontSize: '11px', color: 'var(--t2)', marginTop: '6px', lineHeight: 1.5 }}>
              Enter up to 5 keywords. Scans Google News, X/Twitter, YouTube and Reddit in real-time.
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
                  flex: 1, padding: '10px', border: 'none', borderRadius: '7px',
                  cursor: scanning ? 'not-allowed' : 'pointer',
                  background: scanning ? 'rgba(124,109,250,0.3)' : 'var(--acc)',
                  color: '#fff', fontFamily: 'IBM Plex Mono, monospace',
                  fontSize: '10px', letterSpacing: '1px',
                  opacity: !keywords.some(k => k.trim()) ? 0.4 : 1,
                }}>
                {scanning ? `${scanProgress}% — ${scanPhase}` : '⚡ RUN SCAN'}
              </button>
              {results.length > 0 && !scanning && (
                <button
                  onClick={() => { setResults([]); setKeywords(['', '', '', '', '']) }}
                  style={{ padding: '10px 14px', border: '1px solid var(--b1)', borderRadius: '7px', background: 'transparent', color: 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', cursor: 'pointer' }}>
                  CLEAR
                </button>
              )}
            </div>

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
                  ENTER KEYWORDS ABOVE<br />RUN A REAL-TIME SCAN<br />ACROSS ALL PLATFORMS
                </div>
              </div>
            )}

            {scanning && (
              <div style={{ padding: '30px 20px' }}>
                {keywords.filter(k => k.trim()).map((kw, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '8px', marginBottom: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid var(--acc)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', flexShrink: 0 }} />
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
                  <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px', marginBottom: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', color: '#edf0f8', fontWeight: 500 }}>"{result.keyword}"</span>
                        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', padding: '2px 5px', borderRadius: '3px', background: uc.color + '18', color: uc.color, border: `1px solid ${uc.color}30` }}>{uc.label}</span>
                      </div>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)' }}>
                        {result.volume} · {result.trend === 'rising' ? '▲ RISING' : result.trend === 'falling' ? '▼ FALLING' : '— STABLE'}
                      </div>
                    </div>
                    <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: sc.bg, border: `2px solid ${sc.color}`, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', fontWeight: 700, color: sc.color, lineHeight: 1 }}>{result.sentimentScore}</div>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '6px', color: sc.color, opacity: 0.8 }}>SCORE</div>
                    </div>
                  </div>

                  <div style={{ padding: '8px 10px', background: 'var(--s2)', borderRadius: '6px', border: '1px solid var(--b1)', marginBottom: '10px' }}>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)', marginBottom: '4px', display: 'flex', justifyContent: 'space-between' }}>
                      <span>TOP HEADLINE</span>
                      <span>{result.topSource} · {result.timeAgo}</span>
                    </div>
                    <div style={{ fontSize: '11px', color: 'var(--t0)', lineHeight: 1.5 }}>{result.topHeadline}</div>
                  </div>

                  {result.platforms.length > 0 && (
                    <div style={{ marginBottom: '10px' }}>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px', marginBottom: '6px' }}>PLATFORM BREAKDOWN</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        {result.platforms.map(p => (
                          <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', width: '64px', flexShrink: 0 }}>{p.name}</span>
                            <div style={{ flex: 1, height: '3px', background: 'var(--s3)', borderRadius: '3px', overflow: 'hidden' }}>
                              <div style={{ height: '100%', background: PLAT_SENT[p.sentiment], borderRadius: '3px', width: `${Math.min(100, (p.count / Math.max(...result.platforms.map(x => x.count), 1)) * 100)}%` }} />
                            </div>
                            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: PLAT_SENT[p.sentiment], minWidth: '40px', textAlign: 'right' }}>{p.count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div style={{ padding: '8px 10px', background: 'rgba(124,109,250,0.06)', border: '1px solid rgba(124,109,250,0.15)', borderRadius: '6px', marginBottom: '8px' }}>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--acc)', letterSpacing: '1px', marginBottom: '4px' }}>◈ AI SUMMARY</div>
                    <div style={{ fontSize: '11px', color: 'var(--t1)', lineHeight: 1.6 }}>{result.aiSummary}</div>
                  </div>

                  <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
                    {result.relatedTerms.map(term => (
                      <button key={term}
                        onClick={() => {
                          const emptyIdx = keywords.findIndex(k => !k.trim())
                          if (emptyIdx >= 0) updateKeyword(emptyIdx, term)
                        }}
                        style={{ padding: '2px 7px', borderRadius: '20px', border: '1px solid var(--b1)', background: 'transparent', color: 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', cursor: 'pointer' }}
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
                  Scanned {results.length} keyword{results.length > 1 ? 's' : ''} across 4 platforms.{' '}
                  {results.filter(r => r.urgency === 'high').length > 0
                    ? `⚡ ${results.filter(r => r.urgency === 'high').length} high-urgency signal(s) detected — immediate attention recommended.`
                    : 'No high-urgency signals detected. Situation stable.'}{' '}
                  Results refreshed {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })} IST.
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
