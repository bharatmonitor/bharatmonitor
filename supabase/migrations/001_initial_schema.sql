-- ============================================================
-- BharatMonitor — Initial Schema
-- Run via: supabase db push
-- ============================================================

-- Enable UUID generation
-- ── User profiles ─────────────────────────────────────────────
create table if not exists public.user_profiles (
  id        uuid primary key references auth.users(id) on delete cascade,
  role      text not null default 'user'
            check (role in ('god', 'admin', 'user')),
  created_at timestamptz default now()
);
alter table public.user_profiles enable row level security;
create policy "Users read own profile" on public.user_profiles
  for select using (auth.uid() = id);

-- ── Accounts ──────────────────────────────────────────────────
create table if not exists public.accounts (
  id                    uuid primary key default gen_random_uuid(),
  user_id               uuid references auth.users(id),
  created_by            uuid references auth.users(id),
  is_active             boolean default true,
  politician_name       text not null,
  politician_initials   text,
  party                 text,
  designation           text,
  constituency          text,
  constituency_type     text default 'lok_sabha',
  state                 text,
  district              text,
  keywords              text[] default '{}',
  tracked_politicians   jsonb default '[]',
  tracked_ministries    text[] default '{}',
  tracked_parties       text[] default '{}',
  tracked_schemes       text[] default '{}',
  languages             text[] default '{english}',
  geo_scope             jsonb default '[]',
  alert_prefs           jsonb default '{}',
  contact_email         text,
  created_at            timestamptz default now(),
  updated_at            timestamptz default now()
);
alter table public.accounts enable row level security;
create policy "Users read own account" on public.accounts
  for select using (user_id = auth.uid());
create policy "Service role full access accounts" on public.accounts
  for all using (true);

-- ── Feed items ────────────────────────────────────────────────
create table if not exists public.feed_items (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid references public.accounts(id) on delete cascade,
  platform      text not null,
  bucket        text not null check (bucket in ('red','yellow','blue','silver')),
  sentiment     text check (sentiment in ('positive','negative','neutral','mixed')),
  headline      text not null,
  source        text,
  url           text,
  youtube_id    text,
  channel       text,
  geo_tags      text[] default '{}',
  topic_tags    text[] default '{}',
  language      text default 'english',
  engagement    bigint,
  views         bigint,
  shares        bigint,
  is_trending   boolean default false,
  trend_rank    integer,
  published_at  timestamptz default now(),
  fetched_at    timestamptz default now()
);
create index feed_account_bucket on public.feed_items(account_id, bucket, published_at desc);
create index feed_account_time   on public.feed_items(account_id, published_at desc);
alter table public.feed_items enable row level security;
create policy "Users read own feed" on public.feed_items
  for select using (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );
create policy "Service role feed" on public.feed_items for all using (true);

-- ── Contradictions ────────────────────────────────────────────
create table if not exists public.contradictions (
  id                    uuid primary key default gen_random_uuid(),
  feed_item_id          uuid references public.feed_items(id) on delete cascade,
  account_id            uuid references public.accounts(id) on delete cascade,
  politician_name       text not null,
  current_quote         text,
  historical_quote      text,
  historical_date       date,
  historical_source     text,
  contradiction_score   integer check (contradiction_score between 0 and 100),
  contradiction_type    text,
  evidence_source       text,
  status                text default 'flagged',
  created_at            timestamptz default now()
);
alter table public.contradictions enable row level security;
create policy "Users read own contradictions" on public.contradictions
  for select using (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );
create policy "Service role contradictions" on public.contradictions for all using (true);

-- ── AI briefs ─────────────────────────────────────────────────
create table if not exists public.ai_briefs (
  id                  uuid primary key default gen_random_uuid(),
  account_id          uuid references public.accounts(id) on delete cascade,
  situation_summary   text,
  pattern_analysis    text,
  opportunities       jsonb default '[]',
  ticker_items        jsonb default '[]',
  generated_at        timestamptz default now(),
  next_refresh_at     timestamptz
);
alter table public.ai_briefs enable row level security;
create policy "Users read own briefs" on public.ai_briefs
  for select using (
    account_id in (select id from public.accounts where user_id = auth.uid())
  );
create policy "Service role briefs" on public.ai_briefs for all using (true);

