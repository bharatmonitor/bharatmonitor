// ============================================================
// BharatMonitor — SerpAPI Client (Google Search for X.com posts)
//
// SerpAPI wraps Google Search and returns clean JSON.
// No quota headaches, handles CAPTCHAs server-side.
//
// PRICING: https://serpapi.com/pricing
//   Free:   100 searches/month
//   Hobby:  $50/mo → 5,000 searches/mo
//   Startup:$130/mo → 15,000 searches/mo
//   (Each keyword sweep = 1 search)
//
// HOW TO GET YOUR KEY:
//   1. Go to https://serpapi.com/
//   2. Sign up → Dashboard → Your API Key
//   3. Add to .env:  VITE_SERP_API_KEY=abc123...
//
// MULTIPLE ACCOUNTS (free tier stacking):
//   Use different email addresses for each SerpAPI account.
//   Add up to 5 keys:
//     VITE_SERP_API_KEY_1=key1
//     VITE_SERP_API_KEY_2=key2
//     ...
//   The client rotates through them automatically.
// ============================================================

import type { FeedItem } from '@/types'

// ─── Key pool (rotates round-robin to multiply free quota) ───────────────────

function getSerpKeys(): string[] {
  const keys: string[] = []
  // Single key
  const single = import.meta.env.VITE_SERP_API_KEY
  if (single) keys.push(single)
  // Numbered pool
  for (let i = 1; i <= 10; i++) {
    const k = import.meta.env[`VITE_SERP_API_KEY_${i}`]
    if (k) keys.push(k)
  }
  return [...new Set(keys)] // dedupe
}

let _keyIndex = 0
function nextSerpKey(): string | null {
  const keys = getSerpKeys()
  if (!keys.length) return null
  const key = keys[_keyIndex % keys.length]
  _keyIndex++
  return key
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface SerpOrganicResult {
  title:        string
  link:         string
  snippet?:     string
  displayed_link?: string
  date?:        string
  source?:      string
}

export interface SerpResponse {
  organic_results?: SerpOrganicResult[]
  search_metadata?: { status: string; total_time_taken: number }
  error?:           string
}

// ─── Core search ─────────────────────────────────────────────────────────────

export async function serpSearch(params: {
  query:      string
  site?:      string   // e.g. 'x.com' — restricts results to this domain
  dateRange?: 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y'  // day/week/month/year
  country?:   string   // default 'in' (India)
  language?:  string   // default 'en'
  maxResults?: number  // default 10
  startIndex?: number  // pagination
}): Promise<SerpOrganicResult[]> {
  const key = nextSerpKey()
  if (!key) return []

  const q = params.site
    ? `${params.query} site:${params.site}`
    : params.query

  const url = new URL('https://serpapi.com/search')
  url.searchParams.set('api_key', key)
  url.searchParams.set('engine',  'google')
  url.searchParams.set('q',       q)
  url.searchParams.set('gl',      params.country  ?? 'in')
  url.searchParams.set('hl',      params.language ?? 'en')
  url.searchParams.set('num',     String(Math.min(params.maxResults ?? 10, 100)))
  if (params.dateRange) url.searchParams.set('tbs', params.dateRange)
  if (params.startIndex) url.searchParams.set('start', String(params.startIndex))

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) })
    if (!res.ok) {
      const err: SerpResponse = await res.json().catch(() => ({}))
      console.warn('[SerpAPI] error:', err.error ?? res.status)
      return []
    }
    const data: SerpResponse = await res.json()
    return data.organic_results ?? []
  } catch (e) {
    console.warn('[SerpAPI] fetch failed:', e)
    return []
  }
}

// ─── Sync keyword scorer (no async dep) ──────────────────────────────────────

