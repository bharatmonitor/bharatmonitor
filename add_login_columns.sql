-- Add login credential columns to accounts table
-- These store the BharatMonitor platform login (not Supabase Auth)
-- Allows God Mode to set/update passwords that work across all devices

ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_email    text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_password text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_name     text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_role     text default 'user';
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS login_tier     text default 'elections';

-- Index for fast login lookup
CREATE INDEX IF NOT EXISTS accounts_login_email_idx ON accounts(login_email);

-- Verify
SELECT id, politician_name, login_email, login_password 
FROM accounts 
WHERE login_email IS NOT NULL 
LIMIT 5;

-- Add national_mode column to bm_feed for national discourse tracking
ALTER TABLE bm_feed ADD COLUMN IF NOT EXISTS national_mode boolean default false;
ALTER TABLE bm_feed ADD COLUMN IF NOT EXISTS watchlist_source text;

CREATE INDEX IF NOT EXISTS bm_feed_national_idx ON bm_feed(account_id, national_mode);
