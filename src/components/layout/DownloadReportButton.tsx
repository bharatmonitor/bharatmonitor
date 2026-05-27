import { useAccount } from '@/hooks/useData'
import { useAuthStore } from '@/store'
import { supabase } from '@/lib/supabase'

export default function DownloadReportButton() {
  const { data: account } = useAccount()
  const { user } = useAuthStore()

  async function openReport() {
    // Try account from hook first
    let accountId = account?.id || ''

    // If hook hasn't loaded yet, fetch directly from Supabase using user id
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

    // Last resort: check localStorage for cached account id
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
