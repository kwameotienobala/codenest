'use client';

import { useState } from 'react';
import { FileItem } from '@/types';
import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuItem,
  ContextMenuSeparator,
  ContextMenuTrigger,
} from "@/components/ui/context-menu";
import { Folder, File, ChevronRight, ChevronDown, FilePlus2, FolderPlus, Pencil, Trash2 } from 'lucide-react';

interface FileTreeProps {
  files: FileItem[];
  onFileSelect: (file: FileItem) => void;
  selectedFile?: string;
  onNewFile: (path: string) => void;
  onNewFolder: (path: string) => void;
  onRename: (path: string, oldName: string, isFolder: boolean) => void;
  onDelete: (path: string, isFolder: boolean) => void;
}

// A type for our tree node structure
type TreeNode = {
  [key: string]: TreeNode | FileItem;
};

export default function FileTree({ files, onFileSelect, selectedFile, onNewFile, onNewFolder, onRename, onDelete }: FileTreeProps) {
  const [openFolders, setOpenFolders] = useState<Set<string>>(new Set());

  const buildTree = (fileList: FileItem[]): TreeNode => {
    const tree: TreeNode = {};
    
    // Sort files by path to ensure parent directories are created before children
    const sortedFiles = [...fileList].sort((a, b) => a.path.localeCompare(b.path));

    sortedFiles.forEach(file => {
      const pathParts = file.path.split('/');
      let currentLevel = tree;
      pathParts.forEach((part, index) => {
        if (index === pathParts.length - 1) {
          // This is a file
          currentLevel[part] = file;
        } else {
          // This is a directory
          if (!currentLevel[part]) {
            currentLevel[part] = {};
          }
          currentLevel = currentLevel[part] as TreeNode;
        }
      });
    });
    return tree;
  };

  const fileTree = buildTree(files);

  const toggleFolder = (path: string) => {
    setOpenFolders(prev => {
      const newSet = new Set(prev);
      if (newSet.has(path)) {
        newSet.delete(path);
      } else {
        newSet.add(path);
      }
      return newSet;
    });
  };

  const renderTree = (node: TreeNode, path: string = '') => {
    return Object.entries(node)
      .sort(([aName, aValue], [bName, bValue]) => {
        const aIsFolder = !(aValue as FileItem).type;
        const bIsFolder = !(bValue as FileItem).type;
        if (aIsFolder !== bIsFolder) {
          return aIsFolder ? -1 : 1; // Folders first
        }
        return aName.localeCompare(bName); // Then sort alphabetically
      })
      .map(([name, value]) => {
      const currentPath = path ? `${path}/${name}` : name;
      const isFolder = !(value as FileItem).type;
      
      if (isFolder) {
        const isOpen = openFolders.has(currentPath);
        return (
          <ContextMenu key={currentPath}>
            <ContextMenuTrigger>
              <div
                className="flex items-center space-x-2 px-2 py-1 cursor-pointer rounded-md hover:bg-muted/50"
                onClick={() => toggleFolder(currentPath)}
              >
                {isOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                <Folder className="w-4 h-4 text-amber-500" />
                <span className="text-sm font-medium">{name}</span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
              <ContextMenuItem onClick={() => onNewFile(currentPath)}>
                <FilePlus2 className="w-4 h-4 mr-2" />
                New File
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onNewFolder(currentPath)}>
                <FolderPlus className="w-4 h-4 mr-2" />
                New Folder
              </ContextMenuItem>
              <ContextMenuSeparator />
              <ContextMenuItem onClick={() => onRename(currentPath, name, true)}>
                <Pencil className="w-4 h-4 mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onDelete(currentPath, true)} className="text-red-500">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
            {isOpen && (
              <div className="pl-4 border-l border-border/50 ml-4">
                {renderTree(value as TreeNode, currentPath)}
              </div>
            )}
          </ContextMenu>
        );
      } else {
        const file = value as FileItem;
        return (
          <ContextMenu key={file.id}>
            <ContextMenuTrigger>
              <div
                onClick={() => onFileSelect(file)}
                className={`flex items-center space-x-2 px-2 py-1 cursor-pointer rounded-md ml-4 ${
                  selectedFile === file.id ? 'bg-primary/20' : 'hover:bg-muted/50'
                }`}
              >
                <File className="w-4 h-4 text-blue-500" />
                <span className="text-sm">{name}</span>
              </div>
            </ContextMenuTrigger>
            <ContextMenuContent>
               <ContextMenuItem onClick={() => onRename(file.path, file.name, false)}>
                <Pencil className="w-4 h-4 mr-2" />
                Rename
              </ContextMenuItem>
              <ContextMenuItem onClick={() => onDelete(file.path, false)} className="text-red-500">
                <Trash2 className="w-4 h-4 mr-2" />
                Delete
              </ContextMenuItem>
            </ContextMenuContent>
          </ContextMenu>
        );
      }
    });
  };

  return <div className="p-2 space-y-1">{renderTree(fileTree)}</div>;
}
