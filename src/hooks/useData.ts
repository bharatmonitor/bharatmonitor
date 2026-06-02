import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store'
import { fetchAccount, fetchAllAccounts, triggerIngest, updateAccount } from '@/lib/accounts'
import { sweepGoogleX, searchXViaGoogle, googleXResultToFeedItem } from '@/lib/googleSearchX'
import { clientFetchNews, clientSideIngest } from '@/lib/clientIngest'
import type { FeedItem, AIBrief, TrendMetric, Account } from '@/types'

// ─── Account from Supabase ───────────────────────────────────────────────────
export function useAccount() {
  const { user } = useAuthStore()
  return useQuery({
    queryKey: ['account', user?.id],
    queryFn: () => fetchAccount(user?.id || ''),
    enabled: !!user?.id,
    staleTime: 60_000,
    retry: 2,
  })
}

// ─── Feed Items ───────────────────────────────────────────────────────────────
export function useFeedItems(accountId: string) {
  return useQuery({
    queryKey: ['feed', accountId],
    queryFn: async (): Promise<FeedItem[]> => {
      if (!accountId) return []
      const [r1, r2] = await Promise.all([
        supabase.from('bm_feed').select('*').eq('account_id', accountId)
          .order('published_at', { ascending: false }).limit(200),
        supabase.from('feed_items').select('*').eq('account_id', accountId)
          .order('published_at', { ascending: false }).limit(100),
      ])
      if (r1.error) console.error('[useFeedItems] bm_feed error:', r1.error.message, r1.error.code)
      if (r2.error) console.error('[useFeedItems] feed_items error:', r2.error.message, r2.error.code)
      console.log(`[useFeedItems] bm_feed: ${r1.data?.length ?? 0} rows, feed_items: ${r2.data?.length ?? 0} rows for account_id=${accountId}`)
      // Platform breakdown - critical for debugging
      if (r1.data?.length) {
        const platforms: Record<string,number> = {}
        r1.data.forEach((i:any) => { const p = i.platform || i.source_type || 'unknown'; platforms[p] = (platforms[p]||0)+1 })
        console.log('[useFeedItems] Platform breakdown:', JSON.stringify(platforms))
      }
      const now = new Date().toISOString()
      const bm: FeedItem[] = (r1.data || []).map((i: any) => ({
        id: i.id, account_id: i.account_id,
        headline: i.title || i.headline || '',
        source: i.source_name || i.source || '',
        published_at: i.published_at || now,
        fetched_at: i.fetched_at || i.created_at || now,
        language: i.language || 'english',
        bucket: (i.bucket && ['red','yellow','blue','silver'].includes(i.bucket) ? i.bucket : tone2bucket(i.tone || 0)) as any,
        platform: (i.platform || i.source_type || 'news') as any,
        url: i.url || '',
        sentiment: (i.sentiment || tone2sent(i.tone)) as any,
        tone: i.tone || 0,
        keyword: i.keyword || '',
        geo_tags: i.geo_tags || [],
        topic_tags: i.topic_tags || [],
        body: i.body || i.ai_summary || '',
        contradiction: undefined,
      }))
      const fi: FeedItem[] = (r2.data || []).map((i: any) => ({
        id: i.id, account_id: i.account_id,
        headline: i.headline || i.title || '',
        source: i.source || '',
        published_at: i.published_at || now,
        fetched_at: i.fetched_at || i.created_at || now,
        language: i.language || 'english',
        bucket: (i.bucket || 'blue') as any,
        platform: (i.platform || 'news') as any,
        url: i.url || '',
        sentiment: (i.sentiment || 'neutral') as any,
        tone: i.tone || 0,
        keyword: i.keyword || '',
        geo_tags: i.geo_tags || [],
        topic_tags: i.topic_tags || [],
        body: i.body || '',
        contradiction: i.contradictions?.[0] || undefined,
      }))
      const seen = new Set<string>()
      const merged = [...bm, ...fi]
        .filter(i => { const k = i.url || i.id; if (seen.has(k)) return false; seen.add(k); return true })
        .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())

      // Fetch the account's excluded + tracked keywords
      const { data: acctData } = await supabase
        .from('accounts').select('excluded_keywords, keywords').eq('id', accountId).maybeSingle()
      const excluded: string[] = acctData?.excluded_keywords || []
      const tracked: string[] = acctData?.keywords || []

      const norm    = (s: string) => (s || '').toLowerCase().replace(/\s+/g, ' ').trim()
      const nospace = (s: string) => (s || '').toLowerCase().replace(/[\s\-]/g, '')
      const trackedN  = tracked.map(norm).filter(Boolean)
      const trackedNS = tracked.map(nospace).filter((k) => k.length >= 5)

      let out = merged

      // 1) excluded_keywords blocklist (existing behaviour)
      if (excluded.length) {
        out = out.filter((item) => {
          const text = norm(item.headline + ' ' + (item.keyword || ''))
          return !excluded.some((ex: string) => text.includes(norm(ex)))
        })
      }

      // 2) tracked-keyword RELEVANCE allowlist.
      // Match on the item's actual TEXT (headline + body), NOT the stored `keyword`
      // attribution — that field is set by the ingester and can be wrong (e.g. a
      // Google-News fuzzy hit), which is exactly what was leaking unrelated national
      // news ("Ebola", "CBSE", "Himachal fire") into the Crisis/Developing columns.
      // Skip the gate when no keywords are configured (e.g. God account).
      if (trackedN.length) {
        out = out.filter((item) => {
          const text  = norm(item.headline + ' ' + (item.body || ''))
          const textN = nospace(item.headline + ' ' + (item.body || ''))
          return trackedN.some((k) => text.includes(k)) || trackedNS.some((k) => textN.includes(k))
        })
      }

      return out
    },
    enabled: !!accountId,
    refetchInterval: 3 * 60_000,
    staleTime: 30_000,
    retry: 1,
  })
}

