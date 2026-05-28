import { useAccount } from '@/hooks/useData'
import { useAuthStore } from '@/store'

export default function DownloadReportButton() {
  const { data: account } = useAccount()
  const { user } = useAuthStore()

  function openReport() {
    // Priority order for getting accountId:
    // 1. account hook (already loaded)
    // 2. localStorage (set on login in AuthPage)
    // 3. user.id (which equals account_id for hardcoded-cred accounts)
    const accountId = account?.id
      || (typeof localStorage !== 'undefined' ? localStorage.getItem('bm_account_id') || '' : '')
      || user?.id
      || ''

    const url = accountId ? `/report?accountId=${encodeURIComponent(accountId)}` : '/report'
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  return (
    <button
      onClick={openReport}
      title="Open full intelligence report"
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
