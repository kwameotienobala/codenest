import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt, model = 'llama3.2:1b' } = await req.json();

    // Check if Ollama server is running
    const healthCheck = await fetch('http://localhost:11434/api/tags', {
      method: 'GET'
    }).catch(() => null);

    if (!healthCheck || !healthCheck.ok) {
      return NextResponse.json(
        { error: 'Ollama server is not running. Please start Ollama with: ollama serve' },
        { status: 503 }
      );
    }

    // System prompt for structured code output
    const codingPrompt = `You are an intelligent code assistant. When a user asks for code, respond only with a filename and code content in structured format. Do not explain anything. Do not output code in the chat. Instead, the IDE will insert your code into the appropriate file.

If a file does not exist, create it. If it does exist, overwrite it.

Example return format:
{
  "filename": "style.css",
  "content": "body { background: #000; }"
}

For non-code requests, provide brief helpful responses. For code requests, always use the JSON format above.

User Query: ${prompt}

Response:`;

    const response = await fetch('http://localhost:11434/api/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: model,
        prompt: codingPrompt,
        stream: false,
        options: {
          temperature: 0.7,
          top_p: 0.9,
          top_k: 40,
          num_predict: 2048
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `Ollama API error: ${response.status}`);
    }

    const data = await response.json();
    
    if (!data.response) {
      throw new Error('No response content received from Ollama');
    }

    return NextResponse.json({ 
      reply: data.response,
      model: model,
      provider: 'ollama',
      done: data.done,
      total_duration: data.total_duration,
      load_duration: data.load_duration,
      eval_count: data.eval_count,
      eval_duration: data.eval_duration
    });

  } catch (error: any) {
    console.error('Ollama API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}