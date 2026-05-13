// ============================================================
// BharatMonitor — Google Custom Search → X.com tweets
//
// Uses Google's Custom Search JSON API restricted to x.com
// This indexes PUBLIC tweets without needing Twitter/X API keys.
//
// Setup (one-time, free):
//   1. Go to https://programmablesearchengine.google.com/
//   2. Create a new search engine → set "Search the entire web"
//   3. Under "Sites to search" add: x.com
//   4. Copy the Search Engine ID (cx=...)
//   5. Go to https://console.cloud.google.com/
//   6. Enable "Custom Search API"
//   7. Create an API key
//   8. Add to your .env:
//        VITE_GOOGLE_CSE_KEY=AIza...
//        VITE_GOOGLE_CSE_CX=a1b2c3:xyz...
//
// Free tier: 100 queries/day (10 results each = 1000 tweets/day free)
// Paid tier: $5 per 1000 queries after that
// ============================================================

import type { FeedItem } from '@/types'
import { serpSearchX } from './serpApi'

// ─── Multi-key pool (each Google account = 100 free queries/day) ─────────────
// Add VITE_GOOGLE_CSE_KEY_1 … VITE_GOOGLE_CSE_KEY_N to .env to multiply quota.
// With 5 accounts → 500 queries/day free.

function getCseKeys(): Array<{ key: string; cx: string }> {
  const pairs: Array<{ key: string; cx: string }> = []

  // Single/primary pair
  const k0 = import.meta.env.VITE_GOOGLE_CSE_KEY
  const c0 = import.meta.env.VITE_GOOGLE_CSE_CX
  if (k0 && c0) pairs.push({ key: k0, cx: c0 })

  // Numbered pairs: VITE_GOOGLE_CSE_KEY_1 + VITE_GOOGLE_CSE_CX_1, etc.
  for (let i = 1; i <= 10; i++) {
    const k = import.meta.env[`VITE_GOOGLE_CSE_KEY_${i}`]
    const c = import.meta.env[`VITE_GOOGLE_CSE_CX_${i}`]
    if (k && c) pairs.push({ key: k, cx: c })
  }

  // Deduplicate by key
  const seen = new Set<string>()
  return pairs.filter(p => { if (seen.has(p.key)) return false; seen.add(p.key); return true })
}

let _cseKeyIndex = 0
function nextCseKey(): { key: string; cx: string } | null {
  const keys = getCseKeys()
  if (!keys.length) return null
  const pair = keys[_cseKeyIndex % keys.length]
  _cseKeyIndex++
  return pair
}

// Pool-aware accessors (always pick the next key from the pool)
function hasAnyCseKey(): boolean { return getCseKeys().length > 0 }

// ─── Types ───────────────────────────────────────────────────────────────────

export interface GoogleCSEResult {
  title:       string
  link:        string
  snippet:     string
  displayLink: string
  pagemap?: {
    metatags?: Array<Record<string, string>>
    person?:   Array<{ name?: string; url?: string }>
  }
}

export interface GoogleCSEResponse {
  items?:            GoogleCSEResult[]
  searchInformation: { totalResults: string; formattedTotalResults: string }
  queries?: {
    nextPage?: Array<{ startIndex: number }>
  }
}

// ─── URL builder ─────────────────────────────────────────────────────────────

/**
 * Build a Google Advanced Search URL for x.com (for opening in browser).
 * Parameters map to Google's as_* query syntax.
 */
export function buildGoogleXSearchUrl(params: {
  query?:       string    // main keyword (AND)
  orTerms?:     string[]  // any of these (OR)
  exclude?:     string[]  // exclude these words
  exactPhrase?: string    // exact phrase
  since?:       string    // YYYY-MM-DD
  until?:       string    // YYYY-MM-DD
  dateRange?:   'day' | 'week' | 'month' | 'year' | 'all'
  language?:    string    // e.g. "lang_hi", "lang_en"
}): string {
  const base = 'https://www.google.com/search'
  const p = new URLSearchParams()

  if (params.query)       p.set('as_q',          params.query)
  if (params.exactPhrase) p.set('as_epq',         params.exactPhrase)
  if (params.orTerms?.length) p.set('as_oq',      params.orTerms.join('+'))
  if (params.exclude?.length) p.set('as_eq',      params.exclude.join(' '))
  if (params.language)    p.set('lr',             params.language)

  p.set('as_sitesearch', 'x.com')
  p.set('as_occt',       'any')
  p.set('as_qdr',        params.dateRange ?? 'all')

  // Date range refinement for tbs parameter
  if (params.since || params.until) {
    const from = params.since ? params.since.replace(/-/g, '/') : ''
    const to   = params.until ? params.until.replace(/-/g, '/') : ''
    if (from && to) p.set('tbs', `cdr:1,cd_min:${from},cd_max:${to}`)
    else if (from)  p.set('tbs', `cdr:1,cd_min:${from}`)
    else if (to)    p.set('tbs', `cdr:1,cd_max:${to}`)
  }

  return `${base}?${p.toString()}`
}

