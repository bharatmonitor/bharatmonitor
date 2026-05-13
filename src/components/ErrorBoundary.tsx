import { Component, type ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { error: Error | null }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }
  
  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  render() {
    if (this.state.error) {
      const msg = this.state.error.message
      return (
        <div style={{
          minHeight: '100vh', background: '#07090f',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center',
          fontFamily: '"IBM Plex Mono",monospace', color: '#f2f5ff',
          padding: 40, gap: 16,
        }}>
          <div style={{ fontSize: 11, color: '#f03e3e', letterSpacing: 2 }}>DASHBOARD ERROR</div>
          <div style={{
            maxWidth: 480, padding: '16px 20px', borderRadius: 8,
            background: 'rgba(240,62,62,0.06)', border: '1px solid rgba(240,62,62,0.2)',
            fontSize: 11, color: '#b0bccc', lineHeight: 1.8,
          }}>
            {msg}
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => { window.location.reload() }}
              style={{
                padding: '8px 20px', border: '1px solid rgba(249,115,22,0.4)',
                borderRadius: 6, background: 'transparent',
                color: '#f97316', fontFamily: '"IBM Plex Mono",monospace',
                fontSize: 9, cursor: 'pointer', letterSpacing: 1,
              }}>
              RELOAD PAGE
            </button>
            <button
              onClick={() => {
                // Clear all auth keys to force fresh login
                ['bm-auth-v1','bm-auth-v2','bm-auth-v3','bm-auth-v4','bm-demo-edits-v1'].forEach(k => localStorage.removeItem(k))
                window.location.href = '/auth'
              }}
              style={{
                padding: '8px 20px', border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: 6, background: 'transparent',
                color: '#6a7a94', fontFamily: '"IBM Plex Mono",monospace',
                fontSize: 9, cursor: 'pointer', letterSpacing: 1,
              }}>
              CLEAR SESSION & LOGIN
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
