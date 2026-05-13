// BharatMonitor — God Mode v31
// Full admin: accounts, credentials, quota, ingest, usage analytics

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAllAccounts, useCreateAccount, useDeleteAccount, useTriggerIngest } from '@/hooks/useData'
import { useAuthStore } from '@/store'
import { syncCredentialToSupabase, HARDCODED_CREDS, updateAccount } from '@/lib/accounts'
import { getQuota, setCustomLimits, getFuelBreakdown } from '@/lib/quota'
import AccountForm from '@/components/auth/AccountForm'
import NavBar from '@/components/layout/NavBar'
import { supabase } from '@/lib/supabase'
import type { Account } from '@/types'
import toast from 'react-hot-toast'

const mono   = '"IBM Plex Mono", monospace'
const CARD   = '#111827'
const CARD2  = '#161d2c'
const BORDER = 'rgba(255,255,255,0.07)'
const ACC    = '#f97316'
const GREEN  = '#22d3a0'
const RED    = '#f03e3e'
const YELLOW = '#f5a623'
const BLUE   = '#3d8ef0'
const PURPLE = '#7c6dfa'
const T0     = '#edf0f8'
const T1     = '#c8d0e0'
const T2     = '#8892a4'
const T3     = '#545f78'

// ─── Credential editor modal ──────────────────────────────────────────────────
function CredentialEditor({ account, onClose, onSave }: {
  account: Account
  onClose: () => void
  onSave: (email: string, password: string, name: string) => Promise<void>
}) {
  const defaultEmail = (account as any).login_email || account.contact_email ||
    `${(account.politician_name||'user').toLowerCase().replace(/\s+/g,'.')}.${account.id.slice(-4)}@bharatmonitor.in`
  const [email,    setEmail]    = useState(defaultEmail)
  const [password, setPassword] = useState('')
  const [name,     setName]     = useState(account.politician_name || '')
  const [saving,   setSaving]   = useState(false)
  const [show,     setShow]     = useState(false)

  async function handle() {
    if (!password || password.length < 6) { toast.error('Password must be 6+ chars'); return }
    setSaving(true)
    await onSave(email, password, name)
    setSaving(false)
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.75)', zIndex:600, display:'flex', alignItems:'center', justifyContent:'center' }}>
      <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:'14px', padding:'28px', width:'440px', maxWidth:'95vw' }}>
        <div style={{ fontFamily:mono, fontSize:'9px', color:PURPLE, letterSpacing:'1px', marginBottom:'20px' }}>
          🔑 SET LOGIN CREDENTIALS — {account.politician_name}
        </div>
        {[
          { label:'DISPLAY NAME', value:name,  set:setName,  type:'text',  ph:account.politician_name },
          { label:'LOGIN EMAIL',  value:email, set:setEmail, type:'email', ph:defaultEmail },
        ].map(f => (
          <div key={f.label} style={{ marginBottom:'12px' }}>
            <div style={{ fontFamily:mono, fontSize:'7px', color:T3, letterSpacing:'1px', marginBottom:'5px' }}>{f.label}</div>
            <input value={f.value} onChange={e => f.set(e.target.value)} type={f.type} placeholder={f.ph}
              style={{ width:'100%', padding:'9px 12px', background:CARD2, border:`1px solid ${BORDER}`, borderRadius:'7px', color:T0, fontFamily:mono, fontSize:'11px', outline:'none', boxSizing:'border-box' }} />
          </div>
        ))}
        <div style={{ marginBottom:'16px' }}>
          <div style={{ fontFamily:mono, fontSize:'7px', color:T3, letterSpacing:'1px', marginBottom:'5px' }}>PASSWORD</div>
          <div style={{ position:'relative' }}>
            <input value={password} onChange={e => setPassword(e.target.value)}
              type={show ? 'text' : 'password'} placeholder="New password (min 6 chars)"
              style={{ width:'100%', padding:'9px 40px 9px 12px', background:CARD2, border:`1px solid ${password.length>=6?GREEN+'50':BORDER}`, borderRadius:'7px', color:password.length>=6?GREEN:T0, fontFamily:mono, fontSize:'11px', outline:'none', boxSizing:'border-box' }} />
            <button onClick={() => setShow(s => !s)}
              style={{ position:'absolute', right:'10px', top:'50%', transform:'translateY(-50%)', background:'none', border:'none', color:T3, cursor:'pointer', fontSize:'14px' }}>
              {show ? '🙈' : '👁'}
            </button>
          </div>
          {password.length > 0 && password.length < 6 && (
            <div style={{ fontFamily:mono, fontSize:'8px', color:RED, marginTop:'3px' }}>Min 6 characters</div>
          )}
        </div>
        <div style={{ background:CARD2, border:`1px solid ${BORDER}`, borderRadius:'8px', padding:'10px 14px', marginBottom:'20px' }}>
          <div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginBottom:'5px' }}>USER WILL LOG IN WITH:</div>
          <div style={{ fontFamily:mono, fontSize:'10px', color:BLUE }}>{email}</div>
          <div style={{ fontFamily:mono, fontSize:'10px', color:GREEN, marginTop:'3px', fontWeight:700 }}>{password || '(not set)'}</div>
          <div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginTop:'6px' }}>✓ Synced to Supabase · works on any device across India</div>
        </div>
        <div style={{ display:'flex', gap:'8px', justifyContent:'flex-end' }}>
          <button onClick={onClose} style={{ padding:'9px 18px', background:'transparent', border:`1px solid ${BORDER}`, borderRadius:'7px', color:T2, fontFamily:mono, fontSize:'9px', cursor:'pointer' }}>
            Cancel
          </button>
          <button onClick={handle} disabled={saving || password.length < 6}
            style={{ padding:'9px 20px', background:password.length>=6?PURPLE+'20':CARD2, border:`1px solid ${password.length>=6?PURPLE+'60':BORDER}`, borderRadius:'7px', color:password.length>=6?PURPLE:T3, fontFamily:mono, fontSize:'9px', fontWeight:700, cursor:password.length>=6?'pointer':'not-allowed' }}>
            {saving ? '⚙ Saving…' : '✓ Save & Sync to All Devices'}
          </button>
        </div>
      </div>
    </div>
  )
}

