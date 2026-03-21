import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { useAccount, useUpdateAccount, useRSSFeeds, useTriggerFetch } from '@/hooks/useData'
import { DEMO_ACCOUNT } from '@/lib/mockData'
import AccountForm from '@/components/auth/AccountForm'
import toast from 'react-hot-toast'
import type { Account } from '@/types'

export default function SettingsPage() {
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const { data: account } = useAccount(user?.id || '')
  const { data: rssFeeds } = useRSSFeeds()
  const updateAccount = useUpdateAccount()
  const triggerFetch = useTriggerFetch()
  const [showForm, setShowForm] = useState(false)
  const [activeTab, setActiveTab] = useState<'profile' | 'tracking' | 'feeds' | 'alerts' | 'api'>('profile')

  const acc = account || DEMO_ACCOUNT

  async function handleFetch() {
    toast.loading('Fetching latest data…', { id: 'fetch' })
    try {
      await triggerFetch.mutateAsync({ accountId: acc.id, keywords: acc.keywords })
      toast.success('Feed refreshed', { id: 'fetch' })
    } catch {
      toast.error('Fetch failed', { id: 'fetch' })
    }
  }

  const TABS = [
    { id: 'profile',  label: 'PROFILE' },
    { id: 'tracking', label: 'TRACKING' },
    { id: 'feeds',    label: 'RSS FEEDS' },
    { id: 'alerts',   label: 'ALERTS' },
    { id: 'api',      label: 'API KEYS' },
  ] as const

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Top bar */}
      <div style={{ background: 'var(--s1)', borderBottom: '1px solid var(--b1)', padding: '0 20px', height: '50px', display: 'flex', alignItems: 'center', gap: '12px', position: 'sticky', top: 0, zIndex: 100 }}>
        <button onClick={() => navigate('/dashboard')} style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', letterSpacing: '1px' }}>← DASHBOARD</button>
        <div style={{ width: '1px', height: '16px', background: 'var(--b1)' }} />
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t0)', letterSpacing: '2px' }}>ACCOUNT SETTINGS</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '8px' }}>
          <button className="btn-ghost" onClick={handleFetch} style={{ fontSize: '9px', padding: '5px 12px' }}>
            {triggerFetch.isPending ? '↻ FETCHING…' : '↻ FETCH NOW'}
          </button>
          <button className="btn-primary" onClick={() => setShowForm(true)} style={{ fontSize: '9px', padding: '5px 12px' }}>EDIT PROFILE</button>
        </div>
      </div>

      <div style={{ maxWidth: '900px', margin: '0 auto', padding: '24px 20px' }}>

        {/* Account header card */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '12px', padding: '20px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '12px', background: 'linear-gradient(135deg, var(--acc), var(--blu))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', color: '#fff', flexShrink: 0 }}>{acc.politician_initials}</div>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--t0)' }}>{acc.politician_name}</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: 'var(--t2)', marginTop: '4px' }}>
              {acc.party} · {acc.designation} · {acc.constituency}, {acc.state}
            </div>
          </div>
          <div style={{ display: 'flex', gap: '16px', flexShrink: 0 }}>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', fontWeight: 700, color: 'var(--t0)' }}>{acc.keywords.length}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', marginTop: '2px' }}>KEYWORDS</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', fontWeight: 700, color: 'var(--t0)' }}>{acc.tracked_politicians.length}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', marginTop: '2px' }}>TRACKING</div>
            </div>
            <div style={{ textAlign: 'center' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', fontWeight: 700, color: 'var(--t0)' }}>{acc.languages.length}</div>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', marginTop: '2px' }}>LANGUAGES</div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div style={{ display: 'flex', borderBottom: '1px solid var(--b1)', marginBottom: '20px', gap: 0 }}>
          {TABS.map(t => (
            <button key={t.id} onClick={() => setActiveTab(t.id)} style={{ padding: '8px 16px', border: 'none', background: 'transparent', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', letterSpacing: '1px', cursor: 'pointer', color: activeTab === t.id ? 'var(--t0)' : 'var(--t2)', borderBottom: activeTab === t.id ? '2px solid var(--acc)' : '2px solid transparent', transition: 'all .15s' }}>
              {t.label}
            </button>
          ))}
        </div>

        {/* PROFILE TAB */}
        {activeTab === 'profile' && (
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {[
              ['POLITICIAN NAME', acc.politician_name],
              ['PARTY', acc.party],
              ['DESIGNATION', acc.designation],
              ['SEAT TYPE', acc.constituency_type.replace('_', ' ').toUpperCase()],
              ['CONSTITUENCY', acc.constituency],
              ['STATE', acc.state],
              ['DISTRICT', acc.district || '—'],
              ['CONTACT EMAIL', acc.contact_email || '—'],
            ].map(([label, value]) => (
              <div key={label} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '12px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '5px' }}>{label}</div>
                <div style={{ fontSize: '13px', color: 'var(--t0)', fontWeight: 500 }}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* TRACKING TAB */}
        {activeTab === 'tracking' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <SettingsSection title="KEYWORDS" count={acc.keywords.length}>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {acc.keywords.map(k => (
                  <span key={k} style={{ padding: '3px 9px', borderRadius: '20px', background: '#7c6dfa15', border: '1px solid #7c6dfa25', color: 'var(--acc)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px' }}>{k}</span>
                ))}
              </div>
            </SettingsSection>
            <SettingsSection title="TRACKED POLITICIANS" count={acc.tracked_politicians.length}>
              {acc.tracked_politicians.map(p => (
                <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '8px 0', borderBottom: '1px solid var(--b0)' }}>
                  <div style={{ width: '28px', height: '28px', borderRadius: '7px', background: p.is_competitor ? '#f03e3e12' : '#22d3a012', border: `1px solid ${p.is_competitor ? '#f03e3e20' : '#22d3a020'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: p.is_competitor ? 'var(--red)' : 'var(--grn)', flexShrink: 0 }}>{p.initials}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: '12px', color: 'var(--t0)', fontWeight: 500 }}>{p.name}</div>
                    <div style={{ fontSize: '10px', color: 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace' }}>{p.party} · {p.is_competitor ? 'Competitor' : 'Ally'}</div>
                  </div>
                </div>
              ))}
            </SettingsSection>
            <SettingsSection title="MINISTRIES" count={acc.tracked_ministries.length}>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {acc.tracked_ministries.map(m => (
                  <span key={m} style={{ padding: '3px 9px', borderRadius: '20px', background: 'var(--s3)', border: '1px solid var(--b1)', color: 'var(--t1)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px' }}>{m}</span>
                ))}
              </div>
            </SettingsSection>
            <SettingsSection title="SCHEMES" count={acc.tracked_schemes.length}>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {acc.tracked_schemes.map(s => (
                  <span key={s} style={{ padding: '3px 9px', borderRadius: '20px', background: '#22d3a012', border: '1px solid #22d3a020', color: 'var(--grn)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px' }}>{s}</span>
                ))}
              </div>
            </SettingsSection>
            <SettingsSection title="LANGUAGES" count={acc.languages.length}>
              <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                {acc.languages.map(l => (
                  <span key={l} style={{ padding: '3px 9px', borderRadius: '20px', background: '#3d8ef012', border: '1px solid #3d8ef020', color: 'var(--blu)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', textTransform: 'capitalize' }}>{l}</span>
                ))}
              </div>
            </SettingsSection>
          </div>
        )}

        {/* RSS FEEDS TAB */}
        {activeTab === 'feeds' && (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '10px', overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', borderBottom: '1px solid var(--b1)', display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px' }}>ACTIVE RSS FEEDS</span>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--grn)', background: '#22d3a012', padding: '1px 6px', borderRadius: '3px', border: '1px solid #22d3a020' }}>{rssFeeds?.length || 14} FEEDS</span>
            </div>
            {(rssFeeds?.length ? rssFeeds : DEMO_RSS_FEEDS).map((feed, i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 14px', borderBottom: '1px solid var(--b0)' }}>
                <div style={{ width: '20px', height: '20px', borderRadius: '4px', background: (feed as {tier:number}).tier === 1 ? '#22d3a015' : (feed as {tier:number}).tier === 2 ? '#3d8ef015' : '#f5a62315', border: `1px solid ${(feed as {tier:number}).tier === 1 ? '#22d3a025' : (feed as {tier:number}).tier === 2 ? '#3d8ef025' : '#f5a62325'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: (feed as {tier:number}).tier === 1 ? 'var(--grn)' : (feed as {tier:number}).tier === 2 ? 'var(--blu)' : 'var(--yel)', flexShrink: 0 }}>{(feed as {tier:number}).tier}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '11px', color: 'var(--t0)', fontWeight: 500 }}>{(feed as {name:string}).name}</div>
                  <div style={{ fontSize: '9px', color: 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{(feed as {url:string}).url}</div>
                </div>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', padding: '1px 5px', borderRadius: '3px', background: 'var(--s3)', color: 'var(--t2)', border: '1px solid var(--b1)', flexShrink: 0, textTransform: 'capitalize' }}>{(feed as {language:string}).language}</span>
                <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'var(--grn)', flexShrink: 0 }} />
              </div>
            ))}
          </div>
        )}

        {/* ALERTS TAB */}
        {activeTab === 'alerts' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            {[
              { label: '🔴 CRISIS ALERTS (RED)', desc: 'Live breaking developments', keys: ['red_sms', 'red_push', 'red_email'], labels: ['SMS', 'Push', 'Email'] },
              { label: '🟡 DEVELOPING ALERTS (YELLOW)', desc: 'Building narratives, trending content', keys: ['yellow_push', 'yellow_email'], labels: ['Push', 'Email'] },
            ].map(section => (
              <div key={section.label} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '14px' }}>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: 'var(--t0)', marginBottom: '4px' }}>{section.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--t2)', marginBottom: '12px' }}>{section.desc}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  {section.keys.map((key, i) => {
                    const active = acc.alert_prefs?.[key as keyof typeof acc.alert_prefs]
                    return (
                      <div key={key} style={{ flex: 1, padding: '8px', border: `1px solid ${active ? '#22d3a030' : 'var(--b1)'}`, borderRadius: '6px', background: active ? '#22d3a012' : 'transparent', textAlign: 'center' }}>
                        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: active ? 'var(--grn)' : 'var(--t2)' }}>{section.labels[i]}</div>
                        <div style={{ fontSize: '10px', color: active ? 'var(--grn)' : 'var(--t3)', marginTop: '3px' }}>{active ? '✓ ON' : '○ OFF'}</div>
                      </div>
                    )
                  })}
                </div>
              </div>
            ))}
            <div style={{ padding: '10px 12px', background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '8px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)' }}>Blue and Silver buckets are in-app only. To change alert preferences, use Edit Profile.</div>
            </div>
          </div>
        )}

        {/* API KEYS TAB */}
        {activeTab === 'api' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ padding: '12px', background: '#f5a62310', border: '1px solid #f5a62325', borderRadius: '8px' }}>
              <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--yel)', marginBottom: '5px' }}>API KEYS — SERVER SIDE ONLY</div>
              <div style={{ fontSize: '11px', color: 'var(--t2)', lineHeight: 1.7 }}>API keys are stored as Supabase secrets and never exposed to the browser. Configure them via the Supabase dashboard or CLI.</div>
            </div>
            {[
              { key: 'ANTHROPIC_API_KEY', label: 'Claude API Key', desc: 'Powers contradiction engine + AI brief. Get at console.anthropic.com', required: true },
              { key: 'TWITTER_BEARER_TOKEN', label: 'Twitter/X Bearer Token', desc: 'Required for Twitter keyword tracking + trend detection. Get at developer.twitter.com', required: true },
              { key: 'YOUTUBE_API_KEY', label: 'YouTube Data API v3', desc: 'Required for YouTube video monitoring. Get at console.cloud.google.com', required: true },
              { key: 'UPSTASH_REDIS_REST_URL', label: 'Upstash Redis URL', desc: 'Optional — enables cross-user AI result caching. Get at upstash.com', required: false },
              { key: 'UPSTASH_REDIS_REST_TOKEN', label: 'Upstash Redis Token', desc: 'Paired with Redis URL above', required: false },
            ].map(api => (
              <div key={api.key} style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '12px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '5px' }}>
                  <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: 'var(--t0)' }}>{api.label}</span>
                  {api.required && <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', padding: '1px 4px', borderRadius: '2px', background: '#f03e3e12', color: 'var(--red)', border: '1px solid #f03e3e20' }}>REQUIRED</span>}
                </div>
                <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', marginBottom: '6px' }}>{api.key}</div>
                <div style={{ fontSize: '11px', color: 'var(--t2)', lineHeight: 1.6 }}>{api.desc}</div>
                <div style={{ marginTop: '8px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)' }}>
                  supabase secrets set {api.key}=your-key-here
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {showForm && (
        <AccountForm
          account={acc}
          onClose={() => setShowForm(false)}
          onSave={async (updates) => {
            try {
              await updateAccount.mutateAsync(updates as Partial<Account>)
              toast.success('Account updated')
            } catch { toast.error('Update failed') }
            setShowForm(false)
          }}
        />
      )}
    </div>
  )
}

