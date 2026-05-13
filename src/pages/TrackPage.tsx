// BharatMonitor — Track Page
// Keyword management + Social media watchlist + National discourse + Data sources
// All tracking configuration in one place

import { useState, useMemo } from 'react'
import { useAccount, useUpdateAccount, useFeedItems } from '@/hooks/useData'
import NavBar from '@/components/layout/NavBar'
import { POLITICAL_WATCHLIST, NATIONAL_DISCOURSE_KEYWORDS } from '@/lib/nationalDiscourse'
import { ANON_KEY, SUPABASE_URL } from '@/lib/supabase'
import type { WatchlistHandle } from '@/types'
import toast from 'react-hot-toast'

const mono = '"IBM Plex Mono", monospace'
const DARK = '#0d1018'
const CARD = '#111827'
const BORDER = 'rgba(255,255,255,0.07)'
const ACC  = '#f97316'
const GREEN = '#22d3a0'
const RED   = '#f03e3e'
const BLUE  = '#3d8ef0'
const BSKY  = '#0085ff'
const T0    = '#edf0f8'
const T1    = '#c8d0e0'
const T2    = '#8892a4'
const T3    = '#545f78'

const CATEGORY_COLORS: Record<string, string> = {
  journalist: '#3d8ef0', politician: '#f97316', commentator: '#7c6dfa',
  influencer: '#22d3a0', custom: '#8892a4',
}

const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1d9bf0', bluesky: '#0085ff', instagram: '#e1306c',
  meta: '#1877f2', all: '#8892a4',
}

function Section({ title, badge, children, accent }: { title: string; badge?: string | number; children: React.ReactNode; accent?: string }) {
  return (
    <div style={{ background: CARD, border: `1px solid ${BORDER}`, borderRadius: '12px', overflow: 'hidden', marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '12px 16px', borderBottom: `1px solid ${BORDER}`, background: 'rgba(255,255,255,0.02)' }}>
        {accent && <div style={{ width: '3px', height: '14px', borderRadius: '2px', background: accent, flexShrink: 0 }} />}
        <span style={{ fontFamily: mono, fontSize: '9px', color: T2, letterSpacing: '1.5px', flex: 1 }}>{title}</span>
        {badge !== undefined && (
          <span style={{ fontFamily: mono, fontSize: '8px', color: T3, background: 'rgba(255,255,255,0.06)', padding: '2px 8px', borderRadius: '10px' }}>
            {badge}
          </span>
        )}
      </div>
      <div style={{ padding: '14px 16px' }}>
        {children}
      </div>
    </div>
  )
}

