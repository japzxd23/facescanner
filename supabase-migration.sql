-- =====================================================
-- Supabase Migration for Google OAuth Authentication
-- Run this in your Supabase SQL Editor
-- =====================================================

-- 1. Add google_id column to organization_users table
-- This links Supabase Auth users to organization users
ALTER TABLE organization_users
ADD COLUMN IF NOT EXISTS google_id UUID REFERENCES auth.users(id) ON DELETE CASCADE;

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_organization_users_google_id
ON organization_users(google_id);

-- 2. Create security_events table for audit logging
CREATE TABLE IF NOT EXISTS security_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('info', 'low', 'medium', 'high', 'critical')),
  details JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Create indexes for security_events
CREATE INDEX IF NOT EXISTS idx_security_events_org_id ON security_events(organization_id);
CREATE INDEX IF NOT EXISTS idx_security_events_user_id ON security_events(user_id);
CREATE INDEX IF NOT EXISTS idx_security_events_created_at ON security_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_security_events_severity ON security_events(severity);
CREATE INDEX IF NOT EXISTS idx_security_events_type ON security_events(event_type);

-- 3. Enable Row Level Security (RLS) on security_events
ALTER TABLE security_events ENABLE ROW LEVEL SECURITY;

-- Policy: Users can view security events for their organization
CREATE POLICY "Users can view their organization's security events"
ON security_events FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM organization_users
    WHERE google_id = auth.uid()
  )
);

-- Policy: System can insert security events
CREATE POLICY "System can insert security events"
ON security_events FOR INSERT
WITH CHECK (true);

-- 4. Update organizations table (if needed)
-- Add columns if they don't exist
ALTER TABLE organizations
ADD COLUMN IF NOT EXISTS subdomain TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS api_key TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS plan_type TEXT DEFAULT 'free',
ADD COLUMN IF NOT EXISTS member_limit INTEGER DEFAULT 100,
ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_organizations_subdomain ON organizations(subdomain);
CREATE INDEX IF NOT EXISTS idx_organizations_api_key ON organizations(api_key);

-- 5. Update organization_users table
-- Ensure role column exists with proper check constraint
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'organization_users' AND column_name = 'role'
  ) THEN
    ALTER TABLE organization_users ADD COLUMN role TEXT DEFAULT 'operator';
  END IF;
END $$;

-- Add check constraint for roles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'organization_users_role_check'
  ) THEN
    ALTER TABLE organization_users
    ADD CONSTRAINT organization_users_role_check
    CHECK (role IN ('owner', 'admin', 'operator', 'viewer'));
  END IF;
END $$;

-- 6. Create function to clean old security events (older than 90 days)
CREATE OR REPLACE FUNCTION clean_old_security_events()
RETURNS void AS $$
BEGIN
  DELETE FROM security_events
  WHERE created_at < NOW() - INTERVAL '90 days';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 7. Create a scheduled job to clean old security events (optional)
-- Note: This requires pg_cron extension
-- SELECT cron.schedule('clean-security-events', '0 2 * * *', 'SELECT clean_old_security_events()');

-- 8. Update RLS policies for existing tables to work with Supabase Auth

-- Update members table RLS (if exists)
ALTER TABLE members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their organization's members" ON members;
CREATE POLICY "Users can view their organization's members"
ON members FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM organization_users
    WHERE google_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert members" ON members;
CREATE POLICY "Users can insert members"
ON members FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM organization_users
    WHERE google_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Users can update members" ON members;
CREATE POLICY "Users can update members"
ON members FOR UPDATE
USING (
  organization_id IN (
    SELECT organization_id
    FROM organization_users
    WHERE google_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

DROP POLICY IF EXISTS "Users can delete members" ON members;
CREATE POLICY "Users can delete members"
ON members FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id
    FROM organization_users
    WHERE google_id = auth.uid()
    AND role = 'owner'
  )
);

-- Update attendance_logs table RLS (if exists)
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users can view their organization's logs" ON attendance_logs;
CREATE POLICY "Users can view their organization's logs"
ON attendance_logs FOR SELECT
USING (
  organization_id IN (
    SELECT organization_id
    FROM organization_users
    WHERE google_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can insert attendance logs" ON attendance_logs;
CREATE POLICY "Users can insert attendance logs"
ON attendance_logs FOR INSERT
WITH CHECK (
  organization_id IN (
    SELECT organization_id
    FROM organization_users
    WHERE google_id = auth.uid()
  )
);

DROP POLICY IF EXISTS "Users can delete logs" ON attendance_logs;
CREATE POLICY "Users can delete logs"
ON attendance_logs FOR DELETE
USING (
  organization_id IN (
    SELECT organization_id
    FROM organization_users
    WHERE google_id = auth.uid()
    AND role IN ('owner', 'admin')
  )
);

-- 9. Create helper function to get user role
CREATE OR REPLACE FUNCTION get_user_role(user_id UUID, org_id UUID)
RETURNS TEXT AS $$
  SELECT role
  FROM organization_users
  WHERE google_id = user_id
  AND organization_id = org_id
  LIMIT 1;
$$ LANGUAGE sql SECURITY DEFINER;

-- 10. Grant necessary permissions
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON security_events TO authenticated;
GRANT SELECT ON organizations TO authenticated;
GRANT SELECT ON organization_users TO authenticated;

-- =====================================================
-- Migration Complete!
-- =====================================================
-- Next steps:
-- 1. Enable Google OAuth provider in Supabase Dashboard
-- 2. Update your .env file with Google Client ID
-- 3. Test authentication flow
-- =====================================================

SELECT 'Migration completed successfully!' AS status;