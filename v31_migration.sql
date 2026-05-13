-- BharatMonitor v31 — New Tables Migration
-- Run this in Supabase SQL Editor before deploying

-- ─── Crisis prediction signals ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bm_crisis_signals (
  id              text PRIMARY KEY,
  account_id      text NOT NULL,
  risk_score      integer DEFAULT 0,
  risk_level      text DEFAULT 'LOW',  -- 'CRITICAL'|'HIGH'|'MEDIUM'|'LOW'
  signals_json    text,                -- JSON array of detected signals
  ai_analysis_json text,               -- Gemini analysis JSON
  summary         text,
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bm_crisis_signals_account_idx ON bm_crisis_signals(account_id);
CREATE INDEX IF NOT EXISTS bm_crisis_signals_created_idx ON bm_crisis_signals(created_at DESC);

-- ─── Opposition research cache ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS bm_research_cache (
  id              text PRIMARY KEY,    -- 'opp-{accountId}-{politician}-{topic}'
  account_id      text NOT NULL,
  politician      text NOT NULL,
  topic           text NOT NULL,
  result_json     text,                -- Full research result JSON
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bm_research_cache_account_idx ON bm_research_cache(account_id);

-- ─── Constituency sentiment map ───────────────────────────────────────────────
-- (building in progress — Phase 2)
CREATE TABLE IF NOT EXISTS bm_constituency_data (
  id              text PRIMARY KEY,
  account_id      text NOT NULL,
  constituency    text NOT NULL,
  state           text,
  sentiment_score integer DEFAULT 50,  -- 0-100
  item_count      integer DEFAULT 0,
  top_topics      text[],
  updated_at      timestamptz DEFAULT now()
);

-- ─── Media bias tracker ───────────────────────────────────────────────────────
-- (building in progress — Phase 2)
CREATE TABLE IF NOT EXISTS bm_source_bias (
  id              text PRIMARY KEY,
  source_name     text NOT NULL,
  source_domain   text,
  weekly_pos_pct  integer DEFAULT 50,
  weekly_neg_pct  integer DEFAULT 50,
  item_count      integer DEFAULT 0,
  bias_score      integer DEFAULT 50,  -- 0=hard left, 100=hard right
  updated_at      timestamptz DEFAULT now()
);

-- ─── Influencer network ───────────────────────────────────────────────────────
-- (building in progress — Phase 3)
CREATE TABLE IF NOT EXISTS bm_influencer_network (
  id              text PRIMARY KEY,
  account_id      text NOT NULL,
  username        text NOT NULL,
  followers       integer DEFAULT 0,
  relevant_tweets integer DEFAULT 0,
  total_impressions bigint DEFAULT 0,
  sentiment_score integer DEFAULT 50,
  tier            text DEFAULT 'micro',  -- 'mega'|'macro'|'micro'|'nano'
  topics          text[],
  updated_at      timestamptz DEFAULT now()
);

-- Enable RLS (Row Level Security) — adjust policies per your auth setup
ALTER TABLE bm_crisis_signals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_research_cache   ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_constituency_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_source_bias      ENABLE ROW LEVEL SECURITY;
ALTER TABLE bm_influencer_network ENABLE ROW LEVEL SECURITY;

-- Allow service role to do everything (for edge functions)
CREATE POLICY IF NOT EXISTS "service_role_all" ON bm_crisis_signals    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON bm_research_cache    FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON bm_constituency_data FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON bm_source_bias       FOR ALL TO service_role USING (true) WITH CHECK (true);
CREATE POLICY IF NOT EXISTS "service_role_all" ON bm_influencer_network FOR ALL TO service_role USING (true) WITH CHECK (true);

-- Allow anon read (for dashboard queries)
CREATE POLICY IF NOT EXISTS "anon_read" ON bm_crisis_signals    FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_read" ON bm_research_cache    FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_read" ON bm_constituency_data FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_read" ON bm_source_bias       FOR SELECT TO anon USING (true);
CREATE POLICY IF NOT EXISTS "anon_read" ON bm_influencer_network FOR SELECT TO anon USING (true);

-- Done
SELECT 'v31 migration complete' as status;
