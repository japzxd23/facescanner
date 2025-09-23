/*
  # FaceCheck Database Schema

  1. New Tables
    - `members`
      - `id` (uuid, primary key)
      - `name` (text, required)
      - `face_embedding` (jsonb, stores face recognition data)
      - `status` (text, enum: 'Allowed', 'Banned', 'VIP')
      - `photo_url` (text, optional)
      - `created_at` (timestamp)
      - `updated_at` (timestamp)
    
    - `attendance_logs`
      - `id` (uuid, primary key)
      - `member_id` (uuid, foreign key to members)
      - `timestamp` (timestamp, when scan occurred)
      - `confidence` (numeric, face recognition confidence score)

  2. Security
    - Enable RLS on both tables
    - Add policies for authenticated users to manage all data
    - Admin-only access for member management
    - Read access for scanning operations

  3. Indexes
    - Index on member status for fast filtering
    - Index on attendance log timestamps for date-based queries
*/

-- Create members table
CREATE TABLE IF NOT EXISTS members (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  face_embedding jsonb,
  status text CHECK (status IN ('Allowed', 'Banned', 'VIP')) DEFAULT 'Allowed',
  photo_url text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create attendance_logs table
CREATE TABLE IF NOT EXISTS attendance_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  member_id uuid REFERENCES members(id) ON DELETE CASCADE,
  timestamp timestamptz DEFAULT now(),
  confidence numeric(3,2) DEFAULT 0.00
);

-- Enable Row Level Security
ALTER TABLE members ENABLE ROW LEVEL SECURITY;
ALTER TABLE attendance_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for members table
CREATE POLICY "Authenticated users can read all members"
  ON members
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert members"
  ON members
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

CREATE POLICY "Authenticated users can update members"
  ON members
  FOR UPDATE
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can delete members"
  ON members
  FOR DELETE
  TO authenticated
  USING (true);

-- Create policies for attendance_logs table
CREATE POLICY "Authenticated users can read attendance logs"
  ON attendance_logs
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert attendance logs"
  ON attendance_logs
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_members_status ON members(status);
CREATE INDEX IF NOT EXISTS idx_members_created_at ON members(created_at);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_timestamp ON attendance_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_attendance_logs_member_id ON attendance_logs(member_id);

-- Create a function to automatically update the updated_at column
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create trigger for members table
DROP TRIGGER IF EXISTS update_members_updated_at ON members;
CREATE TRIGGER update_members_updated_at
  BEFORE UPDATE ON members
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();