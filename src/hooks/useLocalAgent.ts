'use client';

import { useState, useCallback, useRef, useEffect } from 'react';

interface ConsoleMessage {
  id: string;
  type: 'stdout' | 'stderr' | 'system' | 'command';
  content: string;
  timestamp: Date;
  category?: 'server' | 'errors' | 'build';
}

interface AgentResponse {
  command: string;
  output: string;
  error: string;
  exitCode: number;
  status: 'success' | 'failed';
  timestamp: string;
}

interface UseLocalAgentReturn {
  messages: ConsoleMessage[];
  isConnected: boolean;
  isRunning: boolean;
  runCommand: (command: string) => Promise<void>;
  clearMessages: () => void;
  killProcesses: () => Promise<void>;
  checkConnection: () => Promise<boolean>;
  setWorkingDirectory: (absolutePath: string) => Promise<boolean>;
}

const AGENT_URL = 'http://localhost:5111';
const CONNECTION_TIMEOUT = 5000; // 5 seconds
const STORAGE_KEY = 'codenest-console-messages';

export function useLocalAgent(): UseLocalAgentReturn {
  const [messages, setMessages] = useState<ConsoleMessage[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const messageIdCounter = useRef(0);

  // Load persisted messages on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsedMessages = JSON.parse(stored).map((msg: any) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
        setMessages(parsedMessages);
        messageIdCounter.current = parsedMessages.length;
      }
    } catch (error) {
      console.error('Failed to load persisted console messages:', error);
    }
  }, []);

  const addMessage = useCallback((type: ConsoleMessage['type'], content: string, category?: 'server' | 'errors' | 'build') => {
    const message: ConsoleMessage = {
      id: `msg-${++messageIdCounter.current}`,
      type,
      content,
      timestamp: new Date(),
      category
    };
    
    setMessages(prev => [...prev, message]);
  }, []);

  const checkConnection = useCallback(async (): Promise<boolean> => {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), CONNECTION_TIMEOUT);

      const response = await fetch(`${AGENT_URL}/health`, {
        method: 'GET',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        setIsConnected(true);
        return true;
      } else {
        setIsConnected(false);
        return false;
      }
    } catch (error) {
      setIsConnected(false);
      if (error instanceof Error && error.name === 'AbortError') {
        console.log('Connection check timed out');
      } else {
        console.error('Connection check failed:', error);
      }
      return false;
    }
  }, []);

  const runCommand = useCallback(async (command: string): Promise<void> => {
    if (!command.trim()) return;

    // Check connection first
    const connected = await checkConnection();
    if (!connected) {
      addMessage('system', 'Error: Cannot connect to local agent. Make sure it\'s running on localhost:5111');
      return;
    }

    setIsRunning(true);
    addMessage('command', `$ ${command}`);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 1 minute timeout

      const response = await fetch(`${AGENT_URL}/run`, {
        method: 'POST',
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ command }),
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const result: AgentResponse = await response.json();

      // Add output messages
      if (result.output) {
        // Split output by lines and add each as a separate message
        const outputLines = result.output.split('\n').filter(line => line.trim());
        outputLines.forEach(line => {
          addMessage('stdout', line);
        });
      }

      if (result.error) {
        // Split error by lines and add each as a separate message
        const errorLines = result.error.split('\n').filter(line => line.trim());
        errorLines.forEach(line => {
          addMessage('stderr', line);
        });
      }

      // Add status message
      if (result.status === 'success') {
        addMessage('system', `Command completed successfully (exit code: ${result.exitCode})`);
      } else {
        addMessage('system', `Command failed (exit code: ${result.exitCode})`);
      }

    } catch (error) {
      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          addMessage('system', 'Command timed out after 1 minute');
        } else {
          addMessage('system', `Error: ${error.message}`);
        }
      } else {
        addMessage('system', 'Unknown error occurred');
      }
    } finally {
      setIsRunning(false);
    }
  }, [checkConnection, addMessage]);

  const setWorkingDirectory = useCallback(async (absolutePath: string): Promise<boolean> => {
    try {
      if (!absolutePath || !absolutePath.trim()) return false;
      // Use list-files endpoint which also updates agent's working directory
      const url = `${AGENT_URL}/list-files?path=${encodeURIComponent(absolutePath.trim())}`;
      const response = await fetch(url, { method: 'GET' });
      if (!response.ok) {
        addMessage('system', `Failed to set working directory (HTTP ${response.status}).`);
        return false;
      }
      const data = await response.json();
      if (data.status === 'success') {
        addMessage('system', `Working directory set to: ${data.projectPath}`);
        addMessage('system', `Found ${data.stats?.totalFiles ?? 0} files in ${data.stats?.directories ?? 0} folders.`);
        try { localStorage.setItem('codenest-agent-cwd', data.projectPath); } catch {}
        return true;
      }
      addMessage('system', `Failed to set working directory: ${data.error || 'Unknown error'}`);
      return false;
    } catch (error: any) {
      addMessage('system', `Error setting working directory: ${error.message}`);
      return false;
    }
  }, [addMessage]);

  const killProcesses = useCallback(async (): Promise<void> => {
    try {
      const response = await fetch(`${AGENT_URL}/kill`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (response.ok) {
        const result = await response.json();
        addMessage('system', result.message || 'Processes killed');
      } else {
        addMessage('system', 'Failed to kill processes');
      }
    } catch (error) {
      addMessage('system', 'Error: Could not connect to agent to kill processes');
    }
  }, [addMessage]);

  const clearMessages = useCallback(() => {
    setMessages([]);
    messageIdCounter.current = 0;
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Check connection on mount and periodically
  useEffect(() => {
    checkConnection();
    
    const interval = setInterval(() => {
      if (!isRunning) {
        checkConnection();
      }
    }, 10000); // Check every 10 seconds when not running commands

    return () => clearInterval(interval);
  }, [checkConnection, isRunning]);

  return {
    messages,
    isConnected,
    isRunning,
    runCommand,
    clearMessages,
    killProcesses,
    checkConnection,
    setWorkingDirectory,
  };
}