// ─────────────────────────────────────────────────────────────────────────────
// src/lib/chartData.ts  (v2)
// Account-agnostic chart aggregations for BharatMonitor.
// Pure functions: FeedItem[] -> chart rows. The SAME functions run for every
// account, which keeps charts identical platform-wide.
//
// v2 changes:
//   • volumeBySentiment()  — stacked positive/negative/neutral over time (#7)
//   • wordCloud()          — keyword/term cloud, sentiment-tinted (#1)
//   • issueOwnership()     — share-of-voice pie by party on an issue (#4)
//   • schemeBubble()       — volume × sentiment bubbles (#6)
// ─────────────────────────────────────────────────────────────────────────────
import type { FeedItem, Account } from '../types'

export const TOKENS = {
  acc: '#f97316', red: '#f03e3e', yel: '#f5a623', grn: '#22d3a0',
  blu: '#3d8ef0', sil: '#8892a4', pur: '#7c6dfa',
  s1: '#111827', t1: '#c8d0e5', t2: '#9aa3b8', t3: '#545f78',
} as const

export const PLATFORM_COLORS: Record<string, string> = {
  twitter: '#1d9bf0', instagram: '#e1306c', facebook: '#1877f2',
  whatsapp: '#25d366', youtube: '#ff2020', news: '#8892a4',
  reddit: '#ff4500', bluesky: '#0085ff',
}

// Indian party colors — distinct, readable on dark. Fallback palette for the rest.
export const PARTY_COLORS: Record<string, string> = {
  BJP: '#ff9933', INC: '#3a9bdc', AAP: '#19aaed', TMC: '#22d3a0',
  SP: '#e2403a', BSP: '#2a59c6', RJD: '#2fae5a', NCP: '#3d8ef0',
  DMK: '#e2403a', AIADMK: '#15b39a', 'Other / Unattributed': '#545f78',
}
const FALLBACK_PALETTE = ['#7c6dfa', '#f5a623', '#e1306c', '#0085ff', '#22d3a0', '#ff4500']
export const partyColor = (party: string, i = 0) => PARTY_COLORS[party] || FALLBACK_PALETTE[i % FALLBACK_PALETTE.length]

export const scoreColor = (v: number) => (v >= 60 ? TOKENS.grn : v <= 40 ? TOKENS.red : TOKENS.yel)

const STOP = new Set(['the','a','an','in','on','at','of','to','and','or','for','is','are','was','were','be','been','has','have','had','will','with','this','that','these','those','they','them','their','its','by','from','not','but','as','if','it','he','she','we','you','do','did','does','can','could','would','should','may','might','must','shall','no','so','up','out','about','into','than','then','when','where','who','which','what','how','all','both','each','few','more','most','other','some','such','also','even','too','just','very','much','many','any','now','only','same','there','here','after','before','well','back','over','new','first','last','said','says','amid','near'])

// ── 1. Overall sentiment split (donut) ──────────────────────────────────────
export interface SentimentSlice { name: 'Positive' | 'Neutral' | 'Negative'; value: number; color: string }
export function sentimentSplit(feed: FeedItem[]): SentimentSlice[] {
  let pos = 0, neg = 0, neu = 0
  for (const f of feed) {
    if (f.sentiment === 'positive') pos++
    else if (f.sentiment === 'negative') neg++
    else neu++
  }
  return [
    { name: 'Positive', value: pos, color: TOKENS.grn },
    { name: 'Neutral', value: neu, color: TOKENS.sil },
    { name: 'Negative', value: neg, color: TOKENS.red },
  ]
}

