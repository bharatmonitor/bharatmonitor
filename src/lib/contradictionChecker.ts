// ============================================================
// BharatMonitor — AI Quote Contradiction Checker
//
// Scans incoming feed items for quotes by tracked politicians.
// For each quote found, calls Claude to:
//   1. Identify the speaker and quote
//   2. Search Google CSE for historical statements by same person
//   3. Compare current vs historical using Claude AI
//   4. Flag contradictions with a score, type and evidence
//
// This runs client-side (browser) using Claude via Anthropic API
// routed through Supabase edge function to keep the API key safe.
//
// Flow:
//   feed item → extractQuotes() → findHistoricalContext()
//   → claudeContradictionCheck() → saveContradiction()
// ============================================================

import { supabaseAdmin } from '@/lib/supabase'
import type { FeedItem, Contradiction } from '@/types'

const FUNCTIONS_URL = import.meta.env.VITE_SUPABASE_URL
  ? `${import.meta.env.VITE_SUPABASE_URL}/functions/v1`
  : 'https://ylajerluygbeiqybkgtx.supabase.co/functions/v1'

const CSE_KEY = import.meta.env.VITE_GOOGLE_CSE_KEY || ''
const CSE_CX  = import.meta.env.VITE_GOOGLE_CSE_CX  || ''

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ContradictionCheckResult {
  checked:  number
  flagged:  number
  saved:    number
  results:  DetectedContradiction[]
  errors:   string[]
}

export interface DetectedContradiction {
  feedItemId:          string
  politicianName:      string
  currentQuote:        string
  historicalQuote:     string
  historicalDate:      string
  historicalSource:    string
  contradictionScore:  number   // 0–100
  contradictionType:   'flip' | 'contradiction' | 'vote_record' | 'data_gap'
  confidence:          number   // 0–1
  reasoning:           string
}

// ─── Step 1: Extract potential quotes from feed item ─────────────────────────

function extractQuoteSignals(item: FeedItem): string[] {
  const text = `${item.headline} ${item.body || ''}`
  const signals: string[] = []

  // Direct quote patterns
  const quotePatterns = [
    /["""]([^"""]{20,250})["""]/g,          // curly/straight quotes
    /said[,:]?\s+["""]([^"""]{20,200})["""]/gi,  // "said that …"
    /stated[,:]?\s+["""]([^"""]{20,200})["""]/gi,
    /claimed[,:]?\s+["""]([^"""]{20,200})["""]/gi,
    /announced[,:]?\s+["""]([^"""]{20,200})["""]/gi,
    /promised[,:]?\s+["""]([^"""]{20,200})["""]/gi,
  ]

  for (const rx of quotePatterns) {
    let m: RegExpExecArray | null
    while ((m = rx.exec(text)) !== null) {
      if (m[1].split(' ').length >= 4) signals.push(m[1].trim())
    }
  }

  // If no direct quotes, use the headline as a statement signal
  if (signals.length === 0 && item.headline.length > 30) {
    signals.push(item.headline)
  }

  return [...new Set(signals)].slice(0, 3) // max 3 per item
}

// ─── Step 2: Identify which tracked politician is referenced ──────────────────

function identifyPolitician(
  item: FeedItem,
  trackedNames: string[],
): string | null {
  if (!trackedNames.length) return null
  const text = `${item.headline} ${item.body || ''} ${item.source}`.toLowerCase()
  for (const name of trackedNames) {
    const parts = name.toLowerCase().split(' ')
    // Match if any significant part (>3 chars) of the name appears
    if (parts.some(p => p.length > 3 && text.includes(p))) return name
  }
  return null
}

// ─── Step 3: Google CSE — search for historical statements ────────────────────

interface HistoricalResult {
  snippet:   string
  url:       string
  title:     string
  date:      string
}

async function fetchHistoricalStatements(
  politicianName: string,
  topic: string,
  maxResults = 5,
): Promise<HistoricalResult[]> {
  if (!CSE_KEY || !CSE_CX) return []

  // Search for historical statements — exclude recent 90 days to find old positions
  const ninetyDaysAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000)
  const until = ninetyDaysAgo.toISOString().substring(0, 10).replace(/-/g, '/')

  const q = `"${politicianName}" ${topic} site:ndtv.com OR site:thehindu.com OR site:hindustantimes.com OR site:timesofindia.com OR site:indianexpress.com OR site:pib.gov.in OR site:sansad.in OR site:loksabha.nic.in`

  try {
    const url = new URL('https://www.googleapis.com/customsearch/v1')
    url.searchParams.set('key', CSE_KEY)
    url.searchParams.set('cx', CSE_CX)
    url.searchParams.set('q', q)
    url.searchParams.set('num', String(Math.min(maxResults, 10)))
    url.searchParams.set('tbs', `cdr:1,cd_max:${until}`)
    url.searchParams.set('gl', 'in')

    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(10000) })
    if (!res.ok) return []

    const data = await res.json()
    return (data?.items ?? []).map((r: any): HistoricalResult => {
      // Try to extract date from metatags or snippet
      const dateMeta = r.pagemap?.metatags?.[0]?.['article:published_time']
        || r.pagemap?.metatags?.[0]?.['og:updated_time']
        || ''
      const dateMatch = /(\d{4}-\d{2}-\d{2}|\d{1,2}\s+\w+\s+\d{4}|\w+\s+\d{1,2},?\s+\d{4})/.exec(r.snippet)
      return {
        snippet: r.snippet || '',
        url:     r.link || '',
        title:   r.title || '',
        date:    dateMeta ? dateMeta.substring(0, 10) : (dateMatch ? dateMatch[1] : 'unknown'),
      }
    })
  } catch {
    return []
  }
}

