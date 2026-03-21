import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import {
  DEMO_FEED, DEMO_AI_BRIEF, DEMO_TRENDS,
  DEMO_PULSE, DEMO_COMPETITORS, DEMO_SCHEMES,
  DEMO_ISSUE_OWNERSHIP, DEMO_ACCOUNT
} from '@/lib/mockData'
import { useAuthStore } from '@/store'
import type { FeedItem, AIBrief, TrendMetric, Account } from '@/types'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL.includes('placeholder')

// ─── Feed Items ───────────────────────────────────────────────────────────────

export function useFeedItems(accountId: string, bucket?: string, platform?: string) {
  return useQuery({
    queryKey: ['feed-items', accountId, bucket, platform],
    queryFn: async (): Promise<FeedItem[]> => {
      if (IS_DEMO) {
        let items = DEMO_FEED
        if (bucket) items = items.filter(i => i.bucket === bucket)
        if (platform && platform !== 'all') items = items.filter(i => i.platform === platform)
        return items
      }
      let query = supabase
        .from('feed_items')
        .select('*, contradictions(*)')
        .eq('account_id', accountId)
        .order('published_at', { ascending: false })
        .limit(200)
      if (bucket) query = query.eq('bucket', bucket)
      if (platform && platform !== 'all') query = query.eq('platform', platform)
      const { data, error } = await query
      if (error) throw error
      return (data || []) as FeedItem[]
    },
    refetchInterval: 30000,
    staleTime: 20000,
  })
}

// ─── AI Brief ─────────────────────────────────────────────────────────────────

export function useAIBrief(accountId: string) {
  return useQuery({
    queryKey: ['ai-brief', accountId],
    queryFn: async (): Promise<AIBrief> => {
      if (IS_DEMO) return DEMO_AI_BRIEF
      const { data, error } = await supabase
        .from('ai_briefs')
        .select('*')
        .eq('account_id', accountId)
        .order('generated_at', { ascending: false })
        .limit(1)
        .single()
      if (error) throw error
      return data as AIBrief
    },
    refetchInterval: 5 * 60000,
    staleTime: 4 * 60000,
  })
}

