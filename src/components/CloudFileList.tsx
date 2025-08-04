'use client';

import { Button } from '@/components/ui/button';
import { Cloud, Calendar, FileText, Trash2, RefreshCw } from 'lucide-react';
import { FileItem } from '@/types';
import { useSupabaseFiles } from '@/hooks/useSupabaseFiles';
import { CodeFile } from '@/lib/supabase';

interface CloudFileListProps {
  onFileSelect: (file: FileItem) => void;
}

export default function CloudFileList({ onFileSelect }: CloudFileListProps) {
  const { 
    files: cloudFiles, 
    isLoading, 
    error, 
    deleteFile, 
    refreshFiles 
  } = useSupabaseFiles();



  const handleFileClick = (cloudFile: CodeFile) => {
    const fileItem: FileItem = {
      id: cloudFile.id,
      name: cloudFile.filename,
      type: 'file',
      path: `cloud/${cloudFile.filename}`,
      content: cloudFile.content,
      language: getLanguageFromFilename(cloudFile.filename)
    };
    onFileSelect(fileItem);
  };

  const handleDeleteFile = async (fileId: string, filename: string) => {
    if (!confirm(`Are you sure you want to delete "${filename}" from the cloud?`)) {
      return;
    }

    const result = await deleteFile(fileId);
    if (!result.success) {
      console.error('Error deleting file:', result.error);
    }
  };

  const getLanguageFromFilename = (filename: string): string => {
    if (filename.endsWith('.js')) return 'javascript';
    if (filename.endsWith('.ts')) return 'typescript';
    if (filename.endsWith('.tsx')) return 'typescript';
    if (filename.endsWith('.jsx')) return 'javascript';
    if (filename.endsWith('.css')) return 'css';
    if (filename.endsWith('.html')) return 'html';
    if (filename.endsWith('.json')) return 'json';
    return 'javascript';
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };



  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b border-border bg-card">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Cloud className="w-4 h-4 text-blue-500" />
            <h3 className="text-sm font-medium text-card-foreground">Cloud Files</h3>
          </div>
          <Button
            onClick={refreshFiles}
            size="sm"
            variant="ghost"
            className="flex items-center gap-1 h-6 px-2"
            disabled={isLoading}
          >
            <RefreshCw className={`w-3 h-3 ${isLoading ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {error && (
          <div className="p-3 text-sm text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400 border-l-4 border-red-500">
            {error}
          </div>
        )}

        {isLoading ? (
          <div className="p-4 text-center text-muted-foreground">
            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
            Loading cloud files...
          </div>
        ) : cloudFiles.length === 0 ? (
          <div className="p-4 text-center text-muted-foreground">
            <Cloud className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No files in cloud storage</p>
            <p className="text-xs mt-1">Save a file to see it here</p>
          </div>
        ) : (
          <div className="space-y-1 p-2">
            {cloudFiles.map((file) => (
              <div
                key={file.id}
                className="group flex items-center justify-between p-2 rounded-md hover:bg-muted/50 cursor-pointer border border-transparent hover:border-border"
                onClick={() => handleFileClick(file)}
              >
                <div className="flex items-center gap-2 min-w-0 flex-1">
                  <FileText className="w-4 h-4 text-blue-500 flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-card-foreground truncate">
                      {file.filename}
                    </p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <Calendar className="w-3 h-3" />
                      {formatDate(file.created_at)}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <Button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDeleteFile(file.id, file.filename);
                    }}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-100 dark:hover:bg-red-900/20"
                  >
                    <Trash2 className="w-3 h-3" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}