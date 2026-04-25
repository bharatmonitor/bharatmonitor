import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? ''
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
const GEMINI_KEY    = Deno.env.get('GEMINI_API_KEY') ?? ''
const YT_KEY        = Deno.env.get('YT_API_KEY') ?? ''
const NEWSDATA_KEY  = Deno.env.get('NEWSDATA_API_KEY') ?? ''
const XPOZ_KEY      = Deno.env.get('XPOZ_API_KEY') ?? ''

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

const POS    = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','praised','progress','victory','wins','announced']
const NEG    = ['scam','scandal','corruption','fraud','arrest','protest','attack','exposed','resign','fake','crisis','blast','terror','controversy','accused','violence']
const CRISIS = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','fire','emergency','explosion','stampede']
const OPP    = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition']
const GEO    = ['Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','Ahmedabad','Pune','Jaipur','Lucknow','Patna','UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','India','Tamil Nadu','Kerala','West Bengal','Varanasi','Chhattisgarh','Madhya Pradesh','Odisha','Assam','Punjab','Haryana']

function kwScore(text) {
  const t = text.toLowerCase()
  let s = 0
  for (const w of POS) if (t.includes(w)) s += 0.3
  for (const w of NEG) if (t.includes(w)) s -= 0.3
  for (const w of CRISIS) if (t.includes(w)) s -= 0.6
  s = Math.max(-1, Math.min(1, s))
  const crisis = CRISIS.some(w => t.includes(w))
  const opp    = OPP.some(w => t.includes(w)) && s < 0
  return {
    tone:      Math.round(s * 5),
    bucket:    crisis || s < -0.5 ? 'red' : opp || s < -0.2 ? 'yellow' : s > 0.15 ? 'blue' : 'silver',
    sentiment: s > 0.15 ? 'positive' : s < -0.15 ? 'negative' : 'neutral',
    geo_tags:  GEO.filter(g => t.includes(g.toLowerCase())),
    topic_tags:[...(crisis?['Crisis']:[]),...(s>0.3?['Achievement']:[]),...(t.includes('election')?['Election']:[]),...(opp?['Opposition']:[]),...(t.includes('parliament')?['Parliament']:[]),...(t.includes('budget')?['Economy']:[])],
  }
}

function parseRSS(xml) {
  const items = []
  const rx = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = rx.exec(xml)) !== null) {
    const b   = m[1]
    const get = tag => { const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`); const mm = r.exec(b); return (mm?.[1]??'').trim() }
    const title = get('title'), link = get('link') || get('guid')
    if (title && link) items.push({ title, link, pubDate: get('pubDate'), source: get('source').replace(/<[^>]+>/g,'') || 'Google News' })
  }
  return items
}

async function fetchNewsRSS(kw, lang) {
  const q   = encodeURIComponent(lang === 'hi' ? kw : `${kw} india`)
  const hl  = lang === 'hi' ? 'hi-IN' : 'en-IN'
  const url = `https://news.google.com/rss/search?q=${q}&hl=${hl}&gl=IN&ceid=IN:${lang}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) return []
    return parseRSS(await r.text()).slice(0, 15)
  } catch { return [] }
}

async function fetchYouTube(kw) {
  if (!YT_KEY) return []
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(kw)}+india&type=video&regionCode=IN&order=date&maxResults=8&key=${YT_KEY}`, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) return []
    const d = await r.json()
    return (d.items ?? []).filter(i => i.id?.videoId).map(i => ({ id: `yt-${i.id.videoId}`, title: i.snippet.title, link: `https://youtube.com/watch?v=${i.id.videoId}`, source: i.snippet.channelTitle, pubDate: i.snippet.publishedAt, platform: 'youtube', body: (i.snippet.description??'').slice(0,300) }))
  } catch { return [] }
}

