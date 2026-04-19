import { useNavigate } from 'react-router-dom'
import { useAccount, useFeedItems, useContradictions } from '@/hooks/useData'
import NavBar from '@/components/layout/NavBar'
import { useMemo } from 'react'

export default function NarrativeGapsPage() {
  const navigate = useNavigate()
  const { data: account } = useAccount()
  const { data: feed = [] } = useFeedItems(account?.id || '')
  const { data: contradictions = [] } = useContradictions(account?.id || '')

  // Find topic gaps: keywords with no/low coverage
  const topicGaps = useMemo(() => {
    const kws = account?.keywords || []
    return kws.map(kw => {
      const items = feed.filter(f =>
        f.headline?.toLowerCase().includes(kw.toLowerCase()) ||
        (f as any).keyword === kw
      )
      const positive = items.filter(f => f.sentiment === 'positive').length
      const total = Math.max(items.length, 1)
      return {
        keyword: kw,
        count: items.length,
        positivePct: Math.round((positive / total) * 100),
        gap: items.length < 3,
      }
    }).sort((a, b) => a.count - b.count)
  }, [feed, account?.keywords])

  // Opposition pressure keywords
  const pressureItems = feed
    .filter(f => f.bucket === 'red' || f.bucket === 'yellow')
    .slice(0, 8)

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <NavBar />

      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '24px 20px' }}>
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)', letterSpacing: '2px', marginBottom: '6px' }}>CONTENT STRATEGY</div>
          <div style={{ fontSize: '18px', fontWeight: 600, color: '#edf0f8' }}>Narrative Gaps & Opportunities</div>
          <div style={{ fontSize: '12px', color: 'var(--t2)', marginTop: '6px' }}>Topics with low coverage that need your voice, plus contradiction opportunities.</div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '16px' }}>
          {/* Topic gap analysis */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>KEYWORD COVERAGE GAPS</div>
            {topicGaps.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)' }}>
                No keywords configured. Add keywords in Settings → Account Profile.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {topicGaps.map(g => (
                  <div key={g.keyword} style={{ padding: '10px 12px', background: g.gap ? 'rgba(240,62,62,0.06)' : 'var(--s2)', border: `1px solid ${g.gap ? 'rgba(240,62,62,0.2)' : 'var(--b0)'}`, borderRadius: '7px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '11px', color: 'var(--t0)', marginBottom: '2px' }}>{g.keyword}</div>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)' }}>
                        {g.count} items · {g.positivePct}% positive
                      </div>
                    </div>
                    {g.gap && (
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', padding: '2px 5px', borderRadius: '3px', background: 'rgba(240,62,62,0.1)', color: 'var(--red)', border: '1px solid rgba(240,62,62,0.2)' }}>
                        GAP
                      </span>
                    )}
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px', color: g.count > 5 ? 'var(--grn)' : g.count > 0 ? 'var(--yel)' : 'var(--red)', fontWeight: 600 }}>{g.count}</div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Contradictions */}
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '18px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--yel)', letterSpacing: '1px', marginBottom: '14px' }}>⚡ CONTRADICTION OPPORTUNITIES ({contradictions.length})</div>
            {contradictions.length === 0 ? (
              <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)' }}>
                No contradictions detected yet. The AI engine scans for these automatically.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {contradictions.slice(0, 6).map((c: any) => (
                  <div key={c.id} style={{ padding: '10px 12px', background: 'rgba(245,166,35,0.05)', border: '1px solid rgba(245,166,35,0.18)', borderRadius: '7px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--yel)', flex: 1 }}>{c.contradiction_type?.replace(/_/g,' ').toUpperCase()}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--yel)', fontWeight: 700 }}>{c.contradiction_score}%</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--t1)' }}>{c.politician_name}</div>
                    <div style={{ fontSize: '9px', color: 'var(--t3)', marginTop: '3px', lineHeight: 1.4 }}>
                      "{c.historical_quote?.substring(0, 80)}…"
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Opposition pressure */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '18px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--red)', letterSpacing: '1px', marginBottom: '14px' }}>ACTIVE PRESSURE POINTS</div>
          {pressureItems.length === 0 ? (
            <div style={{ padding: '20px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)' }}>No crisis or developing signals currently — situation stable.</div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
              {pressureItems.map(item => {
                const c = item.bucket === 'red' ? '#f03e3e' : '#f5a623'
                return (
                  <div key={item.id} onClick={() => item.url && window.open(item.url, '_blank')} style={{ padding: '10px 12px', background: `${c}08`, border: `1px solid ${c}20`, borderRadius: '7px', cursor: 'pointer' }}>
                    <div style={{ display: 'flex', gap: '6px', marginBottom: '4px', alignItems: 'center' }}>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: c }}>{item.bucket.toUpperCase()}</span>
                      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)', marginLeft: 'auto' }}>{item.platform}</span>
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--t0)', lineHeight: 1.5 }}>{item.headline?.substring(0, 80)}</div>
                    <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)', marginTop: '4px' }}>{item.source}</div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
