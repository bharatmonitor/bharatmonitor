// ============================================================
// BharatMonitor — XPOZ Fetch Edge Function v3
// Runtime: Deno (Supabase Edge Functions)
//
// Uses XPOZ MCP API (https://mcp.xpoz.ai/mcp) to search
// Twitter, Instagram, and Reddit with our portal's keywords.
// 
// IMPORTANT: Keywords come from BharatMonitor account settings.
// Users do NOT need to configure XPOZ's own crawling dashboard.
// XPOZ's "Crawling Settings" UI is for their separate app —
// we use their search API which is entirely keyword-driven.
//
// Flow:
//   DashboardPage → useTwitterSweep → twitterSources.ts
//   → fetchXpozTweets → this edge function → XPOZ MCP API
//   → returns TwitterPost[] → merged into feed
// ============================================================

const VAULT_KEY  = Deno.env.get('XPOZ_API_KEY') ?? ''
const XPOZ_URL   = 'https://mcp.xpoz.ai/mcp'
const REQ_TIMEOUT = 25_000

const cors = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
}

// ─── XPOZ MCP JSON-RPC helper ────────────────────────────────────────────────

async function mcpCall(
  method: string,
  params: Record<string, unknown>,
  apiKey: string,
): Promise<any> {
  const res = await fetch(XPOZ_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`,
    },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(REQ_TIMEOUT),
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`XPOZ MCP ${method} failed: ${res.status} ${text}`)
  }
  const data = await res.json()
  if (data.error) throw new Error(`XPOZ RPC error: ${JSON.stringify(data.error)}`)
  return data.result
}

// ─── Initialize MCP session ───────────────────────────────────────────────────

async function initSession(apiKey: string): Promise<boolean> {
  try {
    await mcpCall('initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: { name: 'bharatmonitor', version: '3.0' },
    }, apiKey)
    return true
  } catch (e) {
    console.error('[xpoz] init failed:', e)
    return false
  }
}

// ─── Search Twitter posts ─────────────────────────────────────────────────────
// Uses XPOZ's twitter_searchPosts which returns 30-day historical data.
// The query is built from our portal's account keywords — no manual config needed.

async function searchTwitterPosts(
  query: string,
  startDate: string,
  maxResults: number,
  apiKey: string,
): Promise<any[]> {
  try {
    const result = await mcpCall('tools/call', {
      name: 'twitter_searchPosts',
      arguments: {
        query,
        startDate,
        language: 'en',
        fields: [
          'id', 'text', 'authorUsername', 'authorId',
          'likeCount', 'retweetCount', 'replyCount', 'quoteCount',
          'impressionCount', 'lang', 'hashtags', 'createdAt', 'createdAtDate',
        ],
      },
    }, apiKey)

    // XPOZ MCP returns result in content[0].text as JSON string
    const text = result?.content?.[0]?.text ?? ''
    if (!text) return []

    // Handle async operations (XPOZ may return operationId for long queries)
    let parsed: any
    try { parsed = JSON.parse(text) } catch { return [] }

    // If it's an operation that needs polling
    if (parsed?.operationId) {
      return await pollOperation(parsed.operationId, apiKey, maxResults)
    }

    const rows = parsed?.data ?? parsed ?? []
    return Array.isArray(rows) ? rows.slice(0, maxResults) : []

  } catch (e) {
    console.error('[xpoz] searchPosts error:', e)
    return []
  }
}

// ─── Poll async operation ─────────────────────────────────────────────────────

async function pollOperation(
  operationId: string,
  apiKey: string,
  maxResults: number,
  maxAttempts = 8,
): Promise<any[]> {
  for (let i = 0; i < maxAttempts; i++) {
    await new Promise(r => setTimeout(r, 1500 + i * 500))
    try {
      const result = await mcpCall('tools/call', {
        name: 'getOperation',
        arguments: { operationId },
      }, apiKey)
      const text = result?.content?.[0]?.text ?? ''
      if (!text) continue
      const parsed = JSON.parse(text)
      if (parsed?.status === 'completed' || parsed?.data) {
        const rows = parsed?.data ?? parsed ?? []
        return Array.isArray(rows) ? rows.slice(0, maxResults) : []
      }
      if (parsed?.status === 'failed') {
        console.warn('[xpoz] operation failed:', operationId)
        return []
      }
    } catch { continue }
  }
  console.warn('[xpoz] operation timed out:', operationId)
  return []
}

// ─── Build smart query from portal keywords ───────────────────────────────────
// Converts our portal's keyword array into an optimised XPOZ boolean query.
// e.g. ['PM Modi', 'BJP', 'Varanasi'] → '"PM Modi" OR BJP OR Varanasi india'

function buildXpozQuery(keywords: string[]): string {
  const terms = keywords
    .slice(0, 5)
    .map(kw => kw.includes(' ') ? `"${kw}"` : kw)
    .join(' OR ')
  return `(${terms}) india`
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: cors })

  try {
    const body        = await req.json()
    const { keywords, startDate, maxPerKeyword, xpozKey } = body

    const apiKey = VAULT_KEY || xpozKey || ''
    if (!apiKey) {
      return new Response(
        JSON.stringify({ posts: [], error: 'XPOZ_API_KEY not configured in Supabase Vault' }),
        { headers: cors }
      )
    }
    if (!keywords?.length) {
      return new Response(JSON.stringify({ posts: [] }), { headers: cors })
    }

    const max = maxPerKeyword || 20
    const sd  = startDate || new Date(Date.now() - 7 * 86_400_000).toISOString().substring(0, 10)

    // Initialize XPOZ session
    const ok = await initSession(apiKey)
    if (!ok) {
      return new Response(
        JSON.stringify({ posts: [], error: 'XPOZ MCP session init failed' }),
        { status: 503, headers: cors }
      )
    }

    // Build a single optimised query from all keywords
    // (more efficient than one request per keyword)
    const query = buildXpozQuery(keywords as string[])
    console.log(`[bm-xpoz-fetch] Query: "${query}" startDate: ${sd}`)

    const posts = await searchTwitterPosts(query, sd, max * Math.min(keywords.length, 5), apiKey)

    // Tag each post with the most relevant keyword
    const tagged = posts.map((p: any) => {
      const text = (p.text || '').toLowerCase()
      const kw   = (keywords as string[]).find(k => text.includes(k.toLowerCase())) || keywords[0]
      return { ...p, _keyword: kw }
    })

    // Deduplicate by id
    const seen    = new Set<string>()
    const deduped = tagged.filter((p: any) => {
      if (!p.id || seen.has(p.id)) return false
      seen.add(p.id)
      return true
    })

    console.log(`[bm-xpoz-fetch] Returning ${deduped.length} posts for keywords: [${(keywords as string[]).join(', ')}]`)
    return new Response(JSON.stringify({ posts: deduped }), { headers: cors })

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error('[bm-xpoz-fetch] Error:', msg)
    return new Response(JSON.stringify({ posts: [], error: msg }), {
      status: 500, headers: cors,
    })
  }
})
