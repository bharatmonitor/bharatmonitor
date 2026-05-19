import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? 'https://ylajerluygbeiqybkgtx.supabase.co'
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMDQzOSwiZXhwIjoyMDkwMDk2NDM5fQ.zgKRPK1VrZg-q7DbuwNzxfYL_3ZfqiOU4K6YiSZySSY'
const GEMINI_KEY    = Deno.env.get('GEMINI_API_KEY') ?? ''
const YT_KEY        = Deno.env.get('YT_API_KEY') ?? ''
const NEWSDATA_KEY  = Deno.env.get('NEWSDATA_API_KEY') ?? ''

const db = createClient(SUPABASE_URL, SUPABASE_KEY)
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

// ─── Expanded scorer ──────────────────────────────────────────────────────────
const POS = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','praised','progress','victory','wins','announced','backs','supports','endorses','applauds','commends','welcomes','approves','celebrates','delivers','record high','beneficiaries','scheme','distributes','opens','dedicates','completes','billion','crore','relief','aid','empowers','transforms','revolution','historic','landmark','alliance','deal','boost','surge','rise','improvement','breakthrough']
const NEG = ['scam','scandal','corruption','fraud','arrest','protest','attack','exposed','resign','fake','crisis','blast','terror','controversy','accused','violence','clash','row','heats up','opposes','criticises','criticizes','rejects','slams','blasts','targets','demands','questions','stalls','blocks','defeated','failed','failure','lost','loss','backlash','outrage','anger','agitation','rally against','bandh','hartal','strike','allegation','alleged','charge','complaint','FIR','case','probe','ED','CBI','IT raid','drops','falls','decline','shortage','inflation','unemployment','poverty']
const CRISIS = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','fire','emergency','explosion','stampede','massacre','attack','gunfire','tragedy','disaster','deaths','fatalities','collapse','accident','crash']
const OPP = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition','indi alliance','INDIA bloc','TMC','SP','BSP','RJD','NCP','priyanka','sonia','akhilesh','tejashwi']
const GEO = ['Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','Ahmedabad','Pune','Jaipur','Lucknow','Patna','Bhopal','Varanasi','UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','India','Tamil Nadu','Kerala','West Bengal','Assam','Odisha','Punjab','Haryana','Jharkhand','Uttarakhand','Goa','Andhra Pradesh','Telangana','Chhattisgarh','Madhya Pradesh','Northeast','Jammu','Kashmir']

function kwScore(text) {
  const t = text.toLowerCase()
  let s = 0
  for (const w of POS)    if (t.includes(w)) s += 0.3
  for (const w of NEG)    if (t.includes(w)) s -= 0.3
  for (const w of CRISIS) if (t.includes(w)) s -= 0.6
  s = Math.max(-1, Math.min(1, s))
  const isCrisis = CRISIS.some(w => t.includes(w))
  const isOpp    = OPP.some(w => t.includes(w)) && s < 0
  const isSarcasm = /\b(claims|promises|pledges|vows|says he|insists|denies|surely|of course|obviously|definitely)\b/.test(t) && s < 0
  return {
    tone:      Math.round(s * 5),
    bucket:    isCrisis || s < -0.5 ? 'red' : isOpp || s < -0.2 ? 'yellow' : s > 0.15 ? 'blue' : 'silver',
    sentiment: s > 0.15 ? 'positive' : s < -0.15 ? 'negative' : 'neutral',
    geo_tags:  GEO.filter(g => t.includes(g.toLowerCase())),
    topic_tags: [...(isCrisis?['Crisis']:[]),...(s>0.3?['Achievement']:[]),...(t.includes('election')?['Election']:[]),...(isOpp?['Opposition']:[]),...(t.includes('parliament')||t.includes('lok sabha')||t.includes('rajya sabha')?['Parliament']:[]),...(t.includes('budget')||t.includes('economy')||t.includes('gdp')?['Economy']:[]),...(t.includes('farmer')||t.includes('kisan')?['Agriculture']:[]),...(isSarcasm?['Sarcasm']:[])],
  }
}

