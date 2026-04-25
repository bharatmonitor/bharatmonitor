const GEMINI_KEY = Deno.env.get('GEMINI_API_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

const POS    = ['launched','inaugurated','achieved','success','growth','welfare','award','praised','progress','victory']
const NEG    = ['scam','scandal','corruption','fraud','arrest','protest','attack','exposed','crisis','terror','controversy','accused']
const CRISIS = ['riot','bomb','blast','terror','killed','murder','fire','emergency','explosion']

function kwScore(text) {
  const t = text.toLowerCase()
  let s = 0
  for (const w of POS) if (t.includes(w)) s += 0.3
  for (const w of NEG) if (t.includes(w)) s -= 0.3
  for (const w of CRISIS) if (t.includes(w)) s -= 0.6
  s = Math.max(-1, Math.min(1, s))
  const crisis = CRISIS.some(w => t.includes(w))
  const opp    = ['congress','rahul','kejriwal','opposition'].some(w => t.includes(w)) && s < 0
  return { tone: Math.round(s*5), bucket: crisis||s<-0.5?'red':opp||s<-0.2?'yellow':s>0.15?'blue':'silver', sentiment: s>0.15?'positive':s<-0.15?'negative':'neutral' }
}

async function geminiRate(text) {
  if (!GEMINI_KEY) return null
  try {
    const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${GEMINI_KEY}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `Rate this Indian political news. Reply ONLY with JSON {"bucket":"red|yellow|blue|silver","sentiment":"positive|negative|neutral","tone":-5..5}\n\n${text.slice(0,300)}` }] }],
        generationConfig: { temperature: 0.1, maxOutputTokens: 60 },
      }),
      signal: AbortSignal.timeout(10000),
    })
    if (!r.ok) return null
    const d   = await r.json()
    const txt = d?.candidates?.[0]?.content?.parts?.[0]?.text ?? ''
    const m   = txt.match(/\{[\s\S]*?\}/)
    return m ? JSON.parse(m[0]) : null
  } catch { return null }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  try {
    const { texts } = await req.json()
    if (!texts?.length) return new Response(JSON.stringify({ results: [] }), { headers: CORS })
    const results = []
    for (const { id, text } of texts) {
      const kw = kwScore(text)
      const ai = await geminiRate(text)
      results.push(ai ? { id, ...ai } : { id, ...kw })
    }
    return new Response(JSON.stringify({ results }), { headers: CORS })
  } catch (e) {
    return new Response(JSON.stringify({ error: e.message }), { status: 500, headers: CORS })
  }
})
