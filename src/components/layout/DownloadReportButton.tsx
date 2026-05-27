import { useAccount } from '@/hooks/useData'

export default function DownloadReportButton() {
  const { data: account } = useAccount()

  function openReport() {
    const accountId = account?.id || ''
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
