import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import QuickScan from '@/components/quickscan/QuickScan'
import type { Account } from '@/types'

const mono = '"IBM Plex Mono", monospace'
const CARD  = '#111827'
const CARD2 = '#161d2c'
const BORDER = 'rgba(255,255,255,0.07)'
const ACC   = '#f97316'
const GREEN = '#22d3a0'
const RED   = '#f03e3e'
const YELLOW = '#f5a623'
const BLUE  = '#3d8ef0'
const PURPLE = '#7c6dfa'
const T0    = '#edf0f8'
const T1    = '#c8d0e0'
const T2    = '#8892a4'
const T3    = '#545f78'

export interface KpiData {
  total: number; pos: number; neg: number
  crisis: number; opp: number; sentimentPct: number; negPct: number
}

interface Props {
  account: Account
  kpis?: KpiData
  onSearchClick?: () => void
  onSettingsClick?: () => void
  onAnalyticsClick?: () => void
  onSearchNow?: () => void
  isSearching?: boolean
  fuelLevel?: number
}

export default function CommandBar({
  account, kpis: liveKpis,
  onSearchClick, onSettingsClick, onAnalyticsClick,
  onSearchNow, isSearching, fuelLevel = 100,
}: Props) {
  const [time, setTime] = useState("")
  const { user } = useAuthStore()
  const navigate  = useNavigate()

  useEffect(() => {
    function tick() {
      const ist = new Date(Date.now() + 5.5 * 3_600_000)
      setTime(ist.toISOString().substring(11, 16) + " IST")
    }
    tick()
    const id = setInterval(tick, 30_000)
    return () => clearInterval(id)
  }, [])

  const k = liveKpis || { total:0,pos:0,neg:0,crisis:0,opp:0,sentimentPct:0,negPct:0 }

  const kpiBlocks = [
    {
      value: k.total ? `${k.sentimentPct}%` : "—",
      label: "SENTIMENT",
      sub:   k.total ? `${k.pos}+ ${k.neg}−` : "awaiting",
      color: k.sentimentPct >= 50 ? GREEN : RED,
    },
    {
      value: k.total > 999 ? `${(k.total/1000).toFixed(1)}K` : String(k.total),
      label: "MENTIONS",
      sub:   "LIVE FEED",
      color: T0,
    },
    {
      value: String(k.crisis),
      label: "CRISIS",
      sub:   k.crisis > 0 ? "● ACTIVE" : "○ CLEAR",
      color: k.crisis > 0 ? RED : GREEN,
    },
    {
      value: String(k.opp),
      label: "OPP GAPS",
      sub:   k.opp > 0 ? "● FLAGGED" : "○ NONE",
      color: k.opp > 0 ? YELLOW : GREEN,
    },
    {
      value: k.negPct > 30 ? "HIGH" : k.negPct > 15 ? "MED" : "LOW",
      label: "PRESSURE",
      sub:   k.total ? `${k.negPct}% neg` : "—",
      color: k.negPct > 30 ? RED : k.negPct > 15 ? YELLOW : GREEN,
    },
  ]

  // Fuel bar colour
  const fuelColor = fuelLevel > 60 ? GREEN : fuelLevel > 30 ? YELLOW : RED

  return (
    <div style={{
      background: CARD2,
      borderBottom: `1px solid ${BORDER}`,
      display: "flex",
      alignItems: "stretch",
      height: "58px",
      padding: "0 12px",
      gap: "0",
      overflowX: "auto",
      scrollbarWidth: "none" as const,
    }}>

      {/* ── Politician identity ── */}
      <div style={{ display:"flex", alignItems:"center", gap:"10px", paddingRight:"16px", borderRight:`1px solid ${BORDER}`, flexShrink:0 }}>
        <div style={{
          width:"36px", height:"36px", borderRadius:"9px",
          background:"linear-gradient(135deg, #f97316, #dc2626)",
          display:"flex", alignItems:"center", justifyContent:"center",
          fontFamily:mono, fontSize:"12px", color:"#fff", fontWeight:700, flexShrink:0,
        }}>
          {account?.politician_initials || "??"}
        </div>
        <div style={{ minWidth:0 }}>
          <div style={{ fontSize:"14px", fontWeight:700, color:T0, lineHeight:1.2, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis", maxWidth:"160px" }}>
            {account?.politician_name || "Account"}
          </div>
          <div style={{ fontFamily:mono, fontSize:"8px", color:T2, marginTop:"2px", whiteSpace:"nowrap" }}>
            {(account?.party || "").toUpperCase() || "—"} · {(account?.constituency || "NATIONAL").toUpperCase()}
          </div>
        </div>
        {/* Edit account — prominent */}
        <button
          onClick={onSettingsClick}
          title="Edit account, keywords, watchlist"
          style={{
            display:"flex", alignItems:"center", gap:"5px",
            padding:"5px 10px", borderRadius:"6px",
            border:`1px solid ${BORDER}`,
            background:"rgba(255,255,255,0.04)",
            color:T2, fontFamily:mono, fontSize:"8px",
            cursor:"pointer", transition:"all .15s",
            whiteSpace:"nowrap", height:"26px",
          }}
          onMouseEnter={e=>{e.currentTarget.style.borderColor=PURPLE; e.currentTarget.style.color=PURPLE; e.currentTarget.style.background=`rgba(124,109,250,0.1)`}}
          onMouseLeave={e=>{e.currentTarget.style.borderColor=BORDER; e.currentTarget.style.color=T2; e.currentTarget.style.background="rgba(255,255,255,0.04)"}}>
          ✎ Edit
        </button>
      </div>

      {/* ── KPI blocks ── */}
      <div style={{ display:"flex", flex:1, overflowX:"auto", scrollbarWidth:"none", alignItems:"stretch" }}>
        {kpiBlocks.map(kpi => (
          <div key={kpi.label} style={{
            display:"flex", flexDirection:"column", justifyContent:"center",
            padding:"0 14px", borderRight:`1px solid ${BORDER}`, flexShrink:0,
            minWidth:"72px",
          }}>
            <div style={{ fontFamily:mono, fontSize:"16px", fontWeight:700, lineHeight:1, color:kpi.color }}>{kpi.value}</div>
            <div style={{ fontFamily:mono, fontSize:"7px", color:T3, letterSpacing:"1px", marginTop:"2px" }}>{kpi.label}</div>
            <div style={{ fontFamily:mono, fontSize:"7px", color:kpi.color, marginTop:"1px", opacity:0.8 }}>{kpi.sub}</div>
          </div>
        ))}

        {/* Fuel bar */}
        <div style={{ display:"flex", flexDirection:"column", justifyContent:"center", padding:"0 14px", borderRight:`1px solid ${BORDER}`, flexShrink:0, minWidth:"90px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"4px" }}>
            <span style={{ fontFamily:mono, fontSize:"7px", color:T3, letterSpacing:"1px" }}>FUEL</span>
            <span style={{ fontFamily:mono, fontSize:"8px", color:fuelColor, fontWeight:700 }}>{fuelLevel}%</span>
          </div>
          <div style={{ height:"4px", background:"rgba(255,255,255,0.06)", borderRadius:"2px", overflow:"hidden" }}>
            <div style={{ height:"100%", width:`${fuelLevel}%`, background:fuelColor, borderRadius:"2px", transition:"width .5s ease" }} />
          </div>
          <div style={{ fontFamily:mono, fontSize:"6px", color:T3, marginTop:"3px" }}>daily quota</div>
        </div>
      </div>

      {/* ── Action buttons ── */}
      <div style={{ display:"flex", alignItems:"center", gap:"6px", paddingLeft:"12px", borderLeft:`1px solid ${BORDER}`, flexShrink:0 }}>

        {/* SEARCH NOW — primary action */}
        <button
          onClick={onSearchNow}
          disabled={isSearching}
          style={{
            display:"flex", alignItems:"center", gap:"6px",
            padding:"8px 16px", borderRadius:"8px", height:"36px",
            border:`1px solid ${isSearching ? BORDER : `${PURPLE}60`}`,
            background: isSearching ? "rgba(255,255,255,0.04)" : `rgba(124,109,250,0.12)`,
            color: isSearching ? T3 : PURPLE,
            fontFamily:mono, fontSize:"9px", fontWeight:700,
            cursor: isSearching ? "not-allowed" : "pointer",
            transition:"all .15s", letterSpacing:"0.5px", whiteSpace:"nowrap",
          }}
          onMouseEnter={e=>{if(!isSearching){e.currentTarget.style.background=`rgba(124,109,250,0.22)`}}}
          onMouseLeave={e=>{if(!isSearching){e.currentTarget.style.background=`rgba(124,109,250,0.12)`}}}>
          {isSearching ? "⚙ SCANNING…" : "↺ SCAN"}
        </button>

        {/* ANALYSE */}
        <button
          onClick={() => navigate("/analyse")}
          style={{
            display:"flex", alignItems:"center", gap:"6px",
            padding:"8px 14px", borderRadius:"8px", height:"36px",
            border:`1px solid rgba(34,211,160,0.3)`,
            background:"rgba(34,211,160,0.07)",
            color:GREEN, fontFamily:mono, fontSize:"9px", fontWeight:600,
            cursor:"pointer", transition:"all .15s", whiteSpace:"nowrap",
          }}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(34,211,160,0.15)"}}
          onMouseLeave={e=>{e.currentTarget.style.background="rgba(34,211,160,0.07)"}}>
          ◈ Analyse
        </button>

        {/* CRISIS */}
        <button
          onClick={() => navigate("/crisis")}
          style={{
            display:"flex", alignItems:"center", gap:"6px",
            padding:"8px 14px", borderRadius:"8px", height:"36px",
            border:`1px solid rgba(240,62,62,0.3)`,
            background:k.crisis > 0 ? "rgba(240,62,62,0.15)" : "rgba(240,62,62,0.06)",
            color:RED, fontFamily:mono, fontSize:"9px", fontWeight:k.crisis > 0 ? 700 : 600,
            cursor:"pointer", transition:"all .15s", whiteSpace:"nowrap",
            animation: k.crisis > 2 ? "pulse-btn 1.5s ease-in-out infinite" : "none",
          }}
          onMouseEnter={e=>{e.currentTarget.style.background="rgba(240,62,62,0.2)"}}
          onMouseLeave={e=>{e.currentTarget.style.background=k.crisis>0?"rgba(240,62,62,0.15)":"rgba(240,62,62,0.06)"}}>
          {k.crisis > 0 && <div style={{ width:"6px", height:"6px", borderRadius:"50%", background:RED, animation:"blink 1s ease-in-out infinite", flexShrink:0 }} />}
          ⚡ Crisis
        </button>

        {/* Quick scan */}
        <QuickScan />

        {/* Live time */}
        <div style={{ display:"flex", alignItems:"center", gap:"5px", padding:"0 6px" }}>
          <div style={{ width:"5px", height:"5px", borderRadius:"50%", background:RED, animation:"blink 1.4s ease-in-out infinite" }} />
          <span style={{ fontFamily:mono, fontSize:"8px", color:T2 }}>{time}</span>
        </div>
      </div>

      <style>{`
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0.25} }
        @keyframes pulse-btn { 0%,100%{box-shadow:0 0 0 0 rgba(240,62,62,0.4)} 50%{box-shadow:0 0 0 4px transparent} }
      `}</style>
    </div>
  )
}
