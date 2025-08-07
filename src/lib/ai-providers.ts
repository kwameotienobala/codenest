export type AIProvider = 'openai' | 'claude' | 'gemini' | 'mistral' | 'ollama';

export interface AIMessage {
  role: 'user' | 'assistant' | 'system';
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
  codeGeneration?: CodeGenerationResponse; // Back-compat single-file
  files?: CodeGenerationResponse[]; // New: multiple files
  error?: string;
}

export const AI_PROVIDERS = {
  openai: {
    name: 'GPT-4o',
    icon: '🤖',
    description: 'OpenAI GPT-4 Omni - General purpose coding assistant',
    color: 'from-green-500 to-emerald-500',
    available: true,
    model: 'gpt-4o',
    apiType: 'openai'
  },
  claude: {
    name: 'Claude 3 Opus',
    icon: '🧠',
    description: 'Anthropic Claude - Advanced reasoning and analysis',
    color: 'from-purple-500 to-violet-500',
    available: true,
    model: 'claude-3-opus-20240229',
    apiType: 'claude'
  },
  gemini: {
    name: 'Gemini Pro',
    icon: '✨',
    description: 'Google Gemini - Code analysis and optimization',
    color: 'from-blue-500 to-cyan-500',
    available: true,
    model: 'gemini-pro',
    apiType: 'gemini'
  },
  mistral: {
    name: 'Mistral 7B',
    icon: '⚡',
    description: 'Mistral - Fast and lightweight code fixes',
    color: 'from-orange-500 to-red-500',
    available: true,
    model: 'mistral/mistral-7b-instruct',
    apiType: 'openrouter'
  },
  ollama: {
    name: 'Ollama Local',
    icon: '🦙',
    description: 'Local LLaMA 3.2 - Privacy-focused local AI assistant',
    color: 'from-amber-500 to-orange-500',
    available: true,
    model: 'llama3.2:1b',
    apiType: 'ollama'
  }
} as const;

export class AIService {
  static async sendMessage(
    provider: AIProvider,
    prompt: string,
    fileContext?: any[]
  ): Promise<AIResponse> {
    try {
      return await this.sendToProvider(provider, prompt, fileContext);
    } catch (error) {
      console.error(`AI Service Error (${provider}):`, error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      };
    }
  }

  private static async sendToProvider(
    provider: AIProvider,
    prompt: string,
    fileContext?: any[]
  ): Promise<AIResponse> {
    const endpointMap = {
      openai: '/api/openai-direct',
      claude: '/api/claude',
      gemini: '/api/gemini',
      mistral: '/api/openrouter',
      ollama: '/api/ollama'
    };

    const endpoint = endpointMap[provider];
    if (!endpoint) {
      throw new Error(`Provider ${provider} is not supported.`);
    }

    const requestBody = (provider === 'mistral' || provider === 'openai')
      ? { provider, prompt, fileContext }
      : { prompt, fileContext };

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      const error = await response.json().catch(() => ({}));
      throw new Error(error?.error || 'Unknown API error');
    }

    const data = await response.json();
    const reply: string = data.reply;

    // 1) Try to parse structured JSON (single or multi-file)
    let files: CodeGenerationResponse[] | undefined;
    try {
      const parsed = JSON.parse(reply);
      if (Array.isArray(parsed)) {
        files = parsed
          .filter((f) => f && f.filename && typeof f.content === 'string')
          .map((f) => ({ filename: String(f.filename), content: String(f.content) }));
      } else if (parsed && parsed.filename && typeof parsed.content === 'string') {
        files = [{ filename: String(parsed.filename), content: String(parsed.content) }];
      }
    } catch {
      // Not pure JSON – fallback to heuristic extraction
    }

    // 2) Heuristic extraction from headings + code fences or filepath annotations
    if (!files) {
      const extracted: CodeGenerationResponse[] = [];
      const text = reply || '';

      // Pattern 0: pure JSON inside a fenced block (e.g., ```json\n[ { filename, content } ]\n```)
      const jsonFences = text.match(/```json[\s\S]*?```/gi) || text.match(/```[\s\S]*?```/gi) || [];
      for (const block of jsonFences) {
        const inner = block.replace(/^```[\w-]*\n?/, '').replace(/```\s*$/, '');
        try {
          const parsed = JSON.parse(inner);
          if (Array.isArray(parsed)) {
            const arr = parsed
              .filter((f: any) => f && f.filename && typeof f.content === 'string')
              .map((f: any) => ({ filename: String(f.filename), content: String(f.content) }));
            if (arr.length > 0) {
              extracted.push(...arr);
              break; // prefer first valid JSON block
            }
          } else if (parsed && parsed.filename && typeof parsed.content === 'string') {
            extracted.push({ filename: String(parsed.filename), content: String(parsed.content) });
            break;
          }
        } catch {}
      }

      // Pattern A: "### path/to/file.ext" followed by a fenced block
      const headingBlock = /(^|\n)\s*#{2,6}\s+([^\n]+?)\s*\n+```[\s\S]*?```/g;
      let m: RegExpExecArray | null;
      while ((m = headingBlock.exec(text)) !== null) {
        const section = text.slice(m.index).split('\n').slice(0).join('\n');
        const header = (m[2] || '').trim();
        const codeFence = /```(?:\w+)?\n([\s\S]*?)```/.exec(section);
        if (header && codeFence && codeFence[1] !== undefined) {
          extracted.push({ filename: header, content: codeFence[1] });
        }
      }

      // Pattern B: fenced block that begins with a filepath annotation
      const fenceWithPath = /```(?:\w+)?\n(?:\/\/\s*filepath:\s*|#\s*filepath:\s*|\/\*\s*filepath:\s*)([^\n]+?)\s*(?:\*\/)?\n([\s\S]*?)```/gi;
      let f: RegExpExecArray | null;
      while ((f = fenceWithPath.exec(text)) !== null) {
        extracted.push({ filename: f[1].trim(), content: f[2] });
      }

      // Pattern C: "File: path" line before a fence
      const fileLineFence = /(File\s*:\s*([^\n]+))\s*\n+```(?:\w+)?\n([\s\S]*?)```/gi;
      let g: RegExpExecArray | null;
      while ((g = fileLineFence.exec(text)) !== null) {
        extracted.push({ filename: g[2].trim(), content: g[3] });
      }

      if (extracted.length > 0) files = extracted;
    }

    // 3) Build response
    if (files && files.length > 0) {
      return {
        success: true,
        message: files.length === 1
          ? `✅ Generated code for ${files[0].filename}`
          : `✅ Generated ${files.length} files`,
        codeGeneration: files.length === 1 ? files[0] : undefined,
        files
      };
    }

    // Fallback: no files recognized, return raw reply
    return { success: true, message: reply };
  }
}