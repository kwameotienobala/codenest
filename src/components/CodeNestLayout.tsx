'use client';

import { useState, useEffect } from 'react';
import CodeEditor from './CodeEditor';
import MultiAgentChat from './ai/MultiAgentChat';
import FileUpload from './FileUpload';
import FileList from './FileList';
import CloudFileList from './CloudFileList';
import ConsoleOutput from './ConsoleOutput';
import ThemeToggle from './ThemeToggle';
import { useTheme } from './ThemeProvider';
import { useLocalAgent } from '@/hooks/useLocalAgent';
import { useSupabaseFiles } from '@/hooks/useSupabaseFiles';
import { useToast } from '@/hooks/useToast';
import { Button } from '@/components/ui/button';
import FileTree from './FileTree';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Panel,
  PanelGroup,
  PanelResizeHandle,
} from "react-resizable-panels";
import { FileText, Cloud, Upload, LogOut, FolderOpen, FilePlus2, FolderPlus, Save } from 'lucide-react';
import { FileItem } from '@/types';
import { getDirectoryHandle, storeDirectoryHandle, clearDirectoryHandle } from '@/lib/indexeddb';
import { useRouter } from 'next/navigation';
import ToastContainer from './ToastContainer';

export default function CodeNestLayout() {
  const [currentCode, setCurrentCode] = useState('');
  const [currentFile, setCurrentFile] = useState<FileItem | undefined>();
  const [triggerMessage, setTriggerMessage] = useState<string>('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [hasLoadedFiles, setHasLoadedFiles] = useState(false);
  const [activeTab, setActiveTab] = useState<'local' | 'cloud'>('local');
  const [fileContext, setFileContext] = useState<FileItem[]>([]);
  const { theme } = useTheme();
  const router = useRouter();
  
  // Local agent hook
  const {
    messages: consoleMessages,
    isConnected: agentConnected,
    isRunning: agentRunning,
    runCommand,
    clearMessages: clearConsole,
    killProcesses,
    setWorkingDirectory
  } = useLocalAgent();
  
  const [projectLoading, setProjectLoading] = useState(false);
  const [projectError, setProjectError] = useState<string | null>(null);
  const [projectPath, setProjectPath] = useState<string | null>(null);
  const [directoryHandle, setDirectoryHandle] = useState<FileSystemDirectoryHandle | null>(null);
  
  // Supabase files hook
  const { saveFile: saveToSupabase, isLoading: isSupabaseLoading } = useSupabaseFiles();
  const { addToast } = useToast();

  useEffect(() => {
    const loadPersistedProject = async () => {
      try {
        const handle = await getDirectoryHandle();
        if (handle) {
          addToast({ type: 'info', message: 'Re-opening last project...' });
          await loadProject(handle);
        }
      } catch (e) {
        console.error("Error loading persisted project:", e);
        // Clear the handle if it's invalid
        await clearDirectoryHandle();
      }
    };
    loadPersistedProject();
    // Restore UI state
    try {
      const savedTab = localStorage.getItem('codenest-active-tab') as 'local' | 'cloud' | null;
      if (savedTab === 'local' || savedTab === 'cloud') {
        setActiveTab(savedTab);
      }
    } catch {}
  }, []); // Runs once on mount


  const verifyPermission = async (handle: FileSystemDirectoryHandle): Promise<boolean> => {
    const options = { mode: 'readwrite' as const };
    // Some TS lib versions don’t include these on the Directory handle type; guard and cast
    const anyHandle = handle as any;
    if (typeof anyHandle.queryPermission === 'function') {
      try {
        const qp = await anyHandle.queryPermission(options);
        if (qp === 'granted') return true;
      } catch {}
    }
    if (typeof anyHandle.requestPermission === 'function') {
      try {
        const rp = await anyHandle.requestPermission(options);
        if (rp === 'granted') return true;
      } catch {}
    }
    addToast({ type: 'error', message: 'Permission to write to the local file system was denied.' });
    return false;
  };

  const loadProject = async (handle: FileSystemDirectoryHandle) => {
    setProjectLoading(true);
    setProjectError(null);
    const loadedFiles: FileItem[] = [];
    let fileId = 0;

    // This recursive function now correctly builds the relative path for each file.
    async function processDirectory(directory: FileSystemDirectoryHandle, currentPath: string) {
      const anyDir = directory as any;
      const iterator: AsyncIterable<any> | null = typeof anyDir.values === 'function' ? anyDir.values() : null;
      if (!iterator) return;
      for await (const entry of iterator as AsyncIterable<any>) {
        const newPath = currentPath ? `${currentPath}/${entry.name}` : entry.name;
        if (entry.kind === 'file') {
          // Skip common system files that aren't part of the project
          if (entry.name === '.DS_Store') continue;

          const file = await entry.getFile();
          const content = await file.text();
          loadedFiles.push({
            id: `local-${fileId++}`,
            name: entry.name,
            type: 'file',
            path: newPath, // This now contains the full relative path, e.g., "src/components/Button.tsx"
            content: content,
            language: 'javascript' // Placeholder, will be dynamic later
          });
        } else if (entry.kind === 'directory') {
          // It will recursively process subdirectories, building up the path
          await processDirectory(entry, newPath);
        }
      }
    }

    try {
      // Start the process with an empty base path
      const permissionGranted = await verifyPermission(handle);
      if (!permissionGranted) {
        setProjectError("Permission to access the folder was denied.");
        return;
      }

      await processDirectory(handle, '');

      // Restore unsaved edits
      try {
        const raw = localStorage.getItem('codenest-unsaved-map');
        if (raw) {
          const map = JSON.parse(raw) as Record<string, string>;
          for (const file of loadedFiles) {
            if (map[file.path]) file.content = map[file.path];
          }
        }
      } catch {}

      setProjectPath(handle.name);
      setDirectoryHandle(handle);
      setFiles(loadedFiles);
      setHasLoadedFiles(true);
      if (loadedFiles.length > 0) {
        let selected: FileItem | undefined;
        try {
          const savedPath = localStorage.getItem('codenest-selected-file');
          if (savedPath) {
            selected = loadedFiles.find(f => f.path === savedPath);
          }
        } catch {}
        handleFileSelect(selected || loadedFiles[0]);
      }
    } catch (error: any) {
      setProjectError(error.message);
    } finally {
      setProjectLoading(false);
    }
  };

  const saveToLocal = async (filePath: string, content: string): Promise<boolean> => {
    if (!directoryHandle) {
      addToast({ type: 'error', message: 'No project folder loaded.' });
      return false;
    }

    const hasPermission = await verifyPermission(directoryHandle);
    if (!hasPermission) return false;
    
    try {
      const pathParts = filePath.split('/');
      let currentHandle = directoryHandle;

      // Traverse or create directories as needed
      for (let i = 0; i < pathParts.length - 1; i++) {
        const part = pathParts[i];
        currentHandle = await currentHandle.getDirectoryHandle(part, { create: true });
      }

      // Get a handle for the file and write to it
      const fileHandle = await currentHandle.getFileHandle(pathParts[pathParts.length - 1], { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      addToast({ type: 'success', message: `Saved ${filePath} to local disk.` });
      return true;
    } catch (error: any) {
      addToast({ type: 'error', message: `Error saving to local disk: ${error.message}` });
      console.error("Local save error:", error);
      return false;
    }
  };

    const handleSaveToCloud = async () => {
    if (files.length === 0) {
      addToast({ type: 'error', message: 'No files to save.' });
      return;
    }

    addToast({ type: 'info', message: `Uploading ${files.length} files to the cloud...` });
    
    let successCount = 0;
    let errorCount = 0;

    for (const file of files) {
      const result = await saveToSupabase(file.name, file.content);
      if (result.success) {
        successCount++;
      } else {
        errorCount++;
        console.error(`Failed to save ${file.name}:`, result.error);
      }
    }

    if (errorCount > 0) {
      addToast({
        type: 'error',
        message: `Failed to save ${errorCount} file(s). See console for details.`
      });
    }

    if (successCount > 0) {
      addToast({
        type: 'success',
        message: `Successfully saved ${successCount} file(s) to the cloud.`
      });
    }
  };

  const handleCodeSend = (code: string, action?: string) => {
    setCurrentCode(code);
    
    // If an action is specified, trigger it in the chat
    if (action && code.trim()) {
      const actionPrompts = {
        explain: `Please explain this code:\n\n${code}`,
        refactor: `Please refactor this code to make it better:\n\n${code}`,
        fix: `Please identify and fix any issues in this code:\n\n${code}`
      };
      
      // We'll handle this in the chat component
      handleActionTrigger(action, code);
    }
  };

  const handleFileSelect = (file: FileItem) => {
    setCurrentFile(file);
    setCurrentCode(file.content);
    try { localStorage.setItem('codenest-selected-file', file.path); } catch {}
  };

  // Filter files suitable for AI context (code files only)
  const getContextFiles = (allFiles: FileItem[]): FileItem[] => {
    const codeExtensions = ['.js', '.ts', '.tsx', '.jsx', '.json', '.css'];
    return allFiles
      .filter(file => {
        const extension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
        return codeExtensions.includes(extension);
      })
      .slice(0, 5) // Limit to first 5 files to manage token limits
      .sort((a, b) => {
        // Prioritize certain file types
        const priority = { '.js': 1, '.ts': 1, '.tsx': 2, '.jsx': 2, '.json': 3, '.css': 4 };
        const aExt = a.name.toLowerCase().substring(a.name.lastIndexOf('.'));
        const bExt = b.name.toLowerCase().substring(b.name.lastIndexOf('.'));
        return (priority[aExt as keyof typeof priority] || 5) - (priority[bExt as keyof typeof priority] || 5);
      });
  };

  const handleFilesLoaded = (loadedFiles: FileItem[]) => {
    setFiles(loadedFiles);
    setHasLoadedFiles(loadedFiles.length > 0);
    
    // Prepare context files for AI
    const contextFiles = getContextFiles(loadedFiles);
    setFileContext(contextFiles);
    
    // Auto-select the first file if available
    if (loadedFiles.length > 0) {
      handleFileSelect(loadedFiles[0]);
    }
  };

  const handleFileChange = (fileId: string, newContent: string) => {
    // Update the file in our files array
    const updatedFiles = files.map(file => 
      file.id === fileId 
        ? { ...file, content: newContent }
        : file
    );
    setFiles(updatedFiles);
    // Persist unsaved edits
    try {
      const mapRaw = localStorage.getItem('codenest-unsaved-map');
      const map = (mapRaw ? JSON.parse(mapRaw) : {}) as Record<string, string>;
      const changed = updatedFiles.find(f => f.id === fileId);
      if (changed) {
        map[changed.path] = newContent;
        localStorage.setItem('codenest-unsaved-map', JSON.stringify(map));
      }
    } catch {}
    
    // Update context files with the new content
    const updatedContextFiles = getContextFiles(updatedFiles);
    setFileContext(updatedContextFiles);
    
    // Update current file if it's the one being edited
    if (currentFile && currentFile.id === fileId) {
      setCurrentFile({ ...currentFile, content: newContent });
    }
  };

  const handleActionTrigger = (action: string, code: string) => {
    const actionPrompts = {
      explain: `Please explain this code:\n\n${code}`,
      refactor: `Please refactor this code to make it better:\n\n${code}`,
      fix: `Please identify and fix any issues in this code:\n\n${code}`
    };
    
    // Send the action prompt to the chat
    if (action === 'fix-errors') {
      // When code already contains a fully-built prompt (with diagnostics), forward as-is
      setTriggerMessage(code);
      setCurrentCode(code);
      return;
    } else if (actionPrompts[action as keyof typeof actionPrompts]) {
      setTriggerMessage(actionPrompts[action as keyof typeof actionPrompts]);
      setCurrentCode(code);
    } else if (action === '') {
      // Clear trigger message
      setTriggerMessage('');
    }
  };

  const getLanguageFromFilename = (filename: string): string => {
    const lower = filename.toLowerCase();
    if (lower.endsWith('.ts')) return 'typescript';
    if (lower.endsWith('.tsx')) return 'typescript';
    if (lower.endsWith('.js')) return 'javascript';
    if (lower.endsWith('.jsx')) return 'javascript';
    if (lower.endsWith('.css')) return 'css';
    if (lower.endsWith('.json')) return 'json';
    if (lower.endsWith('.html')) return 'html';
    return 'plaintext';
  };

  // Allow AI chat to create or update files and immediately open them
  const handleAIWriteFile = async (filePath: string, content: string) => {
    if (!directoryHandle) {
      addToast({ type: 'error', message: 'Open a project folder to let the AI write files.' });
      return;
    }
    const hasPermission = await verifyPermission(directoryHandle);
    if (!hasPermission) return;

    try {
      // Ensure nested directories exist before writing
      const pathParts = filePath.split('/').filter(Boolean);
      let parentDir = directoryHandle;
      for (let i = 0; i < pathParts.length - 1; i++) {
        parentDir = await parentDir.getDirectoryHandle(pathParts[i], { create: true });
      }
      const fileName = pathParts[pathParts.length - 1];
      const fileHandle = await parentDir.getFileHandle(fileName, { create: true });
      const writable = await fileHandle.createWritable();
      await writable.write(content);
      await writable.close();

      // Update in-memory list
      const existingIndex = files.findIndex(f => f.path === filePath);
      const fileItem: FileItem = existingIndex >= 0
        ? { ...files[existingIndex], content }
        : {
            id: `local-${Date.now()}`,
            name: fileName,
            type: 'file',
            path: filePath,
            content,
            language: getLanguageFromFilename(fileName)
          };
      const updatedFiles = existingIndex >= 0
        ? files.map((f, idx) => (idx === existingIndex ? fileItem : f))
        : [...files, fileItem];
      setFiles(updatedFiles);
      setHasLoadedFiles(true);
      handleFileSelect(fileItem);

      // Clear any unsaved cache entry for this file
      try {
        const raw = localStorage.getItem('codenest-unsaved-map');
        if (raw) {
          const map = JSON.parse(raw) as Record<string, string>;
          delete map[filePath];
          localStorage.setItem('codenest-unsaved-map', JSON.stringify(map));
        }
      } catch {}

      addToast({ type: 'success', message: `AI wrote ${filePath}` });
    } catch (e: any) {
      console.error('AI write error:', e);
      addToast({ type: 'error', message: `AI write failed: ${e.message}` });
    }
  };

  const handleOpenLocalProject = async () => {
    if ('showDirectoryPicker' in window) {
      try {
        // If a project is already loaded, confirm switching
        if (hasLoadedFiles) {
          const proceed = confirm('Open a different folder? Current project view will be replaced.');
          if (!proceed) return;
        }
        const handle = await window.showDirectoryPicker();
        await storeDirectoryHandle(handle); // Save the handle
        await loadProject(handle);
      } catch (error: any) {
        setProjectError(error.message);
      }
    } else {
      setProjectError('Your browser does not support the File System Access API.');
    }
  };

  const handleTestLocalSave = async () => {
    if (!("showDirectoryPicker" in window)) {
      setProjectError('Your browser does not support the File System Access API. Use Chrome or Edge over HTTPS.');
      addToast({ type: 'error', message: 'File System Access API not supported (use Chrome/Edge over HTTPS).' });
      return;
    }
    try {
      let handleToUse: FileSystemDirectoryHandle;
      if (directoryHandle) {
        handleToUse = directoryHandle;
      } else {
        const picked: FileSystemDirectoryHandle = await (window as any).showDirectoryPicker();
        await storeDirectoryHandle(picked);
        setDirectoryHandle(picked);
        handleToUse = picked;
      }
      const permitted = await verifyPermission(handleToUse);
      if (!permitted) return;
      const testFile = 'codenest-test.txt';
      const ok = await saveToLocal(testFile, `CodeNest local save test at ${new Date().toISOString()}\n`);
      if (ok) {
        addToast({ type: 'success', message: `Wrote ${testFile} in selected folder.` });
      }
    } catch (e: any) {
      addToast({ type: 'error', message: `Test save failed: ${e.message}` });
      setProjectError(e.message);
    }
  };

  const handleCloseProject = async () => {
    const proceed = confirm('Close the current project? You can reopen it from Open Folder...');
    if (!proceed) return;
    await clearDirectoryHandle();
    setFiles([]);
    setHasLoadedFiles(false);
    setCurrentFile(undefined);
    setProjectPath(null);
    setDirectoryHandle(null);
    try {
      localStorage.removeItem('codenest-selected-file');
    } catch {}
  };

  const handleNewFile = async (folderPath: string = '') => {
    const fileName = prompt('Enter new file name:');
    if (fileName && directoryHandle) {
      const fullPath = folderPath ? `${folderPath}/${fileName}` : fileName;
      const success = await saveToLocal(fullPath, ''); // Create with empty content
      if (success) {
        const newFile: FileItem = {
          id: `local-${Date.now()}`,
          name: fileName,
          path: fullPath,
          type: 'file',
          content: '',
          language: 'plaintext'
        };
        setFiles([...files, newFile]);
        handleFileSelect(newFile);
      }
    } else if (!directoryHandle) {
        addToast({ type: 'error', message: 'Cannot create file: No project folder loaded.' });
    }
  };

  const handleNewFolder = async (folderPath: string = '') => {
    const folderName = prompt('Enter new folder name:');
    if (folderName && directoryHandle) {
      const fullPath = folderPath ? `${folderPath}/${folderName}` : folderName;
      // We'll create a placeholder file to represent the folder, as empty folders aren't directly visible.
      const placeholderPath = `${fullPath}/.placeholder`;
      const success = await saveToLocal(placeholderPath, 'This file marks an empty directory.');
      if (success) {
        // We can just reload the project to see the new folder.
        // A more optimized approach would be to add the folder to the state.
        await loadProject(directoryHandle);
        addToast({ type: 'success', message: `Folder "${folderName}" created successfully.`});
      }
    } else if (!directoryHandle) {
      addToast({ type: 'error', message: 'Cannot create folder: No project folder loaded.' });
    }
  };

  // Helpers
  const getParentDirectoryHandle = async (root: FileSystemDirectoryHandle, fullPath: string): Promise<FileSystemDirectoryHandle> => {
    const parts = fullPath.split('/').filter(Boolean);
    const parentParts = parts.slice(0, -1);
    let current = root;
    for (const part of parentParts) {
      current = await current.getDirectoryHandle(part, { create: false });
    }
    return current;
  };

  const copyDirectoryRecursive = async (
    source: FileSystemDirectoryHandle,
    destination: FileSystemDirectoryHandle
  ) => {
    const anySrc = source as any;
    const iterator: AsyncIterable<any> | null = typeof anySrc.values === 'function' ? anySrc.values() : null;
    if (!iterator) return;
    for await (const entry of iterator as AsyncIterable<any>) {
      if (entry.kind === 'file') {
        const file = await entry.getFile();
        const destFile = await destination.getFileHandle(entry.name, { create: true });
        const writable = await destFile.createWritable();
        await writable.write(await file.text());
        await writable.close();
      } else if (entry.kind === 'directory') {
        const subDest = await destination.getDirectoryHandle(entry.name, { create: true });
        await copyDirectoryRecursive(entry, subDest);
      }
    }
  };

  const handleRename = async (oldPath: string, oldName: string, isFolder: boolean) => {
    const newName = prompt(`Enter new name for "${oldName}":`, oldName);
    if (!newName || newName === oldName) return;
    if (!directoryHandle) { addToast({ type: 'error', message: 'No project folder loaded.' }); return; }
    const hasPermission = await verifyPermission(directoryHandle);
    if (!hasPermission) return;

    try {
      const parent = await getParentDirectoryHandle(directoryHandle, oldPath);
      const oldBase = oldPath.split('/').filter(Boolean).pop()!;
      if (isFolder) {
        const source = await parent.getDirectoryHandle(oldBase, { create: false });
        const destination = await parent.getDirectoryHandle(newName, { create: true });
        await copyDirectoryRecursive(source, destination);
        await parent.removeEntry(oldBase, { recursive: true });
      } else {
        const oldFile = await parent.getFileHandle(oldBase, { create: false });
        const file = await oldFile.getFile();
        const newFile = await parent.getFileHandle(newName, { create: true });
        const writable = await newFile.createWritable();
        await writable.write(await file.text());
        await writable.close();
        await parent.removeEntry(oldBase);
      }

      await loadProject(directoryHandle);
      addToast({ type: 'success', message: `Renamed to ${newName}` });
    } catch (e: any) {
      addToast({ type: 'error', message: `Rename failed: ${e.message}` });
    }
  };

  const handleDelete = async (path: string, isFolder: boolean) => {
    if (!confirm(`Are you sure you want to delete "${path}"? This cannot be undone.`)) return;

    if (!directoryHandle) {
        addToast({ type: 'error', message: 'No project folder loaded.' });
        return;
    }
    const hasPermission = await verifyPermission(directoryHandle);
    if (!hasPermission) return;

    try {
        const parts = path.split('/').filter(Boolean);
        const base = parts.pop();
        if (!base) return;
        const parent = await getParentDirectoryHandle(directoryHandle, path);
        await parent.removeEntry(base, { recursive: isFolder });
        
        // Refresh file tree
        await loadProject(directoryHandle);
        addToast({ type: 'success', message: `Deleted: ${path}` });

    } catch(e: any) {
        addToast({ type: 'error', message: `Failed to delete: ${e.message}` });
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('codenest-auth');
    localStorage.removeItem('codenest-user');
    router.push('/login');
  };

  return (
    <div className={`h-screen flex flex-col bg-background ${theme === 'light' ? '' : 'dark'}`}>
      <ToastContainer />
      <PanelGroup direction="vertical">
        <Panel>
          <PanelGroup direction="horizontal">
            <Panel defaultSize={20} minSize={15}>
              {/* File Sidebar - Left */}
              <div className="w-full h-full border-r border-border bg-card flex flex-col">
                {/* Tab Navigation */}
                <div className="flex border-b border-border">
                  <Button
                    onClick={() => { setActiveTab('local'); try{localStorage.setItem('codenest-active-tab','local');}catch{} }}
                    variant={activeTab === 'local' ? 'default' : 'ghost'}
                    size="sm"
                    className="flex-1 rounded-none border-r border-border flex items-center gap-2"
                  >
                    <FileText className="w-4 h-4" />
                    Local
                  </Button>
                  <Button
                    onClick={() => { setActiveTab('cloud'); try{localStorage.setItem('codenest-active-tab','cloud');}catch{} }}
                    variant={activeTab === 'cloud' ? 'default' : 'ghost'}
                    size="sm"
                    className="flex-1 rounded-none flex items-center gap-2"
                  >
                    <Cloud className="w-4 h-4" />
                    Cloud
                  </Button>
                </div>

                {/* Tab Content */}
                <div className="flex-1 overflow-auto">
                  {activeTab === 'local' && (
                    <>
                      {!hasLoadedFiles ? (
                        <div className="p-4">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="outline" className="w-full justify-start px-2">
                                File
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent>
                              <DropdownMenuItem onClick={handleOpenLocalProject} disabled={projectLoading}>
                                <FolderOpen className="w-4 h-4 mr-2" />
                                {projectLoading ? 'Waiting for folder selection...' : 'Open Folder...'}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                          
                          {projectError && (
                            <div className="mt-4 text-sm text-red-500 text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                              {projectError}
                            </div>
                          )}
                          
                          {!agentConnected && (
                            <div className="mt-4 text-xs text-amber-600 text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                              Local agent is optional (enables console). You can still open a folder and save locally.
                            </div>
                          )}

                          <div className="mt-4">
                            <Button onClick={handleTestLocalSave} className="w-full" variant="secondary">
                              <Save className="w-4 h-4 mr-2" />
                              Test Local Save
                            </Button>
                            <div className="text-[11px] text-muted-foreground mt-2">
                              Requires Chrome/Edge and HTTPS (or localhost). You will be asked to pick a folder.
                            </div>
                          </div>
                        </div>
                      ) : (
                        <>
                          <div className="p-2 flex items-center justify-between border-b border-border">
                            <span className="text-sm font-bold truncate" title={projectPath || 'Project'}>
                              {projectPath}
                            </span>
                            <div className="flex items-center gap-1">
                              <Button variant="ghost" size="icon" onClick={handleOpenLocalProject} title="Open Another Folder">
                                <FolderOpen className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleNewFile('')} title="New File in Root">
                                <FilePlus2 className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleNewFolder('')} title="New Folder in Root">
                                <FolderPlus className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={handleTestLocalSave} title="Test Local Save">
                                <Save className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={handleCloseProject} title="Close Project">
                                <LogOut className="w-4 h-4" />
                              </Button>
                            </div>
                          </div>
                          <FileTree 
                            files={files}
                            onFileSelect={handleFileSelect}
                            selectedFile={currentFile?.id}
                            onNewFile={handleNewFile}
                            onNewFolder={handleNewFolder}
                            onRename={handleRename}
                            onDelete={handleDelete}
                          />
                          <div className="p-2 border-t border-border">
                            <Button 
                              onClick={handleSaveToCloud} 
                              className="w-full"
                              disabled={isSupabaseLoading || files.length === 0}
                            >
                              <Cloud className="w-4 h-4 mr-2" />
                              {isSupabaseLoading ? 'Saving Project...' : 'Save Project to Cloud'}
                            </Button>
                          </div>
                        </>
                      )}
                    </>
                  )}
                  
                  {activeTab === 'cloud' && (
                    <CloudFileList onFileSelect={handleFileSelect} />
                  )}
                </div>
              </div>
            </Panel>
            <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />
            <Panel>
              {/* Code Editor - Center */}
              <div className="h-full border-r border-border">
                <CodeEditor 
                  onCodeSend={handleCodeSend}
                  currentFile={currentFile}
                  onFileChange={handleFileChange}
                  onSaveToLocal={saveToLocal}
                />
              </div>
            </Panel>
            <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />
            <Panel defaultSize={25} minSize={20}>
              {/* AI Chat - Right */}
              <div className="w-full h-full flex flex-col">
                {/* Header with theme toggle and logout */}
                <div className="flex items-center justify-between p-3 bg-card border-b border-border">
                  <h3 className="text-sm font-medium text-card-foreground">
                    AI Assistant
                  </h3>
                  <div className="flex items-center gap-2">
                    <ThemeToggle />
                    <Button
                      onClick={handleLogout}
                      size="sm"
                      variant="ghost"
                      className="text-muted-foreground hover:text-foreground"
                      title="Logout"
                    >
                      <LogOut className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
                
                {/* Chat component */}
                <div className="flex-1 min-h-0">
                  <MultiAgentChat 
                    onCodeReceived={setCurrentCode} 
                    onFileGenerated={(filename, content) => handleAIWriteFile(filename, content)}
                    onFilesGenerated={async (files) => {
                      for (const f of files) {
                        await handleAIWriteFile(f.filename, f.content);
                      }
                    }}
                    currentCode={currentCode}
                    onActionTrigger={handleActionTrigger}
                    triggerMessage={triggerMessage}
                    fileContext={fileContext}
                  />
                </div>
              </div>
            </Panel>
          </PanelGroup>
        </Panel>
        <PanelResizeHandle className="h-1 bg-border hover:bg-primary transition-colors" />
        <Panel defaultSize={30} minSize={10}>
          {/* Console Panel - Bottom */}
          <div className="h-full border-t border-border bg-card">
            <ConsoleOutput
              messages={consoleMessages}
              isConnected={agentConnected}
              isRunning={agentRunning}
              onRunCommand={runCommand}
              onClear={clearConsole}
                  onKillProcesses={killProcesses}
                  onSetWorkingDirectory={setWorkingDirectory}
            />
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
} 