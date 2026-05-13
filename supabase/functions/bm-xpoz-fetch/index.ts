// BharatMonitor — XPOZ Fetch v5
// Uses XPOZ TypeScript SDK via esm.sh
// SDK handles correct REST API endpoint and auth automatically

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const XPOZ_KEY = Deno.env.get('XPOZ_API_KEY') ?? ''

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

// Use MCP protocol with correct streaming HTTP transport (2025 spec)
// Bearer token auth works for MCP as confirmed in docs
async function searchViaMCP(query: string, apiKey: string, limit: number) {
  try {
    // Initialize session
    const initRes = await fetch('https://mcp.xpoz.ai/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'MCP-Protocol-Version': '2025-03-26',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: { tools: {} },
          clientInfo: { name: 'bharatmonitor', version: '5.0' },
        },
      }),
      signal: AbortSignal.timeout(15000),
    })

    if (!initRes.ok) {
      console.error(`[XPOZ] Init failed: ${initRes.status} ${await initRes.text().catch(()=>'')}`)
      return []
    }

    // Call twitter search
    const searchRes = await fetch('https://mcp.xpoz.ai/mcp', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
        'MCP-Protocol-Version': '2025-03-26',
      },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 2,
        method: 'tools/call',
        params: {
          name: 'twitter_searchPosts',
          arguments: {
            query,
            limit,
            fields: ['id','text','authorUsername','authorId','likeCount','retweetCount','replyCount','impressionCount','createdAt','lang','hashtags'],
          },
        },
      }),
      signal: AbortSignal.timeout(25000),
    })

    if (!searchRes.ok) {
      console.error(`[XPOZ] Search failed: ${searchRes.status}`)
      return []
    }

    const data = await searchRes.json()
    const content = data?.result?.content?.[0]?.text ?? ''
    if (!content) return []

    const parsed = JSON.parse(content)
    const posts = parsed?.data ?? parsed?.posts ?? parsed ?? []
    console.log(`[XPOZ] "${query}": ${Array.isArray(posts) ? posts.length : 0} posts`)
    return Array.isArray(posts) ? posts : []

  } catch (e: any) {
    console.error('[XPOZ] MCP error:', e.message)
    return []
  }
}

function buildQuery(keywords: string[]): string {
  return keywords.slice(0, 5).map(k => k.includes(' ') ? `"${k}"` : k).join(' OR ')
}

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })

  try {
    const { keywords, maxPerKeyword, xpozKey } = await req.json()
    const apiKey = XPOZ_KEY || xpozKey || ''

    if (!apiKey) {
      console.error('[XPOZ] No API key in secrets or request')
      return new Response(JSON.stringify({ posts: [], error: 'XPOZ_API_KEY not set in edge function secrets' }), { headers: CORS })
    }
    if (!keywords?.length) return new Response(JSON.stringify({ posts: [] }), { headers: CORS })

    const limit = Math.min((maxPerKeyword || 20) * Math.min(keywords.length, 5), 100)
    const query = buildQuery(keywords as string[])
    const indiaQuery = `${query} india`

    console.log(`[XPOZ] Searching: "${indiaQuery}" limit=${limit} key=${apiKey.slice(0,8)}...`)

    const posts = await searchViaMCP(indiaQuery, apiKey, limit)

    // Tag posts with matching keyword
    const tagged = posts.map((p: any) => ({
      ...p,
      _keyword: (keywords as string[]).find(k => (p.text||'').toLowerCase().includes(k.toLowerCase())) || keywords[0],
    }))

    const seen = new Set<string>()
    const deduped = tagged.filter((p: any) => {
      const id = String(p.id || p.tweetId || '')
      if (!id || seen.has(id)) return false
      seen.add(id)
      return true
    })

    console.log(`[XPOZ] Returning ${deduped.length} unique posts`)
    return new Response(JSON.stringify({ posts: deduped, total: deduped.length }), { headers: CORS })

  } catch (e: any) {
    console.error('[XPOZ] Error:', e.message)
    return new Response(JSON.stringify({ posts: [], error: e.message }), { status: 500, headers: CORS })
  }
})
