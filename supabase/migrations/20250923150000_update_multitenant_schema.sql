-- MembershipScan Multi-Tenant Database Schema Update
-- This migration safely updates the existing schema for SaaS multi-tenant structure

-- 1. Create Organizations table if it doesn't exist
CREATE TABLE IF NOT EXISTS organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL,
  subdomain VARCHAR(100) UNIQUE NOT NULL,
  api_key UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  plan_type VARCHAR(20) DEFAULT 'free' CHECK (plan_type IN ('free', 'pro', 'enterprise')),
  member_limit INTEGER DEFAULT 10,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true
);

-- 2. Create Organization Users table if it doesn't exist
CREATE TABLE IF NOT EXISTS organization_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  full_name VARCHAR(255),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  role VARCHAR(20) DEFAULT 'admin' CHECK (role IN ('admin', 'manager', 'viewer')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  is_active BOOLEAN DEFAULT true,
  email_verified BOOLEAN DEFAULT false
);

-- 3. Add organization_id to members table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='members' AND column_name='organization_id') THEN
    ALTER TABLE members ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 4. Add organization_id to attendance_logs table if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='attendance_logs' AND column_name='organization_id') THEN
    ALTER TABLE attendance_logs ADD COLUMN organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- 5. Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_members_organization_id ON members(organization_id);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_organization_id ON attendance_logs(organization_id);
CREATE INDEX IF NOT EXISTS idx_organization_users_org_id ON organization_users(organization_id);
CREATE INDEX IF NOT EXISTS idx_organizations_api_key ON organizations(api_key);
CREATE INDEX IF NOT EXISTS idx_organizations_subdomain ON organizations(subdomain);

-- 6. Create API Keys Management Table if it doesn't exist
CREATE TABLE IF NOT EXISTS api_key_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  api_key UUID NOT NULL,
  endpoint VARCHAR(100),
  usage_count INTEGER DEFAULT 0,
  last_used_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 7. Create Usage Tracking Table if it doesn't exist
CREATE TABLE IF NOT EXISTS usage_stats (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES organizations(id) ON DELETE CASCADE,
  date DATE DEFAULT CURRENT_DATE,
  members_added INTEGER DEFAULT 0,
  scans_performed INTEGER DEFAULT 0,
  total_members INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Add unique constraint if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'usage_stats_org_date_unique') THEN
    ALTER TABLE usage_stats ADD CONSTRAINT usage_stats_org_date_unique UNIQUE(organization_id, date);
  END IF;
END $$;

-- 8. Enable RLS on tables if not already enabled
ALTER TABLE organizations ENABLE ROW LEVEL SECURITY;
ALTER TABLE organization_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;
ALTER TABLE api_key_usage ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_stats ENABLE ROW LEVEL SECURITY;

-- 9. Drop existing policies if they exist and create new ones
DROP POLICY IF EXISTS "Organizations are viewable by everyone" ON organizations;
DROP POLICY IF EXISTS "Organizations can be inserted by anyone" ON organizations;
DROP POLICY IF EXISTS "Organizations can be updated by their users" ON organizations;
DROP POLICY IF EXISTS "Organization users can view their own data" ON organization_users;
DROP POLICY IF EXISTS "Organization users can be created" ON organization_users;
DROP POLICY IF EXISTS "Organization users can update their own data" ON organization_users;
DROP POLICY IF EXISTS "Organization users can delete their own data" ON organization_users;
DROP POLICY IF EXISTS "Members are publicly accessible" ON members;
DROP POLICY IF EXISTS "Attendance logs are publicly accessible" ON attendance_logs;
DROP POLICY IF EXISTS "Usage stats are publicly accessible" ON usage_stats;
DROP POLICY IF EXISTS "API usage is publicly accessible" ON api_key_usage;

-- Create simplified policies to avoid recursion (only if they don't exist)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organizations' AND policyname = 'Organizations are publicly accessible') THEN
    CREATE POLICY "Organizations are publicly accessible" ON organizations FOR ALL USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'organization_users' AND policyname = 'Organization users are publicly accessible') THEN
    CREATE POLICY "Organization users are publicly accessible" ON organization_users FOR ALL USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'members' AND policyname = 'Members are publicly accessible') THEN
    CREATE POLICY "Members are publicly accessible" ON members FOR ALL USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'attendance_logs' AND policyname = 'Attendance logs are publicly accessible') THEN
    CREATE POLICY "Attendance logs are publicly accessible" ON attendance_logs FOR ALL USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'usage_stats' AND policyname = 'Usage stats are publicly accessible') THEN
    CREATE POLICY "Usage stats are publicly accessible" ON usage_stats FOR ALL USING (true);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'api_key_usage' AND policyname = 'API usage is publicly accessible') THEN
    CREATE POLICY "API usage is publicly accessible" ON api_key_usage FOR ALL USING (true);
  END IF;
