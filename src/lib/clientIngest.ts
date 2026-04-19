// ============================================================
// BharatMonitor — Client-Side Ingestion Pipeline
//
// Fetches news & social data directly from the browser when
// the Supabase edge function isn't available or returns empty.
//
// Sources (all CORS-safe from browser):
//   1. Google News RSS (EN + HI) via CORS proxy
//   2. YouTube Data API v3 (CORS supported)
//   3. Reddit public JSON API (with CORS proxy fallback)
//   4. Google CSE general search (news, not just x.com)
//   5. Meta Ads Library API (political ad transparency, free)
//
// Results are upserted into Supabase bm_feed + feed_items
// so all existing hooks/queries pick them up automatically.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase'
import type { FeedItem } from '@/types'

// ─── CORS proxy for RSS feeds / CORS-blocked APIs ───────────────────────────
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?',
]

async function fetchViaCorsProxy(url: string, timeoutMs = 8000): Promise<string | null> {
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(`${proxy}${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(timeoutMs),
      })
      if (!res.ok) continue
      return await res.text()
    } catch { continue }
  }
  return null
}

async function fetchJsonViaCorsProxy(url: string, timeoutMs = 10000): Promise<any | null> {
  const text = await fetchViaCorsProxy(url, timeoutMs)
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

// ─── Simple keyword scorer ──────────────────────────────────────────────────

const POS_KW = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','historic','breakthrough','praised','commended','progress','inaugurated','victory','wins','elected']
const NEG_KW = ['scam','scandal','corruption','fraud','arrest','protest','riot','attack','exposed','resign','fake','crisis','flood','blast','terror','controversy','accused','violence','clash','unrest']
const CRISIS_KW = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','fire','emergency','attack','stampede','shooting','explosion']
const OPP_KW = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition','indi alliance','jumla','pappu']
const GEO_TERMS = ['Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','Ahmedabad','Pune','Jaipur','Lucknow','Patna','Bhopal','Varanasi','UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','India','Tamil Nadu','Kerala','West Bengal','Assam','Odisha','Punjab','Haryana','Jharkhand','Uttarakhand','Goa','Tripura','Manipur','Meghalaya','Nagaland','Mizoram','Arunachal','Sikkim','Andhra Pradesh','Telangana','Chhattisgarh','Madhya Pradesh']

function scoreText(text: string): { sentiment: FeedItem['sentiment']; tone: number; bucket: FeedItem['bucket']; geoTags: string[]; topics: string[] } {
  const lower = text.toLowerCase()
  let score = 0
  for (const w of POS_KW)    if (lower.includes(w)) score += 0.3
  for (const w of NEG_KW)    if (lower.includes(w)) score -= 0.3
  for (const w of CRISIS_KW) if (lower.includes(w)) score -= 0.6
  score = Math.max(-1, Math.min(1, score))

  const isCrisis = CRISIS_KW.some(k => lower.includes(k))
  const isOpp    = OPP_KW.some(k => lower.includes(k)) && score < 0

  const sentiment: FeedItem['sentiment'] = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral'
  const bucket: FeedItem['bucket'] =
    isCrisis || score < -0.5 ? 'red' :
    isOpp || score < -0.2    ? 'yellow' :
    score > 0.15             ? 'blue' : 'silver'

  const geoTags = GEO_TERMS.filter(g => lower.includes(g.toLowerCase()))
  const topics: string[] = []
  if (isCrisis) topics.push('Crisis')
  if (score > 0.3) topics.push('Achievement')
  if (lower.includes('scheme')) topics.push('Scheme')
  if (lower.includes('election')) topics.push('Election')
  if (isOpp) topics.push('Opposition Attack')
  if (lower.includes('parliament')) topics.push('Parliament')
  if (lower.includes('budget')) topics.push('Economy')
  if (lower.includes('modi')) topics.push('PM Modi')
  if (lower.includes('bjp')) topics.push('BJP')
  if (lower.includes('congress') || lower.includes('rahul')) topics.push('INC')

  return { sentiment, tone: Math.round(score * 5), bucket, geoTags, topics }
}

// ─── Helper: make FeedItem ──────────────────────────────────────────────────

function makeFeedItem(params: {
  id: string
  platform: string
  headline: string
  body?: string
  source: string
  url: string
  published_at: string
  keyword: string
  views?: number
  shares?: number
  engagement?: number
  thumbnail?: string
}): FeedItem {
  const scored = scoreText(`${params.headline} ${params.body || ''}`)
  const now = new Date().toISOString()
  return {
    id: params.id,
    account_id: '', // filled by caller
    platform: params.platform as any,
    bucket: scored.bucket,
    sentiment: scored.sentiment,
    tone: scored.tone,
    headline: params.headline.substring(0, 220),
    body: params.body || params.headline,
    source: params.source,
    url: params.url,
    geo_tags: scored.geoTags,
    topic_tags: scored.topics,
    language: /[\u0900-\u097F]/.test(params.headline) ? 'hindi' as const : 'english' as const,
    views: params.views ?? 0,
    shares: params.shares ?? 0,
    engagement: params.engagement ?? 0,
    is_trending: (params.views ?? 0) > 1000 || (params.engagement ?? 0) > 100,
    published_at: params.published_at || now,
    fetched_at: now,
    keyword: params.keyword,
    contradiction: undefined,
  }
}

// ─── 1. Google News RSS (EN + HI) ──────────────────────────────────────────

function parseRSS(xml: string): Array<{ title: string; link: string; pubDate: string; source: string }> {
  const items: Array<{ title: string; link: string; pubDate: string; source: string }> = []
  const itemRx = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null

  while ((m = itemRx.exec(xml)) !== null) {
    const block = m[1]
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
      const match = r.exec(block)
      return (match?.[1] ?? match?.[2] ?? '').trim()
    }
    const title   = get('title')
    const link    = get('link') || get('guid')
    const pubDate = get('pubDate')
    const source  = get('source') || 'Google News'
    if (title && link) items.push({ title, link, pubDate, source })
  }
  return items
}

async function fetchGoogleNewsRSS(keyword: string, lang: 'en' | 'hi' = 'en', max = 15): Promise<FeedItem[]> {
  const q = encodeURIComponent(lang === 'hi' ? keyword : `${keyword} india`)
  const hl = lang === 'hi' ? 'hi-IN' : 'en-IN'
  const ceid = lang === 'hi' ? 'IN:hi' : 'IN:en'
  const rssUrl = `https://news.google.com/rss/search?q=${q}&hl=${hl}&gl=IN&ceid=${ceid}`
  const xml = await fetchViaCorsProxy(rssUrl)
  if (!xml || !xml.includes('<item>')) return []

  return parseRSS(xml).slice(0, max).map((p) => {
    const id = `gnews-${lang}-${btoa(p.link).substring(0, 30).replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36)}`
    const item = makeFeedItem({
      id,
      platform: 'news',
      headline: p.title,
      source: p.source.replace(/<[^>]+>/g, ''),
      url: p.link,
      published_at: p.pubDate ? new Date(p.pubDate).toISOString() : new Date().toISOString(),
      keyword,
    })
    if (lang === 'hi') item.language = 'hindi'
    return item
  })
}

// ─── 2. YouTube Data API v3 (CORS supported) ───────────────────────────────

const YT_KEY = import.meta.env.VITE_YOUTUBE_KEY || ''

async function fetchYouTube(keyword: string, max = 10): Promise<FeedItem[]> {
  if (!YT_KEY) return []
  const items: FeedItem[] = []

  try {
    const q = encodeURIComponent(keyword)
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&relevanceLanguage=hi&regionCode=IN&order=date&maxResults=${max}&key=${YT_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      console.warn(`[clientIngest] YouTube API error: ${res.status}`)
      return []
    }
    const data = await res.json()
    for (const item of (data?.items ?? [])) {
      const vid = item.id?.videoId
      if (!vid) continue
      const s = item.snippet
      items.push(makeFeedItem({
        id: `yt-${vid}`,
        platform: 'youtube',
        headline: s.title,
        body: s.description?.substring(0, 500) || '',
        source: s.channelTitle || 'YouTube',
        url: `https://youtube.com/watch?v=${vid}`,
        published_at: s.publishedAt,
        keyword,
        thumbnail: s.thumbnails?.medium?.url,
      }))
    }
  } catch (e) {
    console.warn('[clientIngest] YouTube fetch error:', e)
  }
  return items
}

// ─── 3. Reddit Public JSON API ──────────────────────────────────────────────

const SUBREDDITS = ['india', 'IndianPolitics', 'IndiaSpeaks']

async function fetchReddit(keyword: string, max = 10): Promise<FeedItem[]> {
  const items: FeedItem[] = []

  for (const sub of SUBREDDITS) {
    const q = encodeURIComponent(keyword)
    const url = `https://www.reddit.com/r/${sub}/search.json?q=${q}&sort=new&restrict_sr=on&limit=${Math.ceil(max / SUBREDDITS.length)}&raw_json=1`

    let data: any = null

    // Try direct fetch first (Reddit sometimes allows CORS)
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BharatMonitor/2.0 (web)' },
        signal: AbortSignal.timeout(6000),
      })
      if (res.ok) data = await res.json()
    } catch { /* CORS blocked, try proxy */ }

    // Fallback: CORS proxy
    if (!data) {
      data = await fetchJsonViaCorsProxy(url, 10000)
    }

    if (!data?.data?.children) continue

    for (const child of data.data.children) {
      const p = child.data
      if (!p?.id) continue
      const text = `${p.title}\n${p.selftext?.substring(0, 300) ?? ''}`
      items.push(makeFeedItem({
        id: `reddit-${p.id}`,
        platform: 'reddit',
        headline: p.title,
        body: p.selftext?.substring(0, 500) ?? '',
        source: `r/${p.subreddit}`,
        url: `https://reddit.com${p.permalink}`,
        published_at: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : new Date().toISOString(),
        keyword,
        views: p.view_count ?? 0,
        engagement: (p.score ?? 0) + (p.num_comments ?? 0),
      }))
    }
  }
  return items
}

