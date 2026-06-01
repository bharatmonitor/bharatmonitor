// ─────────────────────────────────────────────────────────────────────────────
// src/components/charts/BMCharts.tsx  (v2)
// Reusable, props-driven BharatMonitor charts. No fetching, no account logic —
// they consume aggregated data from lib/chartData.ts so they render identically
// for every account across the app.
//
// v2: SentimentArea (stacked), KeywordCloud, IssueOwnershipPie, SchemeBubble.
// ─────────────────────────────────────────────────────────────────────────────
import {
  ResponsiveContainer, PieChart, Pie, Cell, Tooltip, Legend,
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
  ScatterChart, Scatter, ZAxis,
} from 'recharts'
import {
  TOKENS, CLOUD_COLORS,
  type SentimentSlice, type SentimentDayPoint, type CountRow,
  type DivergingRow, type PlatformRow, type CloudWord,
  type SchemeBubblePoint, type IssueOwnership,
} from '../../lib/chartData'

const mono = '"IBM Plex Mono", monospace'
const grid = 'rgba(255,255,255,0.05)'
const axisTick = { fontFamily: mono, fontSize: 9, fill: TOKENS.t2 }
const yTick = { fontFamily: mono, fontSize: 9, fill: TOKENS.t1 }
const tipStyle = {
  background: TOKENS.s1, border: '1px solid rgba(255,255,255,0.12)',
  borderRadius: 8, fontFamily: mono, fontSize: 11, color: TOKENS.t1,
}
const legendStyle = { fontFamily: mono, fontSize: 9.5, color: TOKENS.t2 }

function Empty({ h = 220, label = 'No data yet' }: { h?: number; label?: string }) {
  return (
    <div style={{ height: h, display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: mono, fontSize: 10, color: TOKENS.t3, letterSpacing: 1 }}>{label}</div>
  )
}

