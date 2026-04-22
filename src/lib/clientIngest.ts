// ============================================================
// BharatMonitor — Client-Side Ingestion Pipeline v2
//
// Sources (all CORS-safe from browser):
//   1. Google News RSS (EN + HI) via rotating CORS proxies
//   2. YouTube Data API v3 (CORS supported natively)
//   3. Reddit public JSON API (with proxy fallback)
//   4. Google CSE general news
//   5. Meta Ads Library API
//
// Results are upserted into Supabase bm_feed so all hooks pick them up.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase'
import type { FeedItem } from '@/types'

// ─── CORS proxy pool — tried in order, first success wins ────────────────────
const CORS_PROXIES = [
  'https://api.allorigins.win/raw?url=',
  'https://corsproxy.io/?url=',
  'https://api.codetabs.com/v1/proxy?quest=',
  'https://thingproxy.freeboard.io/fetch/',
]

async function fetchViaCorsProxy(url: string, timeoutMs = 10000): Promise<string | null> {
  for (const proxy of CORS_PROXIES) {
    try {
      const res = await fetch(`${proxy}${encodeURIComponent(url)}`, {
        signal: AbortSignal.timeout(timeoutMs),
        headers: { 'Accept': 'text/html,application/xml,text/xml,*/*' },
      })
      if (!res.ok) continue
      const text = await res.text()
      if (text && text.length > 50) return text
    } catch { continue }
  }
  return null
}

async function fetchJsonViaCorsProxy(url: string, timeoutMs = 10000): Promise<any | null> {
  const text = await fetchViaCorsProxy(url, timeoutMs)
  if (!text) return null
  try { return JSON.parse(text) } catch { return null }
}

// ─── Keyword scorer ──────────────────────────────────────────────────────────

const POS_KW    = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','historic','praised','commended','progress','victory','wins','elected','announced']
const NEG_KW    = ['scam','scandal','corruption','fraud','arrest','protest','riot','attack','exposed','resign','fake','crisis','blast','terror','controversy','accused','violence','clash','unrest','failed']
const CRISIS_KW = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','fire','emergency','attack','stampede','explosion']
const OPP_KW   = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition','indi alliance','jumla']
const GEO_TERMS = ['Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','Ahmedabad','Pune','Jaipur','Lucknow','Patna','Bhopal','Varanasi','UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','India','Tamil Nadu','Kerala','West Bengal','Assam','Odisha','Punjab','Haryana','Jharkhand','Uttarakhand','Goa','Andhra Pradesh','Telangana','Chhattisgarh','Madhya Pradesh']

function scoreText(text: string) {
  const lower = text.toLowerCase()
  let score = 0
  for (const w of POS_KW)    if (lower.includes(w)) score += 0.3
  for (const w of NEG_KW)    if (lower.includes(w)) score -= 0.3
  for (const w of CRISIS_KW) if (lower.includes(w)) score -= 0.6
  score = Math.max(-1, Math.min(1, score))
  const isCrisis = CRISIS_KW.some(k => lower.includes(k))
  const isOpp    = OPP_KW.some(k => lower.includes(k)) && score < 0
  const sentiment: FeedItem['sentiment'] = score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral'
  const bucket: FeedItem['bucket'] =
    isCrisis || score < -0.5 ? 'red'    :
    isOpp    || score < -0.2 ? 'yellow' :
    score > 0.15             ? 'blue'   : 'silver'
  return {
    sentiment, bucket,
    tone:     Math.round(score * 5),
    geoTags:  GEO_TERMS.filter(g => lower.includes(g.toLowerCase())),
    topics:   [
      ...(isCrisis                     ? ['Crisis']            : []),
      ...(score > 0.3                  ? ['Achievement']       : []),
      ...(lower.includes('scheme')     ? ['Scheme']            : []),
      ...(lower.includes('election')   ? ['Election']          : []),
      ...(isOpp                        ? ['Opposition Attack'] : []),
      ...(lower.includes('parliament') ? ['Parliament']        : []),
      ...(lower.includes('budget')     ? ['Economy']           : []),
      ...(lower.includes('modi')       ? ['PM Modi']           : []),
      ...(lower.includes('bjp')        ? ['BJP']               : []),
      ...(lower.includes('congress')   ? ['INC']               : []),
    ],
  }
}

