// ============================================================
// BharatMonitor — Universal Search
// Nitter's advanced search syntax is the single query language
// for ALL platforms. Each platform adapter translates params
// into its native API format.
// ============================================================

import type { Platform } from '@/types'

// ─── Universal search params (Nitter syntax as the base) ────────────────────

export interface UniversalSearchParams {
  // Core
  query: string               // free-text keywords / phrases
  exactPhrase?: string        // "exact phrase in quotes"
  anyOf?: string[]            // keyword OR keyword OR ...
  noneOf?: string[]           // -keyword -keyword

  // Account targeting (Twitter: from:/to:, IG: @profile)
  from?: string[]             // from:narendramodi → Twitter + IG profile
  to?: string[]               // to:username (Twitter only)
  mentions?: string[]         // @mention anywhere in text
  hashtags?: string[]         // #BJP #Modi → all platforms

  // Content filters
  excludeRetweets?: boolean   // -filter:retweets
  excludeReplies?: boolean    // -filter:replies
  mediaOnly?: boolean         // filter:media
  linksOnly?: boolean         // filter:links
  verifiedOnly?: boolean      // filter:verified

  // Language / geo
  language?: string           // lang:hi lang:en lang:mr etc.
  location?: string           // near:Delhi near:Mumbai
  withinKm?: number           // within:15km (used with location)

  // Engagement thresholds
  minLikes?: number           // min_faves:N → Twitter likes / YT likes / IG likes
  minShares?: number          // min_retweets:N → Twitter RTs / FB shares / YT views/1k
  minReplies?: number         // min_replies:N

  // Date range
  since?: string              // YYYY-MM-DD
  until?: string              // YYYY-MM-DD

  // Result control
  maxResults?: number         // default 50
  platforms?: Platform[]      // which platforms to query (default: all)
  sortBy?: 'date' | 'engagement' | 'relevance'
  resultType?: 'recent' | 'popular' | 'mixed'
}

// ─── Nitter query string builder ────────────────────────────────────────────

export function buildNitterQuery(p: UniversalSearchParams): string {
  const parts: string[] = []

  if (p.query)        parts.push(p.query)
  if (p.exactPhrase)  parts.push(`"${p.exactPhrase}"`)
  if (p.anyOf?.length) parts.push(`(${p.anyOf.join(' OR ')})`)
  if (p.noneOf?.length) p.noneOf.forEach(n => parts.push(`-${n}`))

  if (p.from?.length)     p.from.forEach(f => parts.push(`from:${f.replace('@', '')}`))
  if (p.to?.length)       p.to.forEach(t => parts.push(`to:${t.replace('@', '')}`))
  if (p.mentions?.length) p.mentions.forEach(m => parts.push(`@${m.replace('@', '')}`))
  if (p.hashtags?.length) p.hashtags.forEach(h => parts.push(`#${h.replace('#', '')}`))

  if (p.language)        parts.push(`lang:${p.language}`)
  if (p.location)        parts.push(`near:${p.location}`)
  if (p.withinKm)        parts.push(`within:${p.withinKm}km`)

  if (p.excludeRetweets) parts.push('-filter:retweets')
  if (p.excludeReplies)  parts.push('-filter:replies')
  if (p.mediaOnly)       parts.push('filter:media')
  if (p.linksOnly)       parts.push('filter:links')
  if (p.verifiedOnly)    parts.push('filter:verified')

  if (p.minLikes)   parts.push(`min_faves:${p.minLikes}`)
  if (p.minShares)  parts.push(`min_retweets:${p.minShares}`)
  if (p.minReplies) parts.push(`min_replies:${p.minReplies}`)

  if (p.since) parts.push(`since:${p.since}`)
  if (p.until) parts.push(`until:${p.until}`)

  return parts.join(' ')
}

// ─── Google News RSS / NewsAPI URL builder ───────────────────────────────────

export function buildNewsQuery(p: UniversalSearchParams): string {
  const terms: string[] = []

  if (p.query)        terms.push(p.query)
  if (p.exactPhrase)  terms.push(`"${p.exactPhrase}"`)
  if (p.anyOf?.length) terms.push(`(${p.anyOf.join(' OR ')})`)
  if (p.noneOf?.length) p.noneOf.forEach(n => terms.push(`-"${n}"`))
  if (p.hashtags?.length) p.hashtags.forEach(h => terms.push(h.replace('#', '')))
  if (p.from?.length)     p.from.forEach(f => terms.push(f.replace('@', '')))

  return terms.join(' ')
}

// ─── Instagram hashtag query builder ────────────────────────────────────────

export function buildInstagramQuery(p: UniversalSearchParams): {
  hashtags: string[]
  keywords: string[]
  profile?: string
  since?: string
  until?: string
} {
  const hashtags: string[] = [
    ...(p.hashtags || []).map(h => h.replace('#', '')),
    // Auto-convert keywords to hashtags for IG
    ...((p.query || '').split(' ').filter(w => w.length > 3)),
  ]
  const keywords = [p.query, p.exactPhrase].filter(Boolean) as string[]
  const profile = p.from?.[0]?.replace('@', '')

  return { hashtags: [...new Set(hashtags)], keywords, profile, since: p.since, until: p.until }
}

