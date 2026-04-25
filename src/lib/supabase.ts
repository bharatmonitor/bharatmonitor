import { createClient } from '@supabase/supabase-js'

// ─── Config ──────────────────────────────────────────────────────────────────
// All values MUST come from Vercel environment variables.
// Go to: https://supabase.com/dashboard/project/ylajerluygbeiqybkgtx/settings/api
// to get your correct project URL, anon key, and service role key.

export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://ylajerluygbeiqybkgtx.supabase.co'
export const ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY || ''
export const SERVICE_KEY   = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

if (!ANON_KEY) {
  console.error('[Supabase] VITE_SUPABASE_ANON_KEY is not set. Add it to Vercel env vars.')
}

// Public client — reads and realtime subscriptions
export const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { storageKey: 'bm-auth-anon', persistSession: true },
})

// Admin client — writes (uses service key if available, anon otherwise)
// Different storageKey prevents GoTrueClient duplicate warning
export const supabaseAdmin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { storageKey: 'bm-auth-admin', persistSession: false, autoRefreshToken: false },
    })
  : supabase
