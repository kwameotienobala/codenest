import { NextRequest, NextResponse } from 'next/server';

// Model mapping for OpenRouter
const MODEL_MAPPING = {
  'openai': 'openai/gpt-4o',
  'claude': 'anthropic/claude-3-opus-20240229',
  'gemini': 'google/gemini-pro',
  'mistral': 'mistral/mistral-7b-instruct'
} as const;

// Agent-specific system prompts
const SYSTEM_PROMPTS = {
  'openai': `You are GPT-4, a coding-focused AI assistant inside CodeNest IDE. You help developers write, refactor, and debug code. Prioritize clarity, simplicity, and practical suggestions. Only return code when it's needed — always formatted and commented. Do not go off-topic. Respond like a mentor who writes clean, beautiful code.`,
  
  'claude': `You are Claude, a coding-focused AI assistant inside CodeNest IDE. You help developers write, refactor, and debug code. Prioritize clarity, simplicity, and practical suggestions. Only return code when it's needed — always formatted and commented. Do not go off-topic. Respond like a mentor who writes clean, beautiful code.`,
  
  'gemini': `You are Gemini, an advanced AI assistant integrated in CodeNest. Your role is to analyze, explain, and improve code written in JavaScript, TypeScript, React, and Node.js. When answering, format responses using markdown and use code comments generously. Avoid casual conversation. Be efficient and insightful, like a lead engineer reviewing code.`,
  
  'mistral': `You are Mistral, a fast and lightweight AI assistant helping with short code fixes, small scripts, and syntax checks. Keep your answers concise and efficient. If you are not confident about an answer, say so. Only return code blocks — no extra commentary unless requested.`
} as const;

export async function POST(req: NextRequest) {
  try {
    const { provider, prompt, fileContext } = await req.json();

    // Validate provider
    if (!provider || !(provider in MODEL_MAPPING)) {
      return NextResponse.json(
        { error: 'Invalid or missing provider' },
        { status: 400 }
      );
    }

    // Get model and system prompt
    const model = MODEL_MAPPING[provider as keyof typeof MODEL_MAPPING];
    const systemPrompt = SYSTEM_PROMPTS[provider as keyof typeof SYSTEM_PROMPTS];

    // Prepare messages array
    const messages = [
      {
        role: 'system',
        content: systemPrompt
      },
      {
        role: 'user',
        content: prompt
      }
    ];

    // Make request to OpenRouter
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000',
        'X-Title': 'CodeNest IDE'
      },
      body: JSON.stringify({
        model,
        messages,
        max_tokens: 2000,
        temperature: 0.7,
        top_p: 1,
        frequency_penalty: 0,
        presence_penalty: 0
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `OpenRouter API error: ${response.status}`);
    }

    const data = await response.json();

    // Log usage for debugging (optional feature)
    if (data.usage) {
      console.log(`[${provider.toUpperCase()}] Tokens used:`, {
        prompt: data.usage.prompt_tokens,
        completion: data.usage.completion_tokens,
        total: data.usage.total_tokens,
        model: model
      });
    }

    // Extract the assistant's reply
    const reply = data.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error('No response content received from OpenRouter');
    }

    return NextResponse.json({ 
      reply,
      usage: data.usage,
      model: model,
      provider: provider 
    });

  } catch (error: any) {
    console.error(`OpenRouter API Error:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}