// ============================================================
// BharatMonitor — Unified Ingest Edge Function v2
// Runtime: Deno (Supabase Edge Functions)
//
// Sources integrated:
//   1. Nitter RSS  — Twitter/X via public Nitter instances
//   2. Instagram   — Graph API hashtag + profile search
//   3. YouTube     — Data API v3 search
//   4. Reddit      — public JSON API (no auth needed)
//   5. Google News — RSS via news.google.com
//   6. NewsData.io — optional paid news API
//
// AI Sentiment: Claude API (claude-haiku-4-5-20251001) — fast + cheap
//
// Env vars required:
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (auto-injected)
//   ANTHROPIC_API_KEY      — for Claude sentiment
//   YT_API_KEY             — YouTube Data API v3
//   META_ACCESS_TOKEN      — Instagram Graph API
//   META_USER_ID           — Instagram Business user ID
//   NEWSDATA_API_KEY       — optional: NewsData.io
//
// Invocation:
//   POST /functions/v1/bm-ingest-v2
//   { accountId, politicianName, keywords: string[], handles?: string[] }
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const YT_KEY        = Deno.env.get('YT_API_KEY') ?? ''
const META_TOKEN    = Deno.env.get('META_ACCESS_TOKEN') ?? ''
const META_USER_ID  = Deno.env.get('META_USER_ID') ?? ''
const NEWSDATA_KEY  = Deno.env.get('NEWSDATA_API_KEY') ?? ''

const GRAPH_BASE = 'https://graph.facebook.com/v21.0'
const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.catsarch.com',
]

// ─── Types ───────────────────────────────────────────────────────────────────

interface IngestRequest {
  accountId:     string
  politicianName: string
  keywords:      string[]
  handles?:      string[]
  maxPerSource?: number
}

interface RawItem {
  id:           string
  platform:     string
  source:       string
  text:         string
  url:          string
  published_at: string
  likes?:       number
  shares?:      number
  replies?:     number
  views?:       number
  thumbnail?:   string
  keyword:      string
}

interface SentimentResult {
  sentiment:  'positive' | 'negative' | 'neutral'
  score:      number   // -1 to 1
  urgency:    'high' | 'medium' | 'low'
  topics:     string[]
  geoTags:    string[]
  entities:   string[]
  summary:    string
  oppRisk:    number   // 0-100
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function timeout(ms: number): AbortSignal {
  return AbortSignal.timeout(ms)
}

function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true })
}

async function safeJson(res: Response): Promise<any> {
  try { return await res.json() } catch { return null }
}

// ─── 1. NITTER (Twitter/X) ───────────────────────────────────────────────────

function parseNitterRSS(xml: string): RawItem[] {
  const items: RawItem[] = []
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

    const likesM    = /(\d[\d,]*)\s*(?:like|fav)/i.exec(desc)
    const retweetsM = /(\d[\d,]*)\s*(?:retweet|RT)/i.exec(desc)
    const repliesM  = /(\d[\d,]*)\s*(?:repl)/i.exec(desc)
    const parseNum  = (mx: RegExpExecArray | null) => mx ? parseInt(mx[1].replace(/,/g, '')) : 0

    const text = (title || desc.replace(/<[^>]+>/g, ' ')).substring(0, 500)
    if (!text.trim()) continue

    const handleM = /\/([^/]+)\/status/.exec(link)
    const handle  = handleM?.[1] ?? creator.replace('@', '')
    const twitterUrl = link.replace(/https?:\/\/[^/]+/, 'https://twitter.com')

    items.push({
      id:           `nitter-${link.split('/').pop() ?? Date.now()}`,
      platform:     'twitter',
      source:       handle ? `@${handle}` : 'Twitter/X',
      text,
      url:          twitterUrl || link,
      published_at: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
      likes:        parseNum(likesM),
      shares:       parseNum(retweetsM),
      replies:      parseNum(repliesM),
      keyword:      '',
    })
  }
  return items
}

async function fetchNitter(query: string, keyword: string, max = 30): Promise<RawItem[]> {
  const path = `/search/rss?q=${encodeURIComponent(query)}&f=tweets`
  for (const instance of NITTER_INSTANCES) {
    try {
      const res = await fetch(`${instance}${path}`, {
        headers: { Accept: 'application/rss+xml, text/xml' },
        signal: timeout(8000),
      })
      if (!res.ok) continue
      const xml = await res.text()
      if (!xml.includes('<rss') && !xml.includes('<feed')) continue
      const posts = parseNitterRSS(xml).slice(0, max)
      return posts.map(p => ({ ...p, keyword }))
    } catch { continue }
  }
  return []
}

