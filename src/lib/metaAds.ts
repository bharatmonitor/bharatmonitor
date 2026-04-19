// ============================================================
// BharatMonitor — Meta Ads Library Integration
// Tracks political ad spending on Facebook & Instagram
// ============================================================

export interface MetaAdParams {
  searchTerms?: string[]       // Keywords to search in ad content
  pageIds?: string[]           // Specific Facebook page IDs to monitor
  countries?: string[]         // Default: ['IN'] for India
  adType?: 'ALL' | 'POLITICAL_AND_ISSUE_ADS'
  deliveryDateMin?: string     // YYYY-MM-DD
  deliveryDateMax?: string     // YYYY-MM-DD
  limit?: number               // Max ads to return (default: 50)
  adActiveStatus?: 'ACTIVE' | 'INACTIVE' | 'ALL'
  publisherPlatforms?: ('FACEBOOK' | 'INSTAGRAM' | 'AUDIENCE_NETWORK' | 'MESSENGER')[]
}

export interface MetaAd {
  id: string
  page_id: string
  page_name: string
  ad_creative_body?: string
  ad_creative_link_caption?: string
  ad_creative_link_title?: string
  ad_snapshot_url: string
  impressions?: { lower_bound: string; upper_bound: string }
  spend?: { lower_bound: string; upper_bound: string }
  currency?: string
  delivery_start_time?: string
  delivery_stop_time?: string
  region_distribution?: { region: string; percentage: number }[]
  demographic_distribution?: { age: string; gender: string; percentage: number }[]
  publisher_platforms?: string[]
  ad_type?: string
  bylines?: string
  funding_entity?: string
}

export interface MetaAdsSummary {
  total_ads: number
  active_ads: number
  estimated_spend_min: number
  estimated_spend_max: number
  currency: string
  top_pages: { page_id: string; page_name: string; ad_count: number }[]
  platform_split: Record<string, number>
}

/**
 * Fetch political ads from Meta Ads Library API.
 * Free to use for political/issue ads transparency.
 * Requires: Meta developer access token (get free at developers.facebook.com)
 */
export async function fetchMetaAds(
  params: MetaAdParams,
  accessToken: string,
): Promise<MetaAd[]> {
  const fields = [
    'id', 'page_id', 'page_name', 'ad_creative_body',
    'ad_creative_link_caption', 'ad_creative_link_title',
    'ad_snapshot_url', 'impressions', 'spend', 'currency',
    'delivery_start_time', 'delivery_stop_time',
    'region_distribution', 'demographic_distribution',
    'publisher_platforms', 'ad_type', 'bylines', 'funding_entity',
  ].join(',')

  const url = new URL('https://graph.facebook.com/v21.0/ads_archive')
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('ad_type', params.adType || 'POLITICAL_AND_ISSUE_ADS')
  url.searchParams.set('ad_reached_countries', JSON.stringify(params.countries || ['IN']))
  url.searchParams.set('fields', fields)
  url.searchParams.set('limit', String(params.limit || 50))

  if (params.searchTerms?.length) {
    url.searchParams.set('search_terms', params.searchTerms.join(' '))
  }
  if (params.pageIds?.length) {
    url.searchParams.set('search_page_ids', params.pageIds.join(','))
  }
  if (params.deliveryDateMin) {
    url.searchParams.set('ad_delivery_date_min', params.deliveryDateMin)
  }
  if (params.deliveryDateMax) {
    url.searchParams.set('ad_delivery_date_max', params.deliveryDateMax)
  }
  if (params.adActiveStatus) {
    url.searchParams.set('ad_active_status', params.adActiveStatus)
  }
  if (params.publisherPlatforms?.length) {
    url.searchParams.set('publisher_platforms', JSON.stringify(params.publisherPlatforms))
  }

  try {
    const resp = await fetch(url.toString(), {
      headers: { 'Accept': 'application/json' },
    })

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}))
      console.error('[MetaAds] API error:', resp.status, body)
      return []
    }

    const data = await resp.json()
    return (data.data || []) as MetaAd[]
  } catch (e) {
    console.error('[MetaAds] Exception:', e)
    return []
  }
}

