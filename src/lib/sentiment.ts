// ============================================================
// BharatMonitor — AI Sentiment Engine
//
// Two-tier approach:
//   Tier 1 (instant, free):  Keyword-based scoring for quick
//                            classification of every item.
//   Tier 2 (rich, AI):       Claude API via Supabase edge fn
//                            for deeper analysis in batches.
// ============================================================

import type { Sentiment } from '@/types'

// ─── Scored sentiment result ─────────────────────────────────────────────────

export interface SentimentScore {
  sentiment:  Sentiment          // positive | negative | neutral
  score:      number             // -1.0 to +1.0
  urgency:    'high' | 'medium' | 'low'
  topics:     string[]
  geoTags:    string[]
  entities:   string[]           // named people / orgs / places
  aiSummary?: string             // only from Tier-2 (Claude)
  oppRisk:    number             // 0-100: likelihood of political opposition attack
  confidence: number             // 0-1
  method:     'keyword' | 'claude'
}

// ─── Indian political keywords ───────────────────────────────────────────────

const NEG_KEYWORDS: string[] = [
  // Crisis / attack
  'scam', 'scandal', 'corruption', 'fraud', 'arrest', 'arrested', 'fir', 'accused',
  'opposition', 'attack', 'criticized', 'slammed', 'slammed', 'demands resignation',
  'protest', 'agitation', 'lathicharge', 'crackdown', 'detained', 'edi', 'cbi raid',
  'fake', 'lie', 'misleading', 'misinformation', 'hate speech',
  // Hindi neg
  'भ्रष्टाचार', 'घोटाला', 'गिरफ्तार', 'विरोध', 'आरोप', 'झूठ', 'दंगा',
  'हिंसा', 'हत्या', 'बलात्कार', 'अपराध', 'अत्याचार',
  // Opposition / crisis framing
  'failed', 'failure', 'disappointment', 'worst', 'disaster', 'crisis', 'collapse',
  'expose', 'exposed', 'hypocrisy', 'liar', 'incompetent', 'resign', 'resignation',
]

const POS_KEYWORDS: string[] = [
  // Achievement
  'inaugurated', 'launched', 'achieved', 'success', 'milestone', 'growth',
  'development', 'progress', 'scheme', 'benefit', 'welfare', 'empowerment',
  'record', 'historic', 'first time', 'honour', 'award', 'recognition',
  'infrastructure', 'employment', 'education', 'health', 'viksit bharat',
  // Hindi pos
  'विकास', 'उपलब्धि', 'सफलता', 'सम्मान', 'योजना', 'लाभ', 'रोजगार',
  'शिक्षा', 'स्वास्थ्य', 'निर्माण', 'उद्घाटन',
  // Positive framing
  'praised', 'commended', 'welcomed', 'applauded', 'landmark', 'breakthrough',
  'efficient', 'excellent', 'outstanding', 'dedicated', 'committed',
]

const CRISIS_KEYWORDS: string[] = [
  'riot', 'flood', 'earthquake', 'bomb', 'blast', 'terror', 'attack',
  'dead', 'killed', 'death', 'murder', 'rape', 'fire', 'accident',
  'emergency', 'crisis', 'breakdown', 'collapse',
  'दंगा', 'बाढ़', 'भूकंप', 'विस्फोट', 'आतंक', 'मौत', 'हत्या',
]

const OPP_ATTACK_KEYWORDS: string[] = [
  'congress', 'aap', 'sp', 'bsp', 'tmc', 'indi alliance', 'india bloc',
  'rahul gandhi', 'priyanka', 'kejriwal', 'owaisi', 'mamata', 'opposition',
  'fake encounter', 'jumla', 'anti-national',
]

// ─── Indian state / geo name list ────────────────────────────────────────────

const GEO_TERMS = [
  'Delhi', 'Mumbai', 'Chennai', 'Kolkata', 'Hyderabad', 'Bengaluru', 'Ahmedabad',
  'Pune', 'Jaipur', 'Lucknow', 'Patna', 'Bhopal', 'Raipur', 'Ranchi', 'Shimla',
  'Chandigarh', 'Dehradun', 'Gandhinagar', 'Panaji', 'Imphal', 'Dispur',
  'UP', 'Bihar', 'Rajasthan', 'Maharashtra', 'Gujarat', 'Karnataka', 'Tamil Nadu',
  'Telangana', 'Andhra', 'Kerala', 'West Bengal', 'Odisha', 'Assam', 'Punjab',
  'Haryana', 'Jharkhand', 'Chhattisgarh', 'Uttarakhand', 'HP', 'J&K', 'Ladakh',
  'Varanasi', 'Allahabad', 'Ayodhya', 'Mathura', 'Agra', 'Kanpur', 'Meerut',
  'Surat', 'Vadodara', 'Rajkot', 'Nashik', 'Nagpur', 'Aurangabad', 'Thane',
  'India', 'Bharat',
  // Hindi
  'दिल्ली', 'मुंबई', 'उत्तर प्रदेश', 'बिहार', 'राजस्थान', 'मध्य प्रदेश',
]