END $$;

-- 10. Create or replace functions for business logic

-- Function to check member limit
CREATE OR REPLACE FUNCTION check_member_limit()
RETURNS TRIGGER AS $$
DECLARE
  current_count INTEGER;
  member_limit INTEGER;
BEGIN
  -- Get current member count and limit for the organization
  SELECT COUNT(*), o.member_limit
  INTO current_count, member_limit
  FROM members m
  JOIN organizations o ON m.organization_id = o.id
  WHERE m.organization_id = NEW.organization_id
  GROUP BY o.member_limit;

  -- If no organization found, allow in legacy mode
  IF member_limit IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check if adding this member would exceed the limit
  IF current_count >= member_limit THEN
    RAISE EXCEPTION 'Member limit of % reached for this organization. Upgrade your plan to add more members.', member_limit;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for member limit check
DROP TRIGGER IF EXISTS check_member_limit_trigger ON members;
CREATE TRIGGER check_member_limit_trigger
  BEFORE INSERT ON members
  FOR EACH ROW
  EXECUTE FUNCTION check_member_limit();

-- Function to update usage stats
CREATE OR REPLACE FUNCTION update_usage_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if organization_id is set (multi-tenant mode)
  IF NEW.organization_id IS NOT NULL THEN
    -- Update or insert daily usage stats
    INSERT INTO usage_stats (organization_id, date, scans_performed, total_members)
    VALUES (
      NEW.organization_id,
      CURRENT_DATE,
      1,
      (SELECT COUNT(*) FROM members WHERE organization_id = NEW.organization_id)
    )
    ON CONFLICT (organization_id, date)
    DO UPDATE SET
      scans_performed = usage_stats.scans_performed + 1,
      total_members = (SELECT COUNT(*) FROM members WHERE organization_id = NEW.organization_id);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for usage tracking
DROP TRIGGER IF EXISTS update_usage_stats_trigger ON attendance_logs;
CREATE TRIGGER update_usage_stats_trigger
  AFTER INSERT ON attendance_logs
  FOR EACH ROW
  EXECUTE FUNCTION update_usage_stats();

-- 11. Insert sample data if tables are empty

-- Sample organizations
INSERT INTO organizations (name, subdomain, plan_type, member_limit)
SELECT 'Demo Company', 'demo', 'free', 10
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE subdomain = 'demo');

INSERT INTO organizations (name, subdomain, plan_type, member_limit)
SELECT 'Enterprise Corp', 'enterprise', 'enterprise', 1000
WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE subdomain = 'enterprise');

-- Sample organization users
INSERT INTO organization_users (email, full_name, organization_id, role)
SELECT 'admin@demo.com', 'Demo Admin',
  (SELECT id FROM organizations WHERE subdomain = 'demo'), 'admin'
WHERE NOT EXISTS (SELECT 1 FROM organization_users WHERE email = 'admin@demo.com');

INSERT INTO organization_users (email, full_name, organization_id, role)
SELECT 'admin@enterprise.com', 'Enterprise Admin',
  (SELECT id FROM organizations WHERE subdomain = 'enterprise'), 'admin'
WHERE NOT EXISTS (SELECT 1 FROM organization_users WHERE email = 'admin@enterprise.com');

-- Update existing members to belong to demo organization (for development)
UPDATE members
SET organization_id = (SELECT id FROM organizations WHERE subdomain = 'demo')
WHERE organization_id IS NULL;

-- Update existing attendance logs to belong to demo organization
UPDATE attendance_logs
SET organization_id = (SELECT id FROM organizations WHERE subdomain = 'demo')
WHERE organization_id IS NULL;

-- 12. Create view for organization statistics
CREATE OR REPLACE VIEW organization_statistics AS
SELECT
  o.id,
  o.name,
  o.subdomain,
  o.plan_type,
  o.member_limit,
  COUNT(DISTINCT m.id) as current_members,
  COUNT(DISTINCT al.id) as total_scans,
  COUNT(DISTINCT DATE(al.timestamp)) as active_days,
  o.created_at
FROM organizations o
LEFT JOIN members m ON o.id = m.organization_id
LEFT JOIN attendance_logs al ON o.id = al.organization_id
GROUP BY o.id, o.name, o.subdomain, o.plan_type, o.member_limit, o.created_at;

-- Add table comments
COMMENT ON TABLE organizations IS 'Tenant organizations for the SaaS platform';
COMMENT ON TABLE organization_users IS 'Users who manage organizations';
COMMENT ON TABLE api_key_usage IS 'Tracking API key usage for billing and analytics';
COMMENT ON TABLE usage_stats IS 'Daily usage statistics per organization';