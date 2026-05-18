// supabase/functions/bm-xpoz/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// BharatMonitor — XPOZ Social Intelligence Function
//
// Modes (pass as body.mode):
//   'search'      — keyword search across Twitter + Instagram + Reddit
//   'watchlist'   — fetch recent posts from specific handles (journalists, politicians)
//   'influencers' — find top users amplifying your keywords (who's talking about you)
//   'competitors' — fetch posts from competitor politician handles
//   'count'       — tweet volume counts for keywords (quota-free, fast)
//
// All results are saved to bm_feed with platform tags.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import {
  XpozMCPClient,
  xpozSearchTweets,
  xpozGetAuthorTweets,
  xpozGetUsersByKeywords,
  xpozSearchInstagram,
  xpozSearchReddit,
  xpozCountTweets,
  type XpozTwitterPost,
  type XpozTwitterUser,
  type XpozInstagramPost,
  type XpozRedditPost,
} from '../_shared/xpoz-client.ts'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://ylajerluygbeiqybkgtx.supabase.co'
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMDQzOSwiZXhwIjoyMDkwMDk2NDM5fQ.zgKRPK1VrZg-q7DbuwNzxfYL_3ZfqiOU4K6YiSZySSY'
const XPOZ_KEY   = Deno.env.get('XPOZ_API_KEY') ?? 'K3CdGX6jAgsWA8c87NlWbn2c5SVmKEddiTnYie2oIGhUKhvWRI1jhQeEOOqdwZKCVuyU8d1'

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

// ─── Scorer (copied from bm-ingest-v2 for consistency) ───────────────────────
const POS = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','praised','progress','victory','wins','announced','backs','supports','endorses','applauds','commends','welcomes','approves','celebrates','delivers','record','beneficiaries','scheme','distributes','opens','dedicates','completes','crore','relief','aid','empowers','transforms','revolution','historic','landmark','alliance','deal','boost','surge','rise','improvement','breakthrough']
const NEG = ['scam','scandal','corruption','fraud','arrest','protest','attack','exposed','resign','fake','crisis','blast','terror','controversy','accused','violence','clash','row','opposes','criticises','criticizes','rejects','slams','blasts','targets','demands','questions','stalls','blocks','defeated','failed','failure','lost','backlash','outrage','anger','agitation','allegation','alleged','charge','complaint','FIR','case','probe','drops','falls','decline','shortage','inflation']
const CRISIS = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','fire','emergency','explosion','stampede','massacre','attack','gunfire','tragedy','disaster','deaths','collapse','accident','crash']
const GEO = ['Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','Ahmedabad','Pune','Jaipur','Lucknow','Patna','Bhopal','Varanasi','UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','India','Tamil Nadu','Kerala','West Bengal','Assam','Odisha','Punjab','Haryana','Jharkhand','Uttarakhand','Goa','Andhra Pradesh','Telangana','Chhattisgarh','Madhya Pradesh','Jammu','Kashmir']

function score(text: string) {
  const t = text.toLowerCase()
  let s = 0
  POS.forEach(w => { if (t.includes(w)) s += 0.3 })
  NEG.forEach(w => { if (t.includes(w)) s -= 0.3 })
  CRISIS.forEach(w => { if (t.includes(w)) s -= 0.6 })
  s = Math.max(-1, Math.min(1, s))
  const isCrisis = CRISIS.some(w => t.includes(w))
  const isSarcasm = /\b(claims|promises|pledges|vows|says he|insists|denies)\b/.test(t) && s < 0
  return {
    tone:      Math.round(s * 5),
    bucket:    isCrisis || s < -0.5 ? 'red' : s < -0.2 ? 'yellow' : s > 0.15 ? 'blue' : 'silver',
    sentiment: s > 0.15 ? 'positive' : s < -0.15 ? 'negative' : 'neutral',
    geo_tags:  GEO.filter(g => t.includes(g.toLowerCase())),
    topic_tags: [
      ...(isCrisis ? ['Crisis'] : []),
      ...(s > 0.3 ? ['Achievement'] : []),
      ...(t.includes('election') ? ['Election'] : []),
      ...(isSarcasm ? ['Sarcasm'] : []),
      ...(t.includes('parliament') ? ['Parliament'] : []),
      ...(t.includes('budget') || t.includes('economy') ? ['Economy'] : []),
    ],
  }
}

function nowIso() { return new Date().toISOString() }

// ─── Converters → bm_feed rows ───────────────────────────────────────────────

