# CodeNest Hybrid Architecture Setup

CodeNest now features a hybrid architecture that combines a cloud-based IDE with local command execution through a local CLI agent.

## Architecture Overview

```
┌─────────────────┐    HTTP Requests    ┌──────────────────┐
│   Cloud IDE     │ ───────────────────> │   Local Agent    │
│ (localhost:3000)│ <─────────────────── │ (localhost:5111) │
└─────────────────┘    JSON Responses   └──────────────────┘
                                                │
                                                │ spawn()
                                                ▼
                                        ┌──────────────────┐
                                        │ Local Commands   │
                                        │ (npm, node, etc) │
                                        └──────────────────┘
```

## Quick Start

### 1. Start the Local Agent

In your terminal, run:

```bash
# Option 1: Using npm script (recommended)
npm run agent

# Option 2: Direct node execution
node codenest-agent.js
```

You should see:
```
[2024-01-XX] 🚀 CodeNest Agent running on http://localhost:5111
[2024-01-XX] Available endpoints:
[2024-01-XX]   GET  /health - Health check
[2024-01-XX]   POST /run    - Execute command
[2024-01-XX]   POST /kill   - Kill active processes
```

### 2. Start the Web IDE

In a **separate terminal**, run:

```bash
npm run dev
```

### 3. Access the IDE

1. Open http://localhost:3000
2. Login with your credentials
3. Navigate to the IDE
4. Look for the **Console Panel** at the bottom
5. The connection status should show "Connected" if the agent is running

## Using the Console

### Console Tabs
The console is organized into three tabs:
- **Server Logs**: General output from commands (default)
- **Errors**: Error messages and stderr output
- **Build Output**: Build-related messages and compilation output

### Quick Commands
Click any of the preset buttons:
- `npm run dev` - Start development server
- `npm run build` - Build the project
- `npm install` - Install dependencies
- `npm test` - Run tests
- `npm --version` - Check npm version
- etc.

### Custom Commands
1. Type any command in the text area
2. Press `Enter` or click "Run"
3. Watch the output in real-time

### Console Features
- **Tabbed interface**: Organized by Server Logs, Errors, and Build Output
- **Color-coded output**: stdout (green), stderr (red), system messages (blue), commands (yellow)
- **Timestamps**: Toggle-able timestamps for each message (with milliseconds)
- **Auto-scroll**: Automatically scrolls to show latest output
- **Message persistence**: Last 20 messages saved to localStorage
- **Auto-categorization**: Messages automatically sorted into appropriate tabs
- **Process management**: Kill running processes with the "Kill" button
- **Clear console**: Remove all output with the "Clear" button
- **Connection status**: Shows if the local agent is running

## Opening Local Projects

### Using the "Open Local Project" Button
1. Make sure the local agent is running
2. In the file sidebar, click "Open Local Project"
3. The agent will read files from the current working directory
4. Supported file types: `.js`, `.ts`, `.jsx`, `.tsx`, `.json`, `.css`, `.scss`, `.html`, `.md`, `.vue`, `.py`, `.php`
5. Files appear in the sidebar with folder structure
6. Click any file to open it in the Monaco editor

### Editing and Saving
- **Edit files**: Make changes in the Monaco editor
- **Save to Local**: Use the "Save to Local" button to write changes back to disk
- **Save to Cloud**: Use the "Save to Cloud" button to store in Supabase
- **Download**: Use the "Save" dropdown to download files in various formats

### Project Features
- **Automatic file discovery**: Recursively scans directories (max 3 levels deep)
- **Smart filtering**: Ignores `node_modules`, `.git`, `dist`, `build`, etc.
- **File size limits**: Skips files larger than 1MB
- **Security**: Files must be within the agent's working directory
- **Folder structure**: Maintains directory hierarchy in the sidebar

## API Endpoints

The local agent exposes these endpoints:

### `GET /health`
Check if the agent is running
```bash
curl http://localhost:5111/health
```

### `GET /list-files`
List project files from a directory
```bash
curl "http://localhost:5111/list-files?path=/path/to/project"
```

### `POST /save-file`
Save file content to disk
```bash
curl -X POST http://localhost:5111/save-file \
  -H "Content-Type: application/json" \
  -d '{"filePath": "src/example.js", "content": "console.log(\"Hello World\");"}'
```

### `POST /run`
Execute a command
```bash
curl -X POST http://localhost:5111/run \
  -H "Content-Type: application/json" \
  -d '{"command": "npm --version"}'
```

### `POST /kill`
Kill all active processes
```bash
curl -X POST http://localhost:5111/kill
```

## Security Features

The agent includes basic security measures:
- **Command filtering**: Blocks dangerous commands like `rm -rf`, `del /f`, etc.
- **Process timeout**: Commands timeout after 10 minutes
- **CORS enabled**: Allows requests from the web IDE
- **Graceful shutdown**: Ctrl+C cleanly kills all processes

## Troubleshooting

### "Disconnected" Status
- Make sure the agent is running: `npm run agent`
- Check if port 5111 is available
- Verify no firewall is blocking localhost:5111

### Commands Not Working
- Check the console output for error messages
- Ensure you're in the correct directory
- Try simple commands first (like `npm --version`)

### Port Already in Use
If port 5111 is taken:
1. Stop the existing agent process
2. Or modify the PORT in `codenest-agent.js`
3. Update the AGENT_URL in `src/hooks/useLocalAgent.ts`

## Development

### Extending the Agent
The agent is built with Node.js and can be extended:
- Add new endpoints in `codenest-agent.js`
- Modify security rules
- Add command preprocessing
- Implement streaming responses

### Modifying the UI
The console UI components are in:
- `src/components/ConsoleOutput.tsx` - Main console component
- `src/hooks/useLocalAgent.ts` - Agent communication hook
- `src/components/CodeNestLayout.tsx` - Layout integration

## Example Workflows

### Start a Development Server
1. Click "npm run dev" in the console
2. Watch the output as the server starts
3. The server will run in the background
4. Use "Kill" button to stop when needed

### Install Dependencies
1. Type `npm install package-name`
2. Watch the installation progress
3. See success/error messages in real-time

### Build and Deploy
1. Run `npm run build`
2. Check for build errors in the console
3. Run additional deployment commands as needed

## Tips

- Keep the agent running in a separate terminal for best experience
- Use the quick command buttons for common tasks
- The console remembers connection status and auto-reconnects
- Long-running commands (like dev servers) will show continuous output
- Use Ctrl+C in the agent terminal to stop everything cleanly