function makeFeedItem(p: {
  id: string; platform: string; headline: string; body?: string
  source: string; url: string; published_at: string; keyword: string
  views?: number; shares?: number; engagement?: number
}): FeedItem {
  const scored = scoreText(`${p.headline} ${p.body || ''}`)
  const now = new Date().toISOString()
  return {
    id: p.id, account_id: '',
    platform: p.platform as any,
    bucket: scored.bucket, sentiment: scored.sentiment, tone: scored.tone,
    headline: p.headline.substring(0, 220),
    body: p.body || p.headline,
    source: p.source, url: p.url,
    geo_tags: scored.geoTags, topic_tags: scored.topics,
    language: /[\u0900-\u097F]/.test(p.headline) ? 'hindi' : 'english',
    views: p.views ?? 0, shares: p.shares ?? 0, engagement: p.engagement ?? 0,
    is_trending: (p.views ?? 0) > 1000,
    published_at: p.published_at || now, fetched_at: now,
    keyword: p.keyword, contradiction: undefined,
  }
}

// ─── 1. Google News RSS ───────────────────────────────────────────────────────

function parseRSSXml(xml: string) {
  const items: { title: string; link: string; pubDate: string; source: string }[] = []
  const rx = /<item>([\s\S]*?)<\/item>/g
  let m: RegExpExecArray | null
  while ((m = rx.exec(xml)) !== null) {
    const block = m[1]
    const get = (tag: string) => {
      const r = new RegExp(`<${tag}[^>]*><!\\[CDATA\\[([\\s\\S]*?)\\]\\]><\\/${tag}>|<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`)
      const match = r.exec(block)
      return (match?.[1] ?? match?.[2] ?? '').trim()
    }
    const title = get('title')
    const link  = get('link') || get('guid')
    if (title && link) items.push({ title, link, pubDate: get('pubDate'), source: get('source') || 'Google News' })
  }
  return items
}

async function fetchGoogleNewsRSS(keyword: string, lang: 'en' | 'hi' = 'en', max = 15): Promise<FeedItem[]> {
  const q    = encodeURIComponent(lang === 'hi' ? keyword : `${keyword} india`)
  const hl   = lang === 'hi' ? 'hi-IN' : 'en-IN'
  const ceid = lang === 'hi' ? 'IN:hi' : 'IN:en'
  const url  = `https://news.google.com/rss/search?q=${q}&hl=${hl}&gl=IN&ceid=${ceid}`
  const xml  = await fetchViaCorsProxy(url, 12000)
  if (!xml || !xml.includes('<item>')) return []
  return parseRSSXml(xml).slice(0, max).map(p => {
    const item = makeFeedItem({
      id: `gnews-${lang}-${btoa(p.link).substring(0, 28).replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36)}`,
      platform: 'news', headline: p.title,
      source: p.source.replace(/<[^>]+>/g, ''),
      url: p.link,
      published_at: p.pubDate ? new Date(p.pubDate).toISOString() : new Date().toISOString(),
      keyword,
    })
    if (lang === 'hi') item.language = 'hindi'
    return item
  })
}

// ─── 2. YouTube Data API v3 ──────────────────────────────────────────────────

const YT_KEY = import.meta.env.VITE_YOUTUBE_KEY || ''

