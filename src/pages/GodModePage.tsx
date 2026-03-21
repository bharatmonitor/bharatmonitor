import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { TIER_CONFIG } from '@/lib/tiers'
import type { Tier } from '@/lib/tiers'
import { DEMO_ACCOUNT } from '@/lib/mockData'

const S = {
  bg:'#07090f',s1:'#0d1018',s2:'#121620',s3:'#181d28',
  b0:'rgba(255,255,255,0.04)',b1:'rgba(255,255,255,0.09)',b2:'rgba(255,255,255,0.16)',
  t0:'#edf0f8',t1:'#9aa3b8',t2:'#545f78',t3:'#2e3650',
  red:'#f03e3e',yel:'#f5a623',blu:'#3d8ef0',grn:'#22d3a0',acc:'#f97316',prp:'#a78bfa',
  mono:'"IBM Plex Mono",monospace',
}

const TIER_COLOR: Record<string,string> = { basic:S.blu, advanced:S.acc, elections:S.red, god:'#9b59b6', demo:S.prp }
const TIER_LABEL: Record<string,string> = { basic:'BASIC', advanced:'ADVANCED', elections:'ELECTIONS', god:'GOD', demo:'DEMO' }

function daysLeft(expiresAt: string) {
  return Math.max(0, Math.ceil((new Date(expiresAt).getTime() - Date.now()) / 86400000))
}
function fmtDate(d: string) {
  return new Date(d).toLocaleDateString('en-IN', { day:'numeric', month:'short', year:'numeric' })
}

const BASE_ACCOUNTS = [
  { ...DEMO_ACCOUNT, id:'acc-1', politician_name:'Narendra Modi',  party:'BJP', constituency:'Varanasi',     state:'Uttar Pradesh', politician_initials:'NM', designation:'Prime Minister of India',  tier:'elections' as Tier, is_active:true, created_at:'2024-01-15T10:00:00Z', account_type:'politician', is_demo:false, expires_at:null as string|null },
  { ...DEMO_ACCOUNT, id:'acc-2', politician_name:'Rekha Gupta',    party:'BJP', constituency:'Shalimar Bagh',state:'Delhi',         politician_initials:'RG', designation:'Chief Minister, Delhi',    tier:'advanced'  as Tier, is_active:true, created_at:'2024-02-01T10:00:00Z', account_type:'politician', is_demo:false, expires_at:null as string|null },
  { ...DEMO_ACCOUNT, id:'acc-3', politician_name:'Sushant Shukla', party:'BJP', constituency:'Raipur West',  state:'Chhattisgarh',  politician_initials:'SS', designation:'MLA, Raipur West CG',     tier:'basic'     as Tier, is_active:true, created_at:'2024-02-10T10:00:00Z', account_type:'politician', is_demo:false, expires_at:null as string|null },
  { ...DEMO_ACCOUNT, id:'acc-4', politician_name:'Indian Railways', party:'GOI', constituency:'National',    state:'National',      politician_initials:'IR', designation:'Ministry of Railways',     tier:'elections' as Tier, is_active:true, created_at:'2024-03-01T10:00:00Z', account_type:'ministry',   is_demo:false, expires_at:null as string|null },
]

const MOCK_REQUESTS = [
  { id:'r1', name:'Priya Sharma',     email:'priya@congress.in', org:'INC', constituency:'Jaipur, Rajasthan', tier_interest:'advanced', status:'pending',  created_at:'2024-03-14T09:00:00Z' },
  { id:'r2', name:'Vikram Patel',     email:'vpatel@bjp.org',    org:'BJP', constituency:'Surat, Gujarat',    tier_interest:'basic',    status:'pending',  created_at:'2024-03-13T14:00:00Z' },
  { id:'r3', name:'Campaign Manager', email:'ops@campaign.in',   org:'TMC', constituency:'Kolkata South, WB', tier_interest:'elections',status:'approved', created_at:'2024-03-10T11:00:00Z' },
]

