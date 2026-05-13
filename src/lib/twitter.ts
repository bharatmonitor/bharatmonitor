// ============================================================
// BharatMonitor — Twitter/X Advanced Search Integration
// Uses Twitter API v2 with advanced operators
// ============================================================

export interface TwitterSearchParams {
  // Core query
  query: string             // Free-text keywords

  // Advanced operators (all optional)
  from?: string[]           // from:account1 from:account2
  to?: string[]             // to:account
  mentions?: string[]       // @mention in tweet
  hashtags?: string[]       // #hashtag
  language?: string         // lang:hi lang:en lang:mr etc.
  placeCountry?: string     // place_country:IN (India)
  excludeRetweets?: boolean // -is:retweet
  excludeReplies?: boolean  // -is:reply
  onlyVerified?: boolean    // is:verified
  hasMedia?: boolean        // has:media has:images has:videos
  minLikes?: number         // min_faves:N
  minRetweets?: number      // min_retweets:N
  minReplies?: number       // min_replies:N
  since?: string            // YYYY-MM-DD (start date)
  until?: string            // YYYY-MM-DD (end date)
  resultType?: 'recent' | 'popular' | 'mixed'
  maxResults?: number       // 10–100

  // Context
  accountId?: string        // For saving to Supabase
}

export interface TwitterResult {
  id: string
  text: string
  author_id: string
  author_name?: string
  author_username?: string
  created_at: string
  public_metrics: {
    like_count: number
    retweet_count: number
    reply_count: number
    quote_count: number
    impression_count?: number
  }
  lang?: string
  url: string
}

/**
 * Build Twitter API v2 search query string from structured params.
 * This is the key function — supports all advanced operators.
 */
export function buildTwitterQuery(params: TwitterSearchParams): string {
  const parts: string[] = []

  // Core query
  if (params.query) parts.push(params.query)

  // from: operators
  if (params.from?.length) {
    parts.push(params.from.map(h => `from:${h.replace('@', '')}`).join(' OR '))
  }

  // to: operators
  if (params.to?.length) {
    parts.push(params.to.map(h => `to:${h.replace('@', '')}`).join(' OR '))
  }

  // mentions
  if (params.mentions?.length) {
    parts.push(params.mentions.map(h => `@${h.replace('@', '')}`).join(' OR '))
  }

  // hashtags
  if (params.hashtags?.length) {
    parts.push(params.hashtags.map(h => `#${h.replace('#', '')}`).join(' OR '))
  }

  // Language
  if (params.language) parts.push(`lang:${params.language}`)

  // Geographic: India
  if (params.placeCountry) parts.push(`place_country:${params.placeCountry}`)

  // Exclusions
  if (params.excludeRetweets) parts.push('-is:retweet')
  if (params.excludeReplies) parts.push('-is:reply')

  // Filters
  if (params.onlyVerified) parts.push('is:verified')
  if (params.hasMedia) parts.push('has:media')

  // Engagement thresholds
  if (params.minLikes) parts.push(`min_faves:${params.minLikes}`)
  if (params.minRetweets) parts.push(`min_retweets:${params.minRetweets}`)
  if (params.minReplies) parts.push(`min_replies:${params.minReplies}`)

  return parts.join(' ')
}

/**
 * Build preset Twitter queries for Indian politics monitoring.
 */
export function buildIndianPoliticsQuery(options: {
  politicianName: string
  keywords: string[]
  trackedAccounts?: string[]     // Twitter handles to monitor
  languages?: string[]           // ['hi', 'en', 'mr', 'ta', 'te', ...]
  excludeRetweets?: boolean
  minEngagement?: number
}): TwitterSearchParams[] {
  const { politicianName, keywords, trackedAccounts, languages, excludeRetweets, minEngagement } = options

  const queries: TwitterSearchParams[] = []

  // Query 1: Main keyword mentions in India
  queries.push({
    query: [politicianName, ...keywords.slice(0, 4)].map(k => `"${k}"`).join(' OR '),
    placeCountry: 'IN',
    language: (languages || ['hi', 'en'])[0],
    excludeRetweets: excludeRetweets ?? true,
    minRetweets: minEngagement || 5,
    resultType: 'recent',
    maxResults: 50,
  })

  // Query 2: Hindi language monitoring
  if ((languages || ['hi']).includes('hi')) {
    queries.push({
      query: keywords.slice(0, 3).join(' OR '),
      language: 'hi',
      excludeRetweets: false,
      minRetweets: 10,
      resultType: 'recent',
      maxResults: 30,
    })
  }

  // Query 3: Track specific accounts (competitors, journalists, influencers)
  if (trackedAccounts?.length) {
    queries.push({
      query: politicianName,
      from: trackedAccounts.slice(0, 5),
      excludeRetweets: true,
      resultType: 'recent',
      maxResults: 20,
    })
  }

  // Query 4: High-engagement content (viral signals)
  queries.push({
    query: keywords.slice(0, 2).join(' OR '),
    placeCountry: 'IN',
    excludeRetweets: true,
    minLikes: 100,
    minRetweets: 50,
    resultType: 'popular',
    maxResults: 20,
  })

  return queries
}

