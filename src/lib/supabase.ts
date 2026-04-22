import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://bmxrsfyaujcppaqvtnfx.supabase.co'
export const ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable___PNm7MXlZIeRitNp070Rw_JTV2rT2d'
export const SERVICE_KEY   = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''
export const YOUTUBE_KEY   = import.meta.env.VITE_YOUTUBE_KEY || ''
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

// Public client — for reads and realtime
export const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { storageKey: 'bm-auth-anon', persistSession: true },
})

// Admin client — for writes (uses service key if available, anon otherwise)
// Different storageKey prevents the GoTrueClient duplicate warning
export const supabaseAdmin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY, {
      auth: { storageKey: 'bm-auth-admin', persistSession: false, autoRefreshToken: false },
    })
  : supabase
