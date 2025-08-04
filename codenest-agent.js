#!/usr/bin/env node

const http = require('http');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const url = require('url');

const PORT = 5111;
const HOST = 'localhost';

// CORS headers for cross-origin requests
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json'
};

// Active processes tracking
const activeProcesses = new Map();

// Supported file extensions for project files
const SUPPORTED_EXTENSIONS = ['.js', '.ts', '.jsx', '.tsx', '.json', '.css', '.scss', '.html', '.md', '.vue', '.py', '.php'];

// Current working directory for file operations
let currentWorkingDir = process.cwd();

function logWithTimestamp(message) {
  const timestamp = new Date().toISOString();
  console.log(`[${timestamp}] ${message}`);
}

// Recursively read files from a directory
function readProjectFiles(dirPath, maxDepth = 3, currentDepth = 0) {
  const files = [];
  
  if (currentDepth >= maxDepth) {
    return files;
  }
  
  try {
    const entries = fs.readdirSync(dirPath, { withFileTypes: true });
    
    for (const entry of entries) {
      const fullPath = path.join(dirPath, entry.name);
      const relativePath = path.relative(currentWorkingDir, fullPath);
      
      // Skip hidden files, node_modules, and common build directories
      if (entry.name.startsWith('.') || 
          entry.name === 'node_modules' || 
          entry.name === 'dist' || 
          entry.name === 'build' ||
          entry.name === '.next' ||
          entry.name === 'coverage') {
        continue;
      }
      
      if (entry.isDirectory()) {
        // Recursively read subdirectories
        files.push(...readProjectFiles(fullPath, maxDepth, currentDepth + 1));
      } else if (entry.isFile()) {
        const ext = path.extname(entry.name).toLowerCase();
        if (SUPPORTED_EXTENSIONS.includes(ext)) {
          try {
            const content = fs.readFileSync(fullPath, 'utf8');
            // Limit file size to prevent memory issues (max 1MB)
            if (content.length <= 1024 * 1024) {
              files.push({
                name: entry.name,
                path: relativePath.replace(/\\/g, '/'), // Normalize path separators
                content: content,
                size: content.length,
                extension: ext,
                directory: path.dirname(relativePath).replace(/\\/g, '/')
              });
            } else {
              logWithTimestamp(`Skipping large file: ${relativePath} (${content.length} bytes)`);
            }
          } catch (readError) {
            logWithTimestamp(`Failed to read file ${fullPath}: ${readError.message}`);
          }
        }
      }
    }
  } catch (error) {
    logWithTimestamp(`Failed to read directory ${dirPath}: ${error.message}`);
  }
  
  return files;
}

// Get project structure for a given directory
function getProjectStructure(dirPath) {
  try {
    const files = readProjectFiles(dirPath);
    const totalFiles = files.length;
    const totalSize = files.reduce((sum, file) => sum + file.size, 0);
    
    // Group files by directory for better organization
    const filesByDirectory = files.reduce((acc, file) => {
      const dir = file.directory || '.';
      if (!acc[dir]) {
        acc[dir] = [];
      }
      acc[dir].push(file);
      return acc;
    }, {});
    
    return {
      success: true,
      projectPath: dirPath,
      files: files,
      filesByDirectory: filesByDirectory,
      stats: {
        totalFiles,
        totalSize,
        directories: Object.keys(filesByDirectory).length
      }
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      projectPath: dirPath
    };
  }
}

