'use client';

import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Folder, FileCode, FileText, File } from 'lucide-react';
import { FileItem } from '@/types';

interface FileSidebarProps {
  onFileSelect: (file: FileItem) => void;
  selectedFile?: string;
}

const mockFiles: FileItem[] = [
  {
    id: '1',
    name: 'index.js',
    type: 'file',
    path: '/index.js',
    language: 'javascript',
    content: `// Main application entry point
import React from 'react';
import ReactDOM from 'react-dom';
import App from './App';

ReactDOM.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
  document.getElementById('root')
);`
  },
  {
    id: '2',
    name: 'api.js',
    type: 'file',
    path: '/api.js',
    language: 'javascript',
    content: `// API configuration and endpoints
const API_BASE_URL = 'https://api.example.com';

export const apiClient = {
  async get(endpoint) {
    const response = await fetch(\`\${API_BASE_URL}\${endpoint}\`);
    return response.json();
  },
  
  async post(endpoint, data) {
    const response = await fetch(\`\${API_BASE_URL}\${endpoint}\`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    return response.json();
  }
};`
  },
  {
    id: '3',
    name: 'helpers.js',
    type: 'file',
    path: '/utils/helpers.js',
    language: 'javascript',
    content: `// Utility functions
export const formatDate = (date) => {
  return new Date(date).toLocaleDateString();
};

export const debounce = (func, wait) => {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
};

export const validateEmail = (email) => {
  const re = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
  return re.test(email);
};`
  },
  {
    id: '4',
    name: 'styles.css',
    type: 'file',
    path: '/styles.css',
    language: 'css',
    content: `/* Global styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  line-height: 1.6;
  color: #333;
}

.container {
  max-width: 1200px;
  margin: 0 auto;
  padding: 0 20px;
}

.btn {
  padding: 8px 16px;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-primary {
  background-color: #007bff;
  color: white;
}

.btn-primary:hover {
  background-color: #0056b3;
}`
  }
];

export default function FileSidebar({ onFileSelect, selectedFile }: FileSidebarProps) {
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set());

  const getFileIcon = (fileName: string) => {
    if (fileName.endsWith('.js')) return <FileCode className="w-4 h-4" />;
    if (fileName.endsWith('.css')) return <FileText className="w-4 h-4" />;
    return <File className="w-4 h-4" />;
  };

  const handleFileClick = (file: FileItem) => {
    onFileSelect(file);
  };

  return (
    <div className="w-64 bg-gray-50 border-r border-gray-200 flex flex-col">
      <div className="p-4 border-b border-gray-200">
        <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
          <Folder className="w-4 h-4" />
          Project Files
        </h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2">
        <div className="space-y-1">
          {mockFiles.map((file) => (
            <Card
              key={file.id}
              className={`cursor-pointer transition-colors hover:bg-gray-100 ${
                selectedFile === file.id ? 'bg-blue-50 border-blue-200' : ''
              }`}
              onClick={() => handleFileClick(file)}
            >
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  {getFileIcon(file.name)}
                  <span className="text-sm font-medium text-gray-700 truncate">
                    {file.name}
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
} 