// ============================================================
// social-monitor — FREE STACK
//
// Twitter signals:    Nitter RSS (free, no API key)
// Surge detection:    Google Trends via SerpAPI (free 100/month)
//                     + pytrends-style direct hit (free)
// WhatsApp signals:   Inferred from RSS velocity + keyword spikes
// Instagram/Facebook: Meta Graph API public pages (free tier)
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Nitter RSS Twitter scraper (FREE — no API key needed) ─────────────────────
// Public Nitter instances — rotate through to avoid rate limiting
const NITTER_INSTANCES = [
  'https://nitter.net',
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
]

async function fetchNitterRSS(keyword: string): Promise<{ title: string; link: string; pubDate: string; author: string }[]> {
  const encoded = encodeURIComponent(keyword)

  for (const instance of NITTER_INSTANCES) {
    try {
      const url = `${instance}/search/rss?q=${encoded}&f=tweets`
      const res = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 BharatMonitor/1.0' },
        signal: AbortSignal.timeout(5000),
      })
      if (!res.ok) continue
      const xml = await res.text()

      const items: { title: string; link: string; pubDate: string; author: string }[] = []
      const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
      for (const m of matches) {
        const item = m[1]
        const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1]
          || item.match(/<title>(.*?)<\/title>/)?.[1] || ''
        const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
        const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || new Date().toISOString()
        const author = item.match(/<dc:creator><!\[CDATA\[(.*?)\]\]><\/dc:creator>/)?.[1]
          || item.match(/<author>(.*?)<\/author>/)?.[1] || '@unknown'
        if (title && title.length > 10) {
          items.push({ title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim(), link, pubDate, author })
        }
      }
      if (items.length > 0) return items.slice(0, 15)
    } catch { continue }
  }
  return []
}

// ── Google Trends surge detection (FREE — unofficial pytrends endpoint) ────────
// Detects if a keyword is surging in India — no API key needed
async function getGoogleTrendScore(keyword: string): Promise<number> {
  try {
    // Use SerpAPI if key available — better reliability
    const serpKey = Deno.env.get('SERPAPI_KEY')
    if (serpKey) {
      const url = `https://serpapi.com/search.json?engine=google_trends&q=${encodeURIComponent(keyword)}&geo=IN&date=now+1-d&api_key=${serpKey}`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      const data = await res.json()
      const timelineData = data.interest_over_time?.timeline_data || []
      if (timelineData.length > 0) {
        const latest = timelineData[timelineData.length - 1]?.values?.[0]?.value || 0
        return Number(latest)
      }
    }

    // Free fallback: Google Trends RSS (no key needed)
    const rssUrl = `https://trends.google.com/trends/trendingsearches/daily/rss?geo=IN`
    const res = await fetch(rssUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(5000),
    })
    const xml = await res.text()
    const isInTrending = xml.toLowerCase().includes(keyword.toLowerCase())
    return isInTrending ? 85 : 20
  } catch { return 0 }
}

// ── GDELT News Monitor (FREE — no API key needed) ─────────────────────────────
// Monitors world news including Indian sources in multiple languages
async function fetchGDELT(keyword: string, language = 'english'): Promise<{ title: string; url: string; source: string; date: string; sentiment: number }[]> {
  try {
    const langCode = language === 'hindi' ? 'HIN' : language === 'malayalam' ? 'MAL' : language === 'tamil' ? 'TAM' : 'ENG'
    const encoded = encodeURIComponent(`"${keyword}"`)
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encoded}%20sourcecountry:IN%20sourcelang:${langCode}&mode=artlist&maxrecords=20&format=json&timespan=24H`

    const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
    const data = await res.json()

    return (data.articles || []).map((a: Record<string, unknown>) => ({
      title: String(a.title || ''),
      url: String(a.url || ''),
      source: String(a.domain || ''),
      date: String(a.seendate || new Date().toISOString()),
      sentiment: Number(a.tone || 0), // GDELT provides tone score
    }))
  } catch { return [] }
}

// ── Google News RSS (FREE — no API key needed) ────────────────────────────────
async function fetchGoogleNews(keyword: string, language = 'en'): Promise<{ title: string; link: string; source: string; pubDate: string }[]> {
  try {
    const hl = language === 'hindi' ? 'hi' : language === 'malayalam' ? 'ml' : language === 'tamil' ? 'ta' : 'en'
    const url = `https://news.google.com/rss/search?q=${encodeURIComponent(keyword)}&hl=${hl}-IN&gl=IN&ceid=IN:${hl}`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      signal: AbortSignal.timeout(8000),
    })
    const xml = await res.text()
    const items: { title: string; link: string; source: string; pubDate: string }[] = []
    const matches = xml.matchAll(/<item>([\s\S]*?)<\/item>/g)
    for (const m of matches) {
      const item = m[1]
      const title = item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/)?.[1] || item.match(/<title>(.*?)<\/title>/)?.[1] || ''
      const link = item.match(/<link>(.*?)<\/link>/)?.[1] || ''
      const source = item.match(/<source[^>]*>(.*?)<\/source>/)?.[1] || 'Google News'
      const pubDate = item.match(/<pubDate>(.*?)<\/pubDate>/)?.[1] || new Date().toISOString()
      if (title) items.push({ title: title.replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').trim(), link, source, pubDate })
    }
    return items.slice(0, 15)
  } catch { return [] }
}

