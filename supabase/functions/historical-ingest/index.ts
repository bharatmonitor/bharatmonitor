import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SUPABASE_URL = 'https://bmxrsfyaujcppaqvtnfx.supabase.co'

// ── GDELT free API ─────────────────────────────────────────────────────────────
// Covers 2015 to present, 15-min granularity, free, no auth
async function fetchGDELT(keyword: string, fromDate: string, toDate: string) {
  try {
    // GDELT DOC 2.0 API - timeline of mentions + tone
    const url = new URL('https://api.gdeltproject.org/api/v2/doc/doc')
    url.searchParams.set('query', `${keyword} sourcelang:English OR sourcelang:Hindi`)
    url.searchParams.set('mode', 'timelinetone')
    url.searchParams.set('startdatetime', fromDate.replace(/-/g,'') + '000000')
    url.searchParams.set('enddatetime', toDate.replace(/-/g,'') + '235959')
    url.searchParams.set('timespan', '1MONTH')
    url.searchParams.set('format', 'json')

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(15000) })
    if (!res.ok) return []
    const data = await res.json()

    // Also get top articles
    const artUrl = new URL('https://api.gdeltproject.org/api/v2/doc/doc')
    artUrl.searchParams.set('query', `${keyword} sourcecountry:India`)
    artUrl.searchParams.set('mode', 'artlist')
    artUrl.searchParams.set('startdatetime', fromDate.replace(/-/g,'') + '000000')
    artUrl.searchParams.set('enddatetime', toDate.replace(/-/g,'') + '235959')
    artUrl.searchParams.set('maxrecords', '250')
    artUrl.searchParams.set('format', 'json')
    artUrl.searchParams.set('sort', 'hybridrel')

    const artRes = await fetch(artUrl.toString(), { signal: AbortSignal.timeout(15000) })
    const artData = artRes.ok ? await artRes.json() : { articles: [] }

    return {
      timeline: data?.timeline?.[0]?.data || [],
      articles: (artData?.articles || []).map((a: any) => ({
        url: a.url,
        title: a.title,
        date: a.seendate,
        source: a.domain,
        tone: a.tone,
        country: a.sourcecountry,
      }))
    }
  } catch(e) {
    return { timeline: [], articles: [] }
  }
}

// ── Meta Ad Library ────────────────────────────────────────────────────────────
async function fetchMetaAds(pageIds: string[], accessToken: string, fromDate: string) {
  if (!accessToken) return []
  const results = []
  for (const pageId of pageIds) {
    try {
      const url = new URL('https://graph.facebook.com/v19.0/ads_archive')
      url.searchParams.set('ad_type', 'POLITICAL_AND_ISSUE_ADS')
      url.searchParams.set('ad_reached_countries', 'IN')
      url.searchParams.set('search_page_ids', pageId)
      url.searchParams.set('ad_delivery_date_min', fromDate)
      url.searchParams.set('fields', [
        'id','page_name','ad_creation_time','ad_delivery_start_time','ad_delivery_stop_time',
        'spend','impressions','region_distribution','ad_snapshot_url',
        'ad_creative_bodies','ad_creative_link_titles'
      ].join(','))
      url.searchParams.set('limit', '100')
      url.searchParams.set('access_token', accessToken)

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(12000) })
      const data = await res.json()
      if (data.data) results.push(...data.data.map((ad: any) => ({ ...ad, page_id: pageId })))

      // Paginate if needed
      if (data.paging?.next) {
        const nextRes = await fetch(data.paging.next, { signal: AbortSignal.timeout(12000) })
        const nextData = nextRes.ok ? await nextRes.json() : {}
        if (nextData.data) results.push(...nextData.data.map((ad: any) => ({ ...ad, page_id: pageId })))
      }
    } catch(e) { continue }
  }
  return results
}

// ── YouTube channel history ────────────────────────────────────────────────────
async function fetchYouTube(channelIds: string[], keywords: string[], apiKey: string, fromDate: string) {
  if (!apiKey) return []
  const results = []
  for (const keyword of keywords.slice(0, 3)) {
    try {
      const url = new URL('https://www.googleapis.com/youtube/v3/search')
      url.searchParams.set('part', 'snippet')
      url.searchParams.set('q', keyword)
      url.searchParams.set('type', 'video')
      url.searchParams.set('order', 'relevance')
      url.searchParams.set('publishedAfter', `${fromDate}T00:00:00Z`)
      url.searchParams.set('regionCode', 'IN')
      url.searchParams.set('relevanceLanguage', 'hi')
      url.searchParams.set('maxResults', '50')
      url.searchParams.set('key', apiKey)

      const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
      const data = res.ok ? await res.json() : {}
      if (data.items) {
        results.push(...data.items.map((v: any) => ({
          video_id: v.id?.videoId,
          title: v.snippet?.title,
          channel: v.snippet?.channelTitle,
          date: v.snippet?.publishedAt,
          description: v.snippet?.description?.substring(0, 200),
          keyword,
        })))
      }
    } catch(e) { continue }
  }
  return results
}

