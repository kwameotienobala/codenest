'use client';

import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Send, Bot, User, Copy, Check, ChevronDown } from 'lucide-react';
import { Message, FileItem } from '@/types';
import { AIProvider, AI_PROVIDERS, AIService } from '@/lib/ai-providers';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';

interface MultiAgentChatProps {
  onCodeReceived: (code: string) => void;
  currentCode?: string;
  onActionTrigger?: (action: string, code: string) => void;
  triggerMessage?: string;
  fileContext?: FileItem[];
}

export default function MultiAgentChat({ 
  onCodeReceived, 
  currentCode, 
  onActionTrigger, 
  triggerMessage, 
  fileContext = [] 
}: MultiAgentChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState<number | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider>('openai');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
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

    // Load saved provider preference
    const savedProvider = localStorage.getItem('codenest-selected-provider');
    if (savedProvider && savedProvider in AI_PROVIDERS) {
      setSelectedProvider(savedProvider as AIProvider);
    }
  }, []);

  // Save messages to localStorage
  useEffect(() => {
    if (messages.length > 0) {
      localStorage.setItem('codenest-chat-history', JSON.stringify(messages.slice(-10)));
    }
  }, [messages]);

  // Save selected provider to localStorage
  useEffect(() => {
    localStorage.setItem('codenest-selected-provider', selectedProvider);
  }, [selectedProvider]);

  // Handle trigger messages from parent
  useEffect(() => {
    if (triggerMessage && triggerMessage.trim()) {
      handleSendMessage(triggerMessage);
      // Clear the trigger message
      if (onActionTrigger) {
        onActionTrigger('', '');
      }
    }
  }, [triggerMessage]);

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

      const response = await AIService.sendMessage(selectedProvider, prompt, fileContext);

      if (response.success && response.message) {
        const assistantMessage: Message = { 
          role: 'assistant', 
          content: response.message,
          timestamp: Date.now()
        };
        setMessages(prev => [...prev, assistantMessage]);
      } else {
        throw new Error(response.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: Message = { 
        role: 'assistant', 
        content: `Sorry, I encountered an error with ${AI_PROVIDERS[selectedProvider].name}. Please try again.`,
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

  const copyCodeToClipboard = async (code: string, index: number) => {
    try {
      await navigator.clipboard.writeText(code);
      setCopiedIndex(index);
      setTimeout(() => setCopiedIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy code:', err);
    }
  };

  const extractCodeBlocks = (content: string) => {
    const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
    const blocks = [];
    let match;
    let lastIndex = 0;
    let blockIndex = 0;

    while ((match = codeBlockRegex.exec(content)) !== null) {
      // Add text before code block
      if (match.index > lastIndex) {
        blocks.push({
          type: 'text',
          content: content.slice(lastIndex, match.index)
        });
      }

      // Add code block
      blocks.push({
        type: 'code',
        language: match[1] || 'javascript',
        content: match[2].trim(),
        index: blockIndex++
      });

      lastIndex = match.index + match[0].length;
    }

    // Add remaining text
    if (lastIndex < content.length) {
      blocks.push({
        type: 'text',
        content: content.slice(lastIndex)
      });
    }

    return blocks;
  };

  const renderMessageContent = (content: string, messageIndex: number) => {
    const blocks = extractCodeBlocks(content);
    
    if (blocks.length === 0) {
      return <div className="whitespace-pre-wrap">{content}</div>;
    }

    return (
      <div>
        {blocks.map((block, index) => {
          if (block.type === 'text') {
            return (
              <div key={index} className="whitespace-pre-wrap mb-2">
                {block.content}
              </div>
            );
          } else {
            const codeIndex = `${messageIndex}-${block.index}`;
            return (
              <div key={index} className="my-3">
                <div className="flex items-center justify-between bg-muted/50 px-3 py-2 rounded-t-md border-b">
                  <span className="text-xs font-mono text-muted-foreground">
                    {block.language}
                  </span>
                  <Button
                    onClick={() => copyCodeToClipboard(block.content, parseInt(codeIndex))}
                    size="sm"
                    variant="ghost"
                    className="h-6 px-2"
                  >
                    {copiedIndex === parseInt(codeIndex) ? (
                      <Check className="w-3 h-3 text-green-500" />
                    ) : (
                      <Copy className="w-3 h-3" />
                    )}
                  </Button>
                </div>
                <pre className="bg-muted/30 p-3 rounded-b-md overflow-x-auto">
                  <code className="text-sm font-mono">{block.content}</code>
                </pre>
              </div>
            );
          }
        })}
      </div>
    );
  };

  const currentProviderConfig = AI_PROVIDERS[selectedProvider];

  return (
    <div className="flex flex-col h-full">
      {/* AI Provider Selector */}
      <div className="p-3 border-b border-border bg-card/50">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="w-full justify-between">
              <div className="flex items-center gap-2">
                <span className="text-lg">{currentProviderConfig.icon}</span>
                <span className="font-medium">{currentProviderConfig.name}</span>
                {!currentProviderConfig.available && (
                  <Badge variant="secondary" className="text-xs">Soon</Badge>
                )}
              </div>
              <ChevronDown className="w-4 h-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-full">
            {Object.entries(AI_PROVIDERS).map(([key, config]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => setSelectedProvider(key as AIProvider)}
                disabled={!config.available}
                className="flex items-center gap-2"
              >
                <span className="text-lg">{config.icon}</span>
                <div className="flex flex-col">
                  <span className="font-medium">{config.name}</span>
                  <span className="text-xs text-muted-foreground">{config.description}</span>
                </div>
                {!config.available && (
                  <Badge variant="secondary" className="text-xs ml-auto">Soon</Badge>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center text-muted-foreground text-sm py-8">
            <div className="mb-4">
              <div className={`w-16 h-16 mx-auto rounded-full bg-gradient-to-r ${currentProviderConfig.color} flex items-center justify-center text-2xl text-white mb-2`}>
                {currentProviderConfig.icon}
              </div>
            </div>
            <p className="font-medium mb-1">Start a conversation with {currentProviderConfig.name}</p>
            <p className="text-xs">{currentProviderConfig.description}</p>
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
                    <div className="w-4 h-4 mt-0.5 flex-shrink-0 text-lg">
                      {currentProviderConfig.icon}
                    </div>
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
                  <div className="w-4 h-4 text-lg">{currentProviderConfig.icon}</div>
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
            placeholder={fileContext && fileContext.length > 0 ? `Ask ${currentProviderConfig.name} about your project...` : `Chat with ${currentProviderConfig.name}...`}
            disabled={isLoading || !currentProviderConfig.available}
            className="flex-1"
          />
          <Button
            onClick={() => handleSendMessage()}
            disabled={isLoading || !input.trim() || !currentProviderConfig.available}
            size="sm"
          >
            <Send className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}