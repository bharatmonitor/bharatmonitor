import { useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { useAuthStore } from '@/store'
import toast from 'react-hot-toast'
import type { UserRole } from '@/types'

const S = {
  bg:'#07090f', s1:'#0d1018', s2:'#121620', s3:'#181d28',
  b0:'rgba(255,255,255,0.04)', b1:'rgba(255,255,255,0.09)', b2:'rgba(255,255,255,0.16)',
  t0:'#edf0f8', t1:'#9aa3b8', t2:'#545f78', t3:'#2e3650',
  grn:'#22d3a0', acc:'#f97316', red:'#f03e3e', blu:'#3d8ef0',
  mono:'"IBM Plex Mono",monospace',
}

const CREDS = [
  { email:'modi@bharatmonitor.in',     password:'modi1234',  role:'user' as UserRole, tier:'elections' as const },
  { email:'rekha@bharatmonitor.in',    password:'rekha1234', role:'user' as UserRole, tier:'advanced'  as const },
  { email:'sushant@bharatmonitor.in',  password:'ss1234',    role:'user' as UserRole, tier:'sushant'   as unknown as 'basic' },
  { email:'railways@bharatmonitor.in', password:'rail1234',  role:'user' as UserRole, tier:'railways'  as unknown as 'elections' },
  { email:'god@bharatmonitor.in',      password:'god1234',   role:'god'  as UserRole, tier:'god'       as const },
]

type Tab = 'signin' | 'signup' | 'request'

export default function AuthPage() {
  const [tab, setTab] = useState<Tab>('signin')
  const navigate = useNavigate()
  const { setUser, setTier } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [form, setForm] = useState({ name:'', email:'', password:'', confirm:'', party:'', constituency:'' })
  const [done, setDone] = useState(false)
  const [req, setReq] = useState({ name:'', email:'', party:'', constituency:'', tier:'basic', message:'' })
  const [reqDone, setReqDone] = useState(false)

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault(); setLoading(true)
    try {
      const cred = CREDS.find(d => d.email===email && d.password===password)
      if (cred) {
        setUser({ id:`${cred.role}-001`, email, role:cred.role, created_at:new Date().toISOString() })
        setTier(cred.tier)
        navigate(cred.role==='god'?'/god':'/dashboard')
        return
      }
      const { supabase } = await import('@/lib/supabase')
      const { data, error } = await supabase.auth.signInWithPassword({ email, password })
      if (error) throw error
      if (data.user) {
        setUser({ id:data.user.id, email:data.user.email!, role:(data.user.user_metadata?.role||'user') as UserRole, created_at:data.user.created_at })
        navigate('/dashboard')
      }
    } catch { toast.error('Incorrect email or password.') }
    finally { setLoading(false) }
  }

  const inp = { width:'100%', padding:'9px 12px', background:S.s2, border:`1px solid ${S.b1}`, borderRadius:7, color:S.t0, fontSize:12, fontFamily:S.mono, outline:'none' } as const

  return (
    <div style={{minHeight:'100vh',background:S.bg,display:'flex',fontFamily:'"Inter",sans-serif',fontSize:13}}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@400;500&family=Inter:wght@400;500;600&display=swap');*{box-sizing:border-box;margin:0;padding:0}input:focus,select:focus,textarea:focus{outline:none;border-color:${S.acc}!important}input::placeholder,textarea::placeholder{color:#545f78}`}</style>

      {/* Left hero */}
      <div style={{flex:1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'60px 48px',background:`radial-gradient(ellipse at 30% 40%,rgba(249,115,22,0.07) 0%,transparent 60%)`,borderRight:`1px solid ${S.b1}`}}>
        <div style={{maxWidth:460}}>
          <Link to="/" style={{display:'flex',alignItems:'center',gap:10,textDecoration:'none',marginBottom:44}}>
            <div style={{width:36,height:36,borderRadius:9,background:'linear-gradient(135deg,#f97316,#ef4444)',display:'flex',alignItems:'center',justifyContent:'center',fontSize:18}}>🇮🇳</div>
            <div>
              <div style={{fontFamily:S.mono,fontSize:13,color:S.t0,letterSpacing:1,fontWeight:500}}>BHARAT<span style={{color:S.acc}}>MONITOR</span></div>
              <div style={{fontFamily:S.mono,fontSize:8,color:S.t3,letterSpacing:2,marginTop:1}}>POLITICAL INTELLIGENCE</div>
            </div>
          </Link>
          <h1 style={{fontSize:32,fontWeight:700,color:S.t0,lineHeight:1.15,marginBottom:14}}>
            Your political<br/><span style={{color:S.acc}}>war room awaits.</span>
          </h1>
          <p style={{fontSize:13,color:S.t2,lineHeight:1.8,marginBottom:28}}>
            Real-time intelligence across 83 Indian publications, Twitter, GDELT and Google News. AI-powered contradiction detection across 5 years of public statements.
          </p>
          <div style={{display:'flex',flexWrap:'wrap',gap:7,marginBottom:32}}>
            {['⚡ Quick Scan','◎ Quote Archive','⊞ Comparison','🔴 Crisis Alerts','◈ AI Daily Brief','🇮🇳 14 Languages','📊 Meta Ad Tracker','🗺️ Constituency Intel'].map(f=>(
              <span key={f} style={{fontSize:11,padding:'4px 10px',borderRadius:20,background:'rgba(249,115,22,0.08)',border:'1px solid rgba(249,115,22,0.2)',color:'#fdba74',fontFamily:S.mono}}>{f}</span>
            ))}
          </div>
          {/* Tier overview */}
          <div style={{display:'flex',flexDirection:'column',gap:6}}>
            {[
              {tier:'Basic',     desc:'MLA, local leader, constituency monitor'},
              {tier:'Advanced',  desc:'State campaign, multi-constituency tracking'},
              {tier:'Elections', desc:'Full war room — PM / CM / national campaign'},
            ].map(t=>(
              <div key={t.tier} style={{display:'flex',alignItems:'center',gap:10,padding:'8px 12px',background:S.s2,border:`1px solid ${S.b1}`,borderRadius:7}}>
                <div style={{fontFamily:S.mono,fontSize:9,color:S.acc,fontWeight:600,minWidth:68}}>{t.tier}</div>
                <div style={{fontSize:11,color:S.t2}}>{t.desc}</div>
                <div style={{marginLeft:'auto',fontFamily:S.mono,fontSize:9,color:S.t3}}>Connect →</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Right auth panel */}
      <div style={{width:440,background:S.s1,display:'flex',flexDirection:'column',justifyContent:'center',padding:'40px 36px',overflowY:'auto'}}>
        <div style={{display:'flex',marginBottom:22,border:`1px solid ${S.b1}`,borderRadius:9,overflow:'hidden'}}>
          {(['signin','signup','request'] as Tab[]).map(t=>(
            <button key={t} onClick={()=>setTab(t)} style={{flex:1,padding:'10px 4px',border:'none',background:tab===t?'rgba(249,115,22,0.12)':'transparent',fontFamily:S.mono,fontSize:8,letterSpacing:0.5,cursor:'pointer',color:tab===t?S.acc:S.t2,borderBottom:tab===t?`2px solid ${S.acc}`:'2px solid transparent',transition:'all .15s'}}>
              {t==='signin'?'SIGN IN':t==='signup'?'SIGN UP':'REQUEST ACCESS'}
            </button>
          ))}
        </div>

        {/* SIGN IN */}
        {tab==='signin'&&(
          <form onSubmit={handleSignIn}>
            <div style={{marginBottom:12}}>
              <label style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,display:'block',marginBottom:5}}>EMAIL</label>
              <input type="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="your@email.com" required style={inp}/>
            </div>
            <div style={{marginBottom:20}}>
              <label style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,display:'block',marginBottom:5}}>PASSWORD</label>
              <input type="password" value={password} onChange={e=>setPassword(e.target.value)} placeholder="••••••••" required style={inp}/>
            </div>
            <button type="submit" disabled={loading} style={{width:'100%',padding:'11px',border:'none',borderRadius:8,background:loading?'rgba(249,115,22,0.4)':S.acc,color:'#fff',fontFamily:S.mono,fontSize:10,letterSpacing:1,cursor:'pointer'}}>
              {loading?'SIGNING IN…':'SIGN IN →'}
            </button>
            <div style={{marginTop:12,textAlign:'center',fontSize:11,color:S.t2}}>
              New? <button type="button" onClick={()=>setTab('signup')} style={{background:'none',border:'none',color:S.acc,cursor:'pointer',fontSize:11}}>Sign up</button>
              {' '}or <button type="button" onClick={()=>setTab('request')} style={{background:'none',border:'none',color:S.acc,cursor:'pointer',fontSize:11}}>request access</button>
            </div>
            <div style={{marginTop:16,textAlign:'center',fontSize:10,color:S.t3,fontFamily:S.mono}}>
              <a href="mailto:ankit@hertzmsc.com" style={{color:S.t2}}>ankit@hertzmsc.com</a> for access issues
            </div>
          </form>
        )}

        {/* SIGN UP */}
        {tab==='signup'&&(
          done?(
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(34,211,160,0.1)',border:'1px solid rgba(34,211,160,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:24}}>✓</div>
              <div style={{fontFamily:S.mono,fontSize:11,color:S.grn,letterSpacing:1,marginBottom:10}}>REQUEST SUBMITTED</div>
              <div style={{fontSize:12,color:S.t2,lineHeight:1.8}}>We'll send credentials to <span style={{color:S.acc}}>{form.email}</span> within 24 hours.</div>
              <button onClick={()=>{setDone(false);setTab('signin')}} style={{marginTop:20,padding:'9px 20px',border:`1px solid ${S.b1}`,borderRadius:7,background:'transparent',color:S.t2,fontFamily:S.mono,fontSize:9,cursor:'pointer'}}>BACK</button>
            </div>
          ):(
            <form onSubmit={async e=>{e.preventDefault();setLoading(true);await new Promise(r=>setTimeout(r,900));setDone(true);setLoading(false)}}>
              <div style={{fontFamily:S.mono,fontSize:8,color:S.t2,lineHeight:1.8,marginBottom:14,padding:'9px',background:'rgba(249,115,22,0.06)',borderRadius:6,border:'1px solid rgba(249,115,22,0.15)'}}>
                Creates a Basic tier account — pending admin approval.
              </div>
              {[
                ['name','YOUR NAME','Full name','text'],
                ['email','EMAIL','your@email.com','email'],
                ['password','PASSWORD','Min. 8 characters','password'],
                ['confirm','CONFIRM PASSWORD','Repeat password','password'],
                ['party','PARTY / ORGANISATION','e.g. BJP, INC, AAP','text'],
                ['constituency','CONSTITUENCY & STATE','e.g. Varanasi, UP','text'],
              ].map(([k,label,ph,type])=>(
                <div key={k} style={{marginBottom:10}}>
                  <label style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,display:'block',marginBottom:5}}>{label}</label>
                  <input type={type} value={(form as any)[k]} onChange={e=>setForm(p=>({...p,[k]:e.target.value}))} placeholder={ph} required={!['party','constituency'].includes(k)} style={inp}/>
                </div>
              ))}
              <button type="submit" disabled={loading} style={{width:'100%',padding:'11px',border:'none',borderRadius:8,background:S.acc,color:'#fff',fontFamily:S.mono,fontSize:10,letterSpacing:1,cursor:'pointer',marginTop:6}}>
                {loading?'CREATING…':'CREATE ACCOUNT →'}
              </button>
            </form>
          )
        )}

        {/* REQUEST ACCESS */}
        {tab==='request'&&(
          reqDone?(
            <div style={{textAlign:'center',padding:'20px 0'}}>
              <div style={{width:52,height:52,borderRadius:'50%',background:'rgba(34,211,160,0.1)',border:'1px solid rgba(34,211,160,0.3)',display:'flex',alignItems:'center',justifyContent:'center',margin:'0 auto 16px',fontSize:24}}>✓</div>
              <div style={{fontFamily:S.mono,fontSize:11,color:S.grn,letterSpacing:1,marginBottom:10}}>REQUEST RECEIVED</div>
              <div style={{fontSize:12,color:S.t2,lineHeight:1.8}}>Our team will contact <span style={{color:S.acc}}>{req.email}</span> within 24 hours.</div>
              <button onClick={()=>{setReqDone(false);setTab('signin')}} style={{marginTop:20,padding:'9px 20px',border:`1px solid ${S.b1}`,borderRadius:7,background:'transparent',color:S.t2,fontFamily:S.mono,fontSize:9,cursor:'pointer'}}>BACK</button>
            </div>
          ):(
            <form onSubmit={async e=>{e.preventDefault();setLoading(true);await new Promise(r=>setTimeout(r,800));setReqDone(true);setLoading(false)}}>
              {[
                ['name','FULL NAME','Your name','text'],
                ['email','EMAIL','your@email.com','email'],
                ['party','PARTY / ORGANISATION','e.g. BJP, INC, AAP','text'],
                ['constituency','CONSTITUENCY & STATE','e.g. Varanasi, UP','text'],
              ].map(([k,label,ph,type])=>(
                <div key={k} style={{marginBottom:10}}>
                  <label style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,display:'block',marginBottom:5}}>{label}</label>
                  <input type={type} value={(req as any)[k]} onChange={e=>setReq(p=>({...p,[k]:e.target.value}))} placeholder={ph} required style={inp}/>
                </div>
              ))}
              <div style={{marginBottom:14}}>
                <label style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,display:'block',marginBottom:5}}>TIER INTEREST</label>
                <select value={req.tier} onChange={e=>setReq(p=>({...p,tier:e.target.value}))} style={{...inp,background:S.s2}}>
                  <option value="basic">Basic — Connect for pricing</option>
                  <option value="advanced">Advanced — Connect for pricing</option>
                  <option value="elections">Elections Monitor — Price on Request</option>
                </select>
              </div>
              <div style={{marginBottom:14}}>
                <label style={{fontFamily:S.mono,fontSize:8,color:S.t2,letterSpacing:1,display:'block',marginBottom:5}}>MESSAGE (OPTIONAL)</label>
                <textarea value={req.message} onChange={e=>setReq(p=>({...p,message:e.target.value}))} placeholder="Any specific requirements, election timeline, geography…" rows={3} style={{...inp,resize:'none'}}/>
              </div>
              <button type="submit" disabled={loading} style={{width:'100%',padding:'11px',border:'none',borderRadius:8,background:S.acc,color:'#fff',fontFamily:S.mono,fontSize:10,letterSpacing:1,cursor:'pointer'}}>
                {loading?'SENDING…':'REQUEST ACCESS →'}
              </button>
              <div style={{marginTop:10,textAlign:'center',fontSize:11,color:S.t2}}>Or email <a href="mailto:ankit@hertzmsc.com" style={{color:S.acc}}>ankit@hertzmsc.com</a></div>
            </form>
          )
        )}
      </div>
    </div>
  )
}
