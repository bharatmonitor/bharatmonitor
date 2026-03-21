// ============================================================
// contradiction-engine — FREE STACK
//
// Primary AI:  Gemini 1.5 Pro  (free: 2 req/min, 32K tokens/day)
// Fallback AI: Groq Llama3-70b (free: 6,000 req/day)
// Quote DB:    Supabase + GDELT + Google News archive
//
// Sign up: aistudio.google.com and console.groq.com (both free)
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Gemini Pro (FREE — primary) ───────────────────────────────────────────────
async function callGemini(prompt: string): Promise<string | null> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return null
  for (const model of ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']) {
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { temperature: 0, maxOutputTokens: 800 },
            safetySettings: [
              { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
              { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
            ],
          }),
        }
      )
      const d = await res.json()
      if (d.error) continue
      const text = d.candidates?.[0]?.content?.parts?.[0]?.text
      if (text) return text
    } catch { continue }
  }
  return null
}

// ── Groq Llama3-70b (FREE — fallback) ────────────────────────────────────────
async function callGroq(prompt: string): Promise<string | null> {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0,
        max_tokens: 800,
      }),
    })
    const d = await res.json()
    return d.choices?.[0]?.message?.content || null
  } catch { return null }
}

async function callAI(prompt: string): Promise<string> {
  return await callGemini(prompt) || await callGroq(prompt) || '{"has_contradiction":false}'
}

// ── Fetch historical quotes from GDELT (FREE) ─────────────────────────────────
// GDELT indexes quotes from world media — great for Indian politicians
async function fetchHistoricalQuotes(politicianName: string): Promise<{ quote: string; date: string; source: string }[]> {
  try {
    const encoded = encodeURIComponent(`"${politicianName}"`)
    const url = `https://api.gdeltproject.org/api/v2/doc/doc?query=${encoded}%20sourcecountry:IN&mode=artlist&maxrecords=20&format=json&timespan=5Y`
    const res = await fetch(url, { signal: AbortSignal.timeout(10000) })
    const data = await res.json()
    return (data.articles || []).slice(0, 15).map((a: Record<string, unknown>) => ({
      quote: String(a.title || ''),
      date: String(a.seendate || '').substring(0, 10),
      source: String(a.domain || 'Unknown source'),
    }))
  } catch { return [] }
}

// ── Main handler ──────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { politician_name, current_quote, account_id, feed_item_id } = await req.json()
    const sb = createClient(Deno.env.get('APP_URL') || Deno.env.get('APP_URL') || 'https://bmxrsfyaujcppaqvtnfx.supabase.co' || 'https://bmxrsfyaujcppaqvtnfx.supabase.co', Deno.env.get('SERVICE_ROLE_KEY')!)

    // Get historical quotes from Supabase DB first
    const fiveYearsAgo = new Date(); fiveYearsAgo.setFullYear(fiveYearsAgo.getFullYear() - 5)
    const { data: dbQuotes } = await sb.from('quote_archive')
      .select('quote, quote_date, source')
      .eq('politician_name', politician_name)
      .gte('quote_date', fiveYearsAgo.toISOString().split('T')[0])
      .order('quote_date', { ascending: false })
      .limit(20)

    // Supplement with GDELT if DB has fewer than 5 quotes
    let allQuotes = (dbQuotes || []) as { quote: string; quote_date?: string; date?: string; source: string }[]
    if (allQuotes.length < 5) {
      const gdeltQuotes = await fetchHistoricalQuotes(politician_name)
      allQuotes = [...allQuotes, ...gdeltQuotes.map(q => ({ quote: q.quote, quote_date: q.date, source: q.source }))]
    }

    if (allQuotes.length === 0) {
      return new Response(JSON.stringify({ contradiction: null, reason: 'No historical data found' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const quotesText = allQuotes.slice(0, 20)
      .map(q => `[${q.quote_date || q.date || 'Unknown date'}] (${q.source}): "${q.quote}"`)
      .join('\n')

    const prompt = `You are a political fact-checker for India. Detect factual contradictions in statements. Only flag direct contradictions — not changed opinions or context-dependent statements.

CURRENT STATEMENT by ${politician_name}:
"${current_quote}"

HISTORICAL STATEMENTS (last 5 years):
${quotesText}

Return ONLY a JSON object, no other text:
{
  "has_contradiction": true/false,
  "contradiction_score": 0-100,
  "contradiction_type": "direct_flip" | "data_contradiction" | "vote_record" | "policy_reversal" | null,
  "historical_quote": "exact contradicting quote text",
  "historical_date": "YYYY-MM-DD",
  "historical_source": "source name",
  "explanation": "one sentence factual explanation only, no advice"
}

If no clear contradiction: return has_contradiction: false with null for other fields.`

    const raw = await callAI(prompt)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw.replace(/```json?\n?/g,'').replace(/```/g,'').trim())
    } catch {
      return new Response(JSON.stringify({ contradiction: null, reason: 'AI parse error' }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    if (!parsed.has_contradiction) {
      return new Response(JSON.stringify({ contradiction: null }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const { data: contra, error } = await sb.from('contradictions').insert({
      feed_item_id, account_id, politician_name,
      current_quote,
      historical_quote: parsed.historical_quote,
      historical_date: parsed.historical_date,
      historical_source: parsed.historical_source,
      contradiction_score: parsed.contradiction_score,
      contradiction_type: parsed.contradiction_type,
      status: 'flagged',
    }).select().single()

    if (error) console.error('Contradiction insert error:', error)

    return new Response(JSON.stringify({ contradiction: contra }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