async function ingestTwitter(
  keywords: string[], handles: string[], max: number
): Promise<RawItem[]> {
  const tasks: Promise<RawItem[]>[] = []

  // Keyword searches
  for (const kw of keywords.slice(0, 5)) {
    const q = `${kw} -filter:retweets lang:en min_faves:5`
    tasks.push(fetchNitter(q, kw, max))
    const qHi = `${kw} -filter:retweets lang:hi`
    tasks.push(fetchNitter(qHi, kw, Math.floor(max / 2)))
  }

  // Handle timelines
  for (const handle of handles.slice(0, 5)) {
    const h = handle.replace('@', '')
    // user timeline via Nitter RSS
    for (const instance of NITTER_INSTANCES) {
      try {
        const res = await fetch(`${instance}/${h}/rss`, { signal: timeout(6000) })
        if (!res.ok) continue
        const xml = await res.text()
        if (!xml.includes('<rss')) continue
        const posts = parseNitterRSS(xml).slice(0, max).map(p => ({ ...p, keyword: h }))
        tasks.push(Promise.resolve(posts))
        break
      } catch { continue }
    }
  }

  const results = await Promise.allSettled(tasks)
  return results.flatMap(r => r.status === 'fulfilled' ? r.value : [])
}

// ─── 2. INSTAGRAM (Graph API) ────────────────────────────────────────────────

async function resolveIGHashtagId(tag: string): Promise<string | null> {
  if (!META_TOKEN || !META_USER_ID) return null
  try {
    const url = `${GRAPH_BASE}/ig_hashtag_search?user_id=${META_USER_ID}&q=${encodeURIComponent(tag)}&access_token=${META_TOKEN}`
    const res = await fetch(url, { signal: timeout(8000) })
    if (!res.ok) return null
    const data = await safeJson(res)
    return data?.data?.[0]?.id ?? null
  } catch { return null }
}

async function ingestInstagram(keywords: string[], max: number): Promise<RawItem[]> {
  if (!META_TOKEN || !META_USER_ID) return []
  const items: RawItem[] = []
  const fields = 'id,caption,media_type,permalink,timestamp,like_count,comments_count,username'

  for (const kw of keywords.slice(0, 4)) {
    const tag = kw.replace(/\s+/g, '').replace('#', '')
    const hashtagId = await resolveIGHashtagId(tag)
    if (!hashtagId) continue
    try {
      const url = `${GRAPH_BASE}/${hashtagId}/recent_media?user_id=${META_USER_ID}&fields=${fields}&limit=${max}&access_token=${META_TOKEN}`
      const res = await fetch(url, { signal: timeout(10000) })
      if (!res.ok) continue
      const data = await safeJson(res)
      for (const m of (data?.data ?? [])) {
        items.push({
          id:           `ig-${m.id}`,
          platform:     'instagram',
          source:       m.username ? `@${m.username}` : `#${tag}`,
          text:         m.caption || `[${m.media_type}] #${tag}`,
          url:          m.permalink,
          published_at: m.timestamp,
          likes:        m.like_count,
          replies:      m.comments_count,
          keyword:      kw,
        })
      }
    } catch { continue }
  }
  return items
}

// ─── 3. YOUTUBE ──────────────────────────────────────────────────────────────

async function ingestYouTube(keywords: string[], max: number): Promise<RawItem[]> {
  if (!YT_KEY) return []
  const items: RawItem[] = []

  for (const kw of keywords.slice(0, 4)) {
    try {
      const q   = encodeURIComponent(kw)
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&relevanceLanguage=hi&order=date&maxResults=${max}&key=${YT_KEY}`
      const res = await fetch(url, { signal: timeout(10000) })
      if (!res.ok) continue
      const data = await safeJson(res)
      for (const item of (data?.items ?? [])) {
        const vid = item.id?.videoId
        if (!vid) continue
        const s = item.snippet
        items.push({
          id:           `yt-${vid}`,
          platform:     'youtube',
          source:       s.channelTitle || 'YouTube',
          text:         `${s.title}\n${s.description || ''}`,
          url:          `https://youtube.com/watch?v=${vid}`,
          published_at: s.publishedAt,
          thumbnail:    s.thumbnails?.medium?.url,
          keyword:      kw,
        })
      }
    } catch { continue }
  }
  return items
}

