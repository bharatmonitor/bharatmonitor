-- ─────────────────────────────────────────────────────────────────────────────
-- Add account: Vishnu Deo Sai (BJP, Chhattisgarh) — from the New Account wizard.
-- Login:  shubhangi@hertzmsc.com  /  demo@1234
-- Competitor tracked: Bhupesh Baghel (INC)
-- Idempotent: safe to re-run (updates the row on matching id).
-- Paste into Supabase → SQL Editor → Run.
-- ─────────────────────────────────────────────────────────────────────────────
insert into public.accounts (
  id, user_id, created_by, is_active,
  politician_name, politician_initials, party,
  designation, constituency, constituency_type, state, district,
  account_type,
  keywords, tracked_politicians, tracked_ministries, tracked_parties, tracked_schemes,
  languages, geo_scope, alert_prefs,
  contact_email, contact_phone, email,
  login_email, login_password, login_name, login_role, login_tier,
  created_at, updated_at
) values (
  'BM-2026-VDS001',
  'BM-2026-VDS001',                 -- user_id = id so getAccount() resolves by id
  'god-account',                    -- created_by (created via God Mode)
  true,
  'Vishnu Deo Sai', 'VS', 'BJP',
  '', '', 'vidhan_sabha', 'Chhattisgarh', '',
  'politician',
  '["Vishnu Deo Sai"]'::jsonb,
  '[{"id":"comp-baghel","name":"Bhupesh Baghel","party":"INC","initials":"BB","role":"Former Chief Minister","is_competitor":true}]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '[]'::jsonb,
  '["english","hindi","maithili"]'::jsonb,
  '[{"level":"state","name":"Chhattisgarh","state":"Chhattisgarh"},{"level":"national","name":"India","state":"Chhattisgarh"}]'::jsonb,
  '{}'::jsonb,
  'shubhangi@hertzmsc.com', null, 'shubhangi@hertzmsc.com',
  'shubhangi@hertzmsc.com', 'demo@1234', 'Vishnu Deo Sai', 'user', 'elections',
  now(), now()
)
on conflict (id) do update set
  politician_name     = excluded.politician_name,
  politician_initials = excluded.politician_initials,
  party               = excluded.party,
  constituency_type   = excluded.constituency_type,
  state               = excluded.state,
  keywords            = excluded.keywords,
  tracked_politicians = excluded.tracked_politicians,
  languages           = excluded.languages,
  geo_scope           = excluded.geo_scope,
  contact_email       = excluded.contact_email,
  email               = excluded.email,
  login_email         = excluded.login_email,
  login_password      = excluded.login_password,
  login_name          = excluded.login_name,
  login_tier          = excluded.login_tier,
  is_active           = true,
  updated_at          = now();

-- Verify
select id, politician_name, party, login_email, login_tier,
       keywords, tracked_politicians, languages, geo_scope
from public.accounts
where id = 'BM-2026-VDS001';
