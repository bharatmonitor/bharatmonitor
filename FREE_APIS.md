# BharatMonitor — Free API Stack

## Currently Active (no extra cost)

| API | Calls/Day | What it does | Key needed |
|-----|-----------|--------------|------------|
| Google News RSS | Unlimited | News from all Indian publications | No |
| GDELT Project | Unlimited | Global database of Indian political news | No |
| Indian Newspapers RSS | Unlimited | NDTV, TOI, Hindu, IE, PIB, ANI, HT, Aaj Tak | No |
| NewsData.io | 200/day | 200 Indian news sources, Hindi+English | Yes (free) |
| YouTube Data API | 100 searches/day | Video content, political speeches | Yes (free) |
| Reddit API | Unlimited | r/india, r/IndianPolitics, r/IndiaSpeaks | No |
| XPOZ SDK | Per plan | 30-day Twitter history | Yes (paid) |
| Google CSE | 100/day | Web search including X.com | Yes (free) |
| Gemini 1.5 Flash | 1M tokens/day | AI sentiment, contradiction check | Yes (free) |

## Easy additions (sign up + add key)

| API | Calls/Day | Sign up | Key name to add |
|-----|-----------|---------|-----------------|
| GNews.io | 100/day free | gnews.io | GNEWS_API_KEY |
| Currents API | 600/day free | currentsapi.services | CURRENTS_API_KEY |
| The News API | 100/day free | thenewsapi.com | THENEWS_API_KEY |
| MediaStack | 500/day free | mediastack.com | MEDIASTACK_KEY |
| Bing News Search | 1000/day free | azure.microsoft.com/free | BING_NEWS_KEY |

## How to add a new API

1. Sign up and get your API key
2. Add to **Supabase Vault**: Settings → Vault → New secret
3. Add to **Vercel env vars**: Settings → Environment Variables → add VITE_YOUR_KEY
4. Redeploy `bm-ingest-v2` in Supabase with the new fetch function

## Adding GNews (example — 5 minutes)

1. Go to gnews.io → sign up → copy API key
2. Add `GNEWS_API_KEY` to Supabase Vault
3. Add this function to `bm-ingest-v2/index.ts`:
```js
async function fetchGNews(kw) {
  const key = Deno.env.get('GNEWS_API_KEY') ?? ''
  if (!key) return []
  const r = await fetch(`https://gnews.io/api/v4/search?q=${encodeURIComponent(kw)}&country=in&lang=en&max=10&apikey=${key}`)
  const d = await r.json()
  return (d.articles||[]).map(a => ({ id:`gnews-${btoa(a.url).slice(0,16)}`, title:a.title, link:a.url, source:a.source.name, pubDate:a.publishedAt, platform:'news', body:a.description||'' }))
}
```
4. Add `fetchGNews(kw)` to the `Promise.allSettled` array in the main handler
