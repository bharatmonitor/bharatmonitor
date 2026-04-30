// ============================================================
// BharatMonitor — Client-Side Data Pipeline
//
// Daily limits per account:
//   3 searches · 100 items (5 YT + 25 News + 70 Social)
//
// Sources (all CORS-safe from browser):
//   1. YouTube Data API v3 — 1 combined search per 6h
//   2. Reddit JSON API — no key needed
//   3. Google CSE — news search (100/day free)
//   4. Google CSE — X.com search (shares quota)
//
// Google News RSS is handled server-side (edge function only)
// ============================================================

import { supabaseAdmin } from '@/lib/supabase'
import { markApiExceeded, isApiExceeded, canAddItems, recordItems, recordSearch, canSearch, getRemainingItems, DAILY_LIMITS } from '@/lib/quotaManager'
import type { FeedItem } from '@/types'

const YT_KEY  = import.meta.env.VITE_YOUTUBE_KEY || ''
const CSE_KEY = import.meta.env.VITE_GOOGLE_CSE_KEY || ''
const CSE_CX  = import.meta.env.VITE_GOOGLE_CSE_CX || ''
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL || 'https://ylajerluygbeiqybkgtx.supabase.co'
const ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
const SERVICE_KEY   = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''

// ─── YouTube 6-hour cache (in-memory + localStorage) ─────────────────────────
const YT_CACHE_TTL = 6 * 60 * 60 * 1000
let ytCacheMemory: { items: FeedItem[]; ts: number; accountId: string } | null = null

function getYTCache(accountId: string): FeedItem[] | null {
  if (ytCacheMemory && ytCacheMemory.accountId === accountId && Date.now() - ytCacheMemory.ts < YT_CACHE_TTL) {
    return ytCacheMemory.items
  }
  try {
    const raw = localStorage.getItem(`bm-yt-${accountId}`)
    if (raw) {
      const p = JSON.parse(raw)
      if (Date.now() - p.ts < YT_CACHE_TTL) {
        ytCacheMemory = { ...p, accountId }
        return p.items
      }
    }
  } catch {}
  return null
}

function setYTCache(accountId: string, items: FeedItem[]) {
  ytCacheMemory = { items, ts: Date.now(), accountId }
  try { localStorage.setItem(`bm-yt-${accountId}`, JSON.stringify({ items, ts: Date.now() })) } catch {}
}

// ─── Scorer ───────────────────────────────────────────────────────────────────
const POS    = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','praised','progress','victory','wins','backs','supports','endorses','historic','landmark','delivers','completes','record','boost','surge','improvement','breakthrough','inaugurates','distributes']
const NEG    = ['scam','scandal','corruption','fraud','arrest','protest','attack','exposed','resign','fake','crisis','blast','terror','controversy','accused','violence','clash','row','opposes','criticises','rejects','slams','blasts','demands','failure','lost','backlash','outrage','ED','CBI','probe','allegation','FIR','drops','falls','decline','shutdown','bandh','hartal','strike']
const CRISIS = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','fire','emergency','explosion','stampede','massacre','disaster','deaths','fatalities','collapse']
const OPP    = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition','indi alliance','TMC','SP','BSP','priyanka','sonia','akhilesh']
const GEO    = ['Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','Ahmedabad','Pune','Jaipur','Lucknow','Patna','UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','India','Tamil Nadu','Kerala','West Bengal','Assam','Odisha','Punjab','Haryana','Varanasi','Chhattisgarh','Uttarakhand','Goa','Andhra Pradesh','Telangana']

function scoreText(text: string) {
  const t = text.toLowerCase()
  let s = 0
  for (const w of POS)    if (t.includes(w)) s += 0.3
  for (const w of NEG)    if (t.includes(w)) s -= 0.3
  for (const w of CRISIS) if (t.includes(w)) s -= 0.6
  s = Math.max(-1, Math.min(1, s))
  const isCrisis = CRISIS.some(w => t.includes(w))
  const isOpp    = OPP.some(w => t.includes(w)) && s < 0
  const isSarcasm = /\b(claims|promises|pledges|vows|surely|of course|obviously)\b/.test(t) && s < 0
  return {
    sentiment: s > 0.15 ? 'positive' as const : s < -0.15 ? 'negative' as const : 'neutral' as const,
    tone:      Math.round(s * 5),
    bucket:    (isCrisis || s < -0.5 ? 'red' : isOpp || s < -0.2 ? 'yellow' : s > 0.15 ? 'blue' : 'silver') as any,
    geoTags:   GEO.filter(g => t.includes(g.toLowerCase())),
    topicTags: [...(isCrisis?['Crisis']:[]),...(s>0.3?['Achievement']:[]),...(t.includes('election')?['Election']:[]),...(isOpp?['Opposition']:[]),...(t.includes('parliament')?['Parliament']:[]),...(isSarcasm?['Sarcasm']:[])],
  }
}

