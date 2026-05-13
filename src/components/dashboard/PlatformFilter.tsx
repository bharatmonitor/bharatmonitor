import { useDashboardStore } from '@/store'
import type { Platform } from '@/types'

const PLATFORMS: { id: Platform | 'all'; label: string; color: string }[] = [
  { id: 'all',       label: 'ALL SOURCES',  color: '#8892a4' },
  { id: 'twitter',   label: 'X / TWITTER',  color: '#1d9bf0' },
  { id: 'instagram', label: 'INSTAGRAM',    color: '#e1306c' },
  { id: 'facebook',  label: 'FACEBOOK',     color: '#1877f2' },
  { id: 'whatsapp',  label: 'WHATSAPP',     color: '#25d366' },
  { id: 'youtube',   label: 'YOUTUBE',      color: '#ff2020' },
  { id: 'reddit',    label: 'REDDIT',       color: '#ff4500' },
  { id: 'news',      label: 'NEWS / RSS',   color: '#8892a4' },
]

export default function PlatformFilter() {
  const { activePlatform, setActivePlatform } = useDashboardStore()

  return (
    <div style={{ borderBottom: '1px solid var(--b0)', display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 14px', background: 'var(--s1)', flexShrink: 0 }}>
      <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', flexShrink: 0 }}>FILTER:</span>
      <div style={{ display: 'flex', gap: '4px', overflowX: 'auto', scrollbarWidth: 'none' }}>
        {PLATFORMS.map(p => {
          const isActive = activePlatform === p.id
          return (
            <button
              key={p.id}
              onClick={() => setActivePlatform(p.id as Platform | 'all')}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '3px 9px', borderRadius: '20px', flexShrink: 0,
                border: `1px solid ${isActive ? p.color + '50' : 'var(--b1)'}`,
                background: isActive ? p.color + '18' : 'transparent',
                color: isActive ? p.color : 'var(--t2)',
                fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px',
                cursor: 'pointer', whiteSpace: 'nowrap', transition: 'all .15s',
              }}>
              {p.id !== 'all' && (
                <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
              )}
              {p.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