async function fetchYouTube(keyword: string, max = 10): Promise<FeedItem[]> {
  if (!YT_KEY) return []
  try {
    const q   = encodeURIComponent(keyword)
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${q}+india&type=video&relevanceLanguage=hi&regionCode=IN&order=date&maxResults=${max}&key=${YT_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) { console.warn('[YT]', res.status, await res.text().catch(()=>'')); return [] }
    const data = await res.json()
    return (data?.items ?? []).filter((i: any) => i.id?.videoId).map((i: any) => {
      const s = i.snippet
      return makeFeedItem({
        id: `yt-${i.id.videoId}`,
        platform: 'youtube', headline: s.title,
        body: s.description?.substring(0, 500) || '',
        source: s.channelTitle || 'YouTube',
        url: `https://youtube.com/watch?v=${i.id.videoId}`,
        published_at: s.publishedAt, keyword,
      })
    })
  } catch (e) { console.warn('[YT] error:', e); return [] }
}

// ─── 3. Reddit ───────────────────────────────────────────────────────────────

async function fetchReddit(keyword: string, max = 10): Promise<FeedItem[]> {
  const subs = ['india', 'IndianPolitics', 'IndiaSpeaks']
  const items: FeedItem[] = []
  for (const sub of subs) {
    const q   = encodeURIComponent(keyword)
    const url = `https://www.reddit.com/r/${sub}/search.json?q=${q}&sort=new&restrict_sr=on&limit=${Math.ceil(max / subs.length)}&raw_json=1`
    let data: any = null
    try {
      const res = await fetch(url, { headers: { 'User-Agent': 'BharatMonitor/2.0' }, signal: AbortSignal.timeout(8000) })
      if (res.ok) data = await res.json()
    } catch { data = await fetchJsonViaCorsProxy(url, 10000) }
    if (!data?.data?.children) continue
    for (const child of data.data.children) {
      const p = child.data
      if (!p?.id) continue
      items.push(makeFeedItem({
        id: `reddit-${p.id}`, platform: 'reddit',
        headline: p.title, body: p.selftext?.substring(0, 500) ?? '',
        source: `r/${p.subreddit}`,
        url: `https://reddit.com${p.permalink}`,
        published_at: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : new Date().toISOString(),
        keyword, engagement: (p.score ?? 0) + (p.num_comments ?? 0),
      }))
    }
  }
  return items
}

// ─── 4. Google CSE general news ──────────────────────────────────────────────

const CSE_KEY = import.meta.env.VITE_GOOGLE_CSE_KEY || ''
const CSE_CX  = import.meta.env.VITE_GOOGLE_CSE_CX  || ''

async function fetchGoogleCSENews(keyword: string, max = 10): Promise<FeedItem[]> {
  if (!CSE_KEY || !CSE_CX) return []
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', CSE_KEY)
    url.searchParams.set('cx',  CSE_CX)
    url.searchParams.set('q',   `${keyword} india news`)
    url.searchParams.set('num', String(Math.min(max, 10)))
    url.searchParams.set('dateRestrict', 'w')
    url.searchParams.set('gl',  'in')
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data?.items ?? [])
      .filter((r: any) => !r.link?.includes('x.com/') && !r.link?.includes('twitter.com/'))
      .map((r: any) => makeFeedItem({
        id: `cse-${btoa(r.link).substring(0, 28).replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36)}`,
        platform: 'news', headline: r.title, body: r.snippet || '',
        source: r.displayLink || 'Web', url: r.link,
        published_at: new Date().toISOString(), keyword,
      }))
  } catch (e) { console.warn('[CSE] error:', e); return [] }
}

// ─── Main exports ─────────────────────────────────────────────────────────────

export interface IngestResult {
  total: number; saved: number
  sources: Record<string, number>; errors: string[]
}

