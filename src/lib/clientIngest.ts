// ============================================================
// BharatMonitor — Client-Side Data Pipeline v3
//
// ARCHITECTURE (no CORS proxies needed):
//
//   PRIMARY:   bm-ingest-v2 edge function
//              → fetches Google News RSS, Nitter, YouTube, Reddit SERVER-SIDE
//              → saves to Supabase bm_feed
//              → useFeedItems() picks it up automatically
//
//   BROWSER FALLBACK (CORS-safe APIs only):
//              → YouTube Data API v3   (Google, CORS enabled)
//              → Google CSE            (Google, CORS enabled)
//              → Reddit JSON API       (works from browser)
//              → NO Google News RSS    (blocked by all proxies)
//
// Google News RSS is ONLY fetched server-side via edge function.
// ============================================================

import { supabaseAdmin } from '@/lib/supabase'
import type { FeedItem } from '@/types'

// ─── Quota guard ─────────────────────────────────────────────────────────────
// Tracks which APIs hit quota today. Resets at midnight.
// Prevents hammering APIs that already returned 403/429.

const QUOTA_KEY = 'bm-api-quota'

function getQuotaState(): Record<string, number> {
  try {
    const raw = sessionStorage.getItem(QUOTA_KEY)
    if (!raw) return {}
    const state = JSON.parse(raw)
    // Reset if stored on a different date
    const today = new Date().toDateString()
    if (state._date !== today) return {}
    return state
  } catch { return {} }
}

function markQuotaExceeded(api: string) {
  try {
    const state = getQuotaState()
    state[api] = Date.now()
    state._date = new Date().toDateString()
    sessionStorage.setItem(QUOTA_KEY, JSON.stringify(state))
    console.warn(`[Quota] ${api} marked as exceeded for today`)
  } catch {}
}

function isQuotaExceeded(api: string): boolean {
  const state = getQuotaState()
  return !!state[api]
}



// ─── Keys ─────────────────────────────────────────────────────────────────────
const YT_KEY  = import.meta.env.VITE_YOUTUBE_KEY     || ''
const CSE_KEY = import.meta.env.VITE_GOOGLE_CSE_KEY  || ''
const CSE_CX  = import.meta.env.VITE_GOOGLE_CSE_CX   || ''

// ─── Scorer ───────────────────────────────────────────────────────────────────
const POS    = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','historic','praised','progress','victory','announced','inaugurated']
const NEG    = ['scam','scandal','corruption','fraud','arrest','protest','riot','attack','exposed','resign','fake','crisis','blast','terror','controversy','accused','violence']
const CRISIS = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','fire','emergency','explosion','stampede']
const OPP    = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition','indi alliance','jumla']
const GEO    = ['Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','Ahmedabad','Pune','Jaipur','Lucknow','Patna','Bhopal','Varanasi','UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','India','Tamil Nadu','Kerala','West Bengal','Assam','Odisha','Punjab','Haryana','Andhra Pradesh','Telangana','Chhattisgarh']

function score(text: string) {
  const t = text.toLowerCase()
  let s = 0
  for (const w of POS)    if (t.includes(w)) s += 0.3
  for (const w of NEG)    if (t.includes(w)) s -= 0.3
  for (const w of CRISIS) if (t.includes(w)) s -= 0.6
  s = Math.max(-1, Math.min(1, s))
  const crisis = CRISIS.some(k => t.includes(k))
  const opp    = OPP.some(k => t.includes(k)) && s < 0
  return {
    sentiment: (s > 0.15 ? 'positive' : s < -0.15 ? 'negative' : 'neutral') as FeedItem['sentiment'],
    bucket:    (crisis || s < -0.5 ? 'red' : opp || s < -0.2 ? 'yellow' : s > 0.15 ? 'blue' : 'silver') as FeedItem['bucket'],
    tone:      Math.round(s * 5),
    geoTags:   GEO.filter(g => t.includes(g.toLowerCase())),
    topics:    [
      ...(crisis               ? ['Crisis']            : []),
      ...(s > 0.3              ? ['Achievement']       : []),
      ...(t.includes('scheme') ? ['Scheme']            : []),
      ...(t.includes('elect')  ? ['Election']          : []),
      ...(opp                  ? ['Opposition Attack'] : []),
      ...(t.includes('parlia') ? ['Parliament']        : []),
      ...(t.includes('budget') ? ['Economy']           : []),
      ...(t.includes('modi')   ? ['PM Modi']           : []),
      ...(t.includes('bjp')    ? ['BJP']               : []),
      ...(t.includes('congres')? ['INC']               : []),
    ],
  }
}

