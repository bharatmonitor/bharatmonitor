-- ingest_log: one row per ingest run per account. Powers the God Mode usage panel.
create table if not exists public.ingest_log (
  id            bigint generated always as identity primary key,
  account_id    text not null,
  run_at        timestamptz not null default now(),
  national_mode boolean default false,
  inserted      int default 0,        -- rows written to bm_feed this run
  raw_total     int default 0,        -- items fetched before dedup
  crisis        int default 0,
  ai_used       boolean default false,
  by_platform   jsonb default '{}'::jsonb,   -- { news: 12, youtube: 4, ... }
  status        text default 'ok',
  error         text
);
create index if not exists ingest_log_account_idx on public.ingest_log (account_id, run_at desc);

alter table public.ingest_log enable row level security;
-- God/admin reads via service role (edge functions). Optional: allow account owners to read their own.
create policy "own ingest_log readable" on public.ingest_log
  for select using (auth.uid()::text = account_id);
