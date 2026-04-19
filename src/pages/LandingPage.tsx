import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { Navigate } from 'react-router-dom'

export default function LandingPage() {
  const navigate = useNavigate()
  const { user } = useAuthStore()
  if (user) return <Navigate to="/dashboard" replace />

  const features = [
    { icon: '⚡', title: 'Real-Time Intelligence', desc: 'Crisis signals, opposition moves, and narrative shifts tracked live across every platform.' },
    { icon: '🎯', title: 'AI Contradiction Engine', desc: 'Automatically surfaces position flips, vote record gaps, and historical contradictions.' },
    { icon: '📊', title: 'Constituency Pulse', desc: 'Hyper-local sentiment data down to constituency level, in your language.' },
    { icon: '🔔', title: 'Instant Crisis Alerts', desc: 'SMS, push, and email alerts the moment a crisis narrative begins forming.' },
    { icon: '𝕏', title: 'Twitter/X Tracking', desc: 'Advanced search with operators: language, location, account, hashtag, and engagement filters.' },
    { icon: '📢', title: 'Meta Ads Monitor', desc: 'Track political ad spending, targeting, and messaging across Facebook and Instagram.' },
  ]

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', color: '#edf0f8' }}>
      {/* Navbar */}
      <nav style={{ background: 'var(--s1)', borderBottom: '1px solid var(--b1)', padding: '0 32px', height: '56px', display: 'flex', alignItems: 'center', gap: '16px', position: 'sticky', top: 0, zIndex: 200 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: 'linear-gradient(135deg, #f97316, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '14px' }}>🇮🇳</div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '12px', fontWeight: 600, letterSpacing: '1px' }}>BHARAT<span style={{ color: '#f97316' }}>MONITOR</span></div>
        </div>
        <div style={{ marginLeft: 'auto' }}>
          <button onClick={() => navigate('/auth')} className="btn-primary" style={{ fontSize: '9px', padding: '7px 16px' }}>→ ENTER WAR ROOM</button>
        </div>
      </nav>

      {/* Hero */}
      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '80px 24px 60px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', letterSpacing: '3px', color: 'var(--acc)', marginBottom: '16px' }}>POLITICAL INTELLIGENCE PLATFORM</div>
        <h1 style={{ fontSize: '40px', fontWeight: 700, lineHeight: 1.1, margin: '0 0 20px', background: 'linear-gradient(135deg, #edf0f8, #f97316)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          Never be caught<br />off guard again.
        </h1>
        <p style={{ fontSize: '16px', color: 'var(--t2)', lineHeight: 1.7, maxWidth: '580px', margin: '0 auto 32px' }}>
          BharatMonitor gives Indian politicians and parties a real-time intelligence advantage — tracking narratives, crises, and competitor moves across every platform, in every language.
        </p>
        <div style={{ display: 'flex', gap: '12px', justifyContent: 'center', flexWrap: 'wrap' }}>
          <button onClick={() => navigate('/auth')} className="btn-primary" style={{ padding: '12px 28px', fontSize: '11px', letterSpacing: '1px' }}>→ REQUEST ACCESS</button>
          <button onClick={() => navigate('/auth')} style={{ padding: '12px 28px', fontSize: '11px', border: '1px solid var(--b2)', borderRadius: '7px', background: 'transparent', color: 'var(--t1)', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', letterSpacing: '1px' }}>VIEW DEMO</button>
        </div>
      </div>

      {/* Features grid */}
      <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '0 24px 80px' }}>
        <div style={{ textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)', letterSpacing: '2px', marginBottom: '32px' }}>CAPABILITIES</div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
          {features.map(f => (
            <div key={f.title} style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '20px' }}>
              <div style={{ fontSize: '24px', marginBottom: '10px' }}>{f.icon}</div>
              <div style={{ fontSize: '13px', fontWeight: 600, color: '#edf0f8', marginBottom: '6px' }}>{f.title}</div>
              <div style={{ fontSize: '11px', color: 'var(--t2)', lineHeight: 1.6 }}>{f.desc}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div style={{ borderTop: '1px solid var(--b0)', padding: '20px 24px', textAlign: 'center' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)' }}>
          BharatMonitor · Political Intelligence Platform · <a href="mailto:ankit@hertzmsc.com" style={{ color: 'var(--acc)', textDecoration: 'none' }}>ankit@hertzmsc.com</a>
        </div>
      </div>
    </div>
  )
}