function parseRSS(xml) {
  const items = []
  const rx = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = rx.exec(xml)) !== null) {
    const b   = m[1]
    const get = tag => { const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`); const mm = r.exec(b); return (mm?.[1]??'').trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"') }
    const title = get('title'), link = get('link') || get('guid')
    if (title && link) items.push({ title, link, pubDate: get('pubDate'), source: get('source').replace(/<[^>]+>/g,'') || 'RSS' })
  }
  return items
}

// ─── Source 1: Google News RSS ────────────────────────────────────────────────
async function fetchGoogleNewsRSS(kw, lang) {
  const q   = encodeURIComponent(lang === 'hi' ? kw : `${kw} india`)
  const url = `https://news.google.com/rss/search?q=${q}&hl=${lang==='hi'?'hi-IN':'en-IN'}&gl=IN&ceid=IN:${lang}`
  try {
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) { console.warn(`[GNews] ${kw} ${lang} HTTP ${r.status}`); return [] }
    const items = parseRSS(await r.text())
    console.log(`[GNews] ${kw} ${lang}: ${items.length} items`)
    return items.slice(0, 12)
  } catch(e) { console.warn(`[GNews] ${kw} ${lang} error:`, e.message); return [] }
}


// ─── National Discourse Constants ─────────────────────────────────────────────
// Mirrors src/lib/nationalDiscourse.ts — kept in sync manually
const NATIONAL_KEYWORDS = [
  // Governance
  'Modi government', 'BJP policy', 'Parliament India', 'Amit Shah',
  'Prime Minister Modi', 'Cabinet India', 'Central government India',
  // Opposition
  'Rahul Gandhi', 'INDIA bloc', 'Congress party India', 'Arvind Kejriwal',
  'Mamata Banerjee', 'MK Stalin', 'Akhilesh Yadav', 'opposition India',
  // Economy
  'India GDP', 'inflation India', 'unemployment India', 'RBI policy',
  'rupee dollar', 'Make in India', 'India economy 2026',
  // Social issues
  'women reservation bill', 'caste census India', 'delimitation India',
  'OBC reservation India', 'farmers protest India',
  // Elections
  'West Bengal election', 'Bengal polls', 'election commission India',
  'EVM India', 'voter list India',
  // Institutional
  'ED raid India', 'CBI India', 'Supreme Court India',
  'media freedom India', 'IT rules India', 'press freedom India',
  // Geopolitics
  'India China border', 'India Pakistan', 'Jaishankar', 'India US relations',
  'BRICS India', 'India foreign policy',
  // Crisis
  'India protest', 'India labor unrest', 'India violence', 'India bandh',
]

// Political journalist watchlist — pull articles by these authors
const JOURNALIST_WATCHLIST = [
  '@svaradarajan', '@navikakumar', '@RajdeepSardesai', '@bdutt',
  '@rohini_sgh', '@ShekharGupta', '@nistula', '@mkvenu1', '@sanket',
  '@dhanyarajendran', '@AbhinandanSekhr', '@ameytirodkar', '@YogendraYadav',
  '@mrajshekhar', '@oratorgreat', '@vaishnaroy', '@fayedsouza',
  '@Anurag_Dwary', '@sahilpndy', '@pallavabagla', '@iindrojit',
]

