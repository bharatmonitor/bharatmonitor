// supabase/functions/bm-opposition-research/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// BharatMonitor — Opposition Research Terminal
//
// Takes a politician name + topic query.
// Searches Google CSE for historical statements (2014–present).
// Clusters statements by sub-topic.
// Runs Gemini contradiction/flip-flop analysis.
// Returns structured research dossier.
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://ylajerluygbeiqybkgtx.supabase.co'
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMDQzOSwiZXhwIjoyMDkwMDk2NDM5fQ.zgKRPK1VrZg-q7DbuwNzxfYL_3ZfqiOU4K6YiSZySSY'
const GEMINI_KEY  = Deno.env.get('GEMINI_API_KEY') ?? ''
const CSE_KEY     = Deno.env.get('GOOGLE_CSE_KEY') ?? 'AIzaSyCSp3sFwrckph-b0nNeZw4Iy04xjAzBRBY'
const CSE_CX      = Deno.env.get('GOOGLE_CSE_CX')  ?? 'c6115d16294f64f6a'

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

// Trusted Indian political news sources for CSE restriction
const TRUSTED_SOURCES = [
  'site:ndtv.com', 'site:thehindu.com', 'site:indianexpress.com',
  'site:timesofindia.com', 'site:hindustantimes.com', 'site:thewire.in',
  'site:scroll.in', 'site:theprint.in', 'site:livemint.com',
  'site:business-standard.com', 'site:news18.com', 'site:aninews.in',
  'site:pib.gov.in', 'site:sansad.in', 'site:rajyasabha.nic.in',
]

async function searchCSE(query: string, dateRestrict?: string): Promise<any[]> {
  if (!CSE_KEY || !CSE_CX) return []
  try {
    const params = new URLSearchParams({
      key: CSE_KEY, cx: CSE_CX, q: query, num: '10',
    })
    if (dateRestrict) params.set('dateRestrict', dateRestrict)
    const r = await fetch(`https://www.googleapis.com/customsearch/v1?${params}`, {
      signal: AbortSignal.timeout(10_000),
    })
    const d = await r.json()
    return d.items || []
  } catch { return [] }
}

async function geminiAnalyze(politician: string, topic: string, statements: any[]): Promise<any> {
  if (!GEMINI_KEY || statements.length === 0) return null

  const stmtText = statements.slice(0, 15).map((s, i) =>
    `[${i + 1}] ${s.date || 'date unknown'}: "${s.snippet}" (Source: ${s.source})`
  ).join('\n')

  const prompt = `You are a political opposition research analyst in India. Analyse statements by ${politician} on "${topic}".

STATEMENTS FOUND:
${stmtText}

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
          generationConfig: { temperature: 0.2, maxOutputTokens: 2000 },
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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  let body: any
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), { headers: CORS, status: 400 })
  }

  const {
    politician,          // e.g. "Rahul Gandhi"
    topic,               // e.g. "privatisation" or "farmers protest"
    accountId,
    yearsBack = 10,      // how far back to search
    includeParliament = true,
  } = body

  if (!politician || !topic) {
    return new Response(JSON.stringify({ ok: false, error: 'politician and topic required' }), { headers: CORS, status: 400 })
  }

  console.log(`[OppResearch] ${politician} × ${topic}`)

  // Run multiple search queries in parallel for comprehensive coverage
  const searchQueries = [
    `"${politician}" "${topic}"`,
    `"${politician}" "${topic}" statement`,
    `"${politician}" "${topic}" speech`,
    `"${politician}" "${topic}" interview`,
    `"${politician}" "${topic}" tweet`,
    ...(includeParliament ? [
      `"${politician}" "${topic}" parliament`,
      `"${politician}" "${topic}" lok sabha`,
      `"${politician}" "${topic}" rajya sabha`,
    ] : []),
  ]

  const dateRestricts = [`y${yearsBack}`, 'y5', 'y2', 'm6'] // graduated time windows

  const allResults: any[] = []

  await Promise.allSettled([
    ...searchQueries.slice(0, 4).map(q => searchCSE(q).then(r => allResults.push(...r))),
    ...dateRestricts.map(dr => searchCSE(`"${politician}" "${topic}"`, dr).then(r => allResults.push(...r))),
  ])

  // Deduplicate by URL
  const seen = new Set<string>()
  const deduped = allResults.filter(r => {
    if (!r.link || seen.has(r.link)) return false
    seen.add(r.link)
    return true
  })

  // Extract date from result
  function extractDate(item: any): string {
    return item.pagemap?.metatags?.[0]?.['article:published_time']?.substring(0, 10)
      || item.pagemap?.metatags?.[0]?.['og:updated_time']?.substring(0, 10)
      || ''
  }

  // Build statements array
  const statements = deduped.slice(0, 30).map(item => ({
    title:   item.title || '',
    snippet: item.snippet || '',
    source:  item.displayLink || item.link?.split('/')[2] || 'unknown',
    url:     item.link || '',
    date:    extractDate(item),
    // Rough sentiment from snippet
    sentiment: /(condemn|attack|oppose|against|reject|slam|blast|criticise)/i.test(item.snippet)
      ? 'negative'
      : /(support|welcome|praise|hail|laud|back|endorse)/i.test(item.snippet)
      ? 'positive' : 'neutral',
  }))

  // Sort by date desc
  statements.sort((a, b) => (b.date > a.date ? 1 : -1))

  // AI deep analysis
  const analysis = await geminiAnalyze(politician, topic, statements)

  // Also check bm_feed for any relevant existing items
  const { data: feedMatches = [] } = await db
    .from('bm_feed')
    .select('headline, sentiment, published_at, source, url')
    .eq('account_id', accountId)
    .ilike('headline', `%${politician}%`)
    .order('published_at', { ascending: false })
    .limit(20)

  const result = {
    ok: true,
    politician,
    topic,
    searchedAt: new Date().toISOString(),
    totalSources: statements.length,
    statements,
    feedMatches,
    analysis,
    // Quick stats for UI
    stats: {
      totalStatements: statements.length,
      contradictionsFound: analysis?.contradictions?.length || 0,
      vulnerabilityScore: analysis?.vulnerabilityScore || 0,
      consistencyScore: analysis?.overallConsistency || 50,
      dateRange: statements.length > 0
        ? `${statements[statements.length - 1].date || '2014'} — ${statements[0].date || 'present'}`
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
    created_at: new Date().toISOString(),
  }, { onConflict: 'id' }).catch(() => {}) // table may not exist yet — fail silently

  return new Response(JSON.stringify(result), { headers: CORS })
})
