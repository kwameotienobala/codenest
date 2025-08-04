'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Folder, Upload, FileCode, FileText, File } from 'lucide-react';
import { FileItem } from '@/types';

interface FileUploadProps {
  onFilesLoaded: (files: FileItem[]) => void;
}

export default function FileUpload({ onFilesLoaded }: FileUploadProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFolder, setSelectedFolder] = useState<string>('');

  const allowedExtensions = ['.js', '.ts', '.css', '.json', '.jsx', '.tsx', '.html'];

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return <FileCode className="w-4 h-4" />;
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return <FileCode className="w-4 h-4" />;
    if (fileName.endsWith('.css')) return <FileText className="w-4 h-4" />;
    if (fileName.endsWith('.html')) return <FileText className="w-4 h-4" />;
    if (fileName.endsWith('.json')) return <File className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const getLanguageFromFile = (fileName: string) => {
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return 'javascript';
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return 'typescript';
    if (fileName.endsWith('.css')) return 'css';
    if (fileName.endsWith('.html')) return 'html';
    if (fileName.endsWith('.json')) return 'json';
    return 'text';
  };

  const readFileContent = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve(content);
      };
      reader.onerror = reject;
      reader.readAsText(file);
    });
  };

  const handleFolderSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files) return;

    setIsLoading(true);
    setSelectedFolder(files[0]?.webkitRelativePath.split('/')[0] || '');

    try {
      const fileItems: FileItem[] = [];
      const filePromises: Promise<void>[] = [];

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const extension = '.' + file.name.split('.').pop()?.toLowerCase();
        
        if (allowedExtensions.includes(extension)) {
          const promise = readFileContent(file).then(content => {
            const fileItem: FileItem = {
              id: `file-${i}`,
              name: file.name,
              type: 'file',
              path: file.webkitRelativePath,
              content: content,
              language: getLanguageFromFile(file.name)
            };
            fileItems.push(fileItem);
          });
          filePromises.push(promise);
        }
      }

      await Promise.all(filePromises);
      
      // Sort files by path for better organization
      fileItems.sort((a, b) => a.path.localeCompare(b.path));
      
      onFilesLoaded(fileItems);
    } catch (error) {
      console.error('Error reading files:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="w-64 bg-sidebar border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-sidebar-foreground flex items-center gap-2">
          <Folder className="w-4 h-4" />
          Project Files
        </h2>
      </div>
      
      <div className="flex-1 p-4">
        {!selectedFolder ? (
          <Card className="border-dashed border-2 border-border hover:border-accent transition-colors">
            <CardContent className="p-6 text-center">
              <Upload className="w-8 h-8 mx-auto mb-3 text-muted-foreground" />
              <h3 className="text-sm font-medium text-card-foreground mb-2">
                Select a folder
              </h3>
              <p className="text-xs text-muted-foreground mb-4">
                Choose a folder to load your project files
              </p>
              <div className="relative">
                <input
                  type="file"
                  {...{ webkitdirectory: "", directory: "" } as any}
                  multiple
                  onChange={handleFolderSelect}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  accept=".js,.ts,.css,.json,.jsx,.tsx,.html"
                />
                <Button
                  size="sm"
                  className="w-full"
                  disabled={isLoading}
                >
                  {isLoading ? 'Loading...' : 'Choose Folder'}
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="text-center">
            <div className="flex items-center justify-center gap-2 mb-3">
              <Folder className="w-4 h-4 text-green-600" />
              <span className="text-sm font-medium text-card-foreground">
                {selectedFolder}
              </span>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setSelectedFolder('');
                onFilesLoaded([]);
              }}
            >
              Change Folder
            </Button>
          </div>
        )}
      </div>
    </div>
  );
} 