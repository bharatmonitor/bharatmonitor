// src/lib/planLimits.ts
// Account caps per plan (#2 from feedback). Single source of truth.
//   basic = 1 monitored account, mid (advanced) = 5, top (elections) = 15.
// God is uncapped. Enforced both in the UI (disable/hide "create") and
// defensively at create time so it holds platform-wide for every account.
import { supabase } from './supabase'
import type { Tier } from './tiers'

export const ACCOUNT_CAP: Record<Tier, number> = {
  basic: 1,
  advanced: 5,
  elections: 15,
  god: Infinity,
}

export const planLabel = (t: Tier) => ({ basic: 'Basic', advanced: 'Advanced', elections: 'Elections', god: 'God' }[t])

// How many monitored accounts this owner already has.
export async function accountCount(createdBy: string): Promise<number> {
  const { count, error } = await supabase
    .from('accounts')
    .select('id', { count: 'exact', head: true })
    .eq('created_by', createdBy)
  if (error) { console.warn('[planLimits] count failed:', error.message); return 0 }
  return count ?? 0
}

export interface CapState { used: number; cap: number; remaining: number; canCreate: boolean }

export async function getCapState(createdBy: string, tier: Tier): Promise<CapState> {
  const cap = ACCOUNT_CAP[tier] ?? 1
  const used = await accountCount(createdBy)
  const remaining = cap === Infinity ? Infinity : Math.max(0, cap - used)
  return { used, cap, remaining, canCreate: used < cap }
}

// Throw if the owner is at their cap. Call before createAccount().
export async function assertCanCreateAccount(createdBy: string, tier: Tier): Promise<void> {
  const { used, cap, canCreate } = await getCapState(createdBy, tier)
  if (!canCreate) {
    throw new Error(
      `Account limit reached: your ${planLabel(tier)} plan allows ${cap} account${cap === 1 ? '' : 's'} ` +
      `(${used} in use). Upgrade your plan to add more.`
    )
  }
}
