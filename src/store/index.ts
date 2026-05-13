import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type { User, DashboardState, Platform, BucketColor, FeedItem } from '@/types'
import type { Tier } from '@/lib/tiers'

// Auth — only user identity persisted, nothing else
interface AuthState {
  user: User | null
  tier: Tier
  setUser: (user: User | null) => void
  setTier: (tier: Tier) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null,
      tier: 'basic' as Tier,
      setUser: (user) => set({ user }),
      setTier: (tier) => set({ tier }),
      logout: () => set({ user: null, tier: 'basic' }),
    }),
    {
      name: 'bm-auth-v4', // v4 = fresh key, kills all old sessions
      partialize: (s) => ({ user: s.user, tier: s.tier }),
    }
  )
)

// Dashboard UI state — no persistence
interface DashboardStore extends DashboardState {
  setActivePlatform: (p: Platform | 'all') => void
  setActiveBucket: (b: BucketColor | null) => void
  setViewMode: (v: '4col' | '2x2') => void
  setGeoScope: (g: 'national' | 'state' | 'constituency') => void
  setSearchQuery: (q: string) => void
  openVideo: (id: string, title: string) => void
  closeVideo: () => void
  // Feed item detail panel — keeps users on portal
  selectedItem:   FeedItem | null
  openItem:       (item: FeedItem) => void
  closeItem:      () => void
  selectItem:     (item: FeedItem) => void
}

export const useDashboardStore = create<DashboardStore>()((set) => ({
  activePlatform: 'all', activeBucket: null, viewMode: '4col',
  geoScope: 'national', searchQuery: '', isVideoOpen: false, activeVideo: null,
  selectedItem: null,
  setActivePlatform: (activePlatform) => set({ activePlatform }),
  setActiveBucket: (activeBucket) => set({ activeBucket }),
  setViewMode: (viewMode) => set({ viewMode }),
  setGeoScope: (geoScope) => set({ geoScope }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  openVideo: (id, title) => set({ isVideoOpen: true, activeVideo: { id, title } }),
  closeVideo: () => set({ isVideoOpen: false, activeVideo: null }),
  openItem:  (item) => set({ selectedItem: item }),
  closeItem: () => set({ selectedItem: null }),
  selectItem: (item) => set({ selectedItem: item }),
}))

interface FeedCountStore {
  counts: Record<BucketColor, number>
  setCount: (bucket: BucketColor, n: number) => void
  setAllCounts: (counts: Record<BucketColor, number>) => void
  increment: (bucket: BucketColor) => void
}

export const useFeedCountStore = create<FeedCountStore>()((set) => ({
  counts: { red: 0, yellow: 0, blue: 0, silver: 0 },
  // Use setAllCounts for batch updates — one store write instead of 4
  setAllCounts: (counts) => set({ counts }),
  setCount: (bucket, n) => set(s => ({ counts: { ...s.counts, [bucket]: n } })),
  increment: (bucket) => set(s => ({ counts: { ...s.counts, [bucket]: s.counts[bucket] + 1 } })),
}))
