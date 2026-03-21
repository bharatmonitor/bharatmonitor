import { useState } from 'react'
import type { Account, Language, TrackedPolitician } from '@/types'

const ALL_LANGUAGES: { id: Language; label: string }[] = [
  { id: 'english', label: 'English' }, { id: 'hindi', label: 'Hindi' },
  { id: 'tamil', label: 'Tamil' }, { id: 'telugu', label: 'Telugu' },
  { id: 'bengali', label: 'Bengali' }, { id: 'marathi', label: 'Marathi' },
  { id: 'gujarati', label: 'Gujarati' }, { id: 'kannada', label: 'Kannada' },
  { id: 'malayalam', label: 'Malayalam' }, { id: 'punjabi', label: 'Punjabi' },
  { id: 'odia', label: 'Odia' }, { id: 'urdu', label: 'Urdu' },
  { id: 'assamese', label: 'Assamese' }, { id: 'maithili', label: 'Maithili' },
]

const INDIAN_STATES = ['Andhra Pradesh','Arunachal Pradesh','Assam','Bihar','Chhattisgarh','Goa','Gujarat','Haryana','Himachal Pradesh','Jharkhand','Karnataka','Kerala','Madhya Pradesh','Maharashtra','Manipur','Meghalaya','Mizoram','Nagaland','Odisha','Punjab','Rajasthan','Sikkim','Tamil Nadu','Telangana','Tripura','Uttar Pradesh','Uttarakhand','West Bengal','Delhi','Jammu & Kashmir','Ladakh','Puducherry']

const MINISTRIES = ['Agriculture','Civil Aviation','Commerce & Industry','Communications','Defence','Education','Environment','Finance','Food Processing','Health','Home Affairs','Housing','Information & Broadcasting','Jal Shakti','Labour','Law & Justice','Micro/Small/Medium Enterprises','Petroleum','Power','Railways','Road Transport','Rural Development','Science & Technology','Shipping','Skill Development','Steel','Textiles','Tourism','Tribal Affairs','Women & Child Development','Youth Affairs']

const PARTIES = ['BJP','INC','AAP','DMK','TMC','NCP','Shiv Sena','JD(U)','TRS/BRS','YSR Congress','TDP','BJD','CPI(M)','CPI','SP','BSP','RJD','JMM','NC','PDP','AIMIM']

interface Props {
  account?: Account | null
  onClose: () => void
  onSave: (account: Partial<Account>) => void
}

type Step = 'profile' | 'tracking' | 'geography' | 'alerts' | 'review'
const STEPS: Step[] = ['profile', 'tracking', 'geography', 'alerts', 'review']
const STEP_LABELS = { profile: 'Politician Profile', tracking: 'What to Track', geography: 'Geography Scope', alerts: 'Alert Preferences', review: 'Review & Save' }

