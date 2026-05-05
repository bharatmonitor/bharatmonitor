// ============================================================
// BharatMonitor — Quota & Fuel System v2
//
// DAILY LIMITS PER ACCOUNT:
//   3 searches/day
//   100 data points/day:
//     - 5  Google News articles
//     - 10 YouTube videos  
//     - 85 X/Twitter + Meta + Reddit + others
//
// God account: UNLIMITED
// God can grant bonus to any account
// Resets at midnight IST (UTC+5:30)
// ============================================================

export interface DailyQuota {
  accountId:      string
  date:           string
  searchesUsed:   number
  searchesLimit:  number
  newsUsed:       number
  newsLimit:      number
  youtubeUsed:    number
  youtubeLimit:   number
  socialUsed:     number
  socialLimit:    number
  bonusSearches:  number
  bonusNews:      number
  bonusYoutube:   number
  bonusSocial:    number
}

export interface QuotaLimits {
  searches: number
  news:     number
  youtube:  number
  social:   number
}

const DEFAULT: QuotaLimits = { searches: 3, news: 5, youtube: 10, social: 85 }
const LS = 'bm-quota-v3'

function todayIST(): string {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  return ist.toISOString().substring(0, 10)
}

function hoursUntilMidnightIST(): number {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000)
  const midnight = new Date(ist)
  midnight.setHours(24, 0, 0, 0)
  return Math.ceil((midnight.getTime() - ist.getTime()) / 3_600_000)
}

export function getHoursUntilReset(): number { return hoursUntilMidnightIST() }

function getBonus(accountId: string): { searches: number; news: number; youtube: number; social: number } {
  try { return JSON.parse(localStorage.getItem(`bm-bonus-${accountId}`) || '{}') } catch { return {} }
}

export function getQuota(accountId: string, isGod = false): DailyQuota {
  if (isGod || accountId === 'god-account') {
    return { accountId, date: todayIST(), searchesUsed: 0, searchesLimit: 9999, newsUsed: 0, newsLimit: 9999, youtubeUsed: 0, youtubeLimit: 9999, socialUsed: 0, socialLimit: 9999, bonusSearches: 0, bonusNews: 0, bonusYoutube: 0, bonusSocial: 0 }
  }
  try {
    const raw = localStorage.getItem(`${LS}-${accountId}`)
    if (raw) {
      const q: DailyQuota = JSON.parse(raw)
      if (q.date === todayIST()) return q
    }
  } catch {}
  // Fresh quota for today
  const bonus = getBonus(accountId)
  const q: DailyQuota = {
    accountId, date: todayIST(),
    searchesUsed: 0, searchesLimit: DEFAULT.searches + (bonus.searches || 0),
    newsUsed:     0, newsLimit:     DEFAULT.news     + (bonus.news     || 0),
    youtubeUsed:  0, youtubeLimit:  DEFAULT.youtube  + (bonus.youtube  || 0),
    socialUsed:   0, socialLimit:   DEFAULT.social   + (bonus.social   || 0),
    bonusSearches: bonus.searches || 0, bonusNews: bonus.news || 0,
    bonusYoutube: bonus.youtube || 0, bonusSocial: bonus.social || 0,
  }
  try { localStorage.setItem(`${LS}-${accountId}`, JSON.stringify(q)) } catch {}
  return q
}

function saveQuota(q: DailyQuota) {
  try { localStorage.setItem(`${LS}-${q.accountId}`, JSON.stringify(q)) } catch {}
}

export function canSearch(accountId: string, isGod = false): boolean {
  if (isGod || accountId === 'god-account') return true
  const q = getQuota(accountId)
  return q.searchesUsed < q.searchesLimit
}

