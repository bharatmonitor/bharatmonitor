// ============================================================
// BharatMonitor — Unified Ingest Edge Function v3
// Runtime: Deno (Supabase Edge Functions)
//
// Sources:
//   1. XPOZ API     — Twitter/X (replaces dead Nitter)
//   2. YouTube      — Data API v3
//   3. Reddit       — public JSON API
//   4. Google News  — RSS (server-side, no CORS)
//   5. NewsData.io  — optional paid news API
//   6. Instagram    — Graph API (optional)
//
// Env vars (set in Supabase Vault):
//   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY  — auto-injected
//   ANTHROPIC_API_KEY   — Claude sentiment scoring
//   XPOZ_API_KEY        — Twitter/X via XPOZ
//   YT_API_KEY          — YouTube Data API v3
//   META_ACCESS_TOKEN   — Instagram (optional)
//   NEWSDATA_API_KEY    — NewsData.io (optional)
// ============================================================

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL')!
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''
const XPOZ_KEY      = Deno.env.get('XPOZ_API_KEY') ?? ''
const YT_KEY        = Deno.env.get('YT_API_KEY') ?? ''
const META_TOKEN    = Deno.env.get('META_ACCESS_TOKEN') ?? ''
const META_USER_ID  = Deno.env.get('META_USER_ID') ?? ''
const NEWSDATA_KEY  = Deno.env.get('NEWSDATA_API_KEY') ?? ''
const GRAPH_BASE    = 'https://graph.facebook.com/v21.0'

// ─── Types ────────────────────────────────────────────────────────────────────

interface IngestRequest {
  accountId:      string
  politicianName: string
  keywords:       string[]
  handles?:       string[]
  maxPerSource?:  number
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
  score:      number
  urgency:    'high' | 'medium' | 'low'
  topics:     string[]
  geoTags:    string[]
  entities:   string[]
  summary:    string
  oppRisk:    number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function t(ms: number) { return AbortSignal.timeout(ms) }

function dedupe<T extends { id: string }>(items: T[]): T[] {
  const seen = new Set<string>()
  return items.filter(i => { if (seen.has(i.id)) return false; seen.add(i.id); return true })
}

async function safeJson(res: Response): Promise<any> {
  try { return await res.json() } catch { return null }
}

// ─── 1. XPOZ — Twitter/X (replaces Nitter) ───────────────────────────────────

async function xpozSearchPosts(query: string, keyword: string, max: number): Promise<RawItem[]> {
  if (!XPOZ_KEY) return []
  const XPOZ_URL = 'https://mcp.xpoz.ai/mcp'
  try {
    // Initialize MCP session
    await fetch(XPOZ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XPOZ_KEY}` },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'initialize', params: { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'bharatmonitor', version: '3.0' } } }),
      signal: t(10000),
    })

    // Search posts
    const res = await fetch(XPOZ_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${XPOZ_KEY}` },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2, method: 'tools/call',
        params: {
          name: 'twitter_searchPosts',
          arguments: {
            query,
            startDate: new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10),
            language: 'en',
            fields: ['id', 'text', 'authorUsername', 'likeCount', 'retweetCount', 'replyCount', 'impressionCount', 'createdAt', 'lang'],
          },
        },
      }),
      signal: t(25000),
    })

    if (!res.ok) return []
    const data = await safeJson(res)
    const text = data?.result?.content?.[0]?.text ?? ''
    if (!text) return []
    const parsed = JSON.parse(text)
    const rows = parsed?.data ?? parsed ?? []
    if (!Array.isArray(rows)) return []

    return rows.slice(0, max).map((p: any): RawItem => ({
      id:           `xpoz-${p.id ?? Date.now()}`,
      platform:     'twitter',
      source:       p.authorUsername ? `@${p.authorUsername}` : '@X',
      text:         p.text ?? '',
      url:          p.authorUsername && p.id ? `https://x.com/${p.authorUsername}/status/${p.id}` : '',
      published_at: p.createdAt ?? new Date().toISOString(),
      likes:        p.likeCount    ?? 0,
      shares:       p.retweetCount ?? 0,
      replies:      p.replyCount   ?? 0,
      views:        p.impressionCount ?? 0,
      keyword,
    }))
  } catch (e) {
    console.warn('[XPOZ] error:', e)
    return []
  }
}

