-- ============================================================
-- BharatMonitor: Add excluded_keywords column + RLS fix
-- Run in: Supabase SQL Editor
-- ============================================================

-- 1. Add excluded_keywords column to accounts table
ALTER TABLE accounts 
ADD COLUMN IF NOT EXISTS excluded_keywords jsonb DEFAULT '[]'::jsonb;

-- 2. Fix RLS so report page can read accounts in new tab
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'accounts' 
    AND policyname = 'accounts_select_by_id'
  ) THEN
    CREATE POLICY "accounts_select_by_id" 
    ON accounts FOR SELECT 
    USING (true);
  END IF;
END $$;

-- 3. Verify
SELECT id, politician_name, excluded_keywords 
FROM accounts 
WHERE id = 'BM-2026-QI952U99';
