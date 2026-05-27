import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? 'https://ylajerluygbeiqybkgtx.supabase.co'
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMDQzOSwiZXhwIjoyMDkwMDk2NDM5fQ.zgKRPK1VrZg-q7DbuwNzxfYL_3ZfqiOU4K6YiSZySSY'
const GEMINI_KEY    = Deno.env.get('GEMINI_API_KEY') ?? ''
const YT_KEY        = Deno.env.get('YT_API_KEY') ?? ''
const NEWSDATA_KEY  = Deno.env.get('NEWSDATA_API_KEY') ?? ''
const RAPIDAPI_KEY  = Deno.env.get('RAPIDAPI_KEY') ?? '0ac9d52ebbmsh9f434c4cfd7b7eep189ae9jsn6baf9d097761'
const TWITTER_BEARER = Deno.env.get('TWITTER_BEARER_TOKEN') ?? 'AAAAAAAAAAAAAAAAAAAAAMba9gEAAAAAqDNTjGrivzEA38qDXtFdpxk9GhE=tn9E87l8df2YRn5mFcmIXt3hHSxXDC1jIWxpSfZr5yIt6Bf3ja'

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
// GDELT full-text indexes articles. site: filter is banned — search keyword only,
// then filter results by URL containing x.com or twitter.com
async function fetchGDELTTwitter(kw) {
  try {
    // No site: filter — GDELT bans it as "too common". Search keyword + india,
    // then post-filter results for x.com/twitter.com URLs.
    const safeKw = kw.split(' ').length < 2 ? kw + ' india politics' : kw + ' india'
    const q = encodeURIComponent(safeKw)
    const url = 'https://api.gdeltproject.org/api/v2/doc/doc?query=' + q + '&mode=artlist&maxrecords=50&format=json&SOURCELANG=ENGLISH&SOURCECOUNTRY=India'
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) { console.warn('[GDELTTwitter] HTTP ' + r.status); return [] }
    const d = await r.json()
    // Post-filter: only keep articles from x.com or twitter.com domains
    const arts = (d?.articles || []).filter(a => a.url && (a.url.includes('x.com/') || a.url.includes('twitter.com/')))
    console.log('[GDELTTwitter] ' + kw + ': ' + arts.length + ' tweets (from ' + (d?.articles||[]).length + ' total)')
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

// Nitter is discontinued (legal shutdown May 2026)
// Twitter data now comes from: Twitter API v2 + RapidAPI scrapers + Bluesky



// ─── Twitter API v2 (Official - Free Basic: 500K tweets/month) ───────────────
// Bearer Token: no OAuth needed, no IP restrictions, works from any server
async function fetchTwitterV2(kw) {
  if (!TWITTER_BEARER) return []
  try {
    const query = encodeURIComponent(`${kw} india`)
    const url = `https://api.twitter.com/2/tweets/search/recent?query=${query}&max_results=20&tweet.fields=created_at,author_id,public_metrics,lang&expansions=author_id&user.fields=username,name`
    const r = await fetch(url, {
      headers: { 'Authorization': `Bearer ${TWITTER_BEARER}` },
      signal: AbortSignal.timeout(15000),
    })
    const body = await r.text()
    if (!r.ok) {
      console.warn(`[TwitterV2] ${kw} HTTP ${r.status}: ${body.slice(0,400)}`)
      // Common errors:
      // 401 = Bearer token invalid or expired
      // 403 = App doesn't have required permissions
      // 429 = Rate limit hit (500K/month on Basic)
      // 400 = Invalid query (operators not supported on Basic tier)
      return []
    }
    const d = JSON.parse(body)
    const tweets = d?.data || []
    const users  = (d?.includes?.users || []).reduce((m: any, u: any) => ({ ...m, [u.id]: u }), {})
    console.log(`[TwitterV2] "${kw}": ${tweets.length} tweets`)
    return tweets.map((t: any) => {
      const user = users[t.author_id] || {}
      return {
        id:          `twv2-${t.id}`,
        title:       (t.text || '').slice(0, 220),
        link:        user.username ? `https://twitter.com/${user.username}/status/${t.id}` : '',
        source:      `@${user.username || 'twitter'}`,
        pubDate:     t.created_at || new Date().toISOString(),
        platform:    'twitter',
        body:        t.text || '',
        engagement:  (t.public_metrics?.like_count || 0) + (t.public_metrics?.retweet_count || 0),
      }
    }).filter((t: any) => t.title)
  } catch(e: any) { console.warn(`[TwitterV2] ${kw}:`, e.message); return [] }
}

// ─── Google CSE REMOVED — "Search entire web" deprecated May 2026 ────────────
// Replaced with: NewsAPI full-text body search + GDELT Twitter + Bluesky
const CSE_KEY = Deno.env.get('GOOGLE_CSE_KEY') ?? ''
const CSE_CX  = Deno.env.get('GOOGLE_CSE_CX')  ?? ''

// Stub — kept so test endpoint compiles; always returns []
async function fetchGoogleTwitter(_kw) { return [] }

// ─── NewsAPI.org — full-text article body search ──────────────────────────────
// Free tier: 100 req/day. Searches INSIDE article body, not just headlines.
// This catches every article mentioning a politician even if not in headline.
// Sign up free at newsapi.org and set NEWSAPI_KEY in Supabase secrets.
const NEWSAPI_KEY = Deno.env.get('NEWSAPI_KEY') ?? ''

async function fetchNewsAPIFullText(politicianName: string, kw: string) {
  if (!NEWSAPI_KEY) return []
  try {
    // 'q' searches full article body + title. 'qInTitle' is headline-only.
    // Using 'q' ensures body mentions are captured.
    const query = encodeURIComponent(politicianName || kw)
    const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=publishedAt&pageSize=20&apiKey=${NEWSAPI_KEY}`
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) { console.warn(`[NewsAPI] HTTP ${r.status}`); return [] }
    const d = await r.json()
    const articles = d?.articles || []
    console.log(`[NewsAPI] "${politicianName || kw}": ${articles.length} full-text matches`)
    return articles
      .filter((a: any) => a.url && !a.url.includes('[Removed]'))
      .map((a: any) => ({
        id: `napi-${(a.url||'x').slice(-30).replace(/[^a-z0-9]/gi,'')}`,
        title: (a.title || '').slice(0, 220),
        link: a.url || '',
        source: a.source?.name || 'NewsAPI',
        pubDate: a.publishedAt || new Date().toISOString(),
        platform: 'news',
        body: (a.description || a.content || '').slice(0, 500),
      }))
  } catch(e: any) { console.warn(`[NewsAPI] ${politicianName}:`, e.message); return [] }
}

// ─── GDELT full-text mention search ──────────────────────────────────────────
// GDELT indexes full article text. Querying politician name finds body mentions.
async function fetchGDELTFullText(politicianName: string) {
  if (!politicianName) return []
  try {
    // Use politician name directly — GDELT searches full article text
    const safeQ = politicianName.split(' ').length < 2 ? politicianName + ' india' : politicianName
    const q = encodeURIComponent(safeQ)
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=25&format=json&SOURCELANG=ENGLISH,HINDI&SOURCECOUNTRY=India`
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) { console.warn(`[GDELTFullText] HTTP ${r.status}`); return [] }
    const d = await r.json()
    const arts = d?.articles || []
    console.log(`[GDELTFullText] "${politicianName}": ${arts.length} full-text matches`)
    return arts.map((a: any) => ({
      id: `gdft-${(a.url||'x').slice(-30).replace(/[^a-z0-9]/gi,'')}`,
      title: a.title || '',
      link: a.url || '',
      source: a.domain || 'GDELT',
      pubDate: a.seendate ? a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/,'$1-$2-$3T$4:$5:$6Z') : new Date().toISOString(),
      platform: 'news',
      body: '',
    }))
  } catch(e: any) { console.warn(`[GDELTFullText] ${politicianName}:`, e.message); return [] }
}

