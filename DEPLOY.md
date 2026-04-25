# BharatMonitor — Deploy Guide
## GitHub + Vercel + Supabase

---

## STEP 1 — Initialize Git & push to GitHub

```bash
cd bharatmonitor_rebuilt

git init
git add .
git commit -m "feat: initial production build — BharatMonitor v1.0"

# Create repo at github.com (name: bharatmonitor, private, no README)
git remote add origin https://github.com/YOUR_USERNAME/bharatmonitor.git
git branch -M main
git push -u origin main
```

---

## STEP 2 — Supabase: create tables

Go to https://supabase.com → your project → SQL Editor → paste and run:

```sql
-- Core feed table
create table if not exists bm_feed (
  id text primary key,
  account_id text not null,
  platform text,
  bucket text,
  sentiment text,
  tone integer default 0,
  headline text,
  title text,
  body text,
  source text,
  source_name text,
  source_type text,
  url text unique,
  geo_tags text[] default '{}',
  topic_tags text[] default '{}',
  language text default 'english',
  views integer default 0,
  shares integer default 0,
  engagement integer default 0,
  is_trending boolean default false,
  keyword text,
  published_at timestamptz default now(),
  fetched_at timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists bm_feed_account_idx on bm_feed(account_id);
create index if not exists bm_feed_published_idx on bm_feed(published_at desc);

-- Legacy feed_items table (keep for backward compat)
create table if not exists feed_items (
  id text primary key,
  account_id text not null,
  platform text,
  bucket text default 'silver',
  sentiment text default 'neutral',
  tone integer default 0,
  headline text,
  body text,
  source text,
  url text,
  geo_tags text[] default '{}',
  topic_tags text[] default '{}',
  language text default 'english',
  keyword text,
  published_at timestamptz default now(),
  fetched_at timestamptz default now(),
  created_at timestamptz default now()
);
create index if not exists feed_items_account_idx on feed_items(account_id);

-- Accounts
create table if not exists accounts (
  id text primary key,
  user_id text,
  created_by text,
  is_active boolean default true,
  politician_name text,
  politician_initials text,
  party text,
  designation text,
  constituency text,
  constituency_type text,
  state text,
  district text,
  keywords text[] default '{}',
  tracked_politicians jsonb default '[]',
  tracked_ministries text[] default '{}',
  tracked_parties text[] default '{}',
  tracked_schemes text[] default '{}',
  languages text[] default '{english}',
  geo_scope jsonb default '[]',
  alert_prefs jsonb default '{"red_sms":false,"red_push":false,"red_email":false,"yellow_push":false,"yellow_email":false}',
  contact_email text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- AI briefs
create table if not exists bm_analysis (
  id text primary key default gen_random_uuid()::text,
  account_id text not null,
  summary text,
  opposition_activity text,
  top_narratives text[] default '{}',
  ticker_items jsonb default '[]',
  created_at timestamptz default now()
);

-- Contradictions (AI Quote Checker output)
create table if not exists contradictions (
  id text primary key,
  feed_item_id text,
  account_id text not null,
  politician_name text,
  current_quote text,
  historical_quote text,
  historical_date text,
  historical_source text,
  contradiction_score integer default 0,
  contradiction_type text default 'contradiction',
  evidence_source text,
  status text default 'flagged',
  created_at timestamptz default now()
);
create index if not exists contradictions_account_idx on contradictions(account_id);
```

---

## STEP 3 — Supabase: deploy edge functions

```bash
npm install -g supabase
supabase login
supabase link --project-ref ylajerluygbeiqybkgtx

# Deploy all three functions
supabase functions deploy bm-ingest-v2
supabase functions deploy bm-sentiment
supabase functions deploy bm-contradiction-check

# Set secrets for edge functions
supabase secrets set \
  ANTHROPIC_API_KEY=sk-ant-YOUR_KEY \
  YT_API_KEY=AIzaSyBVa-IYLJ9jv-AIRa8KPcfWSejhBE7zL1w \
  META_ACCESS_TOKEN=EAF5yji...
```

---

## STEP 4 — Vercel: deploy

1. Go to https://vercel.com → Add New Project
2. Import GitHub repo `bharatmonitor`
3. Set **Root Directory** → `bharatmonitor_rebuilt`
4. Framework: **Vite** (auto-detected)
5. Add these **Environment Variables** (Settings → Environment Variables):

| Key | Value |
|-----|-------|
| VITE_SUPABASE_URL | https://ylajerluygbeiqybkgtx.supabase.co |
| VITE_SUPABASE_ANON_KEY | sb_publishable_... |
| VITE_SUPABASE_SERVICE_KEY | eyJhbGci... (the full service role JWT) |
| VITE_GOOGLE_CSE_KEY | AIzaSyCSp3s... |
| VITE_GOOGLE_CSE_CX | c6115d16294f64f6a |
| VITE_SERP_API_KEY | 9c5ba349... |
| VITE_YOUTUBE_KEY | AIzaSyBVa... |
| VITE_META_ACCESS_TOKEN | EAF5yji... |
| VITE_SENTRY_DSN | https://8ad3...@sentry.io/... |
| VITE_HUGGINGFACE_KEY | hf_GwUl... |
| VITE_RESEND_KEY | re_PQoWq... |
| VITE_UPSTASH_REDIS_REST_URL | https://intimate-mustang-78714.upstash.io |
| VITE_UPSTASH_REDIS_REST_TOKEN | gQAAAA... |

6. Click **Deploy**

---

## STEP 5 — Verify

1. Visit your Vercel URL → login: `god@bharatmonitor.in / BM@God2024!`
2. Open DevTools → Sources → search `eyJhbGci` → should return **0 results** (key not in bundle)
3. Open DevTools → Network → check feeds are loading (bm_feed, Google News RSS)
4. Click any feed card with politician quotes → click "⚡ CHECK FOR CONTRADICTIONS"
5. Contradiction checker should scan historical record and return results

---

## Credentials

| Email | Password | Role |
|-------|----------|------|
| god@bharatmonitor.in | BM@God2024! | God Mode (full admin) |
| modi@bharatmonitor.in | Demo@Modi2024 | Demo (elections tier) |
