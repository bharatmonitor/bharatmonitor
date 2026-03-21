import {
  BarChart, Bar, XAxis, YAxis, ResponsiveContainer,
  Tooltip, Cell
} from 'recharts'
import type {
  Account, ConstituencyPulse, CompetitorSummary,
  SchemeSentiment, IssueOwnershipPoint
} from '@/types'
import { useDashboardStore } from '@/store'
import { DEMO_AI_BRIEF, DEMO_STATE_VOLUMES } from '@/lib/mockData'

// ─── Section wrapper ──────────────────────────────────────────────────────────
function Section({ title, badge, children }: { title: string; badge?: string; children: React.ReactNode }) {
  return (
    <div style={{ padding: '12px 13px', borderBottom: '1px solid var(--b0)' }}>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', letterSpacing: '2px', marginBottom: '10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        {title}
        {badge && <span style={{ fontSize: '7px', padding: '1px 5px', borderRadius: '2px', background: 'var(--s3)', color: 'var(--t2)', border: '1px solid var(--b1)' }}>{badge}</span>}
      </div>
      {children}
    </div>
  )
}

// ─── AI Analysis ──────────────────────────────────────────────────────────────
function AIAnalysis() {
  const brief = DEMO_AI_BRIEF
  return (
    <Section title="AI ANALYSIS" badge="LIVE">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '7px', marginBottom: '7px' }}>
        {[
          { label: 'SITUATION', text: brief.situation_summary },
          { label: 'PATTERN',   text: brief.pattern_analysis },
        ].map(p => (
          <div key={p.label} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '6px', padding: '8px' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '4px' }}>{p.label}</div>
            <div style={{ fontSize: '10px', color: 'var(--t1)', lineHeight: 1.6 }}>{p.text.substring(0, 110)}…</div>
          </div>
        ))}
      </div>
      <div style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '6px', padding: '8px' }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '6px' }}>NARRATIVE OPPORTUNITIES</div>
        {brief.opportunities.map(opp => (
          <div key={opp.id} style={{ display: 'flex', alignItems: 'flex-start', gap: '5px', padding: '5px 0', borderBottom: '1px solid var(--b0)' }}>
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', padding: '2px 4px', borderRadius: '2px', background: 'rgba(249,115,22,0.12)', color: 'var(--acc)', flexShrink: 0, minWidth: '28px', textAlign: 'center', marginTop: '1px' }}>
              {typeof opp.score === 'number' ? `${opp.score}%` : opp.score}
            </span>
            <div style={{ fontSize: '10px', color: 'var(--t1)', lineHeight: 1.5 }}>
              <span style={{ color: 'var(--t0)' }}>{opp.politician}</span>: {opp.description.substring(0, 80)}
            </div>
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── India Map (pure CSS/SVG — no external libs needed) ───────────────────────
function IndiaMap() {
  const stateData = DEMO_STATE_VOLUMES.slice(0, 12)
  const maxVol = Math.max(...stateData.map(s => s.volume))

  return (
    <Section title="CONVERSATION MAP" badge="INDIA">
      {/* Bar chart as map proxy — clean and reliable */}
      <div style={{ height: '180px', position: 'relative' }}>
        <ResponsiveContainer width="100%" height={180}>
          <BarChart data={stateData} layout="vertical" margin={{ top: 0, right: 30, bottom: 0, left: 52 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#545f78', fontSize: 8 }} axisLine={false} tickLine={false} />
            <YAxis
              dataKey="state_name"
              type="category"
              tick={{ fill: '#9aa3b8', fontSize: 8, fontFamily: 'IBM Plex Mono' }}
              axisLine={false} tickLine={false} width={50}
              tickFormatter={v => v.length > 6 ? v.substring(0, 6) + '…' : v}
            />
            <Tooltip
              contentStyle={{ background: '#121620', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '6px', fontSize: '10px', fontFamily: 'IBM Plex Mono, monospace' }}
              cursor={{ fill: 'rgba(255,255,255,0.03)' }}
              formatter={(val, _name, props) => [`${val}% volume — ${props.payload.top_topic}`, props.payload.state_name]}
            />
            <Bar dataKey="volume" radius={[0, 3, 3, 0]}>
              {stateData.map(s => (
                <Cell
                  key={s.state_name}
                  fill={s.volume >= 80 ? '#f03e3e' : s.volume >= 60 ? '#f5a623' : '#3d8ef0'}
                  fillOpacity={0.75 + (s.volume / maxVol) * 0.25}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <div style={{ display: 'flex', gap: '10px', marginTop: '6px', flexWrap: 'wrap' }}>
        {[{ c: '#f03e3e', l: 'High 80+' }, { c: '#f5a623', l: 'Med 60–79' }, { c: '#3d8ef0', l: 'Low <60' }].map(m => (
          <div key={m.l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '8px', color: 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace' }}>
            <div style={{ width: '6px', height: '6px', borderRadius: '50%', background: m.c }} />{m.l}
          </div>
        ))}
      </div>
    </Section>
  )
}

// ─── Sentiment ────────────────────────────────────────────────────────────────
function SentimentPanel() {
  const sentData = [
    { name: 'Positive', value: 73, color: '#22d3a0' },
    { name: 'Negative', value: 18, color: '#f03e3e' },
    { name: 'Neutral',  value: 9,  color: '#2e3650' },
  ]
  const platforms = [
    { name: 'X/Twitter',   pct: 61, color: '#1d9bf0', delta: '▼ −1%', up: false },
    { name: 'Instagram',   pct: 82, color: '#e1306c', delta: '▲ +4%', up: true  },
    { name: 'Facebook',    pct: 79, color: '#1877f2', delta: '▲ +2%', up: true  },
    { name: 'WhatsApp',    pct: 84, color: '#25d366', delta: '▲ +6%', up: true  },
    { name: 'YouTube',     pct: 77, color: '#ff2020', delta: '▲ +3%', up: true  },
    { name: 'News/RSS',    pct: 58, color: '#8892a4', delta: '▼ −2%', up: false },
  ]

  return (
    <Section title="SENTIMENT" badge="ALL PLATFORMS">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '12px' }}>
        {/* Donut via recharts */}
        <div style={{ width: 78, height: 78, flexShrink: 0, position: 'relative' }}>
          <ResponsiveContainer width={78} height={78}>
            <BarChart data={sentData} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
              <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                {sentData.map(s => <Cell key={s.name} fill={s.color} />)}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)', textAlign: 'center', pointerEvents: 'none' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '14px', fontWeight: 700, color: '#22d3a0', lineHeight: 1 }}>73%</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '6px', color: 'var(--t2)' }}>POS</div>
          </div>
        </div>
        <div style={{ flex: 1 }}>
          {sentData.map(s => (
            <div key={s.name} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
              <span style={{ fontSize: '9px', color: 'var(--t1)', width: '44px', flexShrink: 0 }}>{s.name}</span>
              <div style={{ flex: 1, height: '3px', background: 'var(--s3)', borderRadius: '3px', overflow: 'hidden' }}>
                <div style={{ width: `${s.value}%`, height: '100%', background: s.color, borderRadius: '3px' }} />
              </div>
              <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', minWidth: '22px', textAlign: 'right' }}>{s.value}%</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', color: 'var(--t2)', letterSpacing: '1px', marginBottom: '7px' }}>BY PLATFORM</div>
      {platforms.map(p => (
        <div key={p.name} style={{ display: 'flex', alignItems: 'center', gap: '5px', marginBottom: '5px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', width: '62px', flexShrink: 0 }}>
            <div style={{ width: '4px', height: '4px', borderRadius: '50%', background: p.color, flexShrink: 0 }} />
            <span style={{ fontSize: '9px', color: 'var(--t1)' }}>{p.name}</span>
          </div>
          <div style={{ flex: 1, height: '3px', background: 'var(--s3)', borderRadius: '3px', overflow: 'hidden' }}>
            <div style={{ width: `${p.pct}%`, height: '100%', background: p.color, borderRadius: '3px' }} />
          </div>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', minWidth: '24px', textAlign: 'right' }}>{p.pct}%</span>
          <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', minWidth: '30px', textAlign: 'right', color: p.up ? 'var(--grn)' : 'var(--red)' }}>{p.delta}</span>
        </div>
      ))}
    </Section>
  )
}

// ─── Constituency Pulse ───────────────────────────────────────────────────────
function PulsePanel({ pulse }: { pulse: ConstituencyPulse }) {
  return (
    <Section title="CONSTITUENCY PULSE" badge={pulse.constituency.toUpperCase()}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px' }}>
        {pulse.issues.map(issue => {
          const c = issue.sentiment === 'positive' ? '#22d3a0' : issue.sentiment === 'negative' ? '#f03e3e' : '#3d8ef0'
          return (
            <div key={issue.topic} style={{ background: 'var(--s2)', border: '1px solid var(--b1)', borderRadius: '6px', padding: '7px' }}>
              <div style={{ fontSize: '10px', color: 'var(--t0)', fontWeight: 500, marginBottom: '4px' }}>{issue.topic}</div>
              <div style={{ height: '3px', background: 'var(--s3)', borderRadius: '3px', overflow: 'hidden', marginBottom: '3px' }}>
                <div style={{ width: `${issue.volume_pct}%`, height: '100%', background: c, borderRadius: '3px' }} />
              </div>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t2)' }}>{issue.volume_pct}%</span>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: issue.trend === 'up' ? 'var(--grn)' : issue.trend === 'down' ? 'var(--red)' : 'var(--t3)' }}>
                  {issue.trend === 'up' ? '▲' : issue.trend === 'down' ? '▼' : '—'}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </Section>
  )
}

// ─── Issue Ownership ──────────────────────────────────────────────────────────
function IssueOwnershipPanel({ data }: { data: IssueOwnershipPoint[] }) {
  return (
    <Section title="ISSUE OWNERSHIP" badge="SINCE ELECTION">
      <div style={{ display: 'flex', gap: '10px', marginBottom: '6px' }}>
        {[{ c: '#f97316', l: 'NM / BJP' }, { c: '#3d8ef0', l: 'Opposition' }].map(i => (
          <div key={i.l} style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '8px', color: 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace' }}>
            <div style={{ width: '7px', height: '7px', borderRadius: '1px', background: i.c }} />{i.l}
          </div>
        ))}
      </div>
      <div style={{ height: '130px' }}>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: -20 }} barCategoryGap="20%">
            <XAxis dataKey="month" tick={{ fill: '#545f78', fontSize: 8, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fill: '#545f78', fontSize: 8 }} axisLine={false} tickLine={false} />
            <Tooltip contentStyle={{ background: '#121620', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '6px', fontSize: '10px' }} />
            <Bar dataKey="politician_score" name="NM/BJP"      fill="#f97316" fillOpacity={0.85} radius={[2, 2, 0, 0]} />
            <Bar dataKey="opposition_score" name="Opposition"  fill="#3d8ef0" fillOpacity={0.85} radius={[2, 2, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  )
}

// ─── Competitor Monitor ───────────────────────────────────────────────────────
function CompetitorPanel({ competitors }: { competitors: CompetitorSummary[] }) {
  const STATUS = {
    contradiction: { bg: 'rgba(245,166,35,0.1)', color: '#f5a623', border: 'rgba(245,166,35,0.22)', label: '⚡ CONTRA' },
    rti:           { bg: 'rgba(240,62,62,0.1)',   color: '#f03e3e', border: 'rgba(240,62,62,0.22)',  label: 'RTI'       },
    watch:         { bg: 'rgba(255,255,255,0.04)',color: '#545f78', border: 'rgba(255,255,255,0.1)', label: 'WATCH'     },
    clear:         { bg: 'rgba(34,211,160,0.1)',  color: '#22d3a0', border: 'rgba(34,211,160,0.22)', label: 'CLEAR'     },
  }
  return (
    <Section title="COMPETITOR MONITOR">
      {competitors.map(c => {
        const st = STATUS[c.status]
        return (
          <div key={c.politician.id} style={{ display: 'flex', alignItems: 'center', gap: '7px', padding: '6px 0', borderBottom: '1px solid var(--b0)' }}>
            <div style={{ width: '26px', height: '26px', borderRadius: '6px', background: 'rgba(61,142,240,0.1)', border: '1px solid rgba(61,142,240,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '9px', color: '#3d8ef0', fontFamily: 'IBM Plex Mono, monospace', flexShrink: 0 }}>{c.politician.initials}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '11px', fontWeight: 500, color: 'var(--t0)' }}>{c.politician.name}</div>
              <div style={{ fontSize: '8px', color: 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', marginTop: '1px' }}>
                {c.statements_today} stmts{c.contradictions_flagged > 0 ? ` · ${c.contradictions_flagged} contra` : ''}
              </div>
            </div>
            <span style={{ fontSize: '7px', fontFamily: 'IBM Plex Mono, monospace', padding: '2px 5px', borderRadius: '3px', background: st.bg, color: st.color, border: `1px solid ${st.border}`, whiteSpace: 'nowrap', flexShrink: 0 }}>
              {st.label}{c.latest_contradiction_score && c.status !== 'watch' ? ` ${c.latest_contradiction_score}%` : ''}
            </span>
          </div>
        )
      })}
    </Section>
  )
}

// ─── Scheme Sentiment ─────────────────────────────────────────────────────────
function SchemePanel({ schemes }: { schemes: SchemeSentiment[] }) {
  return (
    <Section title="SCHEME SENTIMENT" badge="NATIONAL">
      <div style={{ height: '130px' }}>
        <ResponsiveContainer width="100%" height={130}>
          <BarChart data={schemes} layout="vertical" margin={{ top: 2, right: 2, bottom: 2, left: 44 }}>
            <XAxis type="number" domain={[0, 100]} tick={{ fill: '#545f78', fontSize: 8 }} axisLine={false} tickLine={false} />
            <YAxis dataKey="scheme_name" type="category" tick={{ fill: '#9aa3b8', fontSize: 9, fontFamily: 'IBM Plex Mono' }} axisLine={false} tickLine={false} width={42} />
            <Tooltip contentStyle={{ background: '#121620', border: '1px solid rgba(255,255,255,0.13)', borderRadius: '6px', fontSize: '10px' }} />
            <Bar dataKey="sentiment_score" radius={[0, 3, 3, 0]}>
              {schemes.map(s => (
                <Cell key={s.scheme_name} fill={s.sentiment_score >= 70 ? '#22d3a0' : s.sentiment_score >= 50 ? '#f97316' : '#f03e3e'} fillOpacity={0.85} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </Section>
  )
}

// ─── Sidebar root ─────────────────────────────────────────────────────────────
interface Props {
  pulse: ConstituencyPulse
  competitors: CompetitorSummary[]
  schemes: SchemeSentiment[]
  issueOwnership: IssueOwnershipPoint[]
  account: Account
}

export default function Sidebar({ pulse, competitors, schemes, issueOwnership }: Props) {
  const { geoScope, setGeoScope } = useDashboardStore()

  return (
    <div style={{ background: 'var(--s1)', display: 'flex', flexDirection: 'column', overflowY: 'auto', scrollbarWidth: 'thin', scrollbarColor: 'rgba(255,255,255,0.1) transparent' }}>

      {/* Geo scope toggle */}
      <div style={{ padding: '7px 12px', borderBottom: '1px solid var(--b0)', display: 'flex', gap: '4px', flexShrink: 0 }}>
        {(['national', 'state', 'constituency'] as const).map(g => (
          <button key={g} onClick={() => setGeoScope(g)} style={{ flex: 1, padding: '4px', border: `1px solid ${geoScope === g ? 'rgba(249,115,22,0.4)' : 'var(--b1)'}`, borderRadius: '4px', background: geoScope === g ? 'rgba(249,115,22,0.1)' : 'transparent', color: geoScope === g ? 'var(--acc)' : 'var(--t2)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', letterSpacing: '0.5px', cursor: 'pointer', transition: 'all .15s', textTransform: 'uppercase' }}>
            {g}
          </button>
        ))}
      </div>

      <AIAnalysis />
      <IndiaMap />
      <SentimentPanel />
      <PulsePanel pulse={pulse} />
      <IssueOwnershipPanel data={issueOwnership} />
      <CompetitorPanel competitors={competitors} />
      <SchemePanel schemes={schemes} />

      <div style={{ padding: '12px 13px', textAlign: 'center', flexShrink: 0 }}>
        <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)', lineHeight: 1.9 }}>
          BharatMonitor · Political Intelligence<br />
          <a href="mailto:ankit@hertzmsc.com" style={{ color: 'var(--acc)' }}>ankit@hertzmsc.com</a>
        </div>
      </div>
    </div>
  )
}
