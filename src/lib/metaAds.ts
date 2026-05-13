// ============================================================
// BharatMonitor — Meta Ads Library Tracker
//
// Fetches active political ads from Facebook/Instagram Ads Library
// Uses tracked keywords + politician names from account settings
// Free API — no cost, just needs Meta access token
// ============================================================

import type { FeedItem } from '@/types'

const META_TOKEN = import.meta.env.VITE_META_ACCESS_TOKEN || ''

export interface MetaAd {
  id: string
  page_name: string
  ad_delivery_start_time: string
  ad_creative_bodies?: string[]
  ad_creative_link_titles?: string[]
  impressions?: { lower_bound: string; upper_bound: string }
  spend?: { lower_bound: string; upper_bound: string }
  region_distribution?: { region: string; percentage: number }[]
  demographic_distribution?: { age: string; gender: string; percentage: number }[]
  funding_entity?: string
  currency?: string
}

export async function fetchMetaAds(
  keywords: string[],
  options?: { country?: string; limit?: number }
): Promise<MetaAd[]> {
  if (!META_TOKEN) return []

  const country = options?.country || 'IN'
  const limit   = options?.limit || 20
  const ads: MetaAd[] = []

  // Search by each keyword as page name or ad content
  for (const kw of keywords.slice(0, 4)) {
    try {
      const url = new URL('https://graph.facebook.com/v18.0/ads_archive')
      url.searchParams.set('access_token', META_TOKEN)
      url.searchParams.set('ad_type', 'POLITICAL_AND_ISSUE_ADS')
      url.searchParams.set('ad_reached_countries', `["${country}"]`)
      url.searchParams.set('search_terms', kw)
      url.searchParams.set('limit', String(Math.min(limit, 25)))
      url.searchParams.set('fields', 'id,page_name,ad_delivery_start_time,ad_creative_bodies,ad_creative_link_titles,impressions,spend,region_distribution,demographic_distribution,funding_entity,currency')

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) })
      if (!res.ok) { console.warn('[MetaAds]', kw, res.status); continue }
      const data = await res.json()
      ads.push(...(data?.data || []))
    } catch (e: any) { console.warn('[MetaAds] error:', e.message) }
  }

  // Deduplicate by id
  const seen = new Set<string>()
  return ads.filter(a => { if (seen.has(a.id)) return false; seen.add(a.id); return true })
}

export function metaAdToFeedItem(ad: MetaAd, keyword: string, accountId: string): FeedItem {
  const body = (ad.ad_creative_bodies || []).join(' ') || (ad.ad_creative_link_titles || []).join(' ') || 'Political advertisement'
  const now = new Date().toISOString()
  const spend = ad.spend ? `₹${ad.spend.lower_bound}–${ad.spend.upper_bound}` : ''
  const impr  = ad.impressions ? `${(+ad.impressions.lower_bound/1000).toFixed(0)}K–${(+ad.impressions.upper_bound/1000).toFixed(0)}K impressions` : ''

  return {
    id: `meta-ad-${ad.id}`,
    account_id: accountId,
    platform: 'facebook' as any,
    bucket: 'yellow' as any,
    sentiment: 'neutral' as any,
    tone: 0,
    headline: `[META AD] ${ad.page_name}: ${body.substring(0, 180)}`,
    body: `${body}\n\nFunded by: ${ad.funding_entity || ad.page_name}\nSpend: ${spend}\nReach: ${impr}`.trim(),
    source: `Meta Ads — ${ad.page_name}`,
    url: `https://www.facebook.com/ads/library/?id=${ad.id}`,
    geo_tags: (ad.region_distribution || []).slice(0, 3).map(r => r.region),
    topic_tags: ['Meta Ad', 'Political Ad', 'Paid Media'],
    language: 'english',
    views: ad.impressions ? Math.round((+ad.impressions.lower_bound + +ad.impressions.upper_bound) / 2) : 0,
    shares: 0, engagement: 0,
    is_trending: false,
    published_at: ad.ad_delivery_start_time || now,
    fetched_at: now,
    keyword,
    contradiction: undefined,
  }
}

export async function useMetaAdsData(keywords: string[], accountId: string): Promise<FeedItem[]> {
  const ads = await fetchMetaAds(keywords)
  return ads.map(ad => {
    const kw = keywords.find(k => (ad.page_name || '').toLowerCase().includes(k.toLowerCase()) || (ad.ad_creative_bodies || []).join(' ').toLowerCase().includes(k.toLowerCase())) || keywords[0]
    return metaAdToFeedItem(ad, kw, accountId)
  })
}
