// ============================================================
// BharatMonitor — Unified Twitter/X Data Sources v2
//
// Priority chain:
//   1. XPOZ      — primary (30-day history, full data)
//   2. Apify     — fallback if XPOZ returns 0 results
//   3. GetX/CSE  — always runs in parallel, merged under 'twitter'
//
// Keys:
//   VITE_XPOZ_API_KEY  = K3CdGX6jAgsWA8c87NlWbn2c5SVmKEddiTnYie2oIGhUKhvWRI1jhQeEOOqdwZKCVuyU8d1
//   VITE_APIFY_API_KEY = (from Apify dashboard)
//   VITE_GETX_API      = get-x-api-92f0194c29072683b841759fe5c0aaf296b2bc26312b340d
// ============================================================

import type { FeedItem } from '@/types'

const XPOZ_KEY  = import.meta.env.VITE_XPOZ_API_KEY  || ''
const APIFY_KEY = import.meta.env.VITE_APIFY_API_KEY  || ''
const GETX_KEY  = import.meta.env.VITE_GOOGLE_CSE_KEY || '' // Use Google CSE key for X.com search
const CSE_CX    = import.meta.env.VITE_GOOGLE_CSE_CX  || ''

// ─── Shared scorer ────────────────────────────────────────────────────────────

const POS_KW    = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','historic','praised','commended','progress','victory']
const NEG_KW    = ['scam','scandal','corruption','fraud','arrest','protest','riot','attack','exposed','resign','fake','crisis','blast','terror','controversy','accused','violence']
const CRISIS_KW = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','fire','emergency','shooting','explosion']
const OPP_KW    = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition','indi alliance']
const GEO_TERMS = ['Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','Ahmedabad','Pune','Jaipur','Lucknow','Patna','Bhopal','UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','India','Tamil Nadu','Kerala','West Bengal']

function scoreText(text: string) {
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
    isCrisis || score < -0.5 ? 'red'    :
    isOpp    || score < -0.2 ? 'yellow' :
    score > 0.15             ? 'blue'   : 'silver'
  return {
    sentiment, bucket,
    tone:     Math.round(score * 5),
    geoTags:  GEO_TERMS.filter(g => lower.includes(g.toLowerCase())),
    topics:   [
      ...(isCrisis                        ? ['Crisis']            : []),
      ...(score > 0.3                     ? ['Achievement']       : []),
      ...(lower.includes('election')      ? ['Election']          : []),
      ...(isOpp                           ? ['Opposition Attack'] : []),
      ...(lower.includes('parliament')    ? ['Parliament']        : []),
      ...(lower.includes('budget')        ? ['Economy']           : []),
    ],
  }
}

function nowIso() { return new Date().toISOString() }

// ─── 1. XPOZ (primary) ────────────────────────────────────────────────────────
// Calls our Supabase edge function bm-xpoz-fetch which runs the XPOZ MCP API
// server-side so the key never reaches the browser bundle.

export async function fetchXpozTweets(
  keywords: string[],
  accountId: string,
  options?: { startDate?: string; maxPerKeyword?: number }
): Promise<FeedItem[]> {
  if (!XPOZ_KEY) return []

  const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || ''
  const SERVICE_KEY  = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''
  if (!SUPABASE_URL) return []

  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/bm-xpoz-fetch`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SERVICE_KEY ? { Authorization: `Bearer ${SERVICE_KEY}` } : {}),
      },
      body: JSON.stringify({
        keywords:      keywords.slice(0, 5),
        startDate:     options?.startDate || new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10),
        maxPerKeyword: options?.maxPerKeyword || 20,
        xpozKey:       XPOZ_KEY,   // passed to edge fn so it can auth to XPOZ
      }),
      signal: AbortSignal.timeout(30000),
    })

    if (!res.ok) {
      console.warn('[XPOZ] Edge fn error:', res.status)
      return []
    }

    const data = await res.json()
    const posts: any[] = data?.posts || []
    const now = nowIso()

    return posts.map((post: any): FeedItem => {
      const text   = post.text || ''
      const scored = scoreText(text)
      return {
        id:           `xpoz-${post.id || Date.now()}`,
        account_id:   accountId,
        platform:     'twitter',
        bucket:       scored.bucket,
        sentiment:    scored.sentiment,
        tone:         scored.tone,
        headline:     text.substring(0, 220),
        body:         text,
        source:       `@${post.authorUsername || 'X'}`,
        url:          post.authorUsername && post.id
                        ? `https://x.com/${post.authorUsername}/status/${post.id}`
                        : '',
        geo_tags:     scored.geoTags,
        topic_tags:   scored.topics,
        language:     post.lang === 'hi' ? 'hindi' : 'english',
        views:        post.impressionCount || 0,
        shares:       post.retweetCount    || 0,
        engagement:   (post.likeCount || 0) + (post.replyCount || 0) + (post.retweetCount || 0),
        is_trending:  (post.impressionCount || 0) > 10000,
        published_at: post.createdAt || now,
        fetched_at:   now,
        keyword:      post._keyword || keywords[0] || '',
        contradiction: undefined,
      }
    })
  } catch (e) {
    console.warn('[XPOZ] Fetch error:', e)
    return []
  }
}

