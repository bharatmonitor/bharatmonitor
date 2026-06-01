// src/components/SocialGate.tsx
// Mandatory social-connection gate. Wrap the authenticated app:
//   <SocialGate userId={user.id}><AppRoutes /></SocialGate>
// Until every REQUIRED platform is connected, the app is blocked.
import { useEffect, useState } from 'react'
import {
  PLATFORMS, getConnections, isConnected, gateSatisfied, startConnect,
  type SocialConnection,
} from '../lib/socialConnect'
import { BrandLogo } from './brand/BrandLogo'

const mono = '"IBM Plex Mono", monospace'

export function SocialGate({ userId, children }: { userId: string; children: React.ReactNode }) {
  const [conns, setConns] = useState<SocialConnection[] | null>(null)

  useEffect(() => { getConnections(userId).then(setConns) }, [userId])

  if (conns === null) {
    return <div style={{ minHeight: '100vh', background: '#0d1018', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#545f78', fontFamily: mono, fontSize: 11 }}>Checking connections…</div>
  }

  if (gateSatisfied(conns)) return <>{children}</>

  return (
    <div style={{ minHeight: '100vh', background: '#0d1018', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24 }}>
      <div style={{ width: '100%', maxWidth: 460 }}>
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 22 }}><BrandLogo variant="lockup" height={42} /></div>
        <div style={{ background: '#111827', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 14, padding: '22px 22px 18px' }}>
          <div style={{ fontFamily: mono, fontSize: 13, fontWeight: 700, color: '#edf0f8', marginBottom: 4 }}>Connect your accounts</div>
          <div style={{ fontFamily: mono, fontSize: 10.5, color: '#8892a4', lineHeight: 1.55, marginBottom: 18 }}>
            BharatMonitor tracks coverage through your connected accounts. Connect the required platforms below to continue.
          </div>

          {PLATFORMS.map((p) => {
            const done = isConnected(conns, p.id)
            return (
              <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 0', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ width: 9, height: 9, borderRadius: '50%', background: p.color, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontFamily: mono, fontSize: 11, color: '#edf0f8', display: 'flex', gap: 6, alignItems: 'center' }}>
                    {p.label}
                    {p.required
                      ? <span style={{ fontSize: 7.5, color: '#f97316', border: '1px solid rgba(249,115,22,0.35)', padding: '1px 5px', borderRadius: 4 }}>REQUIRED</span>
                      : <span style={{ fontSize: 7.5, color: '#545f78', border: '1px solid rgba(255,255,255,0.1)', padding: '1px 5px', borderRadius: 4 }}>OPTIONAL</span>}
                  </div>
                  <div style={{ fontFamily: mono, fontSize: 8.5, color: '#545f78', marginTop: 2 }}>{p.blurb}</div>
                </div>
                {done ? (
                  <span style={{ fontFamily: mono, fontSize: 10, color: '#22d3a0', fontWeight: 700, flexShrink: 0 }}>✓ Connected</span>
                ) : (
                  <button onClick={() => startConnect(p)} style={{ flexShrink: 0, fontFamily: mono, fontSize: 10, fontWeight: 700, color: '#fff', background: p.color, border: 'none', borderRadius: 7, padding: '7px 13px', cursor: 'pointer' }}>Connect</button>
                )}
              </div>
            )
          })}

          <div style={{ fontFamily: mono, fontSize: 8.5, color: '#545f78', marginTop: 16, lineHeight: 1.5 }}>
            Required: {PLATFORMS.filter(p => p.required).length} of {PLATFORMS.filter(p => p.required).length} platforms.
            Optional connections widen coverage but aren't needed to start.
          </div>
        </div>
      </div>
    </div>
  )
}