function scoreSync(text: string) {
  const lower = text.toLowerCase()
  const POS = ['launched','inaugurated','achieved','success','milestone','welfare','award','historic','praised']
  const NEG = ['scam','scandal','corruption','fraud','arrest','protest','riot','attack','exposed','resign','crisis']
  const CRISIS = ['riot','earthquake','bomb','blast','terror','dead','killed','murder','fire','emergency']
  const OPP = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition']
  const GEO = ['Delhi','Mumbai','Bengaluru','Chennai','Kolkata','Hyderabad','UP','Bihar','Rajasthan','Maharashtra','Gujarat','India']
  let score = 0
  for (const w of POS)    if (lower.includes(w)) score += 0.3
  for (const w of NEG)    if (lower.includes(w)) score -= 0.3
  for (const w of CRISIS) if (lower.includes(w)) score -= 0.6
  score = Math.max(-1, Math.min(1, score))
  const isCrisis = CRISIS.some(k => lower.includes(k))
  const isOpp = OPP.some(k => lower.includes(k)) && score < 0
  return {
    sentiment: score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral',
    score,
    urgency: isCrisis || score < -0.5 ? 'high' : isOpp || score < -0.2 ? 'medium' : 'low',
    geoTags: GEO.filter(g => lower.includes(g.toLowerCase())),
    topics: [
      ...(isCrisis  ? ['Crisis']           : []),
      ...(score > 0.3 ? ['Achievement']    : []),
      ...(isOpp     ? ['Opposition Attack'] : []),
      ...(lower.includes('scheme')   ? ['Scheme'] : []),
      ...(lower.includes('election') ? ['Election'] : []),
    ],
  }
}

// ─── Convert SerpAPI result → FeedItem ───────────────────────────────────────

function parseXUrl(url: string) {
  const m = /(?:x|twitter)\.com\/([^/]+)(?:\/status\/(\d+))?/.exec(url)
  return { handle: m?.[1] ?? 'unknown', tweetId: m?.[2] ?? null }
}

export function serpResultToFeedItem(
  result:    SerpOrganicResult,
  accountId: string,
  keyword:   string,
  isXPost:   boolean = false,
): FeedItem {
  const text = [result.title, result.snippet].filter(Boolean).join(' ').replace(/\n/g, ' ')
  const scored = scoreSync(text)
  const bucket: FeedItem['bucket'] =
    scored.urgency === 'high'       ? 'red' :
    scored.sentiment === 'positive' ? 'blue' :
    scored.urgency === 'medium'     ? 'yellow' : 'silver'

  const { handle, tweetId } = isXPost ? parseXUrl(result.link) : { handle: '', tweetId: null }
  const id = isXPost
    ? `gx-${tweetId ?? handle + '-' + Date.now()}`
    : `serp-${encodeURIComponent(result.link).substring(0, 40)}-${Date.now()}`

  const publishedAt = result.date ? new Date(result.date).toISOString() : new Date().toISOString()

  return {
    id,
    account_id:   accountId,
    platform:     isXPost ? 'twitter' : 'news',
    bucket,
    sentiment:    scored.sentiment as FeedItem['sentiment'],
    tone:         Math.round(scored.score * 5),
    headline:     result.title.substring(0, 220),
    body:         result.snippet ?? '',
    source:       isXPost ? `@${handle}` : (result.source ?? result.displayed_link ?? 'Web'),
    url:          result.link,
    geo_tags:     scored.geoTags,
    topic_tags:   scored.topics,
    language:     /[\u0900-\u097F]/.test(text) ? 'hindi' : 'english',
    views: 0, shares: 0, engagement: 0, is_trending: false,
    published_at: publishedAt,
    fetched_at:   new Date().toISOString(),
    keyword,
    contradiction: undefined,
  }
}

// ─── High-level: search X.com via SerpAPI ────────────────────────────────────

export async function serpSearchX(
  keyword:   string,
  accountId: string,
  options?: { dateRange?: 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y'; max?: number }
): Promise<FeedItem[]> {
  const results = await serpSearch({
    query:      keyword,
    site:       'x.com',
    dateRange:  options?.dateRange ?? 'qdr:w',
    maxResults: options?.max ?? 20,
  })
  return results.map(r => serpResultToFeedItem(r, accountId, keyword, true))
}

// ─── High-level: search news via SerpAPI ─────────────────────────────────────

export async function serpSearchNews(
  keyword:   string,
  accountId: string,
  options?: { dateRange?: 'qdr:d' | 'qdr:w' | 'qdr:m' | 'qdr:y'; max?: number }
): Promise<FeedItem[]> {
  const results = await serpSearch({
    query:      `${keyword} india`,
    dateRange:  options?.dateRange ?? 'qdr:w',
    maxResults: options?.max ?? 15,
  })
  return results.map(r => serpResultToFeedItem(r, accountId, keyword, false))
}

// ─── Status helper ────────────────────────────────────────────────────────────

export function serpApiStatus(): { configured: boolean; keyCount: number; keys: string[] } {
  const keys = getSerpKeys()
  return {
    configured: keys.length > 0,
    keyCount:   keys.length,
    keys:       keys.map(k => k.substring(0, 8) + '…'),
  }
}
