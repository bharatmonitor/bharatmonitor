import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
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
import PoliticalTrendsPage from '@/pages/PoliticalTrendsPage'
import NarrativeGapsPage   from '@/pages/NarrativeGapsPage'
import DataTablePage       from '@/pages/DataTablePage'
import AudiencePage        from '@/pages/AudiencePage'

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
          <Route path="/settings"          element={<AuthGuard><SettingsPage /></AuthGuard>} />
          <Route path="/report" element={<ReportPage />} />
            <Route path="/trends"            element={<AuthGuard><PoliticalTrendsPage /></AuthGuard>} />
          <Route path="/content"           element={<AuthGuard><NarrativeGapsPage /></AuthGuard>} />
          <Route path="/keywords/:keyword" element={<AuthGuard><KeywordStreamPage /></AuthGuard>} />
          <Route path="/data"              element={<AuthGuard><DataTablePage /></AuthGuard>} />
          <Route path="/audience"          element={<AuthGuard><AudiencePage /></AuthGuard>} />
          <Route path="/god"               element={<GodGuard><GodModePage /></GodGuard>} />
          <Route path="*"                  element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