/**
 * Call Twitter API v2 search/recent endpoint.
 * Requires bearer token — set VITE_TWITTER_BEARER_TOKEN in .env.local
 *
 * NOTE: For production, call this from a Supabase Edge Function (server-side)
 * to protect the bearer token. This client-side version is for development.
 */
export async function searchTwitter(
  params: TwitterSearchParams,
  bearerToken: string,
): Promise<TwitterResult[]> {
  const query = buildTwitterQuery(params)
  if (!query.trim()) return []

  const url = new URL('https://api.twitter.com/2/tweets/search/recent')
  url.searchParams.set('query', query)
  url.searchParams.set('max_results', String(Math.min(params.maxResults || 20, 100)))
  url.searchParams.set('tweet.fields', 'created_at,author_id,public_metrics,lang,entities,geo')
  url.searchParams.set('user.fields', 'name,username,verified,public_metrics')
  url.searchParams.set('expansions', 'author_id')

  if (params.since) url.searchParams.set('start_time', `${params.since}T00:00:00Z`)
  if (params.until) url.searchParams.set('end_time', `${params.until}T23:59:59Z`)

  try {
    const resp = await fetch(url.toString(), {
      headers: {
        'Authorization': `Bearer ${bearerToken}`,
        'User-Agent': 'BharatMonitor/2.0',
      },
    })

    if (!resp.ok) {
      const body = await resp.json().catch(() => ({}))
      console.error('[Twitter] API error:', resp.status, body)
      // Error 185 = invalid filter parameter — log and return empty
      if (resp.status === 400) {
        console.error('[Twitter] Error 185 or 400: Invalid query parameters. Query was:', query)
        console.error('[Twitter] Simplify the query — avoid combining incompatible operators')
      }
      return []
    }

    const data = await resp.json()
    const usersMap: Record<string, { name: string; username: string }> = {}
    ;(data.includes?.users || []).forEach((u: any) => {
      usersMap[u.id] = { name: u.name, username: u.username }
    })

    return (data.data || []).map((tweet: any): TwitterResult => ({
      id: tweet.id,
      text: tweet.text,
      author_id: tweet.author_id,
      author_name: usersMap[tweet.author_id]?.name,
      author_username: usersMap[tweet.author_id]?.username,
      created_at: tweet.created_at,
      public_metrics: tweet.public_metrics || { like_count: 0, retweet_count: 0, reply_count: 0, quote_count: 0 },
      lang: tweet.lang,
      url: `https://twitter.com/i/web/status/${tweet.id}`,
    }))
  } catch (e) {
    console.error('[Twitter] Search exception:', e)
    return []
  }
}

/**
 * IMPORTANT NOTES ON TWITTER TRACKING:
 *
 * Error 185 fix: This error means "invalid filter" — usually caused by:
 *   1. Combining place_country: with lang: in the same query (unsupported)
 *   2. Using is:geo without a location attached
 *   3. Too many OR clauses (limit: 25 per query)
 *   4. Combining min_faves: with sample: operator
 *
 * Solution: Split complex queries into multiple simpler ones (as done above)
 *
 * Nitter is deprecated (most instances shut down in 2024).
 * Always use Twitter API v2 with Bearer Token.
 *
 * Free tier (Basic, $100/month): 500K tweet reads/month, recent search
 * Pro tier ($5000/month): 1M tweet reads, full-archive search
 *
 * For India, recommended query patterns:
 *   - (keyword) lang:hi place_country:IN          — Hindi-language India content
 *   - (keyword) lang:en -is:retweet               — English news/opinion
 *   - from:ANI OR from:PTI_News (keyword)         — News agency coverage
 *   - #BJP OR #Congress (keyword)                  — Political hashtags
 */

// ─── NITTER FALLBACK (for testing when no Twitter API key) ───────────────────
// Note: Most Nitter instances are down. Use as last resort.
const NITTER_INSTANCES = [
  'nitter.poast.org',
  'nitter.privacydev.net',
  'nitter.d420.de',
]

export async function searchNitter(
  query: string,
  maxResults = 20
): Promise<TwitterResult[]> {
  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `https://${instance}/search/rss?q=${encodeURIComponent(query)}&f=tweets`
      const resp = await fetch(url, { signal: AbortSignal.timeout(5000) })
      if (!resp.ok) continue

      const text = await resp.text()
      const items = text.match(/<item>([\s\S]*?)<\/item>/g) || []

      return items.slice(0, maxResults).map((item, i): TwitterResult => {
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || ''
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
        const author = item.match(/<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/)?.[1] || ''

        return {
          id: `nitter-${i}-${Date.now()}`,
          text: title,
          author_id: author,
          author_name: author,
          author_username: author.replace('@', ''),
          created_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
          public_metrics: { like_count: 0, retweet_count: 0, reply_count: 0, quote_count: 0 },
          url: link,
        }
      })
    } catch { continue }
  }
  return []
}
