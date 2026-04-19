import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import QuickScan from '@/components/quickscan/QuickScan'
import type { Account } from '@/types'

export interface KpiData {
  total: number
  pos: number
  neg: number
  crisis: number
  opp: number
  sentimentPct: number
  negPct: number
}

interface Props {
  account: Account
  kpis?: KpiData
  onSearchClick?: () => void
  onSettingsClick?: () => void
  onAnalyticsClick?: () => void
}

export default function CommandBar({ account, kpis: liveKpis, onSearchClick, onSettingsClick, onAnalyticsClick }: Props) {
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

  const k = liveKpis || { total: 0, pos: 0, neg: 0, crisis: 0, opp: 0, sentimentPct: 0, negPct: 0 }
  const kpis = [
    { v: k.total ? `${k.sentimentPct}%` : '—',                l: 'SENTIMENT',    d: k.total ? `${k.pos} pos / ${k.neg} neg` : 'NO DATA',      c: k.sentimentPct >= 50 ? 'var(--grn)' : 'var(--red)',  dd: k.sentimentPct >= 50 ? 'var(--grn)' : 'var(--red)' },
    { v: k.total > 1000 ? `${(k.total/1000).toFixed(1)}K` : String(k.total),  l: 'MENTIONS',     d: 'LIVE FEED',     c: 'var(--t0)',   dd: 'var(--grn)' },
    { v: String(k.crisis),    l: 'CRISIS',      d: k.crisis > 0 ? '● ACTIVE' : '○ CLEAR',   c: k.crisis > 0 ? 'var(--red)' : 'var(--grn)',  dd: k.crisis > 0 ? 'var(--red)' : 'var(--grn)' },
    { v: String(k.opp),       l: 'OPP GAPS',    d: k.opp > 0 ? '● FLAGGED' : '○ NONE',     c: k.opp > 0 ? 'var(--yel)' : 'var(--grn)',    dd: k.opp > 0 ? 'var(--yel)' : 'var(--grn)' },
    { v: k.negPct > 30 ? 'HIGH' : k.negPct > 15 ? 'MED' : 'LOW',  l: 'PRESSURE',  d: k.total ? `${k.negPct}% negative` : 'NO DATA',  c: k.negPct > 30 ? 'var(--red)' : k.negPct > 15 ? 'var(--yel)' : 'var(--grn)',  dd: k.negPct > 30 ? 'var(--red)' : 'var(--grn)' },
  ]

  return (
    <div style={{
      background: 'var(--s1)',
      borderBottom: '1px solid var(--b1)',
      display: 'flex', alignItems: 'stretch',
      height: '52px', padding: '0 14px',
      position: 'sticky', top: 0, zIndex: 300,
      isolation: 'isolate',
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
          {account?.politician_initials || "??"}
        </div>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, lineHeight: 1.2, color: '#edf0f8' }}>{account?.politician_name || "Account"}</div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', marginTop: '2px' }}>
            {(account?.constituency || "").toUpperCase() || "NATIONAL"} · {(account?.state || "").toUpperCase() || "INDIA"} · <span style={{ color: '#f97316' }}>{account?.party || ""}</span>
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

        {/* Edit Keywords — prominent shortcut */}
        {onSettingsClick && (
          <button
            onClick={onSettingsClick}
            title="Edit tracked keywords and account settings"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px',
              padding: '4px 10px', border: '1px solid rgba(124,109,250,0.35)',
              borderRadius: '5px', background: 'rgba(124,109,250,0.06)',
              color: '#7c6dfa', cursor: 'pointer', transition: 'all .15s',
              letterSpacing: '0.5px', fontWeight: 600,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(124,109,250,0.14)'; e.currentTarget.style.borderColor = '#7c6dfa' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(124,109,250,0.06)'; e.currentTarget.style.borderColor = 'rgba(124,109,250,0.35)' }}>
            ⚡ KEYWORDS
          </button>
        )}

        {/* Data Export */}
        <button
          onClick={() => navigate('/data')}
          title="Data Table & CSV Export"
          style={{
            display: 'flex', alignItems: 'center', gap: '5px',
            fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px',
            padding: '4px 10px', border: '1px solid rgba(249,115,22,0.35)',
            borderRadius: '5px', background: 'rgba(249,115,22,0.06)',
            color: '#f97316', cursor: 'pointer', transition: 'all .15s',
            letterSpacing: '0.5px', fontWeight: 600,
          }}
          onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.14)'; e.currentTarget.style.borderColor = '#f97316' }}
          onMouseLeave={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.06)'; e.currentTarget.style.borderColor = 'rgba(249,115,22,0.35)' }}>
          ⬡ DATA
        </button>

        {/* Analytics — comprehensive dashboard */}
        {onAnalyticsClick && (
          <button
            onClick={onAnalyticsClick}
            title="Comprehensive Analytics — Audience, Platforms, AI Insights"
            style={{
              display: 'flex', alignItems: 'center', gap: '5px',
              fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px',
              padding: '4px 10px', border: '1px solid rgba(34,211,160,0.35)',
              borderRadius: '5px', background: 'rgba(34,211,160,0.06)',
              color: '#22d3a0', cursor: 'pointer', transition: 'all .15s',
              letterSpacing: '0.5px', fontWeight: 600,
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,211,160,0.14)'; e.currentTarget.style.borderColor = '#22d3a0' }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(34,211,160,0.06)'; e.currentTarget.style.borderColor = 'rgba(34,211,160,0.35)' }}>
            ◈ ANALYTICS
          </button>
        )}

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