// ─── Step 4: Claude contradiction check via edge function ─────────────────────

interface ClaudeContradictionResponse {
  hasContradiction:   boolean
  score:              number
  type:               'flip' | 'contradiction' | 'vote_record' | 'data_gap' | 'none'
  historicalQuote:    string
  historicalDate:     string
  historicalSource:   string
  confidence:         number
  reasoning:          string
}

async function claudeCheckContradiction(
  politicianName: string,
  currentStatement: string,
  historicalResults: HistoricalResult[],
): Promise<ClaudeContradictionResponse | null> {
  if (!historicalResults.length) return null

  const historicalContext = historicalResults
    .map((r, i) => `[${i + 1}] (${r.date}) ${r.title}\n"${r.snippet}"\nSource: ${r.url}`)
    .join('\n\n')

  const prompt = `You are an Indian political fact-checker analysing statements by ${politicianName}.

CURRENT STATEMENT (recent, from news/social media):
"${currentStatement}"

HISTORICAL STATEMENTS/RECORDS (from the past 5 years):
${historicalContext}

Task: Check if the current statement CONTRADICTS or FLIPS a previous position.

Types:
- "flip": Clear reversal of stated position (e.g., promised X, now says Y)
- "contradiction": Statement contradicts known facts or prior statements
- "vote_record": Current claim contradicts their voting/policy record
- "data_gap": Claim contradicts verifiable data (economic, development stats)
- "none": No meaningful contradiction found

Return ONLY valid JSON (no markdown):
{
  "hasContradiction": true/false,
  "score": 0-100 (confidence the contradiction is real and significant),
  "type": "flip"|"contradiction"|"vote_record"|"data_gap"|"none",
  "historicalQuote": "the relevant historical statement that contradicts (verbatim from sources above)",
  "historicalDate": "YYYY-MM or YYYY-MM-DD from sources above",
  "historicalSource": "source name (e.g. NDTV, Lok Sabha record)",
  "confidence": 0.0-1.0,
  "reasoning": "one sentence explaining the contradiction clearly"
}

Only flag genuine contradictions (score >= 60). If no clear contradiction, set hasContradiction: false.`

  try {
    // Route through Supabase edge function to keep Anthropic key server-side
    const SERVICE_KEY = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''
    const res = await fetch(`${FUNCTIONS_URL}/bm-contradiction-check`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(SERVICE_KEY ? { Authorization: `Bearer ${SERVICE_KEY}` } : {}),
      },
      body: JSON.stringify({ prompt }),
      signal: AbortSignal.timeout(25000),
    })

    if (!res.ok) {
      // Edge function not deployed yet — use direct Anthropic call as fallback
      // This requires VITE_ANTHROPIC_KEY which is NOT recommended for prod
      // but acceptable during development/testing
      console.warn('[ContradictionChecker] Edge function unavailable, checking fallback...')
      return await claudeDirectFallback(prompt)
    }

    const data = await res.json()
    if (data?.result) return JSON.parse(data.result)
    return null
  } catch (e) {
    console.warn('[ContradictionChecker] Claude check error:', e)
    return null
  }
}

// Fallback: direct client-side call (dev only, not for prod)
async function claudeDirectFallback(prompt: string): Promise<ClaudeContradictionResponse | null> {
  // Check if there's a direct key available (should only be in dev .env.local)
  const directKey = import.meta.env.VITE_ANTHROPIC_KEY_DEV || ''
  if (!directKey) return null

  try {
    const res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': directKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 600,
        messages: [{ role: 'user', content: prompt }],
      }),
      signal: AbortSignal.timeout(20000),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.content?.[0]?.text || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

// ─── Step 5: Save contradiction to Supabase ───────────────────────────────────

