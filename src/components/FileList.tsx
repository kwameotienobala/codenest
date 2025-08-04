'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Folder, FileCode, FileText, File, ChevronRight, ChevronDown } from 'lucide-react';
import { FileItem } from '@/types';

interface FileListProps {
  files: FileItem[];
  onFileSelect: (file: FileItem) => void;
  selectedFile?: string;
}

interface FolderItem {
  files: FileItem[];
  subfolders: { [key: string]: FolderItem };
}

interface FolderStructure {
  [key: string]: FolderItem;
}

export default function FileList({ files, onFileSelect, selectedFile }: FileListProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.js') || fileName.endsWith('.jsx')) return <FileCode className="w-4 h-4" />;
    if (fileName.endsWith('.ts') || fileName.endsWith('.tsx')) return <FileCode className="w-4 h-4" />;
    if (fileName.endsWith('.css')) return <FileText className="w-4 h-4" />;
    if (fileName.endsWith('.html')) return <FileText className="w-4 h-4" />;
    if (fileName.endsWith('.json')) return <File className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const buildFolderStructure = (files: FileItem[]): FolderStructure => {
    const structure: FolderStructure = {};

    files.forEach(file => {
      const pathParts = file.path.split('/');
      let currentLevel: { [key: string]: FolderItem } = structure;

      // Build the folder structure
      for (let i = 0; i < pathParts.length - 1; i++) {
        const folderName = pathParts[i];
        if (!currentLevel[folderName]) {
          currentLevel[folderName] = { files: [], subfolders: {} };
        }
        if (i < pathParts.length - 2) {
          currentLevel = currentLevel[folderName].subfolders;
        }
      }

      // Add file to the appropriate folder
      const parentFolder = pathParts.slice(0, -1).join('/');
      if (parentFolder) {
        const folderParts = parentFolder.split('/');
        let targetLevel = structure;
        for (const part of folderParts) {
          targetLevel = targetLevel[part].subfolders;
        }
        targetLevel[pathParts[pathParts.length - 1]] = { files: [file], subfolders: {} };
      } else {
        structure[file.name] = { files: [file], subfolders: {} };
      }
    });

    return structure;
  };

  const toggleFolder = (folderPath: string) => {
    const newExpanded = new Set(expandedFolders);
    if (newExpanded.has(folderPath)) {
      newExpanded.delete(folderPath);
    } else {
      newExpanded.add(folderPath);
    }
    setExpandedFolders(newExpanded);
  };

  const renderFolder = (
    folderName: string, 
    folderData: FolderItem,
    level: number = 0,
    parentPath: string = ''
  ) => {
    const folderPath = parentPath ? `${parentPath}/${folderName}` : folderName;
    const isExpanded = expandedFolders.has(folderPath);
    const hasSubfolders = Object.keys(folderData.subfolders).length > 0;
    const hasFiles = folderData.files.length > 0;

    return (
      <div key={folderPath} className="space-y-1">
        <div
          className={`flex items-center gap-2 p-2 rounded cursor-pointer hover:bg-accent transition-colors ${
            level > 0 ? 'ml-4' : ''
          }`}
          onClick={() => toggleFolder(folderPath)}
        >
          {hasSubfolders || hasFiles ? (
            isExpanded ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground" />
            )
          ) : (
            <div className="w-4 h-4" />
          )}
          <Folder className="w-4 h-4 text-blue-500" />
          <span className="text-sm font-medium text-sidebar-foreground truncate">
            {folderName}
          </span>
        </div>
        
        {isExpanded && (
          <div className="space-y-1">
            {/* Render files in this folder */}
            {folderData.files.map((file) => (
              <Card
                key={file.id}
                className={`cursor-pointer transition-colors hover:bg-accent ml-4 ${
                  selectedFile === file.id ? 'bg-accent border-accent' : ''
                }`}
                onClick={() => onFileSelect(file)}
              >
                <CardContent className="p-3">
                  <div className="flex items-center gap-2">
                    {getFileIcon(file.name)}
                    <span className="text-sm font-medium text-sidebar-foreground truncate">
                      {file.name}
                    </span>
                  </div>
                </CardContent>
              </Card>
            ))}
            
            {/* Render subfolders */}
            {Object.entries(folderData.subfolders).map(([subfolderName, subfolderData]) =>
              renderFolder(subfolderName, subfolderData, level + 1, folderPath)
            )}
          </div>
        )}
      </div>
    );
  };

  const folderStructure = buildFolderStructure(files);

  return (
    <div className="w-64 bg-sidebar border-r border-border flex flex-col">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-sidebar-foreground flex items-center gap-2">
          <Folder className="w-4 h-4" />
          Project Files
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        {files.length === 0 ? (
          <div className="text-center text-muted-foreground text-sm py-8">
            No files loaded
          </div>
        ) : (
          <div className="space-y-1">
            {Object.entries(folderStructure).map(([folderName, folderData]) =>
              renderFolder(folderName, folderData)
            )}
          </div>
        )}
      </div>
    </div>
  );
} 