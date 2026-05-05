import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAllAccounts, useCreateAccount, useDeleteAccount, useTriggerIngest } from '@/hooks/useData'
import { useAuthStore } from '@/store'
import { grantBonus, getQuota, setCustomLimits, getFuelBreakdown } from '@/lib/quota'
import AccountForm from '@/components/auth/AccountForm'
import NavBar from '@/components/layout/NavBar'
import { HARDCODED_CREDS } from '@/lib/accounts'
import type { Account } from '@/types'
import toast from 'react-hot-toast'

export default function GodModePage() {
  const navigate = useNavigate()
  const { user, logout } = useAuthStore()
  const { data: accounts = [], isLoading, refetch } = useAllAccounts()
  const createAccount = useCreateAccount()
  const deleteAccount = useDeleteAccount()
  const triggerIngest = useTriggerIngest()
  const [showCreate, setShowCreate] = useState(false)
  const [storedCreds] = useState<Record<string,{password:string;username?:string}>>(() => {
    try { return JSON.parse(localStorage.getItem('bm-account-creds') || '{}') } catch { return {} }
  })
  const [grantTarget, setGrantTarget] = useState<string | null>(null)
  const [customLimits, setCustomLimitsState] = useState({ searches: 3, news: 5, youtube: 10, social: 85 })
  const [editAccount, setEditAccount] = useState<Account | null>(null)
  const [searchQ, setSearchQ] = useState('')

  const filtered = accounts.filter(a =>
    a.politician_name?.toLowerCase().includes(searchQ.toLowerCase()) ||
    a.party?.toLowerCase().includes(searchQ.toLowerCase()) ||
    a.state?.toLowerCase().includes(searchQ.toLowerCase())
  )

  async function handleCreate(data: Partial<Account>, password?: string) {
    const finalPassword = password || 'demo@1234'
    try {
      const result = await createAccount.mutateAsync({
        ...data,
        user_id: `${Date.now()}`.padEnd(16,'0').slice(0,16),
        created_by: user?.id || '9999999999999999',
        is_active: true,
        _autoPassword: finalPassword,
        _username: (data.politician_name||'user').toLowerCase().replace(/[^a-z0-9]/g,'').slice(0,10) + Math.floor(Math.random()*900+100),
      })
      // Store credentials in localStorage for God Mode display
      const accountId = (result as any)?.id || (result as any)?.data?.id
      if (accountId) {
        try {
          const creds = JSON.parse(localStorage.getItem('bm-account-creds') || '{}')
          creds[accountId] = { 
            password: finalPassword, 
            email: data.contact_email || `${(data.politician_name||'user').toLowerCase().replace(/\s/g,'.')}.${accountId.slice(-4)}@bharatmonitor.in`,
            createdAt: new Date().toISOString()
          }
          localStorage.setItem('bm-account-creds', JSON.stringify(creds))
        } catch {}
      }
      toast.success(`Account created · Password: ${finalPassword}`)
      setShowCreate(false)
      refetch()
    } catch (e: any) { toast.error(e.message) }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account? This cannot be undone.')) return
    try { await deleteAccount.mutateAsync(id); toast.success('Deleted'); refetch() }
    catch (e: any) { toast.error(e.message) }
  }

  async function handleIngest(acc: Account) {
    try {
      await triggerIngest.mutateAsync({ accountId: acc.id, politicianName: acc.politician_name, keywords: acc.keywords || [] })
      toast.success(`Ingest triggered for ${acc.politician_name}`)
    } catch (e: any) { toast.error(e.message) }
  }

  const statuses = { active: accounts.filter(a => a.is_active).length, inactive: accounts.filter(a => !a.is_active).length }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column' }}>
      <NavBar pageLabel="GOD MODE" />

      <div style={{ padding: '20px', maxWidth: '1200px', margin: '0 auto', width: '100%' }}>
        {/* Stats */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '12px', marginBottom: '20px' }}>
          {[
            { label: 'TOTAL ACCOUNTS', value: accounts.length, color: 'var(--acc)' },
            { label: 'ACTIVE', value: statuses.active, color: 'var(--grn)' },
            { label: 'INACTIVE', value: statuses.inactive, color: 'var(--red)' },
            { label: 'HARDCODED CREDS', value: HARDCODED_CREDS.length, color: 'var(--yel)' },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', padding: '14px 16px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '20px', color: s.color, fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)', letterSpacing: '1px', marginTop: '4px' }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Hardcoded credentials table */}
        <div style={{ background: 'var(--s1)', border: '1px solid rgba(240,62,62,0.2)', borderRadius: '10px', marginBottom: '20px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid rgba(240,62,62,0.15)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--red)', letterSpacing: '1px' }}>HARDCODED CREDENTIALS</span>
          </div>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--b0)' }}>
                  {['NAME', 'EMAIL', 'PASSWORD', 'ROLE', 'TIER', 'ID'].map(h => (
                    <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--t3)', letterSpacing: '1px', fontWeight: 400 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {HARDCODED_CREDS.map(c => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--b0)' }}>
                    <td style={{ padding: '8px 12px', color: 'var(--t0)' }}>{c.name}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--acc)' }}>{c.email}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--t2)', fontFamily: 'monospace' }}>{c.password}</td>
                    <td style={{ padding: '8px 12px' }}>
                      <span style={{ padding: '2px 6px', borderRadius: '3px', background: c.role==='god'?'rgba(240,62,62,0.1)':'rgba(61,142,240,0.1)', color: c.role==='god'?'var(--red)':'var(--blu)' }}>{c.role.toUpperCase()}</span>
                    </td>
                    <td style={{ padding: '8px 12px', color: 'var(--yel)' }}>{c.tier}</td>
                    <td style={{ padding: '8px 12px', color: 'var(--t3)' }}>{c.id}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Accounts table */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '10px', overflow: 'hidden' }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t1)', letterSpacing: '1px', flex: 1 }}>SUPABASE ACCOUNTS ({filtered.length})</span>
            <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search…" style={{ padding: '4px 8px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '5px', color: 'var(--t0)', fontSize: '9px', fontFamily: 'IBM Plex Mono, monospace', width: '180px' }} />
            <button onClick={() => setShowCreate(true)} className="btn-primary" style={{ fontSize: '8px', padding: '5px 12px' }}>+ NEW ACCOUNT</button>
          </div>

          {isLoading ? (
            <div style={{ padding: '24px', textAlign: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)' }}>Loading…</div>
          ) : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--b0)' }}>
                    {['NAME', 'PARTY', 'LOGIN', 'STATUS', 'KEYWORDS', 'ACTIONS'].map(h => (
                      <th key={h} style={{ padding: '8px 12px', textAlign: 'left', color: 'var(--t3)', letterSpacing: '1px', fontWeight: 400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(acc => (
                    <tr key={acc.id} style={{ borderBottom: '1px solid var(--b0)' }}>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                          <div style={{ width: '22px', height: '22px', borderRadius: '5px', background: 'rgba(249,115,22,0.12)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '8px', color: 'var(--acc)', flexShrink: 0 }}>{acc.politician_initials}</div>
                          <span style={{ color: 'var(--t0)' }}>{acc.politician_name}</span>
                        </div>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--acc)' }}>{acc.party || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>
                        {(() => {
                          const sc = storedCreds[acc.id]
                          const hc = HARDCODED_CREDS.find(c => c.account_id === acc.id)
                          const email = sc?.email || hc?.email || acc.contact_email || `${(acc.politician_name||'user').toLowerCase().replace(/\s+/g,'.')}.${(acc.id||'').slice(-4)}@bharatmonitor.in`
                          const pwd = hc?.password || sc?.password || 'demo@1234'
                          return (
                            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)' }}>{email}</div>
                              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: '#22d3a0', fontWeight: 700, letterSpacing: '0.5px' }}>{pwd}</div>
                            </div>
                          )
                        })()}
                      </td>
                      <td style={{ padding: '8px 12px' }}>
                        <span style={{ padding: '2px 6px', borderRadius: '3px', background: acc.is_active?'rgba(34,211,160,0.1)':'rgba(136,146,164,0.1)', color: acc.is_active?'var(--grn)':'var(--t3)' }}>{acc.is_active?'ACTIVE':'INACTIVE'}</span>
                      </td>
                      <td style={{ padding: '8px 12px', color: 'var(--t3)' }}>{(acc.keywords||[]).length} keywords</td>
                      <td style={{ padding: '8px 12px' }}>
                        <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                          <button onClick={() => setEditAccount(acc)} style={{ padding: '3px 7px', border: '1px solid var(--b1)', borderRadius: '3px', background: 'transparent', color: 'var(--t2)', cursor: 'pointer', fontSize: '8px' }}>EDIT</button>
                          <button onClick={() => handleIngest(acc)} style={{ padding: '3px 7px', border: '1px solid rgba(34,211,160,0.25)', borderRadius: '3px', background: 'transparent', color: 'var(--grn)', cursor: 'pointer', fontSize: '8px' }}>INGEST</button>
                          <button onClick={() => { setGrantTarget(acc.id); const bd = getFuelBreakdown(acc.id); setCustomLimitsState({ searches: 3 + (bd.searches?.limit||3) - 3, news: bd.news?.limit || 5, youtube: bd.youtube?.limit || 10, social: bd.social?.limit || 85 }) }} style={{ padding: '3px 7px', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '3px', background: 'transparent', color: 'var(--acc)', cursor: 'pointer', fontSize: '8px' }}>QUOTA</button>
                          <button onClick={() => handleDelete(acc.id)} style={{ padding: '3px 7px', border: '1px solid rgba(240,62,62,0.25)', borderRadius: '3px', background: 'transparent', color: 'var(--red)', cursor: 'pointer', fontSize: '8px' }}>DEL</button>
                        </div>
                        {grantTarget === acc.id && (
                          <div style={{ marginTop: '6px', padding: '8px', background: 'rgba(249,115,22,0.06)', border: '1px solid rgba(249,115,22,0.2)', borderRadius: '6px' }}>
                            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--acc)', marginBottom: '6px' }}>SET DAILY LIMITS</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px', marginBottom: '6px' }}>
                              {[
                                { label: 'Searches', key: 'searches', min: 1, max: 20 },
                                { label: 'News', key: 'news', min: 1, max: 50 },
                                { label: 'YouTube', key: 'youtube', min: 1, max: 50 },
                                { label: 'Social/X', key: 'social', min: 10, max: 500 },
                              ].map(f => (
                                <div key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t3)' }}>{f.label}</span>
                                  <input type="number" min={f.min} max={f.max}
                                    value={(customLimits as any)[f.key]}
                                    onChange={e => setCustomLimitsState(prev => ({ ...prev, [f.key]: Number(e.target.value) }))}
                                    style={{ width: '60px', background: 'var(--s2)', border: '1px solid var(--b1)', color: 'var(--t0)', borderRadius: '3px', padding: '2px 5px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px' }} />
                                </div>
                              ))}
                            </div>
                            <div style={{ display: 'flex', gap: '5px' }}>
                              <button onClick={() => handleSetLimits(acc.id)} style={{ padding: '3px 10px', border: '1px solid rgba(249,115,22,0.5)', borderRadius: '3px', background: 'rgba(249,115,22,0.08)', color: 'var(--acc)', cursor: 'pointer', fontSize: '8px' }}>APPLY</button>
                              <button onClick={() => setGrantTarget(null)} style={{ padding: '3px 8px', border: '1px solid var(--b1)', borderRadius: '3px', background: 'transparent', color: 'var(--t3)', cursor: 'pointer', fontSize: '8px' }}>CANCEL</button>
                            </div>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr><td colSpan={7} style={{ padding: '24px', textAlign: 'center', color: 'var(--t3)', fontSize: '9px' }}>No accounts found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {showCreate && <AccountForm onClose={() => setShowCreate(false)} onSave={handleCreate} />}
      {editAccount && <AccountForm account={editAccount} onClose={() => setEditAccount(null)} onSave={async (patch, password) => {
        // Update password if provided
        if (password) {
          try {
            const creds = JSON.parse(localStorage.getItem('bm-account-creds') || '{}')
            const existing = creds[editAccount.id] || {}
            creds[editAccount.id] = { ...existing, password, updatedAt: new Date().toISOString() }
            localStorage.setItem('bm-account-creds', JSON.stringify(creds))
            toast.success(`Password updated to: ${password}`)
          } catch {}
        }
        // Save account data
        try {
          const { updateAccount } = await import('@/lib/accounts')
          await updateAccount(user?.id || '', editAccount.id, patch)
          toast.success('Account updated')
        } catch {}
        setEditAccount(null)
        refetch()
      }} />}
    </div>
  )
}