async function saveContradiction(
  accountId: string,
  feedItemId: string,
  detected: DetectedContradiction,
): Promise<boolean> {
  try {
    const row = {
      id:                   `contra-${feedItemId}-${Date.now()}`,
      feed_item_id:         feedItemId,
      account_id:           accountId,
      politician_name:      detected.politicianName,
      current_quote:        detected.currentQuote.substring(0, 500),
      historical_quote:     detected.historicalQuote.substring(0, 500),
      historical_date:      detected.historicalDate || new Date().toISOString().substring(0, 10),
      historical_source:    detected.historicalSource || 'Web archive',
      contradiction_score:  detected.contradictionScore,
      contradiction_type:   detected.contradictionType,
      evidence_source:      detected.historicalSource?.includes('Lok Sabha') ? 'Parliament Record'
                          : detected.historicalSource?.includes('RTI') ? 'RTI'
                          : 'Media Archive',
      status:               'flagged' as const,
      reasoning:            detected.reasoning || '',
      confidence:           detected.confidence || 0,
      created_at:           new Date().toISOString(),
    }

    const { error } = await supabaseAdmin
      .from('contradictions')
      .upsert(row, { onConflict: 'id', ignoreDuplicates: true })

    if (error) {
      console.warn('[ContradictionChecker] Save error:', error.message)
      return false
    }
    return true
  } catch (e) {
    console.warn('[ContradictionChecker] Save exception:', e)
    return false
  }
}

// ─── Main: run contradiction check on a batch of feed items ──────────────────

export async function runContradictionCheck(
  accountId: string,
  items: FeedItem[],
  trackedPoliticianNames: string[],
  options?: {
    maxItems?:    number   // default 10 per run to limit API usage
    minScore?:    number   // default 60 — only flag if score >= this
    saveToDb?:    boolean  // default true
  },
): Promise<ContradictionCheckResult> {
  const maxItems = options?.maxItems ?? 10
  const minScore = options?.minScore ?? 60
  const saveToDb = options?.saveToDb ?? true

  const result: ContradictionCheckResult = {
    checked: 0, flagged: 0, saved: 0,
    results: [], errors: [],
  }

  if (!trackedPoliticianNames.length) {
    result.errors.push('No tracked politicians configured')
    return result
  }

  // Filter to items that likely contain politician statements
  const candidates = items
    .filter(item => {
      const text = `${item.headline} ${item.body || ''}`.toLowerCase()
      return trackedPoliticianNames.some(name =>
        name.toLowerCase().split(' ').some(part => part.length > 3 && text.includes(part))
      )
    })
    .slice(0, maxItems)

  console.log(`[ContradictionChecker] Checking ${candidates.length} candidates for ${trackedPoliticianNames.length} politicians`)

  for (const item of candidates) {
    const politicianName = identifyPolitician(item, trackedPoliticianNames)
    if (!politicianName) continue

    const quotes = extractQuoteSignals(item)
    if (!quotes.length) continue

    result.checked++

    for (const quote of quotes.slice(0, 2)) {
      try {
        // Get a topic word for historical search
        const topicWords = quote.toLowerCase()
          .split(/\s+/)
          .filter(w => w.length > 5 && !['about', 'their', 'would', 'could', 'should', 'which', 'these', 'those'].includes(w))
          .slice(0, 3)
          .join(' ')

        // Fetch historical statements
        const historical = await fetchHistoricalStatements(
          politicianName,
          topicWords || quote.substring(0, 50),
          5,
        )

        if (!historical.length) continue

        // Run Claude check
        const check = await claudeCheckContradiction(politicianName, quote, historical)

        if (!check || !check.hasContradiction || check.score < minScore) continue

        const detected: DetectedContradiction = {
          feedItemId:         item.id,
          politicianName,
          currentQuote:       quote,
          historicalQuote:    check.historicalQuote,
          historicalDate:     check.historicalDate,
          historicalSource:   check.historicalSource,
          contradictionScore: check.score,
          contradictionType:  check.type === 'none' ? 'contradiction' : check.type,
          confidence:         check.confidence,
          reasoning:          check.reasoning,
        }

        result.results.push(detected)
        result.flagged++

        if (saveToDb) {
          const saved = await saveContradiction(accountId, item.id, detected)
          if (saved) result.saved++
        }

        // Don't hammer API — short pause between checks
        await new Promise(r => setTimeout(r, 500))

      } catch (e: any) {
        result.errors.push(`Item ${item.id}: ${e.message}`)
      }
    }
  }

  console.log(`[ContradictionChecker] Done — checked: ${result.checked}, flagged: ${result.flagged}, saved: ${result.saved}`)
  return result
}

// ─── Quick check: single item (used from FeedDetailPanel) ─────────────────────

export async function checkSingleItem(
  accountId: string,
  item: FeedItem,
  trackedPoliticianNames: string[],
): Promise<DetectedContradiction | null> {
  const result = await runContradictionCheck(accountId, [item], trackedPoliticianNames, {
    maxItems: 1,
    minScore: 50, // slightly lower threshold for on-demand single checks
    saveToDb: true,
  })
  return result.results[0] || null
}
