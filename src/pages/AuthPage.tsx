import { useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { validateHardcodedCred } from '@/lib/accounts'
import { supabase } from '@/lib/supabase'
import type { Tier } from '@/lib/tiers'
import toast from 'react-hot-toast'

export default function AuthPage() {
  const { user, setUser, setTier } = useAuthStore()
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  if (user) return <Navigate to="/dashboard" replace />

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      // 1. Try hardcoded credentials first (instant, no network)
      const cred = validateHardcodedCred(email, password)
      if (cred) {
        setUser({ id: cred.id, email: cred.email, role: cred.role, created_at: new Date().toISOString() })
        setTier(cred.tier as Tier)
        toast.success(`Welcome, ${cred.name}`)
        navigate(cred.role === 'god' ? '/god' : '/dashboard')
        return
      }

      // 2. Try Supabase auth for real accounts
      const { data, error: authError } = await supabase.auth.signInWithPassword({ email: email.trim(), password })
      if (authError) {
        setError('Invalid credentials. Check your email and password.')
        return
      }
      if (data?.user) {
        const { data: profile } = await supabase.from('accounts').select('*').eq('user_id', data.user.id).maybeSingle()
        setUser({ id: data.user.id, email: data.user.email || email, role: (profile?.role || 'user'), created_at: data.user.created_at })
        setTier((profile?.tier || 'basic') as Tier)
        toast.success('Logged in successfully')
        navigate('/dashboard')
      }
    } catch (e: any) {
      setError('Login failed. Please try again.')
      console.error('[BM] Login error:', e)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px' }}>
      <div style={{ width: '100%', maxWidth: '380px' }}>
        {/* Logo */}
        <div style={{ textAlign: 'center', marginBottom: '32px' }}>
          <div style={{ width: '52px', height: '52px', borderRadius: '14px', background: 'linear-gradient(135deg, #f97316, #ef4444)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '24px', margin: '0 auto 12px' }}>🇮🇳</div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '18px', color: '#edf0f8', letterSpacing: '2px', fontWeight: 600 }}>
            BHARAT<span style={{ color: '#f97316' }}>MONITOR</span>
          </div>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)', letterSpacing: '2px', marginTop: '4px' }}>POLITICAL INTELLIGENCE PLATFORM</div>
        </div>

        {/* Card */}
        <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '14px', padding: '28px' }}>
          <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px', color: 'var(--t2)', letterSpacing: '2px', marginBottom: '20px' }}>SECURE LOGIN</div>

          <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
            <div className="field-group">
              <label className="field-label">EMAIL</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
              />
            </div>
            <div className="field-group">
              <label className="field-label">PASSWORD</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                required
              />
            </div>

            {error && (
              <div style={{ padding: '10px 12px', background: 'rgba(240,62,62,0.08)', border: '1px solid rgba(240,62,62,0.25)', borderRadius: '6px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--red)' }}>
                ⚠ {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="btn-primary"
              style={{ marginTop: '4px', padding: '12px', fontSize: '10px', letterSpacing: '1px', opacity: loading ? 0.6 : 1 }}
            >
              {loading ? 'AUTHENTICATING…' : '→ ENTER WAR ROOM'}
            </button>
          </form>

          {/* Help link — no credentials shown publicly */}
          <div style={{ marginTop: '20px', padding: '10px 12px', background: 'rgba(249,115,22,0.04)', border: '1px solid rgba(249,115,22,0.12)', borderRadius: '8px', textAlign: 'center' }}>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)', letterSpacing: '0.5px', lineHeight: 1.7 }}>
              Authorised personnel only. For access, contact <br />
              <a href="mailto:ankit@hertzmsc.com" style={{ color: 'var(--acc)', textDecoration: 'none' }}>ankit@hertzmsc.com</a>
            </div>
          </div>
        </div>

        <div style={{ textAlign: 'center', marginTop: '16px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t3)' }}>
          Access restricted. Authorised personnel only.<br />
          <a href="mailto:ankit@hertzmsc.com" style={{ color: 'var(--acc)', textDecoration: 'none' }}>Contact support →</a>
        </div>
      </div>
    </div>
  )
}
