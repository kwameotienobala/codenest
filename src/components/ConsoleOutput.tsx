'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Terminal, Play, Square, Trash2, Wifi, WifiOff, Server, AlertTriangle, Hammer, Clock } from 'lucide-react';

interface ConsoleMessage {
  id: string;
  type: 'stdout' | 'stderr' | 'system' | 'command';
  content: string;
  timestamp: Date;
  category?: 'server' | 'errors' | 'build';
}

interface ConsoleOutputProps {
  messages: ConsoleMessage[];
  isConnected: boolean;
  isRunning: boolean;
  onRunCommand: (command: string) => void;
  onClear: () => void;
  onKillProcesses: () => void;
  onSetWorkingDirectory?: (absolutePath: string) => Promise<boolean>;
}

type ConsoleTab = 'server' | 'errors' | 'build';

const STORAGE_KEY = 'codenest-console-messages';
const MAX_STORED_MESSAGES = 20;

export default function ConsoleOutput({
  messages,
  isConnected,
  isRunning,
  onRunCommand,
  onClear,
  onKillProcesses,
  onSetWorkingDirectory
}: ConsoleOutputProps) {
  const [customCommand, setCustomCommand] = useState('');
  const [activeTab, setActiveTab] = useState<ConsoleTab>('server');
  const [showTimestamps, setShowTimestamps] = useState(true);
  const [cwdInput, setCwdInput] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const outputRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    if (messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, activeTab]);

  // Persist messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      const messagesToStore = messages.slice(-MAX_STORED_MESSAGES).map(msg => ({
        ...msg,
        timestamp: msg.timestamp.toISOString()
      }));
      localStorage.setItem(STORAGE_KEY, JSON.stringify(messagesToStore));
    }
  }, [messages]);

  // Categorize messages based on content and type
  const categorizeMessage = (message: ConsoleMessage): 'server' | 'errors' | 'build' => {
    if (message.category) return message.category;
    
    const content = message.content.toLowerCase();
    
    // Error patterns
    if (message.type === 'stderr' || 
        content.includes('error') || 
        content.includes('failed') || 
        content.includes('exception') ||
        content.includes('✗')) {
      return 'errors';
    }
    
    // Build patterns
    if (content.includes('build') || 
        content.includes('compile') || 
        content.includes('bundle') ||
        content.includes('webpack') ||
        content.includes('vite') ||
        content.includes('✓ compiled')) {
      return 'build';
    }
    
    // Default to server
    return 'server';
  };

  // Filter messages by active tab
  const filteredMessages = messages.filter(message => {
    const category = categorizeMessage(message);
    return activeTab === category;
  });

  // Count messages by category
  const messageCounts = messages.reduce((acc, message) => {
    const category = categorizeMessage(message);
    acc[category] = (acc[category] || 0) + 1;
    return acc;
  }, {} as Record<ConsoleTab, number>);

  const formatTimestamp = (timestamp: Date) => {
    return timestamp.toLocaleTimeString('en-US', { 
      hour12: false,
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      fractionalSecondDigits: 3
    });
  };

  const getMessageStyle = (type: ConsoleMessage['type']) => {
    switch (type) {
      case 'stdout':
        return 'text-green-400';
      case 'stderr':
        return 'text-red-400';
      case 'system':
        return 'text-blue-400';
      case 'command':
        return 'text-yellow-400 font-semibold';
      default:
        return 'text-gray-300';
    }
  };

  const getTypeIcon = (type: ConsoleMessage['type']) => {
    switch (type) {
      case 'command':
        return '>';
      case 'system':
        return '•';
      case 'stderr':
        return '✗';
      case 'stdout':
      default:
        return '';
    }
  };

  const handleRunCommand = () => {
    if (customCommand.trim()) {
      onRunCommand(customCommand.trim());
      setCustomCommand('');
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleRunCommand();
    }
  };

  const handleClearTab = () => {
    // Clear messages for current tab - this would need to be implemented in the parent
    onClear();
  };

  const quickCommands = [
    'npm run dev',
    'npm run build',
    'npm install',
    'npm test',
    'npm --version',
    'node --version',
    'pwd',
    'ls -la'
  ];

  // Detect preview URL from messages
  const previewUrl = (() => {
    const allText = messages.map(m => m.content).join('\n');
    const match = allText.match(/http:\/\/localhost:\d{2,5}/);
    return match ? match[0] : null;
  })();

  const tabs: Array<{ id: ConsoleTab; label: string; icon: React.ReactNode; color: string }> = [
    {
      id: 'server',
      label: 'Server Logs',
      icon: <Server className="w-4 h-4" />,
      color: 'text-blue-500'
    },
    {
      id: 'errors',
      label: 'Errors',
      icon: <AlertTriangle className="w-4 h-4" />,
      color: 'text-red-500'
    },
    {
      id: 'build',
      label: 'Build Output',
      icon: <Hammer className="w-4 h-4" />,
      color: 'text-green-500'
    }
  ];

  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Terminal className="w-5 h-5" />
            <CardTitle className="text-lg">Console</CardTitle>
            <Badge variant={isConnected ? 'default' : 'destructive'} className="ml-2">
              {isConnected ? (
                <>
                  <Wifi className="w-3 h-3 mr-1" />
                  Connected
                </>
              ) : (
                <>
                  <WifiOff className="w-3 h-3 mr-1" />
                  Disconnected
                </>
              )}
            </Badge>
            {isRunning && (
              <Badge variant="secondary" className="animate-pulse">
                Running...
              </Badge>
            )}
          </div>
          <div className="flex items-center space-x-2">
            <Button
              onClick={() => setShowTimestamps(!showTimestamps)}
              size="sm"
              variant="ghost"
              title="Toggle timestamps"
            >
              <Clock className="w-4 h-4" />
            </Button>
            <Button
              onClick={onKillProcesses}
              size="sm"
              variant="destructive"
              disabled={!isConnected || !isRunning}
            >
              <Square className="w-4 h-4 mr-1" />
              Kill
            </Button>
            <Button
              onClick={handleClearTab}
              size="sm"
              variant="outline"
            >
              <Trash2 className="w-4 h-4 mr-1" />
              Clear
            </Button>
          </div>
        </div>

        {/* Console Tabs */}
        <div className="flex space-x-1 mt-3">
          {tabs.map((tab) => (
            <Button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              variant={activeTab === tab.id ? 'default' : 'ghost'}
              size="sm"
              className="flex items-center space-x-2"
            >
              <span className={tab.color}>{tab.icon}</span>
              <span>{tab.label}</span>
              {messageCounts[tab.id] > 0 && (
                <Badge variant="secondary" className="ml-1 text-xs">
                  {messageCounts[tab.id]}
                </Badge>
              )}
            </Button>
          ))}
        </div>

        {/* Working Directory Controls */}
        <div className="mt-3 flex items-center gap-2">
          <input
            value={cwdInput}
            onChange={(e) => setCwdInput(e.target.value)}
            placeholder="Set working directory (absolute path)"
            className="flex-1 bg-muted px-2 py-1 rounded text-sm"
          />
          <Button
            size="sm"
            variant="outline"
            onClick={async () => {
              if (onSetWorkingDirectory && cwdInput.trim()) {
                await onSetWorkingDirectory(cwdInput.trim());
              }
            }}
            disabled={!isConnected}
          >
            Set CWD
          </Button>
          {previewUrl && (
            <a
              href={previewUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs underline text-blue-500"
              title="Open preview in browser"
            >
              Open {previewUrl}
            </a>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex-1 flex flex-col space-y-4 p-4">
        {/* Quick Commands */}
        <div className="flex flex-wrap gap-2">
          {quickCommands.map((cmd) => (
            <Button
              key={cmd}
              onClick={() => onRunCommand(cmd)}
              size="sm"
              variant="outline"
              className="text-xs"
              disabled={!isConnected || isRunning}
            >
              {cmd}
            </Button>
          ))}
        </div>

        {/* Console Output */}
        <div 
          ref={outputRef}
          className="flex-1 bg-black/90 rounded-lg p-4 overflow-y-auto font-mono text-sm min-h-0"
        >
          {filteredMessages.length === 0 ? (
            <div className="text-gray-500 text-center py-8">
              <div className="flex flex-col items-center space-y-2">
                {tabs.find(t => t.id === activeTab)?.icon}
                <div>
                  No {activeTab} messages yet...
                  <br />
                  <span className="text-xs">
                    {isConnected 
                      ? 'Run a command to get started' 
                      : 'Start the local agent first: npm run agent'
                    }
                  </span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-1">
              {filteredMessages.map((message) => (
                <div key={message.id} className="flex items-start space-x-2">
                  {showTimestamps && (
                    <span className="text-gray-500 text-xs mt-0.5 w-24 flex-shrink-0 font-mono">
                      {formatTimestamp(message.timestamp)}
                    </span>
                  )}
                  <span className="text-gray-500 w-4 flex-shrink-0 mt-0.5">
                    {getTypeIcon(message.type)}
                  </span>
                  <div className={`flex-1 ${getMessageStyle(message.type)} whitespace-pre-wrap break-words leading-relaxed`}>
                    {message.content}
                  </div>
                </div>
              ))}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>

        {/* Command Input */}
        <div className="flex space-x-2">
          <div className="flex-1">
            <Textarea
              placeholder="Enter command (e.g., npm run dev)..."
              value={customCommand}
              onChange={(e) => setCustomCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              className="font-mono text-sm resize-none"
              rows={1}
              disabled={!isConnected || isRunning}
            />
          </div>
          <Button
            onClick={handleRunCommand}
            disabled={!customCommand.trim() || !isConnected || isRunning}
            className="px-6"
          >
            <Play className="w-4 h-4 mr-1" />
            Run
          </Button>
        </div>

        {!isConnected && (
          <div className="text-center text-sm text-amber-600 bg-amber-50 dark:bg-amber-900/20 p-3 rounded-lg">
            <strong>Agent not running:</strong> Start the local agent with <code className="bg-amber-100 dark:bg-amber-800 px-1 rounded">npm run agent</code> in your terminal
          </div>
        )}
      </CardContent>
    </Card>
  );
}