import { useMemo } from 'react'
import { getQuota, getFuelLevel, getFuelBreakdown, formatQuotaLine, getHoursUntilReset } from '@/lib/quota'
import { useAuthStore } from '@/store'

const mono = 'IBM Plex Mono, monospace'

export default function FuelGauge({ accountId, onUpgradeClick }: { accountId: string; onUpgradeClick?: () => void }) {
  const { user } = useAuthStore()
  const isGod = user?.role === 'god' || accountId === 'god-account'
  if (isGod) return null

  const fuel  = getFuelLevel(accountId, false)
  const bd    = getFuelBreakdown(accountId, false)
  const color = fuel > 50 ? '#22d3a0' : fuel > 20 ? '#f5a623' : '#f03e3e'
  const bars  = 10
  const filled = Math.round((fuel / 100) * bars)

  return (
    <div style={{ display:'flex', alignItems:'center', gap:'8px', cursor: fuel < 20 ? 'pointer' : 'default' }}
      onClick={fuel <= 0 ? onUpgradeClick : undefined}
      title={formatQuotaLine(accountId)}>
      
      {/* Gauge bars */}
      <div style={{ display:'flex', alignItems:'center', gap:'2px' }}>
        <span style={{ fontFamily:mono, fontSize:'8px', color:'var(--t3)' }}>⛽</span>
        <div style={{ display:'flex', gap:'1.5px', alignItems:'center' }}>
          {Array.from({length:bars}).map((_,i) => (
            <div key={i} style={{ width:'3px', height: i < 3 ? '7px' : i < 7 ? '9px' : '11px', borderRadius:'1px', background: i < filled ? color : 'rgba(255,255,255,0.07)', transition:'background .3s' }} />
          ))}
        </div>
        <span style={{ fontFamily:mono, fontSize:'8px', color, fontWeight: fuel < 20 ? 700 : 400, marginLeft:'3px' }}>{fuel}%</span>
      </div>

      {/* Per-source remaining */}
      <div style={{ display:'flex', gap:'5px' }}>
        {[
          { label:'N', val: bd.news.limit - bd.news.used,     limit: bd.news.limit,     color:'#8892a4' },
          { label:'YT', val: bd.youtube.limit - bd.youtube.used, limit: bd.youtube.limit, color:'#ff2020' },
          { label:'X', val: bd.social.limit - bd.social.used,  limit: bd.social.limit,   color:'#1d9bf0' },
        ].map(s => (
          <span key={s.label} style={{ fontFamily:mono, fontSize:'7px', color: s.val <= 0 ? '#f03e3e' : s.color }}>
            {s.label}:{s.val}/{s.limit}
          </span>
        ))}
      </div>

      {/* Reset timer */}
      <span style={{ fontFamily:mono, fontSize:'7px', color:'var(--t3)' }}>↺{getHoursUntilReset()}h</span>

      {fuel <= 0 && (
        <span onClick={onUpgradeClick} style={{ fontFamily:mono, fontSize:'7px', color:'#f03e3e', background:'rgba(240,62,62,0.12)', padding:'2px 6px', borderRadius:'3px', cursor:'pointer' }}>UPGRADE</span>
      )}
    </div>
  )
}
