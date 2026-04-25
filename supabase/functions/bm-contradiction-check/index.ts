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

    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.2, maxOutputTokens: 600 },
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!r.ok) throw new Error(`Gemini API error ${r.status}: ${await r.text()}`)
    const d   = await r.json()
    const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const m   = txt.match(/\{[\s\S]*\}/)
    const fallback = JSON.stringify({ hasContradiction: false, score: 0, type: 'none', historicalQuote: '', historicalDate: '', historicalSource: '', confidence: 0, reasoning: 'No contradiction found' })
    return new Response(JSON.stringify({ result: m ? m[0] : fallback }), { headers: CORS })
  } catch (e) {
    console.error('[bm-contradiction-check] Error:', e.message)
    return new Response(JSON.stringify({ error: e.message, result: null }), { status: 500, headers: CORS })
  }
})
