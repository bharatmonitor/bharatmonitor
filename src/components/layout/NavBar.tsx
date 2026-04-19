import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'DASHBOARD',  icon: '◉' },
  { path: '/trends',    label: 'TRENDS',     icon: '◈' },
  { path: '/content',   label: 'NARRATIVES', icon: '◇' },
  { path: '/audience',  label: 'AUDIENCE',   icon: '◎' },
  { path: '/data',      label: 'DATA',       icon: '⬡' },
  { path: '/settings',  label: 'SETTINGS',   icon: '⚙' },
]

interface Props {
  /** Optional label override shown as badge next to the logo */
  pageLabel?: string
}

export default function NavBar({ pageLabel }: Props) {
  const navigate = useNavigate()
  const location = useLocation()
  const { user, logout } = useAuthStore()
  const mono = 'IBM Plex Mono, monospace'

  return (
    <div style={{
      background: 'var(--s1)',
      borderBottom: '1px solid var(--b1)',
      padding: '0 16px',
      height: '48px',
      display: 'flex',
      alignItems: 'center',
      gap: '10px',
      position: 'sticky',
      top: 0,
      zIndex: 300,
    }}>
      {/* Brand */}
      <div
        onClick={() => navigate('/dashboard')}
        style={{ display: 'flex', alignItems: 'center', gap: '7px', cursor: 'pointer', flexShrink: 0, paddingRight: '12px', borderRight: '1px solid var(--b0)' }}
      >
        <div style={{
          width: '24px', height: '24px', borderRadius: '6px',
          background: 'linear-gradient(135deg, #f97316, #ef4444)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: '11px', flexShrink: 0,
        }}>🇮🇳</div>
        <div style={{ fontFamily: mono, fontSize: '10px', color: '#edf0f8', letterSpacing: '1px', fontWeight: 500 }}>
          BHARAT<span style={{ color: '#f97316' }}>MONITOR</span>
        </div>
      </div>

      {/* Nav links */}
      <div style={{ display: 'flex', gap: '2px', overflow: 'auto', scrollbarWidth: 'none', flex: 1 }}>
        {NAV_ITEMS.map(item => {
          const active = location.pathname === item.path || (item.path === '/dashboard' && location.pathname.startsWith('/keywords'))
          return (
            <button
              key={item.path}
              onClick={() => navigate(item.path)}
              style={{
                display: 'flex', alignItems: 'center', gap: '4px',
                padding: '5px 10px', borderRadius: '5px', flexShrink: 0,
                border: active ? '1px solid rgba(249,115,22,0.4)' : '1px solid transparent',
                background: active ? 'rgba(249,115,22,0.1)' : 'transparent',
                color: active ? '#f97316' : 'var(--t2)',
                fontFamily: mono, fontSize: '8px', fontWeight: active ? 600 : 400,
                cursor: 'pointer', transition: 'all .15s',
                letterSpacing: '0.5px',
              }}
              onMouseEnter={e => {
                if (!active) {
                  e.currentTarget.style.background = 'var(--s2)'
                  e.currentTarget.style.color = 'var(--t1)'
                }
              }}
              onMouseLeave={e => {
                if (!active) {
                  e.currentTarget.style.background = 'transparent'
                  e.currentTarget.style.color = 'var(--t2)'
                }
              }}
            >
              <span style={{ fontSize: '10px' }}>{item.icon}</span>
              {item.label}
            </button>
          )
        })}
      </div>

      {/* Right controls */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
        {pageLabel && (
          <span style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', padding: '2px 6px', border: '1px solid var(--b1)', borderRadius: '3px', letterSpacing: '1px' }}>
            {pageLabel}
          </span>
        )}

        {user?.role === 'god' && (
          <button
            onClick={() => navigate('/god')}
            style={{ fontFamily: mono, fontSize: '7px', padding: '4px 8px', border: '1px solid rgba(240,62,62,0.3)', borderRadius: '4px', background: 'rgba(240,62,62,0.08)', color: 'var(--red)', cursor: 'pointer' }}
          >⬡ GOD</button>
        )}

        <button
          onClick={() => { logout(); navigate('/') }}
          style={{ fontFamily: mono, fontSize: '7px', padding: '4px 8px', border: '1px solid var(--b1)', borderRadius: '4px', background: 'transparent', color: 'var(--t3)', cursor: 'pointer' }}
        >EXIT</button>
      </div>
    </div>
  )
}
