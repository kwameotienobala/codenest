export type AIProvider = 'openai' | 'claude' | 'gemini' | 'mistral';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
}

export interface AIResponse {
  success: boolean;
  message?: string;
  error?: string;
}

export const AI_PROVIDERS = {
  openai: {
    name: 'GPT-4o',
    icon: '🤖',
    description: 'OpenAI GPT-4 Omni - General purpose coding assistant',
    color: 'from-green-500 to-emerald-500',
    available: true,
    model: 'openai/gpt-4o'
  },
  claude: {
    name: 'Claude 3 Opus',
    icon: '🧠',
    description: 'Anthropic Claude - Advanced reasoning and analysis',
    color: 'from-purple-500 to-violet-500',
    available: true,
    model: 'anthropic/claude-3-opus-20240229'
  },
  gemini: {
    name: 'Gemini Pro',
    icon: '✨',
    description: 'Google Gemini - Code analysis and optimization',
    color: 'from-blue-500 to-cyan-500',
    available: true,
    model: 'google/gemini-pro'
  },
  mistral: {
    name: 'Mistral 7B',
    icon: '⚡',
    description: 'Mistral - Fast and lightweight code fixes',
    color: 'from-orange-500 to-red-500',
    available: true,
    model: 'mistral/mistral-7b-instruct'
  }
} as const;

export class AIService {
  static async sendMessage(
    provider: AIProvider,
    prompt: string,
    fileContext?: any[]
  ): Promise<AIResponse> {
    try {
      // Use OpenRouter for all providers
      return await this.sendToOpenRouter(provider, prompt, fileContext);
    } catch (error) {
      console.error(`AI Service Error (${provider}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private static async sendToOpenRouter(
    provider: AIProvider,
    prompt: string,
    fileContext?: any[]
  ): Promise<AIResponse> {
    const response = await fetch('/api/openrouter', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ 
        provider, 
        prompt, 
        fileContext 
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Failed to get response from ${provider}`);
    }

    const data = await response.json();
    
    if (data.error) {
      throw new Error(data.error);
    }

    return {
      success: true,
      message: data.reply
    };
  }
}