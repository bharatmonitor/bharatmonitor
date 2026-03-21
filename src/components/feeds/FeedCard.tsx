import { useDashboardStore } from '@/store'
import type { FeedItem } from '@/types'
import { formatDistanceToNow } from 'date-fns'

const PLAT_COLOR: Record<string, string> = {
  twitter: '#1d9bf0', instagram: '#e1306c', facebook: '#1877f2',
  whatsapp: '#25d366', youtube: '#ff2020', news: '#8892a4', reddit: '#ff4500',
}

const SENT_COLOR: Record<string, string> = {
  positive: '#22d3a0', negative: '#f03e3e', neutral: '#2e3650',
}

function timeAgo(iso: string) {
  try {
    const d = formatDistanceToNow(new Date(iso), { addSuffix: false })
    return d.replace('about ', '').replace(' minutes', 'm').replace(' minute', 'm')
      .replace(' hours', 'h').replace(' hour', 'h').replace(' days', 'd').replace(' day', 'd')
  } catch { return '' }
}

interface Props { item: FeedItem }

export default function FeedCard({ item }: Props) {
  const { openVideo } = useDashboardStore()
  const isYT = item.platform === 'youtube'

  function handleClick() {
    if (isYT && item.youtube_id) openVideo(item.youtube_id, item.headline)
    else if (item.url) window.open(item.url, '_blank')
  }

  return (
    <div
      onClick={handleClick}
      style={{ padding: '8px 9px 8px 11px', borderBottom: '1px solid var(--b0)', cursor: 'pointer', position: 'relative', transition: 'background .12s' }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--s2)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}>

      {/* Sentiment bar */}
      <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: '2px', background: SENT_COLOR[item.sentiment] || 'var(--t3)', borderRadius: '0' }} />

      {/* Top row */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '3px' }}>
        <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: PLAT_COLOR[item.platform] || 'var(--sil)', flexShrink: 0 }} />
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{item.source}</span>
        {item.is_trending && item.trend_rank && (
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--red)', background: 'rgba(240,62,62,0.1)', padding: '0 3px', borderRadius: '2px', flexShrink: 0 }}>#{item.trend_rank}</span>
        )}
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)', flexShrink: 0 }}>{timeAgo(item.published_at)}</span>
      </div>

      {/* YouTube thumbnail row */}
      {isYT && (
        <div style={{ display: 'flex', gap: '7px', alignItems: 'center', marginBottom: '4px' }}>
          <div style={{ width: '66px', height: '37px', borderRadius: '4px', background: 'var(--s3)', border: '1px solid var(--b1)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ width: '14px', height: '14px', borderRadius: '50%', background: 'rgba(220,0,0,0.9)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '6px', color: '#fff' }}>▶</div>
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '11px', color: 'var(--t0)', fontWeight: 400, lineHeight: 1.4, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{item.headline}</div>
            {item.channel && <div style={{ fontSize: '8px', color: 'var(--t2)', marginTop: '2px', fontFamily: 'IBM Plex Mono, monospace' }}>{item.channel}{item.views ? ` · ${(item.views / 1000).toFixed(0)}K views` : ''}</div>}
          </div>
        </div>
      )}

      {/* Headline */}
      {!isYT && (
        <div style={{ fontSize: '11px', color: 'var(--t0)', lineHeight: 1.5, marginBottom: '4px' }}>{item.headline}</div>
      )}

      {/* Contradiction block */}
      {item.contradiction && (
        <div style={{
          borderRadius: '4px', padding: '5px 8px', marginBottom: '4px',
          background: item.contradiction.contradiction_type === 'data_contradiction' ? 'rgba(240,62,62,0.07)' : 'rgba(245,166,35,0.07)',
          border: `1px solid ${item.contradiction.contradiction_type === 'data_contradiction' ? 'rgba(240,62,62,0.18)' : 'rgba(245,166,35,0.18)'}`,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: item.contradiction.contradiction_type === 'data_contradiction' ? 'var(--red)' : 'var(--yel)' }}>
              {item.contradiction.contradiction_type === 'data_contradiction' ? 'DATA CONTRADICTION' : item.contradiction.contradiction_type === 'vote_record' ? 'VOTE RECORD' : 'CONTRADICTION'}
            </span>
            <span style={{ marginLeft: 'auto', fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', padding: '1px 4px', borderRadius: '2px', background: item.contradiction.evidence_source === 'RTI' ? 'rgba(240,62,62,0.15)' : 'rgba(245,166,35,0.15)', color: item.contradiction.evidence_source === 'RTI' ? 'var(--red)' : 'var(--yel)' }}>
              {item.contradiction.evidence_source || `${item.contradiction.contradiction_score}%`}
            </span>
          </div>
          <div style={{ fontSize: '10px', color: 'var(--t2)', lineHeight: 1.5 }}>
            {item.contradiction.historical_date.substring(0, 7)}: "{item.contradiction.historical_quote}"
            {item.contradiction.historical_source && <span style={{ color: 'var(--t3)' }}> — {item.contradiction.historical_source}</span>}
          </div>
        </div>
      )}

      {/* Tags */}
      <div style={{ display: 'flex', gap: '3px', flexWrap: 'wrap' }}>
        {item.geo_tags.slice(0, 2).map(t => (
          <span key={t} style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px', fontFamily: 'IBM Plex Mono, monospace', background: 'rgba(124,109,250,0.1)', color: '#a89ef8', border: '1px solid rgba(124,109,250,0.18)' }}>{t}</span>
        ))}
        {item.topic_tags.slice(0, 2).map(t => (
          <span key={t} style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px', fontFamily: 'IBM Plex Mono, monospace', background: 'rgba(34,211,160,0.1)', color: 'var(--grn)', border: '1px solid rgba(34,211,160,0.18)' }}>{t}</span>
        ))}
        {item.language !== 'english' && (
          <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px', fontFamily: 'IBM Plex Mono, monospace', background: 'var(--s3)', color: 'var(--t2)', border: '1px solid var(--b1)', textTransform: 'uppercase' }}>{item.language.substring(0, 2)}</span>
        )}
        {item.contradiction && (
          <span style={{ fontSize: '7px', padding: '1px 4px', borderRadius: '2px', fontFamily: 'IBM Plex Mono, monospace', background: 'rgba(245,166,35,0.12)', color: 'var(--yel)', border: '1px solid rgba(245,166,35,0.22)' }}>OPPORTUNITY</span>
        )}
      </div>

      {/* Engagement */}
      {(item.views || item.engagement || item.shares) && (
        <div style={{ marginTop: '4px', display: 'flex', gap: '8px' }}>
          {item.views && <span style={{ fontSize: '8px', color: 'var(--t3)', fontFamily: 'IBM Plex Mono, monospace' }}>{(item.views / 1000).toFixed(0)}K views</span>}
          {item.shares && <span style={{ fontSize: '8px', color: 'var(--t3)', fontFamily: 'IBM Plex Mono, monospace' }}>{(item.shares / 1000).toFixed(0)}K shares</span>}
          {item.engagement && item.engagement > 10000 && <span style={{ fontSize: '8px', color: 'var(--t3)', fontFamily: 'IBM Plex Mono, monospace' }}>{(item.engagement / 1000000).toFixed(1)}M reach</span>}
        </div>
      )}
    </div>
  )
}