export function getRemainingLimits(accountId: string, isGod = false): QuotaLimits {
  if (isGod || accountId === 'god-account') return { searches: 9999, news: 9999, youtube: 9999, social: 9999 }
  const q = getQuota(accountId)
  return {
    searches: Math.max(q.searchesLimit - q.searchesUsed, 0),
    news:     Math.max(q.newsLimit     - q.newsUsed,     0),
    youtube:  Math.max(q.youtubeLimit  - q.youtubeUsed,  0),
    social:   Math.max(q.socialLimit   - q.socialUsed,   0),
  }
}

export function recordSearch(accountId: string, used: { news?: number; youtube?: number; social?: number }): DailyQuota {
  if (accountId === 'god-account') return getQuota(accountId, true)
  const q = getQuota(accountId)
  q.searchesUsed = Math.min(q.searchesUsed + 1,              q.searchesLimit)
  q.newsUsed     = Math.min(q.newsUsed     + (used.news     || 0), q.newsLimit)
  q.youtubeUsed  = Math.min(q.youtubeUsed  + (used.youtube  || 0), q.youtubeLimit)
  q.socialUsed   = Math.min(q.socialUsed   + (used.social   || 0), q.socialLimit)
  saveQuota(q)
  return q
}

export function getFuelLevel(accountId: string, isGod = false): number {
  if (isGod || accountId === 'god-account') return 100
  const q = getQuota(accountId)
  const searchPct = 1 - q.searchesUsed / Math.max(q.searchesLimit, 1)
  const newsPct   = 1 - q.newsUsed     / Math.max(q.newsLimit, 1)
  const ytPct     = 1 - q.youtubeUsed  / Math.max(q.youtubeLimit, 1)
  const socialPct = 1 - q.socialUsed   / Math.max(q.socialLimit, 1)
  return Math.round(Math.min(searchPct, newsPct, ytPct, socialPct) * 100)
}

export function getFuelBreakdown(accountId: string, isGod = false) {
  const q = getQuota(accountId, isGod)
  return {
    searches: { used: q.searchesUsed, limit: q.searchesLimit },
    news:     { used: q.newsUsed,     limit: q.newsLimit },
    youtube:  { used: q.youtubeUsed,  limit: q.youtubeLimit },
    social:   { used: q.socialUsed,   limit: q.socialLimit },
  }
}

// God grants bonus to specific account
export function grantBonus(targetId: string, extra: Partial<QuotaLimits>): boolean {
  try {
    const current = getBonus(targetId)
    const updated = {
      searches: (current.searches || 0) + (extra.searches || 0),
      news:     (current.news     || 0) + (extra.news     || 0),
      youtube:  (current.youtube  || 0) + (extra.youtube  || 0),
      social:   (current.social   || 0) + (extra.social   || 0),
    }
    localStorage.setItem(`bm-bonus-${targetId}`, JSON.stringify(updated))
    // Force quota reset so new limits apply today
    localStorage.removeItem(`${LS}-${targetId}`)
    return true
  } catch { return false }
}

// God sets custom limits for an account (overrides defaults)
export function setCustomLimits(targetId: string, limits: QuotaLimits): boolean {
  try {
    // Store as bonus = limits - defaults
    const bonus = {
      searches: Math.max(limits.searches - DEFAULT.searches, 0),
      news:     Math.max(limits.news     - DEFAULT.news,     0),
      youtube:  Math.max(limits.youtube  - DEFAULT.youtube,  0),
      social:   Math.max(limits.social   - DEFAULT.social,   0),
    }
    localStorage.setItem(`bm-bonus-${targetId}`, JSON.stringify(bonus))
    localStorage.removeItem(`${LS}-${targetId}`)
    return true
  } catch { return false }
}

export function formatQuotaLine(accountId: string, isGod = false): string {
  if (isGod) return 'UNLIMITED'
  const q = getQuota(accountId)
  const searches = q.searchesLimit - q.searchesUsed
  const items = (q.newsLimit - q.newsUsed) + (q.youtubeLimit - q.youtubeUsed) + (q.socialLimit - q.socialUsed)
  return `${searches} searches · ${items} items left · resets in ${hoursUntilMidnightIST()}h`
}
