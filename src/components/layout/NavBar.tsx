import { useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import { useAuthStore } from '@/store'

const mono   = '"IBM Plex Mono", monospace'
const CARD   = '#111827'
const CARD2  = '#161d2c'
const BORDER = 'rgba(255,255,255,0.07)'
const ACC    = '#f97316'
const GREEN  = '#22d3a0'
const RED    = '#f03e3e'
const T0     = '#edf0f8'
const T1     = '#c8d0e0'
const T2     = '#8892a4'
const T3     = '#545f78'

const NAV_ITEMS = [
  { path: '/dashboard', label: 'Dashboard',  icon: '◉' },
  { path: '/national',  label: 'National',   icon: '🇮🇳' },
  { path: '/crisis',    label: 'Crisis',     icon: '⚡' },
  { path: '/analyse',   label: 'Analyse',    icon: '◈' },
  { path: '/research',  label: 'Research',   icon: '⚔' },
  { path: '/track',     label: 'Track',      icon: '◎' },
  { path: '/data',      label: 'Data',       icon: '⬡' },
  { path: '/settings',  label: 'Settings',   icon: '⚙' },
]

export default function NavBar() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { user, logout } = useAuthStore()
  const [menuOpen, setMenuOpen] = useState(false)

  const isActive = (path: string) =>
    location.pathname === path ||
    (path === '/dashboard' && location.pathname.startsWith('/keywords')) ||
    (path === '/analyse' && ['/trends','/audience','/content','/intelligence'].includes(location.pathname))

  function doLogout() { logout(); navigate('/'); setMenuOpen(false) }
  function go(path: string) { navigate(path); setMenuOpen(false) }

  const displayName = user?.account?.politician_name || user?.email?.split('@')[0] || 'User'
  const initials    = (user?.email || 'U').charAt(0).toUpperCase()

  return (
    <>
      <style>{`
        @media (max-width: 768px) {
          .nav-desktop { display: none !important; }
          .nav-mobile-btn { display: flex !important; }
        }
        @media (min-width: 769px) {
          .nav-desktop { display: flex !important; }
          .nav-mobile-btn { display: none !important; }
          .nav-mobile-menu { display: none !important; }
        }
      `}</style>

      {/* ── Main nav bar ── */}
      <nav style={{
        background: CARD,
        borderBottom: `1px solid ${BORDER}`,
        height: '56px',
        display: 'flex',
        alignItems: 'center',
        padding: '0 16px',
        gap: '8px',
        position: 'sticky',
        top: 0,
        zIndex: 500,
        boxShadow: '0 2px 20px rgba(0,0,0,0.5)',
      }}>

        {/* Brand */}
        <div onClick={() => go('/dashboard')}
          style={{ display:'flex', alignItems:'center', gap:'10px', cursor:'pointer', flexShrink:0, paddingRight:'16px', borderRight:`1px solid ${BORDER}` }}>
          <div style={{ width:'32px', height:'32px', borderRadius:'8px', background:'linear-gradient(135deg,#f97316,#ef4444)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'16px', flexShrink:0 }}>
            🇮🇳
          </div>
          <div className="nav-desktop">
            <div style={{ fontFamily:mono, fontSize:'11px', color:T0, letterSpacing:'1.5px', fontWeight:700, lineHeight:1 }}>
              BHARAT<span style={{ color:ACC }}>MONITOR</span>
            </div>
            <div style={{ fontFamily:mono, fontSize:'7px', color:T3, letterSpacing:'1px', marginTop:'2px' }}>
              POLITICAL INTELLIGENCE
            </div>
          </div>
        </div>

        {/* Desktop nav items */}
        <div className="nav-desktop" style={{ flex:1, alignItems:'center', gap:'2px', overflowX:'auto', scrollbarWidth:'none' as const }}>
          {NAV_ITEMS.map(item => {
            const active = isActive(item.path)
            return (
              <button key={item.path} onClick={() => go(item.path)} title={item.label}
                style={{
                  display:'flex', alignItems:'center', gap:'5px',
                  padding:'6px 11px', height:'36px',
                  borderRadius:'7px',
                  border: active ? `1px solid ${ACC}40` : '1px solid transparent',
                  background: active ? `rgba(249,115,22,0.12)` : 'transparent',
                  color: active ? ACC : T2,
                  fontFamily:mono, fontSize:'9px', fontWeight: active ? 700 : 400,
                  letterSpacing:'0.5px', cursor:'pointer', transition:'all .15s',
                  flexShrink:0, whiteSpace:'nowrap' as const,
                }}
                onMouseEnter={e => { if(!active){ e.currentTarget.style.background='rgba(255,255,255,0.05)'; e.currentTarget.style.color=T1 }}}
                onMouseLeave={e => { if(!active){ e.currentTarget.style.background='transparent'; e.currentTarget.style.color=T2 }}}>
                <span style={{ fontSize:'11px' }}>{item.icon}</span>
                {item.label}
                {active && <div style={{ width:'4px', height:'4px', borderRadius:'50%', background:ACC }} />}
              </button>
            )
          })}
        </div>

        {/* Desktop right section */}
        <div className="nav-desktop" style={{ alignItems:'center', gap:'6px', paddingLeft:'12px', borderLeft:`1px solid ${BORDER}`, flexShrink:0 }}>

          {/* Report */}
          <button onClick={() => window.open('/report','_blank')}
            style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 12px', height:'36px', borderRadius:'7px', border:`1px solid rgba(34,211,160,0.3)`, background:'rgba(34,211,160,0.07)', color:GREEN, fontFamily:mono, fontSize:'9px', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' as const }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(34,211,160,0.15)' }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(34,211,160,0.07)' }}>
            ⬇ Report
          </button>

          {/* God mode */}
          {user?.role === 'god' && (
            <button onClick={() => go('/god')}
              style={{ display:'flex', alignItems:'center', gap:'5px', padding:'6px 12px', height:'36px', borderRadius:'7px', border:`1px solid rgba(240,62,62,0.35)`, background:'rgba(240,62,62,0.08)', color:RED, fontFamily:mono, fontSize:'9px', fontWeight:600, cursor:'pointer', whiteSpace:'nowrap' as const }}>
              ⬡ God
            </button>
          )}

          {/* User chip */}
          <div style={{ display:'flex', alignItems:'center', gap:'7px', padding:'5px 10px', height:'36px', borderRadius:'7px', background:'rgba(255,255,255,0.04)', border:`1px solid ${BORDER}` }}>
            <div style={{ width:'22px', height:'22px', borderRadius:'50%', background:'linear-gradient(135deg,#f97316,#ef4444)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:mono, fontSize:'9px', color:'#fff', fontWeight:700, flexShrink:0 }}>
              {initials}
            </div>
            <span style={{ fontFamily:mono, fontSize:'8px', color:T1, maxWidth:'90px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' as const }}>
              {displayName}
            </span>
          </div>

          {/* LOGOUT — prominent labelled button */}
          <button onClick={doLogout}
            style={{
              display:'flex', alignItems:'center', gap:'6px',
              padding:'6px 14px', height:'36px',
              borderRadius:'7px',
              border:`1px solid rgba(240,62,62,0.5)`,
              background:`rgba(240,62,62,0.12)`,
              color:RED, fontFamily:mono, fontSize:'9px',
              fontWeight:700, cursor:'pointer', letterSpacing:'0.5px',
              transition:'all .15s', whiteSpace:'nowrap' as const,
            }}
            onMouseEnter={e => { e.currentTarget.style.background='rgba(240,62,62,0.25)'; e.currentTarget.style.borderColor=RED }}
            onMouseLeave={e => { e.currentTarget.style.background='rgba(240,62,62,0.12)'; e.currentTarget.style.borderColor='rgba(240,62,62,0.5)' }}>
            ⏻ Logout
          </button>
        </div>

        {/* Mobile right — user initial + hamburger */}
        <div className="nav-mobile-btn" style={{ display:'none', marginLeft:'auto', alignItems:'center', gap:'8px' }}>
          {/* User initial */}
          <div style={{ width:'32px', height:'32px', borderRadius:'50%', background:'linear-gradient(135deg,#f97316,#ef4444)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:mono, fontSize:'12px', color:'#fff', fontWeight:700, flexShrink:0 }}>
            {initials}
          </div>
          {/* Hamburger */}
          <button onClick={() => setMenuOpen(o => !o)}
            style={{ width:'40px', height:'40px', borderRadius:'8px', border:`1px solid ${BORDER}`, background: menuOpen ? 'rgba(255,255,255,0.08)' : 'transparent', color:T0, cursor:'pointer', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'4px' }}>
            <div style={{ width:'18px', height:'2px', background:menuOpen ? ACC : T1, borderRadius:'1px', transition:'all .2s', transform:menuOpen?'rotate(45deg) translate(4px,4px)':'none' }} />
            <div style={{ width:'18px', height:'2px', background:menuOpen ? ACC : T1, borderRadius:'1px', transition:'all .2s', opacity:menuOpen?0:1 }} />
            <div style={{ width:'18px', height:'2px', background:menuOpen ? ACC : T1, borderRadius:'1px', transition:'all .2s', transform:menuOpen?'rotate(-45deg) translate(4px,-4px)':'none' }} />
          </button>
        </div>
      </nav>

      {/* ── Mobile dropdown menu ── */}
      {menuOpen && (
        <div className="nav-mobile-menu"
          style={{
            position:'fixed', top:'56px', left:0, right:0, bottom:0,
            background:'rgba(0,0,0,0.85)', zIndex:490,
            display:'flex', flexDirection:'column',
          }}
          onClick={e => { if(e.target === e.currentTarget) setMenuOpen(false) }}>
          <div style={{ background:CARD, borderBottom:`1px solid ${BORDER}`, overflowY:'auto', maxHeight:'calc(100vh - 56px)' }}>

            {/* User info */}
            <div style={{ padding:'16px', borderBottom:`1px solid ${BORDER}`, display:'flex', alignItems:'center', gap:'12px' }}>
              <div style={{ width:'40px', height:'40px', borderRadius:'50%', background:'linear-gradient(135deg,#f97316,#ef4444)', display:'flex', alignItems:'center', justifyContent:'center', fontFamily:mono, fontSize:'14px', color:'#fff', fontWeight:700, flexShrink:0 }}>
                {initials}
              </div>
              <div>
                <div style={{ fontFamily:mono, fontSize:'12px', color:T0, fontWeight:600 }}>{displayName}</div>
                <div style={{ fontFamily:mono, fontSize:'8px', color:T3, marginTop:'2px' }}>{user?.email || ''}</div>
              </div>
            </div>

            {/* Nav items grid — 2 columns on mobile */}
            <div style={{ padding:'12px', display:'grid', gridTemplateColumns:'1fr 1fr', gap:'8px' }}>
              {NAV_ITEMS.map(item => {
                const active = isActive(item.path)
                return (
                  <button key={item.path} onClick={() => go(item.path)}
                    style={{
                      display:'flex', alignItems:'center', gap:'10px',
                      padding:'14px 16px', borderRadius:'10px',
                      border: active ? `1px solid ${ACC}50` : `1px solid ${BORDER}`,
                      background: active ? `rgba(249,115,22,0.12)` : CARD2,
                      color: active ? ACC : T1,
                      fontFamily:mono, fontSize:'10px', fontWeight: active ? 700 : 400,
                      cursor:'pointer', textAlign:'left' as const,
                    }}>
                    <span style={{ fontSize:'18px' }}>{item.icon}</span>
                    <span>{item.label}</span>
                    {active && <div style={{ width:'5px', height:'5px', borderRadius:'50%', background:ACC, marginLeft:'auto' }} />}
                  </button>
                )
              })}
            </div>

            {/* Bottom actions */}
            <div style={{ padding:'12px', borderTop:`1px solid ${BORDER}`, display:'flex', flexDirection:'column', gap:'8px' }}>
              <button onClick={() => { window.open('/report','_blank'); setMenuOpen(false) }}
                style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 16px', borderRadius:'10px', border:`1px solid rgba(34,211,160,0.3)`, background:'rgba(34,211,160,0.07)', color:GREEN, fontFamily:mono, fontSize:'10px', fontWeight:600, cursor:'pointer', textAlign:'left' as const }}>
                <span style={{ fontSize:'16px' }}>⬇</span> Download Report
              </button>

              {user?.role === 'god' && (
                <button onClick={() => go('/god')}
                  style={{ display:'flex', alignItems:'center', gap:'10px', padding:'14px 16px', borderRadius:'10px', border:`1px solid rgba(240,62,62,0.3)`, background:'rgba(240,62,62,0.07)', color:RED, fontFamily:mono, fontSize:'10px', fontWeight:600, cursor:'pointer', textAlign:'left' as const }}>
                  <span style={{ fontSize:'16px' }}>⬡</span> God Mode
                </button>
              )}

              {/* LOGOUT — very prominent in mobile */}
              <button onClick={doLogout}
                style={{
                  display:'flex', alignItems:'center', justifyContent:'center', gap:'10px',
                  padding:'16px', borderRadius:'10px',
                  border:`2px solid ${RED}`,
                  background:`rgba(240,62,62,0.15)`,
                  color:RED, fontFamily:mono, fontSize:'12px',
                  fontWeight:700, cursor:'pointer', letterSpacing:'1px',
                }}>
                ⏻ LOGOUT
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
