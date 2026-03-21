// ─── Auth & Users ────────────────────────────────────────────────────────────

export type UserRole = 'god' | 'admin' | 'user'

export interface User {
  id: string
  email: string
  role: UserRole
  created_at: string
  account?: Account
}

// ─── Account / Politician Profile ────────────────────────────────────────────

export type AccountType = 'politician' | 'ministry' | 'business' | 'organisation' | 'campaign'

export interface Account {
  id: string
  user_id: string
  created_by: string
  is_active: boolean

  // Account type
  account_type?: AccountType  // defaults to 'politician' if not set

  // Entity info — works for politicians AND businesses/orgs
  politician_name: string     // for businesses: use brand/org name
  politician_initials: string
  party?: string              // optional — empty for non-political accounts
  designation: string         // "MP" or "CEO" or "Ministry" etc
  constituency?: string       // optional for non-political
  constituency_type?: 'lok_sabha' | 'vidhan_sabha' | 'rajya_sabha' | 'national' | 'none'
  state?: string
  district?: string

  // What to track
  keywords: string[]
  tracked_politicians: TrackedPolitician[]
  tracked_ministries: string[]
  tracked_parties: string[]
  tracked_schemes: string[]

  // Languages
  languages: Language[]

  // Geography scope
  geo_scope: GeoScope[]

  // Alert preferences
  alert_prefs: AlertPrefs

  // Contact
  contact_email?: string
  contact_phone?: string

  created_at: string
  updated_at: string
}

export interface TrackedPolitician {
  id: string
  name: string
  party: string
  initials: string
  role?: string
  is_competitor: boolean
}

export type Language =
  | 'hindi' | 'english' | 'tamil' | 'telugu' | 'bengali'
  | 'marathi' | 'gujarati' | 'kannada' | 'malayalam' | 'punjabi'
  | 'odia' | 'urdu' | 'assamese' | 'maithili'

export interface GeoScope {
  level: 'national' | 'state' | 'district' | 'constituency'
  name: string
  state?: string
}

export interface AlertPrefs {
  red_sms: boolean
  red_push: boolean
  red_email: boolean
  yellow_push: boolean
  yellow_email: boolean
}

// ─── Feed Items ───────────────────────────────────────────────────────────────

export type BucketColor = 'red' | 'yellow' | 'blue' | 'silver'
export type Platform = 'twitter' | 'instagram' | 'facebook' | 'whatsapp' | 'youtube' | 'news' | 'reddit'
export type Sentiment = 'positive' | 'negative' | 'neutral'

export interface FeedItem {
  id: string
  account_id: string
  platform: Platform
  bucket: BucketColor
  sentiment: Sentiment
  headline: string
  body?: string
  source: string             // e.g. "NDTV", "@ANINewsIndia"
  url?: string
  geo_tags: string[]         // e.g. ["Wayanad", "Kerala"]
  topic_tags: string[]       // e.g. ["Flood Relief", "MGNREGA"]
  language: Language
  views?: number
  shares?: number
  engagement?: number
  is_trending?: boolean
  trend_rank?: number
  published_at: string
  fetched_at: string
  // For YouTube
  youtube_id?: string
  thumbnail?: string
  channel?: string
  // Contradiction
  contradiction?: Contradiction
}

// ─── Contradictions ───────────────────────────────────────────────────────────

export interface Contradiction {
  id: string
  feed_item_id: string
  politician_name: string
  current_quote: string
  historical_quote: string
  historical_date: string
  historical_source: string
  contradiction_score: number   // 0–100
  contradiction_type: 'flip' | 'contradiction' | 'vote_record' | 'data_gap'
  evidence_source?: string      // e.g. "RTI", "Lok Sabha record"
  status: 'flagged' | 'confirmed' | 'dismissed'
  created_at: string
}

// ─── Trendlines ───────────────────────────────────────────────────────────────

export interface TrendDataPoint {
  date: string
  value: number
}

export interface TrendMetric {
  id: string
  account_id: string
  metric: TrendMetricType
  platform?: Platform
  data_points: TrendDataPoint[]    // last N months
  current_value: number
  delta_7d: number
  delta_since_election: number
  election_reference_date: string
}

