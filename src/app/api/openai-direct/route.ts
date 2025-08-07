import { NextRequest, NextResponse } from 'next/server';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

// System prompt for structured code output
const GPT4_SYSTEM_PROMPT = `You are an intelligent code assistant. When a user asks for code, respond only with a filename and code content in structured format. Do not explain anything. Do not output code in the chat. Instead, the IDE will insert your code into the appropriate file.

If a file does not exist, create it. If it does exist, overwrite it.

Example return format:
{
  "filename": "style.css",
  "content": "body { background: #000; }"
}

For non-code requests, provide brief helpful responses. For code requests, always use the JSON format above.`;

export async function POST(req: NextRequest) {
  try {
    // Check if OpenAI client is available
    if (!openai) {
      return NextResponse.json(
        { error: 'OPENAI_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    const { provider, prompt, fileContext } = await req.json();

    // Validate that this is for OpenAI
    if (provider !== 'openai') {
      return NextResponse.json(
        { error: 'This endpoint is only for OpenAI GPT-4o requests' },
        { status: 400 }
      );
    }

    // Prepare messages array for ChatCompletion API
    const messages = [
      {
        role: 'system' as const,
        content: GPT4_SYSTEM_PROMPT
      },
      {
        role: 'user' as const,
        content: prompt
      }
    ];

    // Make request to OpenAI ChatCompletion API
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: messages,
      max_tokens: 2000,
      temperature: 0.7,
      top_p: 1,
      frequency_penalty: 0,
      presence_penalty: 0
    });

    // Log usage for debugging
    if (response.usage) {
      console.log(`[GPT-4o] Tokens used:`, {
        prompt: response.usage.prompt_tokens,
        completion: response.usage.completion_tokens,
        total: response.usage.total_tokens,
        model: 'gpt-4o'
      });
    }

    // Extract the assistant's reply
    const reply = response.choices?.[0]?.message?.content;
    if (!reply) {
      throw new Error('No response content received from OpenAI');
    }

    return NextResponse.json({ 
      reply,
      usage: response.usage,
      model: 'gpt-4o',
      provider: 'openai' 
    });

  } catch (error: any) {
    console.error(`OpenAI API Error:`, error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}