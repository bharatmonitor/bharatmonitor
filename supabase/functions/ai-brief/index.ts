// ============================================================
// ai-brief — FREE STACK
//
// Primary:  Gemini 1.5 Pro  (free: 2 req/min, 32K tokens/day)
// Fallback: Groq Llama3-70b (free: 6,000 req/day)
// Fallback: Gemini 1.5 Flash (free: 15 req/min, 1M tokens/day)
//
// Sign up for Gemini: aistudio.google.com (free, no card)
// Sign up for Groq:   console.groq.com   (free, no card)
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Gemini 1.5 Pro (FREE primary — best reasoning) ────────────────────────────
async function geminiPro(prompt: string): Promise<string | null> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return null
  try {
    // Try Pro first (higher quality, lower rate limit)
    for (const model of ['gemini-1.5-pro', 'gemini-1.5-flash']) {
      try {
        const res = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ parts: [{ text: prompt }] }],
              generationConfig: { temperature: 0.1, maxOutputTokens: 1500 },
              safetySettings: [
                { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
                { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
              ],
            }),
          }
        )
        const d = await res.json()
        if (d.error) continue // try next model
        return d.candidates?.[0]?.content?.parts?.[0]?.text || null
      } catch { continue }
    }
    return null
  } catch { return null }
}

// ── Groq Llama3-70b (FREE fallback — fast, good quality) ─────────────────────
async function groqLlama(prompt: string): Promise<string | null> {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama3-70b-8192',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.1,
        max_tokens: 1500,
      }),
    })
    const d = await res.json()
    return d.choices?.[0]?.message?.content || null
  } catch { return null }
}

// ── Generate with fallback chain ──────────────────────────────────────────────
async function generate(prompt: string): Promise<string> {
  return await geminiPro(prompt)
      || await groqLlama(prompt)
      || JSON.stringify({ situation_summary: 'AI brief unavailable — check API keys', pattern_analysis: '', ticker_items: [] })
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { account_id } = await req.json()
    const sb = createClient(Deno.env.get('APP_URL') || Deno.env.get('APP_URL') || 'https://bmxrsfyaujcppaqvtnfx.supabase.co' || 'https://bmxrsfyaujcppaqvtnfx.supabase.co', Deno.env.get('SERVICE_ROLE_KEY')!)

    // Fetch account
    const { data: account } = await sb.from('accounts').select('*').eq('id', account_id).single()
    if (!account) throw new Error('Account not found')

    // Fetch last 24h feed items
    const since = new Date(Date.now() - 86400000).toISOString()
    const { data: items } = await sb.from('feed_items').select('*').eq('account_id', account_id).gte('fetched_at', since).order('published_at', { ascending: false }).limit(50)

    // Fetch recent contradictions
    const { data: contras } = await sb.from('contradictions').select('*').eq('account_id', account_id).gte('created_at', since).order('contradiction_score', { ascending: false }).limit(10)

    const feedSummary = (items || []).slice(0, 20)
      .map((f: Record<string, string>) => `[${f.bucket?.toUpperCase()}][${f.sentiment}] ${f.source}: ${f.headline}`)
      .join('\n')

    const contrasSummary = (contras || []).slice(0, 5)
      .map((c: Record<string, string | number>) => `${c.politician_name} (${c.contradiction_score}%): "${c.current_quote}" vs "${c.historical_quote}"`)
      .join('\n')

    const prompt = `You are a neutral political intelligence analyst for India. Generate a factual intelligence brief for ${account.politician_name} (${account.party}, ${account.constituency}, ${account.state}).

RECENT FEED (last 24h):
${feedSummary || 'No items yet'}

DETECTED CONTRADICTIONS:
${contrasSummary || 'None detected'}

Generate a JSON object. Return ONLY valid JSON, no other text, no markdown code blocks.

{
  "situation_summary": "2-3 factual sentences on what is happening. No advice, no opinion. Patterns and data only.",
  "pattern_analysis": "1-2 sentences on detected patterns (coordinated campaigns, surges, timing). Factual only.",
  "ticker_items": [
    { "tag": "CRISIS|OPP|POSITIVE|INTEL|SURGE|RTI|TREND|AI", "text": "max 12 words, factual", "bucket": "red|yellow|blue|silver" }
  ]
}

Rules:
- Never say 'you should' or give strategic advice
- Never attribute motive or intent  
- State patterns, volumes, data only
- 6-8 ticker items covering the key signals
- ONLY return JSON`

    const raw = await generate(prompt)
    let parsed: Record<string, unknown>
    try {
      parsed = JSON.parse(raw.replace(/```json?\n?/g,'').replace(/```/g,'').trim())
    } catch {
      parsed = {
        situation_summary: 'Brief generation encountered a parsing issue. Raw data available.',
        pattern_analysis: 'Please check Gemini/Groq API keys in Supabase secrets.',
        ticker_items: []
      }
    }

    // Build opportunities from contradictions
    const opportunities = (contras || []).slice(0, 3).map((c: Record<string, unknown>) => ({
      id: c.id,
      type: c.contradiction_type,
      politician: c.politician_name,
      score: c.evidence_source || c.contradiction_score,
      description: `${String(c.contradiction_type).replace(/_/g,' ')} — ${c.contradiction_score}% confidence`,
      current_statement: c.current_quote,
      historical_statement: c.historical_quote,
      confidence: Number(c.contradiction_score) / 100,
    }))

    const ticker = ((parsed.ticker_items as unknown[]) || []).map((t: unknown, i: number) => ({
      id: `t-${Date.now()}-${i}`,
      ...(t as Record<string, unknown>),
      created_at: new Date().toISOString(),
    }))

    const { data: brief } = await sb.from('ai_briefs').insert({
      account_id,
      situation_summary: parsed.situation_summary || '',
      pattern_analysis: parsed.pattern_analysis || '',
      opportunities,
      ticker_items: ticker,
      next_refresh_at: new Date(Date.now() + 5 * 60000).toISOString(),
    }).select().single()

    return new Response(JSON.stringify({ brief }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