// ─── Source 2: GDELT (completely free, no key, massive India coverage) ────────
async function fetchGDELT(kw) {
  try {
    const q = encodeURIComponent(`"${kw}" india`)
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=20&format=json&SOURCELANG=ENGLISH,HINDI&SOURCECOUNTRY=India`
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) { console.warn(`[GDELT] ${kw} HTTP ${r.status}`); return [] }
    const d = await r.json()
    const arts = d?.articles || []
    console.log(`[GDELT] ${kw}: ${arts.length} items`)
    return arts.map(a => ({
      id: `gdelt-${(a.url||'').slice(-30).replace(/[^a-z0-9]/gi,'')||Date.now().toString(36)}`,
      title: a.title || '', link: a.url || '', source: a.domain || 'GDELT',
      pubDate: a.seendate ? a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,'$1-$2-$3T$4:$5:$6Z') : new Date().toISOString(),
      platform: 'news', body: ''
    }))
  } catch(e) { console.warn(`[GDELT] ${kw} error:`, e.message); return [] }
}

// ─── Source 3: Indian newspapers RSS ─────────────────────────────────────────
const INDIAN_FEEDS = [
  { name: 'PIB India',         url: 'https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3' },
  { name: 'NDTV',              url: 'https://feeds.feedburner.com/ndtvnews-top-stories' },
  { name: 'Times of India',    url: 'https://timesofindia.indiatimes.com/rssfeedstopstories.cms' },
  { name: 'The Hindu',         url: 'https://www.thehindu.com/news/national/feeder/default.rss' },
  { name: 'Indian Express',    url: 'https://indianexpress.com/feed/' },
  { name: 'ANI',               url: 'https://www.aninews.in/rss/india.xml' },
  { name: 'Hindustan Times',   url: 'https://www.hindustantimes.com/feeds/rss/india-news/rssfeed.xml' },
  { name: 'NDTV Hindi',        url: 'https://khabar.ndtv.com/feeds/news/india-news' },
  { name: 'Aaj Tak',           url: 'https://www.aajtak.in/rss/india.xml' },
]

async function fetchIndianRSS(kw) {
  const results = []
  const feeds = INDIAN_FEEDS.slice(0, 5) // limit per run
  for (const feed of feeds) {
    try {
      const r = await fetch(feed.url, { headers: { 'User-Agent': 'BharatMonitor/3.0' }, signal: AbortSignal.timeout(8000) })
      if (!r.ok) continue
      const items = parseRSS(await r.text())
        .filter(i => i.title.toLowerCase().includes(kw.toLowerCase()) || i.title.toLowerCase().includes('india'))
        .slice(0, 4)
      for (const i of items) {
        results.push({ id: `inrss-${feed.name.replace(/\s/g,'')}-${(i.link||'').slice(-20).replace(/[^a-z0-9]/gi,'')||Date.now().toString(36)}`, title: i.title, link: i.link, source: feed.name, pubDate: i.pubDate, platform: 'news', body: '' })
      }
    } catch { continue }
  }
  console.log(`[IndianRSS] ${kw}: ${results.length} items`)
  return results
}

// ─── Source 4: NewsData.io ────────────────────────────────────────────────────
async function fetchNewsData(kw) {
  if (!NEWSDATA_KEY) return []
  try {
    const r = await fetch(`https://newsdata.io/api/1/news?apikey=${NEWSDATA_KEY}&q=${encodeURIComponent(kw)}&country=in&language=en,hi&category=politics,top`, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) { console.warn(`[NewsData] ${kw} HTTP ${r.status}`); return [] }
    const d = await r.json()
    const items = (d.results ?? [])
    console.log(`[NewsData] ${kw}: ${items.length} items`)
    return items.map(a => ({ id: `nd-${a.article_id}`, title: a.title, link: a.link, source: a.source_id, pubDate: a.pubDate, platform: 'news', body: (a.description??'').slice(0,300) }))
  } catch(e) { console.warn(`[NewsData] ${kw} error:`, e.message); return [] }
}

// ─── Source 5: YouTube ────────────────────────────────────────────────────────
async function fetchYouTube(kw) {
  if (!YT_KEY) return []
  try {
    const r = await fetch(`https://www.googleapis.com/youtube/v3/search?part=snippet&q=${encodeURIComponent(kw)}+india&type=video&regionCode=IN&order=date&maxResults=8&key=${YT_KEY}`, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) { console.warn(`[YT] ${kw} HTTP ${r.status}`); return [] }
    const d = await r.json()
    console.log(`[YT] ${kw}: ${(d.items||[]).length} items`)
    return (d.items||[]).filter(i=>i.id?.videoId).map(i => ({ id:`yt-${i.id.videoId}`, title:i.snippet.title, link:`https://youtube.com/watch?v=${i.id.videoId}`, source:i.snippet.channelTitle, pubDate:i.snippet.publishedAt, platform:'youtube', body:(i.snippet.description||'').slice(0,300) }))
  } catch(e) { console.warn(`[YT] ${kw} error:`, e.message); return [] }
}

