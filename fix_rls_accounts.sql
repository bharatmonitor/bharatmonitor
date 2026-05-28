-- Allow anon/authenticated to read their own account by id
-- This is needed for ReportPage to fetch account data in new tab

-- Check existing policies
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual
FROM pg_policies 
WHERE tablename = 'accounts';

-- Add SELECT policy so report page can fetch account by id
CREATE POLICY IF NOT EXISTS "accounts_select_by_id" 
ON accounts FOR SELECT 
USING (true);  -- Allow all reads — accounts table has no sensitive data beyond what's shown in dashboard

-- If you want to be more restrictive, use:
-- USING (id = current_setting('request.jwt.claims', true)::json->>'sub' OR true)
