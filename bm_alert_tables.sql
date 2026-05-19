-- BharatMonitor Alert System Tables
-- Run this in Supabase SQL Editor

-- Alert log table (rate limiting + history)
CREATE TABLE IF NOT EXISTS bm_alert_log (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  account_id  text NOT NULL,
  channel     text NOT NULL,  -- 'email' | 'sms' | 'whatsapp'
  headline    text,
  sent_at     timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS bm_alert_log_account_sent 
  ON bm_alert_log(account_id, sent_at DESC);

-- Add phone/whatsapp fields to accounts if missing
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS contact_phone    text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS whatsapp_number  text;
ALTER TABLE accounts ADD COLUMN IF NOT EXISTS alert_prefs      jsonb DEFAULT '{"red_email":true,"red_sms":false,"red_push":false,"yellow_email":false,"yellow_push":false}';

-- Verify
SELECT 'bm_alert_log created' as status;