// ─── 2. Apify (fallback) ──────────────────────────────────────────────────────
// Only called when XPOZ returns 0 results.
// Runs apidojo/twitter-scraper-lite synchronously via Apify REST API.

export async function fetchApifyTweets(
  keywords: string[],
  accountId: string,
  options?: { maxTweets?: number }
): Promise<FeedItem[]> {
  if (!APIFY_KEY) return []

  try {
    const searchTerms = keywords.slice(0, 5).map(kw => `${kw} india -filter:retweets lang:en`)
    const url = `https://api.apify.com/v2/acts/apidojo~twitter-scraper-lite/run-sync-get-dataset-items?token=${APIFY_KEY}&timeout=55&memory=256`

    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        searchTerms,
        maxTweets:  options?.maxTweets || 30,
        queryType:  'Latest',
        lang:       'en',
      }),
      signal: AbortSignal.timeout(60000),
    })

    if (!res.ok) {
      console.warn('[Apify] API error:', res.status)
      return []
    }

    const data: any[] = await res.json()
    const now = nowIso()

    return (Array.isArray(data) ? data : []).map((tweet: any): FeedItem => {
      const text   = tweet.full_text || tweet.text || tweet.rawContent || ''
      const scored = scoreText(text)
      const handle  = tweet.user?.screen_name || tweet.author?.userName || 'X'
      const tweetId = tweet.id_str || tweet.id || String(Date.now())
      return {
        id:           `apify-${tweetId}`,
        account_id:   accountId,
        platform:     'twitter',
        bucket:       scored.bucket,
        sentiment:    scored.sentiment,
        tone:         scored.tone,
        headline:     text.substring(0, 220),
        body:         text,
        source:       `@${handle}`,
        url:          `https://x.com/${handle}/status/${tweetId}`,
        geo_tags:     scored.geoTags,
        topic_tags:   scored.topics,
        language:     tweet.lang === 'hi' ? 'hindi' : 'english',
        views:        tweet.views?.count    || tweet.viewCount   || 0,
        shares:       tweet.retweet_count   || tweet.retweetCount || 0,
        engagement:   (tweet.favorite_count || tweet.likeCount   || 0) +
                      (tweet.reply_count    || tweet.replyCount  || 0) +
                      (tweet.retweet_count  || tweet.retweetCount || 0),
        is_trending:  (tweet.views?.count || 0) > 10000,
        published_at: tweet.created_at ? new Date(tweet.created_at).toISOString() : now,
        fetched_at:   now,
        keyword:      keywords[0] || '',
        contradiction: undefined,
      }
    })
  } catch (e) {
    console.warn('[Apify] Fetch error:', e)
    return []
  }
}

// ─── 3. GetX / Google CSE → x.com (always parallel) ─────────────────────────
// Uses VITE_GETX_API key — quota is separate from general CSE key.
// Always runs alongside whichever of XPOZ/Apify wins.