// ─── 4. Google CSE General Search (news, not just x.com) ────────────────────

const CSE_KEY = import.meta.env.VITE_GOOGLE_CSE_KEY || ''
const CSE_CX  = import.meta.env.VITE_GOOGLE_CSE_CX || ''

async function fetchGoogleCSENews(keyword: string, max = 10): Promise<FeedItem[]> {
  if (!CSE_KEY || !CSE_CX) return []
  const items: FeedItem[] = []

  try {
    // Search WITHOUT siteSearch restriction = general news results
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', CSE_KEY)
    url.searchParams.set('cx', CSE_CX)
    url.searchParams.set('q', `${keyword} india news`)
    url.searchParams.set('num', String(Math.min(max, 10)))
    url.searchParams.set('dateRestrict', 'w') // last week
    url.searchParams.set('gl', 'in')
    // Don't set siteSearch — this fetches general web results

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      console.warn(`[clientIngest] Google CSE news error: ${res.status}`)
      return []
    }
    const data = await res.json()
    for (const r of (data?.items ?? [])) {
      // Skip x.com results (those come from the dedicated X sweep)
      if (r.link?.includes('x.com/') || r.link?.includes('twitter.com/')) continue
      items.push(makeFeedItem({
        id: `cse-${btoa(r.link).substring(0, 30).replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36)}`,
        platform: 'news',
        headline: r.title,
        body: r.snippet || '',
        source: r.displayLink || 'Web',
        url: r.link,
        published_at: new Date().toISOString(), // CSE doesn't always return dates
        keyword,
      }))
    }
  } catch (e) {
    console.warn('[clientIngest] Google CSE news error:', e)
  }
  return items
}

