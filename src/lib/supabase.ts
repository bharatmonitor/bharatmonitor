import { createClient } from '@supabase/supabase-js'

export const SUPABASE_URL  = import.meta.env.VITE_SUPABASE_URL  || 'https://ylajerluygbeiqybkgtx.supabase.co'
export const ANON_KEY      = import.meta.env.VITE_SUPABASE_ANON_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ1MjA0MzksImV4cCI6MjA5MDA5NjQzOX0.ui2MqbKXl6hcAYdEGrDHA-5uriTRDobls2_rvz7RN7w'
export const SERVICE_KEY   = import.meta.env.VITE_SUPABASE_SERVICE_KEY
  || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlsYWplcmx1eWdiZWlxeWJrZ3R4Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDUyMDQzOSwiZXhwIjoyMDkwMDk2NDM5fQ.zgKRPK1VrZg-q7DbuwNzxfYL_3ZfqiOU4K6YiSZySSY'
export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

// Public client — reads and realtime
export const supabase = createClient(SUPABASE_URL, ANON_KEY, {
  auth: { storageKey: 'bm-auth-anon', persistSession: true },
})

// Admin client — writes (uses service key)
export const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { storageKey: 'bm-auth-admin', persistSession: false, autoRefreshToken: false },
})
