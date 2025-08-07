import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// Only create client if environment variables are provided
export const supabase = supabaseUrl && supabaseAnonKey 
  ? createClient(supabaseUrl, supabaseAnonKey)
  : null

// Database types
export interface CodeFile {
  id: string
  filename: string
  content: string
  created_at: string
  updated_at?: string
  user_id?: string
  project_id?: string
}

export interface FileOperationResult {
  success: boolean
  error?: string
  data?: CodeFile | CodeFile[]
}