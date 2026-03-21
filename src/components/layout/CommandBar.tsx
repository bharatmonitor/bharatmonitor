import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import QuickScan from '@/components/quickscan/QuickScan'
import type { Account } from '@/types'

interface Props {
  account: Account
  onSearchClick?: () => void
  onSettingsClick?: () => void
}

export default function CommandBar({ account, onSearchClick, onSettingsClick }: Props) {
  const [time, setTime] = useState('')
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()

  useEffect(() => {
    function update() {
      const now = new Date()
      const ist = new Date(now.getTime() + 5.5 * 3600000)
      setTime(ist.toISOString().substring(11, 19) + ' IST')
    }
    update()
    const id = setInterval(update, 1000)
    return () => clearInterval(id)
  }, [])

  const kpis = [
    { v: '73%',    l: 'SENTIMENT',    d: '▲ +2.1% 7d',  c: 'var(--grn)',  dd: 'var(--grn)' },
    { v: '14.2M',  l: 'MENTIONS',     d: '▲ +6.1% 7d',  c: 'var(--t0)',   dd: 'var(--grn)' },
    { v: '56/100', l: 'NARRATIVE',    d: '▲ +1.0 7d',   c: 'var(--yel)',  dd: 'var(--grn)' },
    { v: '3',      l: 'OPP GAPS',     d: '● FLAGGED',   c: 'var(--yel)',  dd: 'var(--yel)' },
    { v: 'HIGH',   l: 'PRESSURE',     d: '▲ +8% 7d',    c: 'var(--red)',  dd: 'var(--red)' },
    { v: '63%',    l: 'ISSUE OWN.',   d: '▲ +2% 7d',    c: 'var(--grn)',  dd: 'var(--grn)' },
    { v: '26%',    l: 'SOCIAL SHARE', d: '▲ +2% 7d',    c: 'var(--acc)',  dd: 'var(--grn)' },
  ]

  return (
    <div style={{
      background: 'var(--s1)',
      borderBottom: '1px solid var(--b1)',
      display: 'flex', alignItems: 'stretch',
      height: '52px', padding: '0 14px',
      position: 'sticky', top: 0, zIndex: 300,
    }}>

      {/* Brand */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', paddingRight: '14px', borderRight: '1px solid var(--b0)', flexShrink: 0 }}>
        <div style={{
          width: '28px', height: '28px', borderRadius: '7px',
          background: 'linear-gradient(135deg, #f97316, #ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '13px', flexShrink: 0,
        }}>🇮🇳</div>
        <div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: '#edf0f8', letterSpacing: '1px', fontWeight: 500 }}>
            BHARAT<span style={{ color: '#f97316' }}>MONITOR</span>
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px' }}>WAR ROOM v2.0</div>
        </div>
      </div>

      {/* Politician identity */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '9px', padding: '0 14px', borderRight: '1px solid var(--b0)', flexShrink: 0 }}>
        <div style={{
          width: '32px', height: '32px', borderRadius: '8px',
          background: 'linear-gradient(135deg, #f97316, #dc2626)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontFamily: 'IBM Plex Mono, monospace', fontSize: '11px',
          color: '#fff', fontWeight: 600, flexShrink: 0,
        }}>
          {account.politician_initials}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.2, color: '#edf0f8' }}>{account.politician_name}</div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', marginTop: '2px' }}>
            {account.constituency.toUpperCase()} · {account.state.toUpperCase()} · <span style={{ color: '#f97316' }}>{account.party}</span>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div style={{ display: 'flex', flex: 1, overflowX: 'auto', scrollbarWidth: 'none' }}>
        {kpis.map(k => (
          <div key={k.l} style={{
            display: 'flex', flexDirection: 'column', justifyContent: 'center',
            padding: '0 13px', borderRight: '1px solid var(--b0)', flexShrink: 0,
          }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '14px', fontWeight: 700, lineHeight: 1, color: k.c }}>{k.v}</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', marginTop: '2px' }}>{k.l}</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', marginTop: '2px', color: k.dd }}>{k.d}</div>
          </div>
        ))}
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', paddingLeft: '10px', flexShrink: 0 }}>

        {/* Quick Scan — main feature */}
        <QuickScan />

        {/* Search */}
        {onSearchClick && (
          <button
            onClick={onSearchClick}
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px',
              padding: '4px 10px', border: '1px solid var(--b1)',
              borderRadius: '5px', background: 'transparent',
              color: 'var(--t2)', cursor: 'pointer', transition: 'all .15s',
              letterSpacing: '0.5px',
            }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--b2)'; e.currentTarget.style.color = 'var(--t0)' }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--b1)'; e.currentTarget.style.color = 'var(--t2)' }}>
            ⌕ <span style={{ opacity: 0.6 }}>⌘K</span>
          </button>
        )}

        {/* Live clock */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
          <div style={{ width: '5px', height: '5px', borderRadius: '50%', background: 'var(--red)', animation: 'blink 1.4s ease-in-out infinite' }} />
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)' }}>{time}</span>
        </div>

        {/* Settings */}
        {onSettingsClick && (
          <button onClick={onSettingsClick} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', padding: '4px 8px', border: '1px solid var(--b1)', borderRadius: '4px', background: 'transparent', color: 'var(--t2)', cursor: 'pointer', letterSpacing: '0.5px' }}>⚙</button>
        )}

        {/* God mode */}
        {user?.role === 'god' && (
          <button onClick={() => navigate('/god')} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', padding: '4px 8px', border: '1px solid rgba(240,62,62,0.3)', borderRadius: '4px', background: 'rgba(240,62,62,0.08)', color: 'var(--red)', cursor: 'pointer' }}>⬡ GOD</button>
        )}

        {/* Logout */}
        <button onClick={() => { logout(); navigate('/') }} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', padding: '4px 8px', border: '1px solid var(--b1)', borderRadius: '4px', background: 'transparent', color: 'var(--t3)', cursor: 'pointer' }}>EXIT</button>
      </div>
    </div>
  )
}
