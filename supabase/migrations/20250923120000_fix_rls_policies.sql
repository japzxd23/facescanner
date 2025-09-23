-- Fix RLS policies to allow anonymous access for face scanner

-- Drop existing policies
DROP POLICY IF EXISTS "Authenticated users can read all members" ON members;
DROP POLICY IF EXISTS "Authenticated users can insert members" ON members;
DROP POLICY IF EXISTS "Authenticated users can update members" ON members;
DROP POLICY IF EXISTS "Authenticated users can delete members" ON members;

DROP POLICY IF EXISTS "Authenticated users can read attendance logs" ON attendance_logs;
DROP POLICY IF EXISTS "Authenticated users can insert attendance logs" ON attendance_logs;

-- Create new policies that allow both authenticated and anonymous access
-- This is needed for the face scanner to work without authentication

-- Members table policies
CREATE POLICY "Allow read access to members"
  ON members
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert members"
  ON members
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Allow update members"
  ON members
  FOR UPDATE
  USING (true);

CREATE POLICY "Allow delete members"
  ON members
  FOR DELETE
  USING (true);

-- Attendance logs policies
CREATE POLICY "Allow read attendance logs"
  ON attendance_logs
  FOR SELECT
  USING (true);

CREATE POLICY "Allow insert attendance logs"
  ON attendance_logs
  FOR INSERT
  WITH CHECK (true);

-- Note: In production, you might want to restrict these policies
-- to only allow admin operations and scanner operations separately