-- Add details column to members table for ban reasons and VIP notes
ALTER TABLE members ADD COLUMN details TEXT;

-- Add comment to describe the column
COMMENT ON COLUMN members.details IS 'Additional details about member status (e.g., ban reason, VIP notes)';