export default function AccountForm({ account, onClose, onSave }: Props) {
  const [step, setStep] = useState<Step>('profile')
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState<Partial<Account>>({
    politician_name: account?.politician_name || '',
    politician_initials: account?.politician_initials || '',
    party: account?.party || '',
    designation: account?.designation || '',
    constituency: account?.constituency || '',
    constituency_type: account?.constituency_type || 'lok_sabha',
    state: account?.state || '',
    district: account?.district || '',
    keywords: account?.keywords || [],
    tracked_politicians: account?.tracked_politicians || [],
    tracked_ministries: account?.tracked_ministries || [],
    tracked_parties: account?.tracked_parties || [],
    tracked_schemes: account?.tracked_schemes || [],
    languages: account?.languages || ['english'],
    alert_prefs: account?.alert_prefs || { red_sms: true, red_push: true, red_email: true, yellow_push: true, yellow_email: false },
    contact_email: account?.contact_email || '',
    contact_phone: account?.contact_phone || '',
    is_active: account?.is_active ?? true,
    geo_scope: account?.geo_scope || [],
  })

  const [newKeyword, setNewKeyword] = useState('')
  const [newPolitician, setNewPolitician] = useState({ name: '', party: '', role: '', is_competitor: true })

  function setField<K extends keyof Account>(key: K, value: Account[K]) {
    setForm(f => ({ ...f, [key]: value }))
  }

  function toggleLanguage(lang: Language) {
    const langs = form.languages || []
    setField('languages', langs.includes(lang) ? langs.filter(l => l !== lang) : [...langs, lang])
  }

  function toggleItem<T extends string>(field: 'tracked_ministries' | 'tracked_parties' | 'tracked_schemes', item: T) {
    const arr = (form[field] || []) as T[]
    setField(field, arr.includes(item) ? arr.filter(i => i !== item) : [...arr, item] as unknown as Account[typeof field])
  }

  function addKeyword() {
    if (!newKeyword.trim()) return
    setField('keywords', [...(form.keywords || []), newKeyword.trim()])
    setNewKeyword('')
  }

  function addPolitician() {
    if (!newPolitician.name) return
    const pol: TrackedPolitician = { id: Date.now().toString(), ...newPolitician, initials: newPolitician.name.split(' ').map(w => w[0]).join('').toUpperCase().slice(0, 2) }
    setField('tracked_politicians', [...(form.tracked_politicians || []), pol])
    setNewPolitician({ name: '', party: '', role: '', is_competitor: true })
  }

  async function handleSave() {
    setSaving(true)
    await new Promise(r => setTimeout(r, 800))
    onSave(form)
    setSaving(false)
  }

  const stepIdx = STEPS.indexOf(step)

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 500, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
      <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '14px', width: '100%', maxWidth: '680px', maxHeight: '90vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: '12px', flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', letterSpacing: '2px', color: 'var(--t2)' }}>{account ? 'EDIT ACCOUNT' : 'NEW ACCOUNT'}</div>
            <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--t0)', marginTop: '2px' }}>{STEP_LABELS[step]}</div>
          </div>
          <button onClick={onClose} style={{ marginLeft: 'auto', background: 'var(--s3)', border: '1px solid var(--b1)', color: 'var(--t1)', padding: '4px 10px', borderRadius: '5px', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px' }}>✕ CLOSE</button>
        </div>

        {/* Step bar */}
        <div style={{ display: 'flex', padding: '10px 20px', gap: '6px', borderBottom: '1px solid var(--b1)', flexShrink: 0 }}>
          {STEPS.map((s, i) => (
            <button key={s} onClick={() => setStep(s)} style={{ flex: 1, padding: '5px 4px', borderRadius: '5px', border: '1px solid', borderColor: s === step ? 'var(--acc)' : 'var(--b1)', background: s === step ? '#7c6dfa15' : 'transparent', color: i <= stepIdx ? (s === step ? 'var(--acc)' : 'var(--t1)') : 'var(--t3)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', letterSpacing: '0.5px', cursor: 'pointer', transition: 'all .15s' }}>
              {i + 1}. {s.toUpperCase()}
            </button>
          ))}
        </div>

        {/* Body */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>

          {step === 'profile' && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
              <div className="field-group" style={{ gridColumn: 'span 2' }}>
                <label className="field-label">POLITICIAN FULL NAME *</label>
                <input value={form.politician_name} onChange={e => { setField('politician_name', e.target.value); setField('politician_initials', e.target.value.split(' ').map((w:string) => w[0]).join('').toUpperCase().slice(0, 2)) }} placeholder="e.g. Rahul Gandhi" />
              </div>
              <div className="field-group">
                <label className="field-label">INITIALS</label>
                <input value={form.politician_initials} onChange={e => setField('politician_initials', e.target.value.toUpperCase().slice(0, 2))} placeholder="RG" maxLength={2} />
              </div>
              <div className="field-group">
                <label className="field-label">PARTY *</label>
                <select value={form.party} onChange={e => setField('party', e.target.value)}>
                  <option value="">Select party</option>
                  {PARTIES.map(p => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">DESIGNATION *</label>
                <input value={form.designation} onChange={e => setField('designation', e.target.value)} placeholder="e.g. Member of Parliament" />
              </div>
              <div className="field-group">
                <label className="field-label">SEAT TYPE *</label>
                <select value={form.constituency_type} onChange={e => setField('constituency_type', e.target.value as Account['constituency_type'])}>
                  <option value="lok_sabha">Lok Sabha</option>
                  <option value="vidhan_sabha">Vidhan Sabha</option>
                  <option value="rajya_sabha">Rajya Sabha</option>
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">CONSTITUENCY *</label>
                <input value={form.constituency} onChange={e => setField('constituency', e.target.value)} placeholder="e.g. Wayanad" />
              </div>
              <div className="field-group">
                <label className="field-label">STATE *</label>
                <select value={form.state} onChange={e => setField('state', e.target.value)}>
                  <option value="">Select state</option>
                  {INDIAN_STATES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="field-group">
                <label className="field-label">DISTRICT</label>
                <input value={form.district} onChange={e => setField('district', e.target.value)} placeholder="e.g. Wayanad" />
              </div>
              <div className="field-group">
                <label className="field-label">CONTACT EMAIL</label>
                <input type="email" value={form.contact_email} onChange={e => setField('contact_email', e.target.value)} placeholder="ops@party.com" />
              </div>
              <div className="field-group">
                <label className="field-label">CONTACT PHONE</label>
                <input value={form.contact_phone} onChange={e => setField('contact_phone', e.target.value)} placeholder="+91 98765 43210" />
              </div>
              <div className="field-group" style={{ gridColumn: 'span 2' }}>
                <label className="field-label">ACCOUNT STATUS</label>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {[true, false].map(v => (
                    <button key={String(v)} onClick={() => setField('is_active', v)} style={{ flex: 1, padding: '8px', border: '1px solid', borderRadius: '6px', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', background: form.is_active === v ? (v ? '#22d3a015' : '#f03e3e15') : 'transparent', borderColor: form.is_active === v ? (v ? '#22d3a030' : '#f03e3e30') : 'var(--b1)', color: form.is_active === v ? (v ? 'var(--grn)' : 'var(--red)') : 'var(--t2)', transition: 'all .15s' }}>
                      {v ? 'ACTIVE' : 'INACTIVE'}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 'tracking' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              {/* Keywords */}
              <div>
                <div className="field-label" style={{ marginBottom: '8px' }}>TRACKING KEYWORDS</div>
                <div style={{ display: 'flex', gap: '6px', marginBottom: '8px' }}>
                  <input value={newKeyword} onChange={e => setNewKeyword(e.target.value)} onKeyDown={e => e.key === 'Enter' && addKeyword()} placeholder="Add keyword and press Enter" />
                  <button className="btn-primary" onClick={addKeyword} style={{ padding: '8px 14px', whiteSpace: 'nowrap', fontSize: '9px' }}>ADD</button>
                </div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {(form.keywords || []).map(k => (
                    <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: '5px', padding: '3px 8px', borderRadius: '20px', background: '#7c6dfa15', border: '1px solid #7c6dfa25', color: 'var(--acc)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px' }}>
                      {k}
                      <button onClick={() => setField('keywords', (form.keywords || []).filter(x => x !== k))} style={{ background: 'none', border: 'none', color: 'var(--acc)', cursor: 'pointer', lineHeight: 1, padding: 0 }}>×</button>
                    </span>
                  ))}
                </div>
              </div>

              {/* Tracked Politicians */}
              <div>
                <div className="field-label" style={{ marginBottom: '8px' }}>COMPETITION / TRACKED POLITICIANS</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: '6px', marginBottom: '8px', alignItems: 'start' }}>
                  <input value={newPolitician.name} onChange={e => setNewPolitician(p => ({ ...p, name: e.target.value }))} placeholder="Name" />
                  <input value={newPolitician.party} onChange={e => setNewPolitician(p => ({ ...p, party: e.target.value }))} placeholder="Party" />
                  <select value={newPolitician.is_competitor ? 'competitor' : 'ally'} onChange={e => setNewPolitician(p => ({ ...p, is_competitor: e.target.value === 'competitor' }))}>
                    <option value="competitor">Competitor</option>
                    <option value="ally">Ally</option>
                  </select>
                  <button className="btn-primary" onClick={addPolitician} style={{ padding: '8px 14px', fontSize: '9px' }}>ADD</button>
                </div>
                {(form.tracked_politicians || []).map(pol => (
                  <div key={pol.id} style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '7px 10px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '6px', marginBottom: '5px' }}>
                    <div style={{ width: '24px', height: '24px', borderRadius: '6px', background: pol.is_competitor ? '#f03e3e15' : '#22d3a015', border: `1px solid ${pol.is_competitor ? '#f03e3e25' : '#22d3a025'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: pol.is_competitor ? 'var(--red)' : 'var(--grn)', flexShrink: 0 }}>{pol.initials}</div>
                    <div style={{ flex: 1 }}><div style={{ fontSize: '11px', color: 'var(--t0)' }}>{pol.name}</div><div style={{ fontSize: '9px', color: 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace' }}>{pol.party} · {pol.is_competitor ? 'Competitor' : 'Ally'}</div></div>
                    <button onClick={() => setField('tracked_politicians', (form.tracked_politicians || []).filter(p => p.id !== pol.id))} style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: '14px' }}>×</button>
                  </div>
                ))}
              </div>

              {/* Ministries */}
              <div>
                <div className="field-label" style={{ marginBottom: '8px' }}>MINISTRIES TO TRACK</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {MINISTRIES.map(m => {
                    const active = (form.tracked_ministries || []).includes(m)
                    return <button key={m} onClick={() => toggleItem('tracked_ministries', m)} style={{ padding: '3px 8px', borderRadius: '20px', border: `1px solid ${active ? '#7c6dfa30' : 'var(--b1)'}`, background: active ? '#7c6dfa15' : 'transparent', color: active ? 'var(--acc)' : 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', cursor: 'pointer', transition: 'all .15s' }}>{m}</button>
                  })}
                </div>
              </div>

              {/* Schemes */}
              <div>
                <div className="field-label" style={{ marginBottom: '8px' }}>SCHEMES TO TRACK</div>
                <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                  {['MGNREGA','PM Awas Yojana','Ujjwala Yojana','PM Kisan Samman','PMJAY','Swachh Bharat','Digital India','Make in India','Skill India','Jan Dhan Yojana'].map(s => {
                    const active = (form.tracked_schemes || []).includes(s)
                    return <button key={s} onClick={() => toggleItem('tracked_schemes', s)} style={{ padding: '3px 8px', borderRadius: '20px', border: `1px solid ${active ? '#22d3a030' : 'var(--b1)'}`, background: active ? '#22d3a015' : 'transparent', color: active ? 'var(--grn)' : 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', cursor: 'pointer', transition: 'all .15s' }}>{s}</button>
                  })}
                </div>
              </div>

              {/* Languages */}
              <div>
                <div className="field-label" style={{ marginBottom: '8px' }}>LANGUAGES TO TRACK</div>
                <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                  {ALL_LANGUAGES.map(l => {
                    const active = (form.languages || []).includes(l.id)
                    return <button key={l.id} onClick={() => toggleLanguage(l.id)} style={{ padding: '4px 10px', borderRadius: '20px', border: `1px solid ${active ? '#3d8ef030' : 'var(--b1)'}`, background: active ? '#3d8ef015' : 'transparent', color: active ? 'var(--blu)' : 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', cursor: 'pointer', transition: 'all .15s' }}>{l.label}</button>
                  })}
                </div>
              </div>
            </div>
          )}

          {step === 'geography' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ padding: '12px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '8px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', marginBottom: '8px' }}>The dashboard will show data filtered to these geographic scopes. Select all that apply.</div>
              </div>
              {[
                { level: 'national', label: 'NATIONAL', desc: 'All-India coverage — full national conversation' },
                { level: 'state', label: 'STATE LEVEL', desc: `${form.state || 'Your state'} — state-level conversations and news` },
                { level: 'constituency', label: 'CONSTITUENCY', desc: `${form.constituency || 'Your constituency'} — hyper-local coverage` },
              ].map(({ level, label, desc }) => {
                const active = (form.geo_scope || []).some(g => g.level === level)
                return (
                  <div key={level} onClick={() => {
                    const scope = form.geo_scope || []
                    setField('geo_scope', active ? scope.filter(g => g.level !== level) : [...scope, { level: level as 'national' | 'state' | 'constituency', name: level === 'national' ? 'India' : level === 'state' ? (form.state || '') : (form.constituency || ''), state: form.state }])
                  }} style={{ padding: '14px', background: active ? '#7c6dfa10' : 'var(--s2)', border: `1px solid ${active ? '#7c6dfa30' : 'var(--b1)'}`, borderRadius: '8px', cursor: 'pointer', transition: 'all .15s', display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div style={{ width: '18px', height: '18px', borderRadius: '50%', border: `2px solid ${active ? 'var(--acc)' : 'var(--b2)'}`, background: active ? 'var(--acc)' : 'transparent', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                      {active && <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#fff' }} />}
                    </div>
                    <div>
                      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: active ? 'var(--acc)' : 'var(--t1)', letterSpacing: '1px', marginBottom: '3px' }}>{label}</div>
                      <div style={{ fontSize: '11px', color: 'var(--t2)' }}>{desc}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {step === 'alerts' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              {[
                { bucket: 'red', label: '🔴 CRISIS ALERTS', desc: 'Live breaking developments, protest surges, coordinated campaigns', fields: [['red_sms','SMS'],['red_push','Push'],['red_email','Email']] as const },
                { bucket: 'yellow', label: '🟡 DEVELOPING ALERTS', desc: 'Building narratives, trending content, media cycle shifts', fields: [['yellow_push','Push'],['yellow_email','Email']] as const },
              ].map(({ bucket, label, desc, fields }) => (
                <div key={bucket} style={{ padding: '14px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '8px' }}>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: 'var(--t0)', marginBottom: '4px' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--t2)', marginBottom: '12px' }}>{desc}</div>
                  <div style={{ display: 'flex', gap: '8px' }}>
                    {fields.map(([key, label]) => {
                      const active = form.alert_prefs?.[key as keyof typeof form.alert_prefs]
                      return <button key={key} onClick={() => setField('alert_prefs', { ...form.alert_prefs!, [key]: !active })} style={{ flex: 1, padding: '8px', border: `1px solid ${active ? '#22d3a030' : 'var(--b1)'}`, borderRadius: '6px', background: active ? '#22d3a015' : 'transparent', color: active ? 'var(--grn)' : 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', cursor: 'pointer', transition: 'all .15s' }}>{label} {active ? '✓' : '○'}</button>
                    })}
                  </div>
                </div>
              ))}
              <div style={{ padding: '12px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '8px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)' }}>Blue and Silver buckets are in-app only — no external notifications.</div>
              </div>
            </div>
          )}

          {step === 'review' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {[
                { label: 'POLITICIAN', value: `${form.politician_name} (${form.politician_initials}) · ${form.party}` },
                { label: 'ROLE', value: `${form.designation} · ${form.constituency_type?.replace('_',' ').toUpperCase()}` },
                { label: 'CONSTITUENCY', value: `${form.constituency}, ${form.state}` },
                { label: 'KEYWORDS', value: (form.keywords || []).join(', ') || 'None' },
                { label: 'TRACKING', value: `${form.tracked_politicians?.length || 0} politicians · ${form.tracked_ministries?.length || 0} ministries · ${form.tracked_schemes?.length || 0} schemes` },
                { label: 'LANGUAGES', value: (form.languages || []).join(', ') },
                { label: 'GEO SCOPE', value: (form.geo_scope || []).map(g => g.level).join(' + ') || 'None selected' },
                { label: 'CONTACT', value: form.contact_email || 'Not set' },
              ].map(({ label, value }) => (
                <div key={label} style={{ display: 'flex', gap: '10px', padding: '10px 12px', background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '6px' }}>
                  <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', width: '100px', flexShrink: 0, marginTop: '1px' }}>{label}</div>
                  <div style={{ fontSize: '11px', color: 'var(--t0)', flex: 1 }}>{value}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ padding: '14px 20px', borderTop: '1px solid var(--b1)', display: 'flex', gap: '8px', flexShrink: 0 }}>
          {stepIdx > 0 && <button className="btn-ghost" onClick={() => setStep(STEPS[stepIdx - 1])} style={{ fontSize: '9px' }}>← BACK</button>}
          <div style={{ flex: 1 }} />
          {stepIdx < STEPS.length - 1
            ? <button className="btn-primary" onClick={() => setStep(STEPS[stepIdx + 1])} style={{ fontSize: '9px' }}>NEXT: {STEP_LABELS[STEPS[stepIdx + 1]].toUpperCase()} →</button>
            : <button className="btn-primary" onClick={handleSave} disabled={saving} style={{ fontSize: '9px' }}>{saving ? 'SAVING...' : '✓ SAVE ACCOUNT'}</button>
          }
        </div>
      </div>
    </div>
  )
}
