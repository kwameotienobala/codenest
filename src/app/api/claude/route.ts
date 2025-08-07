import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: 'ANTHROPIC_API_KEY environment variable is not set' },
        { status: 500 }
      );
    }

    // System prompt for structured code output
    const systemPrompt = `You are an intelligent code assistant. When a user asks for code, respond only with a filename and code content in structured format. Do not explain anything. Do not output code in the chat. Instead, the IDE will insert your code into the appropriate file.

If a file does not exist, create it. If it does exist, overwrite it.

Example return format:
{
  "filename": "style.css",
  "content": "body { background: #000; }"
}

For non-code requests, provide brief helpful responses. For code requests, always use the JSON format above.`;

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json'
      },
      body: JSON.stringify({
        model: 'claude-3-opus-20240229',
        max_tokens: 2048,
        temperature: 0.7,
        system: systemPrompt,
        messages: [
          { role: 'user', content: prompt }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Claude API Error Response:', errorData);
      throw new Error(errorData.error?.message || `Claude API error: ${response.status}`);
    }

    const data = await response.json();
    
    const reply = data.content?.[0]?.text;
    if (!reply) {
      throw new Error('No response content received from Claude');
    }

    return NextResponse.json({ 
      reply,
      usage: data.usage,
      model: 'claude-3-opus-20240229',
      provider: 'claude'
    });

  } catch (error: any) {
    console.error('Claude API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}