// ─── XPOZ MCP Client — Deno-compatible ───────────────────────────────────────
// Pure fetch-based MCP client. No Node.js deps.
// Implements StreamableHTTP MCP transport (JSON-RPC over HTTP).
//
// Tool names (from @xpoz/xpoz SDK reverse-engineered):
//   Twitter:   getTwitterPostsByKeywords | getTwitterPostsByAuthor | getTwitterUser
//              getTwitterUsersByKeywords | countTweets | getTwitterUserConnections
//   Instagram: getInstagramPostsByKeywords | getInstagramPostsByUser | getInstagramUser
//              getInstagramUsersByKeywords
//   Reddit:    getRedditPostsByKeywords | getRedditCommentsByKeywords
//              getRedditSubredditsByKeywords
//   Tracking:  getTrackedItems | addTrackedItems | removeTrackedItems

const XPOZ_MCP_URL = 'https://mcp.xpoz.ai/mcp'

// ── Types ─────────────────────────────────────────────────────────────────────

export interface XpozTwitterPost {
  id?: string | null
  text?: string | null
  authorId?: string | null
  authorUsername?: string | null
  lang?: string | null
  likeCount?: number | null
  retweetCount?: number | null
  replyCount?: number | null
  quoteCount?: number | null
  impressionCount?: number | null
  bookmarkCount?: number | null
  hashtags?: string[] | null
  mentions?: string[] | null
  country?: string | null
  region?: string | null
  city?: string | null
  createdAt?: string | null
  isRetweet?: boolean | null
  quotedTweetId?: string | null
}

export interface XpozTwitterUser {
  id?: string | null
  username?: string | null
  name?: string | null
  description?: string | null
  location?: string | null
  verified?: boolean | null
  followersCount?: number | null
  followingCount?: number | null
  tweetCount?: number | null
  profileImageUrl?: string | null
  aggRelevance?: number | null
  relevantTweetsCount?: number | null
  relevantTweetsImpressionsSum?: number | null
  relevantTweetsLikesSum?: number | null
}

export interface XpozInstagramPost {
  id?: string | null
  username?: string | null
  caption?: string | null
  likeCount?: number | null
  commentCount?: number | null
  videoPlayCount?: number | null
  codeUrl?: string | null
  createdAt?: string | null
}

export interface XpozRedditPost {
  id?: string | null
  title?: string | null
  selftext?: string | null
  url?: string | null
  permalink?: string | null
  authorUsername?: string | null
  subredditName?: string | null
  score?: number | null
  commentsCount?: number | null
  createdAt?: string | null
}

interface MCPCallResult {
  ok: boolean
  data: Record<string, unknown>
  error?: string
}

// ── Core MCP caller ───────────────────────────────────────────────────────────

export class XpozMCPClient {
  private apiKey: string
  private sessionId: string | null = null

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  private headers() {
    return {
      'Content-Type': 'application/json',
      'Accept': 'application/json, text/event-stream',
      'Authorization': `Bearer ${this.apiKey}`,
      'User-Agent': 'bharatmonitor-deno/1.0',
      ...(this.sessionId ? { 'Mcp-Session-Id': this.sessionId } : {}),
    }
  }

