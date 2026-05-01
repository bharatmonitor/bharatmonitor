import { useMemo } from 'react'
import { useDashboardStore, useFeedCountStore } from '@/store'
import { useContradictions } from '@/hooks/useData'
import FeedCard from './FeedCard'
import type { FeedItem, BucketColor } from '@/types'

const mono = 'IBM Plex Mono, monospace'

const BUCKET_CONFIG: Record<BucketColor, { label: string; color: string; bg: string; border: string; refresh: string; live?: boolean }> = {
  red:    { label: 'CRISIS',      color: '#f03e3e', bg: 'rgba(240,62,62,0.06)',   border: 'rgba(240,62,62,0.16)',   refresh: 'LIVE · 45s', live: true },
  yellow: { label: 'DEVELOPING',  color: '#f5a623', bg: 'rgba(245,166,35,0.06)',  border: 'rgba(245,166,35,0.16)',  refresh: '10 MIN' },
  blue:   { label: 'BACKGROUND',  color: '#3d8ef0', bg: 'rgba(61,142,240,0.06)',  border: 'rgba(61,142,240,0.16)',  refresh: '30 MIN' },
  silver: { label: 'BACKGROUND',  color: '#8892a4', bg: 'rgba(136,146,164,0.06)', border: 'rgba(136,146,164,0.16)', refresh: 'AI MONITORED' },
}

const BUCKETS: BucketColor[] = ['red', 'yellow', 'blue', 'silver']

// ─── Quote Intel Column ───────────────────────────────────────────────────────
// Shows AI-detected contradictions in tracked competition politicians' statements.
// Each card represents a quote that contradicts a position they took in the last 5 years.