// ─── 5. Meta Ads Library API (political ad transparency, FREE) ──────────────

const META_TOKEN = import.meta.env.VITE_META_ACCESS_TOKEN || ''

async function fetchMetaAds(keyword: string, max = 10): Promise<FeedItem[]> {
  if (!META_TOKEN) return []
  const items: FeedItem[] = []

  try {
    const q = encodeURIComponent(keyword)
    // Meta Ad Library API — free for political/social issue ads
    const url = `https://graph.facebook.com/v21.0/ads_archive?search_terms=${q}&ad_reached_countries=IN&ad_type=POLITICAL_AND_ISSUE_ADS&fields=id,ad_creative_bodies,ad_creative_link_titles,ad_delivery_start_time,page_name,publisher_platforms,spend,impressions&limit=${max}&access_token=${META_TOKEN}`

    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      console.warn(`[clientIngest] Meta Ads API error: ${res.status}`)
      return []
    }
    const data = await res.json()
    for (const ad of (data?.data ?? [])) {
      const body = (ad.ad_creative_bodies || []).join(' ').substring(0, 500)
      const title = (ad.ad_creative_link_titles || []).join(' ') || body.substring(0, 120)
      if (!title && !body) continue
      const platforms = (ad.publisher_platforms || []).join(', ')
      items.push(makeFeedItem({
        id: `meta-ad-${ad.id}`,
        platform: 'facebook',
        headline: title || body.substring(0, 200),
        body: `[Political Ad on ${platforms}] ${body}`,
        source: ad.page_name || 'Meta Ads',
        url: `https://www.facebook.com/ads/library/?id=${ad.id}`,
        published_at: ad.ad_delivery_start_time || new Date().toISOString(),
        keyword,
        views: ad.impressions?.upper_bound ?? 0,
      }))
    }
  } catch (e) {
    console.warn('[clientIngest] Meta Ads error:', e)
  }
  return items
}

