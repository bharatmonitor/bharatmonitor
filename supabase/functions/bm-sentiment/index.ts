// ============================================================
// BharatMonitor — AI Sentiment Edge Function
// Runtime: Deno (Supabase Edge Functions)
//
// Called by: src/lib/sentiment.ts → scoreSentimentBatch()
//
// POST /functions/v1/bm-sentiment
//   Body: { texts: string[] }
//   Returns: { items: SentimentItem[] }
//
// Uses Claude haiku for speed + cost efficiency.
// Falls back to keyword scoring if API unavailable.
// ============================================================

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const GEO_TERMS = [
  'Delhi','Mumbai','Chennai','Kolkata','Hyderabad','Bengaluru','Ahmedabad',
  'Pune','Jaipur','Lucknow','Patna','Bhopal','Varanasi','Ayodhya','Surat',
  'UP','Bihar','Rajasthan','Maharashtra','Gujarat','Karnataka','Tamil Nadu',
  'Telangana','Andhra','Kerala','West Bengal','Odisha','Assam','Punjab',
  'Haryana','Jharkhand','Chhattisgarh','Uttarakhand','India','Bharat',
]

function keywordFallback(text: string) {
  const lower = text.toLowerCase()
  const NEG = ['scam','scandal','corruption','fraud','arrest','protest','riot','attack','exposed','resign','fake','crisis','blast','terror','dead','killed']
  const POS = ['launched','inaugurated','achieved','success','milestone','growth','development','welfare','award','historic','breakthrough','praised']
  const CRISIS = ['riot','flood','earthquake','bomb','blast','terror','dead','killed','murder','rape','fire','emergency']
  const OPP = ['congress','aap','rahul','kejriwal','owaisi','mamata','opposition','indi alliance']

  let score = 0
  for (const w of POS)    if (lower.includes(w)) score += 0.3
  for (const w of NEG)    if (lower.includes(w)) score -= 0.3
  for (const w of CRISIS) if (lower.includes(w)) score -= 0.6
  score = Math.max(-1, Math.min(1, score))

  const isCrisis = CRISIS.some(k => lower.includes(k))
  const isOpp    = OPP.some(k => lower.includes(k)) && score < 0
  const topics: string[] = []
  if (isCrisis) topics.push('Crisis')
  if (score > 0.3) topics.push('Achievement')
  if (lower.includes('scheme')) topics.push('Scheme')
  if (lower.includes('election')) topics.push('Election')
  if (isOpp) topics.push('Opposition Attack')

  return {
    sentiment: score > 0.15 ? 'positive' : score < -0.15 ? 'negative' : 'neutral',
    score,
    urgency: isCrisis || score < -0.5 ? 'high' : isOpp || score < -0.2 ? 'medium' : 'low',
    topics,
    geoTags: GEO_TERMS.filter(g => lower.includes(g.toLowerCase())),
    entities: [] as string[],
    summary: text.substring(0, 100),
    oppRisk: Math.round(Math.min(100, OPP.filter(k => lower.includes(k)).length * 20 + (score < 0 ? Math.abs(score) * 40 : 0))),
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json',
  }

  try {
    const { texts }: { texts: string[] } = await req.json()
    if (!texts?.length) {
      return new Response(JSON.stringify({ items: [] }), { headers: corsHeaders })
    }

    // If no API key, fall back to keyword scoring
    if (!ANTHROPIC_KEY) {
      const items = texts.map((t, index) => ({ index, ...keywordFallback(t) }))
      return new Response(JSON.stringify({ items }), { headers: corsHeaders })
    }

    const prompt = `You are an Indian political intelligence analyst. Analyse the following ${texts.length} text item(s) and return a JSON array. Each element must have these exact fields:
{
  "index": <0-based integer matching input position>,
  "sentiment": "positive" | "negative" | "neutral",
  "score": <float from -1.0 to +1.0>,
  "urgency": "high" | "medium" | "low",
  "topics": [<relevant topic strings, e.g. "Crisis", "Achievement", "Scheme", "Election", "Opposition Attack", "Infrastructure">],
  "geoTags": [<Indian state/city names found in text>],
  "entities": [<named people and organisations mentioned>],
  "summary": "<single sentence summary in English, max 100 characters>",
  "oppRisk": <integer 0-100, how likely this is an opposition political attack on the ruling party>
}

Items:
${texts.map((t, i) => `[${i}] ${t.substring(0, 400)}`).join('\n')}

Return ONLY the JSON array. No markdown, no explanation.`

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 4096,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) throw new Error(`Claude API ${res.status}`)
    const data = await res.json()
    const raw  = data.content?.[0]?.text ?? ''

    const jsonMatch = raw.match(/\[[\s\S]*\]/)
    if (!jsonMatch) throw new Error('No JSON array returned')
    const parsed: any[] = JSON.parse(jsonMatch[0])

    const items = texts.map((t, i) => {
      const found = parsed.find((p: any) => p.index === i)
      if (!found) return { index: i, ...keywordFallback(t) }
      return {
        index:     i,
        sentiment: found.sentiment ?? 'neutral',
        score:     found.score     ?? 0,
        urgency:   found.urgency   ?? 'low',
        topics:    found.topics    ?? [],
        geoTags:   found.geoTags   ?? [],
        entities:  found.entities  ?? [],
        summary:   found.summary   ?? '',
        oppRisk:   found.oppRisk   ?? 0,
      }
    })

    return new Response(JSON.stringify({ items }), { headers: corsHeaders })

  } catch (err: unknown) {
    // Graceful fallback on any error
    try {
      const { texts: fallbackTexts }: { texts: string[] } = await new Request(req.clone().url, req).json().catch(() => ({ texts: [] }))
      if (fallbackTexts?.length) {
        const items = fallbackTexts.map((t: string, index: number) => ({ index, ...keywordFallback(t) }))
        return new Response(JSON.stringify({ items }), { headers: corsHeaders })
      }
    } catch { /* ignore */ }

    const msg = err instanceof Error ? err.message : String(err)
    return new Response(JSON.stringify({ error: msg, items: [] }), {
      status: 500, headers: corsHeaders,
    })
  }
})
