// MetaAdsTracker — Political ad spend via Meta Ad Library
// Calls bm-meta-ads edge function (server-side, no CORS issues)

import { useState, useEffect } from 'react'
import { SUPABASE_URL, ANON_KEY } from '@/lib/supabase'
import type { Account } from '@/types'

const mono       = '"IBM Plex Mono", monospace'
const BORDER     = 'rgba(255,255,255,0.07)'
const META_BLUE  = '#1877f2'
const GREEN      = '#22d3a0'
const RED        = '#f03e3e'
const YELLOW     = '#f5a623'
const T0         = '#edf0f8'
const T1         = '#c8d0e0'
const T2         = '#8892a4'
const T3         = '#545f78'
const CARD2      = '#161d2c'

interface MetaAd {
  id:                        string
  page_name?:                string
  page_id?:                  string
  ad_creative_bodies?:       string[]
  ad_creative_link_titles?:  string[]
  spend?:                    { lower_bound: string; upper_bound: string }
  impressions?:              { lower_bound: string; upper_bound: string }
  estimated_audience_size?:  { lower_bound: string; upper_bound: string }
  ad_delivery_start_time?:   string
  ad_delivery_stop_time?:    string
  ad_snapshot_url?:          string
  publisher_platforms?:      string[]
  bylines?:                  string[]
  currency?:                 string
  demographic_distribution?: { age: string; gender: string; percentage: string }[]
}

interface Props { account: Account }

