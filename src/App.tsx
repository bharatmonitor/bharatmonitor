import { useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import { useAuthStore } from '@/store'
import LandingPage  from '@/pages/LandingPage'
import AuthPage     from '@/pages/AuthPage'
import DashboardPage from '@/pages/DashboardPage'
import GodModePage  from '@/pages/GodModePage'
import SettingsPage from '@/pages/SettingsPage'

const qc = new QueryClient({ defaultOptions:{ queries:{ retry:1, refetchOnWindowFocus:false } } })

const IS_DEMO =
  !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL.includes('placeholder') ||
  import.meta.env.VITE_SUPABASE_URL === ''

function AuthGuard({ children }:{ children:React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user) return <Navigate to="/auth" replace />
  return <>{children}</>
}
function GodGuard({ children }:{ children:React.ReactNode }) {
  const { user } = useAuthStore()
  if (!user || user.role !== 'god') return <Navigate to="/dashboard" replace />
  return <>{children}</>
}

export default function App() {
  const { setLoading } = useAuthStore()

  useEffect(() => {
    if (IS_DEMO) { setLoading(false); return }
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data:{ session } }) => {
        if (session?.user) {
          useAuthStore.getState().setUser({
            id: session.user.id, email: session.user.email!,
            role: (session.user.user_metadata?.role || 'user') as 'god'|'admin'|'user',
            created_at: session.user.created_at,
          })
        }
        setLoading(false)
      }).catch(() => setLoading(false))

      const { data:{ subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
        if (session?.user) {
          useAuthStore.getState().setUser({
            id: session.user.id, email: session.user.email!,
            role: (session.user.user_metadata?.role || 'user') as 'god'|'admin'|'user',
            created_at: session.user.created_at,
          })
        } else { useAuthStore.getState().setUser(null) }
      })
      return () => subscription.unsubscribe()
    })
  }, [setLoading])

  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Toaster position="top-right" toastOptions={{ style:{ background:'#0d1018', color:'#edf0f8', border:'1px solid rgba(255,255,255,0.13)', fontFamily:'IBM Plex Mono,monospace', fontSize:'11px' } }}/>
        <Routes>
          <Route path="/"          element={<LandingPage />} />
          <Route path="/auth"      element={<AuthPage />} />
          <Route path="/dashboard" element={<AuthGuard><DashboardPage /></AuthGuard>} />
          <Route path="/settings"  element={<AuthGuard><SettingsPage /></AuthGuard>} />
          <Route path="/god"       element={<GodGuard><GodModePage /></GodGuard>} />
          <Route path="*"          element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