// ── 2/7. Conversation volume, STACKED by sentiment over time (#7) ────────────
export interface SentimentDayPoint { date: string; label: string; positive: number; neutral: number; negative: number }
export function volumeBySentiment(feed: FeedItem[], days = 14): SentimentDayPoint[] {
  const m = new Map<string, { positive: number; neutral: number; negative: number }>()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(today); d.setDate(d.getDate() - i)
    m.set(d.toISOString().slice(0, 10), { positive: 0, neutral: 0, negative: 0 })
  }
  for (const f of feed) {
    const key = (f.published_at || '').slice(0, 10)
    const b = m.get(key); if (!b) continue
    if (f.sentiment === 'positive') b.positive++
    else if (f.sentiment === 'negative') b.negative++
    else b.neutral++
  }
  return [...m.entries()].map(([date, v]) => ({
    date, ...v,
    label: new Date(date).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
  }))
}

// ── Generic top-N over an array field ────────────────────────────────────────
export interface CountRow { name: string; value: number }
function topByArrayField(feed: FeedItem[], field: 'topic_tags' | 'geo_tags', n: number): CountRow[] {
  const m = new Map<string, number>()
  for (const f of feed) for (const t of (f[field] || [])) { if (t) m.set(t, (m.get(t) || 0) + 1) }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, n)
}

// ── 3. Top topics (h-bar) ────────────────────────────────────────────────────
export const topTopics = (feed: FeedItem[], n = 8) => topByArrayField(feed, 'topic_tags', n)

// ── 4. Topic helps-vs-hurts (diverging stacked bar) ──────────────────────────
export interface DivergingRow { name: string; positive: number; negative: number }
export function topicSentiment(feed: FeedItem[], n = 7): DivergingRow[] {
  const m = new Map<string, { pos: number; neg: number; total: number }>()
  for (const f of feed) for (const t of (f.topic_tags || [])) {
    if (!t) continue
    const cur = m.get(t) || { pos: 0, neg: 0, total: 0 }
    if (f.sentiment === 'positive') cur.pos++
    else if (f.sentiment === 'negative') cur.neg++
    cur.total++; m.set(t, cur)
  }
  return [...m.entries()].sort((a, b) => b[1].total - a[1].total).slice(0, n)
    .map(([name, v]) => ({ name, positive: v.pos, negative: -v.neg }))
}

// ── 5. Platform mix (h-bar) ──────────────────────────────────────────────────
export interface PlatformRow extends CountRow { color: string }
export function platformMix(feed: FeedItem[]): PlatformRow[] {
  const m = new Map<string, number>()
  for (const f of feed) m.set(f.platform, (m.get(f.platform) || 0) + 1)
  return [...m.entries()].map(([name, value]) => ({ name, value, color: PLATFORM_COLORS[name] || TOKENS.sil }))
    .sort((a, b) => b.value - a.value)
}

// ── 6. Keyword WORD CLOUD (#1) — sentiment-tinted term cloud ──────────────────
export type CloudSentiment = 'positive' | 'negative' | 'neutral' | 'sarcasm'
export interface CloudWord { text: string; count: number; sentiment: CloudSentiment }
export function wordCloud(feed: FeedItem[], n = 60, minCount = 2): CloudWord[] {
  const c: Record<string, { count: number; pos: number; neg: number; sar: number }> = {}
  for (const f of feed) {
    const text = `${f.headline || ''} ${f.body || ''}`
    const sarcasm = /\b(claims|promises|pledges|vows|insists|denies)\b/i.test(text) && f.sentiment === 'negative'
    for (const w of (text.toLowerCase().match(/[a-z]{4,}/g) || [])) {
      if (STOP.has(w)) continue
      c[w] ||= { count: 0, pos: 0, neg: 0, sar: 0 }
      c[w].count++
      if (sarcasm) c[w].sar++
      else if (f.sentiment === 'positive') c[w].pos++
      else if (f.sentiment === 'negative') c[w].neg++
    }
  }
  return Object.entries(c).filter(([, v]) => v.count >= minCount)
    .map(([text, v]) => ({
      text, count: v.count,
      sentiment: (v.sar > 0 ? 'sarcasm' : v.pos > v.neg ? 'positive' : v.neg > v.pos ? 'negative' : 'neutral') as CloudSentiment,
    }))
    .sort((a, b) => b.count - a.count).slice(0, n)
}
export const CLOUD_COLORS: Record<CloudSentiment, string> = {
  positive: TOKENS.grn, negative: TOKENS.red, neutral: TOKENS.t2, sarcasm: TOKENS.yel,
}

