import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_URL)
  || 'https://bmxrsfyaujcppaqvtnfx.supabase.co'

const SUPABASE_ANON_KEY = (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_SUPABASE_ANON_KEY)
  || 'sb_publishable___PNm7MXlZIeRitNp070Rw_JTV2rT2d'

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY)

export const FUNCTIONS_URL = `${SUPABASE_URL}/functions/v1`

export const EDGE = {
  quickScan:           `${FUNCTIONS_URL}/quick-scan`,
  rssProxy:            `${FUNCTIONS_URL}/rss-proxy`,
  socialMonitor:       `${FUNCTIONS_URL}/social-monitor`,
  aiClassifier:        `${FUNCTIONS_URL}/ai-classifier`,
  aiBrief:             `${FUNCTIONS_URL}/ai-brief`,
  contradictionEngine: `${FUNCTIONS_URL}/contradiction-engine`,
  youtubeMonitor:      `${FUNCTIONS_URL}/youtube-monitor`,
  scheduler:           `${FUNCTIONS_URL}/scheduler`,
} as const

export async function callEdge(name: keyof typeof EDGE, body: Record<string, unknown> = {}) {
  try {
    const res = await fetch(EDGE[name], {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      },
      body: JSON.stringify(body),
    })
    if (!res.ok) throw new Error(`${name} returned ${res.status}`)
    return await res.json()
  } catch (err) {
    console.error(`Edge function ${name} failed:`, err)
    return null
  }
}
