export interface FileItem {
  id: string;
  name: string;
  type: 'file' | 'folder';
  path: string;
  content: string;
  language: string;
}

export interface Message {
  role: 'user' | 'assistant';
  content: string;
  timestamp: number;
}

export interface CodeGenerationResponse {
  filename: string;
  content: string;
}

export interface AIResponse {
  success: boolean;
  message?: string;
  codeGeneration?: CodeGenerationResponse;
  error?: string;
} 