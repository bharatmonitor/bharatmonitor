# Ingest patch — capture article bodies (#5)

Problem: analysis already scores `title + body`, but Google News RSS, GDELT and
direct Indian RSS store `body: ''`, so quote-only mentions are mis-analysed or
dropped. These three edits to `supabase/functions/bm-ingest-v2/index.ts` capture
the RSS body and stop the headline-only filter from discarding body mentions.

## 1. `parseRSS` — capture description / content

```ts
// BEFORE: only title/link/pubDate/source were extracted.
// AFTER: also pull description + content:encoded as body (HTML stripped).
function parseRSS(xml) {
  const items = []
  const rx = /<item>([\s\S]*?)<\/item>/g
  let m
  while ((m = rx.exec(xml)) !== null) {
    const b = m[1]
    const get = tag => { const r = new RegExp(`<${tag}[^>]*>(?:<!\\[CDATA\\[)?([\\s\\S]*?)(?:\\]\\]>)?<\\/${tag}>`); const mm = r.exec(b); return (mm?.[1]??'').trim().replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"') }
    const title = get('title'), link = get('link') || get('guid')
    // NEW: description / content:encoded, HTML tags removed, capped at 600 chars
    const rawBody = get('content:encoded') || get('description') || ''
    const body = rawBody.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 600)
    if (title && link) items.push({ title, link, pubDate: get('pubDate'), source: get('source').replace(/<[^>]+>/g,'') || 'RSS', body })
  }
  return items
}
```

## 2. `fetchGoogleNewsRSS` — keep the body parseRSS now returns

```ts
// In the return: items.slice(0,12) already carry `body` from parseRSS.
// No change needed beyond #1 — but make sure you DON'T overwrite body:'' when
// mapping. In index.ts line ~649 the map spreads {...i}, so body survives. Good.
```

## 3. `fetchIndianRSS` — use body + relax the headline-only filter

```ts
// BEFORE: .filter(i => i.title.toLowerCase().includes(kw) || i.title... includes('india'))
//         ... results.push({ ..., body: '' })
// AFTER: match on title OR body, and keep the captured body.
const items = parseRSS(await r.text())
  .filter(i => {
    const hay = `${i.title} ${i.body || ''}`.toLowerCase()
    return hay.includes(kw.toLowerCase()) || hay.includes('india')
  })
  .slice(0, 4)
for (const i of items) {
  results.push({
    id: `inrss-${feed.name.replace(/\s/g,'')}-${(i.link||'').slice(-20).replace(/[^a-z0-9]/gi,'')||Date.now().toString(36)}`,
    title: i.title, link: i.link, source: feed.name, pubDate: i.pubDate,
    platform: 'news', body: i.body || ''          // <-- was '' , now the real summary
  })
}
```

## 4. (Optional) true full-text for top items

Google News descriptions are short. For real article bodies, fetch the page for
the top few items only (latency + some sites block bots, so keep it small):

```ts
async function fetchArticleBody(url) {
  try {
    const r = await fetch(url, { headers: { 'User-Agent': 'BharatMonitor/3.0' }, signal: AbortSignal.timeout(7000) })
    if (!r.ok) return ''
    const html = await r.text()
    const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/g)].map(p => p[1].replace(/<[^>]+>/g,' ').trim())
    return paras.join(' ').replace(/\s+/g,' ').trim().slice(0, 1200)
  } catch { return '' }
}
// Use sparingly, e.g. only for the first ~10 news items missing a body, behind a
// `deepFetch` flag — N network calls add latency to the edge function.
```

GDELT stays body-empty unless you run #4 against its URLs; flag it as a later
enhancement if GDELT volume matters.