// ─── Source 6b: Twitter/X via GDELT ─────────────────────────────────────────
// GDELT monitors Twitter/social media. Search with social: prefix.
async function fetchGDELTTwitter(kw) {
  try {
    const q = encodeURIComponent('"' + kw + '" site:twitter.com OR site:x.com')
    const url = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + q + '&mode=artlist&maxrecords=15&format=json'
    const r = await fetch(url, { signal: AbortSignal.timeout(10000) })
    if (!r.ok) return []
    const d = await r.json()
    const arts = (d?.articles || []).filter(a => a.url && (a.url.includes('twitter.com') || a.url.includes('x.com')))
    console.log('[GDELTTwitter] ' + kw + ': ' + arts.length + ' tweets')
    return arts.map(a => ({
      id: 'gdx-' + (a.url||'').slice(-25).replace(/[^a-z0-9]/gi,''),
      title: a.title || '', link: a.url || '',
      source: a.domain || 'X/Twitter',
      pubDate: a.seendate ? a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,'$1-$2-$3T$4:$5:$6Z') : new Date().toISOString(),
      platform: 'twitter', body: ''
    }))
  } catch(e) { console.warn('[GDELTTwitter] ' + kw + ':', e.message); return [] }
}


// ─── Source 6c: Bluesky (completely free, no key, open API) ──────────────────
// Bluesky's public AppView API requires no authentication
// Many Indian journalists/politicians moved here after X changes
async function fetchBluesky(kw) {
  try {
    // No lang filter — Indian political content is mix of EN + HI
    const params = new URLSearchParams({ q: kw + ' india', limit: '25' })
    const r = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?' + params.toString(), {
      headers: { 'Accept': 'application/json', 'User-Agent': 'BharatMonitor/3.0' },
      signal: AbortSignal.timeout(12000),
    })
    if (!r.ok) { console.warn('[Bluesky] ' + kw + ' HTTP ' + r.status); return [] }
    const d = await r.json()
    const posts = d?.posts || []
    console.log('[Bluesky] ' + kw + ': ' + posts.length + ' posts')
    return posts.map(p => {
      // Use URI (always unique) not CID (sometimes null)
      const uriSlug = (p.uri || '').split('/').pop() || Math.random().toString(36).slice(2,10)
      return {
        id: 'bsky-' + (p.author?.handle || 'anon').replace(/[^a-z0-9]/gi,'') + '-' + uriSlug.slice(-12),
        title: (p.record?.text || '').slice(0, 220),
        link: p.author?.handle ? 'https://bsky.app/profile/' + p.author.handle + '/post/' + uriSlug : '',
        source: '@' + (p.author?.handle || 'bluesky'),
        pubDate: p.record?.createdAt || new Date().toISOString(),
        platform: 'twitter',
        body: p.record?.text || '',
        views: p.likeCount || 0,
        shares: p.repostCount || 0,
        engagement: (p.likeCount || 0) + (p.repostCount || 0) + (p.replyCount || 0),
      }
    })
  } catch(e) { console.warn('[Bluesky] ' + kw + ' error:', e.message); return [] }
}

// ─── Source 6d: Nitter RSS (X/Twitter content, free, no auth needed) ──────────
// Nitter is an open-source Twitter frontend. Public instances serve RSS feeds
// of real tweets without requiring API keys or IP whitelisting.
// We rotate between instances in case one is down.
const NITTER_INSTANCES = [
  'https://nitter.privacydev.net',
  'https://nitter.poast.org',
  'https://nitter.1d4.us',
  'https://nitter.lunar.icu',
]

async function fetchNitterRSS(kw) {
  // Try each instance until one works
  for (const instance of NITTER_INSTANCES) {
    try {
      const q = encodeURIComponent(kw + ' india')
      const url = instance + '/search/rss?f=tweets&q=' + q + '&lang=en'
      const r = await fetch(url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BharatMonitor/3.0)' },
        signal: AbortSignal.timeout(8000),
      })
      if (!r.ok) continue
      const xml = await r.text()
      if (!xml.includes('<item>')) continue

      const items = parseRSS(xml)
      console.log('[Nitter] ' + instance.split('/')[2] + ' "' + kw + '": ' + items.length + ' tweets')
      return items.map(i => ({
        ...i,
        platform: 'twitter',
        // Extract handle from link: https://nitter.xxx/handle/status/ID
        source: '@' + (i.link || '').split('/').filter(Boolean)[1] || 'twitter',
        id: 'nitter-' + (i.link || '').split('/').pop() + '-' + kw.slice(0,4).replace(/\s/g,''),
      }))
    } catch(e) {
      console.warn('[Nitter] ' + instance + ' failed:', e.message)
    }
  }
  console.warn('[Nitter] All instances failed for: ' + kw)
  return []
}

