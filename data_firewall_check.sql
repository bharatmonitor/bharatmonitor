-- BharatMonitor: Data Firewall Verification + Cleanup
-- Run in Supabase SQL Editor

-- 1. Check what accounts have data in bm_feed
SELECT account_id, COUNT(*) as item_count, 
       MIN(published_at) as oldest,
       MAX(published_at) as newest
FROM bm_feed 
GROUP BY account_id
ORDER BY item_count DESC;

-- 2. Check keywords stored against VDS account
SELECT id, politician_name, keywords
FROM accounts
WHERE id = 'BM-2026-QI952U99';

-- 3. Verify VDS feed is isolated (should only show VDS items)
SELECT keyword, COUNT(*) as count
FROM bm_feed
WHERE account_id = 'BM-2026-QI952U99'
GROUP BY keyword
ORDER BY count DESC
LIMIT 20;

-- 4. If you see "Cabinet India" or Modi keywords in VDS feed, 
--    it means an ingest ran with wrong accountId. Clean up:
-- DELETE FROM bm_feed 
-- WHERE account_id = 'BM-2026-QI952U99'
--   AND keyword NOT IN (
--     SELECT jsonb_array_elements_text(keywords)
--     FROM accounts WHERE id = 'BM-2026-QI952U99'
--   );