function SettingsSection({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <div style={{ background: 'var(--s1)', border: '1px solid var(--b1)', borderRadius: '8px', padding: '14px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px' }}>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)', letterSpacing: '1px' }}>{title}</span>
        <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--acc)', background: '#7c6dfa12', padding: '1px 5px', borderRadius: '3px', border: '1px solid #7c6dfa20' }}>{count}</span>
      </div>
      {children}
    </div>
  )
}

const DEMO_RSS_FEEDS = [
  { name: 'NDTV', url: 'https://feeds.feedburner.com/ndtvnews-top-stories', language: 'english', tier: 1 },
  { name: 'The Hindu', url: 'https://www.thehindu.com/feeder/default.rss', language: 'english', tier: 1 },
  { name: 'ANI News', url: 'https://aninews.in/rss/', language: 'english', tier: 1 },
  { name: 'PIB', url: 'https://pib.gov.in/RssMain.aspx', language: 'english', tier: 1 },
  { name: 'Indian Express', url: 'https://indianexpress.com/feed/', language: 'english', tier: 2 },
  { name: 'Manorama Online', url: 'https://www.manoramaonline.com/rss.xml', language: 'malayalam', tier: 2 },
  { name: 'Mathrubhumi', url: 'https://www.mathrubhumi.com/rss/', language: 'malayalam', tier: 2 },
  { name: 'The Wire', url: 'https://thewire.in/rss', language: 'english', tier: 2 },
  { name: 'The Print', url: 'https://theprint.in/feed/', language: 'english', tier: 2 },
  { name: 'Scroll.in', url: 'https://scroll.in/feed', language: 'english', tier: 2 },
  { name: 'NewsMinute', url: 'https://www.thenewsminute.com/rss.xml', language: 'english', tier: 2 },
  { name: 'Dainik Bhaskar', url: 'https://www.bhaskar.com/rss-feed/1061/', language: 'hindi', tier: 1 },
  { name: 'Amar Ujala', url: 'https://www.amarujala.com/rss/breaking-news.xml', language: 'hindi', tier: 2 },
  { name: 'Kerala Kaumudi', url: 'https://www.keralakaumudi.com/rss/', language: 'malayalam', tier: 3 },
]
