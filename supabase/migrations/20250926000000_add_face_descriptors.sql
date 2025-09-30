-- Add face_descriptor column to store pre-computed face descriptors
-- This will dramatically improve recognition performance by avoiding real-time image processing

-- Add the face_descriptor column to store Float32Array as JSONB
ALTER TABLE members
ADD COLUMN IF NOT EXISTS face_descriptor JSONB DEFAULT NULL;

-- Add index for faster lookups of members with face descriptors
CREATE INDEX IF NOT EXISTS idx_members_face_descriptor
ON members(organization_id, status)
WHERE face_descriptor IS NOT NULL;

-- Add index for faster face descriptor queries
CREATE INDEX IF NOT EXISTS idx_members_has_descriptor
ON members(organization_id)
WHERE face_descriptor IS NOT NULL;

-- Add comment explaining the column
COMMENT ON COLUMN members.face_descriptor IS 'Pre-computed face descriptor (Float32Array stored as JSONB) for fast face recognition';

-- Update existing records to indicate they need descriptor computation
-- This will be handled by the app during the next member photo update
UPDATE members
SET face_descriptor = NULL
WHERE photo_url IS NOT NULL AND face_descriptor IS NULL;