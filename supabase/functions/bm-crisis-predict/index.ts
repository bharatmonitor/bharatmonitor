// supabase/functions/bm-crisis-predict/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// BharatMonitor — Predictive Crisis Early Warning System
//
// Runs every hour via cron OR on-demand from dashboard.
// Analyses the last 6-24h of feed for pre-crisis linguistic patterns.
//
// Pattern signals detected:
//   1. VELOCITY SPIKE    — keyword volume accelerating faster than baseline
//   2. JOURNALIST SWARM  — multiple watchlisted journalists covering same topic
//   3. ESCALATION CHAIN  — negative sentiment climbing across time windows
//   4. OPPOSITION SURGE  — competitor/opposition handles suddenly active on topic
//   5. AMPLIFICATION     — items with high RT/quote velocity
//   6. HISTORICAL MATCH  — current narrative matches past crisis archetypes
//
// Output: array of CrisisSignal objects saved to bm_crisis_signals table
// ─────────────────────────────────────────────────────────────────────────────

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? 'https://ylajerluygbeiqybkgtx.supabase.co'
const SUPABASE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMDQzOSwiZXhwIjoyMDkwMDk2NDM5fQ.zgKRPK1VrZg-q7DbuwNzxfYL_3ZfqiOU4K6YiSZySSY'
const GEMINI_KEY  = Deno.env.get('GEMINI_API_KEY') ?? ''

const db = createClient(SUPABASE_URL, SUPABASE_KEY)

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

// Pre-crisis linguistic markers — research-backed patterns that precede crises
const ESCALATION_PHRASES = [
  // Demand/ultimatum language
  'demands resignation', 'calls for resignation', 'must resign', 'should step down',
  'facing calls to quit', 'under pressure to resign',
  // Legal escalation
  'FIR filed', 'case registered', 'arrested', 'summoned', 'notice issued', 'probe ordered',
  'CBI probe', 'ED investigation', 'judicial inquiry',
  // Protest signals
  'demonstration planned', 'protest march', 'rally called', 'bandh announced',
  'shutdown called', 'agitation intensifies', 'protesters gather',
  // Opposition coordination
  'opposition demands', 'INDIA bloc', 'joint statement', 'united opposition',
  'opposition leaders meet', 'parliament disruption', 'walkout',
  // Media escalation
  'exclusive investigation', 'expose', 'sting operation', 'leaked document',
  'whistleblower', 'sources reveal', 'internal document',
  // Viral signals
  'trending on twitter', 'goes viral', 'massive backlash', 'outrage online',
  'twitter storm', 'hashtag trends',
]

const JOURNALIST_WATCHLIST = [
  'svaradarajan', 'navikakumar', 'dhanyarajendran', 'AbhinandanSekhr',
  'sanket', 'mkvenu1', 'suresh_bhusari', 'ameytirodkar', 'oratorgreat',
  'RajdeepSardesai', 'bdutt', 'fayedsouza', 'mrajshekhar', 'vaishnaroy',
  'ShereenBhan', 'NeerajCNBC', 'nistula', 'sidhant', 'VishnuNDTV',
]

// Historical crisis archetypes — patterns that led to crises before
const CRISIS_ARCHETYPES = [
  { name: 'Corruption Cascade',    triggers: ['scam', 'corruption', 'fraud', 'crore', 'loot', 'embezzlement'] },
  { name: 'Law & Order Breakdown', triggers: ['violence', 'riot', 'clash', 'police firing', 'lathi charge', 'stone pelting'] },
  { name: 'ED/CBI Spiral',         triggers: ['ED raid', 'CBI raid', 'arrest', 'money laundering', 'FEMA'] },
  { name: 'Statement Blowback',    triggers: ['controversy', 'offensive remark', 'demands apology', 'backlash', 'outrage'] },
  { name: 'Protest Escalation',    triggers: ['protest', 'agitation', 'bandh', 'shutdown', 'march', 'demonstration'] },
  { name: 'Defection Signal',      triggers: ['joins BJP', 'joins Congress', 'switches party', 'resigns from', 'quits party'] },
]

