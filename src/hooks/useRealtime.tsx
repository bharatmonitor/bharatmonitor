import { useEffect, useRef } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFeedCountStore } from '@/store'
import toast from 'react-hot-toast'
import type { FeedItem, BucketColor } from '@/types'

// Stable selectors — these functions are created once in the store and never change
const selectIncrement = (s: ReturnType<typeof useFeedCountStore.getState>) => s.increment

export function useRealtimeFeed(accountId: string) {
  const qc = useQueryClient()
  // Selector-based access: only the function reference, no re-renders from count changes
  const increment = useFeedCountStore(selectIncrement)

  // Use refs so the effect closure is never stale — avoids unstable-dep re-subscribes
  const qcRef = useRef(qc)
  const incrementRef = useRef(increment)
  useEffect(() => { qcRef.current = qc }, [qc])
  useEffect(() => { incrementRef.current = increment }, [increment])

  useEffect(() => {
    if (!accountId) return

    const handleNewItem = (item: FeedItem) => {
      // Query key matches useFeedItems exactly: ['feed', accountId]
      qcRef.current.setQueryData<FeedItem[]>(
        ['feed', accountId],
        old => old ? [item, ...old] : [item]
      )
      incrementRef.current(item.bucket as BucketColor)

      if (item.bucket === 'red') {
        toast.error(`⚡ CRISIS: ${item.headline.substring(0, 80)}…`, {
          duration: 8000,
          position: 'top-right',
          style: {
            background: '#0d1018',
            border: '1px solid rgba(240,62,62,0.4)',
            color: '#edf0f8',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '11px',
            maxWidth: '380px',
            padding: '10px 14px',
          },
        })
      }
    }

    // No mock data - only real Supabase realtime
    const channel = supabase
      .channel(`feed-${accountId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'feed_items',
        filter: `account_id=eq.${accountId}`,
      }, payload => handleNewItem(payload.new as FeedItem))
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [accountId]) // stable — only re-subscribes when accountId changes
}

export function useRealtimeContradictions(accountId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    const channel = supabase
      .channel(`contra-${accountId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contradictions',
        filter: `account_id=eq.${accountId}`,
      }, payload => {
        qc.invalidateQueries({ queryKey: ['contradictions', accountId] })
        qc.invalidateQueries({ queryKey: ['feed', accountId] })

        const score = payload.new.contradiction_score
        const name = payload.new.politician_name
        const type = (payload.new.contradiction_type as string)?.replace(/_/g, ' ') ?? ''

        toast(`⚡ CONTRADICTION ${score}% — ${name}: ${type}`, {
          duration: 10000,
          position: 'top-right',
          style: {
            background: '#0d1018',
            border: '1px solid rgba(245,166,35,0.4)',
            color: '#f5a623',
            fontFamily: 'IBM Plex Mono, monospace',
            fontSize: '11px',
            maxWidth: '380px',
            padding: '10px 14px',
          },
        })
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [accountId, qc])
}
