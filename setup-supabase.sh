#!/bin/bash
# BharatMonitor — Supabase schema setup
# Run once to create all required tables
# Usage: bash setup-supabase.sh
# Or paste the SQL directly into your Supabase SQL editor

echo "=== BharatMonitor Supabase Setup ==="
echo "Paste the SQL below into your Supabase SQL Editor at:"
echo "https://supabase.com/dashboard/project/bmxrsfyaujcppaqvtnfx/sql"
echo ""
cat << 'SQL'
-- BharatMonitor full schema
-- Run this in Supabase SQL Editor

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
  url text,
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
create index if not exists bm_feed_url_idx on bm_feed(url) where url is not null;

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

create table if not exists bm_analysis (
  id text primary key default gen_random_uuid()::text,
  account_id text not null,
  summary text,
  opposition_activity text,
  top_narratives text[] default '{}',
  ticker_items jsonb default '[]',
  created_at timestamptz default now()
);
create index if not exists bm_analysis_account_idx on bm_analysis(account_id);

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
  reasoning text,
  confidence float default 0,
  status text default 'flagged',
  created_at timestamptz default now()
);
create index if not exists contradictions_account_idx on contradictions(account_id);
create index if not exists contradictions_created_idx on contradictions(created_at desc);

-- Enable Realtime on feed_items and contradictions
alter publication supabase_realtime add table feed_items;
alter publication supabase_realtime add table contradictions;

select 'Schema setup complete!' as status;
SQL