function UsageBar({ used, limit, color }: { used:number; limit:number; color:string }) {
  const pct = Math.min((used/Math.max(limit,1))*100, 100)
  return (
    <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
      <div style={{ width:'55px', height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'2px', overflow:'hidden' }}>
        <div style={{ width:`${pct}%`, height:'100%', background:color, borderRadius:'2px' }}/>
      </div>
      <span style={{ fontFamily:mono, fontSize:'7px', color:T3 }}>{used}/{limit}</span>
    </div>
  )
}

// ─── Main ──────────────────────────────────────────────────────────────────────
export default function GodModePage() {
  const navigate   = useNavigate()
  const { user, logout } = useAuthStore()
  const { data: accounts = [], isLoading, refetch } = useAllAccounts()
  const createAccount = useCreateAccount()
  const deleteAccount = useDeleteAccount()
  const triggerIngest = useTriggerIngest()

  const [showCreate,   setShowCreate]   = useState(false)
  const [editAccount,  setEditAccount]  = useState<Account|null>(null)
  const [credAccount,  setCredAccount]  = useState<Account|null>(null)
  const [grantTarget,  setGrantTarget]  = useState<string|null>(null)
  const [limits,       setLimits]       = useState({ searches:3, news:5, youtube:10, social:85 })
  const [searchQ,      setSearchQ]      = useState('')
  const [activeTab,    setActiveTab]    = useState<'accounts'|'analytics'|'system'>('accounts')
  const [feedStats,    setFeedStats]    = useState<Record<string,number>>({})
  const [loadingStats, setLoadingStats] = useState(false)

  const filtered = accounts.filter(a =>
    !searchQ ||
    a.politician_name?.toLowerCase().includes(searchQ.toLowerCase()) ||
    a.party?.toLowerCase().includes(searchQ.toLowerCase()) ||
    a.state?.toLowerCase().includes(searchQ.toLowerCase())
  )

  async function loadAnalytics() {
    setLoadingStats(true)
    try {
      const { data } = await supabase.from('bm_feed').select('account_id').limit(10000)
      if (data) {
        const counts: Record<string,number> = {}
        data.forEach((r:any) => { counts[r.account_id] = (counts[r.account_id]||0)+1 })
        setFeedStats(counts)
      }
    } catch {}
    setLoadingStats(false)
  }

  async function handleCreate(data: Partial<Account>, password?: string) {
    const finalPwd = password || 'demo@1234'
    try {
      const result: any = await createAccount.mutateAsync({
        ...data, user_id:`${Date.now()}`.slice(0,16), created_by:user?.id||'9999999999999999', is_active:true,
      })
      const accountId = result?.id || result?.data?.id || `bm-${Date.now()}`
      const loginEmail = data.contact_email ||
        `${(data.politician_name||'user').toLowerCase().replace(/[^a-z0-9]/g,'.')}.${String(accountId).slice(-4)}@bharatmonitor.in`
      await syncCredentialToSupabase(accountId, loginEmail, finalPwd, {
        name: data.politician_name||accountId, role:'user', tier:'elections',
      })
      toast.success(`✓ Created · ${loginEmail} / ${finalPwd}`, { duration:8000,
        style:{ background:CARD, border:`1px solid ${GREEN}40`, color:GREEN, fontFamily:mono, fontSize:'11px' } })
      setShowCreate(false); refetch()
    } catch (e:any) { toast.error(e.message) }
  }

  async function handleSaveCred(acc: Account, email: string, password: string, name: string) {
    await syncCredentialToSupabase(acc.id, email, password, { name, role:'user', tier:'elections' })
    toast.success(`✓ ${email} / ${password} — synced to Supabase, works everywhere`, {
      duration:7000, style:{ background:CARD, border:`1px solid ${PURPLE}40`, color:PURPLE, fontFamily:mono, fontSize:'11px' } })
    refetch()
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this account permanently?')) return
    try { await deleteAccount.mutateAsync(id); toast.success('Deleted'); refetch() }
    catch (e:any) { toast.error(e.message) }
  }

  async function handleIngest(acc: Account) {
    try {
      await triggerIngest.mutateAsync({ accountId:acc.id, politicianName:acc.politician_name, keywords:acc.keywords||[] })
      toast.success(`⚡ Ingest triggered for ${acc.politician_name}`)
    } catch (e:any) { toast.error(e.message) }
  }

  function handleApplyQuota(accId: string) {
    setCustomLimits(accId, limits)
    toast.success('✓ Quota updated'); setGrantTarget(null)
  }

  const totalItems = Object.values(feedStats).reduce((s,n) => s+n, 0)
  const statuses   = { active:accounts.filter(a=>a.is_active).length, inactive:accounts.filter(a=>!a.is_active).length }

  return (
    <div style={{ minHeight:'100vh', background:'var(--bg)' }}>
      <NavBar />
      <div style={{ maxWidth:'1360px', margin:'0 auto', padding:'24px 20px' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', marginBottom:'24px' }}>
          <div>
            <div style={{ fontFamily:mono, fontSize:'8px', color:RED, letterSpacing:'2px', marginBottom:'4px' }}>ADMIN CONSOLE</div>
            <div style={{ fontSize:'20px', fontWeight:700, color:T0 }}>God Mode</div>
          </div>
          <div style={{ marginLeft:'auto', display:'flex', gap:'8px' }}>
            <button onClick={() => navigate('/dashboard')}
              style={{ padding:'8px 16px', background:'transparent', border:`1px solid ${BORDER}`, borderRadius:'8px', color:T2, fontFamily:mono, fontSize:'9px', cursor:'pointer' }}>
              ← Dashboard
            </button>
            <button onClick={() => { logout(); navigate('/') }}
              style={{ padding:'8px 16px', background:RED+'10', border:`1px solid ${RED}40`, borderRadius:'8px', color:RED, fontFamily:mono, fontSize:'9px', fontWeight:700, cursor:'pointer' }}>
              ⏻ Logout
            </button>
          </div>
        </div>

        {/* KPIs */}
        <div style={{ display:'grid', gridTemplateColumns:'repeat(5,1fr)', gap:'10px', marginBottom:'24px' }}>
          {[
            { l:'ACCOUNTS',  v:accounts.length,        c:ACC    },
            { l:'ACTIVE',    v:statuses.active,         c:GREEN  },
            { l:'INACTIVE',  v:statuses.inactive,       c:T3     },
            { l:'FEED ITEMS',v:totalItems||'—',         c:BLUE   },
            { l:'SYS USERS', v:HARDCODED_CREDS.length,  c:PURPLE },
          ].map(k => (
            <div key={k.l} style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:'10px', padding:'12px 16px' }}>
              <div style={{ fontFamily:mono, fontSize:'7px', color:T3, letterSpacing:'1px', marginBottom:'5px' }}>{k.l}</div>
              <div style={{ fontFamily:mono, fontSize:'22px', fontWeight:700, color:k.c }}>{k.v}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{ display:'flex', gap:'2px', borderBottom:`1px solid ${BORDER}`, marginBottom:'20px' }}>
          {[['accounts','ACCOUNTS',accounts.length],['analytics','USAGE ANALYTICS',totalItems],['system','SYSTEM CREDS',HARDCODED_CREDS.length]].map(([id,label,count]) => (
            <button key={id} onClick={() => { setActiveTab(id as any); if(id==='analytics') loadAnalytics() }}
              style={{ fontFamily:mono, fontSize:'9px', letterSpacing:'1px', padding:'10px 18px', border:'none', background:activeTab===id?RED+'10':'transparent', cursor:'pointer', color:activeTab===id?RED:T2, borderBottom:`2px solid ${activeTab===id?RED:'transparent'}`, marginBottom:'-1px', transition:'all .15s' }}>
              {label} <span style={{ opacity:0.6 }}>({count})</span>
            </button>
          ))}
        </div>

        {/* ── ACCOUNTS ── */}
        {activeTab==='accounts' && (
          <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:'12px', overflow:'hidden' }}>
            <div style={{ padding:'12px 16px', borderBottom:`1px solid ${BORDER}`, display:'flex', alignItems:'center', gap:'10px' }}>
              <span style={{ fontFamily:mono, fontSize:'9px', color:T1, flex:1 }}>ACCOUNTS ({filtered.length})</span>
              <input value={searchQ} onChange={e => setSearchQ(e.target.value)} placeholder="Search…"
                style={{ padding:'6px 10px', background:CARD2, border:`1px solid ${BORDER}`, borderRadius:'6px', color:T0, fontFamily:mono, fontSize:'9px', width:'180px', outline:'none' }} />
              <button onClick={() => setShowCreate(true)}
                style={{ padding:'7px 16px', background:GREEN+'15', border:`1px solid ${GREEN}50`, borderRadius:'7px', color:GREEN, fontFamily:mono, fontSize:'9px', fontWeight:700, cursor:'pointer' }}>
                + NEW ACCOUNT
              </button>
            </div>
            {isLoading ? (
              <div style={{ padding:'32px', textAlign:'center', fontFamily:mono, fontSize:'9px', color:T3 }}>Loading…</div>
            ) : (
              <div className="god-table-wrap" style={{ overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
                <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:mono, fontSize:'9px' }}>
                  <thead>
                    <tr style={{ borderBottom:`1px solid ${BORDER}` }}>
                      {['POLITICIAN','PARTY/STATE','LOGIN EMAIL','PASSWORD','STATUS','KWS','QUOTA','ACTIONS'].map(h => (
                        <th key={h} style={{ padding:'9px 12px', textAlign:'left', color:T3, letterSpacing:'1px', fontWeight:400, whiteSpace:'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {filtered.map(acc => {
                      const hc         = HARDCODED_CREDS.find(c => c.account_id===acc.id)
                      const quota      = getQuota(acc.id, false)
                      const loginEmail = (acc as any).login_email||hc?.email||acc.contact_email||`${(acc.politician_name||'user').toLowerCase().replace(/\s+/g,'.')}.${acc.id.slice(-4)}@bharatmonitor.in`
                      const loginPwd   = (acc as any).login_password||hc?.password||'demo@1234'
                      const totalUsed  = quota.newsUsed+quota.youtubeUsed+quota.socialUsed
                      const totalLimit = quota.newsLimit+quota.youtubeLimit+quota.socialLimit
                      const pct        = Math.min(Math.round((totalUsed/Math.max(totalLimit,1))*100),100)
                      return (
                        <tr key={acc.id} style={{ borderBottom:`1px solid ${BORDER}` }}
                          onMouseEnter={e=>{e.currentTarget.style.background=CARD2}}
                          onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'8px' }}>
                              <div style={{ width:'28px', height:'28px', borderRadius:'7px', background:ACC+'15', border:`1px solid ${ACC}30`, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:mono, fontSize:'9px', color:ACC, fontWeight:700, flexShrink:0 }}>
                                {acc.politician_initials||'?'}
                              </div>
                              <div>
                                <div style={{ color:T0, fontWeight:600 }}>{acc.politician_name}</div>
                                <div style={{ color:T3, fontSize:'7px', marginTop:'1px' }}>{acc.id.slice(-8)}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ color:ACC }}>{acc.party||'—'}</div>
                            <div style={{ color:T3, fontSize:'7px', marginTop:'1px' }}>{acc.state||'National'}</div>
                          </td>
                          <td style={{ padding:'10px 12px', maxWidth:'160px' }}>
                            <div style={{ color:BLUE, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{loginEmail}</div>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ color:GREEN, fontWeight:700 }}>{loginPwd}</div>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <span style={{ padding:'2px 8px', borderRadius:'20px', background:acc.is_active?GREEN+'12':T3+'12', color:acc.is_active?GREEN:T3, fontWeight:600 }}>
                              {acc.is_active?'ACTIVE':'PAUSED'}
                            </span>
                          </td>
                          <td style={{ padding:'10px 12px', color:T2 }}>{(acc.keywords||[]).length}</td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                              <div style={{ width:'40px', height:'4px', background:'rgba(255,255,255,0.06)', borderRadius:'2px', overflow:'hidden' }}>
                                <div style={{ width:`${pct}%`, height:'100%', background:pct>80?RED:pct>50?YELLOW:GREEN, borderRadius:'2px' }}/>
                              </div>
                              <span style={{ color:pct>80?RED:pct>50?YELLOW:GREEN, fontWeight:700 }}>{pct}%</span>
                            </div>
                          </td>
                          <td style={{ padding:'10px 12px' }}>
                            <div style={{ display:'flex', gap:'4px', flexWrap:'wrap' }}>
                              <button onClick={() => setEditAccount(acc)}
                                style={{ padding:'4px 9px', border:`1px solid ${BORDER}`, borderRadius:'5px', background:'transparent', color:T2, cursor:'pointer', fontSize:'8px' }}
                                onMouseEnter={e=>{e.currentTarget.style.borderColor=PURPLE;e.currentTarget.style.color=PURPLE}}
                                onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER;e.currentTarget.style.color=T2}}>
                                ✎ Edit
                              </button>
                              <button onClick={() => setCredAccount(acc)}
                                style={{ padding:'4px 9px', border:`1px solid ${BLUE}40`, borderRadius:'5px', background:BLUE+'08', color:BLUE, cursor:'pointer', fontSize:'8px', fontWeight:600 }}
                                onMouseEnter={e=>{e.currentTarget.style.background=BLUE+'20'}}
                                onMouseLeave={e=>{e.currentTarget.style.background=BLUE+'08'}}>
                                🔑 Creds
                              </button>
                              <button onClick={() => handleIngest(acc)}
                                style={{ padding:'4px 9px', border:`1px solid ${GREEN}40`, borderRadius:'5px', background:GREEN+'08', color:GREEN, cursor:'pointer', fontSize:'8px' }}
                                onMouseEnter={e=>{e.currentTarget.style.background=GREEN+'20'}}
                                onMouseLeave={e=>{e.currentTarget.style.background=GREEN+'08'}}>
                                ⚡ Ingest
                              </button>
                              <button onClick={() => { setGrantTarget(grantTarget===acc.id?null:acc.id); const bd=getFuelBreakdown(acc.id); setLimits({searches:bd.searches?.limit||3,news:bd.news?.limit||5,youtube:bd.youtube?.limit||10,social:bd.social?.limit||85}) }}
                                style={{ padding:'4px 9px', border:`1px solid ${ACC}40`, borderRadius:'5px', background:ACC+'08', color:ACC, cursor:'pointer', fontSize:'8px' }}
                                onMouseEnter={e=>{e.currentTarget.style.background=ACC+'20'}}
                                onMouseLeave={e=>{e.currentTarget.style.background=ACC+'08'}}>
                                ⛽ Quota
                              </button>
                              <button onClick={() => handleDelete(acc.id)}
                                style={{ padding:'4px 9px', border:`1px solid ${RED}30`, borderRadius:'5px', background:'transparent', color:RED, cursor:'pointer', fontSize:'8px' }}
                                onMouseEnter={e=>{e.currentTarget.style.background=RED+'10'}}
                                onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
                                × Del
                              </button>
                            </div>
                            {grantTarget===acc.id && (
                              <div style={{ marginTop:'8px', padding:'10px', background:ACC+'06', border:`1px solid ${ACC}25`, borderRadius:'7px' }}>
                                <div style={{ fontFamily:mono, fontSize:'8px', color:ACC, marginBottom:'8px' }}>SET DAILY LIMITS</div>
                                <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'6px', marginBottom:'8px' }}>
                                  {[['Searches','searches',20],['News','news',50],['YouTube','youtube',50],['Social','social',500]].map(([label,key,max]) => (
                                    <div key={key as string}>
                                      <div style={{ fontFamily:mono, fontSize:'7px', color:T3, marginBottom:'2px' }}>{label}</div>
                                      <input type="number" min={1} max={max as number} value={(limits as any)[key as string]}
                                        onChange={e => setLimits(p => ({...p,[key as string]:Number(e.target.value)}))}
                                        style={{ width:'70px', background:CARD2, border:`1px solid ${BORDER}`, color:T0, borderRadius:'4px', padding:'3px 6px', fontFamily:mono, fontSize:'10px', outline:'none' }} />
                                    </div>
                                  ))}
                                </div>
                                <div style={{ display:'flex', gap:'6px' }}>
                                  <button onClick={() => handleApplyQuota(acc.id)}
                                    style={{ padding:'4px 12px', border:`1px solid ${ACC}50`, borderRadius:'5px', background:ACC+'12', color:ACC, cursor:'pointer', fontFamily:mono, fontSize:'8px', fontWeight:700 }}>
                                    ✓ Apply
                                  </button>
                                  <button onClick={() => setGrantTarget(null)}
                                    style={{ padding:'4px 10px', border:`1px solid ${BORDER}`, borderRadius:'5px', background:'transparent', color:T3, cursor:'pointer', fontFamily:mono, fontSize:'8px' }}>
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                    {filtered.length===0 && (
                      <tr><td colSpan={8} style={{ padding:'32px', textAlign:'center', color:T3, fontFamily:mono, fontSize:'9px' }}>No accounts found</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* ── USAGE ANALYTICS ── */}
        {activeTab==='analytics' && (
          <div>
            <div style={{ display:'flex', alignItems:'center', marginBottom:'16px', gap:'10px' }}>
              <span style={{ fontFamily:mono, fontSize:'9px', color:T2 }}>Feed item counts from Supabase (live). Quota counts are per-device.</span>
              <button onClick={loadAnalytics}
                style={{ marginLeft:'auto', padding:'7px 14px', border:`1px solid ${BORDER}`, borderRadius:'7px', background:'transparent', color:T2, fontFamily:mono, fontSize:'8px', cursor:'pointer' }}>
                ↺ Refresh
              </button>
            </div>
            {loadingStats ? (
              <div style={{ padding:'40px', textAlign:'center', fontFamily:mono, fontSize:'9px', color:T3 }}>Loading…</div>
            ) : (
              <div>
                <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:'10px', marginBottom:'20px' }}>
                  {[
                    { l:'TOTAL FEED ITEMS',   v:totalItems,                                                                         c:BLUE   },
                    { l:'ACTIVE ACCOUNTS',    v:statuses.active,                                                                    c:GREEN  },
                    { l:'AVG ITEMS/ACCOUNT',  v:accounts.length?Math.round(totalItems/Math.max(accounts.length,1)):0,               c:ACC    },
                    { l:'MOST ITEMS',         v:Object.entries(feedStats).sort(([,a],[,b])=>b-a)[0]?.[1]||0,                        c:PURPLE },
                  ].map(k => (
                    <div key={k.l} style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:'10px', padding:'14px 16px' }}>
                      <div style={{ fontFamily:mono, fontSize:'7px', color:T3, letterSpacing:'1px', marginBottom:'5px' }}>{k.l}</div>
                      <div style={{ fontFamily:mono, fontSize:'22px', fontWeight:700, color:k.c }}>{k.v}</div>
                    </div>
                  ))}
                </div>
                <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:'12px', overflow:'hidden' }}>
                  <div style={{ padding:'12px 16px', borderBottom:`1px solid ${BORDER}` }}>
                    <span style={{ fontFamily:mono, fontSize:'9px', color:T1, letterSpacing:'1px' }}>PER-ACCOUNT USAGE</span>
                  </div>
                  <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:mono, fontSize:'9px' }}>
                    <thead>
                      <tr style={{ borderBottom:`1px solid ${BORDER}` }}>
                        {['ACCOUNT','PARTY','FEED ITEMS','SEARCHES','NEWS','YOUTUBE','SOCIAL','TOTAL QUOTA'].map(h => (
                          <th key={h} style={{ padding:'9px 12px', textAlign:'left', color:T3, letterSpacing:'1px', fontWeight:400 }}>{h}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {[...accounts].sort((a,b) => (feedStats[b.id]||0)-(feedStats[a.id]||0)).map(acc => {
                        const q      = getQuota(acc.id, false)
                        const items  = feedStats[acc.id]||0
                        const used   = q.newsUsed+q.youtubeUsed+q.socialUsed
                        const limit  = q.newsLimit+q.youtubeLimit+q.socialLimit
                        const pct    = Math.min(Math.round((used/Math.max(limit,1))*100),100)
                        const qcolor = pct>80?RED:pct>50?YELLOW:GREEN
                        return (
                          <tr key={acc.id} style={{ borderBottom:`1px solid ${BORDER}` }}
                            onMouseEnter={e=>{e.currentTarget.style.background=CARD2}}
                            onMouseLeave={e=>{e.currentTarget.style.background='transparent'}}>
                            <td style={{ padding:'10px 12px' }}>
                              <div style={{ color:T0, fontWeight:600 }}>{acc.politician_name}</div>
                              <div style={{ color:T3, fontSize:'7px', marginTop:'1px' }}>{acc.constituency||acc.state||'National'}</div>
                            </td>
                            <td style={{ padding:'10px 12px', color:ACC }}>{acc.party||'—'}</td>
                            <td style={{ padding:'10px 12px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'6px' }}>
                                <span style={{ color:items>100?GREEN:items>0?T1:T3, fontWeight:items>100?700:400 }}>{items}</span>
                                {items>0 && <div style={{ width:`${Math.min((items/300)*60,60)}px`, height:'3px', background:BLUE, borderRadius:'2px', opacity:0.6 }}/>}
                              </div>
                            </td>
                            <td style={{ padding:'10px 12px' }}><UsageBar used={q.searchesUsed} limit={q.searchesLimit} color={PURPLE}/></td>
                            <td style={{ padding:'10px 12px' }}><UsageBar used={q.newsUsed} limit={q.newsLimit} color={BLUE}/></td>
                            <td style={{ padding:'10px 12px' }}><UsageBar used={q.youtubeUsed} limit={q.youtubeLimit} color={RED}/></td>
                            <td style={{ padding:'10px 12px' }}><UsageBar used={q.socialUsed} limit={q.socialLimit} color='#1d9bf0'/></td>
                            <td style={{ padding:'10px 12px' }}>
                              <div style={{ display:'flex', alignItems:'center', gap:'5px' }}>
                                <div style={{ width:'50px', height:'5px', background:'rgba(255,255,255,0.06)', borderRadius:'3px', overflow:'hidden' }}>
                                  <div style={{ width:`${pct}%`, height:'100%', background:qcolor, borderRadius:'3px' }}/>
                                </div>
                                <span style={{ color:qcolor, fontWeight:700 }}>{pct}%</span>
                              </div>
                            </td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </div>
                <div style={{ marginTop:'10px', padding:'10px 14px', background:CARD2, border:`1px solid ${BORDER}`, borderRadius:'8px', fontFamily:mono, fontSize:'8px', color:T3, lineHeight:1.8 }}>
                  Quota data is stored per-browser (localStorage). It shows 0 for accounts never logged into on this machine.<br/>
                  Feed item counts are accurate — pulled live from Supabase across all devices.
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── SYSTEM CREDS ── */}
        {activeTab==='system' && (
          <div>
            <div style={{ background:RED+'06', border:`1px solid ${RED}20`, borderRadius:'8px', padding:'10px 16px', marginBottom:'14px', fontFamily:mono, fontSize:'8px', color:RED+'cc' }}>
              ⚠ These are hardcoded in source. Changing them requires a redeployment. For regular user accounts use the ACCOUNTS tab.
            </div>
            <div style={{ background:CARD, border:`1px solid ${BORDER}`, borderRadius:'12px', overflow:'hidden' }}>
              <table style={{ width:'100%', borderCollapse:'collapse', fontFamily:mono, fontSize:'9px' }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${BORDER}` }}>
                    {['NAME','EMAIL','PASSWORD','ROLE','TIER'].map(h => (
                      <th key={h} style={{ padding:'10px 14px', textAlign:'left', color:T3, letterSpacing:'1px', fontWeight:400 }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {HARDCODED_CREDS.map(c => (
                    <tr key={c.id} style={{ borderBottom:`1px solid ${BORDER}` }}>
                      <td style={{ padding:'10px 14px', color:T0, fontWeight:600 }}>{c.name}</td>
                      <td style={{ padding:'10px 14px', color:ACC }}>{c.email}</td>
                      <td style={{ padding:'10px 14px', color:GREEN, fontWeight:700 }}>{c.password}</td>
                      <td style={{ padding:'10px 14px' }}>
                        <span style={{ padding:'2px 8px', borderRadius:'20px', background:c.role==='god'?RED+'12':BLUE+'12', color:c.role==='god'?RED:BLUE }}>{c.role.toUpperCase()}</span>
                      </td>
                      <td style={{ padding:'10px 14px', color:YELLOW }}>{c.tier}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {showCreate && <AccountForm onClose={() => setShowCreate(false)} onSave={handleCreate} />}
      {editAccount && (
        <AccountForm account={editAccount} onClose={() => setEditAccount(null)}
          onSave={async (patch, password) => {
            try {
              await updateAccount(user?.id||'', editAccount.id, patch)
              if (password) {
                const email = patch.contact_email||editAccount.contact_email||`${(editAccount.politician_name||'').toLowerCase().replace(/\s+/g,'.')}.${editAccount.id.slice(-4)}@bharatmonitor.in`
                await syncCredentialToSupabase(editAccount.id, email, password, { name:editAccount.politician_name||'', role:'user', tier:'elections' })
                toast.success(`✓ Account + password updated · ${email} / ${password}`, { duration:6000 })
              } else { toast.success('✓ Account updated') }
            } catch (e:any) { toast.error(e.message) }
            setEditAccount(null); refetch()
          }} />
      )}
      {credAccount && (
        <CredentialEditor account={credAccount} onClose={() => setCredAccount(null)}
          onSave={async (email, password, name) => { await handleSaveCred(credAccount, email, password, name); setCredAccount(null) }} />
      )}
    </div>
  )
}