async function fetchReddit(kw) {
  // Try JSON API first, fall back to RSS (RSS more reliable from Supabase IPs)
  try {
    // Method 1: JSON API
    const r = await fetch(
      `https://www.reddit.com/search.json?q=${encodeURIComponent(kw + ' india')}&sort=new&limit=10&raw_json=1&t=week`,
      { headers:{ 'User-Agent':'Mozilla/5.0 BharatMonitor/3.0' }, signal: AbortSignal.timeout(8000) }
    )
    if (r.ok) {
      const d = await r.json()
      const items = d?.data?.children || []
      if (items.length > 0) {
        console.log(`[Reddit JSON] ${kw}: ${items.length} items`)
        return items.map(c => ({
          id: `reddit-${c.data.id}`,
          title: c.data.title,
          link: `https://reddit.com${c.data.permalink}`,
          source: `r/${c.data.subreddit}`,
          pubDate: new Date(c.data.created_utc * 1000).toISOString(),
          platform: 'reddit',
          body: (c.data.selftext || c.data.title || '').slice(0, 300)
        }))
      }
    }
  } catch(e) { console.warn(`[Reddit JSON] ${kw}:`, e.message) }

  // Method 2: RSS fallback (plain XML, no auth, works from more IPs)
  try {
    const q = encodeURIComponent(kw + ' india')
    const r = await fetch(
      `https://www.reddit.com/search.rss?q=${q}&sort=new&t=week`,
      { headers:{ 'User-Agent':'Mozilla/5.0 BharatMonitor/3.0' }, signal: AbortSignal.timeout(8000) }
    )
    if (!r.ok) { console.warn(`[Reddit RSS] ${kw} HTTP ${r.status}`); return [] }
    const xml = await r.text()
    const items = parseRSS(xml)
    console.log(`[Reddit RSS] ${kw}: ${items.length} items`)
    return items.map(i => ({ ...i, platform: 'reddit',
      id: 'reddit-rss-' + (i.link || '').split('/').filter(Boolean).pop() + '-' + kw.slice(0,4).replace(/\s/g,'')
    }))
  } catch(e) { console.warn(`[Reddit RSS] ${kw}:`, e.message); return [] }
}


