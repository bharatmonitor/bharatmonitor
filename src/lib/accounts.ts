// ============================================================
// BharatMonitor — Accounts Library
// Hardcoded credentials + Supabase account fetching
// ============================================================

import { supabase, supabaseAdmin, FUNCTIONS_URL, SERVICE_KEY, ANON_KEY } from '@/lib/supabase'
import { DEMO_ACCOUNT } from '@/lib/mockData'
import type { Account } from '@/types'
import type { Tier } from '@/lib/tiers'
import type { UserRole } from '@/types'

export interface HardcodedCred {
  id: string
  email: string
  password: string
  role: UserRole
  tier: Tier
  account_id: string
  name: string
}

export const HARDCODED_CREDS: HardcodedCred[] = [
  { id: '9999999999999999', email: 'god@bharatmonitor.in', password: 'BM@God2024!', role: 'god', tier: 'god', account_id: 'god-account', name: 'God Mode' },
  { id: 'demo-001', email: 'modi@bharatmonitor.in', password: 'Demo@Modi2024', role: 'user', tier: 'elections', account_id: 'demo-001', name: 'Narendra Modi (Demo)' },
]

const DEMO_ACCOUNT_MAP: Record<string, Account> = {
  'demo-001': DEMO_ACCOUNT,
}

const LS_DEMO_EDITS_KEY = 'bm-demo-edits-v1'

function getDemoEdits(): Record<string, Partial<Account>> {
  try { const raw = localStorage.getItem(LS_DEMO_EDITS_KEY); return raw ? JSON.parse(raw) : {} } catch { return {} }
}

export function saveDemoEdit(accountId: string, patch: Partial<Account>) {
  try {
    const edits = getDemoEdits()
    edits[accountId] = { ...edits[accountId], ...patch }
    localStorage.setItem(LS_DEMO_EDITS_KEY, JSON.stringify(edits))
  } catch { /* ignore */ }
}

// Sync: write credentials to both localStorage AND Supabase accounts table
export async function syncCredentialToSupabase(
  accountId: string, loginEmail: string, loginPassword: string,
  meta: { name?: string; role?: string; tier?: string } = {}
): Promise<void> {
  // Always write to localStorage first (instant)
  try {
    const creds = JSON.parse(localStorage.getItem('bm-account-creds') || '{}')
    creds[accountId] = { ...( creds[accountId] || {}), email: loginEmail, password: loginPassword, name: meta.name, role: meta.role || 'user', tier: meta.tier || 'elections', updatedAt: new Date().toISOString() }
    localStorage.setItem('bm-account-creds', JSON.stringify(creds))
  } catch {}

  // Write to Supabase so credentials work across devices
  try {
    await supabaseAdmin.from('accounts').upsert({
      id: accountId,
      login_email:    loginEmail.toLowerCase().trim(),
      login_password: loginPassword,
      login_name:     meta.name     || '',
      login_role:     meta.role     || 'user',
      login_tier:     meta.tier     || 'elections',
      updated_at:     new Date().toISOString(),
    }, { onConflict: 'id', ignoreDuplicates: false })
  } catch (e) { console.warn('[BM] Supabase credential sync failed:', e) }
}

// Login step 1.5: check Supabase accounts table by login_email + login_password
// Called when localStorage check fails — handles cross-device logins
export async function validateSupabaseStoredCred(email: string, password: string): Promise<HardcodedCred | null> {
  try {
    const { data } = await supabase.from('accounts')
      .select('id, login_email, login_password, login_name, login_role, login_tier, contact_email, politician_name')
      .eq('login_email', email.trim().toLowerCase())
      .maybeSingle()

    if (!data || data.login_password !== password) return null

    return {
      id:         data.id,
      email:      data.login_email || data.contact_email || email,
      password:   data.login_password,
      role:       (data.login_role  || 'user') as any,
      tier:       (data.login_tier  || 'elections') as any,
      account_id: data.id,
      name:       data.login_name   || data.politician_name || data.id,
    }
  } catch { return null }
}

