// ============================================================
// ai-classifier — FREE STACK
//
// Layer 1: Keyword classifier        (instant, zero cost)
// Layer 2: Groq Llama3-8b refinement (free: 14,400 req/day)
// Layer 3: Gemini 1.5 Flash fallback (free: 1M tokens/day)
// Layer 4: Hugging Face MuRIL        (free: Indian language sentiment)
// ============================================================

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// ── Layer 1: Keyword classifier ───────────────────────────────────────────────
const BUCKET_WORDS: Record<string, number> = {
  // RED — crisis, breaking, urgent
  breaking:90, protest:85, riot:95, violence:92, emergency:88,
  blast:96, attack:90, crisis:85, scandal:82, arrested:80,
  trending:72, surge:75, viral:73, crackdown:84, shutdown:80,
  blockade:78, clashes:86, lathicharge:88, curfew:90,
  // YELLOW — developing
  debate:60, rally:62, campaign:58, demand:56,
  opposition:55, controversy:65, building:45, momentum:50,
  // SILVER — quotes
  said:70, stated:70, declared:68, speech:65,
  statement:65, announced:60, claimed:62, alleged:64,
  quoted:70, responded:58, replied:58, accused:65,
  // BLUE — background (default if nothing else matches)
  report:30, analysis:28, policy:32, scheme:30,
  budget:35, ministry:28, review:25, quarterly:22,
}

function keywordClassify(text: string): { bucket: string; confidence: number } {
  const lower = text.toLowerCase()
  const scores: Record<string, number> = { red: 0, yellow: 0, silver: 0, blue: 5 }
  const bucketMap: Record<string, string> = {
    breaking:'red', protest:'red', riot:'red', violence:'red', emergency:'red',
    blast:'red', attack:'red', crisis:'red', scandal:'red', arrested:'red',
    trending:'red', surge:'red', viral:'red', crackdown:'red', shutdown:'red',
    blockade:'red', clashes:'red', lathicharge:'red', curfew:'red',
    debate:'yellow', rally:'yellow', campaign:'yellow', demand:'yellow',
    opposition:'yellow', controversy:'yellow', building:'yellow', momentum:'yellow',
    said:'silver', stated:'silver', declared:'silver', speech:'silver',
    statement:'silver', announced:'silver', claimed:'silver', alleged:'silver',
    quoted:'silver', responded:'silver', replied:'silver', accused:'silver',
    report:'blue', analysis:'blue', policy:'blue', scheme:'blue',
    budget:'blue', ministry:'blue', review:'blue', quarterly:'blue',
  }
  for (const [word, weight] of Object.entries(BUCKET_WORDS)) {
    if (lower.includes(word)) {
      const b = bucketMap[word] || 'blue'
      scores[b] = Math.max(scores[b], weight)
    }
  }
  const [bucket, confidence] = Object.entries(scores).sort(([,a],[,b]) => b - a)[0]
  return { bucket, confidence }
}

function classifySentiment(text: string): string {
  const lower = text.toLowerCase()
  const pos = ['success','progress','support','win','achieve','benefit','growth','positive','praised','historic','applaud','hails','celebrates']
  const neg = ['fail','condemn','protest','oppose','reject','crisis','attack','blame','scandal','violence','arrest','corrupt','accused','criticises','slams','demands']
  const ps = pos.filter(w => lower.includes(w)).length
  const ns = neg.filter(w => lower.includes(w)).length
  return ns > ps ? 'negative' : ps > ns ? 'positive' : 'neutral'
}

// ── Layer 2: Groq Llama3 (FREE) ────────────────────────────────────────────────
// Sign up: console.groq.com — free, no credit card
// Free limits: 14,400 requests/day on llama3-8b-8192
async function groqClassify(headline: string): Promise<{ bucket: string; confidence: number } | null> {
  const key = Deno.env.get('GROQ_API_KEY')
  if (!key) return null
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify({
        model: 'llama3-8b-8192',
        messages: [{
          role: 'user',
          content: `You are a classifier for Indian political news. Classify the headline into exactly one bucket. Return ONLY valid JSON, nothing else.

Headline: "${headline}"

Buckets:
- red: breaking news, active crisis, protest, violence, trending surge, coordinated campaign
- yellow: developing story, rally, debate, building narrative
- blue: background, policy update, scheme news, report
- silver: direct politician quote, speech content, statement

{"bucket":"red|yellow|blue|silver","confidence":0-100}`
        }],
        temperature: 0,
        max_tokens: 50,
      }),
    })
    const d = await res.json()
    const text = d.choices?.[0]?.message?.content?.replace(/```json?\n?/g,'').replace(/```/g,'').trim() || '{}'
    return JSON.parse(text)
  } catch { return null }
}

