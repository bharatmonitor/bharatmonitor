import { useEffect, useCallback } from 'react'
import { useQueryClient } from '@tanstack/react-query'
import { supabase } from '@/lib/supabase'
import { useFeedCountStore } from '@/store'
import toast from 'react-hot-toast'
import type { FeedItem, BucketColor } from '@/types'

const IS_DEMO = !import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.VITE_SUPABASE_URL.includes('placeholder')

export function useRealtimeFeed(accountId: string) {
  const qc = useQueryClient()
  const { increment } = useFeedCountStore()

  const handleNewItem = useCallback((item: FeedItem) => {
    qc.setQueryData<FeedItem[]>(
      ['feed-items', accountId, undefined, undefined],
      old => old ? [item, ...old] : [item]
    )
    qc.setQueryData<FeedItem[]>(
      ['feed-items', accountId, item.bucket, undefined],
      old => old ? [item, ...old] : [item]
    )
    increment(item.bucket as BucketColor)

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
  }, [accountId, qc, increment])

  useEffect(() => {
    if (IS_DEMO) {
      const interval = setInterval(() => {
        const headlines = [
          'Opposition hashtag trending #4 nationally — BJP digital war room activating counter-response',
          'Farmer protest update: Shambhu border situation escalating — media on ground',
          'New GDP data released — opposition and government claim contradictory interpretations',
        ]
        const mockItem: FeedItem = {
          id: `live-${Date.now()}`,
          account_id: accountId,
          platform: 'twitter',
          bucket: 'red',
          sentiment: 'negative',
          headline: headlines[Math.floor(Math.random() * headlines.length)],
          source: 'ANI LIVE',
          geo_tags: ['National'],
          topic_tags: ['Breaking'],
          language: 'english',
          published_at: new Date().toISOString(),
          fetched_at: new Date().toISOString(),
        }
        handleNewItem(mockItem)
      }, 120000)

      return () => clearInterval(interval)
    }

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
  }, [accountId, handleNewItem])
}

export function useRealtimeContradictions(accountId: string) {
  const qc = useQueryClient()

  useEffect(() => {
    if (IS_DEMO) return

    const channel = supabase
      .channel(`contra-${accountId}`)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'contradictions',
        filter: `account_id=eq.${accountId}`,
      }, payload => {
        qc.invalidateQueries({ queryKey: ['contradictions', accountId] })
        qc.invalidateQueries({ queryKey: ['feed-items', accountId] })

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
