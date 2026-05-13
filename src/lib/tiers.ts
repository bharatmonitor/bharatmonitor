// ============================================================
// TIER CONFIG — Single source of truth for all tier limits
// Change a value here and it enforces everywhere automatically
// ============================================================

export type Tier = 'basic' | 'advanced' | 'elections' | 'god'

export interface TierConfig {
  name: string
  tagline: string
  price: string
  priceNote: string
  color: string
  accentColor: string
  features: {
    // Data ingestion
    rssFeedCount: number
    languageCount: number
    keywordCount: number
    competitorCount: number
    refreshIntervalMinutes: number

    // AI features
    aiBriefPerDay: number
    aiClassifier: 'keyword' | 'keyword+groq' | 'keyword+claude'
    contradictionEngine: 'none' | 'weekly' | 'daily' | 'realtime'
    quickScanKeywords: number

    // Social coverage
    twitterSource: 'none' | 'nitter' | 'nitter+serpapi' | 'full_api'
    youtubeSearchesPerDay: number
    instagramAccess: boolean
    whatsappSignals: boolean

    // Intelligence
    politicianComparison: number   // how many others to compare with
    constituencyDrilldown: 'state' | 'district' | 'constituency'
    dataRetentionDays: number

    // Alerts
    alertChannels: ('email' | 'push' | 'sms' | 'whatsapp')[]
    alertBuckets: ('red' | 'yellow' | 'blue' | 'silver')[]

    // Reports
    weeklyReport: boolean
    reportWithAiInsights: boolean
    customBrandedReport: boolean

    // Translation
    translationLanguages: number

    // Account
    teamMembers: number  // how many logins per account
  }
  displayFeatures: { text: string; available: boolean }[]  // for pricing page
}

