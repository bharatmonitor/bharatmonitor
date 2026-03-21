import { useEffect, useRef, useMemo } from 'react'
import type { FeedItem, BucketColor, Platform } from '@/types'
import { useDashboardStore } from '@/store'
import FeedCard from './FeedCard'

const BUCKET_CONFIG: Record<BucketColor, {
  label: string; color: string; bg: string; border: string; refresh: string; live?: boolean
}> = {
  red:    { label: 'CRISIS',      color: '#f03e3e', bg: 'rgba(240,62,62,0.06)',   border: 'rgba(240,62,62,0.16)',   refresh: 'LIVE · 45s', live: true },
  yellow: { label: 'DEVELOPING',  color: '#f5a623', bg: 'rgba(245,166,35,0.06)',  border: 'rgba(245,166,35,0.16)',  refresh: '10 MIN' },
  blue:   { label: 'BACKGROUND',  color: '#3d8ef0', bg: 'rgba(61,142,240,0.06)',  border: 'rgba(61,142,240,0.16)',  refresh: '30 MIN' },
  silver: { label: 'QUOTE INTEL', color: '#8892a4', bg: 'rgba(136,146,164,0.06)', border: 'rgba(136,146,164,0.16)', refresh: 'AI MONITORED' },
}

const BUCKETS: BucketColor[] = ['red', 'yellow', 'blue', 'silver']

const PLAT_COLOR: Record<string, string> = {
  twitter: '#1d9bf0', instagram: '#e1306c', facebook: '#1877f2',
  whatsapp: '#25d366', youtube: '#ff2020', news: '#8892a4',
}
const PLAT_LABEL: Record<string, string> = {
  twitter: 'X / TWITTER', instagram: 'INSTAGRAM', facebook: 'FACEBOOK',
  whatsapp: 'WHATSAPP', youtube: 'YOUTUBE', news: 'NEWS / RSS',
}

function SectionDivider({ platform, count }: { platform: Platform; count: number }) {
  return (
    <div style={{ padding: '5px 9px', background: 'var(--s2)', borderBottom: '1px solid var(--b0)', borderTop: '1px solid var(--b0)', display: 'flex', alignItems: 'center', gap: '5px' }}>
      <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: PLAT_COLOR[platform] || 'var(--sil)', flexShrink: 0 }} />
      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', letterSpacing: '1px', color: 'var(--t2)', textTransform: 'uppercase' }}>{PLAT_LABEL[platform] || platform}</span>
      <span style={{ marginLeft: 'auto', fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)' }}>{count}</span>
    </div>
  )
}

function BucketColumn({ bucket, items }: { bucket: BucketColor; items: FeedItem[] }) {
  const cfg = BUCKET_CONFIG[bucket]
  const scrollRef = useRef<HTMLDivElement>(null)
  const pausedRef = useRef(false)

  // Group by platform
  const grouped = useMemo(() => {
    const order: Platform[] = ['twitter', 'instagram', 'facebook', 'whatsapp', 'youtube', 'news']
    const map = new Map<Platform, FeedItem[]>()
    items.forEach(item => {
      const arr = map.get(item.platform) || []
      arr.push(item)
      map.set(item.platform, arr)
    })
    return order.filter(p => map.has(p)).map(p => ({ platform: p, items: map.get(p)! }))
  }, [items])

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    const interval = setInterval(() => {
      if (!pausedRef.current && el.scrollHeight > el.clientHeight) {
        el.scrollTop += 0.4
        if (el.scrollTop + el.clientHeight >= el.scrollHeight - 2) el.scrollTop = 0
      }
    }, 50)
    return () => clearInterval(interval)
  }, [])

  return (
    <div id={`bcol-${bucket}`} style={{ borderRight: '1px solid var(--b0)', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
      {/* Column header */}
      <div style={{ padding: '8px 9px 6px', borderBottom: '1px solid var(--b0)', position: 'sticky', top: '120px', zIndex: 100, background: cfg.bg }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: cfg.color, flexShrink: 0, animation: cfg.live ? 'blink 1.4s infinite' : 'none' }} />
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', letterSpacing: '2px', fontWeight: 500, color: cfg.color }}>{cfg.label}</span>
          <span style={{ marginLeft: 'auto', fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', background: 'rgba(255,255,255,0.06)', padding: '1px 4px', borderRadius: '2px', color: cfg.color }}>{items.length}</span>
        </div>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)', marginTop: '2px' }}>{cfg.refresh}</div>
      </div>

      {/* Scrollable content */}
      <div
        ref={scrollRef}
        onMouseEnter={() => { pausedRef.current = true }}
        onMouseLeave={() => { pausedRef.current = false }}
        style={{ overflowY: 'auto', height: '520px', scrollbarWidth: 'thin', scrollbarColor: 'var(--b2) transparent' }}>
        {grouped.length === 0 ? (
          <div style={{ padding: '20px', textAlign: 'center', color: 'var(--t3)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px' }}>NO ITEMS</div>
        ) : (
          grouped.map(({ platform, items: platItems }) => (
            <div key={platform}>
              <SectionDivider platform={platform} count={platItems.length} />
              {platItems.map(item => <FeedCard key={item.id} item={item} />)}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

interface Props { feed: FeedItem[] }

export default function BucketColumns({ feed }: Props) {
  const { viewMode, activePlatform } = useDashboardStore()

  const filtered = useMemo(() => {
    if (activePlatform === 'all') return feed
    return feed.filter(f => f.platform === activePlatform)
  }, [feed, activePlatform])

  const byBucket = useMemo(() => {
    const map: Record<BucketColor, FeedItem[]> = { red: [], yellow: [], blue: [], silver: [] }
    filtered.forEach(f => { map[f.bucket]?.push(f) })
    return map
  }, [filtered])

  const cols = viewMode === '4col' ? 'repeat(4,1fr)' : 'repeat(2,1fr)'

  return (
    <div style={{ display: 'grid', gridTemplateColumns: cols, flex: 1 }}>
      {BUCKETS.map(b => (
        <BucketColumn key={b} bucket={b} items={byBucket[b]} />
      ))}
    </div>
  )
}