// ─── 6. Instagram (public profile via CORS proxy) ───────────────────────────

async function fetchInstagramPublic(keyword: string, max = 5): Promise<FeedItem[]> {
  // Use a public Instagram hashtag page scrape via CORS proxy
  // This is fragile but provides some IG data without Graph API setup
  const items: FeedItem[] = []
  const tag = keyword.replace(/\s+/g, '').replace('#', '').toLowerCase()

  try {
    // Try fetching hashtag explore via CORS proxy
    const url = `https://www.instagram.com/explore/tags/${encodeURIComponent(tag)}/?__a=1&__d=dis`
    const data = await fetchJsonViaCorsProxy(url, 8000)
    if (!data) return []

    const edges = data?.graphql?.hashtag?.edge_hashtag_to_media?.edges ??
                  data?.data?.hashtag?.edge_hashtag_to_top_posts?.edges ?? []

    for (const edge of edges.slice(0, max)) {
      const node = edge.node
      if (!node) continue
      const caption = node.edge_media_to_caption?.edges?.[0]?.node?.text ?? ''
      items.push(makeFeedItem({
        id: `ig-${node.id || node.shortcode}`,
        platform: 'instagram',
        headline: caption.substring(0, 200) || `#${tag} post`,
        body: caption.substring(0, 500),
        source: `#${tag}`,
        url: `https://www.instagram.com/p/${node.shortcode}/`,
        published_at: node.taken_at_timestamp ? new Date(node.taken_at_timestamp * 1000).toISOString() : new Date().toISOString(),
        keyword,
        engagement: (node.edge_liked_by?.count ?? 0) + (node.edge_media_to_comment?.count ?? 0),
      }))
    }
  } catch {
    // Instagram public API is unreliable — fail silently
  }
  return items
}

// ─── Main Client-Side Ingest ────────────────────────────────────────────────

export interface IngestResult {
  total: number
  saved: number
  sources: Record<string, number>
  errors: string[]
}

/**
 * Runs a full client-side ingest sweep across ALL sources.
 * Fetches data, scores sentiment, and upserts into Supabase.
 */
