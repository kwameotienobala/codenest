import { NextRequest, NextResponse } from 'next/server';

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    // Redirect to unified OpenRouter API
    const openRouterResponse = await fetch(`${req.nextUrl.origin}/api/openrouter`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        provider: 'mistral',
        prompt: prompt
      })
    });

    if (!openRouterResponse.ok) {
      const errorData = await openRouterResponse.json().catch(() => ({}));
      throw new Error(errorData.error || 'Failed to get response from Mistral via OpenRouter');
    }

    const data = await openRouterResponse.json();
    return NextResponse.json({ reply: data.reply });

  } catch (error: any) {
    console.error('Mistral API Error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }
}