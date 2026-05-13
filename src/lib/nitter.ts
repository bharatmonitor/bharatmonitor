// ============================================================
// BharatMonitor — Nitter Integration
// Nitter is an open-source Twitter front-end that exposes RSS
// feeds without requiring API keys.  We use it as the primary
// free Twitter data source with full advanced search support.
// ============================================================

import type { FeedItem, BucketColor, Sentiment } from '@/types'
import type { UniversalSearchParams } from './universalSearch'
import { buildNitterQuery } from './universalSearch'
import { scoreSentiment } from './sentiment'

// ─── Nitter instance pool ────────────────────────────────────────────────────
// Public Nitter instances — rotated on failure for reliability
const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.catsarch.com',
  'https://twiiit.com',
]

// ─── Types ───────────────────────────────────────────────────────────────────

export interface NitterPost {
  id: string
  text: string
  author: string
  authorHandle: string
  publishedAt: string
  url: string
  likes: number
  retweets: number
  replies: number
  isRetweet: boolean
  isReply: boolean
  hasMedia: boolean
  imageUrl?: string
  language?: string
}

export interface NitterSearchResult {
  posts: NitterPost[]
  instance: string
  query: string
  total: number
  error?: string
}

// ─── RSS XML parser (no external dependency) ────────────────────────────────