export type TrendMetricType =
  | 'sentiment'
  | 'mention_volume'
  | 'narrative_score'
  | 'opposition_pressure'
  | 'issue_ownership'
  | 'youth_sentiment'
  | 'social_share'
  | 'vernacular_reach'

// ─── AI Intelligence ─────────────────────────────────────────────────────────

export interface AIBrief {
  id: string
  account_id: string
  situation_summary: string
  pattern_analysis: string
  opportunities: NarrativeOpportunity[]
  ticker_items: TickerItem[]
  generated_at: string
  next_refresh_at: string
}

export interface NarrativeOpportunity {
  id: string
  type: 'contradiction' | 'data_gap' | 'vote_record' | 'flip'
  politician: string
  score: number | 'RTI' | 'VR'
  description: string
  current_statement: string
  historical_statement: string
  confidence: number
}

export interface TickerItem {
  id: string
  tag: 'CRISIS' | 'OPP' | 'POSITIVE' | 'INTEL' | 'SURGE' | 'RTI' | 'TREND' | 'AI'
  text: string
  bucket: BucketColor
  created_at: string
}

// ─── Map / Geo ────────────────────────────────────────────────────────────────

export interface StateConversationVolume {
  state_name: string
  volume: number              // 0–100 normalised
  sentiment: number           // 0–100
  top_topic: string
  mention_count: number
}

export interface MapBubble {
  label: string
  lat: number
  lng: number
  volume: number
  sentiment: Sentiment
}

// ─── Constituency Pulse ───────────────────────────────────────────────────────

export interface ConstituencyIssue {
  topic: string
  volume_pct: number         // 0–100
  sentiment: Sentiment
  trend: 'up' | 'down' | 'flat'
}

export interface ConstituencyPulse {
  account_id: string
  constituency: string
  state: string
  issues: ConstituencyIssue[]
  overall_sentiment: number
  updated_at: string
}

// ─── Competitors ─────────────────────────────────────────────────────────────

export interface CompetitorSummary {
  politician: TrackedPolitician
  statements_today: number
  contradictions_flagged: number
  latest_contradiction_score?: number
  status: 'contradiction' | 'rti' | 'watch' | 'clear'
  last_active: string
}

// ─── Scheme Sentiment ─────────────────────────────────────────────────────────

export interface SchemeSentiment {
  scheme_name: string
  sentiment_score: number    // 0–100
  mention_count: number
  trend: 'up' | 'down' | 'flat'
}

// ─── Issue Ownership ─────────────────────────────────────────────────────────

export interface IssueOwnershipPoint {
  month: string
  politician_score: number
  opposition_score: number
}

// ─── Dashboard State ─────────────────────────────────────────────────────────

export interface DashboardState {
  activePlatform: Platform | 'all'
  activeBucket: BucketColor | null
  viewMode: '4col' | '2x2'
  geoScope: 'national' | 'state' | 'constituency'
  searchQuery: string
  isVideoOpen: boolean
  activeVideo: { id: string; title: string } | null
}

// ─── RSS Feed Config ──────────────────────────────────────────────────────────

export interface RSSFeed {
  id: string
  name: string
  url: string
  language: Language
  tier: 1 | 2 | 3 | 4
  is_state_affiliated: boolean
  propaganda_risk: 'low' | 'medium' | 'high'
  geo_tags: string[]
  platform: 'news'
  is_active: boolean
}

// ─── Supabase DB types ────────────────────────────────────────────────────────

export interface Database {
  public: {
    Tables: {
      accounts: { Row: Account; Insert: Omit<Account, 'id' | 'created_at' | 'updated_at'>; Update: Partial<Account> }
      feed_items: { Row: FeedItem; Insert: Omit<FeedItem, 'id' | 'fetched_at'>; Update: Partial<FeedItem> }
      contradictions: { Row: Contradiction; Insert: Omit<Contradiction, 'id' | 'created_at'>; Update: Partial<Contradiction> }
      ai_briefs: { Row: AIBrief; Insert: Omit<AIBrief, 'id'>; Update: Partial<AIBrief> }
      trend_metrics: { Row: TrendMetric; Insert: Omit<TrendMetric, 'id'>; Update: Partial<TrendMetric> }
      rss_feeds: { Row: RSSFeed; Insert: Omit<RSSFeed, 'id'>; Update: Partial<RSSFeed> }
    }
  }
}
