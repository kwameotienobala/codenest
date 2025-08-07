# Supabase Database Setup Guide

## 🚨 Error Fix: "column project_id does not exist"

If you're getting the error `ERROR: 42703: column "project_id" does not exist`, follow these steps:

### Step 1: Access Supabase SQL Editor
1. Go to your Supabase project dashboard
2. Click on "SQL Editor" in the left sidebar
3. Click "New query"

### Step 2: Choose the Right SQL Script

#### Option A: Clean Installation (Recommended)
If you want to start fresh, copy and paste the contents of `supabase-schema.sql`:

```sql
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
CREATE POLICY "Allow anonymous access" ON code_files FOR ALL USING (true);

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
```

#### Option B: Fix Existing Table
If you want to keep existing data and just add missing columns, use `supabase-fix-schema.sql`:

```sql
-- Add missing columns to existing table
DO $$ 
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'code_files' 
        AND column_name = 'project_id'
    ) THEN
        ALTER TABLE code_files ADD COLUMN project_id TEXT;
    END IF;
    
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'code_files' 
        AND column_name = 'updated_at'
    ) THEN
        ALTER TABLE code_files ADD COLUMN updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW();
    END IF;
END $$;

-- Create indexes and policies
CREATE INDEX IF NOT EXISTS idx_code_files_project_id ON code_files(project_id);
CREATE INDEX IF NOT EXISTS idx_code_files_created_at ON code_files(created_at);
ALTER TABLE code_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Allow anonymous access" ON code_files;
CREATE POLICY "Allow anonymous access" ON code_files FOR ALL USING (true);
```

### Step 3: Run the Query
1. Paste the chosen SQL script into the editor
2. Click "Run" or press Ctrl+Enter
3. Check for any error messages

### Step 4: Verify the Table
Run this query to verify the table was created correctly:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'code_files'
ORDER BY ordinal_position;
```

You should see these columns:
- `id` (uuid)
- `filename` (text)
- `content` (text)
- `project_id` (text)
- `created_at` (timestamp with time zone)
- `updated_at` (timestamp with time zone)

### Step 5: Test Upload
1. Go back to your CodeNest IDE
2. Select a folder with some files
3. Click "Upload to Cloud"
4. Check for success message

## 🔍 Troubleshooting

### Error: "relation code_files does not exist"
- The table wasn't created. Run Option A (Clean Installation) above.

### Error: "permission denied for table code_files"
- RLS policy issue. Make sure you ran the policy creation part of the script.

### Error: "duplicate key value violates unique constraint"
- This is normal if you're trying to upload the same files multiple times.

### Still Having Issues?
1. Check the Supabase logs in the "Logs" section
2. Verify your environment variables in `.env.local`:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_actual_supabase_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_actual_anon_key
   ```
3. Make sure your Supabase project is active and not paused

## 🎯 Expected Result
After successful setup, you should be able to:
- Select a local folder in CodeNest
- See files in the file tree
- Click "Upload to Cloud" 
- See "✅ Uploaded X files to cloud" message
- View uploaded files in Supabase dashboard under "Table Editor" > "code_files"