/**
 * Summarize Meta ads for dashboard display.
 */
export function summarizeMetaAds(ads: MetaAd[]): MetaAdsSummary {
  const pageMap: Record<string, { name: string; count: number }> = {}
  const platformMap: Record<string, number> = {}
  let spendMin = 0, spendMax = 0
  let activeCount = 0

  ads.forEach(ad => {
    // Page aggregation
    if (!pageMap[ad.page_id]) pageMap[ad.page_id] = { name: ad.page_name, count: 0 }
    pageMap[ad.page_id].count++

    // Spend aggregation
    if (ad.spend) {
      spendMin += parseInt(ad.spend.lower_bound || '0', 10)
      spendMax += parseInt(ad.spend.upper_bound || '0', 10)
    }

    // Platform split
    ;(ad.publisher_platforms || []).forEach(p => {
      platformMap[p] = (platformMap[p] || 0) + 1
    })

    // Active check
    if (!ad.delivery_stop_time) activeCount++
  })

  const topPages = Object.entries(pageMap)
    .map(([page_id, { name, count }]) => ({ page_id, page_name: name, ad_count: count }))
    .sort((a, b) => b.ad_count - a.ad_count)
    .slice(0, 5)

  return {
    total_ads: ads.length,
    active_ads: activeCount,
    estimated_spend_min: spendMin,
    estimated_spend_max: spendMax,
    currency: ads[0]?.currency || 'INR',
    top_pages: topPages,
    platform_split: platformMap,
  }
}

/**
 * Generate Indian political party page IDs for monitoring.
 * These are the official Facebook pages.
 */
export const INDIAN_PARTY_PAGE_IDS: Record<string, string> = {
  BJP:     '116030295096814',
  INC:     '57356001995',
  AAP:     '272419002799793',
  TMC:     '242643862440614',
  DMK:     '133897896635399',
  NCP:     '116348541706459',
  SP:      '196893580328975',
  BSP:     '109888295699958',
  CPI_M:   '142699485768283',
  JDU:     '376268945740107',
}

/**
 * Fetch ads by tracked politicians/parties.
 * Used by the BharatMonitor Meta Ads panel.
 */
export async function fetchPoliticalAdsForAccount(options: {
  keywords: string[]
  trackedParties?: string[]
  trackedPoliticians?: string[]
  accessToken: string
  days?: number
}): Promise<{ ads: MetaAd[]; summary: MetaAdsSummary }> {
  const { keywords, trackedParties, trackedPoliticians, accessToken, days = 30 } = options

  const since = new Date()
  since.setDate(since.getDate() - days)
  const sinceStr = since.toISOString().split('T')[0]

  // Build page IDs for tracked parties
  const partyPageIds = (trackedParties || [])
    .map(p => INDIAN_PARTY_PAGE_IDS[p])
    .filter(Boolean)

  const ads = await fetchMetaAds({
    searchTerms: [...keywords, ...(trackedPoliticians || [])].slice(0, 5),
    pageIds: partyPageIds.length ? partyPageIds : undefined,
    countries: ['IN'],
    adType: 'POLITICAL_AND_ISSUE_ADS',
    deliveryDateMin: sinceStr,
    adActiveStatus: 'ALL',
    publisherPlatforms: ['FACEBOOK', 'INSTAGRAM'],
    limit: 100,
  }, accessToken)

  return {
    ads,
    summary: summarizeMetaAds(ads),
  }
}

// ─── Meta Marketing API — OWN ACCOUNT PERFORMANCE ────────────────────────────
// Different from the Ads Library (which shows competitor ads).
// This shows YOUR campaign performance, spend, and ROI.
//
// HOW TO ACTIVATE:
//   1. Go to https://business.facebook.com/settings/ad-accounts
//   2. Copy your Ad Account ID (looks like: act_123456789)
//   3. In your app's dashboard, generate a token with:
//      ads_read, ads_management, read_insights permissions
//   4. Add to .env:
//        VITE_META_AD_ACCOUNT_ID=act_123456789
//        (VITE_META_ACCESS_TOKEN is already used above)