-- ── Quote archive ─────────────────────────────────────────────
create table if not exists public.quote_archive (
  id               uuid primary key default gen_random_uuid(),
  politician_name  text not null,
  quote            text not null,
  quote_date       date,
  source           text,
  language         text default 'english',
  created_at       timestamptz default now()
);
create index quote_politician on public.quote_archive(politician_name, quote_date desc);
alter table public.quote_archive enable row level security;
create policy "Everyone reads quotes" on public.quote_archive for select using (true);
create policy "Service role quotes" on public.quote_archive for all using (true);

-- ── RSS feeds ─────────────────────────────────────────────────
create table if not exists public.rss_feeds (
  id         uuid primary key default gen_random_uuid(),
  url        text not null unique,
  name       text not null,
  language   text default 'english',
  tier       integer default 1,
  is_active  boolean default true,
  created_at timestamptz default now()
);
alter table public.rss_feeds enable row level security;
create policy "Everyone reads feeds" on public.rss_feeds for select using (true);
create policy "Service role rss" on public.rss_feeds for all using (true);

-- ── Access requests ───────────────────────────────────────────
create table if not exists public.access_requests (
  id             uuid primary key default gen_random_uuid(),
  name           text not null,
  email          text not null,
  org            text,
  constituency   text,
  tier_interest  text default 'basic',
  message        text,
  status         text default 'pending',
  created_at     timestamptz default now()
);
alter table public.access_requests enable row level security;
create policy "Service role requests" on public.access_requests for all using (true);

-- ── Seed: RSS feeds ───────────────────────────────────────────
insert into public.rss_feeds (url, name, language, tier) values
  ('https://feeds.feedburner.com/ndtvnews-top-stories', 'NDTV', 'english', 1),
  ('https://www.thehindu.com/news/national/feeder/default.rss', 'The Hindu', 'english', 1),
  ('https://aninews.in/rss/', 'ANI', 'english', 1),
  ('https://pib.gov.in/RssMain.aspx?ModId=6&Lang=1&Regid=3', 'PIB', 'english', 1),
  ('https://indianexpress.com/feed/', 'Indian Express', 'english', 2),
  ('https://thewire.in/rss', 'The Wire', 'english', 2),
  ('https://theprint.in/feed/', 'The Print', 'english', 2),
  ('https://economictimes.indiatimes.com/rssfeedsdefault.cms', 'Economic Times', 'english', 2),
  ('https://www.livemint.com/rss/news', 'LiveMint', 'english', 2),
  ('https://www.bhaskar.com/rss-feed/1061/', 'Dainik Bhaskar', 'hindi', 1),
  ('https://www.amarujala.com/rss/breaking-news.xml', 'Amar Ujala', 'hindi', 2),
  ('https://www.jagran.com/rss/news-national.xml', 'Dainik Jagran', 'hindi', 1),
  ('https://navbharattimes.indiatimes.com/rssfeedsdefault.cms', 'Navbharat Times', 'hindi', 2),
  ('https://www.manoramaonline.com/rss.xml', 'Manorama', 'malayalam', 2),
  ('https://www.dinamalar.com/rss.asp', 'Dinamalar', 'tamil', 2),
  ('https://www.eenadu.net/rss.xml', 'Eenadu', 'telugu', 2)
on conflict (url) do nothing;

-- ── Seed: Quote archive ───────────────────────────────────────
insert into public.quote_archive (politician_name, quote, quote_date, source) values
  ('Rahul Gandhi', 'We support farm law repeal but MSP implementation under UPA was not fully successful in our own states.', '2021-12-01', 'Rajya Sabha Debate'),
  ('Arvind Kejriwal', 'AAP received electoral bonds worth Rs 10 crore in September 2022.', '2022-09-15', 'Election Commission Filing'),
  ('Mamata Banerjee', 'West Bengal is entitled to maximum central funds under cooperative federalism.', '2022-03-10', 'Press Conference Kolkata'),
  ('Akhilesh Yadav', 'We supported UPA government policies including economic reforms during 2009-2014.', '2013-06-01', 'Lok Sabha Record'),
  ('Narendra Modi', 'India should be open to all digital transaction forms that empower citizens and bring financial inclusion.', '2015-07-01', 'Digital India Launch'),
  ('Amit Shah', 'BJP will strengthen and expand MGNREGA to truly serve the rural poor.', '2014-03-15', 'BJP 2014 Manifesto')
on conflict do nothing;