export async function fetchGetXTweets(
  keywords: string[],
  accountId: string,
  options?: { maxPerKeyword?: number; dateRange?: 'day' | 'week' | 'month' }
): Promise<FeedItem[]> {
  if (!GETX_KEY || !CSE_CX) return []

  const maxPer    = options?.maxPerKeyword || 15
  const dateParam = options?.dateRange === 'day' ? 'd' : options?.dateRange === 'month' ? 'm' : 'w'
  const now       = nowIso()
  const items: FeedItem[] = []

  await Promise.allSettled(keywords.slice(0, 5).map(async kw => {
    try {
      const url = new URL('https://www.googleapis.com/customsearch/v1')
      url.searchParams.set('key',          GETX_KEY)
      url.searchParams.set('cx',           CSE_CX)
      url.searchParams.set('q',            `${kw} india`)
      url.searchParams.set('siteSearch',   'x.com')
      url.searchParams.set('num',          String(Math.min(maxPer, 10)))
      url.searchParams.set('dateRestrict', dateParam)

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
      if (!res.ok) return

      const data = await res.json()
      for (const r of (data?.items ?? [])) {
        const text   = r.snippet?.replace(/\n/g, ' ').trim() || r.title || ''
        const scored = scoreText(text)
        const mHandle = /(?:x|twitter)\.com\/([^/]+)/.exec(r.link)
        const handle  = mHandle?.[1] || 'X'
        const mId     = /\/status\/(\d+)/.exec(r.link)
        const tweetId = mId?.[1] || `getx-${Date.now()}`

        items.push({
          id:           `getx-${tweetId}`,
          account_id:   accountId,
          platform:     'twitter',
          bucket:       scored.bucket,
          sentiment:    scored.sentiment,
          tone:         scored.tone,
          headline:     (r.title || text).substring(0, 220),
          body:         text,
          source:       `@${handle}`,
          url:          r.link?.startsWith('http') ? r.link : `https://x.com/${handle}/status/${tweetId}`,
          geo_tags:     scored.geoTags,
          topic_tags:   scored.topics,
          language:     /[\u0900-\u097F]/.test(text) ? 'hindi' : 'english',
          views:        0,
          shares:       0,
          engagement:   0,
          is_trending:  false,
          published_at: now,
          fetched_at:   now,
          keyword:      kw,
          contradiction: undefined,
        })
      }
    } catch (e) {
      console.warn(`[GetX] Error for "${kw}":`, e)
    }
  }))

  return items
}

// ─── Main sweep: sequential primary + parallel GetX ───────────────────────────
//
// Flow:
//   ┌─ XPOZ (primary) ──────────────────────┐
//   │  if 0 results → Apify (fallback)       │  } merged + deduped
//   └────────────────────────────────────────┘
//   ┌─ GetX CSE (always, in parallel) ───────┘
//
// Result: deduplicated FeedItem[] sorted newest-first

export async function sweepAllTwitterSources(
  keywords:  string[],
  accountId: string,
  options?: {
    maxPerKeyword?: number
    dateRange?:     'day' | 'week' | 'month'
    startDate?:     string
  }
): Promise<FeedItem[]> {
  const max = options?.maxPerKeyword || 20

  // GetX always runs in parallel — start it immediately
  const getxPromise = fetchGetXTweets(keywords, accountId, {
    maxPerKeyword: max,
    dateRange:     options?.dateRange || 'week',
  })

  // XPOZ first — primary source
  let primaryItems: FeedItem[] = []
  console.log('[Twitter] Trying XPOZ (primary)...')
  primaryItems = await fetchXpozTweets(keywords, accountId, {
    startDate:     options?.startDate,
    maxPerKeyword: max,
  })

  // Apify fallback — only if XPOZ returned nothing
  if (primaryItems.length === 0 && APIFY_KEY) {
    console.log('[Twitter] XPOZ returned 0 — falling back to Apify...')
    primaryItems = await fetchApifyTweets(keywords, accountId, {
      maxTweets: max * Math.min(keywords.length, 5),
    })
  }

  // Collect GetX results (already running in parallel)
  const getxItems = await getxPromise

  console.log(`[Twitter] primary=${primaryItems.length} getx=${getxItems.length}`)

  // Merge and deduplicate by URL then ID
  const seen = new Set<string>()
  return [...primaryItems, ...getxItems]
    .filter(i => {
      const k = i.url || i.id
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
}
