// BharatMonitor — Intelligence Report Generator
// Clusters feed items into topic groups using Gemini AI

const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://ylajerluygbeiqybkgtx.supabase.co'
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMDQzOSwiZXhwIjoyMDkwMDk2NDM5fQ.zgKRPK1VrZg-q7DbuwNzxfYL_3ZfqiOU4K6YiSZySSY'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

async function callGemini(prompt: string, maxTokens = 3000): Promise<string> {
  const r = await fetch(
    'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=' + GEMINI_KEY,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: maxTokens },
      }),
      signal: AbortSignal.timeout(55000),
    }
  )
  if (!r.ok) throw new Error('Gemini ' + r.status + ': ' + await r.text().catch(() => ''))
  const d = await r.json()
  return d?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
}

function extractJSON(text: string): any {
  const cleaned = text.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  const objMatch = cleaned.match(/\{[\s\S]*\}/)
  const arrMatch = cleaned.match(/\[[\s\S]*\]/)
  try {
    if (objMatch) return JSON.parse(objMatch[0])
    if (arrMatch) return JSON.parse(arrMatch[0])
  } catch {}
  return null
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { accountId, dateFrom, dateTo, maxItems = 150, nationalMode = false } = await req.json()
    if (!accountId) return new Response(JSON.stringify({ error: 'Missing accountId' }), { status: 400, headers: CORS })
    if (!GEMINI_KEY) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured in Vault' }), { status: 500, headers: CORS })

    const { createClient } = await import('https://esm.sh/@supabase/supabase-js@2')
    const db = createClient(SUPABASE_URL, SUPABASE_KEY)

    // Fetch items
    let q = db.from('bm_feed')
      .select('id,headline,source,platform,sentiment,bucket,published_at,url,keyword,geo_tags,topic_tags,national_mode')
      .eq('account_id', accountId)
      .order('published_at', { ascending: false })
      .limit(maxItems)
    // In national mode: filter to national discourse items only
    if (nationalMode) q = q.eq('national_mode', true)
    if (dateFrom) q = q.gte('published_at', dateFrom)
    if (dateTo)   q = q.lte('published_at', dateTo)

    const { data: items, error } = await q
    if (error) return new Response(JSON.stringify({ error: error.message }), { status: 500, headers: CORS })
    if (!items?.length) return new Response(JSON.stringify({ error: 'No items found for this account and date range', topics: [], conclusions: [] }), { headers: CORS })

    const total = items.length
    const fromDate = dateFrom || items[items.length - 1]?.published_at?.substring(0, 10) || 'N/A'
    const toDate   = dateTo   || items[0]?.published_at?.substring(0, 10) || 'N/A'

    console.log('[intelligence] Processing', total, 'items for', accountId)

    // Step 1: Cluster headlines into topics
    const headlines = items.slice(0, 120).map((it: any, i: number) =>
      i + '|' + (it.sentiment || 'neutral').toUpperCase() + '|' + (it.source || 'unknown') + '|' + it.headline
    ).join('\n')

    const clusterPrompt = 'You are an expert Indian political intelligence analyst.\n\n' +
      'Cluster these ' + total + ' news items into 8-12 topic groups.\n' +
      'Format: INDEX|SENTIMENT|SOURCE|HEADLINE\n\n' +
      headlines + '\n\n' +
      'For each topic cluster, identify:\n' +
      '1. A clear topic title (concise, like a newspaper headline)\n' +
      '2. Item indices belonging to this topic\n' +
      '3. Positive vs negative item counts\n' +
      '4. Top 5 sources for positive framing (name + count)\n' +
      '5. Top 5 sources for negative framing (name + count)\n' +
      '6. 4-6 specific factual bullet points summarising the narrative\n\n' +
      'Reply with ONLY this JSON structure, no markdown:\n' +
      '{"topics":[{"title":"string","indices":[0,1,2],"positiveCount":5,"negativeCount":15,' +
      '"topPositiveSources":[{"name":"source","count":3}],' +
      '"topNegativeSources":[{"name":"source","count":8}],' +
      '"narrativePoints":["point1","point2"]}]}'

    const clusterRaw = await callGemini(clusterPrompt, 4000)
    const clustered = extractJSON(clusterRaw)

    if (!clustered?.topics?.length) {
      console.error('[intelligence] Clustering failed. Raw:', clusterRaw.slice(0, 300))
      return new Response(JSON.stringify({ error: 'AI clustering failed — check GEMINI_API_KEY in Vault' }), { status: 500, headers: CORS })
    }

    // Step 2: Strategic conclusions
    const topicLines = clustered.topics
      .map((t: any) => t.title + ': ' + (t.positiveCount || 0) + ' pos, ' + (t.negativeCount || 0) + ' neg')
      .join('\n')

    const conclusionsPrompt = 'You are a senior Indian political strategist writing for a ruling party war room.\n\n' +
      'Social media intelligence data from ' + fromDate + ' to ' + toDate + ':\n' + topicLines + '\n\n' +
      'Write exactly 5 strategic conclusions. Each needs:\n' +
      '- TITLE: 4-6 word headline in CAPS\n' +
      '- body: 3-4 sentence strategic analysis (specific, actionable, not generic)\n\n' +
      'Focus on: dominant narratives, institutional trust erosion, economic anxieties, ' +
      'federalism tensions, information control battles.\n\n' +
      'Reply with ONLY this JSON, no markdown:\n' +
      '{"conclusions":[{"title":"CAPS TITLE","body":"paragraph text"}]}'

    const conclusionsRaw = await callGemini(conclusionsPrompt, 1500)
    const conclusionsData = extractJSON(conclusionsRaw)

    // Enrich topics with actual item data
    const enrichedTopics = clustered.topics.map((t: any) => {
      const idxList: number[] = (t.indices || []).filter((i: number) => i >= 0 && i < items.length)
      const topicItems = idxList.map((i: number) => items[i]).filter(Boolean)
      const postCount = topicItems.length || (t.positiveCount || 0) + (t.negativeCount || 0)

      return {
        title:             t.title || 'Unnamed Topic',
        postCount,
        percentage:        +((postCount / total) * 100).toFixed(1),
        positiveCount:     t.positiveCount || 0,
        negativeCount:     t.negativeCount || 0,
        topPositiveSources: (t.topPositiveSources || []).slice(0, 5),
        topNegativeSources: (t.topNegativeSources || []).slice(0, 5),
        narrativePoints:   t.narrativePoints || [],
        sampleItems:       topicItems.slice(0, 10).map((it: any) => ({
          headline: it.headline, source: it.source, platform: it.platform,
          sentiment: it.sentiment, url: it.url || '', published_at: it.published_at,
        })),
      }
    }).sort((a: any, b: any) => b.postCount - a.postCount)

    const result = {
      accountId,
      generatedAt:  new Date().toISOString(),
      dateRange:    { from: fromDate, to: toDate },
      totalPosts:   total,
      topicCount:   enrichedTopics.length,
      topics:       enrichedTopics,
      conclusions:  conclusionsData?.conclusions || [],
    }

    console.log('[intelligence] Done:', enrichedTopics.length, 'topics')
    return new Response(JSON.stringify(result), { headers: CORS })

  } catch (e: any) {
    console.error('[intelligence] Fatal:', e.message)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS })
  }
})
