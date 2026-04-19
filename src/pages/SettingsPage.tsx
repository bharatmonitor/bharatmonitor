import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { useAccount, useUpdateAccount } from '@/hooks/useData'
import AccountForm from '@/components/auth/AccountForm'
import NavBar from '@/components/layout/NavBar'
import type { Account } from '@/types'
import toast from 'react-hot-toast'

export default function SettingsPage() {
  const navigate = useNavigate()
  const { user, tier } = useAuthStore()
  const { data: account, isLoading } = useAccount()
  const updateAccount = useUpdateAccount()
  const [showEdit, setShowEdit] = useState(false)

  async function handleSave(patch: Partial<Account>) {
    try {
      await updateAccount.mutateAsync(patch)
      toast.success('Settings saved successfully')
      setShowEdit(false)
    } catch (e: any) {
      toast.error(`Save failed: ${e.message}`)
    }
  }

  if (isLoading) {
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)' }}>Loading…</div>
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <NavBar />

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '24px 20px' }}>
        {/* Account info */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', marginBottom: '16px' }}>
            <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: 'linear-gradient(135deg, #f97316, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '16px', color: '#fff', fontWeight: 700, flexShrink: 0 }}>
              {account?.politician_initials || user?.email?.[0]?.toUpperCase() || '?'}
            </div>
            <div style={{ flex: 1 }}>
              <div style={{ fontSize: '15px', fontWeight: 600, color: '#edf0f8' }}>{account?.politician_name || 'Account'}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', marginTop: '3px' }}>
                {account?.designation || '—'} · {account?.party || '—'} · <span style={{ color: 'var(--acc)', textTransform: 'uppercase' }}>{tier}</span>
              </div>
            </div>
            <button onClick={() => setShowEdit(true)} className="btn-primary" style={{ fontSize: '8px', padding: '6px 12px' }}>✎ EDIT PROFILE</button>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
            {[
              { label: 'EMAIL', value: user?.email || '—' },
              { label: 'ROLE', value: user?.role?.toUpperCase() || '—' },
              { label: 'CONSTITUENCY', value: account?.constituency || '—' },
              { label: 'STATE', value: account?.state || '—' },
              { label: 'KEYWORDS', value: `${account?.keywords?.length || 0} tracked` },
              { label: 'LANGUAGES', value: `${account?.languages?.length || 0} selected` },
            ].map(f => (
              <div key={f.label} style={{ padding: '10px 12px', background: 'var(--s2)', border: '1px solid var(--b0)', borderRadius: '7px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px', marginBottom: '4px' }}>{f.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--t0)' }}>{f.value}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Alert preferences */}
        {account?.alert_prefs && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '20px', marginBottom: '16px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>ALERT PREFERENCES</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { key: 'red_sms', label: 'Crisis SMS', bucket: 'red' },
                { key: 'red_push', label: 'Crisis Push', bucket: 'red' },
                { key: 'red_email', label: 'Crisis Email', bucket: 'red' },
                { key: 'yellow_push', label: 'Developing Push', bucket: 'yellow' },
                { key: 'yellow_email', label: 'Developing Email', bucket: 'yellow' },
              ].map(({ key, label, bucket }) => {
                const active = account.alert_prefs?.[key as keyof typeof account.alert_prefs]
                const c = bucket === 'red' ? 'var(--red)' : 'var(--yel)'
                return (
                  <div key={key} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 10px', background: 'var(--s2)', border: '1px solid var(--b0)', borderRadius: '6px' }}>
                    <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: c, flexShrink: 0 }} />
                    <span style={{ flex: 1, fontSize: '11px', color: 'var(--t1)' }}>{label}</span>
                    <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: active ? 'var(--grn)' : 'var(--t3)' }}>{active ? 'ENABLED' : 'DISABLED'}</span>
                  </div>
                )
              })}
            </div>
            <div style={{ marginTop: '10px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)' }}>Edit these in your account profile (✎ EDIT PROFILE above)</div>
          </div>
        )}

        {/* Tracked items */}
        {account && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '20px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>TRACKING CONFIGURATION</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)', marginBottom: '6px' }}>KEYWORDS ({account.keywords?.length || 0})</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px' }}>
                  {(account.keywords || []).slice(0, 8).map(k => (
                    <span key={k} style={{ padding: '2px 7px', borderRadius: '20px', background: 'rgba(249,115,22,0.08)', border: '1px solid rgba(249,115,22,0.2)', color: '#fdba74', fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px' }}>{k}</span>
                  ))}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)', marginBottom: '6px' }}>COMPETITORS ({account.tracked_politicians?.length || 0})</div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {(account.tracked_politicians || []).slice(0, 4).map(p => (
                    <div key={p.id} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)' }}>{p.name} · {p.party}</div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Developer Tools — Sentry error test (god mode only) */}
        {user?.role === 'god' && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', padding: '20px', marginTop: '16px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '14px' }}>DEVELOPER TOOLS</div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              <button
                onClick={() => { throw new Error('This is your first error!') }}
                style={{
                  fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px',
                  padding: '6px 14px', border: '1px solid rgba(240,62,62,0.4)',
                  borderRadius: '6px', background: 'rgba(240,62,62,0.08)',
                  color: 'var(--red)', cursor: 'pointer', transition: 'all .15s',
                }}
              >
                ⚠ TEST SENTRY ERROR
              </button>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)' }}>
                Throws an error to verify Sentry is capturing events
              </span>
            </div>
          </div>
        )}
      </div>

      {showEdit && account && (
        <AccountForm account={account} onClose={() => setShowEdit(false)} onSave={handleSave} />
      )}
    </div>
  )
}