function tone2bucket(tone: number): string {
  if (!tone) return 'silver'
  if (tone <= -3) return 'red'
  if (tone <= -1) return 'yellow'
  if (tone >= 1) return 'blue'
  return 'silver'
}
function tone2sent(tone: number): string {
  if (!tone) return 'neutral'
  return tone > 1 ? 'positive' : tone < -1 ? 'negative' : 'neutral'
}

// ─── AI Brief ─────────────────────────────────────────────────────────────────
// Tries DB first, falls back to generating from live feed data client-side.
export function useAIBrief(accountId: string) {
  return useQuery({
    queryKey: ['brief', accountId],
    queryFn: async (): Promise<AIBrief | null> => {
      if (!accountId) return null
      // Try DB first
      try {
        const { data } = await supabase
          .from('bm_analysis').select('*').eq('account_id', accountId)
          .order('created_at', { ascending: false }).limit(1).maybeSingle()
        if (data) {
          return {
            id: data.id || accountId, account_id: accountId,
            situation_summary: data.summary || 'Monitoring active.',
            pattern_analysis: data.opposition_activity || 'No pattern data yet.',
            opportunities: (data.top_narratives || []).map((n: string, i: number) => ({
              id: `opp-${i}`, score: 75 - i * 5, politician: '', description: n,
              current_statement: '', historical_statement: '', confidence: 80,
              type: 'contradiction' as const,
            })),
            ticker_items: (data.ticker_items || []).slice(0, 8),
            generated_at: data.created_at || new Date().toISOString(),
            next_refresh_at: new Date(Date.now() + 5 * 60_000).toISOString(),
          } as AIBrief
        }
      } catch { /* fall through to live generation */ }
      // Generate AI brief from live feed when DB has no brief yet
      const { data: feedData } = await supabase
        .from('bm_feed').select('headline, bucket, sentiment, source, keyword, published_at')
        .eq('account_id', accountId).order('published_at', { ascending: false }).limit(50)
      const items = feedData || []
      if (!items.length) return null
      const crisis  = items.filter((i: any) => i.bucket === 'red')
      const opp     = items.filter((i: any) => i.bucket === 'yellow')
      const pos     = items.filter((i: any) => i.sentiment === 'positive')
      const ticker  = items.slice(0, 10).map((i: any, idx: number) => ({
        id: `tk-${idx}`, created_at: i.published_at || new Date().toISOString(),
        bucket: (i.bucket || 'silver') as any,
        tag: (i.bucket === 'red' ? 'CRISIS' : i.bucket === 'yellow' ? 'OPP' : i.sentiment === 'positive' ? 'POSITIVE' : 'INTEL') as any,
        text: `${(i.source || '').toUpperCase()} — ${(i.headline || '').slice(0, 120)}`,
      }))
      return {
        id: `live-brief-${accountId}`, account_id: accountId,
        situation_summary: `Live monitoring active. ${items.length} items tracked. ${crisis.length > 0 ? `⚡ ${crisis.length} crisis signals detected.` : 'No crisis signals.'} ${pos.length} positive mentions.`,
        pattern_analysis: opp.length > 0 ? `${opp.length} opposition pressure points flagged — monitor developing stories.` : 'No significant opposition pressure currently detected.',
        opportunities: [],
        ticker_items: ticker,
        generated_at: new Date().toISOString(),
        next_refresh_at: new Date(Date.now() + 5 * 60_000).toISOString(),
      } as AIBrief
    },
    enabled: !!accountId,
    refetchInterval: 5 * 60_000,
    staleTime: 4 * 60_000,
    retry: 1,
  })
}

