'use client';

import { useRef, useState, useEffect } from 'react';
import Editor from '@monaco-editor/react';
import { Button } from '@/components/ui/button';
import { Send, Lightbulb, Wrench, Bug, Save, Download, ChevronDown, Cloud } from 'lucide-react';
import { FileItem } from '@/types';
import { supabase } from '@/lib/supabase';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';

interface CodeEditorProps {
  onCodeSend: (code: string, action?: string) => void;
  currentFile?: FileItem;
  onFileChange?: (fileId: string, newContent: string) => void;
  onSaveToLocal?: (filePath: string, content: string) => Promise<boolean>;
}

export default function CodeEditor({ onCodeSend, currentFile, onFileChange, onSaveToLocal }: CodeEditorProps) {
  const editorRef = useRef<any>(null);
  const [selectedCode, setSelectedCode] = useState('');
  const [editorValue, setEditorValue] = useState('');
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showToast, setShowToast] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isSavingToCloud, setIsSavingToCloud] = useState(false);
  const [isSavingToLocal, setIsSavingToLocal] = useState(false);

  const handleEditorDidMount = (editor: any) => {
    editorRef.current = editor;
    
    // Listen for text selection changes
    editor.onDidChangeCursorSelection((e: any) => {
      const selection = editor.getSelection();
      const selectedText = editor.getModel().getValueInRange(selection);
      setSelectedCode(selectedText);
    });

    // Listen for content changes
    editor.onDidChangeModelContent(() => {
      const newValue = editor.getValue();
      setEditorValue(newValue);
      setHasUnsavedChanges(true);
      
      // Notify parent of file changes
      if (currentFile && onFileChange) {
        onFileChange(currentFile.id, newValue);
      }
    });
  };

  const handleSendCode = (action?: string) => {
    const codeToSend = selectedCode || editorRef.current?.getValue() || '';
    onCodeSend(codeToSend, action);
  };

  const handleActionClick = (action: string) => {
    const codeToSend = selectedCode || editorRef.current?.getValue() || '';
    if (codeToSend.trim()) {
      onCodeSend(codeToSend, action);
    }
  };

  const handleSave = () => {
    if (currentFile && editorRef.current) {
      const content = editorRef.current.getValue();
      console.log('Saving file:', currentFile.name, content);
      setHasUnsavedChanges(false);
      // In a real app, you would save to the file system here
    }
  };

  const handleSaveToLocal = (format?: string) => {
    if (!editorRef.current) return;

    const content = editorRef.current.getValue();
    const fileName = currentFile?.name || 'code';
    
    // Determine file extension
    let fileExtension = '';
    if (format) {
      fileExtension = format.startsWith('.') ? format : `.${format}`;
    } else if (currentFile) {
      const lastDotIndex = currentFile.name.lastIndexOf('.');
      fileExtension = lastDotIndex > 0 ? currentFile.name.substring(lastDotIndex) : '';
    } else {
      fileExtension = '.txt';
    }

    // Create filename
    const baseName = fileName.includes('.') ? fileName.substring(0, fileName.lastIndexOf('.')) : fileName;
    const finalFileName = `${baseName}${fileExtension}`;

    // Create blob and download
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = finalFileName;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Clean up URL
    URL.revokeObjectURL(url);

    // Show toast notification
    setToastMessage(`File saved as ${finalFileName}`);
    setShowToast(true);
    setTimeout(() => setShowToast(false), 3000);
  };

  const handleSaveToCloud = async () => {
    if (!editorRef.current) return;

    // Check if Supabase is configured
    if (!supabase) {
      setToastMessage('Supabase not configured. Please set up environment variables.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      return;
    }

    setIsSavingToCloud(true);
    try {
      const content = editorRef.current.getValue();
      const fileName = currentFile?.name || `code_${Date.now()}.js`;

      const { data, error } = await supabase
        .from('code_files')
        .insert([
          {
            filename: fileName,
            content: content,
          }
        ])
        .select();

      if (error) {
        throw error;
      }

      setToastMessage(`File "${fileName}" saved to cloud successfully!`);
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
      setHasUnsavedChanges(false);
    } catch (error) {
      console.error('Error saving to cloud:', error);
      setToastMessage('Failed to save to cloud. Please try again.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsSavingToCloud(false);
    }
  };

  const handleSaveToLocalFile = async () => {
    if (!editorRef.current || !onSaveToLocal || !currentFile?.path) return;

    setIsSavingToLocal(true);
    try {
      const content = editorRef.current.getValue();
      const success = await onSaveToLocal(currentFile.path, content);

      if (success) {
        setToastMessage(`File "${currentFile.name}" saved locally!`);
        setHasUnsavedChanges(false);
      } else {
        setToastMessage('Failed to save file locally. Check console for details.');
      }
      
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } catch (error) {
      console.error('Error saving to local file:', error);
      setToastMessage('Failed to save file locally.');
      setShowToast(true);
      setTimeout(() => setShowToast(false), 3000);
    } finally {
      setIsSavingToLocal(false);
    }
  };

  // Update editor content when file changes
  useEffect(() => {
    if (currentFile && editorRef.current) {
      editorRef.current.setValue(currentFile.content);
      setEditorValue(currentFile.content);
      setHasUnsavedChanges(false);
    }
  }, [currentFile]);

  const getLanguageFromFile = (file?: FileItem) => {
    if (!file) return 'javascript';
    if (file.name.endsWith('.js')) return 'javascript';
    if (file.name.endsWith('.css')) return 'css';
    if (file.name.endsWith('.html')) return 'html';
    if (file.name.endsWith('.ts')) return 'typescript';
    if (file.name.endsWith('.tsx')) return 'typescript';
    if (file.name.endsWith('.jsx')) return 'javascript';
    if (file.name.endsWith('.json')) return 'json';
    return 'javascript';
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex justify-between items-center p-3 bg-card border-b border-border">
        <div className="flex items-center gap-3">
          <h3 className="text-sm font-medium text-card-foreground">
            {currentFile ? currentFile.name : 'Code Editor'}
          </h3>
          {currentFile && (
            <span className="text-xs text-muted-foreground bg-muted px-2 py-1 rounded">
              {getLanguageFromFile(currentFile)}
            </span>
          )}
          {hasUnsavedChanges && (
            <span className="text-xs text-orange-600 bg-orange-100 dark:bg-orange-900 dark:text-orange-200 px-2 py-1 rounded">
              Unsaved
            </span>
          )}
        </div>
        
        <div className="flex items-center gap-2">
          {currentFile && (
            <>
              <Button
                onClick={handleSave}
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
                disabled={!hasUnsavedChanges}
              >
                <Save className="w-3 h-3" />
                Save
              </Button>

              {onSaveToLocal && currentFile?.path && (
                <Button
                  onClick={handleSaveToLocalFile}
                  size="sm"
                  variant="outline"
                  className="flex items-center gap-1"
                  disabled={isSavingToLocal}
                >
                  <Save className="w-3 h-3" />
                  {isSavingToLocal ? 'Saving...' : 'Save to Local'}
                </Button>
              )}

              <Button
                onClick={handleSaveToCloud}
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
                disabled={isSavingToCloud}
              >
                <Cloud className="w-3 h-3" />
                {isSavingToCloud ? 'Saving...' : 'Save to Cloud'}
              </Button>
              
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex items-center gap-1"
                  >
                    <Download className="w-3 h-3" />
                    Save to Local
                    <ChevronDown className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem onClick={() => handleSaveToLocal()}>
                    Original format
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSaveToLocal('.js')}>
                    JavaScript (.js)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSaveToLocal('.ts')}>
                    TypeScript (.ts)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSaveToLocal('.jsx')}>
                    React JSX (.jsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSaveToLocal('.tsx')}>
                    React TSX (.tsx)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSaveToLocal('.css')}>
                    CSS (.css)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSaveToLocal('.html')}>
                    HTML (.html)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSaveToLocal('.json')}>
                    JSON (.json)
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => handleSaveToLocal('.txt')}>
                    Text (.txt)
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </>
          )}
          
          {selectedCode && (
            <>
              <Button
                onClick={() => handleActionClick('explain')}
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
              >
                <Lightbulb className="w-3 h-3" />
                Explain
              </Button>
              <Button
                onClick={() => handleActionClick('refactor')}
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
              >
                <Wrench className="w-3 h-3" />
                Refactor
              </Button>
              <Button
                onClick={() => handleActionClick('fix')}
                size="sm"
                variant="outline"
                className="flex items-center gap-1"
              >
                <Bug className="w-3 h-3" />
                Fix
              </Button>
            </>
          )}
          <Button
            onClick={() => handleSendCode()}
            size="sm"
            className="flex items-center gap-2"
          >
            <Send className="w-4 h-4" />
            {selectedCode ? 'Send Selection' : 'Send All Code'}
          </Button>
        </div>
      </div>
      
      <div className="flex-1">
        <Editor
          height="100%"
          defaultLanguage={getLanguageFromFile(currentFile)}
          defaultValue={currentFile?.content || "// Start coding here...\nfunction hello() {\n  console.log('Hello, CodeNest!');\n}"}
          theme="vs-dark"
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            wordWrap: 'on',
            automaticLayout: true,
            lineNumbers: 'on',
            roundedSelection: false,
            scrollBeyondLastLine: false,
            readOnly: false,
            cursorStyle: 'line',
            contextmenu: true,
            mouseWheelZoom: true,
          }}
        />
      </div>

      {/* Toast Notification */}
      {showToast && (
        <div className="fixed bottom-4 right-4 bg-green-600 text-white px-4 py-2 rounded-md shadow-lg z-50 animate-in slide-in-from-bottom-2">
          {toastMessage}
        </div>
      )}
    </div>
  );
} 