// ── 7. Top sources (h-bar) ───────────────────────────────────────────────────
export function topSources(feed: FeedItem[], n = 8): CountRow[] {
  const m = new Map<string, number>()
  for (const f of feed) { if (f.source) m.set(f.source, (m.get(f.source) || 0) + 1) }
  return [...m.entries()].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value).slice(0, n)
}

// ── 8. Scheme BUBBLE (#6) — x: volume, y: sentiment 0–100, size: volume ──────
export interface SchemeBubblePoint { name: string; volume: number; score: number; color: string }
export function schemeBubble(feed: FeedItem[], account: Pick<Account, 'tracked_schemes'>): SchemeBubblePoint[] {
  const schemes = (account.tracked_schemes || []) as string[]
  return schemes.map((s) => {
    const ls = s.toLowerCase()
    const items = feed.filter((f) => `${f.headline || ''} ${f.body || ''} ${(f.topic_tags || []).join(' ')}`.toLowerCase().includes(ls))
    const pos = items.filter((f) => f.sentiment === 'positive').length
    const neg = items.filter((f) => f.sentiment === 'negative').length
    const scored = pos + neg
    const score = scored === 0 ? 50 : Math.round((pos / scored) * 100)
    return { name: s, volume: items.length, score, color: scoreColor(score) }
  }).filter((r) => r.volume > 0)
}

// ── 9. ISSUE OWNERSHIP pie (#4) — share of voice by party on one issue ───────
export interface OwnershipSlice { party: string; mentions: number; color: string }
export interface IssueOwnership { issue: string; total: number; slices: OwnershipSlice[] }

function buildPartyIndex(account: Pick<Account, 'party' | 'politician_name' | 'tracked_politicians' | 'keywords'>) {
  const idx: { needle: string; party: string }[] = []
  const ownParty = account.party || 'Own party'
  if (account.politician_name) idx.push({ needle: account.politician_name.toLowerCase(), party: ownParty })
  for (const kw of (account.keywords || [])) {
    if (kw && kw.length > 4) idx.push({ needle: kw.toLowerCase(), party: ownParty })
  }
  for (const tp of (account.tracked_politicians || [])) {
    if (tp?.name) idx.push({ needle: tp.name.toLowerCase(), party: tp.party || 'Other / Unattributed' })
  }
  return idx
}

export function issueOwnership(
  feed: FeedItem[],
  account: Pick<Account, 'party' | 'politician_name' | 'tracked_politicians' | 'keywords'>,
  issue: string,
): IssueOwnership {
  const idx = buildPartyIndex(account)
  const li = issue.toLowerCase()
  const relevant = feed.filter((f) =>
    `${f.headline || ''} ${f.body || ''} ${(f.topic_tags || []).join(' ')} ${(f.entities || []).join(' ')}`.toLowerCase().includes(li))
  const tally = new Map<string, number>()
  for (const f of relevant) {
    const hay = `${f.headline || ''} ${f.body || ''} ${(f.entities || []).join(' ')}`.toLowerCase()
    const parties = new Set<string>()
    for (const { needle, party } of idx) if (hay.includes(needle)) parties.add(party)
    if (parties.size === 0) parties.add('Other / Unattributed')
    for (const p of parties) tally.set(p, (tally.get(p) || 0) + 1)
  }
  const slices = [...tally.entries()]
    .map(([party, mentions], i) => ({ party, mentions, color: partyColor(party, i) }))
    .sort((a, b) => b.mentions - a.mentions)
  return { issue, total: relevant.length, slices }
}

