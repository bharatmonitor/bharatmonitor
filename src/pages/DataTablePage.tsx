import { useState, useMemo, useCallback, useRef, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useAuthStore } from '@/store'
import { useAccount, useGoogleXSearch } from '@/hooks/useData'
import { parseNitterQuery, describeParams } from '@/lib/universalSearch'
import { buildGoogleXSearchUrl } from '@/lib/googleSearchX'
import NavBar from '@/components/layout/NavBar'
import type { FeedItem, Platform, BucketColor, Sentiment } from '@/types'

// ─── Fetch ALL data (both tables, high limit) ────────────────────────────────

function useAllFeedData(accountId: string) {
  return useQuery({
    queryKey: ['all-feed-data', accountId],
    queryFn: async (): Promise<FeedItem[]> => {
      if (!accountId) return []
      const PAGE = 1000
      const [r1, r2] = await Promise.all([
        supabase.from('bm_feed').select('*').eq('account_id', accountId)
          .order('published_at', { ascending: false }).limit(PAGE),
        supabase.from('feed_items').select('*').eq('account_id', accountId)
          .order('published_at', { ascending: false }).limit(PAGE),
      ])
      const now = new Date().toISOString()
      const normalize = (rows: any[], src: 'bm' | 'fi'): FeedItem[] =>
        (rows || []).map((i: any) => ({
          id:           i.id,
          account_id:   i.account_id,
          headline:     i.title || i.headline || '',
          body:         i.body || i.summary || '',
          source:       i.source_name || i.source || '',
          published_at: i.published_at || now,
          fetched_at:   i.fetched_at  || i.created_at || now,
          language:     i.language || 'english',
          bucket:       (i.bucket || (src === 'bm' ? 'silver' : 'blue')) as BucketColor,
          platform:     (i.source_type || i.platform || 'news') as Platform,
          url:          i.url || '',
          sentiment:    (i.sentiment || (i.tone > 0 ? 'positive' : i.tone < 0 ? 'negative' : 'neutral')) as Sentiment,
          tone:         i.tone || 0,
          keyword:      i.keyword || '',
          geo_tags:     i.geo_tags    || [],
          topic_tags:   i.topic_tags  || [],
          views:        i.views,
          shares:       i.shares,
          engagement:   i.engagement,
          is_trending:  i.is_trending,
          contradiction: undefined,
        }))

      const all = [
        ...normalize(r1.data ?? [], 'bm'),
        ...normalize(r2.data ?? [], 'fi'),
      ]
      const seen = new Set<string>()
      return all
        .filter(i => { const k = i.url || i.id; if (seen.has(k)) return false; seen.add(k); return true })
        .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())
    },
    enabled: !!accountId,
    staleTime: 2 * 60_000,
    refetchInterval: 5 * 60_000,
  })
}

// ─── Platform + Bucket config ────────────────────────────────────────────────

const PLAT_COLOR: Record<string, string> = {
  twitter:'#1d9bf0', instagram:'#e1306c', facebook:'#1877f2',
  whatsapp:'#25d366', youtube:'#ff2020', news:'#8892a4', reddit:'#ff4500',
}
const BUCKET_COLOR: Record<string, string> = {
  red:'#f03e3e', yellow:'#f5a623', blue:'#3d8ef0', silver:'#8892a4',
}
const SENT_COLOR: Record<string, string> = {
  positive:'#22d3a0', negative:'#f03e3e', neutral:'#8892a4',
}
const PLATFORMS  = ['all','twitter','instagram','facebook','whatsapp','youtube','news','reddit'] as const
const BUCKETS    = ['all','red','yellow','blue','silver'] as const
const SENTIMENTS = ['all','positive','negative','neutral'] as const

type SortKey = 'published_at' | 'source' | 'platform' | 'bucket' | 'sentiment' | 'engagement' | 'keyword'

// ─── CSV export ───────────────────────────────────────────────────────────────

function toCSV(rows: FeedItem[]): string {
  const COLS: Array<{ label: string; get: (r: FeedItem & Record<string, any>) => string }> = [
    { label: 'ID',           get: r => r.id },
    { label: 'Platform',     get: r => r.platform },
    { label: 'Source',       get: r => r.source },
    { label: 'Headline',     get: r => r.headline },
    { label: 'Body',         get: r => (r.body || '').substring(0, 500) },
    { label: 'URL',          get: r => r.url || '' },
    { label: 'Bucket',       get: r => r.bucket },
    { label: 'Sentiment',    get: r => r.sentiment },
    { label: 'Tone',         get: r => String(r.tone ?? 0) },
    { label: 'Keyword',      get: r => r.keyword || '' },
    { label: 'Geo Tags',     get: r => (r.geo_tags || []).join('; ') },
    { label: 'Topic Tags',   get: r => (r.topic_tags || []).join('; ') },
    { label: 'Language',     get: r => r.language },
    { label: 'Views',        get: r => String(r.views ?? '') },
    { label: 'Shares',       get: r => String(r.shares ?? '') },
    { label: 'Engagement',   get: r => String(r.engagement ?? '') },
    { label: 'Is Trending',  get: r => r.is_trending ? 'Yes' : 'No' },
    { label: 'Published At', get: r => r.published_at },
    { label: 'Fetched At',   get: r => r.fetched_at },
  ]
  const esc = (s: string) => `"${s.replace(/"/g, '""')}"`
  const header = COLS.map(c => esc(c.label)).join(',')
  const lines  = rows.map(r => COLS.map(c => esc(c.get(r as any))).join(','))
  return [header, ...lines].join('\n')
}