// ─── Trend Metrics ────────────────────────────────────────────────────────────
export function useTrendMetrics(accountId: string) {
  return useQuery({
    queryKey: ['trends', accountId],
    queryFn: async (): Promise<TrendMetric[]> => {
      if (!accountId) return []
      const { data } = await supabase
        .from('bm_feed').select('tone, published_at, keyword')
        .eq('account_id', accountId).order('published_at', { ascending: false }).limit(200)
      if (!data?.length) return []
      const byDay: Record<string, number[]> = {}
      data.forEach((r: any) => {
        const d = new Date(r.published_at)
        const key = `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
        if (!byDay[key]) byDay[key] = []
        byDay[key].push(r.tone || 0)
      })
      const points = Object.entries(byDay).sort(([a],[b])=>a.localeCompare(b)).slice(-7).map(([k, tones]) => ({
        date: k, value: Math.round((tones.reduce((s, t) => s + t, 0) / tones.length + 5) * 10),
      }))
      return [{
        id: `tm-${accountId}`, account_id: accountId, metric: 'sentiment',
        data_points: points,
        current_value: points[points.length - 1]?.value || 50,
        delta_7d: points.length >= 2 ? (points[points.length-1]?.value || 50) - (points[points.length-2]?.value || 50) : 0,
        delta_since_election: 0,
        election_reference_date: '2024-04-19',
      }] as TrendMetric[]
    },
    enabled: !!accountId,
    staleTime: 10 * 60_000,
    retry: 1,
  })
}

// ─── Constituency Pulse ───────────────────────────────────────────────────────
export function useConstituencyPulse(accountId: string, account?: Account | null) {
  return useQuery({
    queryKey: ['pulse', accountId],
    queryFn: async () => {
      if (!accountId || !account) return null
      const { data } = await supabase
        .from('bm_feed').select('keyword, tone')
        .eq('account_id', accountId).order('published_at', { ascending: false }).limit(100)
      const kws: string[] = account.keywords || []
      const issues = kws.slice(0, 6).map((kw) => {
        const items = (data || []).filter((r: any) => r.keyword === kw)
        const pos = items.filter((r: any) => (r.tone || 0) > 0).length
        const total = Math.max(items.length, 1)
        return {
          topic: kw,
          volume_pct: Math.min(Math.round((items.length / Math.max(kws.length * 3, 10)) * 100), 100),
          sentiment: (pos / total > 0.55 ? 'positive' : pos / total < 0.4 ? 'negative' : 'neutral') as any,
          trend: 'flat' as const,
        }
      })
      return {
        account_id: accountId,
        constituency: account.constituency || 'National',
        state: account.state || '',
        overall_sentiment: data?.length
          ? Math.round((data.filter((r: any) => (r.tone || 0) > 0).length / data.length) * 100) : 50,
        issues,
        updated_at: new Date().toISOString(),
      }
    },
    enabled: !!accountId && !!account,
    staleTime: 15 * 60_000,
    retry: 1,
  })
}

// ─── Competitors ──────────────────────────────────────────────────────────────
export function useCompetitors(account?: Account | null) {
  return useQuery({
    queryKey: ['competitors', account?.id],
    queryFn: async () => {
      return (account?.tracked_politicians || []).map((p: any) => ({
        politician: { id: p.id, name: p.name, party: p.party, initials: p.initials, role: p.role, is_competitor: p.is_competitor !== false },
        statements_today: 0, contradictions_flagged: 0,
        latest_contradiction_score: undefined,
        status: 'watch' as const,
        last_active: new Date().toISOString(),
      }))
    },
    enabled: !!account,
    staleTime: 5 * 60_000,
  })
}

// ─── Schemes ──────────────────────────────────────────────────────────────────
export function useSchemes(accountId: string, account?: Account | null) {
  return useQuery({
    queryKey: ['schemes', accountId],
    queryFn: async () => {
      if (!accountId || !account) return []
      const kws: string[] = account.tracked_schemes || account.keywords || []
      if (!kws.length) return []
      const { data } = await supabase
        .from('bm_feed').select('keyword, tone').eq('account_id', accountId).limit(100)
      return kws.slice(0, 6).map((kw: string) => {
        const items = (data || []).filter((r: any) => r.keyword === kw)
        const pos = items.filter((r: any) => (r.tone || 0) > 0).length
        return { scheme_name: kw, sentiment_score: Math.round((pos / Math.max(items.length, 1)) * 100), mention_count: items.length, trend: 'flat' as const }
      })
    },
    enabled: !!accountId && !!account,
    staleTime: 30 * 60_000,
    retry: 1,
  })
}

// ─── Issue Ownership ──────────────────────────────────────────────────────────
export function useIssueOwnership(accountId: string) {
  return useQuery({
    queryKey: ['issue-ownership', accountId],
    queryFn: async () => [],
    enabled: !!accountId,
    staleTime: 30 * 60_000,
  })
}

// ─── All Accounts (God Mode) ──────────────────────────────────────────────────
export function useAllAccounts() {
  return useQuery({
    queryKey: ['all-accounts'],
    queryFn: fetchAllAccounts,
    staleTime: 30_000,
  })
}

// ─── Update Account (FIXED: now uses updateAccount which handles demo accounts) ──
export function useUpdateAccount() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async (patch: Partial<Account>) => {
      if (!user?.id) throw new Error('Not logged in')
      const account = qc.getQueryData<Account>(['account', user.id])
      const accountId = account?.id || user.id
      await updateAccount(user.id, accountId, patch)
      // Return the merged account for optimistic cache update
      return { ...account, ...patch, updated_at: new Date().toISOString() }
    },
    onSuccess: (updated) => {
      // Immediately update cache so keywords show without waiting for refetch
      if (updated) qc.setQueryData(['account', user?.id], updated)
      // Then also invalidate to get fresh DB data
      qc.invalidateQueries({ queryKey: ['account', user?.id] })
    },
  })
}

// ─── Create Account ───────────────────────────────────────────────────────────
export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (acc: any) => {
      const { createAccount } = await import('@/lib/accounts')
      return createAccount(acc)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-accounts'] }),
  })
}

// ─── Delete Account ───────────────────────────────────────────────────────────
export function useDeleteAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (id: string) => {
      const { supabaseAdmin } = await import('@/lib/supabase')
      await supabaseAdmin.from('accounts').delete().eq('id', id)
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ['all-accounts'] }),
  })
}

// ─── Trigger Ingest ───────────────────────────────────────────────────────────
export function useTriggerIngest() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ accountId, politicianName, keywords }: { accountId: string; politicianName: string; keywords: string[] }) => {
      await triggerIngest(accountId, politicianName, keywords)
    },
    onSuccess: (_, { accountId }) => qc.invalidateQueries({ queryKey: ['feed', accountId] }),
  })
}

// ─── Search ───────────────────────────────────────────────────────────────────
export function useSearch(accountId: string, query: string) {
  return useQuery({
    queryKey: ['search', accountId, query],
    queryFn: async (): Promise<FeedItem[]> => {
      if (!query.trim() || !accountId) return []
      const now = new Date().toISOString()

      // Search both tables in parallel
      const [r1, r2] = await Promise.all([
        supabase.from('bm_feed').select('*').eq('account_id', accountId)
          .or(`title.ilike.%${query}%,source_name.ilike.%${query}%,keyword.ilike.%${query}%`)
          .order('published_at', { ascending: false }).limit(30),
        supabase.from('feed_items').select('*').eq('account_id', accountId)
          .or(`headline.ilike.%${query}%,source.ilike.%${query}%,keyword.ilike.%${query}%`)
          .order('published_at', { ascending: false }).limit(30),
      ])

      const bm: FeedItem[] = (r1.data || []).map((i: any) => ({
        id: i.id, account_id: i.account_id,
        headline: i.title || i.headline || '',
        body: i.body || i.summary || '',
        source: i.source_name || i.source || '',
        published_at: i.published_at || now,
        fetched_at: i.fetched_at || i.created_at || now,
        language: i.language || 'english',
        bucket: (i.bucket && ['red','yellow','blue','silver'].includes(i.bucket) ? i.bucket : tone2bucket(i.tone || 0)) as any,
        platform: (i.platform || i.source_type || 'news') as any,
        url: i.url || '',
        sentiment: tone2sent(i.tone) as any,
        tone: i.tone || 0,
        keyword: i.keyword || '',
        geo_tags: i.geo_tags || [], topic_tags: i.topic_tags || [],
        contradiction: undefined,
      }))
      const fi: FeedItem[] = (r2.data || []).map((i: any) => ({
        id: i.id, account_id: i.account_id,
        headline: i.headline || i.title || '',
        body: i.body || '',
        source: i.source || i.source_name || '',
        published_at: i.published_at || now,
        fetched_at: i.fetched_at || i.created_at || now,
        language: i.language || 'english',
        bucket: (i.bucket || 'blue') as any,
        platform: (i.platform || i.source_type || 'news') as any,
        url: i.url || '',
        sentiment: (i.sentiment || tone2sent(i.tone)) as any,
        tone: i.tone || 0,
        keyword: i.keyword || '',
        geo_tags: i.geo_tags || [], topic_tags: i.topic_tags || [],
        contradiction: undefined,
      }))

      // Deduplicate by URL
      const seen = new Set<string>()
      return [...bm, ...fi]
        .filter(i => { const k = i.url || i.id; if (seen.has(k)) return false; seen.add(k); return true })
        .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
        .slice(0, 50)
    },
    enabled: query.length > 2,
    staleTime: 30_000,
  })
}

// ─── Contradictions ───────────────────────────────────────────────────────────
export function useContradictions(accountId: string) {
  return useQuery({
    queryKey: ['contradictions', accountId],
    queryFn: async () => {
      if (!accountId) return []
      const { data } = await supabase.from('contradictions').select('*')
        .eq('account_id', accountId).order('created_at', { ascending: false }).limit(20)
      return data || []
    },
    refetchInterval: 60_000,
    enabled: !!accountId,
    retry: 1,
  })
}

// ─── Google → X.com keyword sweep (Dashboard auto-load) ─────────────────────
// Runs once when the dashboard loads with tracked keywords.
// Results are merged into the main feed with platform='twitter' + a 'via-google' tag.
export function useGoogleXFeed(accountId: string, keywords: string[]) {
  return useQuery({
    queryKey: ['google-x-feed', accountId, keywords.join(',')],
    queryFn:  () => sweepGoogleX(keywords, accountId, { dateRange: 'week', maxPerKw: 15 }),
    enabled:  !!accountId && keywords.length > 0,
    staleTime: 10 * 60_000,   // re-fetch every 10 min
    refetchInterval: 10 * 60_000,
    retry: 1,
  })
}

// ─── Client-side News Feed (Google News RSS + Reddit) ───────────────────────
// Runs client-side to fetch news even when Supabase tables are empty.
// Results are merged into the main dashboard feed alongside DB + Google X data.
export function useClientNewsFeed(accountId: string, keywords: string[]) {
  return useQuery({
    queryKey: ['client-news-feed', accountId, keywords.join(',')],
    queryFn:  () => clientFetchNews(accountId, keywords, 12),
    enabled:  !!accountId && keywords.length > 0,
    staleTime: 10 * 60_000,
    refetchInterval: 10 * 60_000,
    retry: 1,
  })
}

// ─── Client-side Background Ingest (writes to Supabase) ─────────────────────
// Fires once on dashboard load to populate Supabase tables from client-side.
// Subsequent useFeedItems calls will then find data in the DB.
export function useClientIngest() {
  const qc = useQueryClient()
  const mutation = useMutation({
    mutationFn: async ({ accountId, keywords, politicianName }: { accountId: string; keywords: string[]; politicianName?: string }) => {
      return clientSideIngest(accountId, keywords, { maxPerSource: 12, politicianName })
    },
    onSuccess: (result, { accountId }) => {
      if (result.saved > 0) {
        console.log(`[useClientIngest] Saved ${result.saved} items, invalidating feed queries`)
        qc.invalidateQueries({ queryKey: ['feed', accountId] })
        qc.invalidateQueries({ queryKey: ['trends', accountId] })
        qc.invalidateQueries({ queryKey: ['pulse', accountId] })
      }
    },
  })
  // Expose queryClient for manual invalidation from DashboardPage
  ;(mutation as any).client = qc
  return mutation
}

// ─── Google → X.com live search (DataTable / Search bar) ────────────────────
// Fires when user types a query into the search bar; debounced by 600ms upstream.
// Returns raw Google CSE results so the UI can render them with X-specific detail.
export function useGoogleXSearch(accountId: string, query: string, enabled: boolean) {
  return useQuery({
    queryKey: ['google-x-search', accountId, query],
    queryFn:  async (): Promise<FeedItem[]> => {
      if (!query.trim() || !accountId) return []
      const results = await searchXViaGoogle({
        query,
        dateRange: 'month',
        maxResults: 30,
      })
      return results.map(r => googleXResultToFeedItem(r, accountId, query))
    },
    enabled:  enabled && !!accountId && query.trim().length > 2,
    staleTime: 5 * 60_000,
    retry: 1,
  })
}

// ─── Contradiction Checker (AI Quote Check) ───────────────────────────────────
// Runs the AI contradiction checker on current feed items.
// Only fires when there are tracked politicians configured.
export function useContradictionChecker(
  accountId: string,
  feed: FeedItem[],
  trackedPoliticianNames: string[],
) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      if (!accountId || !feed.length || !trackedPoliticianNames.length) {
        return { checked: 0, flagged: 0, saved: 0, results: [], errors: [] }
      }
      const { runContradictionCheck } = await import('@/lib/contradictionChecker')
      return runContradictionCheck(accountId, feed, trackedPoliticianNames, {
        maxItems: 12,
        minScore: 60,
        saveToDb: true,
      })
    },
    onSuccess: (result) => {
      if (result.saved > 0) {
        qc.invalidateQueries({ queryKey: ['contradictions', accountId] })
        qc.invalidateQueries({ queryKey: ['feed', accountId] })
        console.log(`[useContradictionChecker] Flagged ${result.flagged} contradictions, saved ${result.saved}`)
      }
    },
  })
}

// ─── Single item contradiction check ─────────────────────────────────────────
export function useCheckSingleItem(accountId: string, trackedPoliticianNames: string[]) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (item: FeedItem) => {
      const { checkSingleItem } = await import('@/lib/contradictionChecker')
      return checkSingleItem(accountId, item, trackedPoliticianNames)
    },
    onSuccess: (result) => {
      if (result) {
        qc.invalidateQueries({ queryKey: ['contradictions', accountId] })
      }
    },
  })
}

// ─── Unified Twitter sweep (XPOZ + Apify + GetX) ─────────────────────────────
// Runs all three Twitter sources in parallel and merges results.
export function useTwitterSweep(accountId: string, keywords: string[]) {
  const qc = useQueryClient()
  return useQuery({
    queryKey: ['twitter-sweep', accountId, keywords.join(',')],
    queryFn: async (): Promise<FeedItem[]> => {
      if (!accountId || !keywords.length) return []

      const { SUPABASE_URL, ANON_KEY, SERVICE_KEY } = await import('@/lib/supabase')
      const authKey = SERVICE_KEY || ANON_KEY

      // ── 1. Call bm-xpoz to get real tweets + instagram (saves to bm_feed)
      const xpozPromise = fetch(`${SUPABASE_URL}/functions/v1/bm-xpoz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authKey}`, 'apikey': ANON_KEY },
        body: JSON.stringify({ accountId, keywords: keywords.slice(0, 5), mode: 'search', maxPerKeyword: 20 }),
        signal: AbortSignal.timeout(30_000),
      }).then(r => r.json()).then(d => {
        console.log('[XPOZ]', d.ok ? `✓ ${d.saved || 0} tweets saved` : `✗ ${d.error}`)
        if (d.ok && (d.saved || 0) > 0) {
          setTimeout(() => qc.invalidateQueries({ queryKey: ['feed', accountId] }), 1200)
        }
      }).catch(e => console.warn('[XPOZ] failed:', e.message))

      // ── 2. Bluesky direct API — free, no key, runs in parallel
      const blueskyPromise = fetch(`${SUPABASE_URL}/functions/v1/bm-xpoz`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${authKey}`, 'apikey': ANON_KEY },
        body: JSON.stringify({ accountId, keywords: keywords.slice(0, 4), mode: 'bluesky', maxPerKeyword: 15 }),
        signal: AbortSignal.timeout(30_000),
      }).then(r => r.json()).then(d => {
        console.log('[Bluesky via XPOZ]', d.ok ? `✓ ${d.saved || 0} posts saved` : `✗ ${d.error}`)
        if (d.ok && (d.saved || 0) > 0) {
          setTimeout(() => qc.invalidateQueries({ queryKey: ['feed', accountId] }), 1500)
        }
      }).catch(e => console.warn('[Bluesky] failed:', e.message))

      // Wait for XPOZ + Bluesky to finish (both server-side, no CORS issues)
      await Promise.allSettled([xpozPromise, blueskyPromise])

      // Return empty array — items are saved to bm_feed and will appear
      // when the feed query invalidates (triggered above after save)
      return []
    },
    enabled: !!accountId && keywords.length > 0,
    staleTime: 15 * 60_000,
    refetchInterval: 30 * 60_000,
    retry: 1,
  })
}