// Fetch Bluesky user timeline for watchlist handles
async function fetchBlueskyUser(handle) {
  try {
    const cleanHandle = handle.replace('@','').replace('bsky.app/profile/','')
    const r = await fetch('https://public.api.bsky.app/xrpc/app.bsky.feed.getAuthorFeed?actor=' + cleanHandle + '&limit=20', {
      headers: { 'Accept': 'application/json' },
      signal: AbortSignal.timeout(8000),
    })
    if (!r.ok) return []
    const d = await r.json()
    return (d?.feed || []).map(item => {
      const p = item.post
      return {
        id: 'bsky-u-' + (p.cid||'').slice(-16),
        title: (p.record?.text||'').slice(0,220),
        link: 'https://bsky.app/profile/' + (p.author?.handle||cleanHandle) + '/post/' + (p.uri||'').split('/').pop(),
        source: '@' + (p.author?.handle || cleanHandle),
        pubDate: p.record?.createdAt || new Date().toISOString(),
        platform: 'twitter',
        body: p.record?.text || '',
        engagement: (p.likeCount||0)+(p.repostCount||0)+(p.replyCount||0),
      }
    })
  } catch { return [] }
}

// ─── Source 6: Reddit ─────────────────────────────────────────────────────────
async function fetchReddit(kw) {
  try {
    const r = await fetch(`https://www.reddit.com/r/india+IndianPolitics+IndiaSpeaks+worldnews/search.json?q=${encodeURIComponent(kw)}&sort=new&restrict_sr=on&limit=10&raw_json=1`, { headers:{ 'User-Agent':'BharatMonitor/3.0' }, signal: AbortSignal.timeout(10000) })
    if (!r.ok) { console.warn(`[Reddit] ${kw} HTTP ${r.status}`); return [] }
    const d = await r.json()
    const items = (d?.data?.children||[])
    console.log(`[Reddit] ${kw}: ${items.length} items`)
    return items.map(c => ({ id:`reddit-${c.data.id}`, title:c.data.title, link:`https://reddit.com${c.data.permalink}`, source:`r/${c.data.subreddit}`, pubDate:new Date(c.data.created_utc*1000).toISOString(), platform:'reddit', body:(c.data.selftext||'').slice(0,300) }))
  } catch(e) { console.warn(`[Reddit] ${kw} error:`, e.message); return [] }
}