async function ingestTwitter(keywords: string[], _handles: string[], max: number): Promise<RawItem[]> {
  if (!XPOZ_KEY) {
    console.log('[Twitter] XPOZ_API_KEY not set — skipping Twitter')
    return []
  }
  const all: RawItem[] = []
  for (const kw of keywords.slice(0, 5)) {
    const q = `${kw} india -filter:retweets`
    const items = await xpozSearchPosts(q, kw, max)
    all.push(...items)
    if (keywords.indexOf(kw) < keywords.length - 1) {
      await new Promise(r => setTimeout(r, 400))
    }
  }
  console.log(`[Twitter] XPOZ returned ${all.length} items`)
  return all
}

// ─── 2. YouTube Data API v3 ───────────────────────────────────────────────────

async function ingestYouTube(keywords: string[], max: number): Promise<RawItem[]> {
  if (!YT_KEY) return []
  const items: RawItem[] = []
  for (const kw of keywords.slice(0, 4)) {
    try {
      const q   = encodeURIComponent(`${kw} india`)
      const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}&type=video&relevanceLanguage=hi&regionCode=IN&order=date&maxResults=${Math.min(max, 15)}&key=${YT_KEY}`
      const res = await fetch(url, { signal: t(12000) })
      if (!res.ok) { console.warn('[YT] error', res.status); continue }
      const data = await safeJson(res)
      for (const v of (data?.items ?? [])) {
        if (!v.id?.videoId) continue
        const s = v.snippet
        items.push({
          id: `yt-${v.id.videoId}`, platform: 'youtube',
          source: s.channelTitle || 'YouTube',
          text: `${s.title}\n${s.description?.substring(0, 300) || ''}`,
          url: `https://youtube.com/watch?v=${v.id.videoId}`,
          published_at: s.publishedAt || new Date().toISOString(),
          thumbnail: s.thumbnails?.medium?.url, keyword: kw,
        })
      }
    } catch (e) { console.warn('[YT] keyword error:', e) }
  }
  console.log(`[YouTube] ${items.length} items`)
  return items
}

// ─── 3. Reddit ────────────────────────────────────────────────────────────────

async function ingestReddit(keywords: string[], max: number): Promise<RawItem[]> {
  const subs  = ['india', 'IndianPolitics', 'IndiaSpeaks']
  const items: RawItem[] = []
  for (const kw of keywords.slice(0, 4)) {
    for (const sub of subs) {
      try {
        const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(kw)}&sort=new&restrict_sr=on&limit=${Math.ceil(max / subs.length)}&raw_json=1`
        const res = await fetch(url, { headers: { 'User-Agent': 'BharatMonitor/3.0 political-intelligence' }, signal: t(10000) })
        if (!res.ok) continue
        const data = await safeJson(res)
        for (const c of (data?.data?.children ?? [])) {
          const p = c.data
          if (!p?.id || !p.title) continue
          items.push({
            id: `reddit-${p.id}`, platform: 'reddit',
            source: `r/${p.subreddit}`,
            text: `${p.title}\n${p.selftext?.substring(0, 400) ?? ''}`,
            url: `https://reddit.com${p.permalink}`,
            published_at: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : new Date().toISOString(),
            likes: p.score ?? 0, replies: p.num_comments ?? 0, keyword: kw,
          })
        }
      } catch { continue }
    }
  }
  console.log(`[Reddit] ${items.length} items`)
  return items
}

// ─── 4. Google News RSS ───────────────────────────────────────────────────────

