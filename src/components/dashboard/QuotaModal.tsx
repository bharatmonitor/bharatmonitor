// QuotaModal — shown when daily quota is hit
// "Demo Limit Reached. Upgrade to continue."

const mono = 'IBM Plex Mono, monospace'

interface Props {
  onClose: () => void
  remaining?: { searches: number; items: number }
}

export default function QuotaModal({ onClose, remaining }: Props) {
  return (
    <>
      {/* Backdrop */}
      <div onClick={onClose} style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
        zIndex: 9000, backdropFilter: 'blur(4px)',
      }} />

      {/* Modal */}
      <div style={{
        position: 'fixed', top: '50%', left: '50%',
        transform: 'translate(-50%, -50%)',
        zIndex: 9001,
        width: 'min(480px, 90vw)',
        background: '#0d1018',
        border: '1px solid rgba(249,115,22,0.4)',
        borderRadius: '16px',
        padding: '32px 28px',
        boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        animation: 'fadeIn .2s ease',
      }}>
        {/* Icon */}
        <div style={{ textAlign: 'center', marginBottom: '20px' }}>
          <div style={{
            width: '56px', height: '56px', borderRadius: '50%', margin: '0 auto 12px',
            background: 'rgba(249,115,22,0.1)', border: '2px solid rgba(249,115,22,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px',
          }}>⛽</div>
          <div style={{ fontFamily: mono, fontSize: '14px', fontWeight: 700, color: '#f97316', letterSpacing: '1px' }}>
            DAILY LIMIT REACHED
          </div>
        </div>

        {/* Message */}
        <div style={{ textAlign: 'center', marginBottom: '24px' }}>
          <div style={{ fontSize: '14px', color: 'var(--t0)', lineHeight: 1.7, marginBottom: '12px' }}>
            You've used your daily demo allowance of <strong style={{ color: '#f97316' }}>3 searches · 100 items</strong>.
          </div>
          <div style={{ fontSize: '12px', color: 'var(--t2)', lineHeight: 1.7 }}>
            Upgrade to BharatMonitor Pro to unlock:<br />
            Unlimited searches · Real-time X/Twitter · WhatsApp monitoring<br />
            Full contradiction archive · Priority ingest · Custom alerts
          </div>
        </div>

        {/* Quota breakdown */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '8px', marginBottom: '24px' }}>
          {[
            { l: 'SEARCHES', v: '3/day', u: '100+/day', c: '#f97316' },
            { l: 'NEWS ITEMS', v: '100/day', u: '5000+/day', c: '#3d8ef0' },
            { l: 'X / SOCIAL', v: '70/day', u: 'Unlimited', c: '#1d9bf0' },
          ].map(k => (
            <div key={k.l} style={{ background: 'var(--s2)', borderRadius: '8px', padding: '10px', textAlign: 'center' }}>
              <div style={{ fontFamily: mono, fontSize: '7px', color: 'var(--t3)', marginBottom: '4px' }}>{k.l}</div>
              <div style={{ fontFamily: mono, fontSize: '12px', color: '#f03e3e', fontWeight: 700, textDecoration: 'line-through', marginBottom: '2px' }}>{k.v}</div>
              <div style={{ fontFamily: mono, fontSize: '11px', color: k.c, fontWeight: 700 }}>{k.u}</div>
            </div>
          ))}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '10px' }}>
          <a href="mailto:ankit@hertzmsc.com?subject=BharatMonitor Upgrade&body=I'd like to upgrade my BharatMonitor account."
            style={{
              flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px',
              padding: '12px', borderRadius: '8px', textDecoration: 'none',
              background: '#f97316', color: '#fff',
              fontFamily: mono, fontSize: '10px', fontWeight: 700, letterSpacing: '0.5px',
              transition: 'opacity .15s',
            }}
            onMouseEnter={e => { e.currentTarget.style.opacity = '0.9' }}
            onMouseLeave={e => { e.currentTarget.style.opacity = '1' }}>
            ⚡ CONTACT TO UPGRADE
          </a>
          <button onClick={onClose} style={{
            padding: '12px 16px', borderRadius: '8px', border: '1px solid var(--b1)',
            background: 'transparent', color: 'var(--t2)', cursor: 'pointer',
            fontFamily: mono, fontSize: '9px',
          }}>LATER</button>
        </div>

        <div style={{ marginTop: '16px', textAlign: 'center', fontFamily: mono, fontSize: '8px', color: 'var(--t3)' }}>
          Quota resets daily at midnight IST · Current day resets in {getHoursUntilMidnightIST()}h
        </div>
      </div>

      <style>{`@keyframes fadeIn { from { opacity:0; transform:translate(-50%,-52%) } to { opacity:1; transform:translate(-50%,-50%) } }`}</style>
    </>
  )
}

function getHoursUntilMidnightIST(): number {
  const now = new Date()
  const ist = new Date(now.getTime() + 5.5 * 60 * 60 * 1000)
  const midnight = new Date(ist)
  midnight.setUTCHours(18, 30, 0, 0) // 18:30 UTC = midnight IST
  if (midnight <= ist) midnight.setUTCDate(midnight.getUTCDate() + 1)
  return Math.ceil((midnight.getTime() - ist.getTime()) / (1000 * 60 * 60))
}
