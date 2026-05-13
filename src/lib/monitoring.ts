// ============================================================
// BharatMonitor — Error Monitoring + Fact-Check APIs
//
// ── 1. SENTRY (Error Monitoring) ────────────────────────────
// Tracks crashes, JS errors, slow network requests, and
// React component errors — with full stack traces.
//
// HOW TO SET UP:
//   1. Go to https://sentry.io → Create account (free tier: 5K errors/month)
//   2. New Project → React
//   3. Copy your DSN (looks like: https://abc123@o4504.ingest.sentry.io/12345)
//   4. Add to .env:  VITE_SENTRY_DSN=https://...
//   5. Install: npm install @sentry/react
//
// ── 2. CLAIMBUSTER (AI Fact-Checking) ───────────────────────
// Scores claims as checkworthy (0-1). Free tier: 2000 calls/day.
//
// HOW TO SET UP:
//   1. Go to https://idir.uta.edu/claimbuster/
//   2. Register → get API key
//   3. Add to .env:  VITE_CLAIMBUSTER_KEY=your_key
//
// ── 3. GOOGLE FACT CHECK TOOLS API ──────────────────────────
// Searches fact-checked articles from major fact-checkers.
// Free: 10,000 queries/day.
//
// HOW TO SET UP:
//   1. Go to https://console.cloud.google.com
//   2. Enable "Fact Check Tools API"
//   3. Create API Key (same project as Custom Search)
//   4. Add to .env:  VITE_GOOGLE_CSE_KEY=... (same key works!)
// ============================================================

// ─── Sentry Bootstrap ────────────────────────────────────────────────────────

let _sentryInitialized = false

export async function initSentry() {
  const dsn = import.meta.env.VITE_SENTRY_DSN
  if (!dsn || _sentryInitialized) return

  try {
    // Dynamic import — install with: npm install @sentry/react
    // If not installed, the catch block handles it gracefully
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore — optional peer dependency
    const Sentry = await import('@sentry/react')
    Sentry.init({
      dsn,
      environment:  import.meta.env.MODE,           // 'production' | 'development'
      release:      'bharatmonitor@2.0.0',
      tracesSampleRate: 0.2,                         // 20% of transactions profiled
      replaysSessionSampleRate: 0.05,                // 5% session replays
      replaysOnErrorSampleRate: 1.0,                 // 100% of errored sessions
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText:   true,   // GDPR: mask all user-typed text
          blockAllMedia: false,
        }),
      ],
      // Don't send errors for known non-issues
      ignoreErrors: [
        'ResizeObserver loop limit exceeded',
        'ResizeObserver loop completed',
        'Non-Error promise rejection',
        'Network request failed',
      ],
    })
    _sentryInitialized = true
    console.log('[BM] Sentry initialized')
  } catch (e) {
    console.warn('[BM] Sentry init failed (not installed?):', e)
  }
}

// Manual error capture (call from catch blocks)
export async function captureError(error: Error, context?: Record<string, unknown>) {
  if (!import.meta.env.VITE_SENTRY_DSN) return
  try {
    // eslint-disable-next-line @typescript-eslint/ban-ts-comment
    // @ts-ignore
    const Sentry = await import('@sentry/react')
    Sentry.captureException(error, { extra: context })
  } catch { /* silently skip if Sentry not available */ }
}

// ─── ClaimBuster API ─────────────────────────────────────────────────────────

export interface FactCheckScore {
  text:       string
  score:      number    // 0-1. >0.5 = checkworthy
  checkworthy: boolean
}

/**
 * Score a list of text snippets for fact-check worthiness.
 * Used to flag feed items that contain verifiable claims.
 */
export async function scoreFactCheckWorthiness(texts: string[]): Promise<FactCheckScore[]> {
  const key = import.meta.env.VITE_CLAIMBUSTER_KEY
  if (!key || !texts.length) return texts.map(t => ({ text: t, score: 0, checkworthy: false }))

  const results: FactCheckScore[] = []

  for (const text of texts.slice(0, 10)) { // API limit: batch of 10
    try {
      const url = `https://idir.uta.edu/factcheckapi/score_text/?input_claims=${encodeURIComponent(text.substring(0, 500))}&api_key=${key}`
      const res = await fetch(url, { signal: AbortSignal.timeout(8000) })
      if (!res.ok) { results.push({ text, score: 0, checkworthy: false }); continue }
      const data = await res.json()
      const score = data.results?.[0]?.score ?? 0
      results.push({ text, score, checkworthy: score > 0.5 })
    } catch {
      results.push({ text, score: 0, checkworthy: false })
    }
  }
  return results
}

// ─── Google Fact Check Tools API ─────────────────────────────────────────────

export interface FactCheckClaim {
  text:       string
  claimant?:  string
  claimDate?: string
  claimReview: Array<{
    publisher:    { name: string; site?: string }
    url:          string
    title:        string
    reviewDate:   string
    textualRating: string  // e.g. "False", "Misleading", "Mostly True"
    languageCode:  string
  }>
}

/**
 * Search Google's fact-check index for claims matching a query.
 * Covers fact-checkers: AFP, AltNews, FactChecker.in, Boom, etc.
 */
export async function searchFactChecks(query: string, languageCode = 'en'): Promise<FactCheckClaim[]> {
  const key = import.meta.env.VITE_GOOGLE_CSE_KEY  // reuses the same Google key
  if (!key) return []

  const url = new URL('https://factchecktools.googleapis.com/v1alpha1/claims:search')
  url.searchParams.set('key',          key)
  url.searchParams.set('query',        query)
  url.searchParams.set('languageCode', languageCode)
  url.searchParams.set('maxAgeDays',   '180')
  url.searchParams.set('pageSize',     '10')

  try {
    const res = await fetch(url.toString(), { signal: AbortSignal.timeout(8000) })
    if (!res.ok) return []
    const data = await res.json()
    return (data.claims ?? []).map((c: any) => ({
      text:        c.text,
      claimant:    c.claimant,
      claimDate:   c.claimDate,
      claimReview: (c.claimReview ?? []).map((r: any) => ({
        publisher:     r.publisher,
        url:           r.url,
        title:         r.title,
        reviewDate:    r.reviewDate,
        textualRating: r.textualRating,
        languageCode:  r.languageCode,
      })),
    }))
  } catch { return [] }
}

// ─── Combined enrichment pipeline ────────────────────────────────────────────

/**
 * Enrich a feed item with fact-check data.
 * Returns the item enriched with fact-check ratings if available.
 */
export async function enrichWithFactChecks(
  headline: string,
  keyword:  string,
): Promise<{ factChecks: FactCheckClaim[]; checkworthy: boolean; score: number }> {
  const [factChecks, worthiness] = await Promise.allSettled([
    searchFactChecks(`${keyword} ${headline.substring(0, 80)}`),
    scoreFactCheckWorthiness([headline]),
  ])

  return {
    factChecks:  factChecks.status === 'fulfilled' ? factChecks.value : [],
    checkworthy: worthiness.status === 'fulfilled' ? worthiness.value[0]?.checkworthy ?? false : false,
    score:       worthiness.status === 'fulfilled' ? worthiness.value[0]?.score ?? 0 : 0,
  }
}