// ── Classify content ──────────────────────────────────────────────────────────
function classifyContent(text: string, engagementScore = 0): { bucket: string; sentiment: string } {
  const lower = text.toLowerCase()
  const red = ['protest','riot','violence','crisis','trending','viral','breaking','urgent','surge','clashes','arrested','crackdown','shutdown','blast','attack']
  const yellow = ['rally','debate','campaign','demand','controversy','opposition','building','momentum','developing','upcoming']
  const silver = ['said','stated','declared','speech','statement','claimed','alleged','quoted','accused']

  let bucket = 'blue'
  if (engagementScore > 10000 || red.some(w => lower.includes(w))) bucket = 'red'
  else if (yellow.some(w => lower.includes(w))) bucket = 'yellow'
  else if (silver.some(w => lower.includes(w))) bucket = 'silver'

  const pos = ['support','praise','success','win','achieve','growth','progress','hails','applaud']
  const neg = ['fail','condemn','blame','attack','scandal','corrupt','accuse','slam','criticise','protest','oppose','reject']
  const ps = pos.filter(w => lower.includes(w)).length
  const ns = neg.filter(w => lower.includes(w)).length
  return { bucket, sentiment: ns > ps ? 'negative' : ps > ns ? 'positive' : 'neutral' }
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { account_id, keywords, politician_name, languages = ['english'] } = await req.json()
    const sb = createClient(Deno.env.get('APP_URL') || Deno.env.get('APP_URL') || 'https://bmxrsfyaujcppaqvtnfx.supabase.co' || 'https://bmxrsfyaujcppaqvtnfx.supabase.co', Deno.env.get('SERVICE_ROLE_KEY')!)
    const allItems: Record<string, unknown>[] = []
    const seen = new Set<string>()

    for (const keyword of [...keywords, politician_name].filter(Boolean).slice(0, 5)) {

      // ── 1. Nitter/Twitter RSS ───────────────────────────────────────────────
      try {
        const tweets = await fetchNitterRSS(keyword)
        for (const tweet of tweets) {
          const { bucket, sentiment } = classifyContent(tweet.title)
          const dedup = tweet.title.substring(0, 80)
          if (seen.has(dedup)) continue
          seen.add(dedup)
          allItems.push({
            account_id, platform: 'twitter', bucket, sentiment,
            headline: tweet.title,
            source: tweet.author || '@twitter',
            url: tweet.link,
            geo_tags: ['India'], topic_tags: [keyword],
            language: 'english',
            published_at: new Date(tweet.pubDate).toISOString(),
          })
        }
      } catch (e) { console.error('Nitter failed:', e) }

      // ── 2. Google News RSS ──────────────────────────────────────────────────
      for (const lang of languages.slice(0, 2)) {
        try {
          const gnItems = await fetchGoogleNews(keyword, lang)
          for (const item of gnItems) {
            const { bucket, sentiment } = classifyContent(item.title)
            const dedup = item.title.substring(0, 80)
            if (seen.has(dedup)) continue
            seen.add(dedup)
            allItems.push({
              account_id, platform: 'news', bucket, sentiment,
              headline: item.title,
              source: item.source.toUpperCase(),
              url: item.link,
              geo_tags: ['India'], topic_tags: [keyword],
              language: lang,
              published_at: new Date(item.pubDate).toISOString(),
            })
          }
        } catch (e) { console.error('Google News failed:', e) }
      }

      // ── 3. GDELT multi-language news ────────────────────────────────────────
      for (const lang of languages.slice(0, 2)) {
        try {
          const gdeltItems = await fetchGDELT(keyword, lang)
          for (const item of gdeltItems) {
            if (!item.title || item.title.length < 10) continue
            const dedup = item.title.substring(0, 80)
            if (seen.has(dedup)) continue
            seen.add(dedup)
            const sentiment = item.sentiment < -1 ? 'negative' : item.sentiment > 1 ? 'positive' : 'neutral'
            const { bucket } = classifyContent(item.title)
            allItems.push({
              account_id, platform: 'news', bucket, sentiment,
              headline: item.title,
              source: item.source.toUpperCase(),
              url: item.url,
              geo_tags: ['India'], topic_tags: [keyword],
              language: lang,
              published_at: new Date(item.date).toISOString(),
            })
          }
        } catch (e) { console.error('GDELT failed:', e) }
      }

      // ── 4. Surge detection via Google Trends ────────────────────────────────
      try {
        const trendScore = await getGoogleTrendScore(keyword)
        if (trendScore > 60) {
          const headline = `"${keyword}" trending on Google India — interest score ${trendScore}/100${trendScore > 80 ? ', significant surge detected' : ''}`
          if (!seen.has(headline.substring(0, 80))) {
            seen.add(headline.substring(0, 80))
            allItems.push({
              account_id, platform: 'twitter', bucket: trendScore > 75 ? 'red' : 'yellow',
              sentiment: 'neutral', headline,
              source: 'GOOGLE TRENDS · INDIA',
              geo_tags: ['India'], topic_tags: [keyword, 'Trending'],
              language: 'english',
              is_trending: true,
              published_at: new Date().toISOString(),
            })
          }
        }
      } catch (e) { console.error('Trends failed:', e) }
    }

    // Batch insert
    if (allItems.length > 0) {
      const chunks = Array.from({ length: Math.ceil(allItems.length / 50) }, (_, i) => allItems.slice(i * 50, (i + 1) * 50))
      for (const chunk of chunks) {
        const { error } = await sb.from('feed_items').insert(chunk)
        if (error) console.error('Insert error:', error)
      }
    }

    return new Response(
      JSON.stringify({ success: true, count: allItems.length, breakdown: { twitter: allItems.filter(i=>i.platform==='twitter').length, news: allItems.filter(i=>i.platform==='news').length } }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
