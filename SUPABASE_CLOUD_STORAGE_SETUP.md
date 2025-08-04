# Supabase Cloud Storage Setup for CodeNest

This guide will help you set up Supabase cloud storage for persistent file storage across sessions in CodeNest.

## 1. Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and create a new project
2. Note down your project URL and anon key from the project settings

## 2. Create Database Table

Execute this SQL in your Supabase SQL Editor:

```sql
-- Create the code_files table
CREATE TABLE code_files (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    filename TEXT NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    user_id TEXT  -- Optional: for multi-user support later
);

-- Create a unique constraint on filename to prevent duplicates
CREATE UNIQUE INDEX code_files_filename_idx ON code_files(filename);

-- Create an index on updated_at for faster sorting
CREATE INDEX code_files_updated_at_idx ON code_files(updated_at DESC);

-- Set up Row Level Security (RLS) - Optional but recommended
ALTER TABLE code_files ENABLE ROW LEVEL SECURITY;

-- Create a policy that allows all operations for now
-- You can make this more restrictive later with user authentication
CREATE POLICY "Enable all operations for everyone" ON code_files
FOR ALL USING (true);
```

## 3. Configure Environment Variables

Add these variables to your `.env.local` file:

```env
# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Other existing variables...
OPENROUTER_API_KEY=your_openrouter_api_key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## 4. Features Available

### ✅ **Cloud File Storage**
- Files are automatically saved to Supabase
- Persistent across browser sessions
- Accessible from any device with your Supabase credentials

### ✅ **Save to Cloud**
- Click "Save to Cloud" button in the code editor
- Files are upserted (insert or update) based on filename
- Prevents duplicate files with the same name

### ✅ **Load from Cloud**
- View all cloud files in the Cloud tab
- Click any file to load it into the editor
- Files are sorted by last updated time

### ✅ **Auto-save**
- Enable/disable with the "Auto On/Off" button
- Automatically saves every 15 seconds when enabled
- Shows last saved timestamp
- Visual indicators (pulsing clock icon)

### ✅ **File Management**
- Delete files directly from the cloud files list
- Refresh file list manually
- Real-time updates when files are saved

## 5. Usage Instructions

### Saving Files
1. Write your code in the editor
2. Click "Save to Cloud" button
3. File is saved with current filename or auto-generated name
4. Toast notification confirms successful save

### Loading Files
1. Go to the "Cloud" tab in the file sidebar
2. Click on any file to load it into the editor
3. File content loads immediately

### Auto-save
1. Click "Auto Off" to enable auto-save
2. Button changes to "Auto On" with pulsing clock icon
3. Files save automatically every 15 seconds
4. "Last saved" timestamp appears
5. Click "Auto On" to disable

### File Organization
- Files are sorted by last updated (newest first)
- Each file shows creation date and time
- Hover over files to see delete option
- Refresh button manually updates the file list

## 6. Multi-User Support (Future)

The table includes a `user_id` field for future multi-user support:

```sql
-- When you add authentication, update the RLS policy:
CREATE POLICY "Users can only see their own files" ON code_files
FOR ALL USING (auth.uid()::text = user_id);
```

## 7. Troubleshooting

### "Supabase not configured" Error
- Check that `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are set
- Restart your development server after adding environment variables

### Files Not Loading
- Verify the `code_files` table exists in your Supabase database
- Check that RLS policies allow the operations you're trying to perform
- Look at the browser console for specific error messages

### Auto-save Not Working
- Ensure you have content in the editor
- Check that the file has a valid filename
- Auto-save only works when Supabase is properly configured

## 8. Database Schema

```sql
Table: code_files
├── id: UUID (Primary Key, Auto-generated)
├── filename: TEXT (Unique, Not Null)
├── content: TEXT (Not Null)
├── created_at: TIMESTAMP (Auto-generated)
├── updated_at: TIMESTAMP (Auto-updated)
└── user_id: TEXT (Optional, for future use)
```

## 9. Performance Notes

- Files are loaded on-demand when clicked
- The file list refreshes automatically after save/delete operations
- Auto-save has a 15-second interval to balance functionality with API usage
- Upsert operations prevent database bloat from duplicate files

Your CodeNest IDE now has full cloud storage capabilities! 🚀