// Mock analytics — what we capture per user session
const MOCK_ANALYTICS = {
  totalUsers: 12, activeToday: 4, avgSessionMin: 14.3, totalSessions: 287,
  users: [
    { id:'u1', name:'Narendra Modi',  email:'modi@bharatmonitor.in',  role:'elections', lastSeen:'2 min ago',  sessions:48, avgMin:18.2, topFeature:'Quick Scan', device:'Desktop Chrome', location:'New Delhi', actions:['quick_scan×24','export×8','video×12'], alerts:3 },
    { id:'u2', name:'Rekha Gupta',    email:'rekha@bharatmonitor.in', role:'advanced',  lastSeen:'1 hr ago',   sessions:31, avgMin:12.4, topFeature:'AI Brief',   device:'Mobile Safari', location:'New Delhi', actions:['brief_view×18','card_click×44','search×9'], alerts:1 },
    { id:'u3', name:'Sushant Shukla', email:'sushant@bharatmonitor.in',role:'basic',   lastSeen:'3 hrs ago',  sessions:22, avgMin:8.6,  topFeature:'Feed',        device:'Desktop Chrome', location:'Raipur',    actions:['card_click×32','feed_scroll×120'], alerts:0 },
    { id:'u4', name:'Railways Ops',   email:'railways@bharatmonitor.in',role:'elections',lastSeen:'Yesterday',sessions:19, avgMin:22.1, topFeature:'Counter Intel',device:'Desktop Firefox', location:'New Delhi', actions:['counter×15','export×6','scan×8'], alerts:2 },
  ],
  topFeatures: [
    {name:'Quick Scan',    uses:187, pct:65},
    {name:'Feed Cards',    uses:312, pct:100},
    {name:'Export Brief',  uses:89,  pct:28},
    {name:'AI Brief',      uses:142, pct:45},
    {name:'National Pulse',uses:98,  pct:31},
    {name:'Meta Ads',      uses:54,  pct:17},
    {name:'Counter Intel', uses:76,  pct:24},
    {name:'Video Modal',   uses:44,  pct:14},
  ],
  deviceSplit: [{label:'Desktop Chrome',pct:58},{label:'Mobile Safari',pct:22},{label:'Mobile Chrome',pct:12},{label:'Other',pct:8}],
  hourlyActivity: [2,1,0,0,0,3,8,14,18,12,9,11,15,18,16,14,12,18,22,24,19,14,8,4],
}

