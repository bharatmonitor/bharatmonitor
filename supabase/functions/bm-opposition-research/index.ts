// supabase/functions/bm-opposition-research/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// BharatMonitor — Opposition Research Terminal
//
// Takes a politician name + topic query.
// Searches NewsAPI (full-text body) + GDELT (full-text indexed) for statements.
// Runs Gemini contradiction/flip-flop analysis.
// Returns structured research dossier.
//
// CHANGES FROM v1:
// - Google CSE REMOVED (deprecated "search entire web" May 2026, returned 0 results)
// - Replaced with: NewsAPI full-text + GDELT doc API + bm_feed DB search
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL  = Deno.env.get('SUPABASE_URL') ?? 'https://ylajerluygbeiqybkgtx.supabase.co'
const SUPABASE_KEY  = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMDQzOSwiZXhwIjoyMDkwMDk2NDM5fQ.zgKRPK1VrZg-q7DbuwNzxfYL_3ZfqiOU4K6YiSZySSY'
const GEMINI_KEY    = Deno.env.get('GEMINI_API_KEY') ?? ''
const NEWSAPI_KEY   = Deno.env.get('NEWSAPI_KEY') ?? '3ece78dac1ce44fb997e81b016ff012b'

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

// ─── Source 1: NewsAPI full-text search ──────────────────────────────────────
// Searches full article body — catches mentions not just in headline
async function searchNewsAPI(politician: string, topic: string): Promise<any[]> {
  if (!NEWSAPI_KEY) return []
  try {
    const query = encodeURIComponent(`"${politician}" ${topic}`)
    const url = `https://newsapi.org/v2/everything?q=${query}&language=en&sortBy=relevancy&pageSize=30&apiKey=${NEWSAPI_KEY}`
    const r = await fetch(url, { signal: AbortSignal.timeout(12000) })
    if (!r.ok) { console.warn(`[NewsAPI] HTTP ${r.status}`); return [] }
    const d = await r.json()
    const articles = (d?.articles || []).filter((a: any) => a.url && !a.url.includes('[Removed]'))
    console.log(`[NewsAPI] "${politician} × ${topic}": ${articles.length} results`)
    return articles.map((a: any) => ({
      title:     (a.title || '').replace(/\s*-\s*\w[\w\s]*$/, ''), // strip source suffix
      snippet:   a.description || a.content?.substring(0, 300) || '',
      source:    a.source?.name || a.url?.split('/')[2] || 'NewsAPI',
      url:       a.url || '',
      date:      a.publishedAt?.substring(0, 10) || '',
      sentiment: /(condemn|attack|oppose|against|reject|slam|blast|criticise|scam|corruption|failure)/i.test(a.description || '')
        ? 'negative'
        : /(support|welcome|praise|hail|laud|back|endorse|success|achieve|deliver)/i.test(a.description || '')
        ? 'positive' : 'neutral',
    }))
  } catch(e: any) { console.warn('[NewsAPI] error:', e.message); return [] }
}

