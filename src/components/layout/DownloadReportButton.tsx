import { useAccount } from '@/hooks/useData'
import { useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'

export default function DownloadReportButton() {
  const { data: account } = useAccount()
  const { user } = useAuthStore()

  async function openReport() {
    // 1. Best case: account already loaded in hook
    let accountId = account?.id || ''

    // 2. Try fetching by account id directly (user.id IS the account id for hardcoded accounts)
    if (!accountId && user?.id) {
      try {
        const { data } = await supabase
          .from('accounts')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()
        accountId = data?.id || ''
      } catch { /* ignore */ }
    }

    // 3. Try fetching by user_id (for Supabase Auth users)
    if (!accountId && user?.id) {
      try {
        const { data } = await supabase
          .from('accounts')
          .select('id')
          .eq('user_id', user.id)
          .maybeSingle()
        accountId = data?.id || ''
      } catch { /* ignore */ }
    }

    // 4. Try login_email match
    if (!accountId && user?.email) {
      try {
        const { data } = await supabase
          .from('accounts')
          .select('id')
          .eq('login_email', user.email.toLowerCase())
          .maybeSingle()
        accountId = data?.id || ''
      } catch { /* ignore */ }
    }

    // 5. Last resort: localStorage
    if (!accountId) {
      try { accountId = localStorage.getItem('bm_account_id') || '' } catch { /* ignore */ }
    }

    const url = accountId ? `/report?accountId=${accountId}` : '/report'
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      onClick={openReport}
      title="Download full intelligence report as PDF"
      style={{
        display: 'flex', alignItems: 'center', gap: '5px',
        fontFamily: '"IBM Plex Mono", monospace', fontSize: '8px',
        padding: '4px 10px', border: '1px solid rgba(249,115,22,0.35)',
        borderRadius: '5px', background: 'rgba(249,115,22,0.06)',
        color: '#f97316', cursor: 'pointer', letterSpacing: '0.5px',
        fontWeight: 600, transition: 'all .15s', flexShrink: 0,
      }}
      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.14)' }}
      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(249,115,22,0.06)' }}>
      ⬇ REPORT
    </button>
  )
}
