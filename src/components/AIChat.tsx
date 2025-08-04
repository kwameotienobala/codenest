'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Bot, User, Copy, Check } from 'lucide-react';
import { Message, FileItem } from '@/types';

interface AIChatProps {
  onCodeReceived: (code: string) => void;
  currentCode?: string;
  onActionTrigger?: (action: string, code: string) => void;
  triggerMessage?: string;
  fileContext?: FileItem[];
}

export default function AIChat({ onCodeReceived, currentCode, onActionTrigger, triggerMessage, fileContext = [] }: AIChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Create context prompt from uploaded files
  const createFileContextPrompt = (userPrompt: string): string => {
    if (!fileContext || fileContext.length === 0) {
      return userPrompt;
    }

    // Limit context to prevent token overflow (roughly 3000 chars per file)
    const maxCharsPerFile = 3000;
    let contextPrompt = "Here are the current files the user is working with:\n\n";
    
    fileContext.forEach((file, index) => {
      if (index < 3) { // Limit to first 3 files
        let content = file.content;
        if (content.length > maxCharsPerFile) {
          content = content.substring(0, maxCharsPerFile) + "\n... (truncated)";
        }
        contextPrompt += `File: ${file.name}\n\`\`\`${file.language || 'javascript'}\n${content}\n\`\`\`\n\n`;
      }
    });

    contextPrompt += `User's request:\n${userPrompt}`;
    return contextPrompt;
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load messages from localStorage on mount
  useEffect(() => {
    const savedMessages = localStorage.getItem('codenest-chat-history');
    if (savedMessages) {
      try {
        const parsed = JSON.parse(savedMessages);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setMessages(parsed.slice(-10)); // Keep last 10 messages
        }
      } catch (error) {
        console.error('Error loading chat history:', error);
      }
    }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('codenest-chat-history', JSON.stringify(messages.slice(-10)));
    }
  }, [messages]);

  // Handle action triggers from editor
  useEffect(() => {
    if (triggerMessage && triggerMessage.trim()) {
      handleSendMessage(triggerMessage);
      // Reset trigger message after use
      setTimeout(() => {
        if (onActionTrigger) {
          onActionTrigger('', '');
        }
      }, 100);
    }
  }, [triggerMessage]);

  const handleSendMessage = async (customPrompt?: string) => {
    const messageToSend = customPrompt || input;
    if (!messageToSend.trim() || isLoading) return;

    const userMessage: Message = { 
      role: 'user', 
      content: messageToSend,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);

    try {
      // Prepare the prompt with file context and current code
      let prompt = messageToSend;
      
      // Add file context if available
      if (fileContext && fileContext.length > 0) {
        prompt = createFileContextPrompt(messageToSend);
      } else if (currentCode) {
        // Fallback to current code context if no file context
        prompt = `Here's the code I'm working on:\n\`\`\`\n${currentCode}\n\`\`\`\n\n${messageToSend}`;
      }

      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to get response');
      }

      const data = await response.json();
      const assistantMessage: Message = { 
        role: 'assistant', 
        content: data.reply,
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = { 
        role: 'assistant', 
        content: 'Sorry, I encountered an error. Please try again.',
        timestamp: Date.now()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const copyCodeToClipboard = async (text: string, index: number) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (error) {
      console.error('Failed to copy code:', error);
    }
  };

  const extractCodeBlocks = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks: { language: string; code: string; index: number }[] = [];
    let match;
    let index = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      blocks.push({
        language: match[1] || 'text',
        code: match[2].trim(),
        index: index++
      });
    }

    return blocks;
  };

  const renderMessageContent = (content: string, messageIndex: number) => {
    const codeBlocks = extractCodeBlocks(content);
    
    if (codeBlocks.length === 0) {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    let lastIndex = 0;
    const parts: React.ReactElement[] = [];

    codeBlocks.forEach((block, blockIndex) => {
      // Add text before code block
      if (block.index > lastIndex) {
        const textBefore = content.slice(lastIndex, content.indexOf('```', lastIndex));
        if (textBefore) {
          parts.push(
            <div key={`text-${blockIndex}`} className="whitespace-pre-wrap mb-2">
              {textBefore}
            </div>
          );
        }
      }

      // Add code block
      parts.push(
        <div key={`code-${blockIndex}`} className="mb-3">
          <div className="flex items-center justify-between bg-muted p-2 rounded-t border-b">
            <span className="text-xs font-mono text-muted-foreground">{block.language}</span>
            <Button
              onClick={() => copyCodeToClipboard(block.code, messageIndex)}
              size="sm"
              variant="ghost"
              className="h-6 px-2"
            >
              {copiedIndex === messageIndex ? (
                <Check className="w-3 h-3 text-green-600" />
              ) : (
                <Copy className="w-3 h-3" />
              )}
            </Button>
          </div>
          <pre className="bg-gray-900 text-gray-100 p-3 rounded-b overflow-x-auto text-sm">
            <code>{block.code}</code>
          </pre>
        </div>
      );

      lastIndex = content.indexOf('```', lastIndex) + 3;
      lastIndex = content.indexOf('```', lastIndex) + 3;
    });

    // Add remaining text after last code block
    if (lastIndex < content.length) {
      const remainingText = content.slice(lastIndex);
      if (remainingText.trim()) {
        parts.push(
          <div key="text-end" className="whitespace-pre-wrap">
            {remainingText}
          </div>
        );
      }
    }

    return <div>{parts}</div>;
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            Start a conversation with your AI coding assistant!
          </div>
        )}
        
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <Card className={`max-w-[85%] ${message.role === 'user' ? 'bg-primary text-primary-foreground' : 'bg-card'}`}>
              <CardContent className="p-3">
                <div className="flex items-start gap-2">
                  {message.role === 'user' ? (
                    <User className="w-4 h-4 mt-0.5 text-primary-foreground flex-shrink-0" />
                  ) : (
                    <Bot className="w-4 h-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                  )}
                  <div className="text-sm flex-1">
                    {renderMessageContent(message.content, index)}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
        
        {isLoading && (
          <div className="flex justify-start">
            <Card className="bg-card">
              <CardContent className="p-3">
                <div className="flex items-center gap-2">
                  <Bot className="w-4 h-4 text-muted-foreground" />
                  <div className="text-sm text-muted-foreground">Thinking...</div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>
      
      <div className="p-3 border-t border-border">
        {fileContext && fileContext.length > 0 && (
          <div className="mb-2 text-xs text-muted-foreground bg-muted/50 px-2 py-1 rounded">
            📁 Context: {fileContext.length} file{fileContext.length > 1 ? 's' : ''} loaded ({fileContext.slice(0, 3).map(f => f.name).join(', ')}{fileContext.length > 3 ? '...' : ''})
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder={fileContext && fileContext.length > 0 ? "Ask about your project files..." : "Ask for help with your code..."}
            disabled={isLoading}
            className="flex-1"
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !input.trim()}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
} 