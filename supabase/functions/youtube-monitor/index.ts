// supabase/functions/youtube-monitor/index.ts
// YouTube Data API v3 — search by keywords, classify, store

import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface YTVideo {
  id: { videoId: string }
  snippet: {
    title: string
    channelTitle: string
    publishedAt: string
    description: string
    thumbnails: { medium: { url: string } }
  }
}

async function searchYouTube(query: string, apiKey: string): Promise<YTVideo[]> {
  const params = new URLSearchParams({
    part: 'snippet',
    q: query,
    type: 'video',
    regionCode: 'IN',
    relevanceLanguage: 'hi',
    order: 'date',
    maxResults: '10',
    publishedAfter: new Date(Date.now() - 86400000).toISOString(),
    key: apiKey,
  })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/search?${params}`)
  const data = await res.json()
  return data.items || []
}

async function getVideoStats(videoIds: string[], apiKey: string): Promise<Record<string, { viewCount: string; likeCount: string }>> {
  const params = new URLSearchParams({
    part: 'statistics',
    id: videoIds.join(','),
    key: apiKey,
  })
  const res = await fetch(`https://www.googleapis.com/youtube/v3/videos?${params}`)
  const data = await res.json()
  const stats: Record<string, { viewCount: string; likeCount: string }> = {}
  for (const item of data.items || []) {
    stats[item.id] = item.statistics
  }
  return stats
}

function classifyVideo(title: string, description: string): { bucket: string; sentiment: string } {
  const text = (title + ' ' + description).toLowerCase()
  const redWords = ['protest', 'riot', 'violence', 'crisis', 'breaking', 'trending', 'viral', 'urgent']
  const yellowWords = ['debate', 'rally', 'campaign', 'speech', 'address', 'interview']
  const negWords = ['fail', 'condemn', 'blame', 'attack', 'oppose', 'reject', 'crisis']
  const posWords = ['success', 'achievement', 'support', 'approve', 'win', 'progress']

  let bucket = 'blue'
  if (redWords.some(w => text.includes(w))) bucket = 'red'
  else if (yellowWords.some(w => text.includes(w))) bucket = 'yellow'

  const negScore = negWords.filter(w => text.includes(w)).length
  const posScore = posWords.filter(w => text.includes(w)).length
  const sentiment = negScore > posScore ? 'negative' : posScore > negScore ? 'positive' : 'neutral'

  return { bucket, sentiment }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { account_id, keywords } = await req.json()
    const ytKey = Deno.env.get('YOUTUBE_API_KEY')
    if (!ytKey) throw new Error('YOUTUBE_API_KEY not set')

    const supabase = createClient(
      Deno.env.get('APP_URL') || Deno.env.get('APP_URL') || 'https://bmxrsfyaujcppaqvtnfx.supabase.co' || 'https://bmxrsfyaujcppaqvtnfx.supabase.co',
      Deno.env.get('SERVICE_ROLE_KEY')!
    )

    const allVideos: YTVideo[] = []
    for (const keyword of (keywords || []).slice(0, 3)) {
      const videos = await searchYouTube(keyword + ' India', ytKey)
      allVideos.push(...videos)
    }

    if (!allVideos.length) {
      return new Response(JSON.stringify({ success: true, count: 0 }), {
        headers: { ...CORS, 'Content-Type': 'application/json' }
      })
    }

    const videoIds = allVideos.map(v => v.id.videoId)
    const stats = await getVideoStats(videoIds, ytKey)

    const items = allVideos.map(video => {
      const { bucket, sentiment } = classifyVideo(video.snippet.title, video.snippet.description)
      const videoStats = stats[video.id.videoId] || {}
      return {
        account_id,
        platform: 'youtube',
        bucket,
        sentiment,
        headline: video.snippet.title,
        source: video.snippet.channelTitle,
        youtube_id: video.id.videoId,
        thumbnail: video.snippet.thumbnails?.medium?.url,
        channel: video.snippet.channelTitle,
        url: `https://youtube.com/watch?v=${video.id.videoId}`,
        geo_tags: [],
        topic_tags: [],
        language: 'hindi',
        views: parseInt(videoStats.viewCount || '0'),
        published_at: video.snippet.publishedAt,
      }
    })

    const { error } = await supabase.from('feed_items').insert(items)
    if (error) throw error

    return new Response(JSON.stringify({ success: true, count: items.length }), {
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })

  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...CORS, 'Content-Type': 'application/json' }
    })
  }
})