export default function MetaAdsTracker({ account }: Props) {
  const [ads,      setAds]      = useState<MetaAd[]>([])
  const [loading,  setLoading]  = useState(false)
  const [error,    setError]    = useState<string | null>(null)
  const [setupMsg, setSetupMsg] = useState<string[] | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [selected, setSelected] = useState<MetaAd | null>(null)

  const searchTerms = [
    account.politician_name,
    account.party,
    ...(account.tracked_politicians || [])
      .filter(p => p.is_competitor).map(p => p.name).slice(0, 2),
  ].filter(Boolean) as string[]

  const META_TOKEN_FALLBACK = 'EAF5yjiYcxVYBRUmfQIEiTBdeIUKYHmMsBdzZCW1s2bu6v53vxCMehN2f6H8yIS9PjdxEQcW0QeQPgrJD8GJHVZACTlDVQzaIej13runDQgAfPuHLYqhNV24h9bw2CmwV4mUZAZARaI6lEythw7aVZAwz8GTZAacTkFqS3qkV4pDwkU2RajSsbTNjvTZCZCaSymxqoABeAt2eT4VqvSmQ8hBFymzL424aZB4QWeW4niL7NwxX181Ay9bsXmU2PUpkSEwKOlJF4gDv7hrAVaqZBOM0zR'

  async function fetchAdsDirect(term: string): Promise<MetaAd[]> {
    // Direct browser call to Meta Ad Library (works if CORS allows it)
    const params = new URLSearchParams({
      access_token: META_TOKEN_FALLBACK,
      ad_type: 'POLITICAL_AND_ISSUE_ADS',
      ad_reached_countries: '["IN"]',
      search_terms: term,
      fields: 'id,page_name,ad_creative_bodies,spend,impressions,ad_delivery_start_time,ad_snapshot_url,bylines,publisher_platforms',
      limit: '8',
    })
    const r = await fetch(`https://graph.facebook.com/v20.0/ads_archive?${params}`, {
      signal: AbortSignal.timeout(12_000),
    })
    const d = await r.json()
    if (!r.ok || d.error) {
      console.warn('[MetaAds] direct:', d.error?.message || d.error)
      return []
    }
    return d.data || []
  }

  async function fetchAds() {
    if (!searchTerms[0]) return
    setLoading(true)
    setError(null)
    setSetupMsg(null)

    // Try edge function first
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bm-meta-ads`, {
        method: 'POST',
        headers: {
          'Content-Type':  'application/json',
          'Authorization': `Bearer ${ANON_KEY}`,
          'apikey':        ANON_KEY,
        },
        body: JSON.stringify({ searchTerms: searchTerms.slice(0, 3), country: 'IN', limit: 10, token: META_TOKEN_FALLBACK }),
        signal: AbortSignal.timeout(20_000),
      })

      if (res.ok) {
        const data = await res.json()
        if (data.ok) {
          setAds(data.ads || [])
          setLoading(false)
          return
        }
        if (data.setup) { setSetupMsg(data.setup) }
        if (data.error) { setError(data.error) }
        setLoading(false)
        return
      }
    } catch {
      // Edge function not deployed — fall through to direct call
      console.log('[MetaAds] Edge function not available, trying direct API…')
    }

    // Fallback: call Meta API directly from browser
    try {
      const results: MetaAd[] = []
      for (const term of searchTerms.slice(0, 2)) {
        const ads = await fetchAdsDirect(term)
        results.push(...ads)
      }
      const seen = new Set<string>()
      setAds(results.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true }))
    } catch (e: any) {
      setError(`Unable to fetch Meta ads: ${e.message}. Deploy bm-meta-ads edge function.`)
    }
    setLoading(false)
  }

  useEffect(() => { if (expanded && ads.length === 0 && !error) fetchAds() }, [expanded])

  function formatINR(val: string) {
    const n = parseInt(val || '0')
    if (n >= 100000) return `₹${(n/100000).toFixed(1)}L`
    if (n >= 1000)   return `₹${(n/1000).toFixed(0)}K`
    return `₹${n}`
  }

  const totalSpendMin = ads.reduce((s, a) => s + parseInt(a.spend?.lower_bound || '0'), 0)
  const totalSpendMax = ads.reduce((s, a) => s + parseInt(a.spend?.upper_bound || '0'), 0)

  return (
    <div>
      {/* Header */}
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 14px', cursor:'pointer', borderTop:`1px solid ${BORDER}`, userSelect:'none' }}>
        <div style={{ width:'18px', height:'18px', borderRadius:'4px', background:'#1877f2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'10px', flexShrink:0 }}>f</div>
        <span style={{ fontFamily:mono, fontSize:'8px', color:META_BLUE, letterSpacing:'1px', flex:1 }}>META ADS TRACKER</span>
        {ads.length > 0 && (
          <span style={{ fontFamily:mono, fontSize:'7px', color:META_BLUE, background:'rgba(24,119,242,0.12)', padding:'2px 7px', borderRadius:'10px', border:'1px solid rgba(24,119,242,0.2)' }}>
            {ads.length} ads
          </span>
        )}
        {totalSpendMin > 0 && (
          <span style={{ fontFamily:mono, fontSize:'7px', color:GREEN }}>
            {formatINR(String(totalSpendMin))}+ spent
          </span>
        )}
        <span style={{ fontFamily:mono, fontSize:'9px', color:T3 }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding:'0 12px 12px' }}>

          {/* Loading */}
          {loading && (
            <div style={{ display:'flex', alignItems:'center', gap:'8px', padding:'10px 0', fontFamily:mono, fontSize:'8px', color:T3 }}>
              <div style={{ width:'10px', height:'10px', border:`2px solid ${META_BLUE}`, borderTopColor:'transparent', borderRadius:'50%', animation:'spin .8s linear infinite', flexShrink:0 }} />
              Fetching Meta Ad Library…
              <style>{`@keyframes spin{to{transform:rotate(360deg)}}`}</style>
            </div>
          )}

          {/* Setup instructions */}
          {setupMsg && (
            <div style={{ background:'rgba(24,119,242,0.06)', border:`1px solid rgba(24,119,242,0.2)`, borderRadius:'8px', padding:'12px 14px', marginBottom:'10px' }}>
              <div style={{ fontFamily:mono, fontSize:'8px', color:META_BLUE, fontWeight:700, marginBottom:'8px' }}>SETUP REQUIRED — Meta Ads Access Token</div>
              {setupMsg.map((step, i) => (
                <div key={i} style={{ fontFamily:mono, fontSize:'8px', color:T2, marginBottom:'4px', lineHeight:1.6 }}>
                  {step}
                </div>
              ))}
              <div style={{ fontFamily:mono, fontSize:'8px', color:YELLOW, marginTop:'8px', lineHeight:1.8 }}>
                After getting token, run in Terminal:<br/>
                <span style={{ color:GREEN }}>supabase secrets set META_ACCESS_TOKEN=your_token</span><br/>
                Then: <span style={{ color:GREEN }}>supabase functions deploy bm-meta-ads</span>
              </div>
            </div>
          )}

          {/* Error */}
          {error && !setupMsg && (
            <div style={{ fontFamily:mono, fontSize:'8px', color:YELLOW, padding:'8px 10px', background:'rgba(245,166,35,0.08)', border:`1px solid rgba(245,166,35,0.2)`, borderRadius:'6px', marginBottom:'8px', lineHeight:1.7 }}>
              ⚠ {error}
            </div>
          )}

          {/* Summary bar */}
          {ads.length > 0 && !loading && (
            <div style={{ display:'flex', gap:'10px', padding:'8px 10px', background:CARD2, borderRadius:'7px', marginBottom:'10px', flexWrap:'wrap' }}>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:mono, fontSize:'14px', fontWeight:700, color:META_BLUE }}>{ads.length}</div>
                <div style={{ fontFamily:mono, fontSize:'7px', color:T3 }}>ADS FOUND</div>
              </div>
              {totalSpendMin > 0 && (
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontFamily:mono, fontSize:'14px', fontWeight:700, color:GREEN }}>{formatINR(String(totalSpendMin))}–{formatINR(String(totalSpendMax))}</div>
                  <div style={{ fontFamily:mono, fontSize:'7px', color:T3 }}>SPEND RANGE</div>
                </div>
              )}
              <div style={{ textAlign:'center' }}>
                <div style={{ fontFamily:mono, fontSize:'14px', fontWeight:700, color:T1 }}>
                  {[...new Set(ads.map(a => a.page_name).filter(Boolean))].length}
                </div>
                <div style={{ fontFamily:mono, fontSize:'7px', color:T3 }}>PAGES</div>
              </div>
            </div>
          )}

          {/* No ads */}
          {!loading && !error && ads.length === 0 && !setupMsg && (
            <div style={{ fontFamily:mono, fontSize:'8px', color:T3, padding:'10px 0', lineHeight:1.8 }}>
              No active political ads found.<br/>
              Either no ads running right now, or token needs setup.
            </div>
          )}

          {/* Ad list */}
          {ads.map(ad => (
            <div key={ad.id}
              onClick={() => setSelected(selected?.id === ad.id ? null : ad)}
              style={{ padding:'9px 10px', background:CARD2, border:`1px solid rgba(24,119,242,0.15)`, borderRadius:'7px', marginBottom:'6px', cursor:'pointer', transition:'border-color .15s' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = 'rgba(24,119,242,0.4)' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'rgba(24,119,242,0.15)' }}>

              {/* Ad header */}
              <div style={{ display:'flex', alignItems:'center', gap:'6px', marginBottom:'5px' }}>
                <div style={{ width:'16px', height:'16px', borderRadius:'3px', background:'#1877f2', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'9px', flexShrink:0 }}>f</div>
                <span style={{ fontFamily:mono, fontSize:'9px', color:META_BLUE, fontWeight:600, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                  {ad.page_name || 'Unknown Page'}
                </span>
                {ad.ad_delivery_start_time && (
                  <span style={{ fontFamily:mono, fontSize:'7px', color:T3, flexShrink:0 }}>
                    {new Date(ad.ad_delivery_start_time).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                  </span>
                )}
              </div>

              {/* Ad text */}
              {ad.ad_creative_bodies?.[0] && (
                <div style={{ fontSize:'10px', color:T1, lineHeight:1.5, marginBottom:'5px' }}>
                  {ad.ad_creative_bodies[0].substring(0, selected?.id === ad.id ? 500 : 80)}
                  {!selected && ad.ad_creative_bodies[0].length > 80 ? '…' : ''}
                </div>
              )}

              {/* Stats row */}
              <div style={{ display:'flex', gap:'8px', flexWrap:'wrap', alignItems:'center' }}>
                {ad.spend && (
                  <span style={{ fontFamily:mono, fontSize:'7px', color:GREEN, background:'rgba(34,211,160,0.1)', padding:'2px 6px', borderRadius:'4px' }}>
                    {formatINR(ad.spend.lower_bound)}–{formatINR(ad.spend.upper_bound)} {ad.currency || 'INR'}
                  </span>
                )}
                {ad.impressions && (
                  <span style={{ fontFamily:mono, fontSize:'7px', color:T2 }}>
                    {parseInt(ad.impressions.lower_bound || '0').toLocaleString('en-IN')}+ impressions
                  </span>
                )}
                {ad.publisher_platforms && (
                  <span style={{ fontFamily:mono, fontSize:'7px', color:META_BLUE }}>
                    {ad.publisher_platforms.join(' · ')}
                  </span>
                )}
              </div>

              {/* Expanded detail */}
              {selected?.id === ad.id && (
                <div style={{ marginTop:'10px', paddingTop:'10px', borderTop:`1px solid ${BORDER}` }}>
                  {ad.bylines && ad.bylines.length > 0 && (
                    <div style={{ fontFamily:mono, fontSize:'8px', color:T2, marginBottom:'6px' }}>
                      Paid by: <span style={{ color:T0 }}>{ad.bylines.join(', ')}</span>
                    </div>
                  )}
                  {ad.estimated_audience_size && (
                    <div style={{ fontFamily:mono, fontSize:'8px', color:T2, marginBottom:'6px' }}>
                      Est. audience: <span style={{ color:T0 }}>
                        {parseInt(ad.estimated_audience_size.lower_bound||'0').toLocaleString('en-IN')}–
                        {parseInt(ad.estimated_audience_size.upper_bound||'0').toLocaleString('en-IN')}
                      </span>
                    </div>
                  )}
                  {ad.demographic_distribution && ad.demographic_distribution.length > 0 && (
                    <div style={{ marginBottom:'6px' }}>
                      <div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginBottom:'4px' }}>DEMOGRAPHICS</div>
                      <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                        {ad.demographic_distribution.slice(0,6).map((d, i) => (
                          <span key={i} style={{ fontFamily:mono, fontSize:'7px', color:T2, background:'rgba(255,255,255,0.04)', padding:'2px 6px', borderRadius:'3px' }}>
                            {d.age} {d.gender} {d.percentage}%
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {ad.ad_snapshot_url && (
                    <a href={ad.ad_snapshot_url} target="_blank" rel="noopener noreferrer"
                      style={{ fontFamily:mono, fontSize:'8px', color:META_BLUE, textDecoration:'none', display:'inline-flex', alignItems:'center', gap:'4px', marginTop:'4px' }}
                      onMouseEnter={e => { e.currentTarget.style.textDecoration='underline' }}
                      onMouseLeave={e => { e.currentTarget.style.textDecoration='none' }}>
                      View full ad ↗
                    </a>
                  )}
                </div>
              )}
            </div>
          ))}

          {/* Footer */}
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginTop:'6px' }}>
            <div style={{ fontFamily:mono, fontSize:'7px', color:T3 }}>
              Tracking: {searchTerms.slice(0,3).join(', ')}
            </div>
            <button onClick={fetchAds} disabled={loading}
              style={{ fontFamily:mono, fontSize:'7px', color:META_BLUE, background:'none', border:`1px solid rgba(24,119,242,0.3)`, borderRadius:'4px', padding:'3px 9px', cursor:'pointer' }}>
              {loading ? '…' : '↻ Refresh'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