// ── Layer 3: Gemini 1.5 Flash (FREE) ──────────────────────────────────────────
// Sign up: aistudio.google.com — free, no credit card needed
// Free limits: 15 req/min, 1 million tokens/day
async function geminiClassify(headline: string): Promise<{ bucket: string; confidence: number } | null> {
  const key = Deno.env.get('GEMINI_API_KEY')
  if (!key) return null
  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `Classify this Indian political news headline. Return ONLY JSON.
"${headline}"
red=crisis/breaking/protest, yellow=developing, blue=background, silver=politician quote
{"bucket":"red|yellow|blue|silver","confidence":0-100}` }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 50 },
        }),
      }
    )
    const d = await res.json()
    const text = d.candidates?.[0]?.content?.parts?.[0]?.text || ''
    return JSON.parse(text.replace(/```json?\n?/g,'').replace(/`/g,'').trim())
  } catch { return null }
}

// ── Layer 4: HuggingFace MuRIL sentiment (FREE, best for Indian languages) ────
// Model: google/muril-base-cased — trained on 17 Indian languages
// Sign up: huggingface.co — free tier, no credit card
// Use for: Hindi, Malayalam, Tamil, Gujarati, Bengali content
async function murILSentiment(text: string): Promise<string | null> {
  const key = Deno.env.get('HUGGINGFACE_API_KEY')
  if (!key) return null
  try {
    const res = await fetch(
      'https://api-inference.huggingface.co/models/cardiffnlp/twitter-xlm-roberta-base-sentiment',
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
        body: JSON.stringify({ inputs: text.substring(0, 512) }),
      }
    )
    const d = await res.json()
    if (!Array.isArray(d) || !d[0]) return null
    const top = d[0].sort((a: {score:number}, b: {score:number}) => b.score - a.score)[0]
    // Model returns: Positive, Negative, Neutral
    return top.label.toLowerCase().replace('positive','positive').replace('negative','negative').replace('neutral','neutral')
  } catch { return null }
}

// ── Main ──────────────────────────────────────────────────────────────────────
serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  try {
    const { feed_item_id, headline, account_id, language } = await req.json()
    const sb = createClient(Deno.env.get('APP_URL') || Deno.env.get('APP_URL') || 'https://bmxrsfyaujcppaqvtnfx.supabase.co' || 'https://bmxrsfyaujcppaqvtnfx.supabase.co', Deno.env.get('SERVICE_ROLE_KEY')!)

    // Layer 1: instant keyword result — shown immediately
    const kw = keywordClassify(headline)
    let sentiment = classifySentiment(headline)

    // Update DB immediately with keyword result
    await sb.from('feed_items').update({ bucket: kw.bucket, sentiment }).eq('id', feed_item_id)

    // Async refinement (doesn't block response)
    ;(async () => {
      try {
        // For Indian language content, use MuRIL for better sentiment
        if (language && language !== 'english') {
          const murILResult = await murILSentiment(headline)
          if (murILResult) sentiment = murILResult
        }

        // Refine bucket if keyword confidence is low
        if (kw.confidence < 70) {
          const refined = await groqClassify(headline) || await geminiClassify(headline)
          if (refined && refined.confidence > kw.confidence) {
            await sb.from('feed_items').update({ bucket: refined.bucket, sentiment }).eq('id', feed_item_id)
            return
          }
        }

        // Still update with improved sentiment
        await sb.from('feed_items').update({ sentiment }).eq('id', feed_item_id)
      } catch (e) {
        console.error('Async refinement failed:', e)
      }
    })()

    return new Response(
      JSON.stringify({ bucket: kw.bucket, sentiment, confidence: kw.confidence }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