// ─── RapidAPI: Twitter135 — keyword search ────────────────────────────────────
async function fetchTwitterRapid(kw) {
  if (!RAPIDAPI_KEY) return []
  try {
    const q = encodeURIComponent(kw + ' india')
    // Twitter135: try search endpoint
    // Try twitter135 search - multiple possible endpoint formats
    const url = `https://twitter135.p.rapidapi.com/v2/Search/?q=${q}&count=20&result_type=mixed&lang=en`
    console.log(`[TwitterRapid] fetching: ${url.slice(0,80)}`)
    const r = await fetch(url, {
      headers: {
        'x-rapidapi-host': 'twitter135.p.rapidapi.com',
        'x-rapidapi-key': RAPIDAPI_KEY,
        'Content-Type': 'application/json',
      },
      signal: AbortSignal.timeout(15000),
    })
    const body = await r.text()
    if (!r.ok) {
      console.warn(`[TwitterRapid] ${kw} HTTP ${r.status}: ${body.slice(0,300)}`)
      return []
    }
    const d = JSON.parse(body)
    // Twitter135 search response - try multiple response shapes
    const instructions = d?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions
      || d?.data?.timeline?.instructions
      || d?.timeline?.instructions
      || []
    const tweets = instructions
      .flatMap((i:any) => i.entries || i.addEntries?.entries || [])
      .filter((e:any) => e?.content?.itemContent?.tweet_results?.result || e?.content?.content?.tweet_results?.result)
      .map((e:any) => e.content?.itemContent?.tweet_results?.result || e.content?.content?.tweet_results?.result)
    console.log(`[TwitterRapid] "${kw}": ${tweets.length} tweets (raw keys: ${Object.keys(d).join(',')})`)
    return tweets.slice(0,20).map((t:any) => {
      const legacy = t?.legacy || t?.tweet?.legacy || {}
      const user = t?.core?.user_results?.result?.legacy || t?.user?.legacy || {}
      return {
        id: `twrapid-${legacy.id_str || Math.random().toString(36).slice(2,10)}`,
        title: (legacy.full_text || legacy.text || '').slice(0, 220),
        link: user.screen_name && legacy.id_str ? `https://twitter.com/${user.screen_name}/status/${legacy.id_str}` : '',
        source: `@${user.screen_name || 'twitter'}`,
        pubDate: legacy.created_at ? new Date(legacy.created_at).toISOString() : new Date().toISOString(),
        platform: 'twitter', body: legacy.full_text || '',
        engagement: (legacy.favorite_count || 0) + (legacy.retweet_count || 0),
      }
    }).filter((t:any) => t.title)
  } catch(e:any) { console.warn(`[TwitterRapid] ${kw}:`, e.message); return [] }
}

