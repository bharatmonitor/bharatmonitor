import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store'
import { HARDCODED_CREDS } from '@/lib/accounts'
import LandingPage         from '@/pages/LandingPage'
import AuthPage            from '@/pages/AuthPage'
import DashboardPage       from '@/pages/DashboardPage'
import GodModePage         from '@/pages/GodModePage'
import SettingsPage        from '@/pages/SettingsPage'
import KeywordStreamPage   from '@/pages/KeywordStreamPage'
import ReportPage from '@/pages/ReportPage'
import TrackPage from '@/pages/TrackPage'
import IntelligencePage from '@/pages/IntelligencePage'
import PoliticalTrendsPage from '@/pages/PoliticalTrendsPage'
import NarrativeGapsPage   from '@/pages/NarrativeGapsPage'
import DataTablePage       from '@/pages/DataTablePage'
import AudiencePage        from '@/pages/AudiencePage'
import AnalysePage         from '@/pages/AnalysePage'
import NationalDiscoursePage from '@/pages/NationalDiscoursePage'
import CrisisEarlyWarningPage  from '@/pages/CrisisEarlyWarningPage'
import OppositionResearchPage  from '@/pages/OppositionResearchPage'

// Floating logout — always visible on every page when logged in
function GlobalLogoutButton() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  if (!user) return null
  return (
    <button
      onClick={() => { logout(); navigate('/') }}
      style={{
        position: 'fixed',
        bottom: '20px',
        right: '20px',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: '7px',
        padding: '10px 18px',
        background: 'rgba(13,16,24,0.95)',
        border: '1.5px solid rgba(240,62,62,0.6)',
        borderRadius: '50px',
        color: '#f03e3e',
        fontFamily: '"IBM Plex Mono", monospace',
        fontSize: '10px',
        fontWeight: 700,
        cursor: 'pointer',
        backdropFilter: 'blur(8px)',
        boxShadow: '0 4px 20px rgba(240,62,62,0.2)',
        transition: 'all .15s',
        letterSpacing: '0.5px',
      }}
      onMouseEnter={e => {
        e.currentTarget.style.background = 'rgba(240,62,62,0.15)'
        e.currentTarget.style.borderColor = '#f03e3e'
        e.currentTarget.style.boxShadow = '0 4px 24px rgba(240,62,62,0.4)'
      }}
      onMouseLeave={e => {
        e.currentTarget.style.background = 'rgba(13,16,24,0.95)'
        e.currentTarget.style.borderColor = 'rgba(240,62,62,0.6)'
        e.currentTarget.style.boxShadow = '0 4px 20px rgba(240,62,62,0.2)'
      }}
    >
      <span style={{ fontSize: '13px' }}>⏻</span>
      Logout
    </button>
  )
}

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } }
})

function AuthGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}

function GodGuard({ children }: { children: React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user || user.role !== 'god') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const { user, logout } = useAuthStore()

  useEffect(() => {
    // On mount: validate user.id is a known 16-digit ID
    if (!user) return
    const knownIds = new Set(HARDCODED_CREDS.map(c => c.id))
    const isHardcoded = knownIds.has(user.id)
    const isNumeric16 = /^\d{16}$/.test(user.id)
    if (!isHardcoded && !isNumeric16) {
      console.log('[BM] Clearing stale session:', user.id)
      logout()
    }
  }, []) // eslint-disable-line

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style: { background:'#0d1018', color:'#f2f5ff', border:'1px solid rgba(255,255,255,0.13)', fontFamily:'IBM Plex Mono,monospace', fontSize:'11px' } }} />
        <Routes>
          <Route path="/"                  element={<LandingPage />} />
          <Route path="/auth"              element={<AuthPage />} />
          <Route path="/dashboard"         element={<AuthGuard><DashboardPage /></AuthGuard>} />
          <Route path="/analyse"           element={<AuthGuard><AnalysePage /></AuthGuard>} />
          <Route path="/national"          element={<AuthGuard><NationalDiscoursePage /></AuthGuard>} />
          <Route path="/crisis"            element={<AuthGuard><CrisisEarlyWarningPage /></AuthGuard>} />
          <Route path="/research"          element={<AuthGuard><OppositionResearchPage /></AuthGuard>} />
          <Route path="/settings"          element={<AuthGuard><SettingsPage /></AuthGuard>} />
          <Route path="/report" element={<ReportPage />} />
            <Route path="/track" element={<AuthGuard><TrackPage /></AuthGuard>} />
            <Route path="/intelligence" element={<IntelligencePage />} />
            <Route path="/trends"            element={<AuthGuard><PoliticalTrendsPage /></AuthGuard>} />
          <Route path="/content"           element={<AuthGuard><NarrativeGapsPage /></AuthGuard>} />
          <Route path="/keywords/:keyword" element={<AuthGuard><KeywordStreamPage /></AuthGuard>} />
          <Route path="/data"              element={<AuthGuard><DataTablePage /></AuthGuard>} />
          <Route path="/audience"          element={<AuthGuard><AudiencePage /></AuthGuard>} />
          <Route path="/god"               element={<GodGuard><GodModePage /></GodGuard>} />
          <Route path="*"                  element={<Navigate to="/" replace />} />
        </Routes>
      <GlobalLogoutButton />
      </BrowserRouter>
    </QueryClientProvider>
  )
}
