import { create } from "zustand"
import { persist } from "zustand/middleware"
import type { User, Account, DashboardState, Platform, BucketColor } from "@/types"
import type { Tier } from "@/lib/tiers"

interface AuthState {
  user: User | null
  account: Account | null
  tier: Tier
  isLoading: boolean
  setUser: (user: User | null) => void
  setAccount: (account: Account | null) => void
  setTier: (tier: Tier) => void
  setLoading: (v: boolean) => void
  logout: () => void
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      user: null, account: null, tier: "basic" as Tier, isLoading: true,
      setUser: (user) => set({ user }),
      setAccount: (account) => set({ account }),
      setTier: (tier) => set({ tier }),
      setLoading: (isLoading) => set({ isLoading }),
      logout: () => set({ user: null, account: null, tier: "basic" }),
    }),
    { name: "bm-auth-v3", partialize: (s) => ({ user: s.user, account: s.account, tier: s.tier }) }
  )
)

interface DashboardStore extends DashboardState {
  setActivePlatform: (p: Platform | "all") => void
  setActiveBucket: (b: BucketColor | null) => void
  setViewMode: (v: "4col" | "2x2") => void
  setGeoScope: (g: "national" | "state" | "constituency") => void
  setSearchQuery: (q: string) => void
  openVideo: (id: string, title: string) => void
  closeVideo: () => void
}

export const useDashboardStore = create<DashboardStore>()((set) => ({
  activePlatform: "all", activeBucket: null, viewMode: "4col",
  geoScope: "national", searchQuery: "", isVideoOpen: false, activeVideo: null,
  setActivePlatform: (activePlatform) => set({ activePlatform }),
  setActiveBucket: (activeBucket) => set({ activeBucket }),
  setViewMode: (viewMode) => set({ viewMode }),
  setGeoScope: (geoScope) => set({ geoScope }),
  setSearchQuery: (searchQuery) => set({ searchQuery }),
  openVideo: (id, title) => set({ isVideoOpen: true, activeVideo: { id, title } }),
  closeVideo: () => set({ isVideoOpen: false, activeVideo: null }),
}))

interface FeedCountStore {
  counts: Record<BucketColor, number>
  setCount: (bucket: BucketColor, n: number) => void
  increment: (bucket: BucketColor) => void
}

export const useFeedCountStore = create<FeedCountStore>()((set) => ({
  counts: { red: 0, yellow: 0, blue: 0, silver: 0 },
  setCount: (bucket, n) => set(s => ({ counts: { ...s.counts, [bucket]: n } })),
  increment: (bucket) => set(s => ({ counts: { ...s.counts, [bucket]: s.counts[bucket] + 1 } })),
}))
