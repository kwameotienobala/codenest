'use client';

import { useState, useCallback } from 'react';
import { FileItem } from '@/types';

interface FileSystemState {
  selectedFolder: FileSystemDirectoryHandle | null;
  files: FileItem[];
  currentFile: FileItem | null;
}

export function useFileSystem() {
  const [state, setState] = useState<FileSystemState>({
    selectedFolder: null,
    files: [],
    currentFile: null
  });

  // Check if File System Access API is supported
  const isSupported = typeof window !== 'undefined' && 'showDirectoryPicker' in window;

  // Open folder picker
  const openFolder = useCallback(async () => {
    if (!isSupported) {
      alert('File System Access API is not supported in your browser. Please use Chrome 86+ or Edge 86+.');
      return;
    }

    try {
      const directoryHandle = await window.showDirectoryPicker();
      setState(prev => ({ ...prev, selectedFolder: directoryHandle }));
      await loadFiles(directoryHandle);
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Error opening folder:', error);
      }
    }
  }, [isSupported]);

  // Load files from directory
  const loadFiles = useCallback(async (directoryHandle: FileSystemDirectoryHandle) => {
    const files: FileItem[] = [];
    
    try {
      const anyDir = directoryHandle as any;
      const iterator: AsyncIterable<[string, any]> | null = typeof anyDir.entries === 'function' ? anyDir.entries() : null;
      if (!iterator) return;
      for await (const [name, handle] of iterator as AsyncIterable<[string, any]>) {
        if (handle.kind === 'file') {
          const file = await handle.getFile();
          const content = await file.text();
          
          // Determine language based on file extension
          const extension = name.split('.').pop()?.toLowerCase();
          const language = getLanguageFromExtension(extension || '');
          
          files.push({
            id: name,
            name,
            type: 'file',
            path: name,
            content,
            language
          });
        } else if (handle.kind === 'directory') {
          // For now, we'll just list directories but not load their contents
          files.push({
            id: name,
            name,
            type: 'folder',
            path: name,
            content: '',
            language: ''
          });
        }
      }
      
      setState(prev => ({ ...prev, files }));
    } catch (error) {
      console.error('Error loading files:', error);
    }
  }, []);

  // Select and load a file
  const selectFile = useCallback((file: FileItem) => {
    setState(prev => ({ ...prev, currentFile: file }));
  }, []);

  // Save file to the selected folder
  const saveFile = useCallback(async (filename: string, content: string) => {
    if (!state.selectedFolder) {
      throw new Error('No folder selected');
    }

    try {
      const fileHandle = await state.selectedFolder.getFileHandle(filename, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      // Determine language based on file extension
      const extension = filename.split('.').pop()?.toLowerCase();
      const language = getLanguageFromExtension(extension || '');

      // Update the files list
      const newFile: FileItem = {
        id: filename,
        name: filename,
        type: 'file',
        path: filename,
        content,
        language
      };

      setState(prev => ({
        ...prev,
        files: prev.files.some(f => f.name === filename) 
          ? prev.files.map(f => f.name === filename ? newFile : f)
          : [...prev.files, newFile],
        currentFile: newFile
      }));

      return newFile;
    } catch (error) {
      console.error('Error saving file:', error);
      throw error;
    }
  }, [state.selectedFolder]);

  // Update current file content
  const updateCurrentFile = useCallback((content: string) => {
    if (state.currentFile) {
      const updatedFile = { ...state.currentFile, content };
      setState(prev => ({
        ...prev,
        currentFile: updatedFile,
        files: prev.files.map(f => f.id === updatedFile.id ? updatedFile : f)
      }));
    }
  }, [state.currentFile]);

  return {
    ...state,
    isSupported,
    openFolder,
    selectFile,
    saveFile,
    updateCurrentFile,
    refreshFiles: () => state.selectedFolder && loadFiles(state.selectedFolder)
  };
}

// Helper function to determine language from file extension
function getLanguageFromExtension(extension: string): string {
  const languageMap: Record<string, string> = {
    'js': 'javascript',
    'jsx': 'javascript',
    'ts': 'typescript',
    'tsx': 'typescript',
    'html': 'html',
    'css': 'css',
    'scss': 'scss',
    'sass': 'sass',
    'json': 'json',
    'md': 'markdown',
    'py': 'python',
    'java': 'java',
    'cpp': 'cpp',
    'c': 'c',
    'cs': 'csharp',
    'php': 'php',
    'rb': 'ruby',
    'go': 'go',
    'rs': 'rust',
    'sh': 'shell',
    'yml': 'yaml',
    'yaml': 'yaml',
    'xml': 'xml',
    'sql': 'sql'
  };

  return languageMap[extension] || 'text';
}

// Extend the Window interface for TypeScript
declare global {
  interface Window {
    showDirectoryPicker(): Promise<FileSystemDirectoryHandle>;
  }
}