// ─── Gemini sentiment scoring ─────────────────────────────────────────────────
async function geminiSentiment(text) {
  if (!GEMINI_KEY) return null
  try {
    const prompt = 'Indian political news analyst. Rate this for a politician war room.\nReply ONLY with valid JSON, no markdown: {"bucket":"red|yellow|blue|silver","sentiment":"positive|negative|neutral","tone":-5}\nred=crisis/attack on politician, yellow=opposition threat/developing, blue=positive achievement, silver=neutral/routine\nDetect SARCASM: ironic praise = bucket yellow sentiment negative.\nNews: ' + text.slice(0, 400)
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=' + GEMINI_KEY, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 80 },
      }),
      signal: AbortSignal.timeout(10000),
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
    const body = await req.json()
    const { accountId, politicianName, keywords: rawKeywords = [], maxPerSource = 20, nationalMode = false } = body

    // In national mode: use rotating national discourse keywords instead of account keywords
    const keywords = nationalMode
      ? NATIONAL_KEYWORDS.slice(Math.floor(Math.random() * NATIONAL_KEYWORDS.length / 2), Math.floor(Math.random() * NATIONAL_KEYWORDS.length / 2) + 8)
      : rawKeywords

    console.log(`[bm-ingest-v2] START accountId=${accountId} nationalMode=${nationalMode} keywords=[${keywords.slice(0,3).join(',')}...] newsdata=${NEWSDATA_KEY?'YES':'NO'} gemini=${GEMINI_KEY?'YES':'NO'} yt=${YT_KEY?'YES':'NO'}`)

    if (!accountId) return new Response(JSON.stringify({ ok: false, error: 'Missing accountId' }), { headers: CORS })
    if (!keywords.length) return new Response(JSON.stringify({ ok: false, error: 'Missing keywords' }), { headers: CORS })

    const allRaw = []
    const kws = keywords.slice(0, 8)

    // Run all sources in parallel
    await Promise.allSettled([
      // Google News RSS (works server-side, no CORS)
      ...kws.map(kw => fetchGoogleNewsRSS(kw,'en').then(items => allRaw.push(...items.map(i=>({...i,keyword:kw,platform:'news'}))))),
      ...kws.map(kw => fetchGoogleNewsRSS(kw,'hi').then(items => allRaw.push(...items.map(i=>({...i,keyword:kw,platform:'news',language:'hindi'}))))),
      // GDELT - free, no key needed
      ...kws.slice(0,4).map(kw => fetchGDELT(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Indian newspaper RSS feeds
      ...kws.slice(0,3).map(kw => fetchIndianRSS(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // NewsData.io
      ...kws.slice(0,3).map(kw => fetchNewsData(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // YouTube
      ...kws.slice(0,3).map(kw => fetchYouTube(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Reddit
      ...kws.slice(0,3).map(kw => fetchReddit(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Twitter/X content via GDELT social media indexing
      ...kws.slice(0,4).map(kw => fetchGDELTTwitter(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Bluesky - completely free, open API, no key needed
      ...kws.slice(0,5).map(kw => fetchBluesky(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Nitter RSS - real X/Twitter content, free, no key, no IP restrictions
      ...kws.slice(0,4).map(kw => fetchNitterRSS(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Bluesky watchlist handles (from body.watchlistHandles)
      ...(body.watchlistHandles||[]).filter(h=>h.includes('bsky')||h.includes('bsky.social')).slice(0,10).map(h => fetchBlueskyUser(h).then(items => allRaw.push(...items.map(i=>({...i,keyword:kws[0]||''})))))
    ])

    console.log(`[bm-ingest-v2] Total raw: ${allRaw.length}`)

    // Dedup by URL
    const seen = new Set()
    const deduped = allRaw.filter(i => { const k = i.link || i.id; if (!k || seen.has(k)) return false; seen.add(k); return true })
    console.log(`[bm-ingest-v2] After dedup: ${deduped.length}`)

    const now = new Date().toISOString()
    const rows = []
    for (const item of deduped.slice(0, maxPerSource * kws.length)) {
      const text = `${item.title||''} ${item.body||''}`
      const kw   = kwScore(text)
      const ai   = GEMINI_KEY ? await geminiSentiment(text) : null
      rows.push({
        national_mode: nationalMode,
        id:          item.id || `i-${Date.now()}-${Math.random().toString(36).slice(2,8)}`,
        account_id:  accountId,
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
        fetched_at:  now, created_at: now,
      })
    }

    if (!rows.length) return new Response(JSON.stringify({ ok: true, inserted: 0, warning: 'No items from any source', sources: {} }), { headers: CORS })

    console.log(`[bm-ingest-v2] Upserting ${rows.length} rows for ${accountId}`)
    const { error } = await db.from('bm_feed').upsert(rows, { onConflict: 'id', ignoreDuplicates: false })
    if (error) {
      console.error('[bm-ingest-v2] DB error:', error.message, error.code)
      return new Response(JSON.stringify({ ok: false, error: error.message, code: error.code }), { status: 500, headers: CORS })
    }

    const crisisRows = rows.filter(r=>r.bucket==='red')
    if (crisisRows.length) {
      await db.from('crisis_alerts').upsert(crisisRows.map(r=>({ id:`ca-${r.id}`, account_id:accountId, feed_item_id:r.id, headline:r.headline, source:r.source, severity:'high', created_at:now })), { onConflict:'id', ignoreDuplicates:true })
    }

    const byPlatform = rows.reduce((a,r)=>{ a[r.platform]=(a[r.platform]||0)+1; return a }, {})
    console.log(`[bm-ingest-v2] DONE inserted=${rows.length} crisis=${crisisRows.length} ai=${!!GEMINI_KEY}`, byPlatform)
    return new Response(JSON.stringify({ ok:true, inserted:rows.length, crisis:crisisRows.length, ai_used:!!GEMINI_KEY, sources:byPlatform }), { headers: CORS })

  } catch(e) {
    console.error('[bm-ingest-v2] Unhandled:', e.message)
    return new Response(JSON.stringify({ ok:false, error:e.message }), { status:500, headers:CORS })
  }
})