export default function TrackPage() {
  const { data: account } = useAccount()
  const { data: feed = [] } = useFeedItems(account?.id || '')
  const updateAccount = useUpdateAccount()

  const [activeTab, setActiveTab] = useState<'keywords' | 'watchlist' | 'national' | 'sources'>('keywords')
  const [newKeyword, setNewKeyword] = useState('')
  const [newHandle, setNewHandle]   = useState('')
  const [newHandleName, setNewHandleName] = useState('')
  const [newHandlePlatform, setNewHandlePlatform] = useState<'twitter' | 'bluesky' | 'all'>('twitter')
  const [newHandleCategory, setNewHandleCategory] = useState<'journalist' | 'politician' | 'commentator' | 'influencer' | 'custom'>('journalist')
  const [fetchingNational, setFetchingNational] = useState(false)
  const [lastNationalCount, setLastNationalCount] = useState(0)

  const keywords       = account?.keywords || []
  const watchlist      = account?.watchlist_handles || []

  // Keyword stats from feed
  const keywordStats = useMemo(() => keywords.map(kw => {
    const items = feed.filter(f => (f.keyword || '').toLowerCase() === kw.toLowerCase() || f.headline.toLowerCase().includes(kw.toLowerCase()))
    const pos = items.filter(f => f.sentiment === 'positive').length
    const neg = items.filter(f => f.sentiment === 'negative').length
    const crisis = items.filter(f => f.bucket === 'red').length
    return { kw, count: items.length, pos, neg, crisis, score: items.length ? Math.round(pos / items.length * 100) : 50 }
  }).sort((a, b) => b.count - a.count), [feed, keywords])

  // Watchlist handle stats
  const handleStats = useMemo(() => watchlist.map(wh => {
    const items = feed.filter(f => f.source?.toLowerCase().includes(wh.handle.replace('@', '').toLowerCase()))
    return { ...wh, count: items.length, sentiment: items.filter(f => f.sentiment === 'positive').length - items.filter(f => f.sentiment === 'negative').length }
  }), [feed, watchlist])

  async function addKeyword() {
    const kw = newKeyword.trim()
    if (!kw || keywords.includes(kw)) return
    try {
      await updateAccount.mutateAsync({ keywords: [...keywords, kw] } as any)
      setNewKeyword('')
      toast.success(`Tracking: ${kw}`)
    } catch (e: any) { toast.error(e.message) }
  }

  async function removeKeyword(kw: string) {
    try {
      await updateAccount.mutateAsync({ keywords: keywords.filter(k => k !== kw) } as any)
    } catch (e: any) { toast.error(e.message) }
  }

  async function addHandle() {
    const h = newHandle.trim()
    if (!h) return
    const exists = watchlist.some(w => w.handle.toLowerCase() === h.toLowerCase())
    if (exists) { toast.error('Handle already in watchlist'); return }
    const newEntry: WatchlistHandle = {
      id: `wl-${Date.now()}`,
      handle: h.startsWith('@') ? h : `@${h}`,
      display_name: newHandleName.trim() || undefined,
      platform: newHandlePlatform,
      category: newHandleCategory,
      is_active: true,
      added_at: new Date().toISOString(),
    }
    try {
      await updateAccount.mutateAsync({ watchlist_handles: [...watchlist, newEntry] } as any)
      setNewHandle('')
      setNewHandleName('')
      toast.success(`Watchlist: @${h.replace('@','')} added`)
    } catch (e: any) { toast.error(e.message) }
  }

  async function removeHandle(id: string) {
    try {
      await updateAccount.mutateAsync({ watchlist_handles: watchlist.filter(w => w.id !== id) } as any)
    } catch (e: any) { toast.error(e.message) }
  }

  async function toggleHandle(id: string, active: boolean) {
    try {
      await updateAccount.mutateAsync({ watchlist_handles: watchlist.map(w => w.id === id ? { ...w, is_active: active } : w) } as any)
    } catch (e: any) { toast.error(e.message) }
  }

  async function addFromWatchlistPreset(handle: string, category: 'journalist' | 'politician') {
    const h = handle.startsWith('@') ? handle : `@${handle}`
    if (watchlist.some(w => w.handle.toLowerCase() === h.toLowerCase())) return
    const newEntry: WatchlistHandle = {
      id: `wl-preset-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,
      handle: h, platform: 'twitter', category, is_active: true, added_at: new Date().toISOString()
    }
    await updateAccount.mutateAsync({ watchlist_handles: [...watchlist, newEntry] } as any)
  }

  async function fetchNationalDiscourse() {
    if (!account?.id) return
    setFetchingNational(true)
    try {
      const { getNationalKeywordsForCycle } = await import('@/lib/nationalDiscourse')
      const kws = getNationalKeywordsForCycle(Math.floor(Date.now() / 3_600_000))
      const res = await fetch(`${SUPABASE_URL}/functions/v1/bm-ingest-v2`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${ANON_KEY}`, 'apikey': ANON_KEY },
        body: JSON.stringify({ accountId: account.id, politicianName: account.politician_name, keywords: kws, nationalMode: true, maxPerSource: 15 }),
      })
      const data = await res.json()
      setLastNationalCount(data.inserted || 0)
      toast.success(`National discourse: ${data.inserted || 0} items fetched`)
    } catch (e: any) { toast.error(e.message) }
    setFetchingNational(false)
  }

  const tabs = [
    { id: 'keywords' as const, label: 'KEYWORDS', badge: keywords.length },
    { id: 'watchlist' as const, label: 'WATCHLIST', badge: watchlist.length },
    { id: 'national' as const, label: 'NATIONAL DISCOURSE', badge: Object.values(NATIONAL_DISCOURSE_KEYWORDS).flat().length },
    { id: 'sources' as const, label: 'DATA SOURCES' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: DARK, color: T0 }}>
      <NavBar />
      <div style={{ maxWidth: '1100px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Header */}
        <div style={{ marginBottom: '24px' }}>
          <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '2px', marginBottom: '6px' }}>TRACKING CONFIGURATION</div>
          <div style={{ fontSize: '20px', fontWeight: 600, color: T0 }}>
            {account?.politician_name || 'Account'} — Track & Monitor
          </div>
        </div>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: '4px', marginBottom: '20px', borderBottom: `1px solid ${BORDER}`, paddingBottom: '0' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{
              fontFamily: mono, fontSize: '9px', letterSpacing: '0.5px', padding: '8px 14px',
              border: 'none', background: 'transparent', cursor: 'pointer',
              color: activeTab === t.id ? ACC : T2,
              borderBottom: `2px solid ${activeTab === t.id ? ACC : 'transparent'}`,
              marginBottom: '-1px', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: '6px',
            }}>
              {t.label}
              {t.badge !== undefined && (
                <span style={{ fontFamily: mono, fontSize: '7px', padding: '1px 5px', borderRadius: '8px', background: activeTab === t.id ? `rgba(249,115,22,0.15)` : 'rgba(255,255,255,0.06)', color: activeTab === t.id ? ACC : T3 }}>
                  {t.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* ── KEYWORDS TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'keywords' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px' }}>
            <div>
              <Section title="TRACKED KEYWORDS" badge={keywords.length} accent={ACC}>
                {/* Add keyword */}
                <div style={{ display: 'flex', gap: '8px', marginBottom: '16px' }}>
                  <input
                    value={newKeyword} onChange={e => setNewKeyword(e.target.value)}
                    onKeyDown={e => e.key === 'Enter' && addKeyword()}
                    placeholder="Add keyword… e.g. Viksit Bharat"
                    style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '7px 10px', color: T0, fontFamily: mono, fontSize: '11px', outline: 'none' }}
                  />
                  <button onClick={addKeyword} style={{ padding: '7px 14px', background: `rgba(249,115,22,0.12)`, border: `1px solid rgba(249,115,22,0.3)`, borderRadius: '6px', color: ACC, fontFamily: mono, fontSize: '9px', cursor: 'pointer' }}>
                    + ADD
                  </button>
                </div>

                {/* Keyword list with stats */}
                {keywordStats.map(stat => (
                  <div key={stat.kw} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px' }}>
                        <span style={{ fontFamily: mono, fontSize: '10px', color: T0 }}>{stat.kw}</span>
                        {stat.crisis > 0 && <span style={{ fontFamily: mono, fontSize: '7px', color: RED, background: 'rgba(240,62,62,0.1)', padding: '1px 5px', borderRadius: '3px' }}>⚡{stat.crisis} crisis</span>}
                      </div>
                      <div style={{ display: 'flex', gap: '8px' }}>
                        <span style={{ fontFamily: mono, fontSize: '8px', color: T3 }}>{stat.count} items</span>
                        <span style={{ fontFamily: mono, fontSize: '8px', color: GREEN }}>+{stat.pos}</span>
                        <span style={{ fontFamily: mono, fontSize: '8px', color: RED }}>-{stat.neg}</span>
                      </div>
                    </div>
                    <div style={{ width: '60px', height: '3px', background: 'rgba(255,255,255,0.06)', borderRadius: '2px', overflow: 'hidden' }}>
                      <div style={{ width: `${Math.min((stat.count / Math.max(keywordStats[0]?.count || 1, 1)) * 100, 100)}%`, height: '100%', background: stat.crisis > 0 ? RED : stat.neg > stat.pos ? '#f5a623' : GREEN }} />
                    </div>
                    <button onClick={() => removeKeyword(stat.kw)} style={{ background: 'none', border: 'none', color: T3, cursor: 'pointer', fontSize: '14px', padding: '0 4px', lineHeight: 1 }}
                      onMouseEnter={e => { e.currentTarget.style.color = RED }}
                      onMouseLeave={e => { e.currentTarget.style.color = T3 }}>×</button>
                  </div>
                ))}
                {keywords.length === 0 && (
                  <div style={{ fontFamily: mono, fontSize: '9px', color: T3, padding: '16px', textAlign: 'center' }}>
                    No keywords tracked yet. Add your first keyword above.
                  </div>
                )}
              </Section>
            </div>

            {/* Right: tips */}
            <div>
              <Section title="KEYWORD TIPS" accent={BLUE}>
                <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 2 }}>
                  <div style={{ color: T1, marginBottom: '8px' }}>Good keywords to track:</div>
                  <div>• Your name (English + transliteration)</div>
                  <div>• Your constituency name</div>
                  <div>• Your party + state</div>
                  <div>• Key schemes you're associated with</div>
                  <div>• Main competitor names</div>
                  <div style={{ color: T1, marginTop: '12px', marginBottom: '8px' }}>Avoid:</div>
                  <div>• Too broad (e.g. "India") — too much noise</div>
                  <div>• Too narrow (single place name) — too little data</div>
                  <div style={{ color: T1, marginTop: '12px', marginBottom: '8px' }}>Suggested for this account:</div>
                  {(account?.constituency || account?.state) && (
                    <>
                      {[account.constituency, account.state, account.party].filter(Boolean).map(s => (
                        <button key={s} onClick={() => setNewKeyword(s!)} style={{ display: 'block', marginBottom: '4px', background: 'rgba(249,115,22,0.06)', border: `1px solid rgba(249,115,22,0.2)`, borderRadius: '5px', color: ACC, fontFamily: mono, fontSize: '8px', padding: '3px 8px', cursor: 'pointer' }}>
                          + {s}
                        </button>
                      ))}
                    </>
                  )}
                </div>
              </Section>
            </div>
          </div>
        )}

        {/* ── WATCHLIST TAB ─────────────────────────────────────────────────── */}
        {activeTab === 'watchlist' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px' }}>
            <div>
              <Section title="YOUR WATCHLIST" badge={`${watchlist.length} handles`} accent={BSKY}>
                {/* Add handle form */}
                <div style={{ background: 'rgba(255,255,255,0.03)', border: `1px solid ${BORDER}`, borderRadius: '8px', padding: '12px', marginBottom: '16px' }}>
                  <div style={{ fontFamily: mono, fontSize: '8px', color: T3, letterSpacing: '1px', marginBottom: '10px' }}>ADD HANDLE TO WATCHLIST</div>
                  <div style={{ display: 'flex', gap: '8px', marginBottom: '8px' }}>
                    <input value={newHandle} onChange={e => setNewHandle(e.target.value)} placeholder="@handle or name.bsky.social"
                      onKeyDown={e => e.key === 'Enter' && addHandle()}
                      style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '6px 10px', color: T0, fontFamily: mono, fontSize: '10px', outline: 'none' }} />
                    <input value={newHandleName} onChange={e => setNewHandleName(e.target.value)} placeholder="Display name (optional)"
                      style={{ flex: 1, background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '6px', padding: '6px 10px', color: T0, fontFamily: mono, fontSize: '10px', outline: 'none' }} />
                  </div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <select value={newHandlePlatform} onChange={e => setNewHandlePlatform(e.target.value as any)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '5px', color: T1, fontFamily: mono, fontSize: '9px', padding: '5px 8px' }}>
                      <option value="twitter">X / Twitter</option>
                      <option value="bluesky">Bluesky</option>
                      <option value="all">All platforms</option>
                    </select>
                    <select value={newHandleCategory} onChange={e => setNewHandleCategory(e.target.value as any)}
                      style={{ background: 'rgba(255,255,255,0.05)', border: `1px solid ${BORDER}`, borderRadius: '5px', color: T1, fontFamily: mono, fontSize: '9px', padding: '5px 8px' }}>
                      <option value="journalist">Journalist</option>
                      <option value="politician">Politician</option>
                      <option value="commentator">Commentator</option>
                      <option value="influencer">Influencer</option>
                      <option value="custom">Custom</option>
                    </select>
                    <button onClick={addHandle} style={{ padding: '6px 14px', background: `rgba(0,133,255,0.12)`, border: `1px solid rgba(0,133,255,0.3)`, borderRadius: '6px', color: BSKY, fontFamily: mono, fontSize: '9px', cursor: 'pointer', marginLeft: 'auto' }}>
                      + ADD
                    </button>
                  </div>
                  <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginTop: '8px', lineHeight: 1.7 }}>
                    Added handles are auto-tracked on every search cycle via X/Bluesky. Content appears in your feed tagged with their handle.
                  </div>
                </div>

                {/* Current watchlist */}
                {handleStats.length === 0 ? (
                  <div style={{ fontFamily: mono, fontSize: '9px', color: T3, textAlign: 'center', padding: '20px' }}>No handles in watchlist yet. Add journalists, politicians, or commentators above.</div>
                ) : handleStats.map(wh => (
                  <div key={wh.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: `1px solid rgba(255,255,255,0.04)` }}>
                    <div style={{ width: '28px', height: '28px', borderRadius: '50%', background: `${CATEGORY_COLORS[wh.category] || '#8892a4'}15`, border: `1px solid ${CATEGORY_COLORS[wh.category] || '#8892a4'}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: mono, fontSize: '9px', color: CATEGORY_COLORS[wh.category] || '#8892a4', flexShrink: 0 }}>
                      {wh.handle.replace('@','').slice(0,2).toUpperCase()}
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: mono, fontSize: '10px', color: T0 }}>{wh.handle}</span>
                        <span style={{ fontFamily: mono, fontSize: '7px', color: PLATFORM_COLORS[wh.platform] || T3, background: `${PLATFORM_COLORS[wh.platform] || T3}12`, padding: '1px 5px', borderRadius: '3px' }}>{wh.platform}</span>
                        <span style={{ fontFamily: mono, fontSize: '7px', color: CATEGORY_COLORS[wh.category] || T3 }}>{wh.category}</span>
                      </div>
                      {wh.display_name && <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginTop: '1px' }}>{wh.display_name}</div>}
                      <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginTop: '1px' }}>{wh.count} items tracked</div>
                    </div>
                    {/* Active toggle */}
                    <button onClick={() => toggleHandle(wh.id, !wh.is_active)} style={{ fontFamily: mono, fontSize: '7px', padding: '2px 7px', border: `1px solid ${wh.is_active ? 'rgba(34,211,160,0.3)' : 'rgba(255,255,255,0.12)'}`, borderRadius: '10px', background: wh.is_active ? 'rgba(34,211,160,0.08)' : 'transparent', color: wh.is_active ? GREEN : T3, cursor: 'pointer' }}>
                      {wh.is_active ? 'ACTIVE' : 'PAUSED'}
                    </button>
                    <button onClick={() => removeHandle(wh.id)} style={{ background: 'none', border: 'none', color: T3, cursor: 'pointer', fontSize: '14px', padding: '0 4px' }}
                      onMouseEnter={e => { e.currentTarget.style.color = RED }}
                      onMouseLeave={e => { e.currentTarget.style.color = T3 }}>×</button>
                  </div>
                ))}
              </Section>
            </div>

            {/* Right: preset suggestions */}
            <div>
              <Section title="ADD FROM PRESET LIST" accent={BLUE}>
                <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginBottom: '10px' }}>Click + to add to your watchlist</div>
                
                <div style={{ fontFamily: mono, fontSize: '8px', color: T2, letterSpacing: '1px', marginBottom: '6px' }}>TOP JOURNALISTS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '12px', maxHeight: '160px', overflowY: 'auto' }}>
                  {POLITICAL_WATCHLIST.journalists.slice(0, 15).map(h => {
                    const alreadyAdded = watchlist.some(w => w.handle.toLowerCase() === h.toLowerCase())
                    return (
                      <div key={h} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: mono, fontSize: '9px', color: alreadyAdded ? T3 : BLUE, flex: 1 }}>{h}</span>
                        <button onClick={() => !alreadyAdded && addFromWatchlistPreset(h, 'journalist')}
                          disabled={alreadyAdded}
                          style={{ fontFamily: mono, fontSize: '8px', padding: '2px 7px', border: `1px solid ${alreadyAdded ? 'rgba(255,255,255,0.08)' : 'rgba(61,142,240,0.3)'}`, borderRadius: '3px', background: alreadyAdded ? 'transparent' : 'rgba(61,142,240,0.06)', color: alreadyAdded ? T3 : BLUE, cursor: alreadyAdded ? 'default' : 'pointer' }}>
                          {alreadyAdded ? '✓' : '+'}
                        </button>
                      </div>
                    )
                  })}
                </div>

                <div style={{ fontFamily: mono, fontSize: '8px', color: T2, letterSpacing: '1px', marginBottom: '6px' }}>POLITICAL ACCOUNTS</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', maxHeight: '160px', overflowY: 'auto' }}>
                  {POLITICAL_WATCHLIST.politicians_tracked.slice(0, 15).map(h => {
                    const alreadyAdded = watchlist.some(w => w.handle.toLowerCase() === h.toLowerCase())
                    return (
                      <div key={h} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span style={{ fontFamily: mono, fontSize: '9px', color: alreadyAdded ? T3 : ACC, flex: 1 }}>{h}</span>
                        <button onClick={() => !alreadyAdded && addFromWatchlistPreset(h, 'politician')}
                          disabled={alreadyAdded}
                          style={{ fontFamily: mono, fontSize: '8px', padding: '2px 7px', border: `1px solid ${alreadyAdded ? 'rgba(255,255,255,0.08)' : 'rgba(249,115,22,0.3)'}`, borderRadius: '3px', background: alreadyAdded ? 'transparent' : 'rgba(249,115,22,0.06)', color: alreadyAdded ? T3 : ACC, cursor: alreadyAdded ? 'default' : 'pointer' }}>
                          {alreadyAdded ? '✓' : '+'}
                        </button>
                      </div>
                    )
                  })}
                </div>
              </Section>
            </div>
          </div>
        )}

        {/* ── NATIONAL DISCOURSE TAB ────────────────────────────────────────── */}
        {activeTab === 'national' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 320px', gap: '16px' }}>
            <div>
              <Section title="NATIONAL DISCOURSE KEYWORDS" badge={Object.values(NATIONAL_DISCOURSE_KEYWORDS).flat().length} accent="#7c6dfa">
                <div style={{ fontFamily: mono, fontSize: '9px', color: T3, lineHeight: 1.8, marginBottom: '16px' }}>
                  Broad political narrative tracking. Uses {Object.values(NATIONAL_DISCOURSE_KEYWORDS).flat().length} keywords across {Object.keys(NATIONAL_DISCOURSE_KEYWORDS).length} categories + 150 journalist accounts. Runs separately from your account keywords.
                </div>
                <button onClick={fetchNationalDiscourse} disabled={fetchingNational}
                  style={{ padding: '9px 20px', background: fetchingNational ? 'rgba(255,255,255,0.05)' : 'rgba(124,109,250,0.1)', border: `1px solid rgba(124,109,250,0.3)`, borderRadius: '7px', color: '#a89ef8', fontFamily: mono, fontSize: '9px', cursor: fetchingNational ? 'not-allowed' : 'pointer', letterSpacing: '0.5px', marginBottom: '16px', display: 'flex', alignItems: 'center', gap: '6px' }}>
                  {fetchingNational ? '⚙ FETCHING…' : '↺ FETCH NATIONAL DISCOURSE NOW'}
                </button>
                {lastNationalCount > 0 && (
                  <div style={{ fontFamily: mono, fontSize: '8px', color: GREEN, marginBottom: '14px' }}>✓ Last fetch: {lastNationalCount} items</div>
                )}
                {Object.entries(NATIONAL_DISCOURSE_KEYWORDS).map(([category, kws]) => (
                  <div key={category} style={{ marginBottom: '12px' }}>
                    <div style={{ fontFamily: mono, fontSize: '8px', color: '#7c6dfa', letterSpacing: '1px', marginBottom: '6px', textTransform: 'uppercase' }}>{category}</div>
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                      {kws.map(kw => (
                        <span key={kw} style={{ fontFamily: mono, fontSize: '8px', padding: '2px 8px', background: 'rgba(124,109,250,0.07)', border: '1px solid rgba(124,109,250,0.15)', borderRadius: '10px', color: T2 }}>{kw}</span>
                      ))}
                    </div>
                  </div>
                ))}
              </Section>
            </div>

            <div>
              <Section title="JOURNALIST WATCHLIST" badge="150 accounts" accent={BLUE}>
                <div style={{ fontFamily: mono, fontSize: '8px', color: T3, marginBottom: '10px', lineHeight: 1.8 }}>
                  These accounts are tracked on X and Bluesky. Their posts about national politics appear in your feed tagged as national discourse.
                </div>
                <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
                  <div style={{ fontFamily: mono, fontSize: '8px', color: BLUE, letterSpacing: '1px', marginBottom: '6px' }}>JOURNALISTS & COMMENTATORS</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginBottom: '12px' }}>
                    {POLITICAL_WATCHLIST.journalists.map(h => (
                      <span key={h} style={{ fontFamily: mono, fontSize: '8px', padding: '2px 7px', background: 'rgba(29,155,240,0.07)', border: '1px solid rgba(29,155,240,0.15)', borderRadius: '10px', color: BLUE }}>{h}</span>
                    ))}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: '8px', color: ACC, letterSpacing: '1px', marginBottom: '6px' }}>POLITICAL ACCOUNTS</div>
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                    {POLITICAL_WATCHLIST.politicians_tracked.map(h => (
                      <span key={h} style={{ fontFamily: mono, fontSize: '8px', padding: '2px 7px', background: 'rgba(249,115,22,0.07)', border: '1px solid rgba(249,115,22,0.15)', borderRadius: '10px', color: ACC }}>{h}</span>
                    ))}
                  </div>
                </div>
              </Section>
            </div>
          </div>
        )}

        {/* ── DATA SOURCES TAB ──────────────────────────────────────────────── */}
        {activeTab === 'sources' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {[
              { name: 'Google News RSS', status: 'active', quota: 'Unlimited', cost: 'Free', detail: 'EN + HI feeds for all keywords. Server-side, no CORS.', color: GREEN },
              { name: 'GDELT Project', status: 'active', quota: 'Unlimited', cost: 'Free', detail: 'Indexes all Indian media + Twitter/X URLs. No API key needed.', color: GREEN },
              { name: 'Indian RSS Feeds', status: 'active', quota: 'Unlimited', cost: 'Free', detail: 'NDTV, TOI, The Hindu, IE, PIB, ANI, Aaj Tak, HT.', color: GREEN },
              { name: 'Bluesky (New)', status: 'active', quota: 'Unlimited', cost: 'Free', detail: 'Open API, no key. Many journalists migrated here post-X changes.', color: BSKY },
              { name: 'Reddit', status: 'active', quota: 'Rate limited', cost: 'Free', detail: 'r/india, r/IndianPolitics, r/IndiaSpeaks, r/worldnews.', color: '#ff4500' },
              { name: 'NewsData.io', status: 'active', quota: '200/day', cost: 'Free tier', detail: '200 Indian news sources, EN + HI. Key in Supabase Vault.', color: GREEN },
              { name: 'YouTube Data API', status: 'active', quota: '100 searches/day', cost: 'Free', detail: 'Combined search, 6h cache. Key in Supabase Vault + Vercel.', color: '#ff2020' },
              { name: 'X / Twitter (XPOZ)', status: 'check', quota: 'Per plan', cost: 'Paid', detail: 'VITE_XPOZ_API_KEY must be in Vercel env vars. Check Vercel → Settings → Env Vars.', color: '#f5a623' },
              { name: 'Google CSE (x.com)', status: 'limited', quota: '100/day', cost: 'Free', detail: 'CSE search restricted to x.com. Quota shared with News CSE.', color: '#f5a623' },
              { name: 'Meta Ad Library', status: 'active', quota: 'Rate limited', cost: 'Free', detail: 'Political ad tracking. VITE_META_ACCESS_TOKEN required.', color: '#1877f2' },
              { name: 'GNews.io', status: 'available', quota: '100/day', cost: 'Free', detail: 'Sign up at gnews.io → add GNEWS_API_KEY to Supabase Vault.', color: T3 },
              { name: 'Currents API', status: 'available', quota: '600/day', cost: 'Free', detail: 'currentsapi.services → add CURRENTS_API_KEY to Vault.', color: T3 },
            ].map(src => (
              <div key={src.name} style={{ background: CARD, border: `1px solid ${BORDER}`, borderLeft: `3px solid ${src.color}`, borderRadius: '8px', padding: '12px 14px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: src.status === 'active' ? GREEN : src.status === 'check' ? '#f5a623' : src.status === 'limited' ? '#f5a623' : T3, flexShrink: 0 }} />
                  <span style={{ fontFamily: mono, fontSize: '10px', color: T0, fontWeight: 500, flex: 1 }}>{src.name}</span>
                  <span style={{ fontFamily: mono, fontSize: '7px', padding: '1px 6px', borderRadius: '3px', background: src.status === 'active' ? 'rgba(34,211,160,0.1)' : src.status === 'available' ? 'rgba(255,255,255,0.06)' : 'rgba(245,166,35,0.1)', color: src.status === 'active' ? GREEN : src.status === 'available' ? T3 : '#f5a623' }}>
                    {src.status.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontFamily: mono, fontSize: '8px', color: T3, lineHeight: 1.7 }}>
                  <span style={{ color: GREEN }}>{src.quota}</span> · {src.cost}<br />
                  {src.detail}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