function tweetToRow(post: XpozTwitterPost, accountId: string, keyword: string, watchlistSource?: string) {
  const text = post.text || ''
  const sc = score(text)
  const now = nowIso()
  return {
    id:              `xpoz-tw-${post.id || Date.now() + Math.random()}`,
    account_id:      accountId,
    headline:        text.substring(0, 220),
    body:            text,
    source:          `@${post.authorUsername || 'X'}`,
    source_name:     post.authorUsername || 'X',
    source_type:     'social',
    platform:        'twitter',
    url:             post.authorUsername && post.id
                       ? `https://x.com/${post.authorUsername}/status/${post.id}`
                       : '',
    bucket:          sc.bucket,
    sentiment:       sc.sentiment,
    tone:            sc.tone,
    geo_tags:        sc.geo_tags,
    topic_tags:      sc.topic_tags,
    language:        post.lang === 'hi' ? 'hindi' : 'english',
    keyword,
    views:           post.impressionCount || 0,
    shares:          post.retweetCount || 0,
    engagement:      (post.likeCount || 0) + (post.replyCount || 0) + (post.retweetCount || 0) + (post.quoteCount || 0),
    is_trending:     (post.impressionCount || 0) > 50_000,
    watchlist_source: watchlistSource || null,
    national_mode:   false,
    published_at:    post.createdAt || now,
    fetched_at:      now,
    created_at:      now,
  }
}

function instaToRow(post: XpozInstagramPost, accountId: string, keyword: string) {
  const text = post.caption || ''
  const sc = score(text)
  const now = nowIso()
  return {
    id:          `xpoz-ig-${post.id || Date.now() + Math.random()}`,
    account_id:  accountId,
    headline:    text.substring(0, 220) || `Instagram post by @${post.username}`,
    body:        text,
    source:      `@${post.username || 'Instagram'}`,
    source_name: post.username || 'Instagram',
    source_type: 'social',
    platform:    'instagram',
    url:         post.codeUrl ? `https://www.instagram.com/p/${post.codeUrl}/` : '',
    bucket:      sc.bucket,
    sentiment:   sc.sentiment,
    tone:        sc.tone,
    geo_tags:    sc.geo_tags,
    topic_tags:  sc.topic_tags,
    language:    'english',
    keyword,
    views:       post.videoPlayCount || 0,
    shares:      0,
    engagement:  (post.likeCount || 0) + (post.commentCount || 0),
    is_trending: (post.likeCount || 0) > 10_000,
    published_at: post.createdAt || now,
    fetched_at:  now,
    created_at:  now,
  }
}

function redditToRow(post: XpozRedditPost, accountId: string, keyword: string) {
  const text = `${post.title || ''} ${post.selftext || ''}`.trim()
  const sc = score(text)
  const now = nowIso()
  return {
    id:          `xpoz-rd-${post.id || Date.now() + Math.random()}`,
    account_id:  accountId,
    headline:    post.title || text.substring(0, 180),
    body:        post.selftext || '',
    source:      `r/${post.subredditName || 'reddit'}`,
    source_name: `r/${post.subredditName || 'reddit'}`,
    source_type: 'social',
    platform:    'reddit',
    url:         post.postUrl || (post.permalink ? `https://reddit.com${post.permalink}` : ''),
    bucket:      sc.bucket,
    sentiment:   sc.sentiment,
    tone:        sc.tone,
    geo_tags:    sc.geo_tags,
    topic_tags:  sc.topic_tags,
    language:    'english',
    keyword,
    views:       0,
    shares:      post.score || 0,
    engagement:  (post.score || 0) + (post.commentsCount || 0),
    is_trending: (post.score || 0) > 500,
    published_at: post.createdAt || now,
    fetched_at:  now,
    created_at:  now,
  }
}

// ─── Save to Supabase ─────────────────────────────────────────────────────────

async function saveRows(rows: any[]): Promise<number> {
  if (!rows.length) return 0
  // Dedup by id
  const seen = new Set<string>()
  const deduped = rows.filter(r => { if (seen.has(r.id)) return false; seen.add(r.id); return true })

  const { error } = await db.from('bm_feed').upsert(deduped, { onConflict: 'id', ignoreDuplicates: true })
  if (error) { console.error('[XPOZ] saveRows error:', error.message); return 0 }
  return deduped.length
}

