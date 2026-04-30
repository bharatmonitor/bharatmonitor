// MetaAdsTracker — shows Meta/Facebook political ad spend
// Uses Meta Ad Library API (public, no auth for basic search)
// Tracks ads by page name derived from account keywords

import { useState, useEffect } from 'react'
import type { Account } from '@/types'

const mono = 'IBM Plex Mono, monospace'
const META_TOKEN = import.meta.env.VITE_META_ACCESS_TOKEN || ''

interface MetaAd {
  id:          string
  page_name:   string
  ad_creative_bodies?: string[]
  spend?:      { lower_bound: string; upper_bound: string }
  impressions?: { lower_bound: string; upper_bound: string }
  delivery_start_time: string
  ad_snapshot_url: string
}

interface Props {
  account: Account
}

export default function MetaAdsTracker({ account }: Props) {
  const [ads, setAds]       = useState<MetaAd[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError]   = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  // Build search terms from politician name + party
  const searchTerms = [
    account.politician_name,
    account.party,
    ...(account.tracked_politicians || [])
      .filter(p => p.is_competitor)
      .map(p => p.name)
      .slice(0, 2),
  ].filter(Boolean)

  async function fetchAds() {
    if (!META_TOKEN || !searchTerms[0]) {
      setError('Meta token not configured')
      return
    }
    setLoading(true)
    setError(null)
    try {
      const results: MetaAd[] = []
      // Search for each term
      for (const term of searchTerms.slice(0, 2)) {
        const params = new URLSearchParams({
          access_token: META_TOKEN,
          ad_type: 'POLITICAL_AND_ISSUE_ADS',
          ad_reached_countries: '["IN"]',
          search_terms: term,
          fields: 'id,page_name,ad_creative_bodies,spend,impressions,delivery_start_time,ad_snapshot_url',
          limit: '5',
        })
        const r = await fetch(`https://graph.facebook.com/v18.0/ads_archive?${params}`, {
          signal: AbortSignal.timeout(12000),
        })
        if (!r.ok) {
          const e = await r.json().catch(() => ({}))
          if (e?.error?.code === 190) { setError('Meta token expired — update in Settings'); break }
          continue
        }
        const d = await r.json()
        results.push(...(d.data || []))
      }
      // Deduplicate
      const seen = new Set<string>()
      setAds(results.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true }))
    } catch (e: any) {
      setError(`Fetch error: ${e.message}`)
    }
    setLoading(false)
  }

  useEffect(() => { fetchAds() }, [account.id])

  return (
    <div style={{ marginTop: '0' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', cursor: 'pointer', borderTop: '1px solid var(--b0)' }}
        onClick={() => setExpanded(e => !e)}>
        <span style={{ fontFamily: mono, fontSize: '8px', color: '#1877f2', letterSpacing: '1px', flex: 1 }}>META ADS TRACKER</span>
        {ads.length > 0 && <span style={{ fontFamily: mono, fontSize: '8px', color: '#1877f2', background: 'rgba(24,119,242,0.12)', padding: '2px 6px', borderRadius: '3px' }}>{ads.length}</span>}
        <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>{expanded ? '▲' : '▼'}</span>
      </div>

      {expanded && (
        <div style={{ padding: '0 12px 10px' }}>
          {loading && (
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)', padding: '8px 0' }}>
              Fetching Meta Ads Library…
            </div>
          )}
          {error && (
            <div style={{ fontFamily: mono, fontSize: '8px', color: '#f5a623', padding: '6px 8px', background: 'rgba(245,166,35,0.08)', borderRadius: '5px', marginBottom: '6px' }}>
              {error}
            </div>
          )}
          {!loading && !error && ads.length === 0 && (
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)', padding: '8px 0' }}>
              No active political ads found for tracked terms.
            </div>
          )}
          {ads.map(ad => (
            <div key={ad.id} style={{ padding: '7px 8px', background: 'var(--s2)', border: '1px solid rgba(24,119,242,0.15)', borderRadius: '6px', marginBottom: '6px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
                <span style={{ fontSize: '10px' }}>📘</span>
                <span style={{ fontFamily: mono, fontSize: '9px', color: '#1877f2', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {ad.page_name}
                </span>
              </div>
              {ad.ad_creative_bodies?.[0] && (
                <div style={{ fontSize: '10px', color: 'var(--t1)', lineHeight: 1.5, marginBottom: '5px' }}>
                  {ad.ad_creative_bodies[0].substring(0, 100)}…
                </div>
              )}
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                {ad.spend && (
                  <span style={{ fontFamily: mono, fontSize: '7px', color: '#22d3a0' }}>
                    ₹{parseInt(ad.spend.lower_bound || '0').toLocaleString('en-IN')}–{parseInt(ad.spend.upper_bound || '0').toLocaleString('en-IN')} spent
                  </span>
                )}
                {ad.impressions && (
                  <span style={{ fontFamily: mono, fontSize: '7px', color: '#8892a4' }}>
                    {parseInt(ad.impressions.lower_bound || '0').toLocaleString('en-IN')}+ impressions
                  </span>
                )}
                {ad.delivery_start_time && (
                  <span style={{ fontFamily: mono, fontSize: '7px', color: '#8892a4' }}>
                    Since {new Date(ad.delivery_start_time).toLocaleDateString('en-IN', { day:'2-digit', month:'short' })}
                  </span>
                )}
              </div>
              {ad.ad_snapshot_url && (
                <a href={ad.ad_snapshot_url} target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: mono, fontSize: '7px', color: '#1877f2', textDecoration: 'none', marginTop: '3px', display: 'block' }}
                  onMouseEnter={e => { e.currentTarget.style.textDecoration = 'underline' }}
                  onMouseLeave={e => { e.currentTarget.style.textDecoration = 'none' }}>
                  View ad ↗
                </a>
              )}
            </div>
          ))}
          <button onClick={fetchAds} disabled={loading} style={{ fontFamily: mono, fontSize: '8px', color: '#1877f2', background: 'none', border: '1px solid rgba(24,119,242,0.3)', borderRadius: '4px', padding: '4px 10px', cursor: 'pointer', width: '100%', marginTop: '4px' }}>
            {loading ? 'Loading…' : '↻ Refresh Ads'}
          </button>
          <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', marginTop: '6px', lineHeight: 1.6 }}>
            Tracking: {searchTerms.join(', ')}
          </div>
        </div>
      )}
    </div>
  )
}