export default function GodModePage() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [tab, setTab] = useState<'accounts'|'demo'|'requests'|'analytics'|'audit'>('accounts')
  const [accounts, setAccounts] = useState(BASE_ACCOUNTS)
  const [requests, setRequests] = useState(MOCK_REQUESTS)
  const [showForm, setShowForm] = useState(false)
  const [showTierModal, setShowTierModal] = useState<{account: typeof BASE_ACCOUNTS[0]}|null>(null)
  const [selectedUser, setSelectedUser] = useState<typeof MOCK_ANALYTICS.users[0]|null>(null)

  // Demo account form
  const [demoForm, setDemoForm] = useState({
    name:'', email:'', party:'', constituency:'', state:'', tier:'basic' as Tier,
    notes:'', daysLife:15,
  })
  const [demoAccounts, setDemoAccounts] = useState([
    { id:'demo-1', politician_name:'Test Campaign', party:'BJP', constituency:'Mumbai North', state:'Maharashtra', politician_initials:'TC', tier:'advanced' as Tier, is_active:true, is_demo:true, created_at: new Date(Date.now()-8*86400000).toISOString(), expires_at: new Date(Date.now()+7*86400000).toISOString(), email:'demo1@bharatmonitor.in', notes:'Campaign manager trial' },
    { id:'demo-2', politician_name:'Pilot User',    party:'INC', constituency:'Jaipur',       state:'Rajasthan',   politician_initials:'PU', tier:'basic'     as Tier, is_active:true, is_demo:true, created_at: new Date(Date.now()-13*86400000).toISOString(), expires_at: new Date(Date.now()+2*86400000).toISOString(), email:'demo2@bharatmonitor.in', notes:'State leader evaluation' },
    { id:'demo-3', politician_name:'Expired Demo',  party:'AAP', constituency:'Delhi East',   state:'Delhi',       politician_initials:'ED', tier:'basic'     as Tier, is_active:false, is_demo:true, created_at: new Date(Date.now()-20*86400000).toISOString(), expires_at: new Date(Date.now()-5*86400000).toISOString(), email:'demo3@bharatmonitor.in', notes:'Expired — data deletable' },
  ])

  if (!user || user.role !== 'god') { navigate('/'); return null }

  function createDemoAccount() {
    if (!demoForm.name || !demoForm.email) return
    const now = new Date()
    const expires = new Date(now.getTime() + demoForm.daysLife * 86400000)
    const newDemo = {
      id: `demo-${Date.now()}`,
      politician_name: demoForm.name,
      party: demoForm.party,
      constituency: demoForm.constituency,
      state: demoForm.state,
      politician_initials: demoForm.name.split(' ').map((n:string)=>n[0]).slice(0,2).join('').toUpperCase(),
      tier: demoForm.tier,
      is_active: true,
      is_demo: true,
      created_at: now.toISOString(),
      expires_at: expires.toISOString(),
      email: demoForm.email,
      notes: demoForm.notes,
    }
    setDemoAccounts(prev => [newDemo, ...prev])
    setDemoForm({name:'',email:'',party:'',constituency:'',state:'',tier:'basic',notes:'',daysLife:15})
    setShowForm(false)
  }

  function deleteExpiredDemo(id: string) {
    if (!confirm('Permanently delete this demo account and all its data?')) return
    setDemoAccounts(prev => prev.filter(d => d.id !== id))
  }

  function changeTier(accountId: string, newTier: Tier) {
    setAccounts(prev => prev.map(a => a.id === accountId ? {...a, tier: newTier} : a))
    setShowTierModal(null)
  }

  function approveRequest(id: string) {
    setRequests(prev => prev.map(r => r.id===id ? {...r, status:'approved'} : r))
  }

  const inp = {width:'100%',padding:'7px 10px',background:S.s2,border:`1px solid ${S.b1}`,borderRadius:6,color:S.t0,fontSize:11,fontFamily:S.mono,outline:'none'} as const

  const stats = [
    {label:'TOTAL ACCOUNTS',   value:accounts.length+demoAccounts.filter(d=>d.is_active).length, color:S.t0},
    {label:'ACTIVE LIVE',      value:accounts.filter(a=>a.is_active).length,                      color:S.grn},
    {label:'DEMO ACTIVE',      value:demoAccounts.filter(d=>d.is_active).length,                  color:S.prp},
    {label:'DEMO EXPIRING <3D',value:demoAccounts.filter(d=>d.is_active&&daysLeft(d.expires_at)<=3).length, color:S.red},
    {label:'PENDING REQUESTS', value:requests.filter(r=>r.status==='pending').length,              color:S.yel},
    {label:'ELECTIONS TIER',   value:accounts.filter(a=>a.tier==='elections').length,              color:S.red},
  ]

  return (
    <div style={{minHeight:'100vh',background:S.bg,fontFamily:'"Inter",sans-serif',fontSize:13}}>
      {/* Top bar */}
      <div style={{background:S.s1,borderBottom:`1px solid ${S.b1}`,padding:'0 20px',height:52,display:'flex',alignItems:'center',gap:12,position:'sticky',top:0,zIndex:100}}>
        <button onClick={()=>navigate('/dashboard')} style={{background:'none',border:'none',color:S.t2,cursor:'pointer',fontFamily:S.mono,fontSize:9,letterSpacing:1}}>← DASHBOARD</button>
        <div style={{width:1,height:16,background:S.b1}}/>
        <span style={{fontFamily:S.mono,fontSize:10,color:S.t0,letterSpacing:1}}>⬡ <span style={{color:S.red}}>GOD MODE</span></span>
        <div style={{marginLeft:'auto',display:'flex',gap:8}}>
          <button onClick={()=>setShowForm(true)} style={{fontFamily:S.mono,fontSize:9,padding:'5px 14px',border:`1px solid ${S.prp}40`,borderRadius:6,background:`${S.prp}12`,color:S.prp,cursor:'pointer',letterSpacing:1}}>+ DEMO ACCOUNT</button>
          <button onClick={()=>setShowForm(true)} style={{fontFamily:S.mono,fontSize:9,padding:'5px 14px',border:`1px solid ${S.acc}40`,borderRadius:6,background:`${S.acc}12`,color:S.acc,cursor:'pointer',letterSpacing:1}}>+ NEW ACCOUNT</button>
          <button onClick={()=>{logout();navigate('/')}} style={{fontFamily:S.mono,fontSize:9,padding:'5px 10px',border:`1px solid ${S.b1}`,borderRadius:5,background:'transparent',color:S.t2,cursor:'pointer'}}>EXIT</button>
        </div>
      </div>

      <div style={{maxWidth:1100,margin:'0 auto',padding:'24px 20px'}}>
        {/* Stats row */}
        <div style={{display:'grid',gridTemplateColumns:'repeat(6,1fr)',gap:8,marginBottom:20}}>
          {stats.map(s=>(
            <div key={s.label} style={{background:S.s1,border:`1px solid ${S.b1}`,borderRadius:8,padding:'12px 14px'}}>
              <div style={{fontFamily:S.mono,fontSize:20,fontWeight:700,color:s.color}}>{s.value}</div>
              <div style={{fontFamily:S.mono,fontSize:7,color:S.t3,marginTop:3,letterSpacing:0.5}}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* Tabs */}
        <div style={{display:'flex',gap:4,marginBottom:20,borderBottom:`1px solid ${S.b1}`,paddingBottom:0}}>
          {(['accounts','demo','requests','analytics','audit'] as const).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{padding:'8px 16px',border:'none',background:'transparent',fontFamily:S.mono,fontSize:9,cursor:'pointer',color:tab===t?S.acc:S.t2,borderBottom:tab===t?`2px solid ${S.acc}`:'2px solid transparent',letterSpacing:1,transition:'all .15s'}}>
              {t.toUpperCase()}
              {t==='requests'&&requests.filter(r=>r.status==='pending').length>0&&<span style={{marginLeft:5,background:S.yel,color:'#000',borderRadius:8,padding:'0 5px',fontSize:8}}>{requests.filter(r=>r.status==='pending').length}</span>}
            </button>
          ))}
        </div>

        {/* ── LIVE ACCOUNTS ── */}
        {tab==='accounts'&&(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {accounts.map(acc=>(
              <div key={acc.id} style={{background:S.s1,border:`1px solid ${S.b1}`,borderRadius:10,padding:'14px 16px',display:'flex',alignItems:'center',gap:14}}>
                <div style={{width:38,height:38,borderRadius:9,background:`${TIER_COLOR[acc.tier]}18`,border:`1px solid ${TIER_COLOR[acc.tier]}30`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:S.mono,fontSize:11,color:TIER_COLOR[acc.tier],flexShrink:0}}>{acc.politician_initials}</div>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:S.t0}}>{acc.politician_name}</div>
                  <div style={{fontFamily:S.mono,fontSize:8,color:S.t2,marginTop:2}}>{acc.party} · {acc.constituency} · {acc.state}</div>
                </div>
                <span style={{fontFamily:S.mono,fontSize:8,padding:'3px 8px',borderRadius:4,background:`${TIER_COLOR[acc.tier]}18`,color:TIER_COLOR[acc.tier],border:`1px solid ${TIER_COLOR[acc.tier]}30`}}>{TIER_LABEL[acc.tier]}</span>
                <span style={{fontFamily:S.mono,fontSize:8,padding:'3px 8px',borderRadius:4,background:acc.is_active?'rgba(34,211,160,0.1)':'rgba(240,62,62,0.1)',color:acc.is_active?S.grn:S.red,border:`1px solid ${acc.is_active?'rgba(34,211,160,0.25)':'rgba(240,62,62,0.25)'}`}}>{acc.is_active?'ACTIVE':'INACTIVE'}</span>
                <div style={{display:'flex',gap:6}}>
                  <button onClick={()=>setShowTierModal({account:acc})} style={{fontFamily:S.mono,fontSize:8,padding:'4px 10px',border:`1px solid ${S.b1}`,borderRadius:5,background:'transparent',color:S.t1,cursor:'pointer'}}>CHANGE TIER</button>
                  <button onClick={()=>setAccounts(prev=>prev.map(a=>a.id===acc.id?{...a,is_active:!a.is_active}:a))} style={{fontFamily:S.mono,fontSize:8,padding:'4px 10px',border:`1px solid ${S.b1}`,borderRadius:5,background:'transparent',color:acc.is_active?S.red:S.grn,cursor:'pointer'}}>{acc.is_active?'DEACTIVATE':'ACTIVATE'}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── DEMO ACCOUNTS ── */}
        {tab==='demo'&&(
          <div>
            <div style={{padding:'12px 14px',background:'rgba(167,139,250,0.06)',border:'1px solid rgba(167,139,250,0.2)',borderRadius:8,marginBottom:16,fontSize:11,color:S.t1,lineHeight:1.7}}>
              Demo accounts are <strong style={{color:S.prp}}>active for 15 days</strong> from creation. On the last day, all data is <strong style={{color:S.yel}}>downloadable for 3 days</strong>. After that, the account and all data is permanently deleted.
            </div>

            {/* Create demo form */}
            {showForm&&(
              <div style={{background:S.s1,border:`1px solid rgba(167,139,250,0.3)`,borderRadius:10,padding:'16px',marginBottom:16}}>
                <div style={{fontFamily:S.mono,fontSize:9,color:S.prp,letterSpacing:1,marginBottom:12}}>CREATE DEMO ACCOUNT</div>
                <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:10,marginBottom:10}}>
                  {[['name','NAME / POLITICIAN','Full name','text'],['email','LOGIN EMAIL','demo@bharatmonitor.in','email'],['party','PARTY','e.g. BJP, INC','text'],['constituency','CONSTITUENCY','e.g. Mumbai North','text'],['state','STATE','e.g. Maharashtra','text']].map(([k,l,p,t])=>(
                    <div key={k}>
                      <label style={{fontFamily:S.mono,fontSize:7,color:S.t2,letterSpacing:1,display:'block',marginBottom:4}}>{l}</label>
                      <input type={t} value={(demoForm as any)[k]} onChange={e=>setDemoForm(prev=>({...prev,[k]:e.target.value}))} placeholder={p} style={inp}/>
                    </div>
                  ))}
                  <div>
                    <label style={{fontFamily:S.mono,fontSize:7,color:S.t2,letterSpacing:1,display:'block',marginBottom:4}}>TIER</label>
                    <select value={demoForm.tier} onChange={e=>setDemoForm(prev=>({...prev,tier:e.target.value as Tier}))} style={{...inp,background:S.s2}}>
                      <option value="basic">Basic</option>
                      <option value="advanced">Advanced</option>
                      <option value="elections">Elections</option>
                    </select>
                  </div>
                  <div>
                    <label style={{fontFamily:S.mono,fontSize:7,color:S.t2,letterSpacing:1,display:'block',marginBottom:4}}>DEMO LIFE (DAYS)</label>
                    <select value={demoForm.daysLife} onChange={e=>setDemoForm(prev=>({...prev,daysLife:Number(e.target.value)}))} style={{...inp,background:S.s2}}>
                      <option value={7}>7 days</option>
                      <option value={15}>15 days (default)</option>
                      <option value={30}>30 days</option>
                    </select>
                  </div>
                </div>
                <div style={{marginBottom:10}}>
                  <label style={{fontFamily:S.mono,fontSize:7,color:S.t2,letterSpacing:1,display:'block',marginBottom:4}}>INTERNAL NOTES</label>
                  <input value={demoForm.notes} onChange={e=>setDemoForm(prev=>({...prev,notes:e.target.value}))} placeholder="e.g. Campaign manager evaluation, BJP Maharashtra" style={inp}/>
                </div>
                <div style={{display:'flex',gap:8}}>
                  <button onClick={createDemoAccount} style={{padding:'8px 18px',border:'none',borderRadius:7,background:S.prp,color:'#fff',fontFamily:S.mono,fontSize:9,cursor:'pointer',letterSpacing:1}}>CREATE DEMO →</button>
                  <button onClick={()=>setShowForm(false)} style={{padding:'8px 14px',border:`1px solid ${S.b1}`,borderRadius:7,background:'transparent',color:S.t2,fontFamily:S.mono,fontSize:9,cursor:'pointer'}}>CANCEL</button>
                </div>
              </div>
            )}

            {/* Demo account list */}
            <div style={{display:'flex',flexDirection:'column',gap:8}}>
              {demoAccounts.map(d=>{
                const dl = daysLeft(d.expires_at)
                const isExpired = !d.is_active || dl===0
                const isExpiring = d.is_active && dl<=3 && dl>0
                const downloadable = isExpired && daysLeft(new Date(new Date(d.expires_at).getTime()+3*86400000).toISOString()) > 0
                const statusColor = isExpired ? S.red : isExpiring ? S.yel : S.grn
                return (
                  <div key={d.id} style={{background:S.s1,border:`1px solid ${isExpired?'rgba(240,62,62,0.25)':isExpiring?'rgba(245,166,35,0.25)':'rgba(167,139,250,0.2)'}`,borderRadius:10,padding:'14px 16px',display:'flex',alignItems:'center',gap:14}}>
                    <div style={{width:38,height:38,borderRadius:9,background:`${S.prp}18`,border:`1px solid ${S.prp}30`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:S.mono,fontSize:11,color:S.prp,flexShrink:0}}>{d.politician_initials}</div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{display:'flex',alignItems:'center',gap:7,marginBottom:3}}>
                        <span style={{fontSize:13,fontWeight:600,color:S.t0}}>{d.politician_name}</span>
                        <span style={{fontFamily:S.mono,fontSize:7,padding:'1px 5px',borderRadius:3,background:`${S.prp}18`,color:S.prp,border:`1px solid ${S.prp}30`}}>DEMO</span>
                      </div>
                      <div style={{fontFamily:S.mono,fontSize:8,color:S.t2}}>{d.email} · {d.party} · {d.constituency}</div>
                      {d.notes&&<div style={{fontFamily:S.mono,fontSize:7,color:S.t3,marginTop:2}}>{d.notes}</div>}
                    </div>
                    {/* Countdown */}
                    <div style={{textAlign:'center',padding:'6px 12px',background:isExpired?'rgba(240,62,62,0.08)':isExpiring?'rgba(245,166,35,0.08)':'rgba(167,139,250,0.08)',border:`1px solid ${statusColor}30`,borderRadius:7,flexShrink:0}}>
                      <div style={{fontFamily:S.mono,fontSize:16,fontWeight:700,color:statusColor}}>{isExpired?'0':dl}</div>
                      <div style={{fontFamily:S.mono,fontSize:7,color:S.t3}}>DAYS LEFT</div>
                    </div>
                    <div style={{fontFamily:S.mono,fontSize:7,color:S.t3,flexShrink:0,textAlign:'right'}}>
                      <div>Created {fmtDate(d.created_at)}</div>
                      <div style={{marginTop:2}}>Expires {fmtDate(d.expires_at)}</div>
                    </div>
                    <div style={{display:'flex',gap:5,flexShrink:0}}>
                      {downloadable&&<button style={{fontFamily:S.mono,fontSize:7,padding:'4px 9px',border:`1px solid ${S.yel}40`,borderRadius:5,background:`${S.yel}12`,color:S.yel,cursor:'pointer'}}>⬇ EXPORT DATA</button>}
                      {isExpired&&<button onClick={()=>deleteExpiredDemo(d.id)} style={{fontFamily:S.mono,fontSize:7,padding:'4px 9px',border:`1px solid rgba(240,62,62,0.3)`,borderRadius:5,background:'rgba(240,62,62,0.08)',color:S.red,cursor:'pointer'}}>DELETE</button>}
                      {!isExpired&&<button onClick={()=>setDemoAccounts(prev=>prev.map(x=>x.id===d.id?{...x,expires_at:new Date(new Date(x.expires_at).getTime()+7*86400000).toISOString()}:x))} style={{fontFamily:S.mono,fontSize:7,padding:'4px 9px',border:`1px solid ${S.b1}`,borderRadius:5,background:'transparent',color:S.t2,cursor:'pointer'}}>+7 DAYS</button>}
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── ACCESS REQUESTS ── */}
        {tab==='requests'&&(
          <div style={{display:'flex',flexDirection:'column',gap:8}}>
            {requests.map(r=>(
              <div key={r.id} style={{background:S.s1,border:`1px solid ${r.status==='pending'?'rgba(245,166,35,0.25)':S.b1}`,borderRadius:10,padding:'14px 16px',display:'flex',alignItems:'center',gap:14}}>
                <div style={{flex:1,minWidth:0}}>
                  <div style={{fontSize:13,fontWeight:600,color:S.t0,marginBottom:3}}>{r.name}</div>
                  <div style={{fontFamily:S.mono,fontSize:8,color:S.t2}}>{r.email} · {r.org} · {r.constituency}</div>
                  <div style={{fontFamily:S.mono,fontSize:7,color:S.t3,marginTop:2}}>Tier interest: {r.tier_interest} · {fmtDate(r.created_at)}</div>
                </div>
                <span style={{fontFamily:S.mono,fontSize:8,padding:'3px 8px',borderRadius:4,background:r.status==='pending'?'rgba(245,166,35,0.12)':'rgba(34,211,160,0.12)',color:r.status==='pending'?S.yel:S.grn,border:`1px solid ${r.status==='pending'?'rgba(245,166,35,0.3)':'rgba(34,211,160,0.3)'}`}}>{r.status.toUpperCase()}</span>
                {r.status==='pending'&&(
                  <div style={{display:'flex',gap:6}}>
                    <button onClick={()=>approveRequest(r.id)} style={{fontFamily:S.mono,fontSize:8,padding:'5px 12px',border:'none',borderRadius:5,background:S.grn,color:'#000',cursor:'pointer',fontWeight:600}}>APPROVE</button>
                    <button onClick={()=>setRequests(prev=>prev.filter(x=>x.id!==r.id))} style={{fontFamily:S.mono,fontSize:8,padding:'5px 10px',border:`1px solid rgba(240,62,62,0.3)`,borderRadius:5,background:'rgba(240,62,62,0.08)',color:S.red,cursor:'pointer'}}>REJECT</button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* ── USER ANALYTICS ── */}
        {tab==='analytics'&&(
          <div>
            {/* KPI row */}
            <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:8,marginBottom:16}}>
              {[
                {l:'TOTAL USERS',    v:MOCK_ANALYTICS.totalUsers,           c:S.t0},
                {l:'ACTIVE TODAY',   v:MOCK_ANALYTICS.activeToday,          c:S.grn},
                {l:'AVG SESSION',    v:`${MOCK_ANALYTICS.avgSessionMin}min`, c:S.acc},
                {l:'TOTAL SESSIONS', v:MOCK_ANALYTICS.totalSessions,        c:S.blu},
              ].map(k=>(
                <div key={k.l} style={{background:S.s1,border:`1px solid ${S.b1}`,borderRadius:8,padding:'14px 16px'}}>
                  <div style={{fontFamily:S.mono,fontSize:22,fontWeight:700,color:k.c}}>{k.v}</div>
                  <div style={{fontFamily:S.mono,fontSize:7,color:S.t3,marginTop:3,letterSpacing:0.5}}>{k.l}</div>
                </div>
              ))}
            </div>

            <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:12,marginBottom:16}}>
              {/* Feature usage */}
              <div style={{background:S.s1,border:`1px solid ${S.b1}`,borderRadius:10,padding:'14px 16px'}}>
                <div style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,marginBottom:10}}>FEATURE USAGE</div>
                {MOCK_ANALYTICS.topFeatures.map(f=>(
                  <div key={f.name} style={{display:'flex',alignItems:'center',gap:8,marginBottom:6}}>
                    <span style={{fontSize:10,color:S.t1,width:100,flexShrink:0}}>{f.name}</span>
                    <div style={{flex:1,height:6,background:S.s3,borderRadius:3,overflow:'hidden'}}>
                      <div style={{width:`${f.pct}%`,height:'100%',background:S.acc,borderRadius:3,opacity:0.8}}/>
                    </div>
                    <span style={{fontFamily:S.mono,fontSize:8,color:S.t2,minWidth:24,textAlign:'right'}}>{f.uses}</span>
                  </div>
                ))}
              </div>
              {/* Device split + hourly */}
              <div>
                <div style={{background:S.s1,border:`1px solid ${S.b1}`,borderRadius:10,padding:'14px 16px',marginBottom:10}}>
                  <div style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,marginBottom:8}}>DEVICE BREAKDOWN</div>
                  {MOCK_ANALYTICS.deviceSplit.map(d=>(
                    <div key={d.label} style={{display:'flex',alignItems:'center',gap:8,marginBottom:5}}>
                      <span style={{fontSize:10,color:S.t1,flex:1}}>{d.label}</span>
                      <div style={{width:80,height:5,background:S.s3,borderRadius:2,overflow:'hidden'}}>
                        <div style={{width:`${d.pct}%`,height:'100%',background:S.blu,borderRadius:2}}/>
                      </div>
                      <span style={{fontFamily:S.mono,fontSize:8,color:S.t2,minWidth:28,textAlign:'right'}}>{d.pct}%</span>
                    </div>
                  ))}
                </div>
                <div style={{background:S.s1,border:`1px solid ${S.b1}`,borderRadius:10,padding:'14px 16px'}}>
                  <div style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,marginBottom:8}}>HOURLY ACTIVITY (IST)</div>
                  <div style={{display:'flex',gap:2,alignItems:'flex-end',height:50}}>
                    {MOCK_ANALYTICS.hourlyActivity.map((v,i)=>{
                      const maxV = Math.max(...MOCK_ANALYTICS.hourlyActivity)
                      return (
                        <div key={i} title={`${i}:00 — ${v} sessions`} style={{flex:1,height:`${(v/maxV)*100}%`,background:v>15?S.red:v>8?S.acc:S.blu,borderRadius:2,opacity:0.8,minHeight:2}}/>
                      )
                    })}
                  </div>
                  <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontFamily:S.mono,fontSize:7,color:S.t3}}>
                    <span>12am</span><span>6am</span><span>12pm</span><span>6pm</span><span>12am</span>
                  </div>
                </div>
              </div>
            </div>

            {/* Per-user detail */}
            <div style={{background:S.s1,border:`1px solid ${S.b1}`,borderRadius:10,padding:'14px 16px'}}>
              <div style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,marginBottom:10}}>PER USER INTELLIGENCE</div>
              <div style={{display:'flex',flexDirection:'column',gap:6}}>
                {MOCK_ANALYTICS.users.map(u=>(
                  <div key={u.id}>
                    <div onClick={()=>setSelectedUser(selectedUser?.id===u.id?null:u)} style={{display:'flex',alignItems:'center',gap:10,padding:'10px 12px',background:S.s2,border:`1px solid ${selectedUser?.id===u.id?S.acc+'40':S.b1}`,borderRadius:7,cursor:'pointer'}}>
                      <div style={{width:30,height:30,borderRadius:7,background:`${TIER_COLOR[u.role]||S.acc}18`,border:`1px solid ${TIER_COLOR[u.role]||S.acc}30`,display:'flex',alignItems:'center',justifyContent:'center',fontFamily:S.mono,fontSize:8,color:TIER_COLOR[u.role]||S.acc,flexShrink:0}}>{u.name.split(' ').map((n:string)=>n[0]).join('')}</div>
                      <div style={{flex:1}}>
                        <div style={{fontSize:11,fontWeight:600,color:S.t0}}>{u.name}</div>
                        <div style={{fontFamily:S.mono,fontSize:7,color:S.t2,marginTop:1}}>{u.email} · {u.device} · {u.location}</div>
                      </div>
                      <div style={{fontFamily:S.mono,fontSize:8,color:S.t3,textAlign:'right'}}>
                        <div>{u.sessions} sessions · {u.avgMin}min avg</div>
                        <div style={{marginTop:2,color:S.t3}}>Last: {u.lastSeen}</div>
                      </div>
                      <span style={{fontFamily:S.mono,fontSize:7,padding:'2px 6px',borderRadius:3,background:'rgba(249,115,22,0.1)',color:S.acc,flexShrink:0}}>TOP: {u.topFeature}</span>
                    </div>
                    {selectedUser?.id===u.id&&(
                      <div style={{padding:'12px 14px',background:`${S.acc}06`,border:`1px solid ${S.acc}25`,borderTop:'none',borderRadius:'0 0 7px 7px',marginTop:-1}}>
                        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:8}}>
                          <div>
                            <div style={{fontFamily:S.mono,fontSize:7,color:S.t3,marginBottom:4}}>ACTIONS THIS WEEK</div>
                            {u.actions.map((a,i)=><div key={i} style={{fontFamily:S.mono,fontSize:8,color:S.t1,marginBottom:2}}>{a}</div>)}
                          </div>
                          <div>
                            <div style={{fontFamily:S.mono,fontSize:7,color:S.t3,marginBottom:4}}>SESSION DATA</div>
                            <div style={{fontFamily:S.mono,fontSize:8,color:S.t1}}>Total sessions: {u.sessions}</div>
                            <div style={{fontFamily:S.mono,fontSize:8,color:S.t1,marginTop:2}}>Avg duration: {u.avgMin}min</div>
                            <div style={{fontFamily:S.mono,fontSize:8,color:S.t1,marginTop:2}}>Unread alerts: {u.alerts}</div>
                          </div>
                          <div>
                            <div style={{fontFamily:S.mono,fontSize:7,color:S.t3,marginBottom:4}}>ENVIRONMENT</div>
                            <div style={{fontFamily:S.mono,fontSize:8,color:S.t1}}>Device: {u.device}</div>
                            <div style={{fontFamily:S.mono,fontSize:8,color:S.t1,marginTop:2}}>Location: {u.location}</div>
                            <div style={{fontFamily:S.mono,fontSize:8,color:S.t1,marginTop:2}}>Tier: {u.role}</div>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <div style={{marginTop:12,padding:'8px 10px',background:'rgba(45,126,247,0.06)',border:'1px solid rgba(45,126,247,0.15)',borderRadius:6,fontSize:9,color:S.t2,lineHeight:1.6}}>
                <strong style={{color:S.blu}}>Data captured per user session:</strong> Login time · logout time · session duration · pages visited · features used · cards clicked · searches run · exports generated · device type · browser · approximate location (city) · scroll depth · alert interactions · video plays · walkthrough completion. All stored in Supabase audit_log table.
              </div>
            </div>
          </div>
        )}

        {/* ── AUDIT LOG ── */}
        {tab==='audit'&&(
          <div style={{background:S.s1,border:`1px solid ${S.b1}`,borderRadius:10,padding:'16px'}}>
            <div style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,marginBottom:10}}>AUDIT LOG — ALL ACCOUNT ACTIONS</div>
            {[
              {time:'10:14 IST',user:'Narendra Modi',action:'QUICK_SCAN',detail:'Keywords: BJP, Rahul Gandhi, inflation',tier:'elections'},
              {time:'09:58 IST',user:'Rekha Gupta',action:'EXPORT_BRIEF',detail:'30 day brief generated',tier:'advanced'},
              {time:'09:44 IST',user:'Narendra Modi',action:'VIDEO_OPEN',detail:'Video: PM address Varanasi',tier:'elections'},
              {time:'09:31 IST',user:'Railways Ops',action:'COUNTER_INTEL',detail:'Counter viewed: Privatisation claim 96%',tier:'elections'},
              {time:'09:12 IST',user:'Sushant Shukla',action:'LOGIN',detail:'Device: Chrome Desktop · Raipur',tier:'basic'},
              {time:'08:55 IST',user:'Rekha Gupta',action:'LOGIN',detail:'Device: Mobile Safari · Delhi',tier:'advanced'},
              {time:'08:41 IST',user:'Narendra Modi',action:'ALERT_VIEWED',detail:'Red bucket alert: 3 items',tier:'elections'},
              {time:'06:03 IST',user:'SYSTEM',action:'DAILY_BRIEF_SENT',detail:'Brief delivered to 4 accounts',tier:'system'},
            ].map((entry,i)=>(
              <div key={i} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 0',borderBottom:`1px solid ${S.b0}`}}>
                <span style={{fontFamily:S.mono,fontSize:8,color:S.t3,minWidth:60,flexShrink:0}}>{entry.time}</span>
                <span style={{fontFamily:S.mono,fontSize:8,color:S.t2,minWidth:110,flexShrink:0}}>{entry.user}</span>
                <span style={{fontFamily:S.mono,fontSize:8,padding:'1px 6px',borderRadius:3,background:`${TIER_COLOR[entry.tier]||S.t3}18`,color:TIER_COLOR[entry.tier]||S.t3,flexShrink:0}}>{entry.action}</span>
                <span style={{fontSize:10,color:S.t2,flex:1}}>{entry.detail}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Tier change modal */}
      {showTierModal&&(
        <div onClick={e=>{if(e.target===e.currentTarget)setShowTierModal(null)}} style={{position:'fixed',inset:0,background:'rgba(0,0,0,0.85)',zIndex:900,display:'flex',alignItems:'center',justifyContent:'center'}}>
          <div style={{background:S.s1,border:`1px solid ${S.b2}`,borderRadius:12,padding:'20px',minWidth:320,maxWidth:400}}>
            <div style={{fontFamily:S.mono,fontSize:10,color:S.t0,marginBottom:14}}>CHANGE TIER — {showTierModal.account.politician_name}</div>
            {(['basic','advanced','elections'] as Tier[]).map(t=>(
              <button key={t} onClick={()=>changeTier(showTierModal.account.id,t)} style={{display:'block',width:'100%',padding:'10px 14px',marginBottom:7,border:`1px solid ${TIER_COLOR[t]}30`,borderRadius:8,background:showTierModal.account.tier===t?`${TIER_COLOR[t]}18`:'transparent',color:TIER_COLOR[t],fontFamily:S.mono,fontSize:10,cursor:'pointer',textAlign:'left',letterSpacing:1}}>
                {showTierModal.account.tier===t?'✓ ':''}{TIER_LABEL[t]}
              </button>
            ))}
            <button onClick={()=>setShowTierModal(null)} style={{width:'100%',padding:'8px',border:`1px solid ${S.b1}`,borderRadius:7,background:'transparent',color:S.t2,fontFamily:S.mono,fontSize:9,cursor:'pointer',marginTop:4}}>CANCEL</button>
          </div>
        </div>
      )}
    </div>
  )
}