// ─── Source 2: GDELT full-text document search ───────────────────────────────
// GDELT indexes full article text — searches body, not just headline
// Critical: query must be >2 words or GDELT returns "phrase too short"
async function searchGDELT(politician: string, topic: string, yearsBack: number): Promise<any[]> {
  try {
    // Build safe query — GDELT needs multi-word phrases, no site: operator
    const safeQ = `${politician} ${topic} india`
    const q = encodeURIComponent(safeQ)
    // GDELT date filter via TIMESPAN (in minutes)
    const timespan = Math.min(yearsBack * 525600, 5256000) // years to minutes, max 10yr
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=30&format=json&SOURCELANG=ENGLISH&TIMESPAN=${timespan}`
    const r = await fetch(url, { signal: AbortSignal.timeout(15000) })
    if (!r.ok) { console.warn(`[GDELT] HTTP ${r.status}`); return [] }
    const d = await r.json()
    const arts = d?.articles || []
    console.log(`[GDELT] "${politician} × ${topic}": ${arts.length} results`)
    return arts.map((a: any) => ({
      title:     a.title || '',
      snippet:   a.title || '', // GDELT doesn't return body text, title is the signal
      source:    a.domain || a.url?.split('/')[2] || 'GDELT',
      url:       a.url || '',
      date:      a.seendate
        ? a.seendate.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3')
        : '',
      sentiment: /(condemn|attack|oppose|against|reject|slam|blast|criticise|scam|corruption)/i.test(a.title || '')
        ? 'negative'
        : /(support|welcome|praise|hail|laud|back|endorse|achieve|deliver)/i.test(a.title || '')
        ? 'positive' : 'neutral',
    }))
  } catch(e: any) { console.warn('[GDELT] error:', e.message); return [] }
}

// ─── Source 3: GDELT with topic variations ───────────────────────────────────
// Runs multiple GDELT queries to get broader coverage
async function searchGDELTVariants(politician: string, topic: string): Promise<any[]> {
  const variants = [
    `${politician} ${topic} statement`,
    `${politician} ${topic} speech`,
    `${politician} ${topic} india government`,
  ]
  const allResults: any[] = []
  await Promise.allSettled(
    variants.map(v => {
      const q = encodeURIComponent(v)
      return fetch(`https://api.gdeltproject.org/api/v2/doc/doc?query=${q}&mode=artlist&maxrecords=15&format=json&SOURCELANG=ENGLISH`, {
        signal: AbortSignal.timeout(10000)
      })
      .then(r => r.ok ? r.json() : { articles: [] })
      .then(d => allResults.push(...(d?.articles || []).map((a: any) => ({
        title:   a.title || '',
        snippet: a.title || '',
        source:  a.domain || '',
        url:     a.url || '',
        date:    a.seendate?.replace(/(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z/, '$1-$2-$3') || '',
        sentiment: 'neutral',
      }))))
      .catch(() => {})
    })
  )
  return allResults
}

// ─── Gemini analysis ─────────────────────────────────────────────────────────
async function geminiAnalyze(politician: string, topic: string, statements: any[]): Promise<any> {
  if (!GEMINI_KEY || statements.length === 0) return null

  const stmtText = statements.slice(0, 20).map((s, i) =>
    `[${i + 1}] ${s.date || 'date unknown'}: "${s.snippet || s.title}" (Source: ${s.source})`
  ).join('\n')

  const prompt = `You are a political opposition research analyst in India. Analyse statements by ${politician} on "${topic}".

STATEMENTS FOUND (from NewsAPI + GDELT full-text search):
${stmtText}

Even if the statements are limited, use your knowledge of Indian politics to provide a thorough analysis.

Return ONLY a JSON object (no markdown):
{
  "summary": "<2-3 sentence overall assessment of ${politician}'s position on ${topic}>",
  "overallConsistency": <0-100, where 0=completely inconsistent, 100=perfectly consistent>,
  "contradictions": [
    {
      "title": "<brief title of the contradiction>",
      "earlier_position": "<what they said/did before>",
      "later_position": "<what they say/do now>",
      "flip_type": "complete_reversal | partial_shift | contextual_shift | promise_broken",
      "severity": "critical | high | medium | low",
      "political_context": "<why this matters politically>",
      "best_attack_angle": "<how opposition could use this>",
      "best_defense_angle": "<how supporter would explain this>"
    }
  ],
  "keyStatements": [
    {
      "quote": "<most impactful statement>",
      "date": "<approximate date>",
      "significance": "<why this is important>",
      "sentiment_toward_topic": "positive | negative | neutral"
    }
  ],
  "strategicAssessment": "<3-4 sentence political intelligence summary for a campaign team>",
  "vulnerabilityScore": <0-100, overall opposition research value>
}`

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.2, maxOutputTokens: 2500 },
        }),
        signal: AbortSignal.timeout(30_000),
      }
    )
    const d = await r.json()
    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return JSON.parse(text.replace(/```json|```/g, '').trim())
  } catch (e) {
    console.warn('[OppResearch] Gemini error:', e)
    return null
  }
}

