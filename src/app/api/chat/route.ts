import OpenAI from "openai";

// Initialize OpenAI client only if API key is available
const openai = process.env.OPENAI_API_KEY ? new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
}) : null;

export async function POST(req: any) {
  try {
    const { prompt } = await req.json();

    // Check if OpenAI client is available
    if (!openai) {
      return new Response(
        JSON.stringify({ 
          error: 'OpenAI API key not configured. Please add OPENAI_API_KEY to your environment variables or use the multi-agent chat instead.' 
        }),
        { status: 500 }
      );
    }

    // Step 1: Create a thread
    const thread = await openai.beta.threads.create();

    // Step 2: Add the user's message to the thread
    await openai.beta.threads.messages.create(thread.id, {
      role: "user",
      content: prompt,
    });

    // Step 3: Run the assistant on the thread
    const run = await openai.beta.threads.runs.create(thread.id, {
      assistant_id: "asst_fzP5nJej3L13vX2MjbsqFjOH", // Your CodeNest Assistant ID
    });

    // Step 4: Poll until the run is completed
    let completed = false;
    let retries = 0;
    let runStatus;

    while (!completed && retries < 20) {
      // @ts-ignore - Temporary fix for OpenAI SDK type issue
      runStatus = await openai.beta.threads.runs.retrieve(thread.id, run.id);
      if (runStatus.status === "completed") {
        completed = true;
      } else {
        await new Promise((res) => setTimeout(res, 1500));
        retries++;
      }
    }

    if (!completed) {
      return new Response(
        JSON.stringify({ error: "Assistant run timed out." }),
        { status: 500 }
      );
    }

    // Step 5: Fetch the response message(s)
    const messages = await openai.beta.threads.messages.list(thread.id);
    const latestMessage = messages.data[0];

    // @ts-ignore - Temporary fix for OpenAI SDK message content type issue
    return new Response(JSON.stringify({ reply: latestMessage.content[0].text.value }), {
      status: 200,
    });
  } catch (err: any) {
    console.error("API Error:", err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500 });
  }
} 