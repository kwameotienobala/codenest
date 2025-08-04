'use client';

import { useState } from 'react';
import CodeEditor from './CodeEditor';
import MultiAgentChat from './ai/MultiAgentChat';
import FileUpload from './FileUpload';
import FileList from './FileList';
import CloudFileList from './CloudFileList';
import ConsoleOutput from './ConsoleOutput';
import ThemeToggle from './ThemeToggle';
import { useTheme } from './ThemeProvider';
import { useLocalAgent } from '@/hooks/useLocalAgent';
import { useLocalProject } from '@/hooks/useLocalProject';
import { Button } from '@/components/ui/button';
import { FileText, Cloud, Upload, LogOut, FolderOpen } from 'lucide-react';
import { FileItem } from '@/types';
import { useRouter } from 'next/navigation';

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
    killProcesses
  } = useLocalAgent();
  
  // Local project hook
  const {
    isLoading: projectLoading,
    error: projectError,
    projectPath,
    loadProject,
    saveFile: saveToLocal
  } = useLocalProject();

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
    if (actionPrompts[action as keyof typeof actionPrompts]) {
      setTriggerMessage(actionPrompts[action as keyof typeof actionPrompts]);
      setCurrentCode(code);
    } else if (action === '') {
      // Clear trigger message
      setTriggerMessage('');
    }
  };

  const handleOpenLocalProject = async () => {
    try {
      const projectFiles = await loadProject();
      if (projectFiles.length > 0) {
        setFiles(projectFiles);
        setHasLoadedFiles(true);
        setActiveTab('local');
        
        // Auto-select first file
        setCurrentFile(projectFiles[0]);
        setCurrentCode(projectFiles[0].content || '');
        
        // Update file context for AI
        setFileContext(getContextFiles(projectFiles));
      }
    } catch (error) {
      console.error('Failed to open local project:', error);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('codenest-auth');
    localStorage.removeItem('codenest-user');
    router.push('/login');
  };

  return (
    <div className={`h-screen flex flex-col bg-background ${theme === 'light' ? '' : 'dark'}`}>
      {/* Main Content Area */}
      <div className="flex-1 flex">
        {/* File Sidebar - Left */}
        <div className="w-64 border-r border-border bg-card flex flex-col">
        {/* Tab Navigation */}
        <div className="flex border-b border-border">
          <Button
            onClick={() => setActiveTab('local')}
            variant={activeTab === 'local' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 rounded-none border-r border-border flex items-center gap-2"
          >
            <FileText className="w-4 h-4" />
            Local
          </Button>
          <Button
            onClick={() => setActiveTab('cloud')}
            variant={activeTab === 'cloud' ? 'default' : 'ghost'}
            size="sm"
            className="flex-1 rounded-none flex items-center gap-2"
          >
            <Cloud className="w-4 h-4" />
            Cloud
          </Button>
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-hidden">
          {activeTab === 'local' && (
            <>
              {!hasLoadedFiles ? (
                <div className="flex flex-col items-center justify-center p-4 space-y-4 h-full">
                  <FileUpload onFilesLoaded={handleFilesLoaded} />
                  
                  <div className="text-center text-sm text-muted-foreground">
                    or
                  </div>
                  
                  <Button
                    onClick={handleOpenLocalProject}
                    disabled={!agentConnected || projectLoading}
                    variant="outline"
                    className="w-full"
                  >
                    <FolderOpen className="w-4 h-4 mr-2" />
                    {projectLoading ? 'Loading...' : 'Open Local Project'}
                  </Button>
                  
                  {projectError && (
                    <div className="text-sm text-red-500 text-center p-2 bg-red-50 dark:bg-red-900/20 rounded">
                      {projectError}
                    </div>
                  )}
                  
                  {projectPath && (
                    <div className="text-xs text-muted-foreground text-center">
                      Current: {projectPath}
                    </div>
                  )}
                  
                  {!agentConnected && (
                    <div className="text-xs text-amber-600 text-center p-2 bg-amber-50 dark:bg-amber-900/20 rounded">
                      Start the local agent to open projects
                    </div>
                  )}
                </div>
              ) : (
                <FileList 
                  files={files}
                  onFileSelect={handleFileSelect}
                  selectedFile={currentFile?.id}
                />
              )}
            </>
          )}
          
          {activeTab === 'cloud' && (
            <CloudFileList onFileSelect={handleFileSelect} />
          )}
        </div>
      </div>
      
      {/* Code Editor - Center */}
      <div className="flex-1 border-r border-border">
        <CodeEditor 
          onCodeSend={handleCodeSend}
          currentFile={currentFile}
          onFileChange={handleFileChange}
          onSaveToLocal={saveToLocal}
        />
      </div>
      
      {/* AI Chat - Right */}
      <div className="w-96 flex flex-col">
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
        <div className="flex-1">
          <MultiAgentChat 
            onCodeReceived={setCurrentCode} 
            currentCode={currentCode}
            onActionTrigger={handleActionTrigger}
            triggerMessage={triggerMessage}
            fileContext={fileContext}
          />
        </div>
      </div>
      </div>
      
      {/* Console Panel - Bottom */}
      <div className="h-80 border-t border-border bg-card">
        <ConsoleOutput
          messages={consoleMessages}
          isConnected={agentConnected}
          isRunning={agentRunning}
          onRunCommand={runCommand}
          onClear={clearConsole}
          onKillProcesses={killProcesses}
        />
      </div>
    </div>
  );
} 