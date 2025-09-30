-- Verify RLS Policies and Test Queries
-- Run this in Supabase SQL Editor to verify everything is working

-- 1. Check current RLS status
SELECT
  schemaname,
  tablename,
  rowsecurity as "RLS Enabled"
FROM pg_tables
WHERE schemaname = 'public'
AND tablename IN ('organizations', 'organization_users', 'members', 'attendance_logs')
ORDER BY tablename;

-- 2. List all current policies
SELECT
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies
WHERE schemaname = 'public'
ORDER BY tablename, policyname;

-- 3. Test if we can query organization_users
SELECT COUNT(*) as "organization_users_count" FROM organization_users;

-- 4. Test if we can query organizations
SELECT COUNT(*) as "organizations_count" FROM organizations;

-- 5. Test the exact query that's failing in the app
SELECT
  ou.*,
  o.id as org_id,
  o.name as org_name
FROM organization_users ou
LEFT JOIN organizations o ON ou.organization_id = o.id
WHERE ou.email = 'test@example.com'
AND ou.is_active = true;

-- 6. Check api_key column type
SELECT
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns
WHERE table_name IN ('organizations', 'api_key_usage')
AND column_name = 'api_key';

-- 7. Check role constraint
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint
WHERE conname = 'organization_users_role_check';

SELECT '✅ Verification complete! Review results above.' as status;