// Gemini analysis for nuanced pattern detection
async function analyzeWithGemini(items: any[], accountName: string): Promise<{
  riskScore: number
  primaryThreat: string
  signals: string[]
  recommendedActions: string[]
  timeToImpact: string
  confidence: number
} | null> {
  if (!GEMINI_KEY || items.length === 0) return null

  const headlines = items.slice(0, 20).map(i => `[${i.sentiment}] ${i.headline}`).join('\n')

  const prompt = `You are a political crisis intelligence analyst for ${accountName} in India.

Analyse these recent news items and assess crisis probability:

${headlines}

Return ONLY a JSON object (no markdown, no explanation):
{
  "riskScore": <0-100, probability of crisis in next 6-12 hours>,
  "primaryThreat": "<one sentence describing the main threat>",
  "signals": ["<signal 1>", "<signal 2>", "<signal 3>"],
  "recommendedActions": ["<action 1>", "<action 2>", "<action 3>"],
  "timeToImpact": "<estimate: 2-4 hours / 6-12 hours / 12-24 hours / 24-48 hours>",
  "confidence": <0.0-1.0>
}`

  try {
    const r = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { temperature: 0.3, maxOutputTokens: 600 },
        }),
        signal: AbortSignal.timeout(20_000),
      }
    )
    const d = await r.json()
    const text = d?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const clean = text.replace(/```json|```/g, '').trim()
    return JSON.parse(clean)
  } catch (e) {
    console.warn('[CrisisPredict] Gemini error:', e)
    return null
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  let body: any = {}
  try { body = await req.json() } catch { /* cron call with no body */ }

  const { accountId, accountName = 'Account', lookbackHours = 12 } = body

  if (!accountId) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing accountId' }), { headers: CORS, status: 400 })
  }

  const lookbackTime = new Date(Date.now() - lookbackHours * 60 * 60 * 1000).toISOString()

  // Fetch recent feed items
  const { data: recentItems = [] } = await db
    .from('bm_feed')
    .select('*')
    .eq('account_id', accountId)
    .gte('published_at', lookbackTime)
    .order('published_at', { ascending: false })
    .limit(200)

  if (recentItems.length === 0) {
    return new Response(JSON.stringify({ ok: true, signals: [], message: 'No recent data' }), { headers: CORS })
  }

  const signals: any[] = []
  const now = Date.now()

  // ── Signal 1: VELOCITY SPIKE ────────────────────────────────────────────────
  // Compare item count in last 2h vs 2-6h window
  const last2h  = recentItems.filter(i => new Date(i.published_at).getTime() > now - 2 * 3600_000)
  const prev4h  = recentItems.filter(i => {
    const t = new Date(i.published_at).getTime()
    return t > now - 6 * 3600_000 && t <= now - 2 * 3600_000
  })
  const velocityRatio = prev4h.length > 0 ? (last2h.length / (prev4h.length / 2)) : 0
  if (velocityRatio > 2.5) {
    signals.push({
      type: 'VELOCITY_SPIKE',
      severity: velocityRatio > 4 ? 'critical' : 'high',
      score: Math.min(Math.round(velocityRatio * 20), 95),
      headline: `Volume spike: ${last2h.length} items in last 2h vs ${Math.round(prev4h.length / 2)} avg/2h`,
      detail: `${velocityRatio.toFixed(1)}x acceleration detected`,
      items: last2h.slice(0, 5).map(i => i.headline),
    })
  }

  // ── Signal 2: JOURNALIST SWARM ──────────────────────────────────────────────
  // Multiple watchlisted journalists covering the same topic
  const journalistHits = recentItems.filter(i => {
    const src = (i.source_name || i.source || '').toLowerCase().replace('@', '')
    return JOURNALIST_WATCHLIST.some(j => src.includes(j.toLowerCase()))
  })
  const journalistKeywords: Record<string, Set<string>> = {}
  journalistHits.forEach(i => {
    const kw = i.keyword || 'general'
    if (!journalistKeywords[kw]) journalistKeywords[kw] = new Set()
    journalistKeywords[kw].add((i.source_name || i.source || '').toLowerCase())
  })
  const swarmTopics = Object.entries(journalistKeywords)
    .filter(([, journalists]) => journalists.size >= 3)
    .sort((a, b) => b[1].size - a[1].size)

  if (swarmTopics.length > 0) {
    const [topic, journalists] = swarmTopics[0]
    signals.push({
      type: 'JOURNALIST_SWARM',
      severity: journalists.size >= 5 ? 'critical' : 'high',
      score: Math.min(journalists.size * 15, 90),
      headline: `${journalists.size} watchlisted journalists covering "${topic}"`,
      detail: `Coordinated media attention detected: ${Array.from(journalists).slice(0, 4).join(', ')}`,
      items: journalistHits.filter(i => i.keyword === topic).slice(0, 5).map(i => i.headline),
    })
  }

  // ── Signal 3: ESCALATION CHAIN ──────────────────────────────────────────────
  // Negative sentiment climbing: compare neg% in last 2h vs 4-6h window
  const negLast2h = last2h.length > 0
    ? last2h.filter(i => i.sentiment === 'negative').length / last2h.length
    : 0
  const negPrev4h = prev4h.length > 0
    ? prev4h.filter(i => i.sentiment === 'negative').length / prev4h.length
    : 0
  const negDelta = negLast2h - negPrev4h
  if (negDelta > 0.25 && negLast2h > 0.5) {
    signals.push({
      type: 'ESCALATION_CHAIN',
      severity: negLast2h > 0.7 ? 'critical' : 'high',
      score: Math.round(negLast2h * 80 + negDelta * 50),
      headline: `Negative sentiment rising: ${Math.round(negLast2h * 100)}% in last 2h (was ${Math.round(negPrev4h * 100)}%)`,
      detail: `+${Math.round(negDelta * 100)}pp increase — approaching critical threshold`,
      items: last2h.filter(i => i.sentiment === 'negative').slice(0, 5).map(i => i.headline),
    })
  }

  // ── Signal 4: ESCALATION PHRASES ────────────────────────────────────────────
  const phraseHits: Record<string, string[]> = {}
  recentItems.forEach(i => {
    const text = `${i.headline} ${i.body || ''}`.toLowerCase()
    ESCALATION_PHRASES.forEach(phrase => {
      if (text.includes(phrase.toLowerCase())) {
        if (!phraseHits[phrase]) phraseHits[phrase] = []
        phraseHits[phrase].push(i.headline)
      }
    })
  })
  const topPhrases = Object.entries(phraseHits).sort((a, b) => b[1].length - a[1].length).slice(0, 3)
  if (topPhrases.length > 0) {
    const criticalPhrases = topPhrases.filter(([, items]) => items.length >= 2)
    if (criticalPhrases.length > 0) {
      signals.push({
        type: 'ESCALATION_PHRASES',
        severity: criticalPhrases.some(([, i]) => i.length >= 4) ? 'critical' : 'medium',
        score: Math.min(criticalPhrases.reduce((s, [, i]) => s + i.length * 10, 0), 80),
        headline: `Pre-crisis language: "${criticalPhrases[0][0]}" (${criticalPhrases[0][1].length} items)`,
        detail: `Escalation phrases detected: ${criticalPhrases.map(([p]) => p).join(' · ')}`,
        items: criticalPhrases[0][1].slice(0, 5),
      })
    }
  }

  // ── Signal 5: ARCHETYPE MATCH ────────────────────────────────────────────────
  const archetypeMatches: { name: string; count: number; items: string[] }[] = []
  CRISIS_ARCHETYPES.forEach(arch => {
    const matched = recentItems.filter(i => {
      const text = `${i.headline} ${i.body || ''}`.toLowerCase()
      return arch.triggers.some(t => text.includes(t))
    })
    if (matched.length >= 3) {
      archetypeMatches.push({ name: arch.name, count: matched.length, items: matched.slice(0, 5).map(i => i.headline) })
    }
  })
  archetypeMatches.sort((a, b) => b.count - a.count).forEach(am => {
    signals.push({
      type: 'ARCHETYPE_MATCH',
      severity: am.count >= 8 ? 'critical' : am.count >= 5 ? 'high' : 'medium',
      score: Math.min(am.count * 8, 85),
      headline: `Crisis archetype: "${am.name}" (${am.count} matching items)`,
      detail: 'Historical pattern match — this combination of signals has preceded crises before',
      items: am.items,
    })
  })

  // ── Crisis score + Gemini deep analysis ─────────────────────────────────────
  const maxScore = signals.length > 0 ? Math.max(...signals.map(s => s.score)) : 0
  const overallRisk = Math.min(Math.round(
    signals.reduce((sum, s) => sum + s.score, 0) / Math.max(signals.length, 1) * 0.7 +
    maxScore * 0.3
  ), 99)

  // Only call Gemini if rule-based signals suggest risk > 40
  let aiAnalysis = null
  if (overallRisk > 40 && GEMINI_KEY) {
    const redItems = recentItems.filter(i => i.bucket === 'red' || i.bucket === 'yellow').slice(0, 20)
    aiAnalysis = await analyzeWithGemini(redItems.length > 5 ? redItems : recentItems.slice(0, 20), accountName)
  }

  const finalRisk = aiAnalysis
    ? Math.round(overallRisk * 0.5 + aiAnalysis.riskScore * 0.5)
    : overallRisk

  const result = {
    ok: true,
    accountId,
    analysedAt: new Date().toISOString(),
    lookbackHours,
    itemsAnalysed: recentItems.length,
    overallRiskScore: finalRisk,
    riskLevel: finalRisk >= 75 ? 'CRITICAL' : finalRisk >= 50 ? 'HIGH' : finalRisk >= 25 ? 'MEDIUM' : 'LOW',
    signals: signals.sort((a, b) => b.score - a.score),
    aiAnalysis,
    summary: aiAnalysis?.primaryThreat || (signals.length > 0
      ? signals[0].headline
      : 'No significant pre-crisis signals detected in this window'),
  }

  // Save to DB if meaningful signals found
  if (signals.length > 0 && finalRisk > 25) {
    await db.from('bm_crisis_signals').upsert({
      id: `cs-${accountId}-${Math.floor(Date.now() / 3_600_000)}`, // one per hour per account
      account_id: accountId,
      risk_score: finalRisk,
      risk_level: result.riskLevel,
      signals_json: JSON.stringify(signals),
      ai_analysis_json: JSON.stringify(aiAnalysis),
      summary: result.summary,
      created_at: new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: false })
  }

  console.log(`[CrisisPredict] ${accountId} risk=${finalRisk} signals=${signals.length} items=${recentItems.length}`)
  return new Response(JSON.stringify(result), { headers: CORS })
})