export function topIssue(feed: FeedItem[]): string {
  return topTopics(feed, 1)[0]?.name || ''
}

export function buildAllCharts(feed: FeedItem[], account: Account, issue?: string) {
  const chosenIssue = issue || topIssue(feed)
  return {
    sentiment: sentimentSplit(feed),
    volume: volumeBySentiment(feed),
    topics: topTopics(feed),
    topicSentiment: topicSentiment(feed),
    platforms: platformMix(feed),
    cloud: wordCloud(feed),
    sources: topSources(feed),
    schemes: schemeBubble(feed, account),
    ownership: chosenIssue ? issueOwnership(feed, account, chosenIssue) : null,
    scoredShare: feed.length ? feed.filter((f) => f.sentiment).length / feed.length : 0,
  }
}

// ── 10. GEO sentiment (#map) — state or district -> {score, mentions} ────────
// Matches feed geo_tags against region names. Account-agnostic.
export interface RegionDatum { score: number; mentions: number }
function geoSentiment(feed: FeedItem[], regions: string[]): Record<string, RegionDatum> {
  const out: Record<string, RegionDatum> = {}
  for (const region of regions) {
    const lr = region.toLowerCase()
    const items = feed.filter((f) =>
      (f.geo_tags || []).some((g) => (g || '').toLowerCase().includes(lr) || lr.includes((g || '').toLowerCase())) ||
      `${f.headline || ''} ${f.body || ''}`.toLowerCase().includes(lr))
    const pos = items.filter((f) => f.sentiment === 'positive').length
    const neg = items.filter((f) => f.sentiment === 'negative').length
    const scored = pos + neg
    out[region] = { mentions: items.length, score: scored === 0 ? 50 : Math.round((pos / scored) * 100) }
  }
  return out
}
// Pass the region-name lists from the map module at the call site, e.g.:
//   import { INDIA_STATES, CHHATTISGARH_DISTRICTS } from '../components/maps/indiaPaths'
//   geoSentimentByRegions(feed, Object.keys(INDIA_STATES))
export const geoSentimentByRegions = (feed: FeedItem[], regionNames: string[]) => geoSentiment(feed, regionNames)

// ── Estimated reach (#reach) — raw engagement/views are sparse, so approximate.
// News  → per-source daily online-readership proxy (Indian outlets).
// YouTube → actual views when present, else a conservative default.
const NEWS_SOURCE_REACH: Record<string, number> = {
  'times of india': 1500000, 'ndtv': 900000, 'the hindu': 700000, 'hindustan times': 800000,
  'india today': 700000, 'dainik bhaskar': 1200000, 'amar ujala': 800000, 'jagran': 900000,
  'indian express': 600000, 'ani': 500000, 'news18': 600000, 'zee': 600000, 'patrika': 500000,
  'naidunia': 300000, 'statesman': 200000, 'telegraph': 300000,
}
const DEFAULT_NEWS_REACH = 60000
export function estimateReach(feed: FeedItem[]): number {
  let total = 0
  for (const f of feed) {
    if (f.platform === 'youtube') total += (f.views || f.engagement || 5000)
    else if (f.platform === 'news') {
      const key = (f.source || '').toLowerCase()
      const hit = Object.keys(NEWS_SOURCE_REACH).find((s) => key.includes(s))
      total += hit ? NEWS_SOURCE_REACH[hit] : DEFAULT_NEWS_REACH
    } else total += (f.views || f.engagement || 1000)
  }
  return total
}
// Indian-numbering formatter (K / Lakh / Crore).
export function formatReach(n: number): string {
  if (n >= 1e7) return (n / 1e7).toFixed(1) + ' Cr'
  if (n >= 1e5) return (n / 1e5).toFixed(1) + ' L'
  if (n >= 1e3) return (n / 1e3).toFixed(1) + 'K'
  return String(Math.round(n))
}