export interface OwnCampaignInsights {
  campaign_id:   string
  campaign_name: string
  status:        string
  objective:     string
  spend:         number
  impressions:   number
  reach:         number
  clicks:        number
  ctr:           number
  cpm:           number
  cpc:           number
  results:       number   // conversions / link clicks / etc
  date_start:    string
  date_stop:     string
}

const INSIGHT_FIELDS = [
  'campaign_id','campaign_name','status','objective',
  'spend','impressions','reach','clicks','ctr','cpm','cpc',
  'actions','date_start','date_stop',
].join(',')

export async function fetchOwnCampaignInsights(
  accessToken: string,
  adAccountId: string,
  datePreset: 'today' | 'last_7d' | 'last_30d' | 'last_90d' = 'last_7d',
): Promise<OwnCampaignInsights[]> {
  if (!accessToken || !adAccountId) return []

  const url = new URL(`https://graph.facebook.com/v21.0/${adAccountId}/campaigns`)
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('fields', `id,name,status,objective,insights.date_preset(${datePreset}){${INSIGHT_FIELDS}}`)
  url.searchParams.set('limit', '50')

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) })
    if (!res.ok) return []
    const data = await res.json()

    return (data.data ?? []).map((c: any) => {
      const ins = c.insights?.data?.[0] ?? {}
      const resultAction = (ins.actions ?? []).find((a: any) =>
        ['link_click','landing_page_view','omni_purchase','lead'].includes(a.action_type)
      )
      return {
        campaign_id:   c.id,
        campaign_name: c.name,
        status:        c.status,
        objective:     c.objective ?? '',
        spend:         parseFloat(ins.spend       ?? '0'),
        impressions:   parseInt(ins.impressions   ?? '0'),
        reach:         parseInt(ins.reach         ?? '0'),
        clicks:        parseInt(ins.clicks        ?? '0'),
        ctr:           parseFloat(ins.ctr         ?? '0'),
        cpm:           parseFloat(ins.cpm         ?? '0'),
        cpc:           parseFloat(ins.cpc         ?? '0'),
        results:       parseInt(resultAction?.value ?? '0'),
        date_start:    ins.date_start ?? '',
        date_stop:     ins.date_stop  ?? '',
      }
    })
  } catch { return [] }
}

export async function fetchAccountSpendSummary(
  accessToken: string,
  adAccountId: string,
  datePreset: 'today' | 'last_7d' | 'last_30d' = 'last_7d',
): Promise<{ spend: number; impressions: number; reach: number; clicks: number; ctr: number } | null> {
  if (!accessToken || !adAccountId) return null

  const url = new URL(`https://graph.facebook.com/v21.0/${adAccountId}/insights`)
  url.searchParams.set('access_token', accessToken)
  url.searchParams.set('fields', 'spend,impressions,reach,clicks,ctr,cpm')
  url.searchParams.set('date_preset', datePreset)
  url.searchParams.set('level', 'account')

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return null
    const data = await res.json()
    const d = data.data?.[0]
    if (!d) return null
    return {
      spend:       parseFloat(d.spend       ?? '0'),
      impressions: parseInt(d.impressions   ?? '0'),
      reach:       parseInt(d.reach         ?? '0'),
      clicks:      parseInt(d.clicks        ?? '0'),
      ctr:         parseFloat(d.ctr         ?? '0'),
    }
  } catch { return null }
}

/**
 * META ADS SETUP GUIDE:
 *
 * 1. Go to developers.facebook.com
 * 2. Create an app → Business type
 * 3. Add "Marketing API" product
 * 4. Generate a User Access Token with ads_read permission
 * 5. OR use a Page Access Token for long-term access
 * 6. Store token in VITE_META_ACCESS_TOKEN (env var)
 *
 * The Ads Library API is FREE for political ad transparency.
 * No special permissions needed — just a valid access token.
 *
 * IMPORTANT: Meta caps the Ads Library API at:
 * - 200 calls per hour per user
 * - 100 results per page
 * - Data available for 7 years
 *
 * For real-time monitoring, call from Supabase Edge Function
 * on a schedule (every 6 hours is sufficient).
 */