// ─── Tier-1: Keyword scoring ─────────────────────────────────────────────────

export async function scoreSentiment(text: string): Promise<SentimentScore> {
  const lower = text.toLowerCase()

  // Score
  let score = 0
  for (const w of POS_KEYWORDS)  if (lower.includes(w.toLowerCase())) score += 0.3
  for (const w of NEG_KEYWORDS)  if (lower.includes(w.toLowerCase())) score -= 0.3
  for (const w of CRISIS_KEYWORDS) if (lower.includes(w.toLowerCase())) score -= 0.6

  score = Math.max(-1, Math.min(1, score))

  const sentiment: Sentiment =
    score > 0.15 ? 'positive' :
    score < -0.15 ? 'negative' : 'neutral'

  // Urgency
  const isCrisis = CRISIS_KEYWORDS.some(k => lower.includes(k.toLowerCase()))
  const isHighOpp = OPP_ATTACK_KEYWORDS.some(k => lower.includes(k.toLowerCase())) && score < 0
  const urgency: 'high' | 'medium' | 'low' =
    isCrisis || (score < -0.5) ? 'high' :
    isHighOpp || (score < -0.2) ? 'medium' : 'low'

  // Opp risk score (0-100)
  const oppRisk = Math.round(
    Math.min(100, Math.max(0,
      OPP_ATTACK_KEYWORDS.filter(k => lower.includes(k.toLowerCase())).length * 20 +
      (score < 0 ? Math.abs(score) * 40 : 0)
    ))
  )

  // Extract geo tags
  const geoTags = GEO_TERMS.filter(g => text.toLowerCase().includes(g.toLowerCase()))

  // Extract topics from crisis/opp keywords present
  const topics: string[] = []
  if (isCrisis) topics.push('Crisis')
  if (score > 0.3) topics.push('Achievement')
  if (lower.includes('scheme') || lower.includes('योजना')) topics.push('Scheme')
  if (lower.includes('infrastructure') || lower.includes('निर्माण')) topics.push('Infrastructure')
  if (lower.includes('election') || lower.includes('चुनाव')) topics.push('Election')
  if (isHighOpp) topics.push('Opposition Attack')

  return {
    sentiment,
    score,
    urgency,
    topics,
    geoTags,
    entities: [],
    oppRisk,
    confidence: 0.6, // keyword-based is moderate confidence
    method: 'keyword',
  }
}

// ─── Tier-2: Claude AI sentiment via Supabase edge function ─────────────────

interface ClaudeSentimentResponse {
  items: Array<{
    index:      number
    sentiment:  Sentiment
    score:      number            // -1 to 1
    urgency:    'high' | 'medium' | 'low'
    topics:     string[]
    geoTags:    string[]
    entities:   string[]
    summary:    string            // 1-sentence AI summary
    oppRisk:    number            // 0-100
  }>
}

const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || ''
const SUPABASE_ANON = import.meta.env.VITE_SUPABASE_ANON_KEY || ''

export async function scoreSentimentBatch(
  texts: string[],
): Promise<SentimentScore[]> {
  if (!SUPABASE_URL || !texts.length) {
    // Fallback: run keyword scoring for each
    return Promise.all(texts.map(t => scoreSentiment(t)))
  }

  try {
    const res = await fetch(
      `${SUPABASE_URL}/functions/v1/bm-sentiment`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${SUPABASE_ANON}`,
        },
        body: JSON.stringify({ texts }),
        signal: AbortSignal.timeout(20_000),
      }
    )

    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const data: ClaudeSentimentResponse = await res.json()

    return data.items.map(item => ({
      sentiment:  item.sentiment,
      score:      item.score,
      urgency:    item.urgency,
      topics:     item.topics,
      geoTags:    item.geoTags,
      entities:   item.entities,
      aiSummary:  item.summary,
      oppRisk:    item.oppRisk,
      confidence: 0.9,
      method:     'claude' as const,
    }))
  } catch {
    // Graceful fallback to keyword scoring
    return Promise.all(texts.map(t => scoreSentiment(t)))
  }
}

// ─── Convenience: enrich a feed item in place ────────────────────────────────

export function applyScoreToItem(
  item: Record<string, unknown>,
  score: SentimentScore,
): void {
  item.sentiment   = score.sentiment
  item.tone        = Math.round(score.score * 5) // -5 to +5 for DB
  item.topic_tags  = [...(item.topic_tags as string[] ?? []), ...score.topics]
  item.geo_tags    = [...new Set([...(item.geo_tags as string[] ?? []), ...score.geoTags])]
  if (score.aiSummary) item.ai_summary = score.aiSummary
}