function parseNitterRSS(xml: string, instance: string): NitterPost[] {
  const posts: NitterPost[] = []

  // Extract <item> blocks
  const itemRx = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null

  while ((m = itemRx.exec(xml)) !== null) {
    const block = m[1]

    const get = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`)
      const match = r.exec(block)
      return (match?.[1] ?? match?.[2] ?? '').trim()
    }

    const title   = get('title')
    const link    = get('link') || get('guid')
    const pubDate = get('pubDate')
    const creator = get('dc:creator') || get('author')
    const desc    = get('description')

    // Parse engagement from description HTML
    const likesM    = /(\d[\d,]*)\s*(?:like|fav)/i.exec(desc)
    const retweetsM = /(\d[\d,]*)\s*(?:retweet|RT)/i.exec(desc)
    const repliesM  = /(\d[\d,]*)\s*(?:repl)/i.exec(desc)

    const parseNum = (m: RegExpExecArray | null) => m ? parseInt(m[1].replace(/,/g, '')) : 0

    // Extract clean text from description
    const textRaw = desc.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()

    // Determine author handle from link
    const handleM = /nitter\.[^/]+\/([^/]+)\/status/.exec(link)
    const handle  = handleM?.[1] ?? creator.replace(/^@/, '')

    if (!title && !textRaw) continue

    const isRT    = title.startsWith('RT @') || textRaw.startsWith('RT @')
    const isReply = title.startsWith('@') || link.includes('replies')

    posts.push({
      id:           link.split('/').pop() ?? String(Date.now()),
      text:         title || textRaw.substring(0, 280),
      author:       creator,
      authorHandle: handle,
      publishedAt:  pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      url:          link.replace(/https?:\/\/nitter\.[^/]+/, 'https://twitter.com'),
      likes:        parseNum(likesM),
      retweets:     parseNum(retweetsM),
      replies:      parseNum(repliesM),
      isRetweet:    isRT,
      isReply:      isReply,
      hasMedia:     /<img/i.test(desc),
      imageUrl:     (/<img[^>]+src="([^"]+)"/i.exec(desc))?.[1],
    })
  }

  return posts
}

// ─── Fetch Nitter RSS with instance fallback ─────────────────────────────────

async function fetchNitterRSS(
  path: string,
  timeout = 8000,
): Promise<{ xml: string; instance: string } | null> {
  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `${instance}${path}`
      const res = await fetch(url, {
        headers: { 'Accept': 'application/rss+xml, application/xml, text/xml' },
        signal: AbortSignal.timeout(timeout),
      })
      if (!res.ok) continue
      const xml = await res.text()
      if (xml.includes('<rss') || xml.includes('<feed')) {
        return { xml, instance }
      }
    } catch {
      // try next instance
    }
  }
  return null
}

// ─── Main search function ────────────────────────────────────────────────────

export async function searchNitter(
  params: UniversalSearchParams,
): Promise<NitterSearchResult> {
  const q = buildNitterQuery(params)
  if (!q.trim()) return { posts: [], instance: '', query: q, total: 0, error: 'Empty query' }

  const encodedQ = encodeURIComponent(q)

  // Nitter RSS search URL
  // /search/rss?q=...&f=tweets (or &f=users for user search)
  const path = `/search/rss?q=${encodedQ}&f=tweets`

  const result = await fetchNitterRSS(path)

  if (!result) {
    return { posts: [], instance: '', query: q, total: 0, error: 'All Nitter instances unavailable' }
  }

  const posts = parseNitterRSS(result.xml, result.instance)

  // Apply client-side filters that Nitter doesn't handle natively
  const filtered = posts.filter(post => {
    if (params.excludeRetweets && post.isRetweet)  return false
    if (params.excludeReplies  && post.isReply)    return false
    if (params.mediaOnly       && !post.hasMedia)  return false
    if (params.minLikes        && post.likes < params.minLikes)    return false
    if (params.minShares       && post.retweets < params.minShares) return false
    return true
  })

  return {
    posts: filtered.slice(0, params.maxResults ?? 50),
    instance: result.instance,
    query: q,
    total: filtered.length,
  }
}

// ─── Fetch a user's timeline via Nitter ─────────────────────────────────────

export async function fetchNitterTimeline(
  handle: string,
  maxResults = 30,
): Promise<NitterPost[]> {
  const path = `/${handle.replace('@', '')}/rss`
  const result = await fetchNitterRSS(path)
  if (!result) return []
  return parseNitterRSS(result.xml, result.instance).slice(0, maxResults)
}

// ─── Fetch hashtag timeline via Nitter ───────────────────────────────────────

export async function fetchNitterHashtag(
  hashtag: string,
  maxResults = 30,
): Promise<NitterPost[]> {
  const tag = hashtag.replace('#', '')
  const path = `/search/rss?q=%23${encodeURIComponent(tag)}&f=tweets`
  const result = await fetchNitterRSS(path)
  if (!result) return []
  return parseNitterRSS(result.xml, result.instance).slice(0, maxResults)
}

// ─── Convert NitterPost → FeedItem ──────────────────────────────────────────

export async function nitterPostToFeedItem(
  post: NitterPost,
  accountId: string,
  keyword: string = '',
): Promise<FeedItem> {
  const scored = await scoreSentiment(post.text)

  const bucket: BucketColor =
    scored.urgency === 'high'   ? 'red' :
    scored.urgency === 'medium' ? 'yellow' :
    scored.sentiment === 'positive' ? 'blue' : 'silver'

  return {
    id:           `nitter-${post.id}`,
    account_id:   accountId,
    platform:     'twitter',
    bucket,
    sentiment:    scored.sentiment as Sentiment,
    headline:     post.text.substring(0, 200),
    body:         post.text,
    source:       post.authorHandle ? `@${post.authorHandle}` : 'Twitter/X',
    url:          post.url,
    geo_tags:     scored.geoTags ?? [],
    topic_tags:   [
      ...(scored.topics ?? []),
      ...(post.isRetweet ? ['RT'] : []),
      ...(post.hasMedia  ? ['media'] : []),
    ],
    language:     detectLanguage(post.text),
    views:        (post.retweets * 50) + post.likes, // estimated reach
    shares:       post.retweets,
    engagement:   post.likes + post.retweets + post.replies,
    is_trending:  post.likes > 500 || post.retweets > 200,
    published_at: post.publishedAt,
    fetched_at:   new Date().toISOString(),
    keyword,
    contradiction: undefined,
  } as FeedItem & { keyword: string }
}

// ─── Language detection (lightweight heuristic) ─────────────────────────────

function detectLanguage(text: string): 'hindi' | 'english' {
  // Devanagari Unicode block: U+0900–U+097F
  const devanagariCount = (text.match(/[\u0900-\u097F]/g) || []).length
  return devanagariCount > text.length * 0.1 ? 'hindi' : 'english'
}

// ─── Multi-preset sweep (run all Indian politics presets) ───────────────────

export async function sweepNitter(
  presets: UniversalSearchParams[],
  accountId: string,
  keyword: string,
): Promise<FeedItem[]> {
  const results = await Promise.allSettled(presets.map(p => searchNitter(p)))
  const allPosts: NitterPost[] = []
  const seenIds = new Set<string>()

  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const post of r.value.posts) {
        if (!seenIds.has(post.id)) {
          seenIds.add(post.id)
          allPosts.push(post)
        }
      }
    }
  }

  const items = await Promise.all(
    allPosts.map(p => nitterPostToFeedItem(p, accountId, keyword))
  )

  return items.sort((a, b) =>
    new Date(b.published_at).getTime() - new Date(a.published_at).getTime()
  )
}