// ─── 4. REDDIT ───────────────────────────────────────────────────────────────

async function ingestReddit(keywords: string[], max: number): Promise<RawItem[]> {
  const items: RawItem[] = []
  const subreddits = ['india', 'IndianPolitics', 'IndiaSpeaks', 'Sham_Sharma_Show', 'unitedstatesofindia']

  for (const kw of keywords.slice(0, 3)) {
    // Search across multiple subreddits
    for (const sub of subreddits.slice(0, 3)) {
      try {
        const q   = encodeURIComponent(kw)
        const url = `https://www.reddit.com/r/${sub}/search.json?q=${q}&sort=new&restrict_sr=on&limit=${Math.ceil(max / 3)}&raw_json=1`
        const res = await fetch(url, {
          headers: { 'User-Agent': 'BharatMonitor/2.0' },
          signal: timeout(8000),
        })
        if (!res.ok) continue
        const data = await safeJson(res)
        for (const child of (data?.data?.children ?? [])) {
          const p = child.data
          if (!p?.id) continue
          items.push({
            id:           `reddit-${p.id}`,
            platform:     'reddit',
            source:       `r/${p.subreddit}`,
            text:         `${p.title}\n${p.selftext?.substring(0, 500) ?? ''}`,
            url:          `https://reddit.com${p.permalink}`,
            published_at: new Date(p.created_utc * 1000).toISOString(),
            likes:        p.score,
            replies:      p.num_comments,
            views:        p.view_count ?? 0,
            keyword:      kw,
          })
        }
      } catch { continue }
    }
  }
  return items
}

// ─── 5. GOOGLE NEWS (RSS) ────────────────────────────────────────────────────