export async function clientSideIngest(
  accountId: string, keywords: string[],
  options?: { maxPerSource?: number; skipSave?: boolean }
): Promise<IngestResult> {
  const maxPer = options?.maxPerSource ?? 12
  const allItems: FeedItem[] = []
  const errors: string[] = []
  const sources: Record<string, number> = {}

  const tasks: Promise<{ source: string; items: FeedItem[] }>[] = []

  for (const kw of keywords.slice(0, 6)) {
    tasks.push(fetchGoogleNewsRSS(kw, 'en', maxPer).then(i => ({ source: 'gnews-en', items: i })).catch(e => { errors.push(`GNews EN [${kw}]: ${e}`); return { source: 'gnews-en', items: [] } }))
    tasks.push(fetchGoogleNewsRSS(kw, 'hi', Math.ceil(maxPer / 2)).then(i => ({ source: 'gnews-hi', items: i })).catch(e => { errors.push(`GNews HI [${kw}]: ${e}`); return { source: 'gnews-hi', items: [] } }))
    tasks.push(fetchYouTube(kw, Math.ceil(maxPer / 2)).then(i => ({ source: 'youtube', items: i })).catch(e => { errors.push(`YT [${kw}]: ${e}`); return { source: 'youtube', items: [] } }))
    tasks.push(fetchReddit(kw, Math.ceil(maxPer / 2)).then(i => ({ source: 'reddit', items: i })).catch(e => { errors.push(`Reddit [${kw}]: ${e}`); return { source: 'reddit', items: [] } }))
  }
  for (const kw of keywords.slice(0, 3)) {
    tasks.push(fetchGoogleCSENews(kw, Math.ceil(maxPer / 2)).then(i => ({ source: 'cse', items: i })).catch(() => ({ source: 'cse', items: [] })))
  }

  const results = await Promise.allSettled(tasks)
  for (const r of results) {
    if (r.status !== 'fulfilled') continue
    sources[r.value.source] = (sources[r.value.source] ?? 0) + r.value.items.length
    allItems.push(...r.value.items.map(i => ({ ...i, account_id: accountId })))
  }

  const seen = new Set<string>()
  const deduped = allItems.filter(i => { const k = i.url || i.id; if (seen.has(k)) return false; seen.add(k); return true })
  console.log(`[clientIngest] ${deduped.length} items from sources:`, sources)

  let saved = 0
  if (!options?.skipSave && deduped.length > 0) {
    try {
      const rows = deduped.map(item => ({
        id: item.id, account_id: item.account_id,
        platform: item.platform, bucket: item.bucket,
        sentiment: item.sentiment, tone: item.tone,
        headline: item.headline, title: item.headline,
        body: item.body || item.headline,
        source: item.source, source_name: item.source, source_type: item.platform,
        url: item.url, geo_tags: item.geo_tags, topic_tags: item.topic_tags,
        language: item.language, views: item.views ?? 0, shares: item.shares ?? 0,
        engagement: item.engagement ?? 0, is_trending: item.is_trending ?? false,
        published_at: item.published_at, fetched_at: item.fetched_at,
        keyword: item.keyword,
      }))
      const { error } = await supabaseAdmin.from('bm_feed').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      if (error) {
        console.warn('[clientIngest] bm_feed error:', error.message)
        const { error: e2 } = await supabaseAdmin.from('feed_items').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
        if (!e2) saved = rows.length
      } else { saved = rows.length }
      console.log(`[clientIngest] Saved ${saved} items`)
    } catch (e: any) { errors.push(`Save: ${e.message}`) }
  }

  return { total: deduped.length, saved, sources, errors }
}

export async function clientFetchNews(
  accountId: string, keywords: string[], maxPerKeyword = 12,
): Promise<FeedItem[]> {
  const tasks: Promise<FeedItem[]>[] = []
  for (const kw of keywords.slice(0, 5)) {
    tasks.push(fetchGoogleNewsRSS(kw, 'en', maxPerKeyword).catch(() => []))
    tasks.push(fetchGoogleNewsRSS(kw, 'hi', Math.ceil(maxPerKeyword / 3)).catch(() => []))
    tasks.push(fetchYouTube(kw, Math.ceil(maxPerKeyword / 3)).catch(() => []))
    tasks.push(fetchReddit(kw, Math.ceil(maxPerKeyword / 3)).catch(() => []))
  }
  const results = await Promise.allSettled(tasks)
  const all: FeedItem[] = []
  for (const r of results) if (r.status === 'fulfilled') all.push(...r.value)
  const seen = new Set<string>()
  return all
    .map(i => ({ ...i, account_id: accountId }))
    .filter(i => { const k = i.url || i.id; if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
}
