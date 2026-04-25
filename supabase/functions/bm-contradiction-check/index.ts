const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  if (!ANTHROPIC_KEY) return new Response(JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured', result: null }), { status: 500, headers: CORS })

  try {
    const { prompt } = await req.json()
    if (!prompt) return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400, headers: CORS })

    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 600, messages: [{ role: 'user', content: prompt }] }),
      signal: AbortSignal.timeout(20000),
    })

    if (!r.ok) throw new Error(`Anthropic API error ${r.status}: ${await r.text()}`)
    const d = await r.json()
    const text = d?.content?.[0]?.text ?? ''
    const m = text.match(/\{[\s\S]*\}/)
    if (!m) return new Response(JSON.stringify({ result: JSON.stringify({ hasContradiction: false, score: 0, type: 'none', historicalQuote: '', historicalDate: '', historicalSource: '', confidence: 0, reasoning: 'No contradiction found' }) }), { headers: CORS })
    return new Response(JSON.stringify({ result: m[0] }), { headers: CORS })
  } catch (e) {
    console.error('[bm-contradiction-check] Error:', e.message)
    return new Response(JSON.stringify({ error: e.message, result: null }), { status: 500, headers: CORS })
  }
})
