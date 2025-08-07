-- Alternative script to fix existing table if project_id column is missing
-- Run this if you get "column project_id does not exist" error

-- Check if the table exists and add missing column if needed
DO $$ 
BEGIN
    -- Add project_id column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'code_files' 
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE code_files ADD COLUMN project_id TEXT;
    END IF;
    
    -- Add updated_at column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'code_files' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE code_files ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_code_files_project_id ON code_files(project_id);
CREATE INDEX IF NOT EXISTS idx_code_files_created_at ON code_files(created_at);

-- Enable RLS if not already enabled
ALTER TABLE code_files ENABLE ROW LEVEL SECURITY;

-- Create or replace the policy
DROP POLICY IF EXISTS "Allow anonymous access" ON code_files;
CREATE POLICY "Allow anonymous access" ON code_files FOR ALL USING (true);

-- Create the update function and trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

DROP TRIGGER IF EXISTS update_code_files_updated_at ON code_files;
CREATE TRIGGER update_code_files_updated_at 
  BEFORE UPDATE ON code_files 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();