import { useState, useEffect, useRef, useMemo } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import {
  useAccount, useFeedItems, useAIBrief, useTrendMetrics,
  useConstituencyPulse, useCompetitors, useSchemes, useIssueOwnership,
  useUpdateAccount, useClientIngest, useContradictionChecker, useTwitterSweep,
} from '@/hooks/useData'
import { useRealtimeFeed, useRealtimeContradictions } from '@/hooks/useRealtime'
import { triggerEdgeIngest, clientFetchNews } from '@/lib/clientIngest'
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
import type { Account, FeedItem } from '@/types'
import toast from 'react-hot-toast'

const selectIsVideoOpen  = (s: ReturnType<typeof useDashboardStore.getState>) => s.isVideoOpen
const selectActiveVideo  = (s: ReturnType<typeof useDashboardStore.getState>) => s.activeVideo
const selectCloseVideo   = (s: ReturnType<typeof useDashboardStore.getState>) => s.closeVideo
const selectSetAllCounts = (s: ReturnType<typeof useFeedCountStore.getState>) => s.setAllCounts

export default function DashboardPage() {
  const { user } = useAuthStore()
  const navigate  = useNavigate()
  const [showSettings, setShowSettings]   = useState(false)
  const [showSearch,   setShowSearch]     = useState(false)
  const [showAnalytics, setShowAnalytics] = useState(false)
  const [ingestDone,   setIngestDone]     = useState(false)

  const isVideoOpen  = useDashboardStore(selectIsVideoOpen)
  const activeVideo  = useDashboardStore(selectActiveVideo)
  const closeVideo   = useDashboardStore(selectCloseVideo)
  const setAllCounts = useFeedCountStore(selectSetAllCounts)
  const qc = useQueryClient()

  const { data: account, isLoading: accountLoading, error: accountError } = useAccount()
  const accountId = account?.id ?? ''
  const keywords  = account?.keywords ?? []

  // ── Data fetches ──────────────────────────────────────────────────────────
  const { data: dbFeed = [],        isLoading: feedLoading } = useFeedItems(accountId)
  const { data: twitterFeed = [] }  = useTwitterSweep(accountId, keywords)

  // Browser-direct fallback feed (YouTube + CSE + Reddit — no CORS proxy)
  const [browserFeed,    setBrowserFeed]    = useState<FeedItem[]>([])
  const [browserFetched, setBrowserFetched] = useState(false)

  const clientIngestMutation = useClientIngest()

  // ── Merge all feeds ───────────────────────────────────────────────────────
  const feed = useMemo(() => {
    const seen = new Set<string>()
    return [...dbFeed, ...twitterFeed, ...browserFeed]
      .filter(i => { const k = i.url || i.id; if (seen.has(k)) return false; seen.add(k); return true })
      .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
  }, [dbFeed, twitterFeed, browserFeed])

  const { data: brief = null }        = useAIBrief(accountId)
  const { data: trends = [] }         = useTrendMetrics(accountId)
  const { data: pulse }               = useConstituencyPulse(accountId, account)
  const { data: competitors = [] }    = useCompetitors(account)
  const { data: schemes = [] }        = useSchemes(accountId, account)
  const { data: issueOwnership = [] } = useIssueOwnership(accountId)

  // All tracked politicians (for feed display + FeedDetailPanel)
  const trackedPoliticianNames = useMemo(() =>
    (account?.tracked_politicians ?? []).map(p => p.name), [account?.tracked_politicians])

  // COMPETITORS ONLY — for Quote Intel contradiction checking
  const competitorNames = useMemo(() =>
    (account?.tracked_politicians ?? [])
      .filter(p => p.is_competitor)
      .map(p => p.name), [account?.tracked_politicians])

  const contradictionChecker = useContradictionChecker(accountId, feed, competitorNames.length > 0 ? competitorNames : trackedPoliticianNames)
  const [contradictionRan, setContradictionRan] = useState(false)

  const updateAccountMutation = useUpdateAccount()
  useRealtimeFeed(accountId)
  useRealtimeContradictions(accountId)

  // ── Feed count sync ───────────────────────────────────────────────────────
  useEffect(() => {
    const counts = { red: 0, yellow: 0, blue: 0, silver: 0 }
    feed.forEach(f => { if (f.bucket in counts) counts[f.bucket as keyof typeof counts]++ })
    // blue count includes silver (merged into BACKGROUND column)
    setAllCounts({ ...counts, blue: counts.blue + counts.silver, silver: 0 })
  }, [feed, setAllCounts])

  // ── PRIMARY INGEST: fires once per session as soon as account loads ──────
  // Strategy:
  //   1. Trigger edge function (server-side Google News + Nitter + YT + Reddit)
  //   2. In parallel: fetch browser-safe APIs (YouTube + CSE + Reddit)
  //   3. Edge fn results → Supabase → useFeedItems() picks up via Realtime
  //   4. Browser results → browserFeed state → immediately shown in feed
  const accountRef = useRef(account)
  useEffect(() => { accountRef.current = account }, [account])

  useEffect(() => {
    if (!accountId || ingestDone || accountLoading) return
    const acc = accountRef.current
    if (!acc?.keywords?.length) return

    setIngestDone(true)
    console.log('[Dashboard] Starting ingest for', accountId, 'keywords:', acc.keywords)

    // Fire edge function ingest (saves to Supabase, realtime pushes to feed)
    triggerEdgeIngest(accountId, acc.politician_name, acc.keywords)
      .then(result => {
        if (result.inserted > 0) {
          toast.success(`⚡ ${result.inserted} items ingested`, {
            duration: 3000,
            style: { background:'#0d1018', border:'1px solid rgba(34,211,160,0.4)', color:'#22d3a0', fontFamily:'IBM Plex Mono, monospace', fontSize:'11px' }
          })
          qc.invalidateQueries({ queryKey: ['feed', accountId] })
          qc.invalidateQueries({ queryKey: ['brief', accountId] })
        } else if (!result.ok) {
          console.warn('[Dashboard] Edge fn failed:', result.error)
          toast.error(`Ingest failed: ${result.error?.slice(0,60)}`, { duration: 5000 })
        } else {
          console.warn('[Dashboard] Edge fn returned 0 items - check Supabase function logs')
          toast(`⚠ Ingest returned 0 items. Check edge function logs.`, { duration: 5000, style: { background:'#0d1018', border:'1px solid rgba(245,166,35,0.4)', color:'#f5a623', fontFamily:'IBM Plex Mono, monospace', fontSize:'11px' } })
        }
      })
      .catch(e => {
        console.warn('[Dashboard] Edge fn exception:', e)
        toast.error(`Edge fn error: ${e.message}`, { duration: 4000 })
      })

    // In parallel: fetch browser-safe APIs immediately
    if (!browserFetched) {
      setBrowserFetched(true)
      clientFetchNews(accountId, acc.keywords, 15)
        .then(items => {
          console.log(`[Dashboard] Browser fetch got ${items.length} items`)
          setBrowserFeed(items)
          // Also save browser items to Supabase for persistence
          clientIngestMutation.mutate({ accountId, keywords: acc.keywords, politicianName: acc.politician_name })
        })
        .catch(e => console.warn('[Dashboard] Browser fetch error:', e))
    }
  // accountId and accountLoading are the only real deps — acc tracked via ref
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, accountLoading])

  // ── Contradiction checker ─────────────────────────────────────────────────
  useEffect(() => {
    if (contradictionRan || !accountId || feed.length < 5 || !trackedPoliticianNames.length) return
    setContradictionRan(true)
    contradictionChecker.mutate(undefined, {
      onSuccess: (result) => {
        if (result.flagged > 0) {
          toast(`⚡ ${result.flagged} contradiction${result.flagged > 1 ? 's' : ''} detected`, {
            duration: 6000,
            style: { background: '#0d1018', border: '1px solid rgba(245,166,35,0.4)', color: '#f5a623', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px' },
          })
        }
      },
    })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId, feed.length, trackedPoliticianNames.length, contradictionRan])

  // ── Analytics + keyboard shortcuts ────────────────────────────────────────
  useEffect(() => { if (accountId) analytics.dashboardLoaded(accountId) }, [accountId])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') { e.preventDefault(); setShowSearch(s => !s) }
      if (e.key === 'Escape') { setShowSearch(false); setShowSettings(false) }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ── Derived values ────────────────────────────────────────────────────────
  const safePulse = useMemo(() => pulse ?? {
    account_id: accountId, constituency: account?.constituency || 'National',
    state: account?.state || '', issues: [], overall_sentiment: 50,
    updated_at: new Date().toISOString(),
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulse])

  const tickerBrief = useMemo(() => {
    if (brief && (brief.ticker_items?.length || 0) > 0) return brief
    // Ticker prioritises: RED (crisis) first, then YELLOW (developing), then rest
    const crisis    = feed.filter(f => f.bucket === 'red').slice(0, 3)
    const developing = feed.filter(f => f.bucket === 'yellow').slice(0, 3)
    const rest      = feed.filter(f => f.bucket !== 'red' && f.bucket !== 'yellow').slice(0, 3)
    const ordered   = [...crisis, ...developing, ...rest].slice(0, 10)
    const top = ordered.map((f, i) => ({
      id: f.id || `tk-${i}`,
      tag: (f.bucket === 'red' ? 'CRISIS' : f.bucket === 'yellow' ? 'DEVELOPING' : f.sentiment === 'positive' ? 'POSITIVE' : 'INTEL') as any,
      text: `${(f.source || 'Feed').toUpperCase()} — ${(f.headline || '').slice(0, 130)}`,
    }))
    if (top.length === 0) {
      return {
        id: 'tk-boot', account_id: accountId, situation_summary: '', pattern_analysis: '',
        opportunities: [], ticker_items: [
          { id: 't1', tag: 'INTEL' as any, text: 'BharatMonitor loading — fetching data from Google News, YouTube, X and Reddit…' },
          { id: 't2', tag: 'AI' as any,    text: keywords.length ? `Tracking: ${keywords.slice(0,3).join(', ')}` : 'Add keywords in Settings to start tracking' },
        ],
        generated_at: new Date().toISOString(),
        next_refresh_at: new Date(Date.now() + 60_000).toISOString(),
      } as any
    }
    return {
      id: 'tk-live', account_id: accountId, situation_summary: '', pattern_analysis: '',
      opportunities: [], ticker_items: top,
      generated_at: new Date().toISOString(), next_refresh_at: new Date(Date.now() + 60_000).toISOString(),
    } as any
  }, [brief, feed, accountId, keywords])

  const kpis = useMemo(() => {
    const total = feed.length
    const pos   = feed.filter(f => f.sentiment === 'positive').length
    const neg   = feed.filter(f => f.sentiment === 'negative').length
    const crisis = feed.filter(f => f.bucket === 'red').length
    const opp    = feed.filter(f => f.bucket === 'yellow').length
    const sentimentPct = total ? Math.round((pos / total) * 100) : 0
    const negPct       = total ? Math.round((neg / total) * 100) : 0
    return { total, pos, neg, crisis, opp, sentimentPct, negPct }
  }, [feed])

  function handleRefresh() {
    if (!accountId || !account?.keywords?.length) return
    setIngestDone(false)  // Reset flag so ingest fires again
    setBrowserFetched(false)
    setBrowserFeed([])
    qc.invalidateQueries({ queryKey: ['feed', accountId] })
    toast('↻ Refreshing data...', { duration: 2000, style: { background: 'var(--s2)', border: '1px solid rgba(34,211,160,0.3)', color: '#22d3a0', fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px' } })
  }

  async function handleSaveAccount(patch: Partial<Account>) {
    if (!account || !user) return
    try {
      await updateAccountMutation.mutateAsync(patch)
      toast.success('Account updated')
      setShowSettings(false)
      setIngestDone(false) // re-trigger ingest with new keywords
      setBrowserFetched(false)
      setBrowserFeed([])
      setContradictionRan(false)
    } catch (e: any) { toast.error(`Save failed: ${e.message}`) }
  }

  // ── Loading / error states ────────────────────────────────────────────────
  if (accountLoading) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ width:'32px', height:'32px', borderRadius:'50%', border:'2px solid var(--acc)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite', margin:'0 auto 12px' }} />
        <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'9px', color:'var(--t2)', letterSpacing:'1px' }}>LOADING INTELLIGENCE…</div>
      </div>
      <style>{`@keyframes spin { to { transform:rotate(360deg) } }`}</style>
    </div>
  )

  if (accountError || (!accountLoading && !account)) return (
    <div style={{ minHeight:'100vh', background:'var(--bg)', display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ textAlign:'center', padding:'24px' }}>
        <div style={{ fontSize:'32px', marginBottom:'12px' }}>⚠</div>
        <div style={{ fontFamily:'IBM Plex Mono, monospace', fontSize:'10px', color:'var(--red)', marginBottom:'8px' }}>ACCOUNT NOT FOUND</div>
        <button className="btn-primary" onClick={() => navigate('/auth')} style={{ fontSize:'9px' }}>← Back to Login</button>
      </div>
    </div>
  )

  return (
    <ErrorBoundary>
      <div style={{ height:'100vh', background:'var(--bg)', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <CommandBar account={account!} kpis={kpis} onSearchClick={() => setShowSearch(true)} onSettingsClick={() => setShowSettings(true)} onAnalyticsClick={() => setShowAnalytics(true)} />
        <AIRibbon brief={tickerBrief} />
        <BucketNav />
        <PlatformFilter />
        {trends.length > 0 && <TrendStrip trends={trends} />}

        <div style={{ display:'grid', gridTemplateColumns:'1fr 220px', flex:1, overflow:'hidden', minHeight:0 }}>
          <div style={{ overflow:'hidden', display:'flex', flexDirection:'column', minHeight:0 }}>
            {feedLoading && feed.length === 0 ? (
              <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--t3)', fontFamily:'IBM Plex Mono, monospace', fontSize:'9px', flexDirection:'column', gap:'8px' }}>
                <div style={{ width:'20px', height:'20px', borderRadius:'50%', border:'2px solid var(--acc)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
                FETCHING INTELLIGENCE…
              </div>
            ) : (
              <BucketColumns feed={feed} accountId={accountId} />
            )}
          </div>
          <Sidebar pulse={safePulse} competitors={competitors} schemes={schemes} issueOwnership={issueOwnership} account={account!} brief={brief} feed={feed} />
        </div>

        {isVideoOpen && activeVideo && <VideoModal videoId={activeVideo.id} title={activeVideo.title} onClose={closeVideo} />}
        <FeedDetailPanel trackedPoliticianNames={trackedPoliticianNames} accountId={accountId} />
        {showSearch    && <SearchOverlay onClose={() => setShowSearch(false)} />}
        {showSettings  && <AccountForm account={account!} onClose={() => setShowSettings(false)} onSave={handleSaveAccount} />}
        {showAnalytics && <AnalyticsPanel feed={feed} account={account!} competitors={competitors} brief={brief} onClose={() => setShowAnalytics(false)} />}
      </div>
      <style>{`
        @keyframes blink  { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes ticker { from{transform:translateX(0)} to{transform:translateX(-50%)} }
        @keyframes spin   { to{transform:rotate(360deg)} }
      `}</style>
    </ErrorBoundary>
  )
}