function downloadCSV(content: string, filename: string) {
  const blob = new Blob(['\ufeff' + content], { type: 'text/csv;charset=utf-8;' })
  const url  = URL.createObjectURL(blob)
  const a    = document.createElement('a')
  a.href     = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

// ─── Styled HTML report (print to PDF) ───────────────────────────────────────

function generateHTMLReport(rows: FeedItem[], stats: {
  byPlatform: Record<string, number>
  bySentiment: Record<string, number>
  byBucket: Record<string, number>
  totalEngagement: number
}, accountName?: string) {
  const now = new Date()
  const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })
  const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
  const fmtNum = (n: number) => n > 1_000_000 ? `${(n/1_000_000).toFixed(1)}M` : n > 1000 ? `${(n/1000).toFixed(0)}K` : String(n)

  const topSources = Object.entries(
    rows.reduce((acc, r) => { acc[r.source] = (acc[r.source] || 0) + 1; return acc }, {} as Record<string, number>)
  ).sort(([,a],[,b]) => b - a).slice(0, 10)

  const topKeywords = Object.entries(
    rows.reduce((acc, r) => { if (r.keyword) acc[r.keyword] = (acc[r.keyword] || 0) + 1; return acc }, {} as Record<string, number>)
  ).sort(([,a],[,b]) => b - a).slice(0, 10)

  const crisisItems = rows.filter(r => r.bucket === 'red').slice(0, 5)
  const trendingItems = rows.filter(r => r.is_trending).slice(0, 5)

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>BharatMonitor Intelligence Report — ${dateStr}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;600;700&family=Inter:wght@400;500;600;700&display=swap');
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: 'Inter', sans-serif; background: #0a0e1a; color: #c4cde0; line-height: 1.6; }
  .page { max-width: 900px; margin: 0 auto; padding: 40px 32px; }
  .mono { font-family: 'IBM Plex Mono', monospace; }
  .header { display: flex; align-items: center; gap: 16px; margin-bottom: 32px; padding-bottom: 20px; border-bottom: 2px solid #f97316; }
  .header-logo { font-family: 'IBM Plex Mono', monospace; font-size: 18px; color: #edf0f8; letter-spacing: 2px; }
  .header-logo span { color: #f97316; }
  .header-meta { margin-left: auto; text-align: right; font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #8892a4; }
  .section-title { font-family: 'IBM Plex Mono', monospace; font-size: 10px; color: #f97316; letter-spacing: 2px; margin-bottom: 12px; text-transform: uppercase; }
  .kpi-grid { display: grid; grid-template-columns: repeat(5, 1fr); gap: 12px; margin-bottom: 28px; }
  .kpi { background: #111827; border: 1px solid #2a3350; border-radius: 8px; padding: 14px; }
  .kpi-value { font-family: 'IBM Plex Mono', monospace; font-size: 24px; font-weight: 700; line-height: 1; }
  .kpi-label { font-family: 'IBM Plex Mono', monospace; font-size: 8px; color: #8892a4; letter-spacing: 1px; margin-top: 6px; }
  .two-col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; margin-bottom: 28px; }
  .card { background: #111827; border: 1px solid #2a3350; border-radius: 10px; padding: 16px; }
  .list-item { display: flex; align-items: center; gap: 8px; padding: 6px 0; border-bottom: 1px solid #1e2640; }
  .list-item:last-child { border-bottom: none; }
  .badge { font-family: 'IBM Plex Mono', monospace; font-size: 8px; padding: 2px 6px; border-radius: 3px; }
  .bar { height: 6px; border-radius: 3px; background: #1e2640; overflow: hidden; flex: 1; }
  .bar-fill { height: 100%; border-radius: 3px; }
  table { width: 100%; border-collapse: collapse; font-size: 10px; }
  th { font-family: 'IBM Plex Mono', monospace; font-size: 8px; color: #8892a4; letter-spacing: 1px; text-align: left; padding: 8px 6px; border-bottom: 1px solid #2a3350; background: #111827; }
  td { padding: 8px 6px; border-bottom: 1px solid #1e2640; color: #c4cde0; }
  tr:hover td { background: rgba(124,109,250,0.04); }
  .crisis-item { background: rgba(240,62,62,0.06); border: 1px solid rgba(240,62,62,0.2); border-radius: 8px; padding: 10px 12px; margin-bottom: 8px; }
  .footer { margin-top: 40px; padding-top: 16px; border-top: 1px solid #2a3350; text-align: center; font-family: 'IBM Plex Mono', monospace; font-size: 8px; color: #555f75; }
  @media print {
    body { background: #fff; color: #333; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
    .page { padding: 20px; }
    .kpi, .card { border-color: #ddd; background: #f9f9f9; }
    .kpi-value { color: #111; }
    th { background: #f0f0f0; color: #333; }
    td { color: #333; }
    .header { border-bottom-color: #f97316; }
  }
</style>
</head>
<body>
<div class="page">
  <div class="header">
    <div>
      <div class="header-logo">BHARAT<span>MONITOR</span></div>
      <div class="mono" style="font-size:9px;color:#8892a4;margin-top:4px;">INTELLIGENCE REPORT</div>
    </div>
    <div class="header-meta">
      <div>${accountName ? `<strong style="color:#edf0f8">${accountName}</strong><br>` : ''}${dateStr} · ${timeStr} IST</div>
      <div style="margin-top:4px;color:#f97316;">CONFIDENTIAL</div>
    </div>
  </div>

  <div class="section-title">◉ Executive Summary</div>
  <div class="kpi-grid">
    <div class="kpi"><div class="kpi-value" style="color:#edf0f8">${fmtNum(rows.length)}</div><div class="kpi-label">TOTAL MENTIONS</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#22d3a0">${fmtNum(stats.totalEngagement)}</div><div class="kpi-label">TOTAL REACH</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#f03e3e">${stats.byBucket['red'] || 0}</div><div class="kpi-label">CRISIS ITEMS</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#22d3a0">${rows.length > 0 ? Math.round((stats.bySentiment['positive'] || 0) / rows.length * 100) : 0}%</div><div class="kpi-label">POSITIVE SENTIMENT</div></div>
    <div class="kpi"><div class="kpi-value" style="color:#f5a623">${Object.keys(stats.byPlatform).length}</div><div class="kpi-label">PLATFORMS</div></div>
  </div>

  <div class="two-col">
    <div class="card">
      <div class="section-title">Platform Distribution</div>
      ${Object.entries(stats.byPlatform).sort(([,a],[,b]) => b - a).map(([plat, cnt]) => {
        const maxCnt = Math.max(...Object.values(stats.byPlatform))
        const pct = maxCnt > 0 ? (cnt / maxCnt) * 100 : 0
        const colors: Record<string, string> = { twitter:'#1d9bf0', instagram:'#e1306c', facebook:'#1877f2', youtube:'#ff2020', news:'#8892a4', whatsapp:'#25d366', reddit:'#ff4500' }
        return `<div class="list-item">
          <span class="mono" style="font-size:9px;color:${colors[plat] || '#8892a4'};width:80px;">${plat.toUpperCase()}</span>
          <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${colors[plat] || '#8892a4'}"></div></div>
          <span class="mono" style="font-size:9px;width:40px;text-align:right;">${cnt}</span>
        </div>`
      }).join('')}
    </div>
    <div class="card">
      <div class="section-title">Sentiment Breakdown</div>
      ${[
        { label: 'POSITIVE', key: 'positive', color: '#22d3a0' },
        { label: 'NEGATIVE', key: 'negative', color: '#f03e3e' },
        { label: 'NEUTRAL', key: 'neutral', color: '#8892a4' },
      ].map(s => {
        const cnt = stats.bySentiment[s.key] || 0
        const pct = rows.length > 0 ? (cnt / rows.length) * 100 : 0
        return `<div class="list-item">
          <span class="mono" style="font-size:9px;color:${s.color};width:80px;">${s.label}</span>
          <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${s.color}"></div></div>
          <span class="mono" style="font-size:9px;width:60px;text-align:right;">${cnt} (${Math.round(pct)}%)</span>
        </div>`
      }).join('')}
      <div style="margin-top:12px;">
        <div class="section-title" style="margin-bottom:8px;">Bucket Distribution</div>
        ${[
          { label: 'CRISIS', key: 'red', color: '#f03e3e' },
          { label: 'DEVELOPING', key: 'yellow', color: '#f5a623' },
          { label: 'BACKGROUND', key: 'blue', color: '#3d8ef0' },
          { label: 'INTEL', key: 'silver', color: '#8892a4' },
        ].map(b => {
          const cnt = stats.byBucket[b.key] || 0
          const pct = rows.length > 0 ? (cnt / rows.length) * 100 : 0
          return `<div class="list-item">
            <span class="mono" style="font-size:9px;color:${b.color};width:80px;">${b.label}</span>
            <div class="bar"><div class="bar-fill" style="width:${pct}%;background:${b.color}"></div></div>
            <span class="mono" style="font-size:9px;width:50px;text-align:right;">${cnt}</span>
          </div>`
        }).join('')}
      </div>
    </div>
  </div>

  ${crisisItems.length > 0 ? `
  <div class="section-title" style="color:#f03e3e;">⚠ Crisis Items (Top ${crisisItems.length})</div>
  <div style="margin-bottom:28px;">
    ${crisisItems.map(item => `
      <div class="crisis-item">
        <div style="display:flex;align-items:center;gap:8px;margin-bottom:4px;">
          <span class="badge" style="background:rgba(240,62,62,0.15);color:#f03e3e;">CRISIS</span>
          <span class="mono" style="font-size:8px;color:#8892a4;">${item.platform.toUpperCase()} · ${item.source}</span>
          <span class="mono" style="font-size:8px;color:#555f75;margin-left:auto;">${new Date(item.published_at).toLocaleDateString('en-IN')}</span>
        </div>
        <div style="font-size:12px;color:#edf0f8;font-weight:500;">${item.headline}</div>
      </div>
    `).join('')}
  </div>` : ''}

  <div class="two-col">
    <div class="card">
      <div class="section-title">Top Sources</div>
      ${topSources.map(([src, cnt], i) => `
        <div class="list-item">
          <span class="mono" style="font-size:8px;color:#555f75;width:16px;">#${i+1}</span>
          <span style="font-size:10px;flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${src}</span>
          <span class="mono" style="font-size:9px;color:#7c6dfa;">${cnt}</span>
        </div>
      `).join('')}
    </div>
    <div class="card">
      <div class="section-title">Top Keywords</div>
      ${topKeywords.length > 0 ? topKeywords.map(([kw, cnt], i) => `
        <div class="list-item">
          <span class="mono" style="font-size:8px;color:#555f75;width:16px;">#${i+1}</span>
          <span style="font-size:10px;flex:1;">${kw}</span>
          <span class="mono" style="font-size:9px;color:#f97316;">${cnt}</span>
        </div>
      `).join('') : '<div class="mono" style="font-size:9px;color:#555f75;padding:10px;text-align:center;">No keyword data</div>'}
    </div>
  </div>

  <div class="section-title" style="margin-top:28px;">◈ Recent Feed Items (Top 50)</div>
  <div class="card" style="overflow-x:auto;">
    <table>
      <thead>
        <tr><th>#</th><th>PLATFORM</th><th>BUCKET</th><th>SENTIMENT</th><th>HEADLINE</th><th>SOURCE</th><th>DATE</th></tr>
      </thead>
      <tbody>
        ${rows.slice(0, 50).map((r, i) => {
          const bColor: Record<string, string> = { red:'#f03e3e', yellow:'#f5a623', blue:'#3d8ef0', silver:'#8892a4' }
          const sColor: Record<string, string> = { positive:'#22d3a0', negative:'#f03e3e', neutral:'#8892a4' }
          return `<tr>
            <td class="mono" style="font-size:8px;color:#555f75;">${i+1}</td>
            <td class="mono" style="font-size:8px;">${r.platform.toUpperCase()}</td>
            <td><span class="badge" style="background:${(bColor[r.bucket]||'#888')}18;color:${bColor[r.bucket]||'#888'};">${r.bucket.toUpperCase()}</span></td>
            <td><span class="badge" style="background:${(sColor[r.sentiment]||'#888')}18;color:${sColor[r.sentiment]||'#888'};">${r.sentiment.toUpperCase()}</span></td>
            <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${r.headline}</td>
            <td class="mono" style="font-size:8px;color:#8892a4;">${r.source.substring(0,20)}</td>
            <td class="mono" style="font-size:8px;color:#555f75;">${new Date(r.published_at).toLocaleDateString('en-IN')}</td>
          </tr>`
        }).join('')}
      </tbody>
    </table>
  </div>

  <div class="footer">
    BHARAT<span style="color:#f97316">MONITOR</span> · INTELLIGENCE REPORT · GENERATED ${dateStr} ${timeStr} IST · CONFIDENTIAL<br>
    <span style="margin-top:4px;display:inline-block;">© ${now.getFullYear()} BharatMonitor · Political Intelligence Platform</span>
  </div>
</div>
</body>
</html>`

  const blob = new Blob([html], { type: 'text/html;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  window.open(url, '_blank')
}

// ─── Main page ────────────────────────────────────────────────────────────────

const PAGE_SIZE = 50

export default function DataTablePage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { data: account } = useAccount()
  const accountId = account?.id ?? ''

  const { data: allData = [], isLoading } = useAllFeedData(accountId)

  // ── Nitter-syntax search bar ──────────────────────────────────────────────
  const [rawSearch, setRawSearch] = useState('')
  const parsedParams = useMemo(() => rawSearch ? parseNitterQuery(rawSearch) : null, [rawSearch])

  // ── Debounced query for Google X live search ──────────────────────────────
  const [debouncedQuery, setDebouncedQuery] = useState('')
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      // Extract plain query text for Google (strip Nitter operators)
      const plain = rawSearch.replace(/(?:from:|lang:|since:|until:|min_faves:|min_retweets:|near:|filter:|#|-filter:)\S+/g, '').trim()
      setDebouncedQuery(plain)
    }, 600)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [rawSearch])

  const [showGoogleX, setShowGoogleX] = useState(true)
  const { data: googleXResults = [], isFetching: gxFetching } = useGoogleXSearch(
    accountId, debouncedQuery, showGoogleX && debouncedQuery.length > 2
  )

  // ── Quick filters ─────────────────────────────────────────────────────────
  const [platform,  setPlatform]  = useState<typeof PLATFORMS[number]>('all')
  const [bucket,    setBucket]    = useState<typeof BUCKETS[number]>('all')
  const [sentiment, setSentiment] = useState<typeof SENTIMENTS[number]>('all')
  const [since, setSince] = useState('')
  const [until, setUntil] = useState('')

  // ── Sort ──────────────────────────────────────────────────────────────────
  const [sortKey,  setSortKey]  = useState<SortKey>('published_at')
  const [sortAsc,  setSortAsc]  = useState(false)

  // ── Pagination ────────────────────────────────────────────────────────────
  const [page, setPage] = useState(1)

  // ── Filter + sort ─────────────────────────────────────────────────────────
  const filtered = useMemo(() => {
    let rows = allData

    // Universal search (Nitter query parser)
    if (parsedParams) {
      const { query, exactPhrase, hashtags, from, since: pSince, until: pUntil,
              language, minLikes, excludeRetweets, platforms: platFilter } = parsedParams
      if (query)       rows = rows.filter(r => r.headline.toLowerCase().includes(query.toLowerCase()) || (r.body ?? '').toLowerCase().includes(query.toLowerCase()))
      if (exactPhrase) rows = rows.filter(r => r.headline.includes(exactPhrase) || (r.body ?? '').includes(exactPhrase))
      if (hashtags?.length) rows = rows.filter(r => hashtags.some(h => r.headline.toLowerCase().includes(h.toLowerCase()) || (r.topic_tags ?? []).includes(h)))
      if (from?.length) rows = rows.filter(r => from.some(f => r.source.toLowerCase().includes(f.toLowerCase())))
      if (pSince) rows = rows.filter(r => new Date(r.published_at) >= new Date(pSince))
      if (pUntil) rows = rows.filter(r => new Date(r.published_at) <= new Date(pUntil + 'T23:59:59Z'))
      if (language) rows = rows.filter(r => r.language.toLowerCase().startsWith(language.toLowerCase()))
      if (minLikes) rows = rows.filter(r => (r.engagement ?? 0) >= minLikes)
      if (excludeRetweets) rows = rows.filter(r => !(r.headline.startsWith('RT @')))
      if (platFilter?.length) rows = rows.filter(r => platFilter.includes(r.platform as any))
    }

    // Quick filters
    if (platform  !== 'all') rows = rows.filter(r => r.platform  === platform)
    if (bucket    !== 'all') rows = rows.filter(r => r.bucket    === bucket)
    if (sentiment !== 'all') rows = rows.filter(r => r.sentiment === sentiment)
    if (since) rows = rows.filter(r => new Date(r.published_at) >= new Date(since))
    if (until) rows = rows.filter(r => new Date(r.published_at) <= new Date(until + 'T23:59:59Z'))

    // Sort
    rows = [...rows].sort((a, b) => {
      let av: any, bv: any
      if (sortKey === 'published_at') { av = new Date(a.published_at).getTime(); bv = new Date(b.published_at).getTime() }
      else if (sortKey === 'engagement') { av = a.engagement ?? 0; bv = b.engagement ?? 0 }
      else { av = (a as any)[sortKey] ?? ''; bv = (b as any)[sortKey] ?? '' }
      if (av < bv) return sortAsc ? -1 : 1
      if (av > bv) return sortAsc ?  1 : -1
      return 0
    })

    return rows
  }, [allData, parsedParams, platform, bucket, sentiment, since, until, sortKey, sortAsc])

  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)
  const pageRows   = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE)

  // ── Stats ────────────────────────────────────────────────────────────────
  const stats = useMemo(() => {
    const byPlatform = filtered.reduce((acc, r) => { acc[r.platform] = (acc[r.platform] || 0) + 1; return acc }, {} as Record<string, number>)
    const bySentiment = filtered.reduce((acc, r) => { acc[r.sentiment] = (acc[r.sentiment] || 0) + 1; return acc }, {} as Record<string, number>)
    const byBucket = filtered.reduce((acc, r) => { acc[r.bucket] = (acc[r.bucket] || 0) + 1; return acc }, {} as Record<string, number>)
    const totalEngagement = filtered.reduce((s, r) => s + (r.engagement ?? 0), 0)
    return { byPlatform, bySentiment, byBucket, totalEngagement }
  }, [filtered])

  const handleSort = useCallback((key: SortKey) => {
    if (sortKey === key) setSortAsc(a => !a)
    else { setSortKey(key); setSortAsc(false) }
    setPage(1)
  }, [sortKey])

  const SortIcon = ({ k }: { k: SortKey }) =>
    sortKey === k ? <span style={{ color: 'var(--acc)' }}>{sortAsc ? ' ↑' : ' ↓'}</span> : <span style={{ color: 'var(--t3)' }}> ↕</span>

  const mono = 'IBM Plex Mono, monospace'

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top bar ───────────────────────────────────────────────────────── */}
      <NavBar />
      {/* ── Export controls bar ──────────────────────────────────────────── */}
      <div style={{ background: 'var(--s2)', borderBottom: '1px solid var(--b0)', padding: '6px 16px', display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)' }}>{filtered.length.toLocaleString()} rows</span>
        <button
          onClick={() => downloadCSV(toCSV(filtered), `bharatmonitor-${accountId}-${new Date().toISOString().slice(0,10)}.csv`)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(34,211,160,0.12)', border: '1px solid rgba(34,211,160,0.3)', color: '#22d3a0', padding: '5px 14px', borderRadius: '6px', fontFamily: mono, fontSize: '9px', cursor: 'pointer', letterSpacing: '0.5px' }}>
          ↓ EXPORT CSV ({filtered.length.toLocaleString()})
        </button>
        {filtered.length !== allData.length && (
          <button
            onClick={() => downloadCSV(toCSV(allData), `bharatmonitor-${accountId}-all-${new Date().toISOString().slice(0,10)}.csv`)}
            style={{ background: 'rgba(61,142,240,0.08)', border: '1px solid rgba(61,142,240,0.2)', color: '#3d8ef0', padding: '5px 12px', borderRadius: '6px', fontFamily: mono, fontSize: '8px', cursor: 'pointer' }}>
            ↓ ALL ({allData.length.toLocaleString()})
          </button>
        )}
        <button
          onClick={() => generateHTMLReport(filtered, stats, account?.politician_name)}
          style={{ display: 'flex', alignItems: 'center', gap: '5px', background: 'rgba(249,115,22,0.12)', border: '1px solid rgba(249,115,22,0.3)', color: '#f97316', padding: '5px 14px', borderRadius: '6px', fontFamily: mono, fontSize: '9px', cursor: 'pointer', letterSpacing: '0.5px', marginLeft: 'auto' }}>
          ◈ GENERATE REPORT
        </button>
      </div>

      <div style={{ flex: 1, overflow: 'auto', padding: '16px' }}>

        {/* ── Universal search (Nitter syntax) ───────────────────────────── */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '14px 16px', marginBottom: '12px' }}>
          <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--acc)', letterSpacing: '1px', marginBottom: '8px' }}>◈ UNIVERSAL SEARCH — NITTER SYNTAX</div>
          <input
            value={rawSearch}
            onChange={e => { setRawSearch(e.target.value); setPage(1) }}
            placeholder='from:narendramodi lang:hi since:2024-01-01 min_faves:100 -filter:retweets "development"'
            style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '7px', color: 'var(--t0)', fontFamily: mono, fontSize: '11px', padding: '9px 12px', outline: 'none', boxSizing: 'border-box' }}
            onFocus={e => { e.currentTarget.style.borderColor = 'rgba(124,109,250,0.4)' }}
            onBlur={e => { e.currentTarget.style.borderColor = 'var(--b1)' }}
          />
          {parsedParams && (
            <div style={{ marginTop: '6px', fontFamily: mono, fontSize: '8px', color: 'var(--t2)', display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
              <span style={{ color: 'var(--t3)' }}>PARSED:</span>
              {parsedParams.query && <Chip label={`"${parsedParams.query}"`} />}
              {parsedParams.from?.map(f => <Chip key={f} label={`from:${f}`} color="#1d9bf0" />)}
              {parsedParams.hashtags?.map(h => <Chip key={h} label={`#${h}`} color="#e1306c" />)}
              {parsedParams.language && <Chip label={`lang:${parsedParams.language}`} color="#22d3a0" />}
              {parsedParams.since && <Chip label={`since:${parsedParams.since}`} />}
              {parsedParams.until && <Chip label={`until:${parsedParams.until}`} />}
              {parsedParams.minLikes && <Chip label={`min_likes:${parsedParams.minLikes}`} />}
              {parsedParams.excludeRetweets && <Chip label="-retweets" color="#f5a623" />}
            </div>
          )}
          <div style={{ marginTop: '6px', fontFamily: mono, fontSize: '7px', color: 'var(--t3)', lineHeight: 1.7 }}>
            Operators: <code>from:</code> <code>@mention</code> <code>#hashtag</code> <code>lang:</code> <code>near:</code> <code>since:</code> <code>until:</code> <code>min_faves:</code> <code>min_retweets:</code> <code>-filter:retweets</code> <code>filter:media</code> <code>"exact phrase"</code>
          </div>

          {/* ── Google X search controls ───────────────────────────────── */}
          <div style={{ marginTop: '10px', display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              onClick={() => setShowGoogleX(v => !v)}
              style={{
                display: 'flex', alignItems: 'center', gap: '5px',
                background: showGoogleX ? 'rgba(29,155,240,0.1)' : 'transparent',
                border: `1px solid ${showGoogleX ? 'rgba(29,155,240,0.4)' : 'var(--b1)'}`,
                borderRadius: '5px', padding: '4px 10px', cursor: 'pointer',
                fontFamily: mono, fontSize: '8px',
                color: showGoogleX ? '#1d9bf0' : 'var(--t3)',
                transition: 'all .15s',
              }}>
              <span style={{ fontSize: '11px' }}>𝕏</span>
              LIVE X.COM VIA GOOGLE {showGoogleX ? '▲ ON' : '▽ OFF'}
            </button>
            {debouncedQuery.length > 2 && (
              <a
                href={buildGoogleXSearchUrl({ query: debouncedQuery, dateRange: 'month' })}
                target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)', textDecoration: 'none',
                  border: '1px solid var(--b1)', borderRadius: '5px', padding: '4px 10px' }}>
                ↗ Open in Google
              </a>
            )}
            {gxFetching && <span style={{ fontFamily: mono, fontSize: '8px', color: '#1d9bf0', animation: 'pulse 1s infinite' }}>● fetching X posts…</span>}
          </div>
        </div>

        {/* ── GOOGLE X LIVE RESULTS ──────────────────────────────────────── */}
        {showGoogleX && googleXResults.length > 0 && (
          <div style={{ background: 'var(--s1)', border: '1px solid rgba(29,155,240,0.25)', borderRadius: '10px', marginBottom: '12px', overflow: 'hidden' }}>

            {/* Panel header */}
            <div style={{ padding: '10px 16px', borderBottom: '1px solid rgba(29,155,240,0.15)', display: 'flex', alignItems: 'center', gap: '10px', background: 'rgba(29,155,240,0.04)' }}>
              <span style={{ fontSize: '16px' }}>𝕏</span>
              <div>
                <div style={{ fontFamily: mono, fontSize: '9px', color: '#1d9bf0', letterSpacing: '1px', fontWeight: 600 }}>
                  X.COM — LIVE RESULTS via Google Search
                </div>
                <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', marginTop: '2px' }}>
                  {googleXResults.length} posts indexed by Google · query: "{debouncedQuery}"
                </div>
              </div>
              <div style={{ marginLeft: 'auto', display: 'flex', gap: '6px' }}>
                <a href={buildGoogleXSearchUrl({ query: debouncedQuery, dateRange: 'month' })}
                  target="_blank" rel="noopener noreferrer"
                  style={{ fontFamily: mono, fontSize: '7px', color: '#1d9bf0', textDecoration: 'none',
                    border: '1px solid rgba(29,155,240,0.3)', borderRadius: '4px', padding: '3px 8px' }}>
                  ↗ ALL ON GOOGLE
                </a>
              </div>
            </div>

            {/* Tweet cards */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: '1px', background: 'var(--b0)' }}>
              {googleXResults.map(item => (
                <GoogleXCard key={item.id} item={item} />
              ))}
            </div>
          </div>
        )}

        {/* ── EMPTY state when Google X is on but no results yet ────────── */}
        {showGoogleX && debouncedQuery.length > 2 && googleXResults.length === 0 && !gxFetching && (
          <div style={{ background: 'var(--s1)', border: '1px solid rgba(29,155,240,0.15)', borderRadius: '10px', padding: '16px', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '18px', opacity: 0.4 }}>𝕏</span>
            <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>
              No Google-indexed X posts found for "{debouncedQuery}".
              {!import.meta.env.VITE_GOOGLE_CSE_KEY && (
                <> Live X search is not yet configured — contact your admin.</>
              )}
            </span>
            <a href={buildGoogleXSearchUrl({ query: debouncedQuery })}
              target="_blank" rel="noopener noreferrer"
              style={{ marginLeft: 'auto', fontFamily: mono, fontSize: '7px', color: '#1d9bf0', textDecoration: 'none',
                border: '1px solid rgba(29,155,240,0.3)', borderRadius: '4px', padding: '3px 8px', flexShrink: 0 }}>
              ↗ Search manually on Google
            </a>
          </div>
        )}

        {/* ── Quick filters ─────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: '8px', marginBottom: '12px' }}>
          <FilterSelect label="PLATFORM" value={platform} onChange={v => { setPlatform(v as any); setPage(1) }}
            options={PLATFORMS.map(p => ({ value: p, label: p === 'all' ? 'All Platforms' : p.toUpperCase(), count: p === 'all' ? allData.length : (stats.byPlatform[p] || 0) }))} />
          <FilterSelect label="BUCKET" value={bucket} onChange={v => { setBucket(v as any); setPage(1) }}
            options={BUCKETS.map(b => ({ value: b, label: b === 'all' ? 'All Buckets' : b.toUpperCase(), count: b === 'all' ? allData.length : (stats.byBucket[b] || 0), color: b !== 'all' ? BUCKET_COLOR[b] : undefined }))} />
          <FilterSelect label="SENTIMENT" value={sentiment} onChange={v => { setSentiment(v as any); setPage(1) }}
            options={SENTIMENTS.map(s => ({ value: s, label: s === 'all' ? 'All Sentiments' : s.charAt(0).toUpperCase()+s.slice(1), count: s === 'all' ? allData.length : (stats.bySentiment[s] || 0), color: s !== 'all' ? SENT_COLOR[s] : undefined }))} />
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '9px 12px' }}>
            <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '4px' }}>DATE RANGE</div>
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <input type="date" value={since} onChange={e => { setSince(e.target.value); setPage(1) }}
                style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '4px', color: 'var(--t1)', fontFamily: mono, fontSize: '9px', padding: '3px 6px' }} />
              <span style={{ color: 'var(--t3)', fontSize: '10px' }}>→</span>
              <input type="date" value={until} onChange={e => { setUntil(e.target.value); setPage(1) }}
                style={{ flex: 1, background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '4px', color: 'var(--t1)', fontFamily: mono, fontSize: '9px', padding: '3px 6px' }} />
            </div>
          </div>
        </div>

        {/* ── Stats row ─────────────────────────────────────────────────── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5,1fr)', gap: '8px', marginBottom: '12px' }}>
          {[
            { label: 'TOTAL ITEMS',  value: filtered.length.toLocaleString(), color: 'var(--t0)' },
            { label: 'CRISIS',       value: (stats.byBucket['red']    || 0).toLocaleString(), color: '#f03e3e' },
            { label: 'DEVELOPING',   value: (stats.byBucket['yellow'] || 0).toLocaleString(), color: '#f5a623' },
            { label: 'NEGATIVE',     value: (stats.bySentiment['negative'] || 0).toLocaleString(), color: '#f03e3e' },
            { label: 'TOTAL REACH',  value: stats.totalEngagement > 1_000_000 ? `${(stats.totalEngagement/1_000_000).toFixed(1)}M` : stats.totalEngagement > 1000 ? `${(stats.totalEngagement/1000).toFixed(0)}K` : stats.totalEngagement.toLocaleString(), color: '#22d3a0' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '10px 12px' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '4px' }}>{s.label}</div>
              <div style={{ fontFamily: mono, fontSize: '20px', fontWeight: 700, color: s.color, lineHeight: 1 }}>{s.value}</div>
            </div>
          ))}
        </div>

        {/* ── Platform breakdown mini-chart ──────────────────────────────── */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '12px 14px', marginBottom: '12px', display: 'flex', gap: '16px', overflowX: 'auto' }}>
          <span style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', alignSelf: 'center', flexShrink: 0 }}>BY PLATFORM</span>
          {Object.entries(stats.byPlatform).sort(([,a],[,b]) => b - a).map(([plat, cnt]) => (
            <div key={plat} style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
              <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: PLAT_COLOR[plat] || 'var(--sil)', flexShrink: 0 }} />
              <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t1)' }}>{plat.toUpperCase()}</span>
              <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--acc)', background: 'rgba(124,109,250,0.1)', padding: '1px 5px', borderRadius: '3px' }}>{cnt}</span>
            </div>
          ))}
        </div>

        {/* ── Data Table ────────────────────────────────────────────────── */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', overflow: 'hidden' }}>

          {/* Table header */}
          <div style={{ display: 'grid', gridTemplateColumns: '32px 90px 80px 90px 1fr 80px 80px 90px 90px', background: 'var(--s2)', borderBottom: '1px solid var(--b1)', padding: '0 12px' }}>
            {[
              { label: '#',          key: null },
              { label: 'PLATFORM',   key: 'platform' },
              { label: 'BUCKET',     key: 'bucket' },
              { label: 'SENTIMENT',  key: 'sentiment' },
              { label: 'HEADLINE',   key: null },
              { label: 'SOURCE',     key: 'source' },
              { label: 'KEYWORD',    key: 'keyword' },
              { label: 'REACH',      key: 'engagement' },
              { label: 'DATE',       key: 'published_at' },
            ].map(col => (
              <div key={col.label}
                onClick={() => col.key && handleSort(col.key as SortKey)}
                style={{ padding: '8px 4px', fontFamily: mono, fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', cursor: col.key ? 'pointer' : 'default', userSelect: 'none', display: 'flex', alignItems: 'center' }}>
                {col.label}
                {col.key && <SortIcon k={col.key as SortKey} />}
              </div>
            ))}
          </div>

          {/* Rows */}
          {isLoading ? (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: mono, fontSize: '9px', color: 'var(--t3)' }}>
              LOADING ALL DATA…
            </div>
          ) : pageRows.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', fontFamily: mono, fontSize: '9px', color: 'var(--t3)' }}>
              NO RESULTS — try adjusting your filters
            </div>
          ) : (
            pageRows.map((row, idx) => (
              <TableRow key={row.id} row={row} idx={(page - 1) * PAGE_SIZE + idx + 1} />
            ))
          )}

          {/* Pagination */}
          {totalPages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderTop: '1px solid var(--b1)', background: 'var(--s2)' }}>
              <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)' }}>
                Page {page} of {totalPages} · showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, filtered.length)} of {filtered.length.toLocaleString()}
              </span>
              <div style={{ display: 'flex', gap: '4px' }}>
                <PagBtn label="«" onClick={() => setPage(1)} disabled={page === 1} />
                <PagBtn label="‹" onClick={() => setPage(p => Math.max(1, p-1))} disabled={page === 1} />
                {Array.from({ length: Math.min(7, totalPages) }, (_, i) => {
                  const p = page <= 4 ? i+1 : page + i - 3
                  return p > 0 && p <= totalPages ? (
                    <PagBtn key={p} label={String(p)} onClick={() => setPage(p)} active={p === page} />
                  ) : null
                })}
                <PagBtn label="›" onClick={() => setPage(p => Math.min(totalPages, p+1))} disabled={page === totalPages} />
                <PagBtn label="»" onClick={() => setPage(totalPages)} disabled={page === totalPages} />
              </div>
            </div>
          )}
        </div>

      </div>

      <style>{`
        input[type="date"]::-webkit-calendar-picker-indicator { filter: invert(0.5); }
        code { background: var(--s3); padding: 1px 3px; border-radius: 2px; font-family: IBM Plex Mono,monospace; }
      `}</style>
    </div>
  )
}

// ─── Google X tweet card ─────────────────────────────────────────────────────

const SENT_BADGE: Record<string, { bg: string; fg: string; label: string }> = {
  positive: { bg: 'rgba(34,211,160,0.12)', fg: '#22d3a0', label: 'POS' },
  negative: { bg: 'rgba(240,62,62,0.12)',  fg: '#f03e3e', label: 'NEG' },
  neutral:  { bg: 'rgba(136,146,164,0.12)',fg: '#8892a4', label: 'NEU' },
}
const BUCKET_BADGE: Record<string, { bg: string; fg: string }> = {
  red:    { bg: 'rgba(240,62,62,0.12)',  fg: '#f03e3e' },
  yellow: { bg: 'rgba(245,166,35,0.12)', fg: '#f5a623' },
  blue:   { bg: 'rgba(61,142,240,0.12)', fg: '#3d8ef0' },
  silver: { bg: 'rgba(136,146,164,0.1)', fg: '#8892a4' },
}

function GoogleXCard({ item }: { item: FeedItem }) {
  const mono = 'IBM Plex Mono, monospace'
  const sent = SENT_BADGE[item.sentiment] ?? SENT_BADGE.neutral
  const buck = BUCKET_BADGE[item.bucket] ?? BUCKET_BADGE.silver

  const handle = item.source.startsWith('@') ? item.source : `@${item.source}`
  const tweetUrl = item.url || `https://x.com/search?q=${encodeURIComponent(item.headline)}`

  const date = new Date(item.published_at)
  const dateStr = isNaN(date.getTime()) ? '' :
    `${date.getDate()}/${date.getMonth()+1}/${date.getFullYear()}`

  return (
    <div style={{ background: 'var(--s1)', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

      {/* Row 1: Handle + date + badges */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
        {/* X avatar placeholder */}
        <div style={{
          width: '28px', height: '28px', borderRadius: '50%',
          background: 'linear-gradient(135deg, #1d9bf0, #0d47a1)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: mono, fontSize: '9px', color: '#fff', flexShrink: 0,
        }}>
          {handle.replace('@','').substring(0,2).toUpperCase()}
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '9px', color: '#1d9bf0', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {handle}
          </div>
          {dateStr && <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)' }}>{dateStr}</div>}
        </div>

        {/* Sentiment badge */}
        <span style={{ fontFamily: mono, fontSize: '6px', padding: '2px 5px', borderRadius: '3px',
          background: sent.bg, color: sent.fg, border: `1px solid ${sent.fg}30`, flexShrink: 0 }}>
          {sent.label}
        </span>
        {/* Bucket badge */}
        <span style={{ fontFamily: mono, fontSize: '6px', padding: '2px 5px', borderRadius: '3px',
          background: buck.bg, color: buck.fg, border: `1px solid ${buck.fg}30`, flexShrink: 0 }}>
          {item.bucket.toUpperCase()}
        </span>
      </div>

      {/* Row 2: Tweet text */}
      <div style={{ fontSize: '11px', color: 'var(--t0)', lineHeight: 1.5,
        display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
        {item.headline}
      </div>

      {/* Row 3: geo/topic tags */}
      {((item.geo_tags?.length ?? 0) > 0 || (item.topic_tags?.length ?? 0) > 0) && (
        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap' }}>
          {(item.geo_tags ?? []).slice(0,3).map(t => (
            <span key={t} style={{ fontFamily: mono, fontSize: '6px', padding: '1px 4px', borderRadius: '2px',
              background: 'rgba(124,109,250,0.1)', color: '#a89ef8' }}>{t}</span>
          ))}
          {(item.topic_tags ?? []).slice(0,3).map(t => (
            <span key={t} style={{ fontFamily: mono, fontSize: '6px', padding: '1px 4px', borderRadius: '2px',
              background: 'rgba(34,211,160,0.1)', color: 'var(--grn)' }}>{t}</span>
          ))}
        </div>
      )}

      {/* Row 4: action buttons */}
      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginTop: '2px' }}>
        <a href={tweetUrl} target="_blank" rel="noopener noreferrer"
          onClick={e => e.stopPropagation()}
          style={{ fontFamily: mono, fontSize: '7px', color: '#1d9bf0', textDecoration: 'none',
            border: '1px solid rgba(29,155,240,0.3)', borderRadius: '4px', padding: '3px 8px',
            display: 'flex', alignItems: 'center', gap: '3px' }}>
          <span style={{ fontSize: '9px' }}>𝕏</span> VIEW TWEET
        </a>
        <span style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)' }}>
          via Google Index
        </span>
        {item.keyword && (
          <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: '7px',
            color: 'var(--acc)', background: 'rgba(124,109,250,0.08)',
            padding: '1px 5px', borderRadius: '3px' }}>
            {item.keyword}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── Table row ───────────────────────────────────────────────────────────────

function TableRow({ row, idx }: { row: FeedItem & Record<string, any>; idx: number }) {
  const mono = 'IBM Plex Mono, monospace'
  const [expanded, setExpanded] = useState(false)

  const date = new Date(row.published_at)
  const dateStr = `${date.getDate().toString().padStart(2,'0')}/${(date.getMonth()+1).toString().padStart(2,'0')} ${date.getHours().toString().padStart(2,'0')}:${date.getMinutes().toString().padStart(2,'0')}`

  return (
    <>
      <div
        onClick={() => setExpanded(e => !e)}
        style={{ display: 'grid', gridTemplateColumns: '32px 90px 80px 90px 1fr 80px 80px 90px 90px', padding: '0 12px', borderBottom: '1px solid var(--b0)', cursor: 'pointer', transition: 'background .1s' }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

        <Cell>{idx}</Cell>
        <Cell>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: PLAT_COLOR[row.platform] || '#888', flexShrink: 0 }} />
            <span style={{ fontSize: '8px', color: PLAT_COLOR[row.platform] || 'var(--t2)', textTransform: 'uppercase' }}>{row.platform}</span>
          </div>
        </Cell>
        <Cell>
          <span style={{ fontFamily: mono, fontSize: '7px', padding: '2px 5px', borderRadius: '3px', background: BUCKET_COLOR[row.bucket] + '18', color: BUCKET_COLOR[row.bucket], border: `1px solid ${BUCKET_COLOR[row.bucket]}30` }}>{row.bucket.toUpperCase()}</span>
        </Cell>
        <Cell>
          <span style={{ fontFamily: mono, fontSize: '7px', padding: '2px 5px', borderRadius: '3px', background: SENT_COLOR[row.sentiment] + '18', color: SENT_COLOR[row.sentiment] }}>{row.sentiment.toUpperCase()}</span>
        </Cell>
        <Cell>
          <span style={{ fontSize: '11px', color: 'var(--t0)', lineHeight: 1.4, display: '-webkit-box', WebkitLineClamp: expanded ? 'unset' : 2, WebkitBoxOrient: 'vertical', overflow: expanded ? 'visible' : 'hidden' }}>
            {row.headline}
          </span>
        </Cell>
        <Cell><span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)' }}>{row.source.substring(0, 18)}</span></Cell>
        <Cell><span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--acc)' }}>{(row.keyword || '').substring(0, 14)}</span></Cell>
        <Cell>
          {(row.engagement ?? row.views) ? (
            <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t1)' }}>
              {((row.engagement ?? row.views ?? 0) / 1000 > 1 ? `${((row.engagement ?? row.views ?? 0)/1000).toFixed(0)}K` : row.engagement ?? row.views ?? '—')}
            </span>
          ) : <span style={{ color: 'var(--t3)', fontSize: '8px' }}>—</span>}
        </Cell>
        <Cell><span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t2)' }}>{dateStr}</span></Cell>
      </div>

      {/* Expanded row */}
      {expanded && (
        <div style={{ padding: '10px 12px 10px 52px', background: 'rgba(124,109,250,0.04)', borderBottom: '1px solid var(--b1)' }}>
          {row.body && (
            <div style={{ fontSize: '11px', color: 'var(--t1)', lineHeight: 1.6, marginBottom: '8px' }}>{row.body.substring(0, 600)}</div>
          )}
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            {row.url && (
              <a href={row.url} target="_blank" rel="noopener noreferrer"
                style={{ fontFamily: mono, fontSize: '8px', color: 'var(--acc)', textDecoration: 'none' }}
                onClick={e => e.stopPropagation()}>
                ↗ OPEN LINK
              </a>
            )}
            {(row.geo_tags ?? []).map((t: string) => (
              <span key={t} style={{ fontFamily: mono, fontSize: '7px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(124,109,250,0.1)', color: '#a89ef8', border: '1px solid rgba(124,109,250,0.2)' }}>{t}</span>
            ))}
            {(row.topic_tags ?? []).map((t: string) => (
              <span key={t} style={{ fontFamily: mono, fontSize: '7px', padding: '1px 5px', borderRadius: '3px', background: 'rgba(34,211,160,0.1)', color: 'var(--grn)', border: '1px solid rgba(34,211,160,0.2)' }}>{t}</span>
            ))}
            <span style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', marginLeft: 'auto' }}>{new Date(row.published_at).toLocaleString('en-IN')}</span>
          </div>
        </div>
      )}
    </>
  )
}

