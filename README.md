# CodeNest - AI-Powered Code Editor

A mini-Cursor tool built with Next.js 14, Monaco Editor, and OpenAI GPT-4o for private coding assistance.

## Features

- **Monaco Editor**: Full-featured code editor with syntax highlighting
- **AI Chat Panel**: Right-side chat interface for coding assistance
- **Code Selection**: Send selected code or entire file to AI for help
- **Modern UI**: Clean interface built with Tailwind CSS and Shadcn UI
- **Real-time Responses**: Powered by OpenAI GPT-4o

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Environment Variables**:
   Create a `.env.local` file in the root directory:
   ```
   OPENAI_API_KEY=your_openai_api_key_here
   ```

3. **Run the development server**:
   ```bash
   npm run dev
   ```

4. **Open your browser**:
   Navigate to [http://localhost:3000](http://localhost:3000)

## Usage

- **Code Editor**: Write your code in the left panel
- **AI Chat**: Ask questions or get help in the right panel
- **Send Code**: Use the "Send Selection" button to send selected code to AI
- **Full File**: Use "Send All Code" to send the entire file content

## Tech Stack

- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Shadcn UI**: Beautiful component library
- **Monaco Editor**: VS Code's editor component
- **OpenAI GPT-4o**: AI assistance
- **Lucide React**: Icon library

## Project Structure

```
src/
├── app/
│   ├── api/chat/route.ts    # OpenAI API endpoint
│   └── page.tsx             # Main page
├── components/
│   ├── ui/                  # Shadcn UI components
│   ├── CodeEditor.tsx       # Monaco editor component
│   ├── AIChat.tsx          # AI chat component
│   └── CodeNestLayout.tsx  # Main layout
└── lib/
    └── utils.ts            # Utility functions
```

## Development

- **Local Development**: `npm run dev`
- **Build**: `npm run build`
- **Start Production**: `npm start`
- **Lint**: `npm run lint`

## License

MIT
