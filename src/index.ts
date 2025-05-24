#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import express from 'express';
import { createServer } from 'http';
import dotenv from 'dotenv';

dotenv.config();

// Simple tools for testing
const TOOLS = [
  {
    name: "test_connection",
    description: "Test if the MCP connection is working",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  },
  {
    name: "get_campaigns",
    description: "Get list of SmartLead campaigns",
    inputSchema: {
      type: "object" as const,
      properties: {
        limit: {
          type: "number",
          description: "Number of campaigns to return",
          default: 10
        }
      }
    }
  }
];

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// CORS middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');
  res.header('Access-Control-Allow-Headers', '*');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', tools: TOOLS.length });
});

// Root endpoint info
app.get('/', (req, res) => {
  // Check if this is an SSE request
  const acceptHeader = req.headers.accept || '';
  
  if (acceptHeader.includes('text/event-stream')) {
    handleSSE(req, res);
  } else {
    // Regular HTTP request - return server info
    res.json({
      name: 'SmartLead MCP Server',
      version: '1.0.0',
      mcp: {
        endpoint: '/',
        transport: 'sse',
        tools: TOOLS.length
      }
    });
  }
});

// SSE handler
async function handleSSE(req: express.Request, res: express.Response) {
  console.log('[SSE] New connection request');
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no' // Disable Nginx buffering
  });

  // Send initial data to establish connection
  res.write('\n');
  
  try {
    // Create MCP server
    const server = new Server(
      {
        name: 'smartlead-mcp-server',
        version: '1.0.0'
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Set up tool listing handler
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.log('[MCP] Tools requested');
      return { tools: TOOLS };
    });

    // Set up tool calling handler
    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.log(`[MCP] Tool called: ${name}`);

      switch (name) {
        case 'test_connection':
          return {
            content: [{
              type: 'text',
              text: '✅ MCP connection is working correctly!'
            }]
          };

        case 'get_campaigns':
          // Return mock data for now
          return {
            content: [{
              type: 'text',
              text: JSON.stringify({
                campaigns: [
                  { id: 1, name: 'Campaign 1', status: 'active' },
                  { id: 2, name: 'Campaign 2', status: 'paused' }
                ],
                total: 2
              }, null, 2)
            }]
          };

        default:
          throw new Error(`Unknown tool: ${name}`);
      }
    });

    // Connect transport
    const transport = new SSEServerTransport('/', res);
    await server.connect(transport);
    
    console.log('[MCP] Server connected successfully');

    // Keep-alive ping every 30 seconds
    const pingInterval = setInterval(() => {
      try {
        res.write(':ping\n\n');
      } catch (e) {
        clearInterval(pingInterval);
      }
    }, 30000);

    // Handle client disconnect
    req.on('close', () => {
      console.log('[SSE] Client disconnected');
      clearInterval(pingInterval);
      server.close().catch(console.error);
    });

  } catch (error) {
    console.error('[SSE] Error:', error);
    res.end();
  }
}

// Create HTTP server
const httpServer = createServer(app);

// Start server
httpServer.listen(PORT, '0.0.0.0', () => {
  console.log(`SmartLead MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`Tools available: ${TOOLS.length}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  httpServer.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});