// ─── XPOZ Influencer Discovery ────────────────────────────────────────────────
// Finds top Twitter users amplifying your keywords — used in Audience tab
export function useXpozInfluencers(accountId: string, keywords: string[]) {
  return useQuery({
    queryKey: ['xpoz-influencers', accountId, keywords.join(',')],
    queryFn: async () => {
      if (!accountId || !keywords.length) return []
      const { fetchXpozInfluencers } = await import('@/lib/twitterSources')
      return fetchXpozInfluencers(keywords, accountId)
    },
    enabled: !!accountId && keywords.length > 0,
    staleTime: 60 * 60_000,      // 1 hour — influencer list doesn't change fast
    refetchInterval: 4 * 60 * 60_000, // refresh every 4h
    retry: 1,
  })
}

// ─── XPOZ Keyword Volume Counts ───────────────────────────────────────────────
// Fast tweet volume per keyword — no content, used in CommandBar / TrendStrip
export function useXpozCounts(accountId: string, keywords: string[]) {
  return useQuery({
    queryKey: ['xpoz-counts', accountId, keywords.join(',')],
    queryFn: async (): Promise<Record<string, number>> => {
      if (!accountId || !keywords.length) return {}
      const { fetchXpozCounts } = await import('@/lib/twitterSources')
      return fetchXpozCounts(keywords, accountId)
    },
    enabled: !!accountId && keywords.length > 0,
    staleTime: 30 * 60_000,
    retry: 1,
  })
}

// ─── XPOZ Watchlist Fetch ─────────────────────────────────────────────────────
// Triggers a server-side fetch of all active watchlist handles via XPOZ
export function useXpozWatchlistFetch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ accountId, handles, keywords }: {
      accountId: string
      handles: { handle: string; platform: string; display_name?: string; is_active?: boolean }[]
      keywords: string[]
    }) => {
      const { fetchXpozWatchlist } = await import('@/lib/twitterSources')
      await fetchXpozWatchlist(handles, accountId, keywords)
    },
    onSuccess: (_, { accountId }) => qc.invalidateQueries({ queryKey: ['feed', accountId] }),
  })
}

// ─── XPOZ Competitor Fetch ────────────────────────────────────────────────────
// Fetches recent posts from competitor/opposition handles
export function useXpozCompetitorFetch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ accountId, competitorHandles, keywords }: {
      accountId: string
      competitorHandles: { name: string; handle: string }[]
      keywords: string[]
    }) => {
      const { fetchXpozCompetitors } = await import('@/lib/twitterSources')
      await fetchXpozCompetitors(competitorHandles, accountId, keywords)
    },
    onSuccess: (_, { accountId }) => qc.invalidateQueries({ queryKey: ['feed', accountId] }),
  })
}
