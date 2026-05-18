// ============================================================
// BharatMonitor — Unified Social Data Sources v3
//
// Priority chain:
//   1. XPOZ (via bm-xpoz edge fn) — MCP server, Twitter+Instagram+Reddit+TikTok
//   2. GetX/CSE  — Google CSE x.com, 100/day browser-side fallback
//   3. Bluesky   — free, open API, no key
//
// XPOZ is an MCP server (not a REST API).
// We call it via the bm-xpoz Supabase edge function which handles MCP transport.
// ============================================================

import type { FeedItem } from '@/types'
import { SUPABASE_URL, ANON_KEY, SERVICE_KEY } from '@/lib/supabase'

const XPOZ_KEY  = import.meta.env.VITE_XPOZ_API_KEY  || ''
// Quota bypass for GetX — don't check quota here, quotaManager handles it
function isGodAccount(accountId: string) { return !accountId || accountId === 'god-account' || accountId.startsWith('god-') || accountId.startsWith('BM-2026') }
const APIFY_KEY = import.meta.env.VITE_APIFY_API_KEY  || ''
// GetX uses Google CSE API (key must be AIzaSy... format)
const GETX_KEY  = import.meta.env.VITE_GOOGLE_CSE_KEY || ''
const GETX_QUOTA_KEY = import.meta.env.VITE_GETX_API || '' // tracked separately
const CSE_CX    = import.meta.env.VITE_GOOGLE_CSE_CX  || ''
const XPOZ_EDGE_URL = `${SUPABASE_URL}/functions/v1/bm-xpoz`

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

// ─── 1. XPOZ via bm-xpoz Edge Function ──────────────────────────────────────
// XPOZ is an MCP server. We call our Supabase edge function which handles the
// MCP transport (StreamableHTTP) in Deno. The edge function proxies to XPOZ,
// saves results to bm_feed, and returns a summary.
//
// Supported modes: 'search' | 'watchlist' | 'competitors' | 'influencers' | 'count'

export async function fetchXpozTweets(
  keywords: string[],
  accountId: string,
  options?: { startDate?: string; maxPerKeyword?: number }
): Promise<FeedItem[]> {
  // XPOZ runs server-side via edge fn — results are saved directly to bm_feed
  // This function triggers the ingest and returns empty (feed refreshes via React Query)
  try {
    const authKey = SERVICE_KEY || ANON_KEY
    const res = await fetch(XPOZ_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({
        accountId,
        keywords,
        mode: 'search',
        maxPerKeyword: options?.maxPerKeyword || 20,
        startDate: options?.startDate,
      }),
      signal: AbortSignal.timeout(90_000),
    })
    const data = await res.json().catch(() => ({}))
    console.log('[XPOZ] search result:', data.inserted, 'items saved')
    return [] // Results in bm_feed — caller should invalidate React Query
  } catch (e: any) {
    console.warn('[XPOZ] edge fn error:', e.message)
    return []
  }
}

// Fetch recent posts from watchlist handles via XPOZ (author timeline)
export async function fetchXpozWatchlist(
  handles: { handle: string; platform: string; display_name?: string; is_active?: boolean }[],
  accountId: string,
  keywords: string[]
): Promise<void> {
  if (!handles.length) return
  try {
    const authKey = SERVICE_KEY || ANON_KEY
    const res = await fetch(XPOZ_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({ accountId, keywords, watchlistHandles: handles, mode: 'watchlist' }),
      signal: AbortSignal.timeout(90_000),
    })
    const data = await res.json().catch(() => ({}))
    console.log('[XPOZ] watchlist result:', data.inserted, 'items saved')
  } catch (e: any) {
    console.warn('[XPOZ] watchlist error:', e.message)
  }
}

// Fetch posts from competitor/opposition handles
export async function fetchXpozCompetitors(
  competitorHandles: { name: string; handle: string }[],
  accountId: string,
  keywords: string[]
): Promise<void> {
  if (!competitorHandles.length) return
  try {
    const authKey = SERVICE_KEY || ANON_KEY
    await fetch(XPOZ_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({ accountId, keywords, competitorHandles, mode: 'competitors' }),
      signal: AbortSignal.timeout(90_000),
    })
  } catch (e: any) {
    console.warn('[XPOZ] competitors error:', e.message)
  }
}

// Discover top influencers amplifying keywords — returns user data (not saved to feed)
export async function fetchXpozInfluencers(
  keywords: string[],
  accountId: string
): Promise<{
  username: string; name: string; followers: number; relevantTweets: number
  totalImpressions: number; totalLikes: number; verified: boolean
  description: string; url: string; profileImage: string
}[]> {
  try {
    const authKey = SERVICE_KEY || ANON_KEY
    const res = await fetch(XPOZ_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({ accountId, keywords, mode: 'influencers' }),
      signal: AbortSignal.timeout(90_000),
    })
    const data = await res.json().catch(() => ({}))
    return data.influencers || []
  } catch (e: any) {
    console.warn('[XPOZ] influencers error:', e.message)
    return []
  }
}

