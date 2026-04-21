// ============================================================
// BharatMonitor — XPOZ Fetch Edge Function v2
// Runtime: Deno (Supabase Edge Functions)
//
// POST /functions/v1/bm-xpoz-fetch
//   Body: { keywords, startDate, maxPerKeyword, xpozKey? }
//   Returns: { posts: any[] }
//
// XPOZ API key: K3CdGX6jAgsWA8c87NlWbn2c5SVmKEddiTnYie2oIGhUKhvWRI1jhQeEOOqdwZKCVuyU8d1
// Kept server-side via Supabase Vault secret XPOZ_API_KEY
// ============================================================

// Prefer Vault secret, fall back to key passed in request body (dev only)
const VAULT_KEY = Deno.env.get('XPOZ_API_KEY') ?? ''

const corsHeaders = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type':                 'application/json',
}

// XPOZ REST API — search Twitter posts
async function xpozSearchPosts(
  query:      string,
  startDate:  string,
  maxResults: number,
  apiKey:     string,
): Promise<any[]> {
  try {
    // XPOZ MCP HTTP endpoint
    const XPOZ_URL = 'https://mcp.xpoz.ai/mcp'

    // Step 1: initialize session
    const initRes = await fetch(XPOZ_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 1, method: 'initialize',
        params: {
          protocolVersion: '2024-11-05',
          capabilities:    {},
          clientInfo:      { name: 'bharatmonitor', version: '2.0' },
        },
      }),
      signal: AbortSignal.timeout(10000),
    })

    if (!initRes.ok) {
      console.error('[xpoz] init failed:', initRes.status, await initRes.text())
      return []
    }

    // Step 2: call twitter_searchPosts tool
    const searchRes = await fetch(XPOZ_URL, {
      method: 'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        jsonrpc: '2.0', id: 2,
        method:  'tools/call',
        params: {
          name:      'twitter_searchPosts',
          arguments: {
            query,
            startDate,
            language: 'en',
            fields: [
              'id', 'text', 'authorUsername', 'likeCount',
              'retweetCount', 'replyCount', 'impressionCount',
              'createdAt', 'lang', 'hashtags',
            ],
          },
        },
      }),
      signal: AbortSignal.timeout(25000),
    })

    if (!searchRes.ok) {
      console.error('[xpoz] search failed:', searchRes.status)
      return []
    }

    const data   = await searchRes.json()
    const text   = data?.result?.content?.[0]?.text ?? ''
    if (!text) return []

    try {
      const parsed = JSON.parse(text)
      const rows   = parsed?.data ?? parsed ?? []
      return Array.isArray(rows) ? rows.slice(0, maxResults) : []
    } catch {
      return []
    }
  } catch (e) {
    console.error('[xpoz] exception:', e)
    return []
  }
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders })

  try {
    const body = await req.json()
    const { keywords, startDate, maxPerKeyword, xpozKey } = body

    // Use Vault key first, then key passed in body (dev/testing fallback)
    const apiKey = VAULT_KEY || xpozKey || ''
    if (!apiKey) {
      return new Response(
        JSON.stringify({ posts: [], error: 'XPOZ_API_KEY not configured' }),
        { headers: corsHeaders }
      )
    }

    if (!keywords?.length) {
      return new Response(JSON.stringify({ posts: [] }), { headers: corsHeaders })
    }

    const allPosts: any[] = []
    const max = maxPerKeyword || 20
    const sd  = startDate || new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10)

    // Search each keyword sequentially to avoid hammering XPOZ
    for (const kw of (keywords as string[]).slice(0, 5)) {
      const query = `${kw} india -filter:retweets`
      const posts = await xpozSearchPosts(query, sd, max, apiKey)
      for (const p of posts) allPosts.push({ ...p, _keyword: kw })
      // Small pause between keywords
      if (keywords.indexOf(kw) < keywords.length - 1) {
        await new Promise(r => setTimeout(r, 300))
      }
    }

    // Deduplicate by id
    const seen    = new Set<string>()
    const deduped = allPosts.filter(p => {
      if (!p.id || seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    console.log(`[bm-xpoz-fetch] Returning ${deduped.length} posts for ${keywords.length} keywords`)
    return new Response(JSON.stringify({ posts: deduped }), { headers: corsHeaders })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[bm-xpoz-fetch] Error:', msg)
    return new Response(JSON.stringify({ posts: [], error: msg }), {
      status: 500, headers: corsHeaders,
    })
  }
})
