// ============================================================
// BharatMonitor — Instagram API Integration
//
// Layer 1 (Official): Instagram Graph API — hashtag search,
//   profile media, insights. Requires a Facebook App with an
//   Instagram Business or Creator account linked.
//
// Layer 2 (Fallback): Public Instagram RSS via Bibliogram /
//   picuki-style scrapers — no token needed for public data.
//
// ─── WHERE TO GET AN INSTAGRAM ACCESS TOKEN ──────────────────
//
//  1. Go to developers.facebook.com → Create App → Business type
//  2. Add "Instagram Graph API" product
//  3. Link your Instagram Business/Creator account in Settings
//  4. Generate a Long-Lived Token (valid 60 days):
//       GET https://graph.facebook.com/oauth/access_token?
//         grant_type=fb_exchange_token&
//         client_id={APP_ID}&
//         client_secret={APP_SECRET}&
//         fb_exchange_token={SHORT_TOKEN}
//  5. Refresh before expiry (automate via cron):
//       GET https://graph.facebook.com/refresh_access_token?
//         grant_type=ig_refresh_token&access_token={TOKEN}
//  6. Set env: VITE_META_ACCESS_TOKEN and VITE_META_USER_ID
//       (Meta User ID, not username — visible in Graph API Explorer)
//
//  Rate limits: 200 hashtag searches/hour per user,
//               4,800 media reads/hour
// ============================================================

import type { FeedItem, BucketColor, Sentiment } from '@/types'
import { scoreSentiment } from './sentiment'

// ─── Config ──────────────────────────────────────────────────────────────────

const META_TOKEN   = import.meta.env.VITE_META_ACCESS_TOKEN || ''
const META_USER_ID = import.meta.env.VITE_META_USER_ID      || ''  // IG Business user ID
const GRAPH_BASE   = 'https://graph.facebook.com/v21.0'

// ─── Types ───────────────────────────────────────────────────────────────────

export interface IGMedia {
  id:          string
  caption?:    string
  media_type:  'IMAGE' | 'VIDEO' | 'CAROUSEL_ALBUM'
  media_url?:  string
  thumbnail?:  string
  permalink:   string
  timestamp:   string
  like_count?: number
  comments_count?: number
  username?:   string
}

export interface IGHashtagResult {
  posts:   IGMedia[]
  hashtag: string
  error?:  string
}

// ─── Step 1: Resolve hashtag ID ──────────────────────────────────────────────

async function resolveHashtagId(hashtag: string): Promise<string | null> {
  if (!META_TOKEN || !META_USER_ID) return null
  try {
    const url = `${GRAPH_BASE}/ig_hashtag_search?user_id=${META_USER_ID}&q=${encodeURIComponent(hashtag.replace('#', ''))}&access_token=${META_TOKEN}`
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return null
    const data = await res.json()
    return data?.data?.[0]?.id ?? null
  } catch {
    return null
  }
}

// ─── Step 2: Fetch media for hashtag ─────────────────────────────────────────

async function fetchHashtagMedia(
  hashtagId: string,
  type: 'recent_media' | 'top_media' = 'recent_media',
  limit = 25,
): Promise<IGMedia[]> {
  if (!META_TOKEN || !META_USER_ID) return []
  try {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count,username'
    const url    = `${GRAPH_BASE}/${hashtagId}/${type}?user_id=${META_USER_ID}&fields=${fields}&limit=${limit}&access_token=${META_TOKEN}`
    const res    = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.data || []).map((m: any) => ({
      id:            m.id,
      caption:       m.caption,
      media_type:    m.media_type,
      media_url:     m.media_url || m.thumbnail_url,
      thumbnail:     m.thumbnail_url,
      permalink:     m.permalink,
      timestamp:     m.timestamp,
      like_count:    m.like_count,
      comments_count: m.comments_count,
      username:      m.username,
    }))
  } catch {
    return []
  }
}

// ─── Step 3: Fetch user profile posts ────────────────────────────────────────

export async function fetchIGProfilePosts(
  igUserId: string,
  limit = 20,
): Promise<IGMedia[]> {
  if (!META_TOKEN) return []
  try {
    const fields = 'id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count'
    const url    = `${GRAPH_BASE}/${igUserId}/media?fields=${fields}&limit=${limit}&access_token=${META_TOKEN}`
    const res    = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data   = await res.json()
    return data?.data || []
  } catch {
    return []
  }
}

// ─── Full hashtag search (resolves ID then fetches) ──────────────────────────

