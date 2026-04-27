const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (!GEMINI_KEY) return new Response(JSON.stringify({ error: 'GEMINI_API_KEY not configured', result: null }), { status: 500, headers: CORS })

  try {
    const { prompt } = await req.json()
    if (!prompt) return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400, headers: CORS })

    const enhancedPrompt = `You are India's most forensic political fact-checker covering 2014 to ${new Date().getFullYear()}.

Your job: detect genuine contradictions, position flips, broken promises, sarcasm-as-criticism, and data gaps in Indian politicians' statements.

SCAN TYPES:
- "flip": Clear reversal of stated position (e.g., promised X in 2018, now says opposite)
- "contradiction": Statement contradicts verifiable facts or prior statements
- "vote_record": Current claim contradicts their voting/policy record in Parliament
- "data_gap": Claim contradicts verifiable economic/development data
- "sarcasm": Statement uses praise/promises sarcastically — e.g., "PM will surely fix this" when used critically
- "none": No meaningful contradiction found

SARCASM DETECTION: If the current statement contains sarcastic praise, ironic promises, or backhanded compliments toward a politician, classify as "sarcasm" type with negative score.

TIME RANGE: Search your knowledge of Indian politics from 2014 to present.

IMPORTANT: Only flag genuine contradictions (score ≥ 60). Never hallucinate sources. If unsure, return hasContradiction: false.

${prompt}

Reply ONLY with valid JSON (no markdown, no explanation outside JSON):
{
  "hasContradiction": true/false,
  "score": 0-100,
  "type": "flip|contradiction|vote_record|data_gap|sarcasm|none",
  "historicalQuote": "exact or paraphrased historical statement",
  "historicalDate": "YYYY-MM or YYYY",
  "historicalSource": "source name (Parliament record, NDTV, The Hindu, etc.)",
  "confidence": 0.0-1.0,
  "reasoning": "one clear sentence explaining the contradiction"
}`

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: enhancedPrompt }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 400 },
      }),
      signal: AbortSignal.timeout(25000),
    })

    if (!r.ok) throw new Error(`Gemini API error ${r.status}: ${await r.text()}`)
    const d = await r.json()
    const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const m = txt.match(/\{[\s\S]*\}/)
    const fallback = JSON.stringify({ hasContradiction: false, score: 0, type: 'none', historicalQuote: '', historicalDate: '', historicalSource: '', confidence: 0, reasoning: 'No contradiction found in 2014–present record' })
    return new Response(JSON.stringify({ result: m ? m[0] : fallback }), { headers: CORS })

  } catch (e) {
    console.error('[bm-contradiction-check] Error:', e.message)
    return new Response(JSON.stringify({ error: e.message, result: null }), { status: 500, headers: CORS })
  }
})