function item(p: {
  id: string; platform: string; headline: string; body?: string
  source: string; url: string; published_at: string; keyword: string
  views?: number; shares?: number; engagement?: number
}): FeedItem {
  const sc  = score(`${p.headline} ${p.body || ''}`)
  const now = new Date().toISOString()
  return {
    id: p.id, account_id: '', platform: p.platform as any,
    bucket: sc.bucket, sentiment: sc.sentiment, tone: sc.tone,
    headline: p.headline.substring(0, 220), body: p.body || p.headline,
    source: p.source, url: p.url, geo_tags: sc.geoTags, topic_tags: sc.topics,
    language: /[\u0900-\u097F]/.test(p.headline) ? 'hindi' : 'english',
    views: p.views ?? 0, shares: p.shares ?? 0, engagement: p.engagement ?? 0,
    is_trending: (p.views ?? 0) > 1000,
    published_at: p.published_at || now, fetched_at: now,
    keyword: p.keyword, contradiction: undefined,
  }
}

// ─── 1. YouTube Data API v3 — works directly from browser ────────────────────
async function fetchYouTube(kw: string, max = 15): Promise<FeedItem[]> {
  if (!YT_KEY) { console.warn('[YT] No API key'); return [] }
  try {
    const url = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(kw + ' india')}&type=video&relevanceLanguage=hi&regionCode=IN&order=date&maxResults=${max}&key=${YT_KEY}`
    const res = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!res.ok) { console.warn('[YT] Error', res.status, await res.text().catch(() => '')); return [] }
    const d = await res.json()
    return (d?.items ?? []).filter((i: any) => i.id?.videoId).map((i: any) => {
      const s = i.snippet
      return item({ id: `yt-${i.id.videoId}`, platform: 'youtube', headline: s.title, body: s.description?.substring(0, 300) || '', source: s.channelTitle || 'YouTube', url: `https://youtube.com/watch?v=${i.id.videoId}`, published_at: s.publishedAt, keyword: kw })
    })
  } catch (e) { console.warn('[YT] fetch error:', e); return [] }
}

// ─── 2. Google CSE — searches all news sites, works from browser ──────────────
async function fetchCSENews(kw: string, max = 10): Promise<FeedItem[]> {
  if (!CSE_KEY || !CSE_CX) { console.warn('[CSE] Missing key/cx'); return [] }
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', CSE_KEY)
    url.searchParams.set('cx',  CSE_CX)
    url.searchParams.set('q',   `${kw} india news`)
    url.searchParams.set('num', String(Math.min(max, 10)))
    url.searchParams.set('dateRestrict', 'w2') // last 2 weeks
    url.searchParams.set('gl',  'in')
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) })
    if (!res.ok) { console.warn('[CSE] Error', res.status); return [] }
    const d = await res.json()
    if (d?.error) { console.warn('[CSE] API error:', d.error.message); return [] }
    return (d?.items ?? [])
      .filter((r: any) => !r.link?.includes('x.com') && !r.link?.includes('twitter.com'))
      .map((r: any) => item({
        id: `cse-${btoa(r.link).substring(0, 24).replace(/[^a-zA-Z0-9]/g, '')}-${Date.now().toString(36)}`,
        platform: 'news', headline: r.title, body: r.snippet || '',
        source: r.displayLink || 'Web', url: r.link,
        published_at: new Date().toISOString(), keyword: kw,
      }))
  } catch (e) { console.warn('[CSE] error:', e); return [] }
}