// ─── MAIN HANDLER ─────────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  if (!XPOZ_KEY) {
    return new Response(JSON.stringify({ ok: false, error: 'XPOZ_API_KEY not set in Supabase Secrets' }), { headers: CORS, status: 500 })
  }

  let body: any
  try { body = await req.json() } catch { return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), { headers: CORS, status: 400 }) }

  const {
    accountId,
    politicianName,
    keywords = [],
    watchlistHandles = [],       // [{ handle: '@svaradarajan', platform: 'twitter', display_name: 'Siddharth' }]
    competitorHandles = [],      // [{ name: 'Rahul Gandhi', handle: '@RahulGandhi' }]
    mode = 'search',             // 'search' | 'watchlist' | 'influencers' | 'competitors' | 'count'
    maxPerKeyword = 20,
    startDate,
  } = body

  if (!accountId) return new Response(JSON.stringify({ ok: false, error: 'Missing accountId' }), { headers: CORS, status: 400 })

  console.log(`[XPOZ] START mode=${mode} accountId=${accountId} keywords=[${keywords.slice(0,3)}] handles=${watchlistHandles.length}`)

  const allRows: any[] = []
  const errors: string[] = []

  const sevenDaysAgo = startDate || new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().substring(0, 10)

  // ── MODE: search ────────────────────────────────────────────────────────────
  if (mode === 'search' || mode === 'all') {
    const kws = (keywords as string[]).slice(0, 6)

    await Promise.allSettled([
      // Twitter keyword search (core)
      ...kws.map(async kw => {
        const query = `(${kw}) india -filter:retweets lang:en`
        const posts = await xpozSearchTweets(XPOZ_KEY, query, {
          startDate: sevenDaysAgo, limit: maxPerKeyword, filterRetweets: true,
        })
        allRows.push(...posts.map(p => tweetToRow(p, accountId, kw)))
        console.log(`[XPOZ] Twitter "${kw}": ${posts.length}`)
      }),

      // Hindi Twitter search for keywords
      ...kws.slice(0, 3).map(async kw => {
        const posts = await xpozSearchTweets(XPOZ_KEY, `${kw} india`, {
          startDate: sevenDaysAgo, limit: 10, language: 'hi',
        })
        allRows.push(...posts.map(p => tweetToRow(p, accountId, kw)))
      }),

      // Instagram keyword search
      ...kws.slice(0, 3).map(async kw => {
        const posts = await xpozSearchInstagram(XPOZ_KEY, `${kw} india`, {
          startDate: sevenDaysAgo, limit: 10,
        })
        allRows.push(...posts.map(p => instaToRow(p, accountId, kw)))
        console.log(`[XPOZ] Instagram "${kw}": ${posts.length}`)
      }),

      // Reddit via XPOZ (richer data than free API)
      ...kws.slice(0, 3).map(async kw => {
        const posts = await xpozSearchReddit(XPOZ_KEY, `${kw} india`, {
          startDate: sevenDaysAgo, limit: 10,
        })
        allRows.push(...posts.map(p => redditToRow(p, accountId, kw)))
        console.log(`[XPOZ] Reddit "${kw}": ${posts.length}`)
      }),
    ])
  }

  // ── MODE: bluesky ──────────────────────────────────────────────────────────
  // Pure Bluesky API — no XPOZ key needed, completely free
  if (mode === 'bluesky' || mode === 'all') {
    const kws = (keywords as string[]).slice(0, 5)
    await Promise.allSettled(kws.map(async (kw) => {
      try {
        const q = encodeURIComponent(kw)
        const r = await fetch(`https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${q}&limit=20`, {
          headers: { 'Accept': 'application/json' },
          signal: AbortSignal.timeout(10_000),
        })
        if (!r.ok) return
        const d = await r.json()
        const posts = d.posts || []
        posts.forEach((p: any) => {
          const text = p.record?.text || ''
          if (!text || text.length < 10) return
          const sc = score(text)
          allRows.push({
            id:           `bsky-${p.cid || Math.random().toString(36).slice(2)}`,
            account_id:   accountId,
            headline:     text.slice(0, 220),
            title:        text.slice(0, 220),
            body:         text.slice(0, 1000),
            source:       `@${p.author?.handle || 'bluesky'}`,
            source_name:  p.author?.displayName || p.author?.handle || 'Bluesky',
            source_type:  'twitter',
            platform:     'twitter',
            url:          `https://bsky.app/profile/${p.author?.handle}/post/${p.uri?.split('/').pop()}`,
            bucket:       sc.bucket,
            sentiment:    sc.sentiment,
            tone:         sc.tone,
            geo_tags:     sc.geo_tags,
            topic_tags:   sc.topic_tags,
            language:     'english',
            keyword:      kw,
            engagement:   (p.likeCount || 0) + (p.repostCount || 0),
            published_at: p.record?.createdAt || nowIso(),
            fetched_at:   nowIso(),
            created_at:   nowIso(),
          })
        })
        console.log(`[XPOZ/Bluesky] "${kw}": ${posts.length} posts`)
      } catch (e: any) {
        console.warn(`[XPOZ/Bluesky] "${kw}" failed:`, e.message)
      }
    }))
  }

  // ── MODE: watchlist ─────────────────────────────────────────────────────────
  // Fetch recent posts from specific tracked handles (journalists, influencers)
  if (mode === 'watchlist' || mode === 'all') {
    const activeHandles = (watchlistHandles as any[]).filter(h => h.is_active !== false)
    const twitterHandles = activeHandles.filter(h => h.platform === 'twitter' || h.platform === 'all').slice(0, 20)

    await Promise.allSettled(
      twitterHandles.map(async h => {
        const username = (h.handle || '').replace('@', '').replace('x.com/', '').trim()
        if (!username) return
        const posts = await xpozGetAuthorTweets(XPOZ_KEY, username, {
          startDate: sevenDaysAgo, limit: 15,
        })
        const rows = posts
          .filter(p => (p.text || '').length > 20) // skip very short posts
          .map(p => tweetToRow(p, accountId, keywords[0] || politicianName || '', h.display_name || username))
        allRows.push(...rows)
        console.log(`[XPOZ] watchlist @${username}: ${rows.length} posts`)
      })
    )
  }

  // ── MODE: competitors ────────────────────────────────────────────────────────
  // Fetch posts from known competitor/opposition handles
  if (mode === 'competitors' || mode === 'all') {
    const comp = (competitorHandles as any[]).slice(0, 15)

    await Promise.allSettled(
      comp.map(async c => {
        const username = (c.handle || '').replace('@', '')
        if (!username) return
        const posts = await xpozGetAuthorTweets(XPOZ_KEY, username, {
          startDate: sevenDaysAgo, limit: 20,
        })
        const rows = posts.map(p => ({
          ...tweetToRow(p, accountId, c.name || username),
          source_type: 'competitor',
          topic_tags: [...(score(p.text || '').topic_tags), 'Competitor'],
        }))
        allRows.push(...rows)
        console.log(`[XPOZ] competitor @${username}: ${rows.length} posts`)
      })
    )
  }

  // ── MODE: influencers ────────────────────────────────────────────────────────
  // Find top users amplifying your keywords — returns user data, not saved to feed
  if (mode === 'influencers') {
    const kw = (keywords as string[]).slice(0, 3)
    const influencerResults: XpozTwitterUser[] = []

    await Promise.allSettled(
      kw.map(async k => {
        const users = await xpozGetUsersByKeywords(XPOZ_KEY, `${k} india`, {
          startDate: sevenDaysAgo, limit: 20,
        })
        influencerResults.push(...users)
      })
    )

    // Dedup by username, sort by relevance
    const seen = new Set<string>()
    const unique = influencerResults
      .filter(u => { if (!u.username || seen.has(u.username)) return false; seen.add(u.username); return true })
      .sort((a, b) => (b.aggRelevance || 0) - (a.aggRelevance || 0))
      .slice(0, 50)

    return new Response(JSON.stringify({
      ok: true, mode: 'influencers',
      influencers: unique.map(u => ({
        username: u.username,
        name: u.name,
        followers: u.followersCount,
        tweets: u.tweetCount,
        verified: u.verified,
        location: u.location,
        description: u.description?.substring(0, 140),
        relevance: u.aggRelevance,
        relevantTweets: u.relevantTweetsCount,
        totalImpressions: u.relevantTweetsImpressionsSum,
        totalLikes: u.relevantTweetsLikesSum,
        profileImage: u.profileImageUrl,
        url: `https://x.com/${u.username}`,
      })),
      count: unique.length,
    }), { headers: CORS })
  }

  // ── MODE: count ──────────────────────────────────────────────────────────────
  // Fast volume counts — no content saved, useful for trend monitoring
  if (mode === 'count') {
    const counts: Record<string, number> = {}
    const kws = (keywords as string[]).slice(0, 8)

    await Promise.allSettled(
      kws.map(async kw => {
        const n = await xpozCountTweets(XPOZ_KEY, `${kw} india`, { startDate: sevenDaysAgo })
        counts[kw] = n
      })
    )

    return new Response(JSON.stringify({ ok: true, mode: 'count', counts }), { headers: CORS })
  }

  // ── Save all rows ─────────────────────────────────────────────────────────
  const inserted = await saveRows(allRows)

  // ── Platform breakdown for logging ───────────────────────────────────────
  const breakdown: Record<string, number> = {}
  allRows.forEach(r => { breakdown[r.platform] = (breakdown[r.platform] || 0) + 1 })

  console.log(`[XPOZ] DONE mode=${mode} total=${allRows.length} inserted=${inserted} breakdown=${JSON.stringify(breakdown)}`)

  return new Response(JSON.stringify({
    ok: true,
    mode,
    collected: allRows.length,
    inserted,
    breakdown,
    errors: errors.length ? errors : undefined,
  }), { headers: CORS })
})
