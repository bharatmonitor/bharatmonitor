import { useParams, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store'
import { useAccount, useFeedItems } from '@/hooks/useData'
import FeedCard from '@/components/feeds/FeedCard'
import NavBar from '@/components/layout/NavBar'
import { useMemo } from 'react'

export default function KeywordStreamPage() {
  const { keyword } = useParams<{ keyword: string }>()
  const navigate = useNavigate()
  const { user } = useAuthStore()
  const { data: account } = useAccount()
  const { data: feed = [], isLoading } = useFeedItems(account?.id || '')

  const decoded = decodeURIComponent(keyword || '')
  const filtered = useMemo(() =>
    feed.filter(item =>
      item.headline?.toLowerCase().includes(decoded.toLowerCase()) ||
      item.source?.toLowerCase().includes(decoded.toLowerCase()) ||
      (item as any).keyword === decoded ||
      item.topic_tags?.some((t: string) => t.toLowerCase().includes(decoded.toLowerCase()))
    ),
    [feed, decoded]
  )

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>
      <NavBar pageLabel={`⚡ ${decoded} (${filtered.length})`} />

      <div style={{ maxWidth: '700px', margin: '0 auto', padding: '20px' }}>
        {isLoading ? (
          <div style={{ textAlign: 'center', padding: '40px', fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)' }}>LOADING…</div>
        ) : filtered.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '40px' }}>
            <div style={{ fontSize: '28px', marginBottom: '12px', opacity: 0.3 }}>◎</div>
            <div style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '9px', color: 'var(--t3)' }}>No items for "{decoded}"</div>
          </div>
        ) : (
          <div style={{ background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '10px', overflow: 'hidden' }}>
            {filtered.map(item => <FeedCard key={item.id} item={item} />)}
          </div>
        )}
      </div>
    </div>
  )
}