  // Initialize MCP session and get session ID
  async connect(): Promise<boolean> {
    try {
      const res = await fetch(XPOZ_MCP_URL, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: 1,
          method: 'initialize',
          params: {
            protocolVersion: '2024-11-05',
            capabilities: {},
            clientInfo: { name: 'bharatmonitor', version: '1.0' },
          },
        }),
        signal: AbortSignal.timeout(15_000),
      })

      // Grab session ID from response header if present
      const sid = res.headers.get('Mcp-Session-Id')
      if (sid) this.sessionId = sid

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error('[XPOZ] connect failed:', res.status, body.slice(0, 200))
        return false
      }

      // Parse SSE or JSON response
      const text = await res.text()
      const json = this._parseResponse(text)
      console.log('[XPOZ] connected, sessionId:', this.sessionId, 'server:', (json?.result as any)?.serverInfo?.name)
      return true
    } catch (e: any) {
      console.error('[XPOZ] connect error:', e.message)
      return false
    }
  }

  // Call an MCP tool by name with args
  async callTool(toolName: string, args: Record<string, unknown>): Promise<MCPCallResult> {
    try {
      const res = await fetch(XPOZ_MCP_URL, {
        method: 'POST',
        headers: this.headers(),
        body: JSON.stringify({
          jsonrpc: '2.0',
          id: Date.now(),
          method: 'tools/call',
          params: {
            name: toolName,
            arguments: args,
          },
        }),
        signal: AbortSignal.timeout(60_000), // tools can take time
      })

      if (!res.ok) {
        const body = await res.text().catch(() => '')
        console.error(`[XPOZ] tool ${toolName} HTTP ${res.status}:`, body.slice(0, 200))
        return { ok: false, data: {}, error: `HTTP ${res.status}: ${body.slice(0, 100)}` }
      }

      const text = await res.text()
      const json = this._parseResponse(text)

      if (json?.error) {
        return { ok: false, data: {}, error: String((json.error as any)?.message || json.error) }
      }

      const result = json?.result as any
      // MCP returns content as array of {type:'text', text:'...'}
      // XPOZ puts JSON in the text field
      if (result?.content) {
        let combined = ''
        for (const block of result.content) {
          if (block.text) combined += block.text
        }
        try {
          const parsed = JSON.parse(combined)
          return { ok: true, data: parsed }
        } catch {
          return { ok: true, data: { raw: combined } }
        }
      }

      return { ok: true, data: result || {} }
    } catch (e: any) {
      console.error(`[XPOZ] tool ${toolName} error:`, e.message)
      return { ok: false, data: {}, error: e.message }
    }
  }

  // Poll for async operation result (XPOZ uses async ops for large queries)
  async pollOperation(operationId: string, maxWaitMs = 55_000): Promise<MCPCallResult> {
    const start = Date.now()
    while (Date.now() - start < maxWaitMs) {
      const res = await this.callTool('checkOperationStatus', { operationId })
      if (!res.ok) return res
      const status = (res.data as any)?.status
      if (status === 'success' || 'results' in res.data || 'downloadUrl' in res.data) return res
      if (status === 'error') return { ok: false, data: res.data, error: String((res.data as any)?.error || 'op failed') }
      if (status === 'cancelled') return { ok: false, data: {}, error: 'Operation cancelled' }
      await new Promise(r => setTimeout(r, 2000)) // poll every 2s
    }
    return { ok: false, data: {}, error: 'Operation timed out' }
  }

  // Call tool, auto-poll if response has operationId
  async callToolWithPoll(toolName: string, args: Record<string, unknown>): Promise<MCPCallResult> {
    const res = await this.callTool(toolName, args)
    if (!res.ok) return res
    const opId = (res.data as any)?.operationId
    if (opId) return this.pollOperation(opId)
    return res
  }

  private _parseResponse(text: string): Record<string, unknown> | null {
    // SSE format: lines starting with "data: "
    const lines = text.split('\n')
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        try { return JSON.parse(line.slice(6)) } catch { continue }
      }
    }
    // Plain JSON
    try { return JSON.parse(text) } catch { return null }
  }
}

// ─── High-level helpers ───────────────────────────────────────────────────────

// Search Twitter/X for keywords — primary social source
export async function xpozSearchTweets(
  apiKey: string,
  query: string,
  options: { startDate?: string; endDate?: string; limit?: number; language?: string; filterRetweets?: boolean } = {}
): Promise<XpozTwitterPost[]> {
  const client = new XpozMCPClient(apiKey)
  const connected = await client.connect()
  if (!connected) return []

  const res = await client.callToolWithPoll('getTwitterPostsByKeywords', {
    query,
    ...(options.startDate && { startDate: options.startDate }),
    ...(options.endDate && { endDate: options.endDate }),
    ...(options.limit && { limit: options.limit }),
    ...(options.language && { language: options.language }),
    ...(options.filterRetweets !== undefined && { filterOutRetweets: options.filterRetweets }),
  })

  if (!res.ok) { console.warn('[XPOZ] searchTweets failed:', res.error); return [] }
  const results = (res.data?.results ?? res.data?.data ?? []) as XpozTwitterPost[]
  console.log(`[XPOZ] searchTweets "${query}": ${results.length} posts`)
  return results
}

