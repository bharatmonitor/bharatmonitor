// FuelGauge — shows daily quota consumption as a fuel tank
// Displayed in CommandBar. Turns orange at 30%, red at 10%.

import { useMemo } from 'react'
import { getQuota, getFuelLevel, formatQuota } from '@/lib/quota'
import { useAuthStore } from '@/store'

const mono = 'IBM Plex Mono, monospace'

interface Props {
  accountId: string
  onUpgradeClick?: () => void
}

export default function FuelGauge({ accountId, onUpgradeClick }: Props) {
  const { user } = useAuthStore()
  const isGod    = user?.role === 'god' || accountId === 'god-account'

  const quota = useMemo(() => getQuota(accountId, isGod), [accountId, isGod])
  const fuel  = useMemo(() => getFuelLevel(accountId, isGod), [accountId, isGod])

  if (isGod) return null // God account has unlimited — don't show gauge

  const color = fuel > 50 ? '#22d3a0' : fuel > 20 ? '#f5a623' : '#f03e3e'
  const bars  = 10
  const filledBars = Math.round((fuel / 100) * bars)

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', cursor: fuel < 20 ? 'pointer' : 'default' }}
      onClick={fuel < 20 ? onUpgradeClick : undefined}
      title={formatQuota(quota)}>

      {/* Fuel tank icon + bars */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '2px' }}>
        <span style={{ fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>⛽</span>
        <div style={{ display: 'flex', gap: '1.5px', alignItems: 'center' }}>
          {Array.from({ length: bars }).map((_, i) => (
            <div key={i} style={{
              width: '4px', height: i < 3 ? '8px' : i < 7 ? '10px' : '12px',
              borderRadius: '1px',
              background: i < filledBars ? color : 'rgba(255,255,255,0.08)',
              transition: 'background .3s',
            }} />
          ))}
        </div>
        <span style={{ fontFamily: mono, fontSize: '8px', color, fontWeight: fuel < 20 ? 700 : 400, marginLeft: '3px' }}>
          {fuel}%
        </span>
      </div>

      {/* Searches remaining */}
      <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)' }}>
        {quota.searchesLimit - quota.searchesUsed}s · {quota.itemsLimit - quota.itemsUsed}i
      </div>

      {fuel <= 0 && (
        <span style={{ fontFamily: mono, fontSize: '7px', color: '#f03e3e', background: 'rgba(240,62,62,0.12)', padding: '2px 6px', borderRadius: '3px', border: '1px solid rgba(240,62,62,0.3)' }}>
          UPGRADE
        </span>
      )}
    </div>
  )
}