// ─── 3. Reddit JSON API — works from browser (no auth) ───────────────────────
async function fetchReddit(kw: string, max = 8): Promise<FeedItem[]> {
  const subs = ['india', 'IndianPolitics', 'IndiaSpeaks']
  const results: FeedItem[] = []
  for (const sub of subs) {
    try {
      const url = `https://www.reddit.com/r/${sub}/search.json?q=${encodeURIComponent(kw)}&sort=new&restrict_sr=on&limit=${Math.ceil(max / subs.length)}&raw_json=1`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'BharatMonitor/2.0 political-intelligence-platform' },
        signal: AbortSignal.timeout(8000),
      })
      if (!res.ok) continue
      const d = await res.json()
      for (const c of (d?.data?.children ?? [])) {
        const p = c.data
        if (!p?.id || !p.title) continue
        results.push(item({
          id: `reddit-${p.id}`, platform: 'reddit',
          headline: p.title, body: p.selftext?.substring(0, 400) || '',
          source: `r/${p.subreddit}`,
          url: `https://reddit.com${p.permalink}`,
          published_at: p.created_utc ? new Date(p.created_utc * 1000).toISOString() : new Date().toISOString(),
          keyword: kw, engagement: (p.score || 0) + (p.num_comments || 0),
        }))
      }
    } catch { continue }
  }
  return results
}

// ─── 4. Google CSE → X.com (Twitter) ─────────────────────────────────────────
const GETX_KEY = import.meta.env.VITE_GOOGLE_CSE_KEY || '' // GetX uses same Google CSE key

async function fetchCSETwitter(kw: string, max = 10): Promise<FeedItem[]> {
  if (!GETX_KEY || !CSE_CX) return []
  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key',        GETX_KEY)
    url.searchParams.set('cx',         CSE_CX)
    url.searchParams.set('q',          `${kw} india`)
    url.searchParams.set('siteSearch', 'x.com')
    url.searchParams.set('num',        String(Math.min(max, 10)))
    url.searchParams.set('dateRestrict', 'w')
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) {
      if (res.status === 403) markQuotaExceeded('cse')
      return []
    }
    const d = await res.json()
    return (d?.items ?? []).map((r: any) => {
      const mHandle = /(?:x|twitter)\.com\/([^/]+)/.exec(r.link)
      const handle  = mHandle?.[1] || 'X'
      const mId     = /\/status\/(\d+)/.exec(r.link)
      const tid     = mId?.[1] || `cset-${Date.now()}`
      const text    = r.snippet?.replace(/\n/g, ' ').trim() || r.title || ''
      return item({
        id: `getx-${tid}`, platform: 'twitter',
        headline: r.title?.substring(0, 220) || text.substring(0, 220), body: text,
        source: `@${handle}`, url: r.link?.startsWith('http') ? r.link : `https://x.com/${handle}/status/${tid}`,
        published_at: new Date().toISOString(), keyword: kw,
      })
    })
  } catch { return [] }
}

// ─── Edge function trigger ────────────────────────────────────────────────────
const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL || ''
const SERVICE_KEY   = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''