export const TIER_CONFIG: Record<Tier, TierConfig> = {
  basic: {
    name: 'Basic',
    tagline: 'Stay informed. Never be caught off guard.',
    price: 'Connect',
    priceNote: 'for pricing',
    color: '#3d8ef0',
    accentColor: '#3d8ef060',
    features: {
      rssFeedCount: 10,
      languageCount: 3,
      keywordCount: 5,
      competitorCount: 2,
      refreshIntervalMinutes: 30,
      aiBriefPerDay: 1,
      aiClassifier: 'keyword',
      contradictionEngine: 'none',
      quickScanKeywords: 3,
      twitterSource: 'nitter',
      youtubeSearchesPerDay: 3,
      instagramAccess: false,
      whatsappSignals: false,
      politicianComparison: 0,
      constituencyDrilldown: 'state',
      dataRetentionDays: 30,
      alertChannels: ['email'],
      alertBuckets: ['red'],
      weeklyReport: true,
      reportWithAiInsights: false,
      customBrandedReport: false,
      translationLanguages: 0,
      teamMembers: 1,
    },
    displayFeatures: [
      { text: '5 tracked keywords', available: true },
      { text: '10 Indian news RSS feeds', available: true },
      { text: '3 languages (EN, HI + 1)', available: true },
      { text: 'Daily AI intelligence brief', available: true },
      { text: 'Twitter/X signals via Nitter', available: true },
      { text: 'Basic weekly report (PDF)', available: true },
      { text: 'Email alerts for crisis (Red)', available: true },
      { text: 'State-level conversation map', available: true },
      { text: 'Contradiction engine', available: false },
      { text: 'Instagram & Facebook tracking', available: false },
      { text: 'WhatsApp signal monitoring', available: false },
      { text: 'Politician comparison', available: false },
      { text: 'AI-powered report insights', available: false },
      { text: 'Real-time alerts (Push + SMS)', available: false },
    ],
  },

  advanced: {
    name: 'Advanced',
    tagline: 'Real-time intelligence. Strategic advantage.',
    price: 'Connect',
    priceNote: 'for pricing',
    color: '#f97316',
    accentColor: '#f9731660',
    features: {
      rssFeedCount: 20,
      languageCount: 8,
      keywordCount: 15,
      competitorCount: 5,
      refreshIntervalMinutes: 10,
      aiBriefPerDay: 6,
      aiClassifier: 'keyword+groq',
      contradictionEngine: 'daily',
      quickScanKeywords: 5,
      twitterSource: 'nitter+serpapi',
      youtubeSearchesPerDay: 20,
      instagramAccess: true,
      whatsappSignals: false,
      politicianComparison: 3,
      constituencyDrilldown: 'district',
      dataRetentionDays: 180,
      alertChannels: ['email', 'push'],
      alertBuckets: ['red', 'yellow'],
      weeklyReport: true,
      reportWithAiInsights: true,
      customBrandedReport: false,
      translationLanguages: 4,
      teamMembers: 3,
    },
    displayFeatures: [
      { text: '15 tracked keywords', available: true },
      { text: '20 Indian news feeds (all languages)', available: true },
      { text: '8 languages tracked', available: true },
      { text: 'AI brief every 4 hours', available: true },
      { text: 'Twitter/X + SerpAPI signals', available: true },
      { text: 'Contradiction engine (daily scan)', available: true },
      { text: 'Compare 3 rival politicians', available: true },
      { text: 'Instagram & Facebook tracking', available: true },
      { text: 'District-level constituency map', available: true },
      { text: 'AI-powered weekly reports', available: true },
      { text: 'Push + Email real-time alerts', available: true },
      { text: '6-month data retention', available: true },
      { text: '3 team member logins', available: true },
      { text: 'WhatsApp signal monitoring', available: false },
      { text: 'SMS alerts', available: false },
      { text: 'Elections war room mode', available: false },
    ],
  },

  elections: {
    name: 'Elections Monitor',
    tagline: 'Full war room. Every signal. Zero lag.',
    price: 'Connect',
    priceNote: 'for pricing',
    color: '#f03e3e',
    accentColor: '#f03e3e60',
    features: {
      rssFeedCount: 999,
      languageCount: 14,
      keywordCount: 999,
      competitorCount: 999,
      refreshIntervalMinutes: 2,
      aiBriefPerDay: 48,
      aiClassifier: 'keyword+claude',
      contradictionEngine: 'realtime',
      quickScanKeywords: 10,
      twitterSource: 'full_api',
      youtubeSearchesPerDay: 999,
      instagramAccess: true,
      whatsappSignals: true,
      politicianComparison: 999,
      constituencyDrilldown: 'constituency',
      dataRetentionDays: 99999,
      alertChannels: ['email', 'push', 'sms', 'whatsapp'],
      alertBuckets: ['red', 'yellow', 'blue', 'silver'],
      weeklyReport: true,
      reportWithAiInsights: true,
      customBrandedReport: true,
      translationLanguages: 14,
      teamMembers: 10,
    },
    displayFeatures: [
      { text: 'Unlimited keywords & competitors', available: true },
      { text: 'All 14 Indian languages', available: true },
      { text: 'AI brief every 30 minutes', available: true },
      { text: 'Full Twitter/X API (live stream)', available: true },
      { text: 'Contradiction engine (real-time)', available: true },
      { text: 'WhatsApp signal monitoring', available: true },
      { text: 'Instagram + Facebook full tracking', available: true },
      { text: 'Constituency-level drill-down', available: true },
      { text: 'Claude AI (highest quality)', available: true },
      { text: 'SMS + WhatsApp + Push alerts', available: true },
      { text: 'Custom branded reports', available: true },
      { text: 'Unlimited data history', available: true },
      { text: '10 team member logins', available: true },
      { text: 'Dedicated WhatsApp support', available: true },
      { text: 'Activated by BharatMonitor admin only', available: true },
    ],
  },

  god: {
    name: 'God Mode',
    tagline: 'Platform administration',
    price: 'Internal',
    priceNote: 'admin only',
    color: '#f03e3e',
    accentColor: '#f03e3e40',
    features: {
      rssFeedCount: 999, languageCount: 14, keywordCount: 999,
      competitorCount: 999, refreshIntervalMinutes: 1,
      aiBriefPerDay: 999, aiClassifier: 'keyword+claude',
      contradictionEngine: 'realtime', quickScanKeywords: 10,
      twitterSource: 'full_api', youtubeSearchesPerDay: 999,
      instagramAccess: true, whatsappSignals: true,
      politicianComparison: 999, constituencyDrilldown: 'constituency',
      dataRetentionDays: 99999, alertChannels: ['email','push','sms','whatsapp'],
      alertBuckets: ['red','yellow','blue','silver'],
      weeklyReport: true, reportWithAiInsights: true, customBrandedReport: true,
      translationLanguages: 14, teamMembers: 999,
    },
    displayFeatures: [],
  },
}

// ── Helper: check if a feature is available for a tier ────────────────────────
export function tierHas(tier: Tier, feature: keyof TierConfig['features'], value?: unknown): boolean {
  const cfg = TIER_CONFIG[tier]?.features
  if (!cfg) return false
  if (value === undefined) {
    const v = cfg[feature]
    if (typeof v === 'boolean') return v
    if (typeof v === 'number') return v > 0
    return true
  }
  return cfg[feature] === value
}

export function tierLimit(tier: Tier, feature: keyof TierConfig['features']): number {
  const val = TIER_CONFIG[tier]?.features?.[feature]
  return typeof val === 'number' ? val : 0
}

// ── Upgrade prompt messages ────────────────────────────────────────────────────
export const UPGRADE_MESSAGES: Partial<Record<keyof TierConfig['features'], string>> = {
  contradictionEngine:    'Contradiction detection is available from the Advanced tier.',
  competitorCount:        'Track more competitors by upgrading your plan.',
  keywordCount:           'Add more tracked keywords by upgrading your plan.',
  instagramAccess:        'Instagram & Facebook tracking is available from the Advanced tier.',
  whatsappSignals:        'WhatsApp signal monitoring is available on the Elections Monitor.',
  politicianComparison:   'Politician comparison is available from the Advanced tier.',
  aiBriefPerDay:          'More frequent AI briefs are available on higher tiers.',
  reportWithAiInsights:   'AI-powered report insights are available from the Advanced tier.',
  translationLanguages:   'Multi-language translation is available from the Advanced tier.',
  twitterSource:          'Enhanced Twitter tracking is available on higher tiers.',
}