// ─── API search (returns structured data) ────────────────────────────────────

/**
 * Search X.com via Google Custom Search JSON API.
 * Returns structured tweet-like results with full URLs.
 */
// Quota guard for GetX CSE (shares 100 queries/day with other CSE usage)
function getxQuotaOk(): boolean {
  try {
    const raw = sessionStorage.getItem('bm-api-quota')
    if (!raw) return true
    const state = JSON.parse(raw)
    const today = new Date().toDateString()
    if (state._date !== today) return true
    return !state['getx']
  } catch { return true }
}
function markGetxQuotaExceeded() {
  try {
    const raw = sessionStorage.getItem('bm-api-quota')
    const state = raw ? JSON.parse(raw) : {}
    state['getx'] = Date.now()
    state._date = new Date().toDateString()
    sessionStorage.setItem('bm-api-quota', JSON.stringify(state))
  } catch {}
}

export async function searchXViaGoogle(params: {
  query:        string
  orTerms?:     string[]
  exclude?:     string[]
  exactPhrase?: string
  dateRange?:   'day' | 'week' | 'month' | 'year'
  language?:    'hi' | 'en'
  maxResults?:  number     // max 100 (10 per page × 10 pages)
  startIndex?:  number     // pagination: 1, 11, 21, ...
}): Promise<GoogleCSEResult[]> {
  // Bail early if no CSE keys configured — caller falls back to SerpAPI
  if (!hasAnyCseKey()) return []

  const results: GoogleCSEResult[] = []
  const maxResults = Math.min(params.maxResults ?? 30, 100)
  const pages = Math.ceil(maxResults / 10)

  // Build query string
  let q = params.query
  if (params.exactPhrase) q = `"${params.exactPhrase}" ${q}`
  if (params.orTerms?.length) q += ' ' + params.orTerms.map(t => `"${t}"`).join(' OR ')
  if (params.exclude?.length) q += ' ' + params.exclude.map(t => `-${t}`).join(' ')
  if (params.language === 'hi') q += ' (हिंदी OR भारत OR मोदी)'

  for (let page = 0; page < pages && results.length < maxResults; page++) {
    // Rotate to a fresh key/cx pair on every page for quota multiplication
    const pair = nextCseKey()
    if (!pair) break

    const startIndex = (params.startIndex ?? 1) + (page * 10)
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key',         pair.key)
    url.searchParams.set('cx',          pair.cx)
    url.searchParams.set('q',           q)
    url.searchParams.set('siteSearch',  'x.com')
    url.searchParams.set('num',         '10')
    url.searchParams.set('start',       String(startIndex))
    if (params.dateRange) url.searchParams.set('dateRestrict', params.dateRange[0]) // d, w, m, y

    try {
      const res = await fetch(url.toString(), {
        signal: AbortSignal.timeout(10000),
      })
      if (!res.ok) {
        const err = await res.json().catch(() => ({}))
        console.error('[GoogleSearchX] API error:', err?.error?.message ?? res.status)
        break
      }
      const data: GoogleCSEResponse = await res.json()
      if (!data.items?.length) break
      results.push(...data.items)
    } catch (e) {
      console.error('[GoogleSearchX] fetch error:', e)
      break
    }
  }

  return results.slice(0, maxResults)
}

// ─── Extract handle from x.com URL ───────────────────────────────────────────

function parseXUrl(url: string): { handle: string; tweetId: string | null } {
  // https://x.com/handle/status/123456789
  // https://twitter.com/handle/status/123456789
  const m = /(?:x|twitter)\.com\/([^/]+)(?:\/status\/(\d+))?/.exec(url)
  return {
    handle:  m?.[1] ?? 'unknown',
    tweetId: m?.[2] ?? null,
  }
}

// ─── Sync keyword scorer (subset of sentiment.ts, no async needed here) ──────
// Avoids async complexity in a converter function used in many places.

