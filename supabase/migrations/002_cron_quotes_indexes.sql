-- ============================================================
-- Migration 002 — Cron Jobs + Quote Archive + Indexes
-- ============================================================

-- Enable pg_cron (requires Supabase Pro or self-hosted)
-- create extension if not exists pg_cron;

-- ─── Cron job schedule ────────────────────────────────────────────────────────
-- Uncomment and adjust after enabling pg_cron:

-- Every 2 minutes: red bucket (crisis) refresh
-- select cron.schedule('red-fetch', '*/2 * * * *', $$
--   select net.http_post(
--     url := current_setting('app.supabase_url') || '/functions/v1/scheduler',
--     headers := '{"Content-Type":"application/json","Authorization":"Bearer ' || current_setting('app.service_key') || '"}'::jsonb,
--     body := '{"trigger":"red-cron"}'::jsonb
--   );
-- $$);

-- Every 10 minutes: yellow bucket refresh
-- select cron.schedule('yellow-fetch', '*/10 * * * *', $$
--   select net.http_post(url := ..., body := '{"trigger":"yellow-cron"}'::jsonb);
-- $$);

-- Every 30 minutes: full fetch including YouTube
-- select cron.schedule('full-fetch', '*/30 * * * *', $$
--   select net.http_post(url := ..., body := '{"trigger":"full-cron"}'::jsonb);
-- $$);

-- Every 6 hours: AI brief regeneration
-- select cron.schedule('ai-brief', '0 */6 * * *', $$
--   select net.http_post(url := ..., body := '{"trigger":"brief-cron"}'::jsonb);
-- $$);

-- ─── Quote Archive seed data ──────────────────────────────────────────────────
-- Historical quotes for contradiction detection bootstrapping

insert into public.quote_archive (politician_name, quote, quote_date, source, language) values
  ('Amit Shah',      'BJP will strengthen and expand MGNREGA to serve the rural poor',                          '2019-03-14', 'Rajasthan Rally',       'hindi'),
  ('Narendra Modi',  'MGNREGA will be expanded and strengthened to provide more rural employment',              '2014-05-26', 'Inaugural Address',     'english'),
  ('Narendra Modi',  'Farmers doubling income is our topmost priority — we will ensure it by 2022',            '2016-02-28', 'Budget Statement',      'english'),
  ('Rahul Gandhi',   'UPA government created more jobs than any government in Indian history',                  '2013-11-20', 'Congress Rally',        'english'),
  ('Rahul Gandhi',   'We support farm law repeal but MSP implementation in our own states was not perfect',    '2021-12-01', 'Rajya Sabha Debate',    'english'),
  ('Arvind Kejriwal','AAP received electoral bonds worth Rs 10 crore in September 2022',                       '2022-09-15', 'EC Filing',             'english'),
  ('Mamata Banerjee','West Bengal is entitled to maximum central funds under cooperative federalism',           '2022-03-10', 'Press Conference',      'english'),
  ('Akhilesh Yadav', 'We supported UPA government policies including economic reforms 2009 to 2014',           '2013-06-01', 'Lok Sabha Record',      'hindi'),
  ('Ashwini Vaishnaw','Railway capex has increased 9x since 2014 making it the largest in Indian history',     '2024-02-01', 'Budget Press Conf',     'english'),
  ('Ashwini Vaishnaw','Kavach anti-collision system will be deployed across entire Indian Railways network',    '2023-03-15', 'Ministry Statement',    'english')
on conflict do nothing;

-- ── Indexes ───────────────────────────────────────────────────────────────────
create index if not exists feed_items_account_bucket   on public.feed_items(account_id, bucket, published_at desc);
create index if not exists feed_items_account_time     on public.feed_items(account_id, published_at desc);
create index if not exists feed_items_trending         on public.feed_items(is_trending, published_at desc) where is_trending = true;
create index if not exists contradictions_account      on public.contradictions(account_id, contradiction_score desc);
create index if not exists quote_archive_politician    on public.quote_archive(politician_name, quote_date desc);