// ── Google News RSS (last 30 days, chunked) ───────────────────────────────────
async function fetchGoogleNewsHistory(keywords: string[]) {
  const results = []
  for (const keyword of keywords.slice(0, 5)) {
    try {
      const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword + ' India')}&hl=en-IN&gl=IN&ceid=IN:en`
      const res = await fetch(url, { headers: { 'User-Agent': 'BharatMonitor/1.0' }, signal: AbortSignal.timeout(8000) })
      if (!res.ok) continue
      const xml = await res.text()
      const items = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
      for (const m of items) {
        const item = m[1]
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || ''
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || ''
        const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || 'Google News'
        if (title) results.push({ title, link, pubDate, source, keyword })
      }
    } catch(e) { continue }
  }
  return results
}

// ── MAIN ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const body = await req.json()
    const {
      account_id,
      keywords = [],
      meta_page_ids = [],
      youtube_channel_ids = [],
      months_back = 12,
      sources = ['gdelt', 'meta', 'youtube', 'rss'],
    } = body

    const sb = createClient(SUPABASE_URL, Deno.env.get('SERVICE_ROLE_KEY') || '')
    const META_TOKEN = Deno.env.get('META_ACCESS_TOKEN') || ''
    const YT_KEY = Deno.env.get('YOUTUBE_API_KEY') || ''

    // Date range
    const toDate = new Date().toISOString().split('T')[0]
    const fromDate = new Date(Date.now() - months_back * 30 * 24 * 3600000).toISOString().split('T')[0]

    const result: Record<string, any> = { account_id, from: fromDate, to: toDate, sources: {} }

    // ── GDELT ────────────────────────────────────────────────────────────────
    if (sources.includes('gdelt') && keywords.length > 0) {
      const gdeltResults = []
      for (const kw of keywords.slice(0, 5)) {
        const data = await fetchGDELT(kw, fromDate, toDate)
        gdeltResults.push({ keyword: kw, ...data })
        // Store articles in historical_feed
        if ((data as any).articles?.length > 0) {
          const rows = (data as any).articles.map((a: any) => ({
            account_id,
            source_type: 'gdelt',
            keyword: kw,
            title: a.title,
            url: a.url,
            source_name: a.source,
            published_at: a.date ? new Date(a.date.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})/, '$1-$2-$3T$4:$5:$6')).toISOString() : new Date().toISOString(),
            tone: a.tone || 0,
            country: a.country || 'India',
            fetched_at: new Date().toISOString(),
          }))
          await sb.from('historical_feed').upsert(rows, { onConflict: 'url' }).catch(() => {})
        }
      }
      result.sources.gdelt = { keywords: keywords.slice(0,5).length, articles: gdeltResults.reduce((s: number, r: any) => s + (r.articles?.length || 0), 0) }
    }

    // ── META ADS ─────────────────────────────────────────────────────────────
    if (sources.includes('meta') && (META_TOKEN || meta_page_ids.length > 0)) {
      const ads = await fetchMetaAds(meta_page_ids, META_TOKEN, fromDate)
      if (ads.length > 0) {
        const rows = ads.map((ad: any) => ({
          account_id,
          source_type: 'meta_ad',
          keyword: ad.page_name || '',
          title: ad.ad_creative_bodies?.[0]?.substring(0,200) || ad.ad_creative_link_titles?.[0] || 'Ad',
          url: ad.ad_snapshot_url || '',
          source_name: ad.page_name || 'Meta Ad',
          published_at: ad.ad_delivery_start_time || ad.ad_creation_time || new Date().toISOString(),
          spend_min: parseInt(ad.spend?.lower_bound || '0'),
          spend_max: parseInt(ad.spend?.upper_bound || '0'),
          fetched_at: new Date().toISOString(),
        }))
        await sb.from('historical_feed').upsert(rows, { onConflict: 'url' }).catch(() => {})
      }
      result.sources.meta = { ads: ads.length, has_token: !!META_TOKEN }
    }

    // ── YOUTUBE ───────────────────────────────────────────────────────────────
    if (sources.includes('youtube') && YT_KEY) {
      const videos = await fetchYouTube(youtube_channel_ids, keywords, YT_KEY, fromDate)
      if (videos.length > 0) {
        const rows = videos.filter(v => v.video_id).map((v: any) => ({
          account_id,
          source_type: 'youtube',
          keyword: v.keyword,
          title: v.title,
          url: `https://youtube.com/watch?v=${v.video_id}`,
          source_name: v.channel,
          published_at: v.date || new Date().toISOString(),
          fetched_at: new Date().toISOString(),
        }))
        await sb.from('historical_feed').upsert(rows, { onConflict: 'url' }).catch(() => {})
      }
      result.sources.youtube = { videos: videos.length }
    }

    // ── RSS / Google News ─────────────────────────────────────────────────────
    if (sources.includes('rss') && keywords.length > 0) {
      const articles = await fetchGoogleNewsHistory(keywords)
      if (articles.length > 0) {
        const rows = articles.map((a: any) => ({
          account_id,
          source_type: 'google_news',
          keyword: a.keyword,
          title: a.title,
          url: a.link,
          source_name: a.source,
          published_at: a.pubDate ? new Date(a.pubDate).toISOString() : new Date().toISOString(),
          fetched_at: new Date().toISOString(),
        }))
        await sb.from('historical_feed').upsert(rows.filter((r: any) => r.url), { onConflict: 'url' }).catch(() => {})
      }
      result.sources.rss = { articles: articles.length }
    }

    // ── Summary stats ─────────────────────────────────────────────────────────
    const { count } = await sb.from('historical_feed').select('*', { count: 'exact', head: true }).eq('account_id', account_id)
    result.total_stored = count || 0

    return new Response(
      JSON.stringify({ success: true, ...result }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } })
  }
})