function parseNewsRSS(xml: string): { title: string; link: string; pubDate: string; source: string }[] {
  const items: { title: string; link: string; pubDate: string; source: string }[] = []
  const rx = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(xml)) !== null) {
    const b   = m[1]
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([^<]*)<\\/${tag}>`)
      const x = r.exec(b)
      return (x?.[1] ?? x?.[2] ?? '').trim()
    }
    const title = get('title')
    const link  = get('link') || get('guid')
    if (title && link) items.push({ title, link, pubDate: get('pubDate'), source: get('source') || 'Google News' })
  }
  return items
}

async function ingestNews(keywords: string[], max: number): Promise<RawItem[]> {
  const items: RawItem[] = []
  for (const kw of keywords.slice(0, 5)) {
    try {
      const q   = encodeURIComponent(`${kw} india`)
      const url = `https://news.google.com/rss/search?q=${q}&hl=en-IN&gl=IN&ceid=IN:en`
      const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0 BharatMonitor/3.0' }, signal: t(10000) })
      if (!res.ok) continue
      const xml = await res.text()
      for (const p of parseNewsRSS(xml).slice(0, max)) {
        items.push({
          id: `news-${encodeURIComponent(p.link).substring(0, 36)}-${Date.now().toString(36)}`,
          platform: 'news', source: p.source.replace(/<[^>]+>/g, ''),
          text: p.title, url: p.link,
          published_at: p.pubDate ? new Date(p.pubDate).toISOString() : new Date().toISOString(),
          keyword: kw,
        })
      }
    } catch { continue }

    // NewsData.io bonus if key available
    if (NEWSDATA_KEY) {
      try {
        const url = `https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=${encodeURIComponent(kw)}&country=in&language=en,hi&category=politics`
        const res = await fetch(url, { signal: t(10000) })
        if (!res.ok) continue
        const data = await safeJson(res)
        for (const a of (data?.results ?? []).slice(0, max)) {
          items.push({
            id: `newsdata-${a.article_id}`, platform: 'news',
            source: a.source_id || 'NewsData',
            text: `${a.title}\n${a.description || ''}`,
            url: a.link, published_at: a.pubDate || new Date().toISOString(),
            thumbnail: a.image_url, keyword: kw,
          })
        }
      } catch { continue }
    }
  }
  console.log(`[News] ${items.length} items`)
  return items
}

// ─── 5. Instagram (optional) ─────────────────────────────────────────────────

async function ingestInstagram(keywords: string[], max: number): Promise<RawItem[]> {
  if (!META_TOKEN || !META_USER_ID) return []
  const items: RawItem[] = []
  for (const kw of keywords.slice(0, 2)) {
    try {
      const tagUrl = `${GRAPH_BASE}/ig_hashtag_search?user_id=${META_USER_ID}&q=${encodeURIComponent(kw.replace(/\s+/g, ''))}&access_token=${META_TOKEN}`
      const tagRes = await fetch(tagUrl, { signal: t(8000) })
      if (!tagRes.ok) continue
      const tagData = await safeJson(tagRes)
      const tagId = tagData?.data?.[0]?.id
      if (!tagId) continue
      const mediaUrl = `${GRAPH_BASE}/${tagId}/recent_media?user_id=${META_USER_ID}&fields=id,caption,permalink,timestamp,like_count,comments_count&limit=${max}&access_token=${META_TOKEN}`
      const mediaRes = await fetch(mediaUrl, { signal: t(10000) })
      if (!mediaRes.ok) continue
      const mediaData = await safeJson(mediaRes)
      for (const m of (mediaData?.data ?? [])) {
        items.push({
          id: `ig-${m.id}`, platform: 'instagram', source: `#${kw}`,
          text: m.caption?.substring(0, 500) || `#${kw} post`,
          url: m.permalink || '', published_at: m.timestamp || new Date().toISOString(),
          likes: m.like_count ?? 0, replies: m.comments_count ?? 0, keyword: kw,
        })
      }
    } catch { continue }
  }
  return items
}

// ─── Sentiment scoring ────────────────────────────────────────────────────────

