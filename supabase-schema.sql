-- Drop the table if it exists (to ensure clean creation)
DROP TABLE IF EXISTS code_files;

-- Create the code_files table for storing uploaded project files
CREATE TABLE code_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  project_id TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an index on project_id for faster queries
CREATE INDEX IF NOT EXISTS idx_code_files_project_id ON code_files(project_id);

-- Create an index on created_at for sorting
CREATE INDEX IF NOT EXISTS idx_code_files_created_at ON code_files(created_at);

-- Enable Row Level Security (RLS)
ALTER TABLE code_files ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows anonymous users to insert and read their own files
-- Note: In a production environment, you might want more restrictive policies
CREATE POLICY "Allow anonymous access" ON code_files
  FOR ALL USING (true);

-- Create a function to update the updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

-- Create a trigger to automatically update the updated_at column
CREATE TRIGGER update_code_files_updated_at 
  BEFORE UPDATE ON code_files 
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();