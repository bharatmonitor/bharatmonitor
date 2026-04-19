import { useState, useEffect, useRef, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import {
  useAccount, useFeedItems, useAIBrief, useTrendMetrics,
  useConstituencyPulse, useCompetitors, useSchemes, useIssueOwnership, useUpdateAccount,
  useGoogleXFeed, useClientNewsFeed, useClientIngest, useContradictionChecker,
} from '@/hooks/useData'
import { useRealtimeFeed, useRealtimeContradictions } from '@/hooks/useRealtime'
import { triggerIngest } from '@/lib/accounts'
import { analytics } from '@/lib/analytics'
import CommandBar from '@/components/layout/CommandBar'
import { AIRibbon, BucketNav } from '@/components/layout/AIRibbon'
import PlatformFilter from '@/components/dashboard/PlatformFilter'
import TrendStrip from '@/components/dashboard/TrendStrip'
import Sidebar from '@/components/dashboard/Sidebar'
import BucketColumns from '@/components/feeds/BucketColumns'
import VideoModal from '@/components/dashboard/VideoModal'
import SearchOverlay from '@/components/dashboard/SearchOverlay'
import FeedDetailPanel from '@/components/feeds/FeedDetailPanel'
import AccountForm from '@/components/auth/AccountForm'
import AnalyticsPanel from '@/components/dashboard/AnalyticsPanel'
import ErrorBoundary from '@/components/ErrorBoundary'
import { useDashboardStore, useFeedCountStore } from '@/store'
import type { Account } from '@/types'
import toast from 'react-hot-toast'

const selectIsVideoOpen  = (s: ReturnType<typeof useDashboardStore.getState>) => s.isVideoOpen
const selectActiveVideo  = (s: ReturnType<typeof useDashboardStore.getState>) => s.activeVideo
const selectCloseVideo   = (s: ReturnType<typeof useDashboardStore.getState>) => s.closeVideo
const selectSetAllCounts = (s: ReturnType<typeof useFeedCountStore.getState>) => s.setAllCounts

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [showSettings, setShowSettings]   = useState(false)
  const [showSearch, setShowSearch]       = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [ingestTriggered, setIngestTriggered] = useState(false)

  const isVideoOpen  = useDashboardStore(selectIsVideoOpen)
  const activeVideo  = useDashboardStore(selectActiveVideo)
  const closeVideo   = useDashboardStore(selectCloseVideo)
  const setAllCounts = useFeedCountStore(selectSetAllCounts)

  const { data: account, isLoading: accountLoading, error: accountError } = useAccount()
  const accountId = account?.id ?? ''

  const { data: dbFeed = [], isLoading: feedLoading } = useFeedItems(accountId)
  const { data: googleXFeed = [] }    = useGoogleXFeed(accountId, account?.keywords ?? [])
  const { data: clientNewsFeed = [] } = useClientNewsFeed(accountId, account?.keywords ?? [])

  const clientIngestMutation     = useClientIngest()
  const [clientIngestRan, setClientIngestRan] = useState(false)

  // ── Merged feed ─────────────────────────────────────────────────────────────
  const feed = useMemo(() => {
    const seen = new Set<string>()
    return [...dbFeed, ...googleXFeed, ...clientNewsFeed]
      .filter(i => { const k = i.url || i.id; if (seen.has(k)) return false; seen.add(k); return true })
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
  }, [dbFeed, googleXFeed, clientNewsFeed])

  const { data: brief = null }        = useAIBrief(accountId)
  const { data: trends = [] }         = useTrendMetrics(accountId)
  const { data: pulse }               = useConstituencyPulse(accountId, account)
  const { data: competitors = [] }    = useCompetitors(account)
  const { data: schemes = [] }        = useSchemes(accountId, account)
  const { data: issueOwnership = [] } = useIssueOwnership(accountId)

  // ── AI Contradiction Checker ─────────────────────────────────────────────────
  const trackedPoliticianNames = useMemo(() =>
    (account?.tracked_politicians ?? []).map(p => p.name),
    [account?.tracked_politicians]
  )
  const contradictionChecker = useContradictionChecker(accountId, feed, trackedPoliticianNames)
  const [contradictionRan, setContradictionRan] = useState(false)

  const updateAccountMutation = useUpdateAccount()

  useRealtimeFeed(accountId)
  useRealtimeContradictions(accountId)

  // ── Feed count sync ─────────────────────────────────────────────────────────
  useEffect(() => {
    const counts = { red: 0, yellow: 0, blue: 0, silver: 0 }
    feed.forEach(f => { if (f.bucket in counts) counts[f.bucket as keyof typeof counts]++ })
    setAllCounts(counts)
  }, [feed, setAllCounts])

  // ── Auto-ingest on empty feed ────────────────────────────────────────────────
  const accountRef = useRef(account)
  useEffect(() => { accountRef.current = account }, [account])

  useEffect(() => {
    if (!accountId || ingestTriggered || feedLoading || feed.length > 0) return
    const acc = accountRef.current
    if (!acc?.keywords?.length) return
    setIngestTriggered(true)
    triggerIngest(accountId, acc.politician_name, acc.keywords).catch(() => {})
    if (!clientIngestRan) {
      setClientIngestRan(true)
      clientIngestMutation.mutate({ accountId, keywords: acc.keywords })
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, feed.length, feedLoading, ingestTriggered])

  // ── Auto-run contradiction checker when feed is loaded ────────────────────
  // Runs once per session when feed has ≥5 items and politicians are tracked.
  useEffect(() => {
    if (
      contradictionRan ||
      !accountId ||
      feed.length < 5 ||
      !trackedPoliticianNames.length ||
      contradictionChecker.isPending
    ) return
    setContradictionRan(true)
    console.log('[Dashboard] Auto-running contradiction checker...')
    contradictionChecker.mutate(undefined, {
      onSuccess: (result) => {
        if (result.flagged > 0) {
          toast(`⚡ ${result.flagged} contradiction${result.flagged > 1 ? 's' : ''} detected`, {
            duration: 6000,
            style: {
              background: '#0d1018',
              border: '1px solid rgba(245,166,35,0.4)',
              color: '#f5a623',
              fontFamily: 'IBM Plex Mono, monospace',
              fontSize: '11px',
            },
          })
        }
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, feed.length, trackedPoliticianNames.length, contradictionRan])

  // ── Analytics ───────────────────────────────────────────────────────────────
  useEffect(() => {
    if (accountId) analytics.dashboardLoaded(accountId)
  }, [accountId])

  // ── Keyboard shortcuts ──────────────────────────────────────────────────────
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(s => !s) }
      if (e.key === 'Escape') { setShowSearch(false); setShowSettings(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const safePulse = useMemo(() => pulse ?? {
    account_id: accountId,
    constituency: account?.constituency || 'National',
    state: account?.state || '',
    issues: [],
    overall_sentiment: 50,
    updated_at: new Date().toISOString(),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse])

  const tickerBrief = useMemo(() => {
    if (brief && (brief.ticker_items?.length || 0) > 0) return brief
    const top = feed.slice(0, 8).map((f, i) => ({
      id: f.id || `tk-${i}`,
      tag: (f.bucket === 'red' ? 'CRISIS' : f.bucket === 'yellow' ? 'OPP' :
            f.sentiment === 'positive' ? 'POSITIVE' : 'INTEL') as any,
      text: `${(f.source || 'Feed').toUpperCase()} — ${(f.headline || '').slice(0, 120)}`,
    }))
    if (top.length === 0) {
      return {
        id: 'tk-bootstrap', account_id: accountId,
        situation_summary: '', pattern_analysis: '',
        opportunities: [], ticker_items: [
          { id: 't1', tag: 'AI' as any, text: 'BharatMonitor is warming up — connect data sources under Settings to begin live tracking' },
          { id: 't2', tag: 'INTEL' as any, text: 'Add tracked keywords under the Settings cog to start pulling feeds' },
        ],
        generated_at: new Date().toISOString(),
        next_refresh_at: new Date(Date.now() + 60_000).toISOString(),
      } as any
    }
    return {
      id: 'tk-live', account_id: accountId,
      situation_summary: '', pattern_analysis: '',
      opportunities: [], ticker_items: top,
      generated_at: new Date().toISOString(),
      next_refresh_at: new Date(Date.now() + 60_000).toISOString(),
    } as any
  }, [brief, feed, accountId])

  const kpis = useMemo(() => {
    const total = feed.length
    const pos   = feed.filter(f => f.sentiment === 'positive').length
    const neg   = feed.filter(f => f.sentiment === 'negative').length
    const crisis = feed.filter(f => f.bucket === 'red').length
    const opp   = feed.filter(f => f.bucket === 'yellow').length
    const sentimentPct = total ? Math.round((pos / total) * 100) : 0
    const negPct       = total ? Math.round((neg / total) * 100) : 0
    return { total, pos, neg, crisis, opp, sentimentPct, negPct }
  }, [feed])

  async function handleSaveAccount(patch: Partial<Account>) {
    if (!account || !user) return
    try {
      await updateAccountMutation.mutateAsync(patch)
      toast.success('Account updated successfully')
      setShowSettings(false)
      // Reset contradiction checker to re-run with new politician list
      setContradictionRan(false)
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`)
    }
  }

  if (accountLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center' }}>
          <div style={{ width: '32px', height: '32px', borderRadius: '50%', border: '2px solid var(--acc)', borderTopColor: 'transparent', animation: 'spin 0.8s linear infinite', margin: '0 auto 12px' }} />
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px' }}>LOADING INTELLIGENCE…</div>
        </div>
        <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
      </div>
    )
  }

  if (accountError || (!accountLoading && !account)) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ textAlign: 'center', padding: '24px' }}>
          <div style={{ fontSize: '32px', marginBottom: '12px' }}>⚠</div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: 'var(--red)', marginBottom: '8px' }}>ACCOUNT NOT FOUND</div>
          <div style={{ fontSize: '12px', color: 'var(--t2)', marginBottom: '16px' }}>Account profile could not be loaded. Try logging in again.</div>
          <button className="btn-primary" onClick={() => navigate('/auth')} style={{ fontSize: '9px' }}>← Back to Login</button>
        </div>
      </div>
    )
  }

  const safeAccount = account!

  return (
    <ErrorBoundary>
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
        <CommandBar
          account={safeAccount}
          kpis={kpis}
          onSearchClick={() => setShowSearch(true)}
          onSettingsClick={() => setShowSettings(true)}
          onAnalyticsClick={() => setShowAnalytics(true)}
        />
        <AIRibbon brief={tickerBrief} />
        <BucketNav />
        <PlatformFilter />
        {trends.length > 0 && <TrendStrip trends={trends} />}

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 220px', flex: 1, overflow: 'hidden', minHeight: 0 }}>
          <div style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
            {feedLoading && feed.length === 0 ? (
              <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--t3)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px' }}>
                FETCHING INTELLIGENCE…
              </div>
            ) : (
              <BucketColumns feed={feed} />
            )}
          </div>
          <Sidebar
            pulse={safePulse}
            competitors={competitors}
            schemes={schemes}
            issueOwnership={issueOwnership}
            account={safeAccount}
            brief={brief}
            feed={feed}
          />
        </div>

        {isVideoOpen && activeVideo && (
          <VideoModal videoId={activeVideo.id} title={activeVideo.title} onClose={closeVideo} />
        )}
        <FeedDetailPanel
          trackedPoliticianNames={trackedPoliticianNames}
          accountId={accountId}
        />
        {showSearch  && <SearchOverlay onClose={() => setShowSearch(false)} />}
        {showSettings && (
          <AccountForm account={safeAccount} onClose={() => setShowSettings(false)} onSave={handleSaveAccount} />
        )}
        {showAnalytics && (
          <AnalyticsPanel feed={feed} account={safeAccount} competitors={competitors} brief={brief} onClose={() => setShowAnalytics(false)} />
        )}
      </div>

      <style>{`
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
      `}</style>
    </ErrorBoundary>
  )
}