const GEO_TERMS = ['Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','Ahmedabad','Pune','Jaipur','Lucknow','Patna','Bhopal','Varanasi','UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','Tamil Nadu','Telangana','Andhra','Kerala','West Bengal','Odisha','Assam','Punjab','India','Bharat']
const NEG_KW  = ['scam','scandal','corruption','fraud','arrest','protest','riot','attack','exposed','resign','fake','crisis','blast','terror','dead','killed']
const POS_KW  = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','historic','breakthrough','praised','commended']
const CRIS_KW = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','rape','fire','emergency']
const OPP_KW  = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition','indi alliance']

function kwScore(text: string): SentimentResult {
  const t2 = text.toLowerCase()
  let score = 0
  for (const w of POS_KW)  if (t2.includes(w)) score += 0.3
  for (const w of NEG_KW)  if (t2.includes(w)) score -= 0.3
  for (const w of CRIS_KW) if (t2.includes(w)) score -= 0.6
  score = Math.max(-1, Math.min(1, score))
  const isCrisis = CRIS_KW.some(k => t2.includes(k))
  const isOpp    = OPP_KW.some(k => t2.includes(k)) && score < 0
  return {
    sentiment: score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral',
    score, urgency: isCrisis || score < -0.5 ? 'high' : isOpp || score < -0.2 ? 'medium' : 'low',
    oppRisk: Math.round(Math.min(100, OPP_KW.filter(k => t2.includes(k)).length * 20 + (score < 0 ? Math.abs(score) * 40 : 0))),
    topics: [...(isCrisis?['Crisis']:[]), ...(score>0.3?['Achievement']:[]), ...(t2.includes('scheme')?['Scheme']:[]), ...(t2.includes('election')?['Election']:[]), ...(isOpp?['Opposition Attack']:[])],
    geoTags: GEO_TERMS.filter(g => t2.includes(g.toLowerCase())),
    entities: [], summary: text.substring(0, 100),
  }
}

async function scoreBatch(texts: string[]): Promise<SentimentResult[]> {
  if (!ANTHROPIC_KEY) return texts.map(t2 => kwScore(t2))
  try {
    const prompt = `Indian political analyst. Analyse ${texts.length} items. Return JSON array, each element:
{"index":N,"sentiment":"positive"|"negative"|"neutral","score":-1to1,"urgency":"high"|"medium"|"low","topics":[],"geoTags":[],"entities":[],"summary":"<100chars","oppRisk":0-100}
Items:\n${texts.map((t2, i) => `[${i}] ${t2.substring(0, 300)}`).join('\n')}\nReturn ONLY JSON array.`
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 4096, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) throw new Error(`Anthropic ${res.status}`)
    const data = await res.json()
    const raw  = data.content?.[0]?.text ?? ''
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array')
    const parsed: any[] = JSON.parse(match[0])
    return texts.map((t2, i) => {
      const f = parsed.find((p: any) => p.index === i)
      return f ? { sentiment: f.sentiment ?? 'neutral', score: f.score ?? 0, urgency: f.urgency ?? 'low', topics: f.topics ?? [], geoTags: f.geoTags ?? [], entities: f.entities ?? [], summary: f.summary ?? '', oppRisk: f.oppRisk ?? 0 } : kwScore(t2)
    })
  } catch { return texts.map(t2 => kwScore(t2)) }
}

// ─── Build DB row ─────────────────────────────────────────────────────────────

