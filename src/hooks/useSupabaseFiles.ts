'use client';

import { useState, useCallback, useRef, useEffect } from 'react';
import { supabase, CodeFile, FileOperationResult } from '@/lib/supabase';

interface UseSupabaseFilesReturn {
  files: CodeFile[];
  isLoading: boolean;
  error: string | null;
  saveFile: (filename: string, content: string, userId?: string) => Promise<FileOperationResult>;
  loadFiles: () => Promise<void>;
  deleteFile: (fileId: string) => Promise<FileOperationResult>;
  refreshFiles: () => Promise<void>;
  enableAutosave: (filename: string, getContent: () => string, interval?: number) => void;
  disableAutosave: () => void;
  isAutosaveEnabled: boolean;
  lastSaved: Date | null;
}

export function useSupabaseFiles(): UseSupabaseFilesReturn {
  const [files, setFiles] = useState<CodeFile[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isAutosaveEnabled, setIsAutosaveEnabled] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  
  const autosaveIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const autosaveConfigRef = useRef<{
    filename: string;
    getContent: () => string;
    userId?: string;
  } | null>(null);

  // Check if Supabase is configured
  const isSupabaseConfigured = useCallback(() => {
    if (!supabase) {
      setError('Supabase not configured. Please set up your environment variables.');
      return false;
    }
    return true;
  }, []);

  // Load all files from Supabase
  const loadFiles = useCallback(async () => {
    if (!isSupabaseConfigured()) return;
    
    setIsLoading(true);
    setError(null);

    try {
      const { data, error } = await supabase!
        .from('code_files')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;
      setFiles(data || []);
    } catch (err: any) {
      console.error('Error loading files:', err);
      setError('Failed to load files from cloud storage.');
    } finally {
      setIsLoading(false);
    }
  }, [isSupabaseConfigured]);

  // Save file to Supabase (upsert based on filename)
  const saveFile = useCallback(async (
    filename: string, 
    content: string, 
    userId?: string
  ): Promise<FileOperationResult> => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const fileData: Partial<CodeFile> = {
        filename,
        content,
        updated_at: new Date().toISOString(),
      };

      if (userId) {
        fileData.user_id = userId;
      }

      const { data, error } = await supabase!
        .from('code_files')
        .upsert(fileData, { 
          onConflict: 'filename',
          ignoreDuplicates: false 
        })
        .select()
        .single();

      if (error) throw error;

      setLastSaved(new Date());
      await loadFiles(); // Refresh the file list
      
      return { 
        success: true, 
        data: data as CodeFile 
      };
    } catch (err: any) {
      console.error('Error saving file:', err);
      return { 
        success: false, 
        error: err.message || 'Failed to save file' 
      };
    }
  }, [isSupabaseConfigured, loadFiles]);

  // Delete file from Supabase
  const deleteFile = useCallback(async (fileId: string): Promise<FileOperationResult> => {
    if (!isSupabaseConfigured()) {
      return { success: false, error: 'Supabase not configured' };
    }

    try {
      const { error } = await supabase!
        .from('code_files')
        .delete()
        .eq('id', fileId);

      if (error) throw error;

      await loadFiles(); // Refresh the file list
      
      return { success: true };
    } catch (err: any) {
      console.error('Error deleting file:', err);
      return { 
        success: false, 
        error: err.message || 'Failed to delete file' 
      };
    }
  }, [isSupabaseConfigured, loadFiles]);

  // Refresh files (alias for loadFiles)
  const refreshFiles = useCallback(async () => {
    await loadFiles();
  }, [loadFiles]);

  // Enable autosave functionality
  const enableAutosave = useCallback((
    filename: string, 
    getContent: () => string, 
    interval: number = 15000 // 15 seconds default
  ) => {
    // Disable any existing autosave
    disableAutosave();

    autosaveConfigRef.current = { filename, getContent };
    setIsAutosaveEnabled(true);

    autosaveIntervalRef.current = setInterval(async () => {
      const config = autosaveConfigRef.current;
      if (config) {
        const content = config.getContent();
        if (content.trim()) {
          const result = await saveFile(config.filename, content, config.userId);
          if (result.success) {
            console.log(`Autosaved: ${config.filename}`);
          } else {
            console.error('Autosave failed:', result.error);
          }
        }
      }
    }, interval);
  }, [saveFile]);

  // Disable autosave functionality
  const disableAutosave = useCallback(() => {
    if (autosaveIntervalRef.current) {
      clearInterval(autosaveIntervalRef.current);
      autosaveIntervalRef.current = null;
    }
    autosaveConfigRef.current = null;
    setIsAutosaveEnabled(false);
  }, []);

  // Load files on mount
  useEffect(() => {
    loadFiles();
  }, [loadFiles]);

  // Cleanup autosave on unmount
  useEffect(() => {
    return () => {
      disableAutosave();
    };
  }, [disableAutosave]);

  return {
    files,
    isLoading,
    error,
    saveFile,
    loadFiles,
    deleteFile,
    refreshFiles,
    enableAutosave,
    disableAutosave,
    isAutosaveEnabled,
    lastSaved,
  };
}