export async function clientSideIngest(
  accountId: string,
  keywords: string[],
  options?: { maxPerSource?: number; skipSave?: boolean }
): Promise<IngestResult> {
  const maxPer = options?.maxPerSource ?? 12
  const allItems: FeedItem[] = []
  const errors: string[] = []
  const sources: Record<string, number> = {}

  console.log(`[clientIngest] Starting for account=${accountId}, keywords=${keywords.join(',')}`)

  const tasks: Promise<{ source: string; items: FeedItem[] }>[] = []

  for (const kw of keywords.slice(0, 6)) {
    // Google News English
    tasks.push(
      fetchGoogleNewsRSS(kw, 'en', maxPer)
        .then(items => ({ source: 'google-news-en', items }))
        .catch(e => { errors.push(`GNews EN [${kw}]: ${e}`); return { source: 'google-news-en', items: [] } })
    )
    // Google News Hindi
    tasks.push(
      fetchGoogleNewsRSS(kw, 'hi', Math.ceil(maxPer / 2))
        .then(items => ({ source: 'google-news-hi', items }))
        .catch(e => { errors.push(`GNews HI [${kw}]: ${e}`); return { source: 'google-news-hi', items: [] } })
    )
    // YouTube
    tasks.push(
      fetchYouTube(kw, Math.ceil(maxPer / 2))
        .then(items => ({ source: 'youtube', items }))
        .catch(e => { errors.push(`YouTube [${kw}]: ${e}`); return { source: 'youtube', items: [] } })
    )
    // Reddit
    tasks.push(
      fetchReddit(kw, Math.ceil(maxPer / 2))
        .then(items => ({ source: 'reddit', items }))
        .catch(e => { errors.push(`Reddit [${kw}]: ${e}`); return { source: 'reddit', items: [] } })
    )
  }

  // These are keyword-independent, fire once
  // Google CSE general news (first 3 keywords)
  for (const kw of keywords.slice(0, 3)) {
    tasks.push(
      fetchGoogleCSENews(kw, Math.ceil(maxPer / 2))
        .then(items => ({ source: 'google-cse-news', items }))
        .catch(e => { errors.push(`CSE News [${kw}]: ${e}`); return { source: 'google-cse-news', items: [] } })
    )
  }

  // Meta Ads Library (first 2 keywords)
  for (const kw of keywords.slice(0, 2)) {
    tasks.push(
      fetchMetaAds(kw, Math.ceil(maxPer / 2))
        .then(items => ({ source: 'meta-ads', items }))
        .catch(e => { errors.push(`Meta Ads [${kw}]: ${e}`); return { source: 'meta-ads', items: [] } })
    )
  }

  // Instagram (first 2 keywords)
  for (const kw of keywords.slice(0, 2)) {
    tasks.push(
      fetchInstagramPublic(kw, 5)
        .then(items => ({ source: 'instagram', items }))
        .catch(e => { errors.push(`Instagram [${kw}]: ${e}`); return { source: 'instagram', items: [] } })
    )
  }

  const results = await Promise.allSettled(tasks)

  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    const { source, items } = r.value
    sources[source] = (sources[source] ?? 0) + items.length
    for (const item of items) {
      allItems.push({ ...item, account_id: accountId })
    }
  }

  // Deduplicate by URL
  const seen = new Set<string>()
  const deduped = allItems.filter(i => {
    const key = i.url || i.id
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  console.log(`[clientIngest] Fetched ${deduped.length} items from sources:`, sources)

  // Save to Supabase
  let saved = 0
  if (!options?.skipSave && deduped.length > 0) {
    try {
      const rows = deduped.map(item => ({
        id: item.id,
        account_id: item.account_id,
        platform: item.platform,
        bucket: item.bucket,
        sentiment: item.sentiment,
        tone: item.tone,
        headline: item.headline,
        body: item.body || item.headline,
        source: item.source,
        source_name: item.source,
        source_type: item.platform,
        title: item.headline,
        url: item.url,
        geo_tags: item.geo_tags,
        topic_tags: item.topic_tags,
        language: item.language,
        views: item.views ?? 0,
        shares: item.shares ?? 0,
        engagement: item.engagement ?? 0,
        is_trending: item.is_trending ?? false,
        published_at: item.published_at,
        fetched_at: item.fetched_at,
        keyword: item.keyword,
      }))

      // Try bm_feed first
      const { error: err1 } = await supabaseAdmin
        .from('bm_feed')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })

      if (err1) {
        console.warn('[clientIngest] bm_feed upsert warning:', err1.message)
        // Fallback to feed_items
        const { error: err2 } = await supabaseAdmin
          .from('feed_items')
          .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
        if (err2) {
          console.warn('[clientIngest] feed_items upsert warning:', err2.message)
          errors.push(`DB save: ${err1.message}`)
        } else {
          saved = rows.length
        }
      } else {
        saved = rows.length
      }
      console.log(`[clientIngest] Saved ${saved} items to Supabase`)
    } catch (e: any) {
      console.error('[clientIngest] Save error:', e)
      errors.push(`Save error: ${e.message}`)
    }
  }

  return { total: deduped.length, saved, sources, errors }
}

/**
 * Quick client-side fetch that returns FeedItems WITHOUT saving to Supabase.
 * Used for immediate display while background ingest saves to DB.
 */
export async function clientFetchNews(
  accountId: string,
  keywords: string[],
  maxPerKeyword = 12,
): Promise<FeedItem[]> {
  const allItems: FeedItem[] = []

  const tasks: Promise<FeedItem[]>[] = []
  for (const kw of keywords.slice(0, 5)) {
    tasks.push(fetchGoogleNewsRSS(kw, 'en', maxPerKeyword).catch(() => []))
    tasks.push(fetchYouTube(kw, Math.ceil(maxPerKeyword / 3)).catch(() => []))
    tasks.push(fetchReddit(kw, Math.ceil(maxPerKeyword / 3)).catch(() => []))
  }
  // Meta Ads (first 2 keywords)
  for (const kw of keywords.slice(0, 2)) {
    tasks.push(fetchMetaAds(kw, 5).catch(() => []))
  }

  const results = await Promise.allSettled(tasks)
  for (const r of results) {
    if (r.status === 'fulfilled') allItems.push(...r.value)
  }

  // Deduplicate & tag account
  const seen = new Set<string>()
  return allItems
    .map(i => ({ ...i, account_id: accountId }))
    .filter(i => { const k = i.url || i.id; if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
}