function toFeedItem(p: { id: string; platform: string; headline: string; body?: string; source: string; url: string; published_at: string; keyword: string; views?: number; engagement?: number }, accountId: string): FeedItem {
  const sc = scoreText(`${p.headline} ${p.body || ''}`)
  const now = new Date().toISOString()
  return {
    id: p.id, account_id: accountId,
    platform: p.platform as any,
    bucket: sc.bucket, sentiment: sc.sentiment, tone: sc.tone,
    headline: p.headline.substring(0, 220), body: p.body || p.headline,
    source: p.source, url: p.url,
    geo_tags: sc.geoTags, topic_tags: sc.topicTags,
    language: /[\u0900-\u097F]/.test(p.headline) ? 'hindi' : 'english',
    views: p.views ?? 0, shares: 0, engagement: p.engagement ?? 0,
    is_trending: (p.views ?? 0) > 1000,
    published_at: p.published_at || now, fetched_at: now,
    keyword: p.keyword, contradiction: undefined,
  }
}

// ─── YouTube: 1 combined search per 6h window ─────────────────────────────────
export async function fetchYouTubeCombined(keywords: string[], accountId: string): Promise<FeedItem[]> {
  if (!YT_KEY) return []
  if (isApiExceeded('youtube', accountId)) return []

  // Return cache if fresh
  const cached = getYTCache(accountId)
  if (cached) { console.log(`[YT] Cache hit: ${cached.length} items`); return cached }

  // Check daily limit
  const remaining = getRemainingItems(accountId)
  if (remaining.yt <= 0) { console.log('[YT] Daily YT limit reached'); return [] }

  try {
    const q = keywords.slice(0, 3).join(' OR ')
    const max = Math.min(DAILY_LIMITS.yt, remaining.yt)
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(q)}+india&type=video&regionCode=IN&order=date&maxResults=${max}&key=${YT_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) {
      if (res.status === 403) markApiExceeded('youtube', accountId)
      console.warn('[YT]', res.status)
      return []
    }
    const data = await res.json()
    const items = (data?.items ?? []).filter((i: any) => i.id?.videoId).map((i: any) => {
      const s = i.snippet
      const kw = keywords.find(k => s.title.toLowerCase().includes(k.toLowerCase())) || keywords[0]
      return toFeedItem({ id: `yt-${i.id.videoId}`, platform: 'youtube', headline: s.title, body: s.description?.substring(0, 300) || '', source: s.channelTitle || 'YouTube', url: `https://youtube.com/watch?v=${i.id.videoId}`, published_at: s.publishedAt, keyword: kw }, accountId)
    })
    console.log(`[YT] Fetched ${items.length} (1 API call, 100 units used)`)
    recordItems(accountId, 'yt', items.length)
    setYTCache(accountId, items)
    return items
  } catch (e: any) { console.warn('[YT] error:', e.message); return [] }
}

// ─── Reddit ────────────────────────────────────────────────────────────────────
export async function fetchReddit(keywords: string[], accountId: string): Promise<FeedItem[]> {
  const remaining = getRemainingItems(accountId)
  if (remaining.social <= 0) return []

  const items: FeedItem[] = []
  const subs = ['india', 'IndianPolitics', 'IndiaSpeaks']
  const maxPer = Math.ceil(Math.min(remaining.social, 30) / (keywords.length * subs.length))

  for (const kw of keywords.slice(0, 3)) {
    for (const sub of subs) {
      try {
        const res = await fetch(`https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(kw)}&sort=new&restrict_sr=on&limit=${maxPer}&raw_json=1`, { headers: { 'User-Agent': 'BharatMonitor/3.0' }, signal: AbortSignal.timeout(8000) })
        if (!res.ok) continue
        const data = await res.json()
        for (const c of (data?.data?.children ?? [])) {
          const p = c.data
          if (!p?.id) continue
          items.push(toFeedItem({ id: `reddit-${p.id}`, platform: 'reddit', headline: p.title, body: (p.selftext || '').substring(0, 300), source: `r/${p.subreddit}`, url: `https://reddit.com${p.permalink}`, published_at: new Date(p.created_utc * 1000).toISOString(), keyword: kw, engagement: (p.score || 0) + (p.num_comments || 0) }, accountId))
        }
      } catch { continue }
    }
  }

  recordItems(accountId, 'social', items.length)
  return items
}