function parseNewsRSS(xml: string): { title: string; link: string; pubDate: string; source: string }[] {
  const items: { title: string; link: string; pubDate: string; source: string }[] = []
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

async function ingestNews(keywords: string[], max: number): Promise<RawItem[]> {
  const items: RawItem[] = []

  for (const kw of keywords.slice(0, 5)) {
    try {
      // Google News RSS (no key required)
      const q   = encodeURIComponent(`${kw} india`)
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 BharatMonitor/2.0' },
        signal: timeout(8000),
      })
      if (!res.ok) continue
      const xml = await res.text()
      const parsed = parseNewsRSS(xml).slice(0, max)
      for (const p of parsed) {
        items.push({
          id:           `news-${encodeURIComponent(p.link).substring(0, 40)}-${Date.now()}`,
          platform:     'news',
          source:       p.source,
          text:         p.title,
          url:          p.link,
          published_at: p.pubDate ? new Date(p.pubDate).toISOString() : new Date().toISOString(),
          keyword:      kw,
        })
      }
    } catch { continue }

    // NewsData.io (optional paid API — much richer)
    if (NEWSDATA_KEY) {
      try {
        const q   = encodeURIComponent(kw)
        const url = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=${q}&country=in&language=en,hi&category=politics`
        const res = await fetch(url, { signal: timeout(10000) })
        if (!res.ok) continue
        const data = await safeJson(res)
        for (const a of (data?.results ?? []).slice(0, max)) {
          items.push({
            id:           `newsdata-${a.article_id}`,
            platform:     'news',
            source:       a.source_id || 'NewsData',
            text:         `${a.title}\n${a.description || ''}`,
            url:          a.link,
            published_at: a.pubDate || new Date().toISOString(),
            thumbnail:    a.image_url,
            keyword:      kw,
          })
        }
      } catch { /* skip */ }
    }
  }
  return items
}

// ─── 6. CLAUDE AI SENTIMENT ──────────────────────────────────────────────────

const GEO_TERMS = [
  'Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','Ahmedabad',
  'Pune','Jaipur','Lucknow','Patna','Bhopal','Varanasi','Ayodhya','Surat',
  'UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','Tamil Nadu',
  'Telangana','Andhra','Kerala','West Bengal','Odisha','Assam','Punjab',
  'India','Bharat','दिल्ली','मुंबई','उत्तर प्रदेश',
]

const NEG_KW = ['scam','scandal','corruption','fraud','arrest','protest','riot','attack','exposed','resign','fake','crisis','flood','blast','terror','dead','killed','murder']
const POS_KW = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','historic','breakthrough','praised','commended']
const CRISIS_KW = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','rape','fire','emergency']
const OPP_KW = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition','indi alliance','jumla']

function keywordScore(text: string): SentimentResult {
  const lower = text.toLowerCase()
  let score = 0
  for (const w of POS_KW)    if (lower.includes(w)) score += 0.3
  for (const w of NEG_KW)    if (lower.includes(w)) score -= 0.3
  for (const w of CRISIS_KW) if (lower.includes(w)) score -= 0.6
  score = Math.max(-1, Math.min(1, score))

  const sentiment = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral'
  const isCrisis  = CRISIS_KW.some(k => lower.includes(k))
  const isOpp     = OPP_KW.some(k => lower.includes(k)) && score < 0
  const urgency: 'high' | 'medium' | 'low' = isCrisis || score < -0.5 ? 'high' : isOpp || score < -0.2 ? 'medium' : 'low'
  const oppRisk   = Math.round(Math.min(100, OPP_KW.filter(k => lower.includes(k)).length * 20 + (score < 0 ? Math.abs(score) * 40 : 0)))
  const geoTags   = GEO_TERMS.filter(g => lower.includes(g.toLowerCase()))
  const topics: string[] = []
  if (isCrisis) topics.push('Crisis')
  if (score > 0.3) topics.push('Achievement')
  if (lower.includes('scheme')) topics.push('Scheme')
  if (lower.includes('election')) topics.push('Election')
  if (isOpp) topics.push('Opposition Attack')

  return { sentiment, score, urgency, topics, geoTags, entities: [], summary: text.substring(0, 120), oppRisk }
}

async function scoreBatchClaude(texts: string[]): Promise<SentimentResult[]> {
  if (!ANTHROPIC_KEY || !texts.length) return texts.map(keywordScore)

  try {
    const prompt = `You are an Indian political intelligence analyst. Analyze the following ${texts.length} social media / news items and return a JSON array. Each item in the array must match exactly:
{
  "index": <0-based integer>,
  "sentiment": "positive" | "negative" | "neutral",
  "score": <float -1.0 to 1.0>,
  "urgency": "high" | "medium" | "low",
  "topics": [<string>, ...],
  "geoTags": [<Indian state/city names mentioned>, ...],
  "entities": [<named people/organisations>, ...],
  "summary": "<one sentence summary in English, max 100 chars>",
  "oppRisk": <0-100, likelihood this is an opposition political attack>
}

Items to analyse:
${texts.map((t, i) => `[${i}] ${t.substring(0, 300)}`).join('\n')}

Return ONLY the JSON array, no markdown.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: timeout(25000),
    })

    if (!res.ok) throw new Error(`Claude API ${res.status}`)
    const data = await res.json()
    const raw = data.content?.[0]?.text ?? ''

    // Extract JSON array from response
    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array in response')
    const parsed: any[] = JSON.parse(jsonMatch[0])

    return texts.map((t, i) => {
      const item = parsed.find((p: any) => p.index === i)
      if (!item) return keywordScore(t)
      return {
        sentiment: item.sentiment ?? 'neutral',
        score:     item.score     ?? 0,
        urgency:   item.urgency   ?? 'low',
        topics:    item.topics    ?? [],
        geoTags:   item.geoTags   ?? [],
        entities:  item.entities  ?? [],
        summary:   item.summary   ?? '',
        oppRisk:   item.oppRisk   ?? 0,
      }
    })
  } catch {
    return texts.map(keywordScore)
  }
}

// ─── Build FeedItem rows for Supabase ────────────────────────────────────────