// Fast keyword volume counts — no content fetch, returns { keyword: count }
export async function fetchXpozCounts(
  keywords: string[],
  accountId: string
): Promise<Record<string, number>> {
  try {
    const authKey = SERVICE_KEY || ANON_KEY
    const res = await fetch(XPOZ_EDGE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`,
        'apikey': ANON_KEY,
      },
      body: JSON.stringify({ accountId, keywords, mode: 'count' }),
      signal: AbortSignal.timeout(30_000),
    })
    const data = await res.json().catch(() => ({}))
    return data.counts || {}
  } catch (e: any) {
    console.warn('[XPOZ] counts error:', e.message)
    return {}
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
  if (!GETX_KEY || !CSE_CX) {
    console.log('[GetX] No API key configured — skipping')
    return []
  }
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


// ─── Bluesky (free, open, no key) ────────────────────────────────────────────
export async function fetchBlueskySocial(
  keywords: string[], accountId: string,
  options?: { maxPerKeyword?: number }
): Promise<FeedItem[]> {
  const now = nowIso()
  const items: FeedItem[] = []

  await Promise.allSettled(keywords.slice(0, 5).map(async kw => {
    try {
      const params = new URLSearchParams({ q: kw + ' india', limit: '25', lang: 'en' })
      const res = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?' + params.toString(), {
        headers: { Accept: 'application/json', 'User-Agent': 'BharatMonitor/3.0' },
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) { console.warn('[Bluesky]', kw, res.status); return }
      const data = await res.json()
      const posts: any[] = data?.posts || []
      console.log(`[Bluesky] "${kw}": ${posts.length} posts`)
      for (const p of posts) {
        const text   = p.record?.text || ''
        const scored = scoreText(text)
        const handle = p.author?.handle || 'bsky'
        items.push({
          id:           `bsky-${(p.cid||'').slice(-16)}-${kw.slice(0,4).replace(/\s/g,'')}`,
          account_id:   accountId,
          platform:     'twitter' as any,
          bucket:       scored.bucket,
          sentiment:    scored.sentiment,
          tone:         scored.tone,
          headline:     text.substring(0, 220),
          body:         text,
          source:       `@${handle}`,
          url:          `https://bsky.app/profile/${handle}`,
          geo_tags:     (scored as any).geoTags || (scored as any).geo_tags || [],
          topic_tags:   (scored as any).topics || (scored as any).topic_tags || [],
          language:     'english',
          views:        p.likeCount || 0,
          shares:       p.repostCount || 0,
          engagement:   (p.likeCount||0) + (p.repostCount||0) + (p.replyCount||0),
          keyword:      kw,
          published_at: p.record?.createdAt || now,
          fetched_at:   now,
        })
      }
    } catch(e) { console.warn('[Bluesky] error:', e) }
  }))

  console.log(`[Bluesky] Total: ${items.length} items`)
  return items
}

// Fetch Bluesky user timeline (for watchlist handle tracking)
export async function fetchBlueskyUser(handle: string, accountId: string): Promise<FeedItem[]> {
  try {
    const cleanHandle = handle.replace('@','').replace('bsky.social','').replace(/^\.+|\.+$/g,'')
    const res = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=${cleanHandle}.bsky.social&limit=20`, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const data = await res.json()
    const now = nowIso()
    return (data?.feed || []).map((item: any): FeedItem => {
      const p = item.post
      const text = p.record?.text || ''
      const scored = scoreText(text)
      return {
        id:           `bsky-u-${(p.cid||'').slice(-16)}`,
        account_id:   accountId,
        platform:     'twitter' as any,
        bucket:       scored.bucket,
        sentiment:    scored.sentiment,
        tone:         scored.tone,
        headline:     text.substring(0, 220),
        body:         text,
        source:       `@${p.author?.handle || cleanHandle}`,
        url:          `https://bsky.app/profile/${p.author?.handle || cleanHandle}`,
        geo_tags:     (scored as any).geoTags || (scored as any).geo_tags || [],
        topic_tags:   (scored as any).topics || (scored as any).topic_tags || [],
        language:     'english',
        engagement:   (p.likeCount||0) + (p.repostCount||0) + (p.replyCount||0),
        keyword:      handle,
        published_at: p.record?.createdAt || now,
        fetched_at:   now,
      }
    })
  } catch { return [] }
}

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

  // Run Bluesky + GetX in parallel — both are reliable fallbacks
  const blueskyPromise = fetchBlueskySocial(keywords, accountId, { maxPerKeyword: max })
  const getxPromise    = fetchGetXTweets(keywords, accountId, {
    maxPerKeyword: max,
    dateRange: options?.dateRange || 'week',
  })

  // XPOZ — primary source (via edge function, saves directly to bm_feed)
  let primaryItems: FeedItem[] = []
  console.log('[Twitter] Trying XPOZ (primary)...')
  primaryItems = await fetchXpozTweets(keywords, accountId, {
    startDate:     options?.startDate,
    maxPerKeyword: max,
  })

  // Apify fallback if XPOZ returned nothing and key is set
  if (primaryItems.length === 0 && APIFY_KEY) {
    console.log('[Twitter] XPOZ returned 0 — falling back to Apify...')
    primaryItems = await fetchApifyTweets(keywords, accountId, {
      maxTweets: max * Math.min(keywords.length, 5),
    })
  }

  // Collect parallel results
  const [getxItems, blueskyItems] = await Promise.all([getxPromise, blueskyPromise])

  console.log(`[Twitter] primary=${primaryItems.length} getx=${getxItems.length} bluesky=${blueskyItems.length}`)

  // Merge and deduplicate — Bluesky is always the reliable floor
  const seen = new Set<string>()
  return [...primaryItems, ...getxItems, ...blueskyItems]
    .filter(i => {
      const k = i.url || i.id
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
}