// ─── Google CSE News ───────────────────────────────────────────────────────────
export async function fetchCSENews(keywords: string[], accountId: string): Promise<FeedItem[]> {
  if (!CSE_KEY || !CSE_CX) return []
  if (isApiExceeded('cse', accountId)) return []

  const remaining = getRemainingItems(accountId)
  if (remaining.news <= 0) return []

  const items: FeedItem[] = []
  const maxPer = Math.ceil(Math.min(remaining.news, 15) / keywords.length)

  for (const kw of keywords.slice(0, 3)) {
    try {
      if (!canSearch(accountId)) { console.log('[CSE] Daily search limit reached'); break }
      const url = new URL('https://www.googleapis.com/customsearch/v1')
      url.searchParams.set('key', CSE_KEY)
      url.searchParams.set('cx', CSE_CX)
      url.searchParams.set('q', `${kw} india`)
      url.searchParams.set('num', String(Math.min(maxPer, 10)))
      url.searchParams.set('dateRestrict', 'w')
      url.searchParams.set('gl', 'in')
      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
      if (!res.ok) {
        if (res.status === 403 || res.status === 429) markApiExceeded('cse', accountId)
        continue
      }
      recordSearch(accountId)
      const data = await res.json()
      for (const r of (data?.items ?? []).filter((r: any) => !r.link?.includes('x.com') && !r.link?.includes('twitter.com'))) {
        items.push(toFeedItem({ id: `cse-news-${btoa(r.link).substring(0, 20).replace(/[^a-zA-Z0-9]/g, '')}`, platform: 'news', headline: r.title, body: r.snippet || '', source: r.displayLink || 'Web', url: r.link, published_at: new Date().toISOString(), keyword: kw }, accountId))
      }
    } catch { continue }
  }

  recordItems(accountId, 'news', items.length)
  return items
}

// ─── Main export: clientFetchNews ─────────────────────────────────────────────
export async function clientFetchNews(accountId: string, keywords: string[], _maxPerKeyword = 12): Promise<FeedItem[]> {
  console.log(`[clientFetch] Starting browser fetch for ${keywords.length} keywords`)
  const [ytItems, redditItems, cseItems] = await Promise.allSettled([
    fetchYouTubeCombined(keywords, accountId),
    fetchReddit(keywords, accountId),
    fetchCSENews(keywords, accountId),
  ])

  const all: FeedItem[] = [
    ...(ytItems.status === 'fulfilled' ? ytItems.value : []),
    ...(redditItems.status === 'fulfilled' ? redditItems.value : []),
    ...(cseItems.status === 'fulfilled' ? cseItems.value : []),
  ]

  const seen = new Set<string>()
  const deduped = all.filter(i => { const k = i.url || i.id; if (seen.has(k)) return false; seen.add(k); return true })
  console.log(`[clientFetch] Got ${deduped.length} items (YT:${ytItems.status==='fulfilled'?ytItems.value.length:0} Reddit:${redditItems.status==='fulfilled'?redditItems.value.length:0} CSE:${cseItems.status==='fulfilled'?cseItems.value.length:0})`)
  return deduped.sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
}

// ─── Edge function ingest trigger ─────────────────────────────────────────────
export async function triggerEdgeIngest(
  accountId: string, politicianName: string, keywords: string[]
): Promise<{ ok: boolean; inserted: number; error?: string }> {
  if (!SUPABASE_URL) return { ok: false, inserted: 0, error: 'No Supabase URL' }
  try {
    const authKey = SERVICE_KEY || ANON_KEY
    const res = await fetch(`${SUPABASE_URL}/functions/v1/bm-ingest-v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authKey}`, 'apikey': ANON_KEY },
      body: JSON.stringify({ accountId, politicianName, keywords, maxPerSource: 20 }),
      signal: AbortSignal.timeout(45000),
    })
    if (!res.ok) {
      const txt = await res.text().catch(() => '')
      console.warn('[edgeIngest] HTTP error', res.status, txt)
      return { ok: false, inserted: 0, error: `HTTP ${res.status}: ${txt}` }
    }
    const data = await res.json()
    console.log('[edgeIngest] Success:', data)
    return { ok: true, inserted: data.inserted || 0 }
  } catch (e: any) {
    console.warn('[edgeIngest] Exception:', e.message)
    return { ok: false, inserted: 0, error: e.message }
  }
}

// ─── useClientIngest compatible export ────────────────────────────────────────
export interface IngestResult { total: number; saved: number; sources: Record<string, number>; errors: string[] }

export async function clientSideIngest(accountId: string, keywords: string[], options?: { maxPerSource?: number; skipSave?: boolean }): Promise<IngestResult> {
  const items = await clientFetchNews(accountId, keywords, options?.maxPerSource)
  if (options?.skipSave || !items.length) return { total: items.length, saved: 0, sources: {}, errors: [] }

  const rows = items.map(item => ({
    id: item.id, account_id: item.account_id, headline: item.headline, title: item.headline,
    body: item.body, source: item.source, source_name: item.source, source_type: item.platform,
    platform: item.platform, url: item.url, bucket: item.bucket, sentiment: item.sentiment,
    tone: item.tone, geo_tags: item.geo_tags, topic_tags: item.topic_tags, language: item.language,
    views: item.views, shares: item.shares, engagement: item.engagement,
    is_trending: item.is_trending, keyword: item.keyword,
    published_at: item.published_at, fetched_at: item.fetched_at, created_at: item.fetched_at,
  }))

  try {
    const { error } = await supabaseAdmin.from('bm_feed').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (error) { console.warn('[clientIngest] Save error:', error.message); return { total: items.length, saved: 0, sources: {}, errors: [error.message] } }
    console.log(`[clientIngest] Saved ${rows.length} items`)
    return { total: items.length, saved: rows.length, sources: {}, errors: [] }
  } catch (e: any) {
    return { total: items.length, saved: 0, sources: {}, errors: [e.message] }
  }
}