function buildFeedRow(
  raw:       RawItem,
  sentiment: SentimentResult,
  accountId: string,
): Record<string, unknown> {
  const bucket =
    sentiment.urgency === 'high'         ? 'red' :
    sentiment.sentiment === 'positive'   ? 'blue' :
    sentiment.urgency === 'medium'       ? 'yellow' : 'silver'

  const reach = (raw.views ?? 0) + (raw.likes ?? 0) * 10 + (raw.shares ?? 0) * 50

  return {
    id:           raw.id,
    account_id:   accountId,
    platform:     raw.platform,
    bucket,
    sentiment:    sentiment.sentiment,
    tone:         Math.round(sentiment.score * 5),
    headline:     raw.text.substring(0, 220),
    body:         raw.text,
    source:       raw.source,
    url:          raw.url,
    geo_tags:     sentiment.geoTags,
    topic_tags:   sentiment.topics,
    language:     /[\u0900-\u097F]/.test(raw.text) ? 'hindi' : 'english',
    views:        reach,
    shares:       raw.shares  ?? 0,
    engagement:   (raw.likes ?? 0) + (raw.shares ?? 0) + (raw.replies ?? 0),
    is_trending:  (raw.likes ?? 0) > 500 || (raw.shares ?? 0) > 200,
    thumbnail:    raw.thumbnail ?? null,
    published_at: raw.published_at,
    fetched_at:   new Date().toISOString(),
    keyword:      raw.keyword,
    ai_summary:   sentiment.summary,
    opp_risk:     sentiment.oppRisk,
    entities:     sentiment.entities,
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  try {
    const body: IngestRequest = await req.json()
    const { accountId, politicianName, keywords, handles = [], maxPerSource = 25 } = body

    if (!accountId || !keywords?.length) {
      return new Response(JSON.stringify({ error: 'accountId and keywords required' }), {
        status: 400, headers: corsHeaders,
      })
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_KEY)

    console.log(`[bm-ingest-v2] account=${accountId} keywords=${keywords.join(',')} handles=${handles.join(',')}`)

    // ── Parallel fetch from all sources ──────────────────────────────────────
    const allKeywords = [politicianName, ...keywords].filter(Boolean)

    const [twitter, instagram, youtube, reddit, news] = await Promise.allSettled([
      ingestTwitter(allKeywords, handles, maxPerSource),
      ingestInstagram(allKeywords, maxPerSource),
      ingestYouTube(allKeywords, maxPerSource),
      ingestReddit(allKeywords, maxPerSource),
      ingestNews(allKeywords, maxPerSource),
    ])

    const rawItems: RawItem[] = dedupe([
      ...(twitter.status   === 'fulfilled' ? twitter.value   : []),
      ...(instagram.status === 'fulfilled' ? instagram.value : []),
      ...(youtube.status   === 'fulfilled' ? youtube.value   : []),
      ...(reddit.status    === 'fulfilled' ? reddit.value    : []),
      ...(news.status      === 'fulfilled' ? news.value      : []),
    ])

    console.log(`[bm-ingest-v2] fetched ${rawItems.length} raw items`)

    if (!rawItems.length) {
      return new Response(JSON.stringify({ ok: true, inserted: 0, sources: {} }), {
        headers: corsHeaders,
      })
    }

    // ── AI Sentiment in batches of 20 ────────────────────────────────────────
    const BATCH = 20
    const sentiments: SentimentResult[] = []

    for (let i = 0; i < rawItems.length; i += BATCH) {
      const batch = rawItems.slice(i, i + BATCH)
      const scores = await scoreBatchClaude(batch.map(r => r.text))
      sentiments.push(...scores)
    }

    // ── Build rows & upsert ──────────────────────────────────────────────────
    const rows = rawItems.map((raw, i) => buildFeedRow(raw, sentiments[i], accountId))

    // Try both table names (bm_feed is primary, feed_items is legacy)
    const { error: err1 } = await supabase
      .from('bm_feed')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })

    if (err1) console.warn('[bm-ingest-v2] bm_feed upsert warn:', err1.message)

    // Also upsert to feed_items for backwards compatibility
    await supabase
      .from('feed_items')
      .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      .then(({ error }) => {
        if (error) console.warn('[bm-ingest-v2] feed_items upsert warn:', error.message)
      })

    // ── Per-source counts ────────────────────────────────────────────────────
    const sources = rawItems.reduce((acc, r) => {
      acc[r.platform] = (acc[r.platform] ?? 0) + 1
      return acc
    }, {} as Record<string, number>)

    // ── Crisis alert: if any red bucket items, log separately ────────────────
    const crisisRows = rows.filter(r => r.bucket === 'red')
    if (crisisRows.length > 0) {
      await supabase.from('crisis_alerts').upsert(
        crisisRows.map(r => ({
          id:         r.id,
          account_id: r.account_id,
          headline:   r.headline,
          source:     r.source,
          url:        r.url,
          opp_risk:   r.opp_risk,
          detected_at: r.fetched_at,
        })),
        { onConflict: 'id', ignoreDuplicates: true }
      ).then(() => {})
    }

    const response = {
      ok:       true,
      inserted: rows.length,
      crisis:   crisisRows.length,
      sources,
    }

    console.log(`[bm-ingest-v2] done — inserted=${rows.length} crisis=${crisisRows.length}`, sources)
    return new Response(JSON.stringify(response), { headers: corsHeaders })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[bm-ingest-v2] fatal:', msg)
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: corsHeaders,
    })
  }
})