function QuoteIntelColumn({ accountId }: { accountId: string }) {
  const { data: contradictions = [], isLoading } = useContradictions(accountId)

  return (
    <div style={{
      display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, flex: 1,
      borderLeft: '1px solid rgba(245,166,35,0.15)',
    }}>
      {/* Header */}
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: 'rgba(245,166,35,0.06)',
        borderBottom: '1px solid rgba(245,166,35,0.2)',
        borderTop: '2px solid rgba(245,166,35,0.4)',
        padding: '8px 10px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#f5a623', flexShrink: 0, animation: contradictions.length > 0 ? 'blink 1.4s infinite' : 'none', display: 'inline-block' }} />
          <span style={{ fontFamily: mono, fontSize: '9px', color: '#f5a623', fontWeight: 700, letterSpacing: '1px' }}>
            QUOTE INTEL
          </span>
          <span style={{ fontFamily: mono, fontSize: '8px', color: 'rgba(245,166,35,0.6)', marginLeft: 2 }}>
            {contradictions.length}
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: '7px', color: 'rgba(245,166,35,0.5)', letterSpacing: '0.5px' }}>
            AI MONITORED
          </span>
        </div>
        <div style={{ fontFamily: mono, fontSize: '7px', color: 'rgba(245,166,35,0.5)', marginTop: '2px' }}>
          Competition flip-flops · 5-year record
        </div>
      </div>

      {/* Items */}
      <div style={{ overflowY: 'auto', flex: 1, scrollbarWidth: 'thin', scrollbarColor: 'var(--b2) transparent' }}>
        {isLoading ? (
          <div style={{ padding: '20px 10px', fontFamily: mono, fontSize: '8px', color: 'var(--t3)', textAlign: 'center' }}>
            SCANNING RECORDS…
          </div>
        ) : contradictions.length === 0 ? (
          <div style={{ padding: '20px 10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <div style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)', textAlign: 'center', lineHeight: 2 }}>
              NO CONTRADICTIONS DETECTED
            </div>
            <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', textAlign: 'center', lineHeight: 1.8, opacity: 0.7 }}>
              AI scans competitor quotes<br />against 5-year record.<br />Flags flip-flops automatically.
            </div>
            <div style={{ margin: '8px 0', borderTop: '1px solid var(--b0)' }} />
            <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', lineHeight: 1.8 }}>
              To activate:<br />
              1. Add competitors under Settings → Tracking<br />
              2. AI monitors their quotes in real-time<br />
              3. Contradictions appear here
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
            {contradictions.map((c: any) => (
              <ContradictionCard key={c.id} contradiction={c} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function ContradictionCard({ contradiction: c }: { contradiction: any }) {
  const selectItem   = useDashboardStore(s => s.selectItem)
  const selectedItem = useDashboardStore(s => s.selectedItem)

  const typeLabel = c.contradiction_type === 'flip'        ? 'POSITION FLIP'
                  : c.contradiction_type === 'vote_record' ? 'VOTE RECORD'
                  : c.contradiction_type === 'data_gap'    ? 'DATA GAP'
                  : 'CONTRADICTION'

  return (
    <div
      onClick={() => selectItem({
        id: c.id, account_id: c.account_id, platform: 'news', bucket: 'yellow',
        sentiment: 'negative', tone: -3, headline: `⚡ ${typeLabel}: ${c.politician_name}`,
        body: `CURRENT: "${c.current_quote}"\n\nHISTORICAL (${(c.historical_date||'').substring(0,7)}): "${c.historical_quote}"\n\nSource: ${c.historical_source}\n\nAI Reasoning: ${c.reasoning || ''}`,
        source: c.historical_source || 'Historical Record',
        url: '', geo_tags: [], topic_tags: ['Contradiction', c.contradiction_type || 'flip'],
        language: 'english', published_at: c.created_at, fetched_at: c.created_at,
        keyword: c.politician_name, contradiction: c,
      } as any)}
      style={{
        padding: '10px 10px', borderBottom: '1px solid rgba(245,166,35,0.1)',
        cursor: 'pointer', transition: 'background .15s',
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(245,166,35,0.04)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
    >
      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
        <div style={{
          width: '22px', height: '22px', borderRadius: '50%', flexShrink: 0,
          background: 'rgba(245,166,35,0.12)', border: '1px solid rgba(245,166,35,0.3)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: mono, fontSize: '8px', color: '#f5a623', fontWeight: 700,
        }}>
          {(c.politician_name || '?').split(' ').map((w: string) => w[0]).join('').slice(0, 2).toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: mono, fontSize: '9px', color: '#f5a623', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {c.politician_name}
          </div>
          <div style={{ fontFamily: mono, fontSize: '7px', color: 'rgba(245,166,35,0.6)' }}>
            {typeLabel}
          </div>
        </div>
        <div style={{
          fontFamily: mono, fontSize: '9px', fontWeight: 700,
          color: c.contradiction_score >= 80 ? '#f03e3e' : c.contradiction_score >= 60 ? '#f5a623' : '#8892a4',
        }}>
          {c.contradiction_score}%
        </div>
      </div>

      {/* Current quote */}
      <div style={{ fontSize: '10px', color: 'var(--t1)', lineHeight: 1.5, marginBottom: '5px', fontStyle: 'italic' }}>
        "{(c.current_quote || '').substring(0, 100)}…"
      </div>

      {/* Historical quote */}
      <div style={{ padding: '5px 7px', background: 'rgba(245,166,35,0.05)', borderRadius: '4px', borderLeft: '2px solid rgba(245,166,35,0.3)' }}>
        <div style={{ fontFamily: mono, fontSize: '7px', color: 'rgba(245,166,35,0.5)', marginBottom: '2px' }}>
          {(c.historical_date || '').substring(0, 7)} · {c.historical_source || 'Historical Record'}
        </div>
        <div style={{ fontSize: '9px', color: 'var(--t2)', lineHeight: 1.5 }}>
          "{(c.historical_quote || '').substring(0, 100)}…"
        </div>
      </div>

      {c.reasoning && (
        <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', marginTop: '4px', lineHeight: 1.6 }}>
          AI: {c.reasoning.substring(0, 80)}
        </div>
      )}
    </div>
  )
}

// ─── Standard bucket column ───────────────────────────────────────────────────

function BucketColumn({ bucket, items }: { bucket: BucketColor; items: FeedItem[] }) {
  const cfg = BUCKET_CONFIG[bucket]
  const selectItem   = useDashboardStore(s => s.selectItem)
  const selectedItem = useDashboardStore(s => s.selectedItem)

  return (
    <div id={`bcol-${bucket}`} style={{ display: 'flex', flexDirection: 'column', minWidth: 0, minHeight: 0, flex: 1 }}>
      <div style={{
        position: 'sticky', top: 0, zIndex: 10,
        background: cfg.bg,
        borderBottom: `1px solid ${cfg.border}`,
        borderTop: `2px solid ${cfg.color}`,
        padding: '8px 10px', flexShrink: 0,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
          {cfg.live && (
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: cfg.color, flexShrink: 0, animation: 'blink 1.4s infinite', display: 'inline-block' }} />
          )}
          <span style={{ fontFamily: mono, fontSize: '9px', color: cfg.color, fontWeight: 700, letterSpacing: '1px' }}>
            {cfg.label}
          </span>
          <span style={{ fontFamily: mono, fontSize: '8px', color: cfg.color, opacity: 0.7, marginLeft: 2 }}>
            {items.length}
          </span>
          <span style={{ marginLeft: 'auto', fontFamily: mono, fontSize: '7px', color: cfg.color, opacity: 0.6, letterSpacing: '0.5px' }}>
            {cfg.refresh}
          </span>
        </div>
      </div>

      <div style={{ overflowY: 'auto', flex: 1, scrollbarWidth: 'thin', scrollbarColor: 'var(--b2) transparent' }}>
        {items.length === 0 ? (
          <div style={{ padding: '20px 10px', fontFamily: mono, fontSize: '8px', color: 'var(--t3)', textAlign: 'center', lineHeight: 2 }}>
            NO ITEMS
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {items.map(item => (
              <FeedCard key={item.id} item={item} onClick={() => selectItem(item)} selected={selectedItem?.id === item.id} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Main export ──────────────────────────────────────────────────────────────

export default function BucketColumns({ feed, accountId }: { feed: FeedItem[]; accountId: string }) {
  const platform = useDashboardStore(s => s.activePlatform)
  const setAllCounts = useFeedCountStore(s => s.setAllCounts)

  const filtered = useMemo(() => {
    if (!platform || platform === 'all') return feed
    return feed.filter(f => f.platform === platform)
  }, [feed, platform])

  const byBucket = useMemo(() => {
    const map: Record<BucketColor, FeedItem[]> = { red: [], yellow: [], blue: [], silver: [] }
    filtered.forEach(f => { map[f.bucket]?.push(f) })
    // Update store counts
    setAllCounts({ red: map.red.length, yellow: map.yellow.length, blue: map.blue.length, silver: map.silver.length })
    return map
  }, [filtered, setAllCounts])

  // 4 columns: RED | YELLOW | BLUE (merges blue+silver) | QUOTE INTEL
  const blueItems = [...byBucket.blue, ...byBucket.silver]
    .sort((a, b) => new Date(b.published_at).getTime() - new Date(a.published_at).getTime())

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', flex: 1, minHeight: 0, overflow: 'hidden', borderTop: '1px solid var(--b0)' }}>
      <BucketColumn bucket="red"    items={byBucket.red} />
      <BucketColumn bucket="yellow" items={byBucket.yellow} />
      <BucketColumn bucket="blue"   items={blueItems} />
      <QuoteIntelColumn accountId={accountId} />
    </div>
  )
}