export function validateHardcodedCred(email: string, password: string): HardcodedCred | null {
  const emailLower = email.trim().toLowerCase()

  // 1. Built-in hardcoded accounts (god + demo — instant)
  const hardcoded = HARDCODED_CREDS.find(c => c.email.toLowerCase() === emailLower && c.password === password)
  if (hardcoded) return hardcoded

  // 2. Hardcoded email with updated password stored in localStorage
  const hardcodedEmail = HARDCODED_CREDS.find(c => c.email.toLowerCase() === emailLower)
  if (hardcodedEmail) {
    try {
      const stored = JSON.parse(localStorage.getItem('bm-account-creds') || '{}')[hardcodedEmail.account_id]
      if (stored?.password === password) return { ...hardcodedEmail, password }
    } catch {}
    return null
  }

  // 3. God-Mode created accounts in localStorage (same device only)
  try {
    const all = JSON.parse(localStorage.getItem('bm-account-creds') || '{}')
    for (const [accountId, stored] of Object.entries(all as Record<string, any>)) {
      if ((stored.email || '').toLowerCase() === emailLower && stored.password === password) {
        return { id: accountId, email: stored.email || email, password: stored.password, role: stored.role || 'user', tier: stored.tier || 'elections', account_id: accountId, name: stored.name || accountId }
      }
    }
  } catch {}

  return null
}

// Helper to update password for any account (God Mode use)
export function updateStoredPassword(accountId: string, email: string, newPassword: string, meta?: { role?: string; tier?: string; name?: string }) {
  try {
    const creds = JSON.parse(localStorage.getItem('bm-account-creds') || '{}')
    creds[accountId] = {
      ...(creds[accountId] || {}),
      password: newPassword,
      email: email || creds[accountId]?.email || '',
      role: meta?.role || creds[accountId]?.role || 'user',
      tier: meta?.tier || creds[accountId]?.tier || 'elections',
      name: meta?.name || creds[accountId]?.name || accountId,
      updatedAt: new Date().toISOString(),
    }
    localStorage.setItem('bm-account-creds', JSON.stringify(creds))
    return true
  } catch { return false }
}

