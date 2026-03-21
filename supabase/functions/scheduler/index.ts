import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const BASE_URL = Deno.env.get('APP_URL') || 'https://bmxrsfyaujcppaqvtnfx.supabase.co'
const SERVICE_KEY = Deno.env.get('SERVICE_ROLE_KEY') || ''

// Hardcoded accounts to track — no DB lookup needed
const ACCOUNTS = [
  {
    id: 'acc-railways',
    name: 'Indian Railways',
    keywords: ['Indian Railways', 'Ashwini Vaishnaw', 'Vande Bharat', 'train accident India', 'Kavach train', 'railway privatisation India'],
    languages: ['english', 'hindi'],
  },
  {
    id: 'acc-modi',
    name: 'Narendra Modi',
    keywords: ['Narendra Modi', 'PM Modi', 'BJP', 'Viksit Bharat', 'Modi government'],
    languages: ['english', 'hindi'],
  },
  {
    id: 'acc-rekha',
    name: 'Rekha Gupta',
    keywords: ['Rekha Gupta', 'Delhi CM', 'BJP Delhi', 'Delhi government'],
    languages: ['english', 'hindi'],
  },
  {
    id: 'acc-sushant',
    name: 'Sushant Shukla',
    keywords: ['Sushant Shukla', 'Chhattisgarh BJP', 'Raipur BJP'],
    languages: ['hindi', 'english'],
  },
]

async function callFunction(name: string, body: Record<string, unknown>) {
  try {
    const res = await fetch(`${BASE_URL}/functions/v1/${name}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(25000),
    })
    const text = await res.text()
    return { ok: res.ok, status: res.status, body: text }
  } catch (e) {
    return { ok: false, status: 0, body: String(e) }
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    console.log('Scheduler triggered:', new Date().toISOString())
    const results = []

    for (const account of ACCOUNTS) {
      // Fetch RSS + Google News for this account
      const r = await callFunction('rss-proxy', {
        account_id: account.id,
        keywords: account.keywords,
        languages: account.languages,
      })
      results.push({ account: account.name, rss: r.ok ? 'ok' : r.body.substring(0, 100) })
      console.log(`${account.name}: ${r.ok ? 'ok' : 'failed'} - ${r.body.substring(0, 80)}`)
    }

    return new Response(
      JSON.stringify({ success: true, timestamp: new Date().toISOString(), results }),
      { headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  } catch (err) {
    console.error('Scheduler error:', err)
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...CORS, 'Content-Type': 'application/json' } }
    )
  }
})