async function fetchReddit(kw) {
  try {
    const r = await fetch(`https://www.reddit.com/r/india+IndianPolitics+IndiaSpeaks/search.json?q=${encodeURIComponent(kw)}&sort=new&restrict_sr=on&limit=8&raw_json=1`, { headers: { 'User-Agent': 'BharatMonitor/3.0' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) return []
    const d = await r.json()
    return (d?.data?.children ?? []).map(c => ({ id: `reddit-${c.data.id}`, title: c.data.title, link: `https://reddit.com${c.data.permalink}`, source: `r/${c.data.subreddit}`, pubDate: new Date(c.data.created_utc * 1000).toISOString(), platform: 'reddit', body: (c.data.selftext??'').slice(0,300) }))
  } catch { return [] }
}

async function fetchNewsData(kw) {
  if (!NEWSDATA_KEY) return []
  try {
    const r = await fetch(`https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=${encodeURIComponent(kw)}&country=in&language=en,hi&category=politics,top`, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) return []
    const d = await r.json()
    return (d.results ?? []).map(a => ({ id: `nd-${a.article_id}`, title: a.title, link: a.link, source: a.source_id, pubDate: a.pubDate, platform: 'news', body: (a.description??'').slice(0,300) }))
  } catch { return [] }
}

async function geminiSentiment(text) {
  if (!GEMINI_KEY) return null
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `You are an Indian political news analyst. Rate this news item's sentiment for an Indian politician's war room.\n\nRespond ONLY with valid JSON, no markdown:\n{"bucket":"red|yellow|blue|silver","sentiment":"positive|negative|neutral","tone":-5..5}\n\nbucket guide: red=crisis/attack, yellow=developing threat/opposition, blue=positive/achievement, silver=neutral/routine\n\nNews: ${text.slice(0,400)}` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 80 },
      }),
      signal: AbortSignal.timeout(12000),
    })
    if (!r.ok) return null
    const d = await r.json()
    const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const m = txt.match(/\{[\s\S]*?\}/)
    return m ? JSON.parse(m[0]) : null
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  try {
    const { accountId, politicianName, keywords = [], maxPerSource = 20 } = await req.json()
    if (!accountId || !keywords.length) return new Response(JSON.stringify({ ok: false, error: 'Missing accountId or keywords' }), { headers: CORS })

    const allRaw = []
    const kws    = keywords.slice(0, 8)

    await Promise.allSettled([
      ...kws.map(kw => fetchNewsRSS(kw,'en').then(items => allRaw.push(...items.map(i => ({...i,keyword:kw,platform:'news'}))))),
      ...kws.map(kw => fetchNewsRSS(kw,'hi').then(items => allRaw.push(...items.map(i => ({...i,keyword:kw,platform:'news',language:'hindi'}))))),
      ...kws.slice(0,3).map(kw => fetchNewsData(kw).then(items => allRaw.push(...items.map(i => ({...i,keyword:kw}))))),
      ...kws.map(kw => fetchYouTube(kw).then(items => allRaw.push(...items.map(i => ({...i,keyword:kw}))))),
      ...kws.map(kw => fetchReddit(kw).then(items => allRaw.push(...items.map(i => ({...i,keyword:kw}))))),
    ])

    const seen = new Set()
    const deduped = allRaw.filter(i => { const k = i.link || i.id; if (!k || seen.has(k)) return false; seen.add(k); return true })
    console.log(`[bm-ingest-v2] ${deduped.length} items after dedup for ${kws.length} keywords`)

    const now  = new Date().toISOString()
    const rows = []
    for (const item of deduped.slice(0, maxPerSource * kws.length)) {
      const text = `${item.title} ${item.body||''}`
      const kw   = kwScore(text)
      const ai   = await geminiSentiment(text)
      const id   = item.id || `ingest-${Date.now()}-${Math.random().toString(36).slice(2,8)}`
      rows.push({
        id, account_id: accountId,
        headline:    (item.title||'').slice(0,220),
        title:       (item.title||'').slice(0,220),
        body:        (item.body||item.title||'').slice(0,1000),
        source:      item.source || 'Web',
        source_name: item.source || 'Web',
        source_type: item.platform || 'news',
        platform:    item.platform || 'news',
        url:         item.link || '',
        bucket:      ai?.bucket    ?? kw.bucket,
        sentiment:   ai?.sentiment ?? kw.sentiment,
        tone:        ai?.tone      ?? kw.tone,
        geo_tags:    kw.geo_tags,
        topic_tags:  kw.topic_tags,
        language:    item.language || 'english',
        keyword:     item.keyword  || keywords[0] || '',
        published_at: item.pubDate ? new Date(item.pubDate).toISOString() : now,
        fetched_at:  now,
      })
    }

    const { error } = await db.from('bm_feed').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (error) console.warn('bm_feed upsert warn:', error.message)

    const crisisRows = rows.filter(r => r.bucket === 'red').map(r => ({ id: `ca-${r.id}`, account_id: accountId, feed_item_id: r.id, headline: r.headline, source: r.source, severity: 'high', created_at: now }))
    if (crisisRows.length) await db.from('crisis_alerts').upsert(crisisRows, { onConflict: 'id', ignoreDuplicates: true })

    console.log(`[bm-ingest-v2] inserted=${rows.length} crisis=${crisisRows.length} ai=${GEMINI_KEY?'gemini':'keyword'}`)
    return new Response(JSON.stringify({ ok: true, inserted: rows.length, crisis: crisisRows.length, ai_used: !!GEMINI_KEY, sources: { news: rows.filter(r=>r.platform==='news').length, youtube: rows.filter(r=>r.platform==='youtube').length, reddit: rows.filter(r=>r.platform==='reddit').length } }), { headers: CORS })
  } catch (e) {
    console.error('bm-ingest-v2 error:', e.message)
    return new Response(JSON.stringify({ ok: false, error: e.message }), { status: 500, headers: CORS })
  }
})
