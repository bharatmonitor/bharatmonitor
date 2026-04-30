// ============================================================
// BharatMonitor — Quota Manager
//
// Enforces per-account daily limits:
//   - 3 external API search calls per day
//   - 100 total items per day
//   - Distribution: 5 YT + 25 News+Google + 70 Social
//
// Uses in-memory primary store + localStorage fallback
// Works in private browsing (sessionStorage not reliable)
// ============================================================

interface QuotaState {
  date: string
  searches: number
  items: number
  yt: number
  news: number
  social: number
  exceeded: Record<string, number>  // api -> timestamp
}

// In-memory store (survives page nav, not page refresh - that's fine)
const inMemory: Record<string, QuotaState> = {}

const TODAY = () => new Date().toDateString()
const LS_KEY = 'bm-quota-v2'

function loadState(accountId: string): QuotaState {
  // Check in-memory first
  if (inMemory[accountId] && inMemory[accountId].date === TODAY()) {
    return inMemory[accountId]
  }
  // Try localStorage
  try {
    const raw = localStorage.getItem(`${LS_KEY}-${accountId}`)
    if (raw) {
      const s = JSON.parse(raw) as QuotaState
      if (s.date === TODAY()) {
        inMemory[accountId] = s
        return s
      }
    }
  } catch {}
  // Fresh state for today
  const fresh: QuotaState = {
    date: TODAY(), searches: 0, items: 0, yt: 0, news: 0, social: 0, exceeded: {}
  }
  inMemory[accountId] = fresh
  return fresh
}

function saveState(accountId: string, state: QuotaState) {
  inMemory[accountId] = state
  try { localStorage.setItem(`${LS_KEY}-${accountId}`, JSON.stringify(state)) } catch {}
}

// ─── Public API ───────────────────────────────────────────────────────────────

export const DAILY_LIMITS = {
  searches: 3,      // Max external API search calls per day
  items:    100,    // Max total items stored per day
  yt:       5,      // Max YouTube videos
  news:     25,     // Max news + Google results
  social:   70,     // Max X + Reddit + Meta + others
}

export function canSearch(accountId: string): boolean {
  const s = loadState(accountId)
  return s.searches < DAILY_LIMITS.searches
}

export function canAddItems(accountId: string, type: 'yt' | 'news' | 'social', count = 1): boolean {
  const s = loadState(accountId)
  if (s.items >= DAILY_LIMITS.items) return false
  if (type === 'yt'     && s.yt     >= DAILY_LIMITS.yt)     return false
  if (type === 'news'   && s.news   >= DAILY_LIMITS.news)   return false
  if (type === 'social' && s.social >= DAILY_LIMITS.social) return false
  return true
}

export function getRemainingItems(accountId: string): { yt: number; news: number; social: number; total: number } {
  const s = loadState(accountId)
  return {
    yt:     Math.max(0, DAILY_LIMITS.yt     - s.yt),
    news:   Math.max(0, DAILY_LIMITS.news   - s.news),
    social: Math.max(0, DAILY_LIMITS.social - s.social),
    total:  Math.max(0, DAILY_LIMITS.items  - s.items),
  }
}

export function recordSearch(accountId: string) {
  const s = loadState(accountId)
  s.searches = Math.min(s.searches + 1, DAILY_LIMITS.searches + 5) // allow slight overflow
  saveState(accountId, s)
}

export function recordItems(accountId: string, type: 'yt' | 'news' | 'social', count: number) {
  const s = loadState(accountId)
  s.items   += count
  s[type]   += count
  saveState(accountId, s)
}

export function markApiExceeded(api: string, accountId: string) {
  const s = loadState(accountId)
  s.exceeded[api] = Date.now()
  saveState(accountId, s)
  console.warn(`[Quota] ${api} marked exceeded for today (account: ${accountId})`)
}

export function isApiExceeded(api: string, accountId: string): boolean {
  const s = loadState(accountId)
  const ts = s.exceeded[api]
  if (!ts) return false
  // Exceeded flag lasts 23 hours (resets with new day)
  return (Date.now() - ts) < 23 * 60 * 60 * 1000
}

export function getDailyStatus(accountId: string): QuotaState & { pct: number } {
  const s = loadState(accountId)
  return { ...s, pct: Math.round((s.items / DAILY_LIMITS.items) * 100) }
}

export function resetQuota(accountId: string) {
  const fresh: QuotaState = { date: TODAY(), searches: 0, items: 0, yt: 0, news: 0, social: 0, exceeded: {} }
  saveState(accountId, fresh)
}
