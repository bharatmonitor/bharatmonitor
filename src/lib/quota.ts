// ============================================================
// BharatMonitor — Quota & Fuel System
//
// Each account gets a daily allowance:
//   3 searches/day + 100 items/day
//   Breakdown: 5 YT + 25 News/Google + 70 X/Meta/Reddit/others
//
// God account can grant +3 searches / +100 items to any account
// Quota resets at midnight IST (UTC+5:30)
// Stored in: Supabase accounts table + localStorage cache
// ============================================================

import { supabaseAdmin } from '@/lib/supabase'

export interface DailyQuota {
  accountId:       string
  date:            string   // YYYY-MM-DD in IST
  searchesUsed:    number
  searchesLimit:   number
  itemsUsed:       number
  itemsLimit:      number
  bonusSearches:   number   // granted by God account
  bonusItems:      number   // granted by God account
}

export interface QuotaBreakdown {
  youtube:  number   // max 5
  news:     number   // max 25
  social:   number   // max 70 (X + Meta + Reddit + others)
}

const QUOTA_LS_KEY = 'bm-daily-quota-v2'
const DEFAULT_SEARCHES = 3
const DEFAULT_ITEMS    = 100
const BREAKDOWN: QuotaBreakdown = { youtube: 5, news: 25, social: 70 }

// ─── IST date string ──────────────────────────────────────────────────────────
function todayIST(): string {
  const now = new Date()
  const ist = new Date(now.getTime() + (5.5 * 60 * 60 * 1000))
  return ist.toISOString().substring(0, 10)
}

// ─── Read quota from localStorage ────────────────────────────────────────────
function readLocalQuota(accountId: string): DailyQuota | null {
  try {
    const raw = localStorage.getItem(`${QUOTA_LS_KEY}-${accountId}`)
    if (!raw) return null
    const q: DailyQuota = JSON.parse(raw)
    // Reset if new day
    if (q.date !== todayIST()) return null
    return q
  } catch { return null }
}

function writeLocalQuota(q: DailyQuota) {
  try { localStorage.setItem(`${QUOTA_LS_KEY}-${q.accountId}`, JSON.stringify(q)) } catch {}
}

// ─── Get or init quota for today ─────────────────────────────────────────────
export function getQuota(accountId: string, isGodAccount = false): DailyQuota {
  // God account has unlimited quota
  if (isGodAccount || accountId === 'god-account') {
    return {
      accountId, date: todayIST(),
      searchesUsed: 0, searchesLimit: 9999,
      itemsUsed: 0,    itemsLimit: 9999,
      bonusSearches: 0, bonusItems: 0,
    }
  }

  const existing = readLocalQuota(accountId)
  if (existing) return existing

  // New day — load bonus from DB account record
  const bonus = getBonusFromStorage(accountId)
  const q: DailyQuota = {
    accountId,
    date:           todayIST(),
    searchesUsed:   0,
    searchesLimit:  DEFAULT_SEARCHES + bonus.searches,
    itemsUsed:      0,
    itemsLimit:     DEFAULT_ITEMS + bonus.items,
    bonusSearches:  bonus.searches,
    bonusItems:     bonus.items,
  }
  writeLocalQuota(q)
  return q
}

// Bonus granted by God account, stored in localStorage
function getBonusFromStorage(accountId: string): { searches: number; items: number } {
  try {
    const raw = localStorage.getItem(`bm-quota-bonus-${accountId}`)
    if (!raw) return { searches: 0, items: 0 }
    return JSON.parse(raw)
  } catch { return { searches: 0, items: 0 } }
}

// ─── Check if search is allowed ───────────────────────────────────────────────
export function canSearch(accountId: string, isGodAccount = false): boolean {
  const q = getQuota(accountId, isGodAccount)
  return q.searchesUsed < q.searchesLimit
}

export function canFetchItems(accountId: string, isGodAccount = false): boolean {
  const q = getQuota(accountId, isGodAccount)
  return q.itemsUsed < q.itemsLimit
}

// ─── Record a search ──────────────────────────────────────────────────────────
export function recordSearch(accountId: string, itemsFetched: number): DailyQuota {
  const q = getQuota(accountId)
  if (accountId === 'god-account') return q
  q.searchesUsed = Math.min(q.searchesUsed + 1, q.searchesLimit)
  q.itemsUsed    = Math.min(q.itemsUsed + itemsFetched, q.itemsLimit)
  writeLocalQuota(q)
  return q
}

// ─── Fuel level (0–100) ───────────────────────────────────────────────────────
export function getFuelLevel(accountId: string, isGodAccount = false): number {
  if (isGodAccount || accountId === 'god-account') return 100
  const q = getQuota(accountId)
  const searchPct = 1 - (q.searchesUsed / Math.max(q.searchesLimit, 1))
  const itemPct   = 1 - (q.itemsUsed    / Math.max(q.itemsLimit,    1))
  return Math.round(Math.min(searchPct, itemPct) * 100)
}

// ─── God account grants bonus ─────────────────────────────────────────────────
export function grantBonus(targetAccountId: string, extraSearches: number, extraItems: number) {
  try {
    const current = getBonusFromStorage(targetAccountId)
    const updated = {
      searches: current.searches + extraSearches,
      items:    current.items + extraItems,
    }
    localStorage.setItem(`bm-quota-bonus-${targetAccountId}`, JSON.stringify(updated))
    // Force quota refresh for that account
    localStorage.removeItem(`${QUOTA_LS_KEY}-${targetAccountId}`)
    console.log(`[Quota] Granted +${extraSearches} searches, +${extraItems} items to ${targetAccountId}`)
    return true
  } catch { return false }
}

// ─── Get max items per source type ────────────────────────────────────────────
export function getSourceLimits(accountId: string, isGodAccount = false): QuotaBreakdown {
  if (isGodAccount || accountId === 'god-account') {
    return { youtube: 20, news: 100, social: 100 }
  }
  const q = getQuota(accountId)
  const remaining = Math.max(q.itemsLimit - q.itemsUsed, 0)
  if (remaining <= 0) return { youtube: 0, news: 0, social: 0 }
  // Scale down if less than full quota remaining
  const scale = Math.min(remaining / DEFAULT_ITEMS, 1)
  return {
    youtube: Math.ceil(BREAKDOWN.youtube * scale),
    news:    Math.ceil(BREAKDOWN.news    * scale),
    social:  Math.ceil(BREAKDOWN.social  * scale),
  }
}

// ─── Format for display ───────────────────────────────────────────────────────
export function formatQuota(q: DailyQuota): string {
  return `${q.searchesLimit - q.searchesUsed} searches · ${q.itemsLimit - q.itemsUsed} items left today`
}
