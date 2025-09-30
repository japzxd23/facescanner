-- Scanner Settings Migration
-- Creates the scanner_settings table for configurable face recognition parameters

-- 1. Create scanner_settings table if it doesn't exist (per-organization/tenant settings)
CREATE TABLE IF NOT EXISTS scanner_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES organizations(id) ON DELETE CASCADE,
  settings JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT DEFAULT 'system',
  updated_by TEXT DEFAULT 'system',

  CONSTRAINT scanner_settings_org_unique UNIQUE(organization_id)
);

-- 2. Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_scanner_settings_org_id ON scanner_settings(organization_id);
CREATE INDEX IF NOT EXISTS idx_scanner_settings_updated_at ON scanner_settings(updated_at);

-- 3. Enable Row Level Security
ALTER TABLE scanner_settings ENABLE ROW LEVEL SECURITY;

-- 4. Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can view their organization settings" ON scanner_settings;
DROP POLICY IF EXISTS "Users can update their organization settings" ON scanner_settings;
DROP POLICY IF EXISTS "Scanner settings are publicly accessible" ON scanner_settings;

-- 5. Create RLS policies (simplified for development, can be enhanced for production)
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'scanner_settings' AND policyname = 'Scanner settings are publicly accessible') THEN
    CREATE POLICY "Scanner settings are publicly accessible" ON scanner_settings FOR ALL USING (true);
  END IF;
END $$;

-- Alternative production-ready policies (commented out for now)
/*
-- View settings for organization users
CREATE POLICY "Users can view their organization settings"
  ON scanner_settings FOR SELECT
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));

-- Update settings for organization users
CREATE POLICY "Users can update their organization settings"
  ON scanner_settings FOR ALL
  USING (organization_id IN (
    SELECT organization_id FROM organization_users WHERE user_id = auth.uid()
  ));
*/

-- 6. Create function to create scanner_settings table (for backward compatibility)
CREATE OR REPLACE FUNCTION create_scanner_settings_table()
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Table already exists from migration, this function is for compatibility
  RAISE NOTICE 'Scanner settings table already exists from migration';
END;
$$;

-- 7. Create function to get default settings for an organization
CREATE OR REPLACE FUNCTION get_default_scanner_settings(org_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN jsonb_build_object(
    'faceQualityThreshold', 0.65,
    'faceMatchThreshold', 0.91,
    'faceDetectionConfidence', 0.5,
    'keypointMinCount', 6,
    'keypointSpreadThreshold', 0.35,
    'aspectRatioMin', 0.75,
    'aspectRatioMax', 1.3,
    'faceProcessingCooldown', 5000,
    'detectionCooldown', 3000,
    'postRecognitionCooldown', 3000,
    'stabilityTimeout', 2000,
    'requiredStableFrames', 1,
    'cameraResolutionWidth', 640,
    'cameraResolutionHeight', 480,
    'cameraFrameRate', 60,
    'mirrorCamera', true,
    'maxFacesDetection', 5,
    'embedDimensions', 468,
    'processingQueueSize', 1,
    'scanningInterval', 100,
    'debugMode', true,
    'soundEnabled', true,
    'statusFlashDuration', 1500,
    'samPersonThreshold', 0.85,
    'livenessTolerance', 0.6,
    'qualityScoreWeights', jsonb_build_object(
      'size', 0.15,
      'position', 0.25,
      'keypoints', 0.2,
      'aspect', 0.2,
      'area', 0.2
    ),
    'batchSizeLimit', 100,
    'cacheExpirationTime', 300000,
    'maxRetryAttempts', 3,
    'organizationId', org_id,
    'createdAt', NOW()::text,
    'updatedAt', NOW()::text,
    'createdBy', 'system',
    'updatedBy', 'system'
  );
END;
$$;

-- 8. Create function to reset settings to defaults
CREATE OR REPLACE FUNCTION reset_scanner_settings_to_defaults(org_id UUID, updated_by_user TEXT DEFAULT 'system')
RETURNS void
LANGUAGE plpgsql
AS $$
BEGIN
  -- Delete existing settings to force use of defaults
  DELETE FROM scanner_settings WHERE organization_id = org_id;

  RAISE NOTICE 'Scanner settings reset to defaults for organization %', org_id;
END;
$$;

-- 9. Create legacy organization for backward compatibility
INSERT INTO organizations (id, name, subdomain, plan_type, member_limit)
SELECT
  '00000000-0000-0000-0000-000000000001'::UUID,
  'Legacy System',
  'legacy',
  'enterprise',
  99999
WHERE NOT EXISTS (
  SELECT 1 FROM organizations WHERE subdomain = 'legacy'
);

-- 10. Add table comments
COMMENT ON TABLE scanner_settings IS 'Configurable face recognition parameters per organization';
COMMENT ON COLUMN scanner_settings.settings IS 'JSONB object containing all scanner configuration parameters';
COMMENT ON COLUMN scanner_settings.organization_id IS 'Reference to the organization that owns these settings';
COMMENT ON FUNCTION get_default_scanner_settings(UUID) IS 'Returns default scanner settings as JSONB for an organization';
COMMENT ON FUNCTION reset_scanner_settings_to_defaults(UUID, TEXT) IS 'Resets scanner settings to defaults by deleting custom settings';

-- 11. Grant permissions (adjust as needed for your setup)
-- GRANT ALL ON scanner_settings TO authenticated;
-- GRANT EXECUTE ON FUNCTION get_default_scanner_settings(UUID) TO authenticated;
-- GRANT EXECUTE ON FUNCTION reset_scanner_settings_to_defaults(UUID, TEXT) TO authenticated;