// Get all recent posts from a specific account handle
export async function xpozGetAuthorTweets(
  apiKey: string,
  username: string,
  options: { startDate?: string; limit?: number } = {}
): Promise<XpozTwitterPost[]> {
  const client = new XpozMCPClient(apiKey)
  await client.connect()

  const res = await client.callToolWithPoll('getTwitterPostsByAuthor', {
    username: username.replace('@', ''),
    ...(options.startDate && { startDate: options.startDate }),
    ...(options.limit && { limit: options.limit }),
  })
  if (!res.ok) { console.warn('[XPOZ] getAuthorTweets failed:', res.error); return [] }
  return (res.data?.results ?? res.data?.data ?? []) as XpozTwitterPost[]
}

// Find influential Twitter users talking about keywords (influencer discovery)
export async function xpozGetUsersByKeywords(
  apiKey: string,
  query: string,
  options: { startDate?: string; limit?: number } = {}
): Promise<XpozTwitterUser[]> {
  const client = new XpozMCPClient(apiKey)
  await client.connect()

  const res = await client.callToolWithPoll('getTwitterUsersByKeywords', {
    query,
    ...(options.startDate && { startDate: options.startDate }),
    ...(options.limit && { limit: options.limit }),
  })
  if (!res.ok) { console.warn('[XPOZ] getUsersByKeywords failed:', res.error); return [] }
  return (res.data?.results ?? res.data?.data ?? []) as XpozTwitterUser[]
}

// Get Twitter user profile + influence metrics
export async function xpozGetUser(apiKey: string, username: string): Promise<XpozTwitterUser | null> {
  const client = new XpozMCPClient(apiKey)
  await client.connect()
  const res = await client.callToolWithPoll('getTwitterUser', { username: username.replace('@', '') })
  if (!res.ok) return null
  return (res.data?.result ?? res.data) as XpozTwitterUser
}

// Count tweet volume for a query (fast, no content)
export async function xpozCountTweets(
  apiKey: string,
  phrase: string,
  options: { startDate?: string; endDate?: string } = {}
): Promise<number> {
  const client = new XpozMCPClient(apiKey)
  await client.connect()
  const res = await client.callTool('countTweets', {
    phrase,
    ...(options.startDate && { startDate: options.startDate }),
    ...(options.endDate && { endDate: options.endDate }),
  })
  if (!res.ok) return 0
  return Number(res.data?.count ?? res.data?.result ?? 0)
}

// Search Instagram posts (bonus — useful for politician accounts)
export async function xpozSearchInstagram(
  apiKey: string,
  query: string,
  options: { startDate?: string; limit?: number } = {}
): Promise<XpozInstagramPost[]> {
  const client = new XpozMCPClient(apiKey)
  await client.connect()
  const res = await client.callToolWithPoll('getInstagramPostsByKeywords', {
    query,
    ...(options.startDate && { startDate: options.startDate }),
    ...(options.limit && { limit: options.limit }),
  })
  if (!res.ok) { console.warn('[XPOZ] searchInstagram failed:', res.error); return [] }
  return (res.data?.results ?? res.data?.data ?? []) as XpozInstagramPost[]
}

// Search Reddit via XPOZ (richer than free Reddit JSON API)
export async function xpozSearchReddit(
  apiKey: string,
  query: string,
  options: { startDate?: string; limit?: number; subreddit?: string } = {}
): Promise<XpozRedditPost[]> {
  const client = new XpozMCPClient(apiKey)
  await client.connect()
  const res = await client.callToolWithPoll('getRedditPostsByKeywords', {
    query,
    ...(options.startDate && { startDate: options.startDate }),
    ...(options.limit && { limit: options.limit }),
    ...(options.subreddit && { subreddit: options.subreddit }),
  })
  if (!res.ok) { console.warn('[XPOZ] searchReddit failed:', res.error); return [] }
  return (res.data?.results ?? res.data?.data ?? []) as XpozRedditPost[]
}