// ─── Main handler ─────────────────────────────────────────────────────────────
Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), { headers: CORS, status: 400 })
  }

  const {
    politician,
    topic,
    accountId,
    yearsBack = 10,
    includeParliament = true,
  } = body

  if (!politician || !topic) {
    return new Response(JSON.stringify({ ok: false, error: 'politician and topic required' }), { headers: CORS, status: 400 })
  }

  console.log(`[OppResearch] ${politician} × ${topic}`)

  // Run all sources in parallel
  const [newsApiResults, gdeltResults, gdeltVariants] = await Promise.all([
    searchNewsAPI(politician, topic),
    searchGDELT(politician, topic, yearsBack),
    searchGDELTVariants(politician, topic),
  ])

  // Merge and deduplicate by URL
  const allResults = [...newsApiResults, ...gdeltResults, ...gdeltVariants]
  const seen = new Set<string>()
  const deduped = allResults.filter(r => {
    if (!r.url || seen.has(r.url)) return false
    seen.add(r.url)
    return true
  })

  // Sort by date descending
  deduped.sort((a, b) => (b.date > a.date ? 1 : -1))
  const statements = deduped.slice(0, 40)

  // Also pull from bm_feed for this account
  const { data: feedMatches = [] } = await db
    .from('bm_feed')
    .select('headline, sentiment, published_at, source, url')
    .eq('account_id', accountId)
    .or(`headline.ilike.%${politician}%,headline.ilike.%${topic}%`)
    .order('published_at', { ascending: false })
    .limit(20)

  // Add feed matches to statements if not already present
  const feedUrls = new Set(feedMatches?.map((f: any) => f.url) || [])
  const feedStatements = (feedMatches || [])
    .filter((f: any) => f.url && !seen.has(f.url))
    .map((f: any) => ({
      title:     f.headline || '',
      snippet:   f.headline || '',
      source:    f.source || 'BharatMonitor Feed',
      url:       f.url || '',
      date:      f.published_at?.substring(0, 10) || '',
      sentiment: f.sentiment || 'neutral',
    }))

  const allStatements = [...statements, ...feedStatements]

  // Gemini analysis — runs even with few statements, uses its own knowledge
  const analysis = await geminiAnalyze(politician, topic, allStatements)

  const result = {
    ok: true,
    politician,
    topic,
    searchedAt: new Date().toISOString(),
    sources_used: {
      newsapi:     newsApiResults.length,
      gdelt:       gdeltResults.length,
      gdelt_variants: gdeltVariants.length,
      bm_feed:     feedStatements.length,
    },
    totalSources: allStatements.length,
    statements:   allStatements,
    feedMatches,
    analysis,
    stats: {
      totalStatements:    allStatements.length,
      contradictionsFound: analysis?.contradictions?.length || 0,
      vulnerabilityScore:  analysis?.vulnerabilityScore || 0,
      consistencyScore:    analysis?.overallConsistency || 50,
      dateRange: allStatements.length > 0
        ? `${allStatements[allStatements.length - 1].date || '2014'} — ${allStatements[0].date || 'present'}`
        : 'No data',
    },
  }

  // Cache in Supabase for 24h
  const cacheKey = `opp-${accountId}-${politician.replace(/\s/g, '-')}-${topic.replace(/\s/g, '-')}`.substring(0, 90)
  await db.from('bm_research_cache').upsert({
    id: cacheKey,
    account_id: accountId,
    politician,
    topic,
    result_json: JSON.stringify(result),
    created_at:  new Date().toISOString(),
  }, { onConflict: 'id' }).catch(() => {})

  return new Response(JSON.stringify(result), { headers: CORS })
})
