// src/lib/socialConnect.ts
// Mandatory social-account connections (#1 from feedback). Users must connect
// the required platforms; the stored tokens are what the ingest uses to track.
// OAuth *initiation* is here; the token EXCHANGE happens server-side in the
// `bm-oauth-callback` edge function (see SETUP notes in IMPLEMENTATION_all.md).
import { supabase } from './supabase'

export type SocialPlatform = 'twitter' | 'meta' | 'google' | 'reddit'

export interface PlatformDef {
  id: SocialPlatform
  label: string
  blurb: string          // why we need it
  color: string
  required: boolean      // gate blocks the app until all `required` are connected
  authorizeBase: string
  scopes: string
  clientIdEnv: string    // which VITE_ env var holds the client id
}

const REDIRECT = `${typeof window !== 'undefined' ? window.location.origin : ''}/oauth/callback`

// Gate is OPT-IN. While false, the app never blocks on social connections and
// the existing tracking continues unchanged. Flip to true when ready.
export const SOCIAL_GATE_ENABLED = false

export const PLATFORMS: PlatformDef[] = [
  { id: 'twitter', label: 'X (Twitter)', blurb: 'Track mentions, replies and trends on X.', color: '#1d9bf0', required: true,
    authorizeBase: 'https://twitter.com/i/oauth2/authorize', scopes: 'tweet.read users.read offline.access', clientIdEnv: 'VITE_TWITTER_CLIENT_ID' },
  { id: 'meta', label: 'Meta (FB + Instagram)', blurb: 'Track Facebook Pages and Instagram public posts.', color: '#1877f2', required: true,
    authorizeBase: 'https://www.facebook.com/v19.0/dialog/oauth', scopes: 'pages_read_engagement,instagram_basic', clientIdEnv: 'VITE_META_CLIENT_ID' },
  { id: 'google', label: 'Google (YouTube)', blurb: 'Track YouTube coverage and channel activity.', color: '#ff2020', required: true,
    authorizeBase: 'https://accounts.google.com/o/oauth2/v2/auth', scopes: 'https://www.googleapis.com/auth/youtube.readonly', clientIdEnv: 'VITE_GOOGLE_CLIENT_ID' },
  { id: 'reddit', label: 'Reddit', blurb: 'Track subreddit and discussion mentions.', color: '#ff4500', required: false,
    authorizeBase: 'https://www.reddit.com/api/v1/authorize', scopes: 'read', clientIdEnv: 'VITE_REDDIT_CLIENT_ID' },
]

export interface SocialConnection {
  platform: SocialPlatform
  handle: string | null
  connected_at: string
  expires_at: string | null
  status: 'active' | 'expired' | 'revoked'
}

export async function getConnections(userId: string): Promise<SocialConnection[]> {
  const { data, error } = await supabase
    .from('social_connections')
    .select('platform, handle, connected_at, expires_at, status')
    .eq('user_id', userId)
  if (error) { console.warn('[socialConnect] load failed:', error.message); return [] }
  return (data ?? []) as SocialConnection[]
}

export function isConnected(conns: SocialConnection[], p: SocialPlatform): boolean {
  const c = conns.find((x) => x.platform === p)
  return !!c && c.status === 'active' && (!c.expires_at || new Date(c.expires_at) > new Date())
}

export const requiredPlatforms = () => PLATFORMS.filter((p) => p.required)

// The gate is satisfied only when every required platform has an active token.
export function gateSatisfied(conns: SocialConnection[]): boolean {
  if (!SOCIAL_GATE_ENABLED) return true            // never block while disabled
  return requiredPlatforms().every((p) => isConnected(conns, p.id))
}

// Begin OAuth. Stores a CSRF `state` then redirects to the provider.
export function startConnect(p: PlatformDef): void {
  const clientId = (import.meta as any).env?.[p.clientIdEnv]
  if (!clientId) { alert(`${p.label} is not configured yet (${p.clientIdEnv} missing).`); return }
  const state = crypto.randomUUID()
  sessionStorage.setItem('bm-oauth-state', state)
  sessionStorage.setItem('bm-oauth-platform', p.id)
  const u = new URL(p.authorizeBase)
  u.searchParams.set('client_id', clientId)
  u.searchParams.set('redirect_uri', REDIRECT)
  u.searchParams.set('response_type', 'code')
  u.searchParams.set('scope', p.scopes)
  u.searchParams.set('state', state)
  if (p.id === 'twitter') { u.searchParams.set('code_challenge', 'challenge'); u.searchParams.set('code_challenge_method', 'plain') }
  window.location.href = u.toString()
}

export async function disconnect(userId: string, platform: SocialPlatform): Promise<void> {
  await supabase.from('social_connections').update({ status: 'revoked' }).eq('user_id', userId).eq('platform', platform)
}
