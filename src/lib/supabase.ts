import { createClient } from '@supabase/supabase-js'

// ─── Config: read from environment variables only ────────────────────────────
// SERVICE_KEY must NEVER have a hardcoded fallback — it grants full DB access.
// Add all VITE_* vars to Vercel's Environment Variables dashboard.

export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://bmxrsfyaujcppaqvtnfx.supabase.co'
export const ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable___PNm7MXlZIeRitNp070Rw_JTV2rT2d'
// SERVICE_KEY: env var only — empty string fallback means admin ops gracefully fail, never leak
export const SERVICE_KEY   = import.meta.env.VITE_SUPABASE_SERVICE_KEY || ''
export const YOUTUBE_KEY   = import.meta.env.VITE_YOUTUBE_KEY || ''
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

export const supabase      = createClient(SUPABASE_URL, ANON_KEY)
// supabaseAdmin is used for write operations (ingest, account creation).
// Falls back to anon client if service key not set — read-only operations still work.
export const supabaseAdmin = SERVICE_KEY
  ? createClient(SUPABASE_URL, SERVICE_KEY)
  : supabase
