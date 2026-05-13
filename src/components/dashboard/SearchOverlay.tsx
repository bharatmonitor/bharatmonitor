import { useState, useEffect, useRef } from 'react'
import { useAccount, useSearch } from '@/hooks/useData'
import FeedCard from '@/components/feeds/FeedCard'


interface Props {
  onClose: () => void
}

export default function SearchOverlay({ onClose }: Props) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)
  const { data: account } = useAccount()
  const accountId = account?.id || ''
  const { data: results = [], isLoading } = useSearch(accountId, query)

  useEffect(() => {
    inputRef.current?.focus()
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const BUCKET_COLORS = { red: '#f03e3e', yellow: '#f5a623', blue: '#3d8ef0', silver: '#8892a4' }

  return (
    <div
      onClick={e => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', zIndex: 998, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '60px 20px 20px' }}>
      <div style={{ width: '100%', maxWidth: '680px', background: 'var(--s1)', border: '1px solid var(--b2)', borderRadius: '12px', overflow: 'hidden' }}>

        {/* Search input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', padding: '14px 16px', borderBottom: '1px solid var(--b1)' }}>
          <span style={{ color: 'var(--t2)', fontSize: '16px', flexShrink: 0 }}>⌕</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search headlines, sources, topics, locations…"
            style={{ flex: 1, background: 'transparent', border: 'none', color: 'var(--t0)', fontSize: '14px', outline: 'none', padding: 0 }}
          />
          {query && <button onClick={() => setQuery('')} style={{ background: 'none', border: 'none', color: 'var(--t2)', cursor: 'pointer', fontSize: '14px', padding: 0 }}>×</button>}
          <button onClick={onClose} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', background: 'var(--s3)', border: '1px solid var(--b1)', color: 'var(--t2)', padding: '3px 8px', borderRadius: '4px', cursor: 'pointer', flexShrink: 0 }}>ESC</button>
        </div>

        {/* Results */}
        <div style={{ maxHeight: '60vh', overflowY: 'auto' }}>
          {query.length <= 2 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--t3)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px' }}>
              TYPE 3+ CHARACTERS TO SEARCH
            </div>
          ) : isLoading ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--t3)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px' }}>
              SEARCHING…
            </div>
          ) : results.length === 0 ? (
            <div style={{ padding: '30px', textAlign: 'center', color: 'var(--t3)', fontFamily: 'IBM Plex Mono, monospace', fontSize: '10px' }}>
              NO RESULTS FOR "{query.toUpperCase()}"
            </div>
          ) : (
            <>
              <div style={{ padding: '8px 16px', background: 'var(--s2)', borderBottom: '1px solid var(--b0)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '8px', color: 'var(--t2)' }}>{results.length} RESULTS</span>
                <div style={{ display: 'flex', gap: '5px', marginLeft: 'auto' }}>
                  {Object.entries(
                    results.reduce((acc, r) => { acc[r.bucket] = (acc[r.bucket] || 0) + 1; return acc }, {} as Record<string, number>)
                  ).map(([bucket, count]) => (
                    <span key={bucket} style={{ fontFamily: 'IBM Plex Mono, monospace', fontSize: '7px', padding: '1px 5px', borderRadius: '3px', background: `${BUCKET_COLORS[bucket as keyof typeof BUCKET_COLORS]}18`, color: BUCKET_COLORS[bucket as keyof typeof BUCKET_COLORS], border: `1px solid ${BUCKET_COLORS[bucket as keyof typeof BUCKET_COLORS]}30` }}>
                      {bucket.toUpperCase()} {count}
                    </span>
                  ))}
                </div>
              </div>
              {results.map(item => <FeedCard key={item.id} item={item} />)}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
