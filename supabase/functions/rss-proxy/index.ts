// ============================================================
// rss-proxy — FREE STACK
//
// Sources:
//   - 20+ curated Indian RSS feeds (free, no key)
//   - Google News RSS per keyword + language (free, no key)
//   - GDELT real-time news API (free, no key)
//   - Nitter Twitter RSS (free, no key)
//
// Translation:
//   - LibreTranslate (free, self-hosted or public instance)
//   - Fallback: keyword-based language detection only
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Curated Indian RSS feeds (all free) ───────────────────────────────────────
const RSS_FEEDS = [
  // English — Tier 1 (wire services / govt)
  { url: 'https://feeds.feedburner.com/ndtvnews-top-stories',              name: 'NDTV',           lang: 'english', tier: 1 },
  { url: 'https://www.thehindu.com/news/national/feeder/default.rss',      name: 'THE HINDU',      lang: 'english', tier: 1 },
  { url: 'https://aninews.in/rss/',                                         name: 'ANI',            lang: 'english', tier: 1 },
  { url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3',         name: 'PIB',            lang: 'english', tier: 1 },
  // English — Tier 2
  { url: 'https://indianexpress.com/feed/',                                 name: 'INDIAN EXPRESS', lang: 'english', tier: 2 },
  { url: 'https://thewire.in/rss',                                          name: 'THE WIRE',       lang: 'english', tier: 2 },
  { url: 'https://theprint.in/feed/',                                       name: 'THE PRINT',      lang: 'english', tier: 2 },
  { url: 'https://scroll.in/feed',                                          name: 'SCROLL.IN',      lang: 'english', tier: 2 },
  { url: 'https://www.thenewsminute.com/rss.xml',                           name: 'NEWS MINUTE',    lang: 'english', tier: 2 },
  { url: 'https://economictimes.indiatimes.com/rssfeedsdefault.cms',        name: 'ECONOMIC TIMES', lang: 'english', tier: 2 },
  { url: 'https://www.livemint.com/rss/news',                               name: 'LIVEMINT',       lang: 'english', tier: 2 },
  // Hindi — Tier 1-2
  { url: 'https://www.bhaskar.com/rss-feed/1061/',                          name: 'DAINIK BHASKAR', lang: 'hindi',   tier: 1 },
  { url: 'https://www.amarujala.com/rss/breaking-news.xml',                 name: 'AMAR UJALA',     lang: 'hindi',   tier: 2 },
  { url: 'https://www.jagran.com/rss/news-national.xml',                    name: 'DAINIK JAGRAN',  lang: 'hindi',   tier: 1 },
  { url: 'https://navbharattimes.indiatimes.com/rssfeedsdefault.cms',       name: 'NAVBHARAT TIMES',lang: 'hindi',   tier: 2 },
  // Malayalam
  { url: 'https://www.manoramaonline.com/rss.xml',                          name: 'MANORAMA',       lang: 'malayalam', tier: 2 },
  { url: 'https://www.mathrubhumi.com/rss/',                                name: 'MATHRUBHUMI',    lang: 'malayalam', tier: 2 },
  // Tamil
  { url: 'https://www.dinamalar.com/rss.asp',                               name: 'DINAMALAR',      lang: 'tamil',   tier: 2 },
  // Telugu
  { url: 'https://www.eenadu.net/rss.xml',                                  name: 'EENADU',         lang: 'telugu',  tier: 2 },
  // Marathi
  { url: 'https://www.lokmat.com/rss.xml',                                  name: 'LOKMAT',         lang: 'marathi', tier: 2 },
]

// ── Parse RSS XML ─────────────────────────────────────────────────────────────
function parseRSS(xml: string, feedName: string, lang: string): { title: string; link: string; pubDate: string; source: string; language: string }[] {
  const items: { title: string; link: string; pubDate: string; source: string; language: string }[] = []
  const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
  for (const m of matches) {
    const item = m[1]
    const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
      || item.match(/<title>(.*?)<\/title>/)?.[1] || ''
    const link = item.match(/<link>(.*?)<\/link>/)?.[1]
      || item.match(/<link[^>]+href="(.*?)"/)?.[1] || ''
    const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || new Date().toISOString()
    if (title && title.length > 15) {
      items.push({
        title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&#39;/g,"'").trim(),
        link, pubDate,
        source: feedName,
        language: lang,
      })
    }
  }
  return items.slice(0, 15)
}

// ── Classify bucket + sentiment ───────────────────────────────────────────────
function classify(text: string): { bucket: string; sentiment: string } {
  const lower = text.toLowerCase()
  const RED    = ['protest','riot','violence','crisis','breaking','trending','viral','urgent','surge','blast','attack','clashes','arrested','crackdown','shutdown','curfew','lathicharge','blockade']
  const YELLOW = ['rally','debate','campaign','demand','controversy','opposition','momentum','developing']
  const SILVER = ['said','stated','declared','speech','statement','claimed','alleged','quoted','accused','responded']
  const POS    = ['success','praised','hails','win','achieve','growth','celebrates','applaud','inaugurates','launches','milestone']
  const NEG    = ['fail','condemn','blame','attack','scandal','corrupt','accuse','slam','criticise','protest','oppose','reject','arrested','violence']

  let bucket = 'blue'
  if (RED.some(w => lower.includes(w))) bucket = 'red'
  else if (YELLOW.some(w => lower.includes(w))) bucket = 'yellow'
  else if (SILVER.some(w => lower.includes(w))) bucket = 'silver'

  const ps = POS.filter(w => lower.includes(w)).length
  const ns = NEG.filter(w => lower.includes(w)).length
  return { bucket, sentiment: ns > ps ? 'negative' : ps > ns ? 'positive' : 'neutral' }
}

// ── Optional: LibreTranslate (free, self-hosted or public) ────────────────────
// Public instance: libretranslate.com — free up to rate limits
// Self-host: github.com/LibreTranslate/LibreTranslate
async function translateToEnglish(text: string, sourceLang: string): Promise<string> {
  const langMap: Record<string, string> = { hindi: 'hi', malayalam: 'ml', tamil: 'ta', telugu: 'te', marathi: 'mr', gujarati: 'gu', bengali: 'bn', kannada: 'kn', punjabi: 'pa', urdu: 'ur' }
  const code = langMap[sourceLang]
  if (!code || sourceLang === 'english') return text
  try {
    const ltUrl = Deno.env.get('LIBRETRANSLATE_URL') || 'https://libretranslate.com'
    const ltKey = Deno.env.get('LIBRETRANSLATE_KEY') || '' // optional API key
    const res = await fetch(`${ltUrl}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ q: text, source: code, target: 'en', api_key: ltKey }),
      signal: AbortSignal.timeout(5000),
    })
    const d = await res.json()
    return d.translatedText || text
  } catch { return text } // silently fall back to original
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { account_id, keywords = [], feed_urls = [], languages = ['english', 'hindi'] } = await req.json()
    const sb = createClient('https://bmxrsfyaujcppaqvtnfx.supabase.co', Deno.env.get('SERVICE_ROLE_KEY') || '')

    // Get active feeds from DB, supplement with hardcoded list
    const { data: dbFeeds } = await sb.from('rss_feeds').select('url,name,language,tier').eq('is_active', true).limit(30)
    const feedsToFetch = dbFeeds && dbFeeds.length > 0
      ? dbFeeds as typeof RSS_FEEDS
      : RSS_FEEDS.filter(f => languages.includes(f.lang))

    const allItems: Record<string, unknown>[] = []
    const seen = new Set<string>()

    // ── Fetch curated RSS feeds ───────────────────────────────────────────────
    const feedPromises = feedsToFetch.slice(0, 15).map(async feed => {
      try {
        const res = await fetch((feed as {url: string}).url, {
          headers: { 'User-Agent': 'BharatMonitor/1.0' },
          signal: AbortSignal.timeout(6000),
        })
        if (!res.ok) return []
        const xml = await res.text()
        return parseRSS(xml, (feed as {name: string}).name, (feed as {language?: string; lang?: string}).language || (feed as {lang?: string}).lang || 'english')
      } catch { return [] }
    })

    const feedResults = await Promise.allSettled(feedPromises)
    for (const result of feedResults) {
      if (result.status !== 'fulfilled') continue
      for (const item of result.value) {
        // Filter by keywords if provided
        if (keywords.length > 0) {
          const lower = item.title.toLowerCase()
          if (!keywords.some((k: string) => lower.includes(k.toLowerCase()))) continue
        }
        const dedup = item.title.substring(0, 80)
        if (seen.has(dedup)) continue
        seen.add(dedup)

        // Translate non-English content for AI processing
        const englishTitle = item.language !== 'english' ? await translateToEnglish(item.title, item.language) : item.title
        const { bucket, sentiment } = classify(englishTitle || item.title)

        allItems.push({
          account_id, platform: 'news', bucket, sentiment,
          headline: item.title, // keep original language for display
          source: item.source,
          url: item.link,
          geo_tags: ['India'], topic_tags: [],
          language: item.language,
          published_at: new Date(item.pubDate).toISOString(),
        })
      }
    }

    // ── Google News RSS per keyword ───────────────────────────────────────────
    for (const keyword of keywords.slice(0, 3)) {
      for (const lang of languages.slice(0, 2)) {
        try {
          const hl = lang === 'hindi' ? 'hi' : lang === 'malayalam' ? 'ml' : lang === 'tamil' ? 'ta' : 'en'
          const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=${hl}-IN&gl=IN&ceid=IN:${hl}`
          const res = await fetch(url, { headers: { 'User-Agent': 'BharatMonitor/1.0' }, signal: AbortSignal.timeout(8000) })
          if (!res.ok) continue
          const xml = await res.text()
          const items = parseRSS(xml, 'GOOGLE NEWS', lang)
          for (const item of items) {
            const dedup = item.title.substring(0, 80)
            if (seen.has(dedup)) continue
            seen.add(dedup)
            const { bucket, sentiment } = classify(item.title)
            allItems.push({
              account_id, platform: 'news', bucket, sentiment,
              headline: item.title, source: item.source,
              url: item.link, geo_tags: ['India'], topic_tags: [keyword],
              language: lang, published_at: new Date(item.pubDate).toISOString(),
            })
          }
        } catch { continue }
      }
    }

    // Batch insert
    if (allItems.length > 0) {
      const chunks = Array.from({ length: Math.ceil(allItems.length / 50) }, (_, i) => allItems.slice(i * 50, (i + 1) * 50))
      for (const chunk of chunks) {
        await sb.from('feed_items').insert(chunk)
      }
    }

    // Trigger classifier for low-confidence items (fire and forget)
    const lowConf = allItems.filter(i => i.bucket === 'blue').slice(0, 10)
    if (lowConf.length > 0) {
      Promise.allSettled(lowConf.map(item =>
        fetch(`${Deno.env.get('APP_URL') || 'https://bmxrsfyaujcppaqvtnfx.supabase.co'}/functions/v1/ai-classifier`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${Deno.env.get('SERVICE_ROLE_KEY')}` },
          body: JSON.stringify({ headline: item.headline, account_id, language: item.language }),
        })
      ))
    }

    return new Response(
      JSON.stringify({ success: true, count: allItems.length }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