// Write file content to disk
function writeProjectFile(filePath, content) {
  try {
    const fullPath = path.resolve(currentWorkingDir, filePath);
    
    // Security check: ensure file is within current working directory
    if (!fullPath.startsWith(currentWorkingDir)) {
      throw new Error('File path is outside of allowed directory');
    }
    
    // Create directory if it doesn't exist
    const dir = path.dirname(fullPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    
    fs.writeFileSync(fullPath, content, 'utf8');
    
    return {
      success: true,
      path: filePath,
      size: content.length
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      path: filePath
    };
  }
}

function executeCommand(command, res) {
  return new Promise((resolve) => {
    logWithTimestamp(`Executing command: ${command}`);
    
    // Parse command and arguments
    const parts = command.trim().split(' ');
    const cmd = parts[0];
    const args = parts.slice(1);
    
    let output = '';
    let errorOutput = '';
    
    try {
      // Spawn the process
      const child = spawn(cmd, args, {
        shell: true,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: { ...process.env, FORCE_COLOR: '1' } // Enable colors in output
      });
      
      // Track the process
      const processId = Date.now().toString();
      activeProcesses.set(processId, child);
      
      // Handle stdout
      child.stdout.on('data', (data) => {
        const chunk = data.toString();
        output += chunk;
        logWithTimestamp(`STDOUT: ${chunk.trim()}`);
      });
      
      // Handle stderr
      child.stderr.on('data', (data) => {
        const chunk = data.toString();
        errorOutput += chunk;
        logWithTimestamp(`STDERR: ${chunk.trim()}`);
      });
      
      // Handle process exit
      child.on('close', (code) => {
        activeProcesses.delete(processId);
        logWithTimestamp(`Command finished with exit code: ${code}`);
        
        const result = {
          command,
          output: output.trim(),
          error: errorOutput.trim(),
          exitCode: code,
          status: code === 0 ? 'success' : 'failed',
          timestamp: new Date().toISOString()
        };
        
        resolve(result);
      });
      
      // Handle process error
      child.on('error', (error) => {
        activeProcesses.delete(processId);
        logWithTimestamp(`Command error: ${error.message}`);
        
        const result = {
          command,
          output: output.trim(),
          error: `Process error: ${error.message}`,
          exitCode: -1,
          status: 'failed',
          timestamp: new Date().toISOString()
        };
        
        resolve(result);
      });
      
      // Set timeout for long-running commands (10 minutes)
      setTimeout(() => {
        if (activeProcesses.has(processId)) {
          logWithTimestamp(`Command timeout, killing process: ${command}`);
          child.kill('SIGTERM');
          
          setTimeout(() => {
            if (activeProcesses.has(processId)) {
              child.kill('SIGKILL');
            }
          }, 5000);
        }
      }, 10 * 60 * 1000);
      
    } catch (error) {
      logWithTimestamp(`Failed to spawn command: ${error.message}`);
      resolve({
        command,
        output: '',
        error: `Failed to execute command: ${error.message}`,
        exitCode: -1,
        status: 'failed',
        timestamp: new Date().toISOString()
      });
    }
  });
}

// Create HTTP server
const server = http.createServer(async (req, res) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, corsHeaders);
    res.end();
    return;
  }
  
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;
  
  // Health check endpoint
  if (path === '/health' && req.method === 'GET') {
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({
      status: 'healthy',
      agent: 'codenest-agent',
      version: '1.0.0',
      activeProcesses: activeProcesses.size,
      currentWorkingDir: currentWorkingDir,
      timestamp: new Date().toISOString()
    }));
    return;
  }
  
  // List project files endpoint
  if (path === '/list-files' && req.method === 'GET') {
    const query = parsedUrl.query;
    const projectPath = query.path || currentWorkingDir;
    
    logWithTimestamp(`Reading project files from: ${projectPath}`);
    
    try {
      // Verify the path exists and is a directory
      if (!fs.existsSync(projectPath)) {
        res.writeHead(404, corsHeaders);
        res.end(JSON.stringify({
          error: 'Directory not found',
          path: projectPath,
          status: 'failed'
        }));
        return;
      }
      
      const stats = fs.statSync(projectPath);
      if (!stats.isDirectory()) {
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({
          error: 'Path is not a directory',
          path: projectPath,
          status: 'failed'
        }));
        return;
      }
      
      // Update working directory
      currentWorkingDir = path.resolve(projectPath);
      
      const result = getProjectStructure(currentWorkingDir);
      
      if (result.success) {
        logWithTimestamp(`Found ${result.stats.totalFiles} files in ${result.stats.directories} directories`);
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify({
          ...result,
          status: 'success',
          timestamp: new Date().toISOString()
        }));
      } else {
        res.writeHead(500, corsHeaders);
        res.end(JSON.stringify({
          error: result.error,
          status: 'failed'
        }));
      }
    } catch (error) {
      logWithTimestamp(`Error reading project files: ${error.message}`);
      res.writeHead(500, corsHeaders);
      res.end(JSON.stringify({
        error: error.message,
        status: 'failed'
      }));
    }
    return;
  }
  
  // Save file endpoint
  if (path === '/save-file' && req.method === 'POST') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', () => {
      try {
        const { filePath, content } = JSON.parse(body);
        
        if (!filePath || typeof filePath !== 'string') {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({
            error: 'filePath is required and must be a string',
            status: 'failed'
          }));
          return;
        }
        
        if (typeof content !== 'string') {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({
            error: 'content must be a string',
            status: 'failed'
          }));
          return;
        }
        
        const result = writeProjectFile(filePath, content);
        
        if (result.success) {
          logWithTimestamp(`Saved file: ${filePath} (${result.size} bytes)`);
          res.writeHead(200, corsHeaders);
          res.end(JSON.stringify({
            ...result,
            status: 'success',
            timestamp: new Date().toISOString()
          }));
        } else {
          res.writeHead(500, corsHeaders);
          res.end(JSON.stringify({
            error: result.error,
            status: 'failed'
          }));
        }
      } catch (error) {
        logWithTimestamp(`Error parsing save file request: ${error.message}`);
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({
          error: `Invalid JSON: ${error.message}`,
          status: 'failed'
        }));
      }
    });
    return;
  }
  
  // Command execution endpoint
  if (path === '/run' && req.method === 'POST') {
    let body = '';
    
    req.on('data', (chunk) => {
      body += chunk.toString();
    });
    
    req.on('end', async () => {
      try {
        const { command } = JSON.parse(body);
        
        if (!command || typeof command !== 'string') {
          res.writeHead(400, corsHeaders);
          res.end(JSON.stringify({
            error: 'Invalid request: command is required and must be a string',
            status: 'failed'
          }));
          return;
        }
        
        // Security check - basic command validation
        const dangerousCommands = ['rm -rf', 'del /f', 'format', 'fdisk', 'dd if='];
        const isDangerous = dangerousCommands.some(dangerous => 
          command.toLowerCase().includes(dangerous.toLowerCase())
        );
        
        if (isDangerous) {
          res.writeHead(403, corsHeaders);
          res.end(JSON.stringify({
            error: 'Command rejected for security reasons',
            status: 'failed'
          }));
          return;
        }
        
        // Execute the command
        const result = await executeCommand(command, res);
        
        res.writeHead(200, corsHeaders);
        res.end(JSON.stringify(result));
        
      } catch (error) {
        logWithTimestamp(`Request parsing error: ${error.message}`);
        res.writeHead(400, corsHeaders);
        res.end(JSON.stringify({
          error: `Invalid JSON: ${error.message}`,
          status: 'failed'
        }));
      }
    });
    
    return;
  }
  
  // Kill processes endpoint
  if (path === '/kill' && req.method === 'POST') {
    let killed = 0;
    activeProcesses.forEach((process, id) => {
      process.kill('SIGTERM');
      killed++;
    });
    
    res.writeHead(200, corsHeaders);
    res.end(JSON.stringify({
      message: `Killed ${killed} active processes`,
      status: 'success'
    }));
    return;
  }
  
  // Default 404
  res.writeHead(404, corsHeaders);
  res.end(JSON.stringify({
    error: 'Endpoint not found',
    availableEndpoints: ['/health', '/list-files', '/save-file', '/run', '/kill'],
    status: 'failed'
  }));
});