export async function triggerEdgeIngest(
  accountId: string, politicianName: string, keywords: string[]
): Promise<{ ok: boolean; inserted: number; error?: string }> {
  if (!SUPABASE_URL) return { ok: false, inserted: 0, error: 'No Supabase URL' }
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/bm-ingest-v2`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SERVICE_KEY ? { Authorization: `Bearer ${SERVICE_KEY}` } : {}),
      },
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

// ─── Browser fallback fetch (no Google News RSS) ──────────────────────────────
export async function clientFetchNews(
  accountId: string, keywords: string[], maxPerKeyword = 12,
): Promise<FeedItem[]> {
  console.log('[clientFetch] Starting browser fetch for', keywords.length, 'keywords')
  // Only use CORS-safe Google APIs — YouTube quota and Reddit CORS are unreliable
  // CSE: general news search (requires valid key + billing enabled in Google Console)
  // GetX: CSE restricted to x.com
  const tasks: Promise<FeedItem[]>[] = []

  for (const kw of keywords.slice(0, 5)) {
    tasks.push(fetchCSENews(kw, Math.ceil(maxPerKeyword / 2)).catch(() => []))
    tasks.push(fetchCSETwitter(kw, Math.ceil(maxPerKeyword / 2)).catch(() => []))
    // YouTube only if quota not exceeded (try but catch gracefully)
    tasks.push(fetchYouTube(kw, 5).catch(() => []))
  }

  const settled = await Promise.allSettled(tasks)
  const all: FeedItem[] = []
  for (const r of settled) if (r.status === 'fulfilled') all.push(...r.value)

  const seen = new Set<string>()
  const deduped = all
    .map(i => ({ ...i, account_id: accountId }))
    .filter(i => { const k = i.url || i.id; if (seen.has(k)) return false; seen.add(k); return true })
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())

  console.log(`[clientFetch] Got ${deduped.length} items (CSE+GetX+YT)`)
  return deduped
}

// ─── Full ingest: edge function primary, browser fallback ─────────────────────
export interface IngestResult {
  total: number; saved: number; source: 'edge' | 'browser'
  sources: Record<string, number>; errors: string[]
}

export async function clientSideIngest(
  accountId: string, keywords: string[],
  options?: { maxPerSource?: number; skipSave?: boolean; politicianName?: string }
): Promise<IngestResult> {
  const errors: string[] = []

  // Step 1: Try edge function (server-side, most reliable)
  const edgeResult = await triggerEdgeIngest(
    accountId,
    options?.politicianName || keywords[0] || '',
    keywords
  )

  if (edgeResult.ok && edgeResult.inserted > 0) {
    console.log(`[ingest] Edge function success: ${edgeResult.inserted} items`)
    return { total: edgeResult.inserted, saved: edgeResult.inserted, source: 'edge', sources: { edge: edgeResult.inserted }, errors }
  }

  if (!edgeResult.ok) {
    errors.push(`Edge fn: ${edgeResult.error}`)
    console.warn('[ingest] Edge function failed, using browser fallback')
  } else {
    console.log('[ingest] Edge function returned 0 items, using browser fallback')
  }

  // Step 2: Browser fallback (YouTube + CSE + Reddit — no CORS proxy needed)
  const items = await clientFetchNews(accountId, keywords, options?.maxPerSource ?? 12)

  if (!options?.skipSave && items.length > 0) {
    try {
      const rows = items.map(i => ({
        id: i.id, account_id: i.account_id, platform: i.platform,
        bucket: i.bucket, sentiment: i.sentiment, tone: i.tone,
        headline: i.headline, title: i.headline, body: i.body || i.headline,
        source: i.source, source_name: i.source, source_type: i.platform,
        url: i.url, geo_tags: i.geo_tags, topic_tags: i.topic_tags,
        language: i.language, views: i.views ?? 0, shares: i.shares ?? 0,
        engagement: i.engagement ?? 0, is_trending: i.is_trending ?? false,
        published_at: i.published_at, fetched_at: i.fetched_at, keyword: i.keyword,
      }))
      const { error } = await supabaseAdmin.from('bm_feed')
        .upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
      if (error) {
        errors.push(`DB save: ${error.message}`)
        console.warn('[ingest] bm_feed save error:', error.message)
      } else {
        console.log(`[ingest] Saved ${rows.length} items via browser fallback`)
      }
    } catch (e: any) {
      errors.push(`Save exception: ${e.message}`)
    }
  }

  const sources: Record<string, number> = {}
  for (const i of items) sources[i.platform] = (sources[i.platform] || 0) + 1

  return { total: items.length, saved: items.length, source: 'browser', sources, errors }
}
