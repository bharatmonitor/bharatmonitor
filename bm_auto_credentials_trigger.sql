-- ═══════════════════════════════════════════════════════════════════
-- BharatMonitor — Auto-Credential Trigger
-- Run this ONCE in Supabase SQL Editor
-- After this, every new account gets login credentials automatically.
-- No manual SQL needed ever again.
-- ═══════════════════════════════════════════════════════════════════

-- ─── Step 1: Make sure login columns exist ──────────────────────────
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_email    text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_password text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_name     text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_role     text DEFAULT 'user';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_tier     text DEFAULT 'elections';

-- Index for fast login lookup
CREATE INDEX IF NOT EXISTS accounts_login_email_idx 
  ON accounts(login_email);

-- Also make sure bm_feed has the extra columns
ALTER TABLE bm_feed ADD COLUMN IF NOT EXISTS national_mode    boolean DEFAULT false;
ALTER TABLE bm_feed ADD COLUMN IF NOT EXISTS watchlist_source text;

-- ─── Step 2: The trigger function ────────────────────────────────────
-- Fires on every INSERT or UPDATE.
-- Rules:
--   1. If login_email is NULL → generate from contact_email or politician_name
--   2. If login_password is NULL or empty → set to 'demo@1234'
--   3. If login_name is NULL → copy politician_name
--   4. Never overwrite credentials that are already set (only fills blanks)

CREATE OR REPLACE FUNCTION bm_auto_set_login_credentials()
RETURNS TRIGGER AS $$
DECLARE
  generated_email text;
  clean_name text;
BEGIN
  -- Only fill in credentials that are missing
  -- Never overwrite if already set
  
  -- 1. Auto-generate login_email if missing
  IF NEW.login_email IS NULL OR NEW.login_email = '' THEN
    -- Prefer contact_email if available
    IF NEW.contact_email IS NOT NULL AND NEW.contact_email != '' THEN
      NEW.login_email := lower(trim(NEW.contact_email));
    ELSE
      -- Generate from politician_name + last 4 chars of id
      clean_name := lower(regexp_replace(
        coalesce(NEW.politician_name, 'user'), 
        '[^a-z0-9]', '.', 'g'
      ));
      -- Remove consecutive dots and trailing dots
      clean_name := regexp_replace(clean_name, '\.{2,}', '.', 'g');
      clean_name := rtrim(clean_name, '.');
      NEW.login_email := clean_name || '.' || right(NEW.id, 4) || '@bharatmonitor.in';
      -- Make lowercase
      NEW.login_email := lower(NEW.login_email);
    END IF;
  END IF;

  -- 2. Set default password if missing
  IF NEW.login_password IS NULL OR NEW.login_password = '' THEN
    NEW.login_password := 'demo@1234';
  END IF;

  -- 3. Set login_name from politician_name if missing
  IF NEW.login_name IS NULL OR NEW.login_name = '' THEN
    NEW.login_name := coalesce(NEW.politician_name, 'User');
  END IF;

  -- 4. Set default role and tier
  IF NEW.login_role IS NULL OR NEW.login_role = '' THEN
    NEW.login_role := 'user';
  END IF;
  IF NEW.login_tier IS NULL OR NEW.login_tier = '' THEN
    NEW.login_tier := 'elections';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ─── Step 3: Attach trigger to accounts table ─────────────────────────
-- Drop first if exists (safe to re-run)
DROP TRIGGER IF EXISTS trg_auto_set_login_credentials ON accounts;

CREATE TRIGGER trg_auto_set_login_credentials
  BEFORE INSERT OR UPDATE ON accounts
  FOR EACH ROW
  EXECUTE FUNCTION bm_auto_set_login_credentials();

-- ─── Step 4: Fix ALL existing accounts that have NULL credentials ─────
-- This runs once to backfill everyone already in the database

UPDATE accounts SET
  login_email = CASE 
    WHEN login_email IS NOT NULL AND login_email != '' THEN login_email
    WHEN contact_email IS NOT NULL AND contact_email != '' THEN lower(trim(contact_email))
    ELSE lower(regexp_replace(
           regexp_replace(coalesce(politician_name,'user'), '[^a-zA-Z0-9]', '.', 'g'),
           '\.{2,}', '.', 'g'
         )) || '.' || right(id, 4) || '@bharatmonitor.in'
  END,
  login_password = CASE 
    WHEN login_password IS NOT NULL AND login_password != '' THEN login_password
    ELSE 'demo@1234'
  END,
  login_name = CASE
    WHEN login_name IS NOT NULL AND login_name != '' THEN login_name
    ELSE coalesce(politician_name, 'User')
  END,
  login_role = CASE
    WHEN login_role IS NOT NULL AND login_role != '' THEN login_role
    ELSE 'user'
  END,
  login_tier = CASE
    WHEN login_tier IS NOT NULL AND login_tier != '' THEN login_tier
    ELSE 'elections'
  END,
  updated_at = now()
WHERE 
  login_email IS NULL 
  OR login_password IS NULL
  OR login_name IS NULL;

-- ─── Step 5: Verify everything looks correct ──────────────────────────
SELECT 
  id,
  politician_name,
  login_email,
  login_password,
  login_name,
  login_role
FROM accounts 
ORDER BY created_at DESC;