// ─── Small helpers ────────────────────────────────────────────────────────────

function Cell({ children }: { children: React.ReactNode }) {
  return <div style={{ padding: '8px 4px', display: 'flex', alignItems: 'flex-start', minHeight: '38px' }}>{children}</div>
}

function Chip({ label, color = 'var(--t2)' }: { label: string; color?: string }) {
  return (
    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', padding: '2px 6px', borderRadius: '3px', background: color + '18', color, border: `1px solid ${color}30` }}>
      {label}
    </span>
  )
}

function FilterSelect({ label, value, onChange, options }: {
  label: string
  value: string
  onChange: (v: string) => void
  options: { value: string; label: string; count?: number; color?: string }[]
}) {
  const mono = 'IBM Plex Mono, monospace'
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '9px 12px' }}>
      <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '4px' }}>{label}</div>
      <select value={value} onChange={e => onChange(e.target.value)}
        style={{ width: '100%', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '5px', color: 'var(--t0)', fontFamily: mono, fontSize: '9px', padding: '4px 6px' }}>
        {options.map(o => (
          <option key={o.value} value={o.value}>{o.label}{o.count !== undefined ? ` (${o.count})` : ''}</option>
        ))}
      </select>
    </div>
  )
}

function PagBtn({ label, onClick, disabled, active }: { label: string; onClick: () => void; disabled?: boolean; active?: boolean }) {
  const mono = 'IBM Plex Mono, monospace'
  return (
    <button onClick={onClick} disabled={disabled}
      style={{ fontFamily: mono, fontSize: '8px', padding: '4px 8px', borderRadius: '4px', border: `1px solid ${active ? 'var(--acc)' : 'var(--b1)'}`, background: active ? 'rgba(124,109,250,0.15)' : 'transparent', color: active ? 'var(--acc)' : disabled ? 'var(--t3)' : 'var(--t1)', cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {label}
    </button>
  )
}
