#!/usr/bin/env node

const readline = require('readline');
const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');

// Setup interface for reading from stdin and writing to stdout
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
  terminal: false
});

// State to track if browser-tools-server is running
let browserToolsServerRunning = false;
let serverProcess = null;

// Tools definition
const tools = {
  captureScreenshot: {
    name: "captureScreenshot",
    description: "Captures a screenshot of the current browser tab",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  getConsoleLogs: {
    name: "getConsoleLogs",
    description: "Gets console logs from the browser",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of logs to return"
        }
      },
      required: []
    }
  },
  getNetworkTraffic: {
    name: "getNetworkTraffic",
    description: "Gets network traffic from the browser",
    input_schema: {
      type: "object",
      properties: {
        limit: {
          type: "number",
          description: "Maximum number of requests to return"
        }
      },
      required: []
    }
  },
  getSelectedElement: {
    name: "getSelectedElement",
    description: "Gets the currently selected DOM element in the browser",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  runAccessibilityAudit: {
    name: "runAccessibilityAudit",
    description: "Runs an accessibility audit on the current page",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  runPerformanceAudit: {
    name: "runPerformanceAudit",
    description: "Runs a performance audit on the current page",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  runSEOAudit: {
    name: "runSEOAudit",
    description: "Runs an SEO audit on the current page",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  runBestPracticesAudit: {
    name: "runBestPracticesAudit",
    description: "Runs a best practices audit on the current page",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  runNextJSAudit: {
    name: "runNextJSAudit",
    description: "Runs a NextJS-specific audit on the current page",
    input_schema: {
      type: "object",
      properties: {
        routerType: {
          type: "string",
          description: "The type of NextJS router ('app' or 'page')"
        }
      },
      required: []
    }
  },
  runDebuggerMode: {
    name: "runDebuggerMode",
    description: "Runs all debugging tools in sequence",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  runAuditMode: {
    name: "runAuditMode",
    description: "Runs all audit tools in sequence",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  },
  wipeLogs: {
    name: "wipeLogs",
    description: "Wipes all stored logs",
    input_schema: {
      type: "object",
      properties: {},
      required: []
    }
  }
};

// Function to ensure browser-tools-server is running
function ensureBrowserToolsServerRunning() {
  if (!browserToolsServerRunning) {
    console.error("Starting browser-tools-server...");
    
    try {
      serverProcess = spawn('npx', ['@agentdeskai/browser-tools-server@latest'], {
        stdio: 'pipe',
        detached: true
      });
      
      serverProcess.stdout.on('data', (data) => {
        console.error(`server stdout: ${data}`);
      });
      
      serverProcess.stderr.on('data', (data) => {
        console.error(`server stderr: ${data}`);
      });
      
      serverProcess.on('close', (code) => {
        console.error(`server process exited with code ${code}`);
        browserToolsServerRunning = false;
        serverProcess = null;
      });
      
      browserToolsServerRunning = true;
      
      // Allow some time for the server to start
      return new Promise(resolve => setTimeout(resolve, 3000));
    } catch (error) {
      console.error("Failed to start browser-tools-server:", error);
      throw error;
    }
  }
  
  return Promise.resolve();
}

// Tool handler functions
async function handleToolCall(toolName, params) {
  await ensureBrowserToolsServerRunning();
  
  // Implement mock responses for each tool
  switch (toolName) {
    case 'captureScreenshot':
      return {
        success: true,
        screenshot: "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAA...(mock base64 data)",
        message: "Screenshot captured successfully"
      };
    
    case 'getConsoleLogs':
      return {
        success: true,
        logs: [
          { level: "info", message: "Page loaded", timestamp: new Date().toISOString() },
          { level: "error", message: "Failed to load resource", timestamp: new Date().toISOString() }
        ]
      };
    
    case 'getNetworkTraffic':
      return {
        success: true,
        requests: [
          { 
            url: "https://example.com/api/data", 
            method: "GET", 
            status: 200,
            type: "xhr",
            responseSize: 1024,
            timing: { startTime: new Date().getTime() - 1000, endTime: new Date().getTime() }
          }
        ]
      };
    
    case 'getSelectedElement':
      return {
        success: true,
        element: {
          tagName: "DIV",
          id: "app",
          className: "container",
          attributes: [
            { name: "id", value: "app" },
            { name: "class", value: "container" }
          ],
          innerHTML: "<h1>Example App</h1>"
        }
      };
    
    case 'runAccessibilityAudit':
    case 'runPerformanceAudit':
    case 'runSEOAudit':
    case 'runBestPracticesAudit':
    case 'runNextJSAudit':
    case 'runAuditMode':
    case 'runDebuggerMode':
      return {
        success: true,
        auditType: toolName,
        score: 85,
        issues: [
          { 
            id: "mock-issue-1", 
            impact: "medium", 
            description: "Example issue description",
            suggestions: ["Suggestion 1", "Suggestion 2"]
          }
        ]
      };
    
    case 'wipeLogs':
      return {
        success: true,
        message: "All logs have been wiped"
      };
    
    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}

// Function to handle MCP messages
async function handleMessage(message) {
  try {
    const parsedMessage = JSON.parse(message);
    
    if (parsedMessage.type === 'manifest') {
      // Return the manifest with tools
      return {
        type: 'manifest',
        tools: Object.values(tools)
      };
    } else if (parsedMessage.type === 'tool_call') {
      const { tool_name, tool_params = {} } = parsedMessage;
      
      // Handle the tool call
      const result = await handleToolCall(tool_name, tool_params);
      
      return {
        type: 'tool_result',
        id: parsedMessage.id,
        result
      };
    } else {
      throw new Error(`Unknown message type: ${parsedMessage.type}`);
    }
  } catch (error) {
    console.error('Error handling message:', error);
    return {
      type: 'error',
      message: error.message
    };
  }
}

// Main loop to process messages
rl.on('line', async (line) => {
  try {
    const response = await handleMessage(line);
    console.log(JSON.stringify(response));
  } catch (error) {
    console.error('Error processing message:', error);
    console.log(JSON.stringify({
      type: 'error',
      message: error.message
    }));
  }
});

// Cleanup function
function cleanup() {
  if (serverProcess) {
    console.error('Shutting down browser-tools-server...');
    process.kill(-serverProcess.pid);
    serverProcess = null;
  }
}

// Register cleanup handlers
process.on('exit', cleanup);
process.on('SIGINT', () => {
  cleanup();
  process.exit(0);
});
process.on('SIGTERM', () => {
  cleanup();
  process.exit(0);
});

// Signal that the server is ready
console.error('BrowserTools MCP server is ready');