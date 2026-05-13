// supabase/functions/bm-meta-ads/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// Proxies Meta Ad Library API from server side (no CORS issues)
// Meta Ad Library API: https://graph.facebook.com/v20.0/ads_archive
//
// Requirements for token:
//   1. Go to developers.facebook.com → your app → Tools → Graph API Explorer
//   2. Select your app → Generate User Access Token
//   3. Add permissions: ads_read, pages_read_engagement, public_profile
//   4. Click "Generate Access Token" → copy the token
//   5. Set in Supabase Secrets: META_ACCESS_TOKEN=...
//   6. For long-lived token: exchange via /oauth/access_token endpoint
//
// ─────────────────────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

const META_TOKEN = Deno.env.get('META_ACCESS_TOKEN') ?? 'EAF5yjiYcxVYBRUmfQIEiTBdeIUKYHmMsBdzZCW1s2bu6v53vxCMehN2f6H8yIS9PjdxEQcW0QeQPgrJD8GJHVZACTlDVQzaIej13runDQgAfPuHLYqhNV24h9bw2CmwV4mUZAZARaI6lEythw7aVZAwz8GTZAacTkFqS3qkV4pDwkU2RajSsbTNjvTZCZCaSymxqoABeAt2eT4VqvSmQ8hBFymzL424aZB4QWeW4niL7NwxX181Ay9bsXmU2PUpkSEwKOlJF4gDv7hrAVaqZBOM0zR'
const META_API   = 'https://graph.facebook.com/v20.0/ads_archive'

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  let body: any = {}
  try { body = await req.json() } catch { /* no body */ }

  const {
    searchTerms = [],    // ['Modi', 'BJP', 'Congress']
    country     = 'IN',
    limit       = 10,
    token,               // optional override token
  } = body

  const accessToken = token || META_TOKEN

  if (!accessToken) {
    return new Response(JSON.stringify({
      ok: false,
      error: 'META_ACCESS_TOKEN not set. See setup instructions.',
      setup: [
        '1. Go to developers.facebook.com',
        '2. Create or open your app',
        '3. Tools → Graph API Explorer',
        '4. Select your app → Get User Access Token',
        '5. Add permissions: ads_read, pages_read_engagement',
        '6. Copy the token',
        '7. Run: supabase secrets set META_ACCESS_TOKEN=your_token_here',
      ]
    }), { headers: CORS, status: 400 })
  }

  if (!searchTerms.length) {
    return new Response(JSON.stringify({ ok: false, error: 'No search terms provided' }), { headers: CORS, status: 400 })
  }

  const allAds: any[] = []
  const errors: string[] = []

  for (const term of searchTerms.slice(0, 3)) {
    try {
      // Build params - Meta v20 format
      const params = new URLSearchParams({
        access_token:        accessToken,
        ad_type:             'POLITICAL_AND_ISSUE_ADS',
        ad_reached_countries: `["${country}"]`,
        search_terms:        term,
        fields:              'id,page_id,page_name,ad_creative_bodies,ad_creative_link_descriptions,ad_creative_link_titles,ad_delivery_start_time,ad_delivery_stop_time,ad_snapshot_url,bylines,currency,demographic_distribution,delivery_by_region,estimated_audience_size,impressions,languages,publisher_platforms,spend,target_ages,target_gender,target_locations',
        limit:               String(Math.min(limit, 25)),
      })

      console.log(`[MetaAds] Searching: "${term}" in ${country}`)
      const res = await fetch(`${META_API}?${params}`, {
        signal: AbortSignal.timeout(15_000),
      })

      const data = await res.json()

      if (!res.ok || data.error) {
        const errMsg = data.error?.message || data.error || `HTTP ${res.status}`
        console.error(`[MetaAds] Error for "${term}":`, errMsg)
        errors.push(`${term}: ${errMsg}`)

        // Specific error handling
        if (data.error?.code === 190) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'Token expired. Generate a new one at developers.facebook.com.',
            code: 190,
          }), { headers: CORS, status: 401 })
        }
        if (data.error?.code === 200 || data.error?.code === 100) {
          return new Response(JSON.stringify({
            ok: false,
            error: 'Token missing ads_read permission. Re-generate with ads_read scope.',
            code: data.error.code,
            setup: 'developers.facebook.com → Graph API Explorer → ads_read permission',
          }), { headers: CORS, status: 403 })
        }
        continue
      }

      const ads = data.data || []
      console.log(`[MetaAds] "${term}": ${ads.length} ads`)
      allAds.push(...ads)
    } catch (e: any) {
      errors.push(`${term}: ${e.message}`)
    }
  }

  // Dedup by id
  const seen = new Set<string>()
  const unique = allAds.filter(a => {
    if (seen.has(a.id)) return false
    seen.add(a.id)
    return true
  })

  return new Response(JSON.stringify({
    ok: true,
    count: unique.length,
    ads: unique,
    searchTerms,
    country,
    errors: errors.length ? errors : undefined,
  }), { headers: CORS })
})