// Error handling
server.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    logWithTimestamp(`Port ${PORT} is already in use. Please stop any existing codenest-agent instances.`);
    process.exit(1);
  } else {
    logWithTimestamp(`Server error: ${error.message}`);
  }
});

// Graceful shutdown
process.on('SIGINT', () => {
  logWithTimestamp('Received SIGINT, shutting down gracefully...');
  
  // Kill all active processes
  activeProcesses.forEach((process, id) => {
    logWithTimestamp(`Killing process ${id}...`);
    process.kill('SIGTERM');
  });
  
  server.close(() => {
    logWithTimestamp('Server closed. Goodbye!');
    process.exit(0);
  });
});

process.on('SIGTERM', () => {
  logWithTimestamp('Received SIGTERM, shutting down gracefully...');
  server.close(() => {
    process.exit(0);
  });
});

// Start the server
server.listen(PORT, HOST, () => {
  logWithTimestamp(`🚀 CodeNest Agent running on http://${HOST}:${PORT}`);
  logWithTimestamp('Available endpoints:');
  logWithTimestamp('  GET  /health     - Health check');
  logWithTimestamp('  GET  /list-files - List project files');
  logWithTimestamp('  POST /save-file  - Save file to disk');
  logWithTimestamp('  POST /run        - Execute command');
  logWithTimestamp('  POST /kill       - Kill active processes');
  logWithTimestamp('');
  logWithTimestamp('Example usage:');
  logWithTimestamp(`  curl -X GET  http://${HOST}:${PORT}/list-files?path=/path/to/project`);
  logWithTimestamp(`  curl -X POST http://${HOST}:${PORT}/run -H "Content-Type: application/json" -d '{"command":"npm --version"}'`);
  logWithTimestamp('');
  logWithTimestamp(`Current working directory: ${currentWorkingDir}`);
  logWithTimestamp('Press Ctrl+C to stop the agent');
});