// ─── RapidAPI: TwttrAPI — search tweets ──────────────────────────────────────
async function fetchTwttrAPI(kw) {
  if (!RAPIDAPI_KEY) return []
  try {
    const q = encodeURIComponent(kw + ' india')
    // TwttrAPI search endpoint (verified from their docs)
    const url = `https://twttrapi.p.rapidapi.com/search-tweets?query=${q}`
    console.log(`[TwttrAPI] fetching: ${url.slice(0,80)}`)
    const r = await fetch(url, {
      headers: { 'x-rapidapi-host': 'twttrapi.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY },
      signal: AbortSignal.timeout(15000),
    })
    const body = await r.text()
    if (!r.ok) {
      console.warn(`[TwttrAPI] ${kw} HTTP ${r.status}: ${body.slice(0,200)}`)
      return []
    }
    const d = JSON.parse(body)
    // Try multiple response shapes
    const entries = (d?.data?.search_by_raw_query?.search_timeline?.timeline?.instructions
      || d?.timeline?.instructions || [])
      .flatMap((i:any) => i.entries || [])
      .filter((e:any) => e?.content?.itemContent?.tweet_results?.result)
    const tweets = entries.map((e:any) => e.content.itemContent.tweet_results.result)
    console.log(`[TwttrAPI] "${kw}": ${tweets.length} tweets (keys: ${Object.keys(d).join(',')})`)
    return tweets.slice(0,15).map((t:any) => {
      const legacy = t?.legacy || {}
      const user = t?.core?.user_results?.result?.legacy || {}
      return {
        id: `twttr-${legacy.id_str || Math.random().toString(36).slice(2,10)}`,
        title: (legacy.full_text || '').slice(0, 220),
        link: user.screen_name ? `https://twitter.com/${user.screen_name}/status/${legacy.id_str}` : '',
        source: `@${user.screen_name || 'twitter'}`,
        pubDate: legacy.created_at ? new Date(legacy.created_at).toISOString() : new Date().toISOString(),
        platform: 'twitter', body: legacy.full_text || '',
        engagement: (legacy.favorite_count || 0) + (legacy.retweet_count || 0),
      }
    }).filter((t:any) => t.title)
  } catch(e:any) { console.warn(`[TwttrAPI] ${kw}:`, e.message); return [] }
}

// ─── RapidAPI: Instagram — hashtag + profile search ──────────────────────────
async function fetchInstagramRapid(kw) {
  if (!RAPIDAPI_KEY) return []
  try {
    // Instagram120: POST /api/instagram/posts needs a username
    // Better: use the 'get' endpoint with a political hashtag
    const tag = kw.toLowerCase().replace(/[^a-z0-9]/g, '')
    // Try hashtag endpoint first
    // Instagram120: use the proper hashtag endpoint format
    const url = `https://instagram120.p.rapidapi.com/api/instagram/hashtag?hashtag=${tag}&maxId=`
    console.log(`[Instagram] fetching tag: ${tag}`)
    const r = await fetch(url, {
      headers: { 'x-rapidapi-host': 'instagram120.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY },
      signal: AbortSignal.timeout(15000),
    })
    const body = await r.text()
    if (!r.ok) {
      console.warn(`[Instagram] ${kw} HTTP ${r.status}: ${body.slice(0,200)}`)
      return []
    }
    const d = JSON.parse(body)
    console.log(`[Instagram] response keys: ${Object.keys(d).join(',')}`)
    // Try different response shapes
    const posts = d?.data || d?.posts || d?.items 
      || d?.hashtag?.edge_hashtag_to_media?.edges?.map((e:any) => e.node)
      || []
    console.log(`[Instagram] #${tag}: ${posts.length} posts`)
    return posts.slice(0,15).map((p:any) => ({
      id: `ig-${p.id || p.shortcode || Math.random().toString(36).slice(2,10)}`,
      title: ((p.edge_media_to_caption?.edges?.[0]?.node?.text || p.caption || p.text || `#${tag} post`)).slice(0, 220),
      link: p.shortcode ? `https://www.instagram.com/p/${p.shortcode}/` : (p.link || ''),
      source: `@${p.owner?.username || p.username || 'instagram'}`,
      pubDate: p.taken_at_timestamp ? new Date(p.taken_at_timestamp * 1000).toISOString() : new Date().toISOString(),
      platform: 'instagram', body: (p.caption || '').slice(0, 500),
      engagement: (p.edge_liked_by?.count || p.like_count || 0),
    })).filter((p:any) => p.title && p.title !== `#${tag} post`)
  } catch(e:any) { console.warn(`[Instagram] ${kw}:`, e.message); return [] }
}

// ─── RapidAPI: Facebook Scraper — public post search ─────────────────────────
async function fetchFacebookRapid(kw) {
  if (!RAPIDAPI_KEY) return []
  try {
    const url = `https://facebook-scraper3.p.rapidapi.com/search/posts?query=${encodeURIComponent(kw + ' india')}`
    console.log(`[Facebook] fetching: ${url.slice(0,80)}`)
    const r = await fetch(url, {
      headers: { 'x-rapidapi-host': 'facebook-scraper3.p.rapidapi.com', 'x-rapidapi-key': RAPIDAPI_KEY },
      signal: AbortSignal.timeout(15000),
    })
    const body = await r.text()
    if (!r.ok) {
      console.warn(`[Facebook] ${kw} HTTP ${r.status}: ${body.slice(0,200)}`)
      return []
    }
    const d = JSON.parse(body)
    const posts = d?.data || d?.posts || d?.results || []
    console.log(`[Facebook] "${kw}": ${posts.length} posts (keys: ${Object.keys(d).join(',')})`)
    return posts.slice(0,15).map((p:any) => ({
      id: `fb-${p.post_id || p.id || Math.random().toString(36).slice(2,10)}`,
      title: (p.post_text || p.message || p.story || p.text || '').slice(0, 220),
      link: p.post_url || p.url || p.link || '',
      source: p.page_name || p.page || p.from?.name || 'Facebook',
      pubDate: p.time ? new Date(p.time * 1000).toISOString() : (p.created_time ? new Date(p.created_time).toISOString() : new Date().toISOString()),
      platform: 'facebook', body: (p.post_text || p.message || '').slice(0, 500),
      engagement: (p.likes || p.reactions || 0) + (p.comments || 0),
    })).filter((p:any) => p.title)
  } catch(e:any) { console.warn(`[Facebook] ${kw}:`, e.message); return [] }
}

// ─── Gemini sentiment scoring ─────────────────────────────────────────────────
async function geminiSentiment(text) {
  if (!GEMINI_KEY) return null
  try {
    const prompt = 'Indian political news analyst. Rate this for a politician war room.\nReply ONLY with valid JSON, no markdown: {"bucket":"red|yellow|blue|silver","sentiment":"positive|negative|neutral","tone":-5}\nred=crisis/attack on politician, yellow=opposition threat/developing, blue=positive achievement, silver=neutral/routine\nDetect SARCASM: ironic praise = bucket yellow sentiment negative.\nNews: ' + text.slice(0, 400)
    const r = await fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY, {
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
  
  // GET ?test=twitter → tests active Twitter-content sources
  const url = new URL(req.url)
  if (url.pathname.endsWith('/test-twitter') || url.searchParams.get('test') === 'twitter') {
    try {
      const [gdeltTweets, bskyPosts, gdeltFull] = await Promise.all([
        fetchGDELTTwitter('Modi india'),
        fetchBluesky('Modi india'),
        fetchGDELTFullText('Narendra Modi'),
      ])
      const total = gdeltTweets.length + bskyPosts.length + gdeltFull.length
      return new Response(JSON.stringify({
        ok: total > 0,
        sources: {
          gdelt_twitter: gdeltTweets.length,
          bluesky: bskyPosts.length,
          gdelt_fulltext: gdeltFull.length,
          newsapi: NEWSAPI_KEY ? 'key set - will run on real ingest' : 'NO KEY - set NEWSAPI_KEY in Supabase secrets',
        },
        total_items: total,
        sample: (gdeltTweets[0] || bskyPosts[0] || gdeltFull[0])?.title?.slice(0, 80) || null,
        note: 'Twitter API v2 disabled (Pay Per Use 402). CSE deprecated. Using GDELT + Bluesky + NewsAPI.',
      }), { headers: CORS })
    } catch(e: any) {
      return new Response(JSON.stringify({ ok: false, error: e.message }), { headers: CORS })
    }
  }
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
      // NewsData: capped at 2 keywords (200 req/day free tier)
      ...kws.slice(0,2).map(kw => fetchNewsData(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // YouTube
      // YouTube: capped at 1 keyword (100 units each, 10k daily limit burns fast)
      ...kws.slice(0,1).map(kw => fetchYouTube(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Reddit
      ...kws.slice(0,3).map(kw => fetchReddit(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Twitter/X content via GDELT social media indexing
      ...kws.slice(0,4).map(kw => fetchGDELTTwitter(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Bluesky - completely free, open API, no key needed
      ...kws.slice(0,5).map(kw => fetchBluesky(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Google CSE REMOVED (deprecated). NewsAPI full-text body search replaces it.
      // NewsAPI: searches full article body — catches mentions not in headline
      fetchNewsAPIFullText(politicianName || keywords[0], keywords[0]).then(items => allRaw.push(...items.map(i=>({...i,keyword:keywords[0]})))),
      // GDELT full-text: politician name searched across full article text
      fetchGDELTFullText(politicianName || keywords[0]).then(items => allRaw.push(...items.map(i=>({...i,keyword:keywords[0]})))),
      // RapidAPI: Twitter135 search (primary Twitter source)
      ...kws.slice(0,4).map(kw => fetchTwitterRapid(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // RapidAPI: TwttrAPI (backup Twitter source, different data format)
      ...kws.slice(0,3).map(kw => fetchTwttrAPI(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // RapidAPI: Instagram hashtag search
      ...kws.slice(0,3).map(kw => fetchInstagramRapid(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // RapidAPI: Facebook public post search
      ...kws.slice(0,3).map(kw => fetchFacebookRapid(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Twitter API v2 DISABLED — Pay Per Use account causes 402. Re-enable when plan switched to Free.
      // ...kws.slice(0,3).map(kw => fetchTwitterV2(kw).then(items => allRaw.push(...items.map(i=>({...i,keyword:kw}))))),
      // Nitter discontinued May 2026 — removed
      // Bluesky watchlist handles (from body.watchlistHandles)
      ...(body.watchlistHandles||[]).filter(h=>h.includes('bsky')||h.includes('bsky.social')).slice(0,10).map(h => fetchBlueskyUser(h).then(items => allRaw.push(...items.map(i=>({...i,keyword:kws[0]||''})))))
    ])

    console.log(`[bm-ingest-v2] Total raw: ${allRaw.length}`)

    // Log platform breakdown before dedup
    const platformCount = allRaw.reduce((m,i) => { m[i.platform||'unknown']=(m[i.platform||'unknown']||0)+1; return m }, {})
    console.log('[bm-ingest-v2] Platform breakdown before dedup:', JSON.stringify(platformCount))

    // Sort: social items first (twitter/instagram/facebook/reddit), news last
    // This ensures social items are processed before the slice limit cuts off news
    const SOCIAL_PLATFORMS = ['twitter','instagram','facebook','reddit']
    allRaw.sort((a, b) => {
      const aIsSocial = SOCIAL_PLATFORMS.includes(a.platform || '')
      const bIsSocial = SOCIAL_PLATFORMS.includes(b.platform || '')
      if (aIsSocial && !bIsSocial) return -1
      if (!aIsSocial && bIsSocial) return 1
      return 0
    })

    // Dedup by URL or ID — generate stable ID if missing
    const seen = new Set()
    const deduped = allRaw.map(i => {
      // Generate stable ID from content if missing
      if (!i.id && !i.link) {
        const hash = (i.title || '').slice(0,30).replace(/[^a-z0-9]/gi,'').toLowerCase()
        i.id = `gen-${i.platform||'x'}-${hash}-${(i.pubDate||'').slice(0,10)}`
      }
      return i
    }).filter(i => {
      const k = i.link || i.id
      if (!k) return false
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    
    // Log after dedup
    const dedupPlatform = deduped.reduce((m,i) => { m[i.platform||'unknown']=(m[i.platform||'unknown']||0)+1; return m }, {})
    console.log(`[bm-ingest-v2] After dedup: ${deduped.length}`, JSON.stringify(dedupPlatform))

    const now = new Date().toISOString()
    const rows = []
    // Increase limit to capture social + news (was maxPerSource * kws, now 300 hard cap)
    for (const item of deduped.slice(0, Math.max(300, maxPerSource * kws.length))) {
      const text = `${item.title||''} ${item.body||''}`
      const kw   = kwScore(text)
      const ai   = GEMINI_KEY ? await geminiSentiment(text) : null
      rows.push({
        national_mode: nationalMode,
        id:          item.id || (() => {
          // Stable ID from content - same item always gets same ID
          const raw = `${item.source||''}-${(item.title||'').slice(0,40)}-${(item.pubDate||'').slice(0,10)}`
          let hash = 0
          for (let i = 0; i < raw.length; i++) { hash = ((hash << 5) - hash) + raw.charCodeAt(i); hash |= 0 }
          return `${item.platform||'n'}-${Math.abs(hash).toString(36)}-${(item.pubDate||'').slice(5,10).replace('-','')}`
        })(),
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
    const { error } = await db.from('bm_feed').upsert(rows, { onConflict: 'id', ignoreDuplicates: true })
    if (error) {
      console.error('[bm-ingest-v2] DB error:', error.message, error.code)
      return new Response(JSON.stringify({ ok: false, error: error.message, code: error.code }), { status: 500, headers: CORS })
    }
    
    // Log platform breakdown of what was saved
    const savedPlatforms = rows.reduce((m:any, r:any) => { m[r.platform]=(m[r.platform]||0)+1; return m }, {})
    console.log('[bm-ingest-v2] Saved platform breakdown:', JSON.stringify(savedPlatforms))

    const crisisRows = rows.filter(r=>r.bucket==='red')
    if (crisisRows.length) {
      await db.from('crisis_alerts').upsert(crisisRows.map(r=>({ id:`ca-${r.id}`, account_id:accountId, feed_item_id:r.id, headline:r.headline, source:r.source, severity:'high', created_at:now })), { onConflict:'id', ignoreDuplicates:true })
    }

    const byPlatform = rows.reduce((a,r)=>{ a[r.platform]=(a[r.platform]||0)+1; return a }, {})
    // ── Trigger alerts for crisis items ────────────────────────────────────────
    if (crisisRows.length > 0) {
      try {
        // Fire and forget — don't wait for alerts, don't block ingest response
        fetch(`${SUPABASE_URL}/functions/v1/bm-alerts`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${SUPABASE_KEY}`,
            'apikey': SUPABASE_KEY,
          },
          body: JSON.stringify({
            accountId,
            items: crisisRows.slice(0, 5).map(r => ({ headline: r.headline, source: r.source, published_at: r.published_at, url: r.url })),
            bucket: 'red',
          }),
        }).then(r => r.json()).then(d => console.log('[bm-ingest-v2] Alerts triggered:', JSON.stringify(d.sent))).catch(e => console.warn('[bm-ingest-v2] Alert trigger error:', e.message))
      } catch (e: any) { console.warn('[bm-ingest-v2] Alert trigger failed:', e.message) }
    }

    console.log(`[bm-ingest-v2] DONE inserted=${rows.length} crisis=${crisisRows.length} ai=${!!GEMINI_KEY}`, byPlatform)
    return new Response(JSON.stringify({ ok:true, inserted:rows.length, crisis:crisisRows.length, ai_used:!!GEMINI_KEY, sources:byPlatform }), { headers: CORS })

  } catch(e) {
    console.error('[bm-ingest-v2] Unhandled:', e.message)
    return new Response(JSON.stringify({ ok:false, error:e.message }), { status:500, headers:CORS })
  }
})
