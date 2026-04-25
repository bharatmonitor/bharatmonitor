// ============================================================
// BharatMonitor — Accounts Library
// Hardcoded credentials + Supabase account fetching
// ============================================================

import { supabase, supabaseAdmin, FUNCTIONS_URL, SERVICE_KEY } from '@/lib/supabase'
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

export function validateHardcodedCred(email: string, password: string): HardcodedCred | null {
  const emailLower = email.trim().toLowerCase()
  return HARDCODED_CREDS.find(c => c.email.toLowerCase() === emailLower && c.password === password) || null
}

export async function fetchAccount(userId: string): Promise<Account | null> {
  if (!userId) return null
  const cred = HARDCODED_CREDS.find(c => c.id === userId)
  if (cred) {
    if (userId === '9999999999999999') {
      return { id: 'god-account', user_id: userId, created_by: userId, is_active: true, politician_name: 'God Mode', politician_initials: 'GM', party: '', designation: 'Platform Administrator', constituency: '', constituency_type: 'national', state: '', district: '', keywords: ['India politics', 'BJP', 'Congress', 'PM Modi', 'Rahul Gandhi', 'Indian elections', 'Parliament India'], tracked_politicians: [{ id: 'tp1', name: 'Narendra Modi', party: 'BJP', initials: 'NM', role: 'Prime Minister', is_competitor: false }, { id: 'tp2', name: 'Rahul Gandhi', party: 'INC', initials: 'RG', role: 'Leader of Opposition', is_competitor: false }], tracked_ministries: ['Finance', 'Home Affairs', 'Defence', 'External Affairs'], tracked_parties: ['BJP', 'INC', 'AAP', 'TMC', 'SP'], tracked_schemes: ['PM Awas Yojana', 'Ayushman Bharat', 'Digital India'], languages: ['english', 'hindi'], geo_scope: [{ level: 'national', name: 'India' }], alert_prefs: { red_sms: false, red_push: false, red_email: false, yellow_push: false, yellow_email: false }, contact_email: 'god@bharatmonitor.in', created_at: new Date().toISOString(), updated_at: new Date().toISOString() }
    }
    const baseAccount = DEMO_ACCOUNT_MAP[cred.account_id]
    if (!baseAccount) return null
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
  const isDemoAccount = Object.keys(DEMO_ACCOUNT_MAP).includes(accountId)
  if (isDemoAccount) { saveDemoEdit(accountId, { ...patch, updated_at: new Date().toISOString() }); return }
  const { error } = await supabaseAdmin.from('accounts').update({ ...patch, updated_at: new Date().toISOString() }).eq('user_id', userId)
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
    safe.id = `acct-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
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
  try {
    const resp = await fetch(`${FUNCTIONS_URL}/bm-ingest-v2`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ account_id: accountId, politician_name: politicianName, keywords }),
      signal: AbortSignal.timeout(30_000),
    })
    if (!resp.ok) { const body = await resp.text(); console.warn('[BM] triggerIngest failed:', resp.status, body) }
  } catch (e) { console.warn('[BM] triggerIngest exception:', e) }
}
