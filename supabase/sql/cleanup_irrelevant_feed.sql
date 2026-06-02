-- Remove already-ingested items that don't actually mention the account's
-- tracked keywords (the bug fixed in bm-ingest-v2). New ingests are now gated,
-- so this is a one-time backfill cleanup. Replace <ACCOUNT_ID> and run PREVIEW
-- first, then the DELETE.

-- ── PREVIEW (safe, read-only): what would be removed ──────────────────────────
select f.id, f.source, f.headline
from bm_feed f
where f.account_id = '<ACCOUNT_ID>'
  and coalesce(f.national_mode, false) = false
  and not exists (
    select 1
    from accounts a, lateral unnest(a.keywords) kw           -- keywords is text[]
    where a.id = f.account_id
      and position(lower(kw) in lower(f.headline || ' ' || coalesce(f.body,''))) > 0
  )
order by f.fetched_at desc;

-- If accounts.keywords is JSONB instead of text[], swap the unnest line for:
--   from accounts a, lateral jsonb_array_elements_text(a.keywords) kw

-- ── DELETE (run only after reviewing the preview) ────────────────────────────
-- delete from bm_feed f
-- where f.account_id = '<ACCOUNT_ID>'
--   and coalesce(f.national_mode, false) = false
--   and not exists (
--     select 1 from accounts a, lateral unnest(a.keywords) kw
--     where a.id = f.account_id
--       and position(lower(kw) in lower(f.headline || ' ' || coalesce(f.body,''))) > 0
--   );
