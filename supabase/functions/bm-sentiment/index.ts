const ANTHROPIC_KEY = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

const POS = ['launched','inaugurated','achieved','success','growth','welfare','award','praised','progress','victory']
const NEG = ['scam','scandal','corruption','fraud','arrest','protest','attack','exposed','crisis','terror','controversy','accused']
const CRISIS = ['riot','bomb','blast','terror','killed','murder','fire','emergency','explosion']

function keywordScore(text) {
  const t = text.toLowerCase()
  let s = 0
  for (const w of POS) if (t.includes(w)) s += 0.3
  for (const w of NEG) if (t.includes(w)) s -= 0.3
  for (const w of CRISIS) if (t.includes(w)) s -= 0.6
  s = Math.max(-1, Math.min(1, s))
  const crisis = CRISIS.some(w => t.includes(w))
  const opp = ['congress','rahul','kejriwal','opposition'].some(w => t.includes(w)) && s < 0
  return {
    tone: Math.round(s * 5),
    bucket: crisis || s < -0.5 ? 'red' : opp || s < -0.2 ? 'yellow' : s > 0.15 ? 'blue' : 'silver',
    sentiment: s > 0.15 ? 'positive' : s < -0.15 ? 'negative' : 'neutral',
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { texts } = await req.json()
    if (!texts?.length) return new Response(JSON.stringify({ results: [] }), { headers: CORS })

    const results = []
    for (const { id, text } of texts) {
      const kw = keywordScore(text)
      if (!ANTHROPIC_KEY) { results.push({ id, ...kw }); continue }
      try {
        const r = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-api-key': ANTHROPIC_KEY, 'anthropic-version': '2023-06-01' },
          body: JSON.stringify({ model: 'claude-haiku-4-5-20251001', max_tokens: 60, messages: [{ role: 'user', content: `Rate this Indian political news. Reply ONLY with JSON {"bucket":"red|yellow|blue|silver","sentiment":"positive|negative|neutral","tone":-5..5}\n\n${text.slice(0,300)}` }] }),
          signal: AbortSignal.timeout(10000),
        })
        if (!r.ok) { results.push({ id, ...kw }); continue }
        const d = await r.json()
        const txt = d?.content?.[0]?.text ?? ''
        const m = txt.match(/\{[\s\S]*\}/)
        results.push(m ? { id, ...JSON.parse(m[0]) } : { id, ...kw })
      } catch { results.push({ id, ...kw }) }
    }

    return new Response(JSON.stringify({ results }), { headers: CORS })
  } catch (e) {
    console.error('[bm-sentiment] Error:', e.message)
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS })
  }
})