export async function fetchAccount(userId: string): Promise<Account | null> {
  if (!userId) return null
  const cred = HARDCODED_CREDS.find(c => c.id === userId)
  if (cred) {
    if (userId === '9999999999999999') {
      const godBase: Account = { id: 'god-account', user_id: userId, created_by: userId, is_active: true, politician_name: 'God Mode', politician_initials: 'GM', party: '', designation: 'Platform Administrator', constituency: '', constituency_type: 'national', state: '', district: '', keywords: ['India politics', 'BJP', 'Congress', 'PM Modi', 'Rahul Gandhi', 'Indian elections', 'Parliament India'], tracked_politicians: [{ id: 'tp1', name: 'Narendra Modi', party: 'BJP', initials: 'NM', role: 'Prime Minister', is_competitor: false }, { id: 'tp2', name: 'Rahul Gandhi', party: 'INC', initials: 'RG', role: 'Leader of Opposition', is_competitor: false }], tracked_ministries: ['Finance', 'Home Affairs', 'Defence', 'External Affairs'], tracked_parties: ['BJP', 'INC', 'AAP', 'TMC', 'SP'], tracked_schemes: ['PM Awas Yojana', 'Ayushman Bharat', 'Digital India'], watchlist_handles: [], languages: ['english', 'hindi'], geo_scope: [{ level: 'national', name: 'India' }], alert_prefs: { red_sms: false, red_push: false, red_email: false, yellow_push: false, yellow_email: false }, contact_email: 'god@bharatmonitor.in', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
      // Load saved keywords from Supabase (persists across devices/sessions)
      try {
        const { data: dbSaved } = await supabaseAdmin.from('accounts')
          .select('keywords,tracked_politicians,tracked_ministries,tracked_parties,tracked_schemes')
          .eq('id', 'god-account').maybeSingle()
        if (dbSaved?.keywords?.length) {
          saveDemoEdit('god-account', { keywords: dbSaved.keywords, tracked_politicians: dbSaved.tracked_politicians || godBase.tracked_politicians })
        }
      } catch {}
      // Merge localStorage edits (includes DB-synced keywords)
      const godEdits = getDemoEdits()['god-account']
      return godEdits ? { ...godBase, ...godEdits } : godBase
    }
    const baseAccount = DEMO_ACCOUNT_MAP[cred.account_id]
    if (!baseAccount) return null
    // Load saved keywords from Supabase (persists across devices/sessions)
    try {
      const { data: dbSaved } = await supabaseAdmin.from('accounts')
        .select('keywords,tracked_politicians,tracked_ministries,tracked_parties,tracked_schemes')
        .eq('id', cred.account_id).maybeSingle()
      if (dbSaved?.keywords?.length) {
        saveDemoEdit(cred.account_id, { keywords: dbSaved.keywords, tracked_politicians: dbSaved.tracked_politicians || baseAccount.tracked_politicians })
      }
    } catch {}
    const edits = getDemoEdits()
    const localEdit = edits[cred.account_id]
    return localEdit ? { ...baseAccount, ...localEdit } : baseAccount
  }
  try {
    const { data, error } = await supabase.from('accounts').select('*').or(`user_id.eq.${userId},id.eq.${userId}`).limit(1).maybeSingle()
    if (error) { console.error('[BM] fetchAccount error:', error.message); return null }
    return data as Account | null
  } catch (e) { console.error('[BM] fetchAccount exception:', e); return null }
}

export async function fetchAllAccounts(): Promise<Account[]> {
  try {
    const { data, error } = await supabaseAdmin.from('accounts').select('*').order('created_at', { ascending: false })
    if (error) { console.error('[BM] fetchAllAccounts error:', error.message); return Object.values(DEMO_ACCOUNT_MAP) }
    const supabaseIds = new Set((data || []).map((a: any) => a.id))
    const demoFallbacks = Object.values(DEMO_ACCOUNT_MAP).filter(a => !supabaseIds.has(a.id))
    return [...(data as Account[]), ...demoFallbacks]
  } catch (e) { console.error('[BM] fetchAllAccounts exception:', e); return Object.values(DEMO_ACCOUNT_MAP) }
}

export async function updateAccount(userId: string, accountId: string, patch: Partial<Account>): Promise<void> {
  // Route hardcoded accounts (god + demo) to localStorage persistence
  const isLocalAccount = Object.keys(DEMO_ACCOUNT_MAP).includes(accountId) || accountId === 'god-account'
  if (isLocalAccount) {
    // Save to localStorage immediately
    saveDemoEdit(accountId, { ...patch, updated_at: new Date().toISOString() })
    // Also persist to Supabase so keywords survive across devices
    try {
      const KNOWN = ['id','account_id','keywords','tracked_politicians','tracked_ministries','tracked_parties','tracked_schemes','languages','geo_scope','updated_at']
      const safe: Record<string,unknown> = { id: accountId, updated_at: new Date().toISOString() }
      for (const k of KNOWN) { if (k in patch) safe[k] = (patch as any)[k] }
      await supabaseAdmin.from('accounts').upsert(safe, { onConflict: 'id', ignoreDuplicates: false })
    } catch(e) { console.warn('[accounts] Supabase keyword sync failed:', e) }
    return
  }

  // Handle password update via Supabase Auth (separate from profile update)
  const patchAny = patch as any
  if (patchAny._newPassword && patchAny._newPassword.length >= 8) {
    try {
      const { error } = await supabase.auth.updateUser({ password: patchAny._newPassword })
      if (error) console.warn('[updateAccount] Password update error:', error.message)
      else console.log('[updateAccount] Password updated successfully')
    } catch (e) { console.warn('[updateAccount] Password update exception:', e) }
  }

  // Sanitize: only send columns that exist in the DB schema
  const KNOWN_COLUMNS = [
    'id','user_id','created_by','is_active','politician_name','politician_initials',
    'party','designation','constituency','constituency_type','state','district',
    'keywords','tracked_politicians','tracked_ministries','tracked_parties',
    'tracked_schemes','languages','geo_scope','alert_prefs',
    'contact_email','contact_phone','email','account_type',
    'created_at','updated_at',
  ]
  const safe: Record<string, unknown> = { updated_at: new Date().toISOString() }
  for (const key of KNOWN_COLUMNS) {
    if (key in patch && (patch as any)[key] !== undefined) {
      safe[key] = (patch as any)[key]
    }
  }

  const { error } = await supabaseAdmin.from('accounts').update(safe).eq('id', accountId)
  if (error) throw new Error(error.message)
}

export async function createAccount(data: Partial<Account>): Promise<Account> {
  // Sanitize: only send columns that exist in the DB schema
  // Prevents "Invalid path specified" errors from unknown fields
  const KNOWN_COLUMNS = [
    'id','user_id','created_by','is_active','politician_name','politician_initials',
    'party','designation','constituency','constituency_type','state','district',
    'keywords','tracked_politicians','tracked_ministries','tracked_parties',
    'tracked_schemes','languages','geo_scope','alert_prefs',
    'contact_email','contact_phone','email','account_type',
    'created_at','updated_at',
  ]
  const safe: Record<string, unknown> = {}
  for (const key of KNOWN_COLUMNS) {
    if (key in data && (data as any)[key] !== undefined) {
      safe[key] = (data as any)[key]
    }
  }
  // Generate a stable id if not provided
  if (!safe.id) {
    // Format: BM-YYYY-XXXXXX — unique alphanumeric ID
    const year  = new Date().getFullYear()
    const ts    = Date.now().toString(36).toUpperCase().slice(-4)
    const rand  = Math.random().toString(36).toUpperCase().slice(2, 6)
    safe.id = `BM-${year}-${ts}${rand}`
  }
  // Store auto-generated credentials in localStorage for admin reference
  const patchAny = data as any
  if (patchAny._autoPassword && safe.id) {
    try {
      const creds = JSON.parse(localStorage.getItem('bm-account-creds') || '{}')
      creds[safe.id as string] = { password: patchAny._autoPassword, username: patchAny._username || safe.id, createdAt: new Date().toISOString() }
      localStorage.setItem('bm-account-creds', JSON.stringify(creds))
    } catch {}
  }
  safe.created_at = new Date().toISOString()
  safe.updated_at = new Date().toISOString()
  safe.is_active = true

  const { error, data: created } = await supabaseAdmin
    .from('accounts').insert(safe).select().single()
  if (error) throw new Error(error.message)
  return created as Account
}

export async function triggerIngest(accountId: string, politicianName: string, keywords: string[]): Promise<void> {
  const authKey = SERVICE_KEY || ANON_KEY
  const url = `${FUNCTIONS_URL}/bm-ingest-v2`
  console.log('[BM] triggerIngest ->', url, { accountId, kwCount: keywords.length })
  try {
    const resp = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${authKey}`,
        'apikey': ANON_KEY,
        'x-client-info': 'bharatmonitor/1.0',
      },
      // Edge function reads camelCase keys
      body: JSON.stringify({ accountId, politicianName, keywords }),
      signal: AbortSignal.timeout(90_000),  // 90s — ingest can take 45-60s
    })
    const text = await resp.text()
    if (!resp.ok) {
      console.warn('[BM] triggerIngest HTTP error:', resp.status, resp.statusText, text.slice(0, 300))
    } else {
      console.log('[BM] triggerIngest OK:', text.slice(0, 200))
    }
  } catch (e: any) {
    console.error('[BM] triggerIngest FAILED:', e?.message || e)
    console.error('[BM] Debug: FUNCTIONS_URL =', `${FUNCTIONS_URL}/bm-ingest-v2`)
    console.error('[BM] Likely cause: function not deployed OR blocked by CORS/network')
  }
}