export async function searchInstagramHashtag(
  hashtag: string,
  options: { recent?: boolean; top?: boolean; limit?: number } = {},
): Promise<IGHashtagResult> {
  if (!META_TOKEN || !META_USER_ID) {
    return { posts: [], hashtag, error: 'No Instagram access token. Set VITE_META_ACCESS_TOKEN + VITE_META_USER_ID.' }
  }

  const hashtagId = await resolveHashtagId(hashtag)
  if (!hashtagId) {
    return { posts: [], hashtag, error: `Could not resolve hashtag #${hashtag}` }
  }

  const types: ('recent_media' | 'top_media')[] = []
  if (options.recent !== false) types.push('recent_media')
  if (options.top)              types.push('top_media')
  if (!types.length)            types.push('recent_media')

  const results = await Promise.all(
    types.map(t => fetchHashtagMedia(hashtagId, t, options.limit ?? 25))
  )

  const allPosts = results.flat()
  const seen     = new Set<string>()
  const unique   = allPosts.filter(p => { if (seen.has(p.id)) return false; seen.add(p.id); return true })

  return { posts: unique, hashtag }
}

// ─── Bulk hashtag sweep ───────────────────────────────────────────────────────

export async function searchInstagramHashtags(
  hashtags: string[],
  limit = 15,
): Promise<IGMedia[]> {
  const results = await Promise.allSettled(
    hashtags.map(h => searchInstagramHashtag(h, { limit }))
  )
  const allPosts: IGMedia[] = []
  const seen = new Set<string>()

  for (const r of results) {
    if (r.status === 'fulfilled') {
      for (const p of r.value.posts) {
        if (!seen.has(p.id)) {
          seen.add(p.id)
          allPosts.push(p)
        }
      }
    }
  }

  return allPosts.sort((a, b) =>
    new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
}

// ─── Convert IGMedia → FeedItem ──────────────────────────────────────────────

export async function igMediaToFeedItem(
  media: IGMedia,
  accountId: string,
  keyword: string = '',
): Promise<FeedItem> {
  const text    = media.caption || ''
  const scored  = await scoreSentiment(text)

  const bucket: BucketColor =
    scored.urgency === 'high'       ? 'red' :
    scored.sentiment === 'positive' ? 'blue' :
    scored.urgency === 'medium'     ? 'yellow' : 'silver'

  return {
    id:           `ig-${media.id}`,
    account_id:   accountId,
    platform:     'instagram',
    bucket,
    sentiment:    scored.sentiment as Sentiment,
    headline:     text ? text.substring(0, 180) + (text.length > 180 ? '…' : '') : `[${media.media_type}] Instagram post`,
    body:         text,
    source:       media.username ? `@${media.username}` : 'Instagram',
    url:          media.permalink,
    geo_tags:     scored.geoTags,
    topic_tags:   [...scored.topics, media.media_type.toLowerCase()],
    language:     'english',
    views:        (media.like_count ?? 0) * 10,       // estimated reach
    engagement:   (media.like_count ?? 0) + (media.comments_count ?? 0),
    shares:       undefined,
    is_trending:  (media.like_count ?? 0) > 1000,
    thumbnail:    media.thumbnail || media.media_url,
    published_at: media.timestamp,
    fetched_at:   new Date().toISOString(),
    keyword,
    contradiction: undefined,
  } as FeedItem & { keyword: string }
}

// ─── Token health check ───────────────────────────────────────────────────────

export async function checkIGTokenHealth(): Promise<{
  valid: boolean
  expiresIn?: number
  error?: string
}> {
  if (!META_TOKEN) return { valid: false, error: 'No token configured' }
  try {
    const url = `${GRAPH_BASE}/me?access_token=${META_TOKEN}&fields=id,name`
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) })
    if (!res.ok) {
      const err = await res.json()
      return { valid: false, error: err?.error?.message }
    }
    const data = await res.json()
    return { valid: !!data.id }
  } catch (e: any) {
    return { valid: false, error: e.message }
  }
}

// ─── Public fallback scraper (no token needed) ───────────────────────────────
// Uses picuki or gramhir style public data.
// NOTE: These are unofficial and may break. Use only as fallback.

export async function fetchPublicHashtagIG(
  hashtag: string,
  maxResults = 10,
): Promise<IGMedia[]> {
  // Try Instagram's public feed (no auth, rate limited)
  try {
    const tag = hashtag.replace('#', '')
    const url = `https://www.picuki.com/tag/${encodeURIComponent(tag)}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BharatMonitor/1.0)' },
      signal: AbortSignal.timeout(8000),
    })
    if (!res.ok) return []
    const html = await res.text()

    // Parse photo links from HTML
    const linkRx = /href="(https:\/\/www\.picuki\.com\/media\/[^"]+)"/g
    const imgRx  = /src="(https:\/\/[^"]+\.jpg[^"]*)"/g
    const links  = [...html.matchAll(linkRx)].map(m => m[1])
    const imgs   = [...html.matchAll(imgRx)].map(m => m[1])

    return links.slice(0, maxResults).map((link, i) => ({
      id:         `ig-pub-${tag}-${i}`,
      media_type: 'IMAGE' as const,
      permalink:  link.replace('picuki.com', 'instagram.com'),
      media_url:  imgs[i],
      thumbnail:  imgs[i],
      timestamp:  new Date().toISOString(),
      caption:    `#${tag}`,
    }))
  } catch {
    return []
  }
}