function scoreSync(text: string): { sentiment: string; score: number; urgency: string; geoTags: string[]; topics: string[] } {
  const lower = text.toLowerCase()
  const POS = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','historic','breakthrough','praised']
  const NEG = ['scam','scandal','corruption','fraud','arrest','protest','riot','attack','exposed','resign','fake','crisis','blast','terror','dead','killed']
  const CRISIS = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','rape','fire']
  const OPP = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition']
  const GEO = ['Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','India']
  let score = 0
  for (const w of POS)    if (lower.includes(w)) score += 0.3
  for (const w of NEG)    if (lower.includes(w)) score -= 0.3
  for (const w of CRISIS) if (lower.includes(w)) score -= 0.6
  score = Math.max(-1, Math.min(1, score))
  const isCrisis = CRISIS.some(k => lower.includes(k))
  const isOpp    = OPP.some(k => lower.includes(k)) && score < 0
  const topics: string[] = []
  if (isCrisis) topics.push('Crisis')
  if (score > 0.3) topics.push('Achievement')
  if (lower.includes('scheme')) topics.push('Scheme')
  if (lower.includes('election')) topics.push('Election')
  if (isOpp) topics.push('Opposition Attack')
  return {
    sentiment: score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral',
    score,
    urgency: isCrisis || score < -0.5 ? 'high' : isOpp || score < -0.2 ? 'medium' : 'low',
    geoTags: GEO.filter(g => lower.includes(g.toLowerCase())),
    topics,
  }
}

// ─── Convert CSE result → FeedItem ───────────────────────────────────────────

export function googleXResultToFeedItem(
  result:    GoogleCSEResult,
  accountId: string,
  keyword:   string,
): FeedItem {
  const { handle, tweetId } = parseXUrl(result.link)

  // Snippet is Google's excerpt — usually the tweet text
  const text = result.snippet.replace(/\n/g, ' ').trim()

  const scored = scoreSync(text)
  const bucket: FeedItem['bucket'] =
    scored.urgency === 'high'          ? 'red'    :
    scored.sentiment === 'positive'    ? 'blue'   :
    scored.urgency === 'medium'        ? 'yellow' : 'silver'

  // Try to extract date from snippet (Google often includes "X hours ago" or date)
  const dateM = /(\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4}|\d{4}-\d{2}-\d{2})/.exec(result.snippet)
  const publishedAt = dateM ? new Date(dateM[1]).toISOString() : new Date().toISOString()

  return {
    id:           `gx-${tweetId ?? handle + '-' + Date.now()}`,
    account_id:   accountId,
    platform:     'twitter',
    bucket,
    sentiment:    scored.sentiment as FeedItem['sentiment'],
    tone:         Math.round(scored.score * 5),
    headline:     result.title.substring(0, 220),
    body:         text,
    source:       `@${handle}`,
    url:          result.link.startsWith('http') ? result.link : `https://x.com/${handle}${tweetId ? `/status/${tweetId}` : ''}`,
    geo_tags:     scored.geoTags,
    topic_tags:   scored.topics,
    language:     /[\u0900-\u097F]/.test(text) ? 'hindi' : 'english',
    views:        0,
    shares:       0,
    engagement:   0,
    is_trending:  false,
    published_at: publishedAt,
    fetched_at:   new Date().toISOString(),
    keyword,
    contradiction: undefined,
  }
}

// ─── Main sweep — multiple keywords ──────────────────────────────────────────

/**
 * Sweep multiple keywords/handles via Google → X.com search.
 * Gracefully returns empty if API keys not configured.
 */
export async function sweepGoogleX(
  keywords:  string[],
  accountId: string,
  options?: {
    dateRange?: 'day' | 'week' | 'month' | 'year'
    language?:  'hi' | 'en'
    maxPerKw?:  number
  }
): Promise<FeedItem[]> {
  const all: FeedItem[] = []
  const seen = new Set<string>()
  const maxPerKw = options?.maxPerKw ?? 20

  // Determine which search path to use
  const hasCse = hasAnyCseKey()
  const dateRangeMap: Record<string, 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y'> = {
    day: 'qdr:d', week: 'qdr:w', month: 'qdr:m', year: 'qdr:y',
  }

  for (const kw of keywords.slice(0, 8)) {
    let items: FeedItem[] = []

    if (hasCse) {
      // Primary: Google Custom Search (100/day per account, rotated)
      const results = await searchXViaGoogle({
        query:      kw,
        dateRange:  options?.dateRange,
        language:   options?.language,
        maxResults: maxPerKw,
      })
      items = results.map(r => googleXResultToFeedItem(r, accountId, kw))
    } else {
      // Fallback: SerpAPI (5000/mo on $50 plan)
      const serpDr = options?.dateRange ? dateRangeMap[options.dateRange] : undefined
      items = await serpSearchX(kw, accountId, { dateRange: serpDr, max: maxPerKw })
    }

    for (const item of items) {
      if (!seen.has(item.id)) {
        seen.add(item.id)
        all.push(item)
      }
    }
  }

  return all.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
}

// ─── Quick browser open (no API key needed) ───────────────────────────────────

/**
 * Opens a Google X.com search in the browser — zero API cost.
 * Use this as a "View source" button in the UI.
 */
export function openGoogleXSearch(keyword: string, dateRange?: 'day' | 'week' | 'month' | 'year') {
  const url = buildGoogleXSearchUrl({
    query:     keyword,
    dateRange: dateRange ?? 'week',
  })
  window.open(url, '_blank', 'noopener')
}