// ─── YouTube query builder ───────────────────────────────────────────────────

export function buildYouTubeQuery(p: UniversalSearchParams): {
  q: string
  publishedAfter?: string
  publishedBefore?: string
  relevanceLanguage?: string
} {
  const terms = [p.query, p.exactPhrase ? `"${p.exactPhrase}"` : '', ...(p.hashtags || [])].filter(Boolean)
  return {
    q: terms.join(' '),
    publishedAfter: p.since ? `${p.since}T00:00:00Z` : undefined,
    publishedBefore: p.until ? `${p.until}T23:59:59Z` : undefined,
    relevanceLanguage: p.language,
  }
}

// ─── Reddit query builder ────────────────────────────────────────────────────

export function buildRedditQuery(p: UniversalSearchParams): string {
  const terms = [p.query, p.exactPhrase ? `"${p.exactPhrase}"` : ''].filter(Boolean)
  return terms.join(' ')
}

// ─── Preset queries for Indian politics ─────────────────────────────────────

export function buildIndianPoliticsPresets(
  name: string,
  keywords: string[],
  handles: string[] = [],
): UniversalSearchParams[] {
  const base = keywords.slice(0, 3).join(' OR ')

  return [
    // Main keyword sweep
    {
      query: base,
      excludeRetweets: true,
      language: 'en',
      minLikes: 5,
      resultType: 'recent',
      maxResults: 50,
    },
    // Hindi / vernacular
    {
      query: base,
      excludeRetweets: true,
      language: 'hi',
      minLikes: 3,
      resultType: 'recent',
      maxResults: 50,
    },
    // Official handles
    ...(handles.length ? [{
      query: '',
      from: handles,
      excludeRetweets: false,
      maxResults: 30,
    } as UniversalSearchParams] : []),
    // High engagement / viral
    {
      query: base,
      minLikes: 500,
      resultType: 'popular',
      maxResults: 20,
    },
    // Hashtag search
    {
      query: '',
      hashtags: keywords.slice(0, 2),
      excludeRetweets: true,
      maxResults: 30,
    },
  ]
}

// ─── Parse Nitter query string back into structured params ───────────────────

export function parseNitterQuery(q: string): UniversalSearchParams {
  const params: UniversalSearchParams = { query: '' }
  const remaining: string[] = []

  // Tokenize respecting quotes
  const tokens = q.match(/(?:[^\s"]+|"[^"]*")+/g) || []

  for (const token of tokens) {
    if (token.startsWith('from:'))          (params.from ??= []).push(token.slice(5))
    else if (token.startsWith('to:'))       (params.to ??= []).push(token.slice(3))
    else if (token.startsWith('@'))         (params.mentions ??= []).push(token.slice(1))
    else if (token.startsWith('#'))         (params.hashtags ??= []).push(token.slice(1))
    else if (token.startsWith('lang:'))     params.language = token.slice(5)
    else if (token.startsWith('near:'))     params.location = token.slice(5)
    else if (token.startsWith('within:'))   params.withinKm = parseInt(token.slice(7))
    else if (token.startsWith('min_faves:'))  params.minLikes = parseInt(token.slice(10))
    else if (token.startsWith('min_retweets:')) params.minShares = parseInt(token.slice(13))
    else if (token.startsWith('min_replies:')) params.minReplies = parseInt(token.slice(12))
    else if (token.startsWith('since:'))    params.since = token.slice(6)
    else if (token.startsWith('until:'))    params.until = token.slice(6)
    else if (token === '-filter:retweets')  params.excludeRetweets = true
    else if (token === '-filter:replies')   params.excludeReplies = true
    else if (token === 'filter:media')      params.mediaOnly = true
    else if (token === 'filter:links')      params.linksOnly = true
    else if (token === 'filter:verified')   params.verifiedOnly = true
    else if (token.startsWith('-')) (params.noneOf ??= []).push(token.slice(1))
    else if (token.startsWith('"') && token.endsWith('"')) params.exactPhrase = token.slice(1, -1)
    else remaining.push(token)
  }

  params.query = remaining.join(' ')
  return params
}

// ─── Describe params in human-readable form ─────────────────────────────────

export function describeParams(p: UniversalSearchParams): string {
  const parts: string[] = []
  if (p.query)        parts.push(`"${p.query}"`)
  if (p.from?.length) parts.push(`from ${p.from.join(', ')}`)
  if (p.hashtags?.length) parts.push(p.hashtags.map(h => `#${h}`).join(' '))
  if (p.language)     parts.push(`[${p.language.toUpperCase()}]`)
  if (p.since || p.until) parts.push(`${p.since ?? ''} → ${p.until ?? 'now'}`)
  if (p.minLikes)     parts.push(`≥${p.minLikes} likes`)
  if (p.location)     parts.push(`near ${p.location}`)
  if (p.excludeRetweets) parts.push('no RTs')
  return parts.join(' · ') || 'All content'
}
