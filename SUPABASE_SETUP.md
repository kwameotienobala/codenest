# Supabase Setup Guide for CodeNest

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com)
2. Create a new account or sign in
3. Create a new project
4. Note down your project URL and anon key

## 2. Environment Variables

1. Copy `env.template` to `.env.local`
2. Fill in your Supabase credentials:
   ```
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   OPENAI_API_KEY=your_openai_api_key
   ```

## 3. Create Database Table

In your Supabase dashboard, go to the SQL Editor and run this query:

```sql
-- Create the code_files table
CREATE TABLE code_files (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  filename TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create an updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_code_files_updated_at 
  BEFORE UPDATE ON code_files
  FOR EACH ROW 
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (optional, for future auth)
ALTER TABLE code_files ENABLE ROW LEVEL SECURITY;

-- Create policy to allow all operations for now (update this when adding auth)
CREATE POLICY "Allow all operations" ON code_files
  FOR ALL USING (true);
```

## 4. Test the Integration

1. Start your development server: `npm run dev`
2. Load a file in the editor
3. Click "Save to Cloud" - you should see a success message
4. Switch to the "Cloud" tab in the sidebar
5. You should see your saved file listed
6. Click on the cloud file to load it back into the editor

## 5. Features Included

### Save to Cloud
- Click "Save to Cloud" button in the editor toolbar
- Files are saved with timestamp and can be retrieved later
- Success/error notifications are shown

### Load from Cloud  
- Switch to "Cloud" tab in the sidebar
- See all your saved files with timestamps
- Click any file to load it into the editor
- Delete files with the trash icon

### Versioning
- Each save creates a new entry (basic versioning by timestamp)
- Files are ordered by creation date (newest first)

## 6. Future Enhancements

- User authentication integration
- File sharing capabilities  
- Better versioning with revision numbers
- File organization with folders/tags
- Collaborative editing features

## Troubleshooting

### "Failed to save to cloud" error
- Check your Supabase URL and anon key in `.env.local`
- Ensure the `code_files` table exists in your database
- Check browser console for detailed error messages

### "Failed to load cloud files" error  
- Verify your Supabase configuration
- Check that Row Level Security policies allow read access
- Ensure your project is not paused (free tier limitation)