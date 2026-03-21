-- ── Historical feed table ─────────────────────────────────────────────────────
create table if not exists public.historical_feed (
  id            uuid primary key default gen_random_uuid(),
  account_id    text not null,
  source_type   text not null,  -- gdelt, meta_ad, youtube, google_news, rss
  keyword       text,
  title         text,
  url           text unique,
  source_name   text,
  published_at  timestamptz,
  tone          float default 0,
  spend_min     integer default 0,
  spend_max     integer default 0,
  country       text default 'India',
  fetched_at    timestamptz default now(),
  created_at    timestamptz default now()
);

create index if not exists historical_feed_account_idx on public.historical_feed(account_id);
create index if not exists historical_feed_source_idx  on public.historical_feed(source_type);
create index if not exists historical_feed_date_idx    on public.historical_feed(published_at desc);
create index if not exists historical_feed_keyword_idx on public.historical_feed(keyword);

alter table public.historical_feed enable row level security;
create policy "Anyone reads historical" on public.historical_feed for select using (true);
create policy "Service role historical" on public.historical_feed for all using (true);

-- ── Meta ads table ────────────────────────────────────────────────────────────
create table if not exists public.meta_ads (
  id            uuid primary key default gen_random_uuid(),
  ad_id         text unique,
  account_id    text,
  party_key     text,
  party_name    text,
  party_abbr    text,
  page_id       text,
  color         text,
  ad_text       text,
  spend_lower   integer default 0,
  spend_upper   integer default 0,
  impressions_lower integer default 0,
  impressions_upper integer default 0,
  start_date    timestamptz,
  end_date      timestamptz,
  is_active     boolean default true,
  snapshot_url  text,
  top_states    text,
  fetched_at    timestamptz default now()
);

create index if not exists meta_ads_party_idx  on public.meta_ads(party_key);
create index if not exists meta_ads_date_idx   on public.meta_ads(start_date desc);
create index if not exists meta_ads_active_idx on public.meta_ads(is_active);

alter table public.meta_ads enable row level security;
create policy "Anyone reads meta_ads" on public.meta_ads for select using (true);
create policy "Service role meta_ads" on public.meta_ads for all using (true);