function buildRow(raw: RawItem, sent: SentimentResult, accountId: string) {
  const bucket = sent.urgency === 'high' || sent.score < -0.5 ? 'red'
    : (OPP_KW.some(k => raw.text.toLowerCase().includes(k)) && sent.score < 0) || sent.score < -0.2 ? 'yellow'
    : sent.score > 0.15 ? 'blue' : 'silver'
  return {
    id: raw.id, account_id: accountId,
    platform: raw.platform, bucket,
    sentiment: sent.sentiment, tone: Math.round(sent.score * 5),
    headline: raw.text.substring(0, 220), title: raw.text.substring(0, 220),
    body: raw.text, source: raw.source, source_name: raw.source, source_type: raw.platform,
    url: raw.url, geo_tags: sent.geoTags, topic_tags: sent.topics,
    language: /[\u0900-\u097F]/.test(raw.text) ? 'hindi' : 'english',
    views: raw.views ?? 0, shares: raw.shares ?? 0,
    engagement: (raw.likes ?? 0) + (raw.replies ?? 0) + (raw.shares ?? 0),
    is_trending: (raw.views ?? 0) > 5000, keyword: raw.keyword,
    ai_summary: sent.summary, opp_risk: sent.oppRisk,
    published_at: raw.published_at, fetched_at: new Date().toISOString(),
    thumbnail: raw.thumbnail,
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body: IngestRequest = await req.json()
    const { accountId, politicianName, keywords, handles = [], maxPerSource = 20 } = body

    if (!accountId || !keywords?.length) {
      return new Response(JSON.stringify({ error: 'accountId and keywords required' }), { status: 400, headers: corsHeaders })
    }

    const supabase      = createClient(SUPABASE_URL, SUPABASE_KEY)
    const allKeywords   = [politicianName, ...keywords].filter(Boolean)
    console.log(`[bm-ingest-v2] account=${accountId} kws=${allKeywords.slice(0,3).join(',')} xpoz=${!!XPOZ_KEY} yt=${!!YT_KEY}`)

    // Fetch all sources in parallel
    const [twitter, instagram, youtube, reddit, news] = await Promise.allSettled([
      ingestTwitter(allKeywords, handles, maxPerSource),
      ingestInstagram(allKeywords, maxPerSource),
      ingestYouTube(allKeywords, maxPerSource),
      ingestReddit(allKeywords, maxPerSource),
      ingestNews(allKeywords, maxPerSource),
    ])

    const rawItems = dedupe([
      ...(twitter.status   === 'fulfilled' ? twitter.value   : []),
      ...(instagram.status === 'fulfilled' ? instagram.value : []),
      ...(youtube.status   === 'fulfilled' ? youtube.value   : []),
      ...(reddit.status    === 'fulfilled' ? reddit.value    : []),
      ...(news.status      === 'fulfilled' ? news.value      : []),
    ])

    console.log(`[bm-ingest-v2] fetched ${rawItems.length} raw items`)
    if (!rawItems.length) return new Response(JSON.stringify({ ok: true, inserted: 0, sources: {} }), { headers: corsHeaders })

    // Score sentiment in batches of 20
    const sentiments: SentimentResult[] = []
    for (let i = 0; i < rawItems.length; i += 20) {
      const batch = rawItems.slice(i, i + 20)
      sentiments.push(...await scoreBatch(batch.map(r => r.text)))
    }

    const rows = rawItems.map((raw, i) => buildRow(raw, sentiments[i], accountId))

    // Save to bm_feed (primary)
    const { error: e1 } = await supabase.from('bm_feed').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (e1) console.warn('[bm-ingest-v2] bm_feed warn:', e1.message)

    // Save to feed_items (legacy compat)
    await supabase.from('feed_items').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })

    // Crisis alerts
    const crisisRows = rows.filter(r => r.bucket === 'red')
    if (crisisRows.length > 0) {
      await supabase.from('crisis_alerts').upsert(
        crisisRows.map(r => ({ id: r.id, account_id: r.account_id, headline: r.headline, source: r.source, url: r.url, opp_risk: r.opp_risk, detected_at: r.fetched_at })),
        { onConflict: 'id', ignoreDuplicates: true }
      )
    }

    const sources = rawItems.reduce((acc, r) => { acc[r.platform] = (acc[r.platform] ?? 0) + 1; return acc }, {} as Record<string, number>)
    console.log(`[bm-ingest-v2] done inserted=${rows.length}`, sources)

    return new Response(JSON.stringify({ ok: true, inserted: rows.length, crisis: crisisRows.length, sources }), { headers: corsHeaders })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[bm-ingest-v2] fatal:', msg)
    return new Response(JSON.stringify({ ok: false, error: msg }), { status: 500, headers: corsHeaders })
  }
})