export function useGenerateBrief() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (accountId: string) => {
      if (IS_DEMO) return DEMO_AI_BRIEF
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-brief`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ account_id: accountId }),
        }
      )
      return res.json()
    },
    onSuccess: (_, accountId) => {
      qc.invalidateQueries({ queryKey: ['ai-brief', accountId] })
    },
  })
}

// ─── Trend Metrics ────────────────────────────────────────────────────────────

export function useTrendMetrics(accountId: string) {
  return useQuery({
    queryKey: ['trend-metrics', accountId],
    queryFn: async (): Promise<TrendMetric[]> => {
      if (IS_DEMO) return DEMO_TRENDS
      const { data, error } = await supabase
        .from('trend_metrics')
        .select('*')
        .eq('account_id', accountId)
        .order('metric')
      if (error) throw error
      return (data || []) as TrendMetric[]
    },
    staleTime: 10 * 60000,
  })
}

// ─── Constituency Pulse ───────────────────────────────────────────────────────

export function useConstituencyPulse(accountId: string) {
  return useQuery({
    queryKey: ['pulse', accountId],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_PULSE
      // Derive from feed items — group by topic tags, count volume
      const { data } = await supabase
        .from('feed_items')
        .select('topic_tags, sentiment')
        .eq('account_id', accountId)
        .gte('published_at', new Date(Date.now() - 7 * 86400000).toISOString())
      if (!data?.length) return DEMO_PULSE
      return DEMO_PULSE // fallback until real aggregation is built
    },
    staleTime: 15 * 60000,
  })
}

// ─── Competitors ──────────────────────────────────────────────────────────────

export function useCompetitors(accountId: string) {
  return useQuery({
    queryKey: ['competitors', accountId],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_COMPETITORS
      return DEMO_COMPETITORS
    },
    staleTime: 5 * 60000,
  })
}

// ─── Schemes ──────────────────────────────────────────────────────────────────

export function useSchemes(accountId: string) {
  return useQuery({
    queryKey: ['schemes', accountId],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_SCHEMES
      return DEMO_SCHEMES
    },
    staleTime: 30 * 60000,
  })
}

// ─── Issue Ownership ──────────────────────────────────────────────────────────

export function useIssueOwnership(accountId: string) {
  return useQuery({
    queryKey: ['issue-ownership', accountId],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_ISSUE_OWNERSHIP
      return DEMO_ISSUE_OWNERSHIP
    },
    staleTime: 30 * 60000,
  })
}

// ─── Account ──────────────────────────────────────────────────────────────────

export function useAccount(userId: string) {
  return useQuery({
    queryKey: ['account', userId],
    queryFn: async (): Promise<Account> => {
      if (IS_DEMO) return DEMO_ACCOUNT
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .eq('user_id', userId)
        .single()
      if (error) throw error
      return data as Account
    },
    staleTime: 60 * 60000,
  })
}

export function useUpdateAccount() {
  const qc = useQueryClient()
  const { user } = useAuthStore()
  return useMutation({
    mutationFn: async (updates: Partial<Account>) => {
      if (IS_DEMO) return { ...DEMO_ACCOUNT, ...updates }
      const { data, error } = await supabase
        .from('accounts')
        .update(updates)
        .eq('user_id', user!.id)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['account', user?.id] })
    },
  })
}

// ─── All Accounts (god mode) ───────────────────────────────────────────────────

export function useAllAccounts() {
  return useQuery({
    queryKey: ['all-accounts'],
    queryFn: async (): Promise<Account[]> => {
      if (IS_DEMO) return [DEMO_ACCOUNT]
      const { data, error } = await supabase
        .from('accounts')
        .select('*')
        .order('created_at', { ascending: false })
      if (error) throw error
      return (data || []) as Account[]
    },
  })
}

export function useCreateAccount() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async (account: Partial<Account>) => {
      if (IS_DEMO) return { ...DEMO_ACCOUNT, ...account, id: `acc-${Date.now()}` }
      const { data, error } = await supabase
        .from('accounts')
        .insert(account)
        .select()
        .single()
      if (error) throw error
      return data
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['all-accounts'] })
    },
  })
}

// ─── Trigger RSS fetch ────────────────────────────────────────────────────────

export function useTriggerFetch() {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: async ({ accountId, keywords }: { accountId: string; keywords: string[] }) => {
      if (IS_DEMO) return { success: true, count: 0 }
      const res = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/rss-proxy`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}` },
          body: JSON.stringify({ account_id: accountId, keywords }),
        }
      )
      return res.json()
    },
    onSuccess: (_, { accountId }) => {
      qc.invalidateQueries({ queryKey: ['feed-items', accountId] })
    },
  })
}

// ─── Contradictions ────────────────────────────────────────────────────────────

export function useContradictions(accountId: string) {
  return useQuery({
    queryKey: ['contradictions', accountId],
    queryFn: async () => {
      if (IS_DEMO) return DEMO_FEED.filter(f => f.contradiction).map(f => f.contradiction!)
      const { data, error } = await supabase
        .from('contradictions')
        .select('*')
        .eq('account_id', accountId)
        .order('created_at', { ascending: false })
        .limit(20)
      if (error) throw error
      return data || []
    },
    refetchInterval: 60000,
  })
}

// ─── RSS Feeds config ─────────────────────────────────────────────────────────

export function useRSSFeeds() {
  return useQuery({
    queryKey: ['rss-feeds'],
    queryFn: async () => {
      if (IS_DEMO) return []
      const { data, error } = await supabase
        .from('rss_feeds')
        .select('*')
        .order('tier')
      if (error) throw error
      return data || []
    },
    staleTime: 60 * 60000,
  })
}

// ─── Search ────────────────────────────────────────────────────────────────────

export function useSearch(accountId: string, query: string) {
  return useQuery({
    queryKey: ['search', accountId, query],
    queryFn: async (): Promise<FeedItem[]> => {
      if (!query.trim()) return []
      if (IS_DEMO) {
        const q = query.toLowerCase()
        return DEMO_FEED.filter(f =>
          f.headline.toLowerCase().includes(q) ||
          f.source.toLowerCase().includes(q) ||
          f.geo_tags.some(t => t.toLowerCase().includes(q)) ||
          f.topic_tags.some(t => t.toLowerCase().includes(q))
        )
      }
      const { data, error } = await supabase
        .from('feed_items')
        .select('*')
        .eq('account_id', accountId)
        .or(`headline.ilike.%${query}%,source.ilike.%${query}%`)
        .order('published_at', { ascending: false })
        .limit(50)
      if (error) throw error
      return (data || []) as FeedItem[]
    },
    enabled: query.length > 2,
    staleTime: 30000,
  })
}
