'use client';

import { useState, useCallback } from 'react';
import { FileItem } from '@/types';

interface ProjectFile {
  name: string;
  path: string;
  content: string;
  size: number;
  extension: string;
  directory: string;
}

interface ProjectStructure {
  success: boolean;
  projectPath: string;
  files: ProjectFile[];
  filesByDirectory: Record<string, ProjectFile[]>;
  stats: {
    totalFiles: number;
    totalSize: number;
    directories: number;
  };
  error?: string;
}

interface UseLocalProjectReturn {
  isLoading: boolean;
  error: string | null;
  projectPath: string | null;
  loadProject: (path?: string) => Promise<FileItem[]>;
  saveFile: (filePath: string, content: string) => Promise<boolean>;
}

const AGENT_URL = 'http://localhost:5111';
const CONNECTION_TIMEOUT = 10000; // 10 seconds for file operations

export function useLocalProject(): UseLocalProjectReturn {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);

  const loadProject = useCallback(async (path?: string): Promise<FileItem[]> => {
    setIsLoading(true);
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);

      const url = new URL(`${AGENT_URL}/list-files`);
      if (path) {
        url.searchParams.set('path', path);
      }

      const response = await fetch(url.toString(), {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: ProjectStructure = await response.json();

      if (!result.success) {
        throw new Error(result.error || 'Failed to load project');
      }

      setProjectPath(result.projectPath);

      // Convert ProjectFile to FileItem format
      const fileItems: FileItem[] = result.files.map((file, index) => ({
        id: `local-${index}`,
        name: file.name,
        type: 'file',
        path: file.path,
        content: file.content,
        language: getLanguageFromExtension(file.extension)
      }));

      console.log(`Loaded ${result.stats.totalFiles} files from ${result.projectPath}`);
      return fileItems;

    } catch (error) {
      const errorMessage = error instanceof Error 
        ? (error.name === 'AbortError' ? 'Request timed out' : error.message)
        : 'Unknown error occurred';
      
      setError(errorMessage);
      console.error('Failed to load project:', errorMessage);
      return [];
    } finally {
      setIsLoading(false);
    }
  }, []);

  const saveFile = useCallback(async (filePath: string, content: string): Promise<boolean> => {
    setError(null);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);

      const response = await fetch(`${AGENT_URL}/save-file`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          filePath,
          content
        }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result = await response.json();

      if (result.status !== 'success') {
        throw new Error(result.error || 'Failed to save file');
      }

      console.log(`Saved file: ${filePath} (${result.size} bytes)`);
      return true;

    } catch (error) {
      const errorMessage = error instanceof Error 
        ? (error.name === 'AbortError' ? 'Save request timed out' : error.message)
        : 'Unknown error occurred';
      
      setError(errorMessage);
      console.error('Failed to save file:', errorMessage);
      return false;
    }
  }, []);

  return {
    isLoading,
    error,
    projectPath,
    loadProject,
    saveFile,
  };
}

// Helper function to determine language from file extension
function getLanguageFromExtension(extension: string): string {
  const languageMap: Record<string, string> = {
    '.js': 'javascript',
    '.jsx': 'javascript',
    '.ts': 'typescript',
    '.tsx': 'typescript',
    '.json': 'json',
    '.css': 'css',
    '.scss': 'scss',
    '.html': 'html',
    '.md': 'markdown',
    '.vue': 'vue',
    '.py': 'python',
    '.php': 'php',
  };

  return languageMap[extension.toLowerCase()] || 'plaintext';
}