// ── 1. Sentiment donut ───────────────────────────────────────────────────────
export function SentimentDonut({ data, height = 230 }: { data: SentimentSlice[]; height?: number }) {
  const total = data.reduce((s, d) => s + d.value, 0)
  if (!total) return <Empty h={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <PieChart>
        <Pie data={data} dataKey="value" nameKey="name" cx="50%" cy="50%"
          innerRadius="60%" outerRadius="85%" paddingAngle={2} stroke={TOKENS.s1} strokeWidth={3}>
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Pie>
        <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v} (${Math.round((v / total) * 100)}%)`, '']} />
        <Legend iconType="circle" wrapperStyle={legendStyle} />
      </PieChart>
    </ResponsiveContainer>
  )
}

// ── 2/7. Conversation volume STACKED by sentiment (#7) ───────────────────────
export function SentimentArea({ data, height = 230 }: { data: SentimentDayPoint[]; height?: number }) {
  if (!data.some((d) => d.positive || d.negative || d.neutral)) return <Empty h={height} />
  const grad = (id: string, color: string) => (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1" key={id}>
      <stop offset="0%" stopColor={color} stopOpacity={0.45} />
      <stop offset="100%" stopColor={color} stopOpacity={0.05} />
    </linearGradient>
  )
  return (
    <ResponsiveContainer width="100%" height={height}>
      <AreaChart data={data} margin={{ top: 8, right: 12, left: -10, bottom: 0 }}>
        <defs>{grad('gPos', TOKENS.grn)}{grad('gNeu', TOKENS.sil)}{grad('gNeg', TOKENS.red)}</defs>
        <CartesianGrid stroke={grid} vertical={false} />
        <XAxis dataKey="label" tick={axisTick} axisLine={false} tickLine={false} interval="preserveStartEnd" minTickGap={24} />
        <YAxis tick={axisTick} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
        <Tooltip contentStyle={tipStyle} />
        <Legend iconType="circle" wrapperStyle={legendStyle} />
        <Area type="monotone" dataKey="positive" name="Positive" stackId="1" stroke={TOKENS.grn} fill="url(#gPos)" strokeWidth={1.5} />
        <Area type="monotone" dataKey="neutral"  name="Neutral"  stackId="1" stroke={TOKENS.sil} fill="url(#gNeu)" strokeWidth={1.5} />
        <Area type="monotone" dataKey="negative" name="Negative" stackId="1" stroke={TOKENS.red} fill="url(#gNeg)" strokeWidth={1.5} />
      </AreaChart>
    </ResponsiveContainer>
  )
}

// ── Shared horizontal-bar primitive (topics / sources) ───────────────────────
function HBar({ data, color, height = 230 }: { data: CountRow[]; color: string; height?: number }) {
  if (!data.length) return <Empty h={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 6, bottom: 4 }}>
        <CartesianGrid stroke={grid} horizontal={false} />
        <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={yTick} axisLine={false} tickLine={false} width={118} />
        <Tooltip contentStyle={tipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="value" fill={color} radius={[0, 3, 3, 0]} barSize={14} />
      </BarChart>
    </ResponsiveContainer>
  )
}
export const TopTopics = ({ data, height }: { data: CountRow[]; height?: number }) => <HBar data={data} color={TOKENS.blu} height={height} />
export const TopSources = ({ data, height }: { data: CountRow[]; height?: number }) => <HBar data={data} color={TOKENS.pur} height={height} />

// ── Platform mix (per-bar colors) ────────────────────────────────────────────
export function PlatformMix({ data, height = 230 }: { data: PlatformRow[]; height?: number }) {
  if (!data.length) return <Empty h={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" margin={{ top: 4, right: 24, left: 6, bottom: 4 }}>
        <CartesianGrid stroke={grid} horizontal={false} />
        <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} allowDecimals={false} />
        <YAxis type="category" dataKey="name" tick={yTick} axisLine={false} tickLine={false} width={92}
          tickFormatter={(v: string) => v.charAt(0).toUpperCase() + v.slice(1)} />
        <Tooltip contentStyle={tipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} barSize={16}>
          {data.map((d) => <Cell key={d.name} fill={d.color} />)}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── Topic helps-vs-hurts (diverging) ─────────────────────────────────────────
export function TopicSentiment({ data, height = 260 }: { data: DivergingRow[]; height?: number }) {
  if (!data.length) return <Empty h={height} />
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} layout="vertical" stackOffset="sign" margin={{ top: 4, right: 16, left: 6, bottom: 4 }}>
        <CartesianGrid stroke={grid} horizontal={false} />
        <XAxis type="number" tick={axisTick} axisLine={false} tickLine={false} tickFormatter={(v: number) => `${Math.abs(v)}`} />
        <YAxis type="category" dataKey="name" tick={yTick} axisLine={false} tickLine={false} width={108} />
        <Tooltip contentStyle={tipStyle} cursor={{ fill: 'rgba(255,255,255,0.03)' }} formatter={(v: number, n: string) => [Math.abs(v), n]} />
        <ReferenceLine x={0} stroke="rgba(255,255,255,0.18)" />
        <Legend iconType="circle" wrapperStyle={legendStyle} />
        <Bar dataKey="negative" name="Negative" stackId="s" fill={TOKENS.red} radius={[3, 0, 0, 3]} barSize={13} />
        <Bar dataKey="positive" name="Positive" stackId="s" fill={TOKENS.grn} radius={[0, 3, 3, 0]} barSize={13} />
      </BarChart>
    </ResponsiveContainer>
  )
}

// ── KEYWORD WORD CLOUD (#1) — dependency-free, sentiment-tinted tag cloud ─────
export function KeywordCloud({ data, height = 230 }: { data: CloudWord[]; height?: number }) {
  if (!data.length) return <Empty h={height} label="Not enough text yet" />
  const max = data[0]?.count || 1
  const min = data[data.length - 1]?.count || 1
  const size = (c: number) => 11 + Math.round(((c - min) / Math.max(max - min, 1)) * 22) // 11–33px
  // Interleave by rank so big words spread out instead of clumping at the start.
  const ordered = [...data].sort((a, b) => (a.text < b.text ? -1 : 1))
  return (
    <div style={{ height, overflow: 'hidden', display: 'flex', flexWrap: 'wrap', alignContent: 'center',
      justifyContent: 'center', gap: '4px 12px', padding: '6px 4px', lineHeight: 1.15 }}>
      {ordered.map((w) => (
        <span key={w.text} title={`${w.text} · ${w.count}`}
          style={{ fontFamily: mono, fontWeight: w.count >= max * 0.6 ? 700 : 500,
            fontSize: size(w.count), color: CLOUD_COLORS[w.sentiment], opacity: 0.55 + (size(w.count) - 11) / 44,
            whiteSpace: 'nowrap' }}>{w.text}</span>
      ))}
    </div>
  )
}

// ── ISSUE OWNERSHIP PIE (#4) — share of voice by party on one issue ──────────
export function IssueOwnershipPie({ data, height = 260 }: { data: IssueOwnership; height?: number }) {
  if (!data || !data.slices.length) return <Empty h={height} label="No party-attributed mentions" />
  const total = data.slices.reduce((s, d) => s + d.mentions, 0)
  return (
    <div>
      <div style={{ fontFamily: mono, fontSize: 9, color: TOKENS.t3, textAlign: 'center', marginBottom: 4 }}>
        ISSUE: {data.issue.toUpperCase()} · {data.total} ITEMS
      </div>
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data.slices} dataKey="mentions" nameKey="party" cx="50%" cy="50%" outerRadius="80%"
            paddingAngle={2} stroke={TOKENS.s1} strokeWidth={3}
            label={(p: any) => `${p.party} ${Math.round((p.mentions / total) * 100)}%`}
            labelLine={false} style={{ fontFamily: mono, fontSize: 9, fill: TOKENS.t1 }}>
            {data.slices.map((d) => <Cell key={d.party} fill={d.color} />)}
          </Pie>
          <Tooltip contentStyle={tipStyle} formatter={(v: number) => [`${v} mentions (${Math.round((v / total) * 100)}%)`, '']} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  )
}

// ── SCHEME BUBBLE (#6) — x: volume, y: sentiment 0–100, size: volume ─────────
export function SchemeBubble({ data, height = 270 }: { data: SchemeBubblePoint[]; height?: number }) {
  if (!data.length) return <Empty h={height} label="No tracked schemes detected" />
  const maxVol = Math.max(...data.map((d) => d.volume), 1)
  return (
    <ResponsiveContainer width="100%" height={height}>
      <ScatterChart margin={{ top: 16, right: 24, left: 6, bottom: 22 }}>
        <CartesianGrid stroke={grid} />
        <XAxis type="number" dataKey="volume" name="Mentions" tick={axisTick} axisLine={false} tickLine={false}
          label={{ value: 'MENTIONS →', position: 'insideBottom', offset: -8, fontFamily: mono, fontSize: 8, fill: TOKENS.t3 }} />
        <YAxis type="number" dataKey="score" name="Sentiment" domain={[0, 100]} tick={axisTick} axisLine={false} tickLine={false}
          label={{ value: 'SENTIMENT', angle: -90, position: 'insideLeft', fontFamily: mono, fontSize: 8, fill: TOKENS.t3 }} />
        <ZAxis type="number" dataKey="volume" range={[120, 120 + (maxVol > 0 ? 900 : 0)]} />
        <ReferenceLine y={50} stroke="rgba(255,255,255,0.15)" strokeDasharray="3 3" />
        <Tooltip contentStyle={tipStyle} cursor={{ strokeDasharray: '3 3' }}
          formatter={(v: number, n: string) => [v, n]}
          labelFormatter={() => ''}
          content={({ payload }: any) => {
            const p = payload?.[0]?.payload; if (!p) return null
            return (
              <div style={{ ...tipStyle, padding: '6px 9px' }}>
                <div style={{ color: p.color, fontWeight: 700 }}>{p.name}</div>
                <div style={{ color: TOKENS.t2 }}>{p.volume} mentions · {p.score}/100</div>
              </div>
            )
          }} />
        <Scatter data={data} fillOpacity={0.7}>
          {data.map((d) => <Cell key={d.name} fill={d.color} stroke={d.color} />)}
        </Scatter>
      </ScatterChart>
    </ResponsiveContainer>
  )
}
