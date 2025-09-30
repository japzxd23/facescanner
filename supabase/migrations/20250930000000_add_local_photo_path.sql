-- Migration: Add local_photo_path field for local filesystem optimization
-- Purpose: Store reference to local device filepath for faster image loading
-- Date: 2025-09-30

-- Add local_photo_path column to members table
-- This field stores the local filesystem path/URI for fast image access on mobile devices
-- Optional field - NULL means image only stored in cloud (photo_url)
ALTER TABLE members
ADD COLUMN IF NOT EXISTS local_photo_path TEXT;

-- Add comment to document the field
COMMENT ON COLUMN members.local_photo_path IS 'Local filesystem path/URI for fast image access on mobile devices. Used for performance optimization - loads images from device storage instead of downloading from cloud.';

-- Index for faster lookups (optional, but recommended)
CREATE INDEX IF NOT EXISTS idx_members_local_photo_path
ON members(local_photo_path)
WHERE local_photo_path IS NOT NULL;

-- Note: This field is managed by the mobile app's imageStorage service
-- Web/browser mode uses localStorage instead (not stored in database)