const VAULT_KEY = Deno.env.get('XPOZ_API_KEY') ?? ''
const XPOZ_URL  = 'https://mcp.xpoz.ai/mcp'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, apikey, x-client-info',
  'Content-Type': 'application/json',
}

async function mcpCall(method, params, apiKey) {
  const r = await fetch(XPOZ_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${apiKey}` },
    body: JSON.stringify({ jsonrpc: '2.0', id: Date.now(), method, params }),
    signal: AbortSignal.timeout(25000),
  })
  if (!r.ok) throw new Error(`XPOZ MCP ${method} failed: ${r.status}`)
  const d = await r.json()
  if (d.error) throw new Error(`XPOZ RPC error: ${JSON.stringify(d.error)}`)
  return d.result
}

async function searchPosts(query, startDate, maxResults, apiKey) {
  try {
    await mcpCall('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'bharatmonitor', version: '3.0' } }, apiKey)
    const result = await mcpCall('tools/call', { name: 'twitter_searchPosts', arguments: { query, startDate, language: 'en', fields: ['id','text','authorUsername','likeCount','retweetCount','replyCount','impressionCount','createdAt','lang'] } }, apiKey)
    const text = result?.content?.[0]?.text ?? ''
    if (!text) return []
    const parsed = JSON.parse(text)
    if (parsed?.operationId) {
      for (let i = 0; i < 8; i++) {
        await new Promise(r => setTimeout(r, 2000))
        const op = await mcpCall('tools/call', { name: 'getOperation', arguments: { operationId: parsed.operationId } }, apiKey)
        const opText = op?.content?.[0]?.text ?? ''
        if (!opText) continue
        const opParsed = JSON.parse(opText)
        if (opParsed?.status === 'completed' || opParsed?.data) {
          const rows = opParsed?.data ?? opParsed ?? []
          return Array.isArray(rows) ? rows.slice(0, maxResults) : []
        }
        if (opParsed?.status === 'failed') return []
      }
      return []
    }
    const rows = parsed?.data ?? parsed ?? []
    return Array.isArray(rows) ? rows.slice(0, maxResults) : []
  } catch (e) {
    console.error('XPOZ searchPosts error:', e.message)
    return []
  }
}

function buildQuery(keywords) {
  const terms = keywords.slice(0, 5).map(kw => kw.includes(' ') ? `"${kw}"` : kw).join(' OR ')
  return `(${terms}) india`
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS })
  try {
    const { keywords, startDate, maxPerKeyword, xpozKey } = await req.json()
    const apiKey = VAULT_KEY || xpozKey || ''
    if (!apiKey) return new Response(JSON.stringify({ posts: [], error: 'XPOZ_API_KEY not configured' }), { headers: CORS })
    if (!keywords?.length) return new Response(JSON.stringify({ posts: [] }), { headers: CORS })

    const max = maxPerKeyword || 20
    const sd  = startDate || new Date(Date.now() - 7 * 86400000).toISOString().substring(0, 10)
    const query = buildQuery(keywords)
    console.log(`[bm-xpoz-fetch] Query: "${query}" startDate: ${sd}`)

    const posts = await searchPosts(query, sd, max * Math.min(keywords.length, 5), apiKey)
    const tagged = posts.map(p => ({ ...p, _keyword: keywords.find(k => (p.text||'').toLowerCase().includes(k.toLowerCase())) || keywords[0] }))

    const seen = new Set()
    const deduped = tagged.filter(p => { if (!p.id || seen.has(p.id)) return false; seen.add(p.id); return true })

    console.log(`[bm-xpoz-fetch] Returning ${deduped.length} posts`)
    return new Response(JSON.stringify({ posts: deduped }), { headers: CORS })
  } catch (e) {
    console.error('[bm-xpoz-fetch] Error:', e.message)
    return new Response(JSON.stringify({ posts: [], error: e.message }), { status: 500, headers: CORS })
  }
})
