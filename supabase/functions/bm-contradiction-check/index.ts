// ============================================================
// BharatMonitor — Contradiction Check Edge Function
// Runtime: Deno (Supabase Edge Functions)
//
// POST /functions/v1/bm-contradiction-check
//   Body: { prompt: string }
//   Returns: { result: string }  (JSON string from Claude)
//
// Keeps ANTHROPIC_API_KEY server-side — never in the browser bundle.
// ============================================================

const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  if (!ANTHROPIC_KEY) {
    return new Response(
      JSON.stringify({ error: 'ANTHROPIC_API_KEY not configured', result: null }),
      { status: 500, headers: corsHeaders }
    )
  }

  try {
    const { prompt } = await req.json()
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Missing prompt' }), { status: 400, headers: corsHeaders })
    }

    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_KEY,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(20000),
    })

    if (!res.ok) {
      const err = await res.text()
      throw new Error(`Anthropic API error ${res.status}: ${err}`)
    }

    const data = await res.json()
    const text = data?.content?.[0]?.text ?? ''

    // Extract JSON from the response
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) {
      // Return a "no contradiction" default if Claude didn't return valid JSON
      return new Response(JSON.stringify({
        result: JSON.stringify({
          hasContradiction: false, score: 0, type: 'none',
          historicalQuote: '', historicalDate: '', historicalSource: '',
          confidence: 0, reasoning: 'Could not parse AI response',
        })
      }), { headers: corsHeaders })
    }

    return new Response(JSON.stringify({ result: jsonMatch[0] }), { headers: corsHeaders })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[bm-contradiction-check] Error:', msg)
    return new Response(JSON.stringify({ error: msg, result: null }), {
      status: 500, headers: corsHeaders,
    })
  }
})
