#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool
} from "@modelcontextprotocol/sdk/types.js";
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Enable CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy' });
});

// Simple test tools to verify connection
const testTools: Tool[] = [
  {
    name: "test_connection",
    description: "Test if MCP connection is working",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  },
  {
    name: "campaign_list",
    description: "List all SmartLead campaigns",
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

// SSE endpoint
app.get('/', async (req, res) => {
  if (req.headers.accept?.includes('text/event-stream')) {
    console.error('=== NEW SSE CONNECTION ===');
    
    // CRITICAL: Set SSE headers before anything else
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    
    // Send initial comment to establish connection
    res.write(':ok\n\n');
    
    // Create server
    const server = new Server(
      {
        name: "smartlead-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {}
        }
      }
    );

    // Setup handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.error('=== LIST TOOLS REQUEST ===');
      return { tools: testTools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error(`=== CALL TOOL: ${request.params.name} ===`);
      
      if (request.params.name === 'test_connection') {
        return {
          content: [{
            type: "text",
            text: "MCP connection is working! ✅"
          }]
        };
      }
      
      if (request.params.name === 'campaign_list') {
        // For now, return mock data to test
        return {
          content: [{
            type: "text",
            text: JSON.stringify({
              campaigns: [
                { id: 1, name: "Test Campaign 1", status: "active" },
                { id: 2, name: "Test Campaign 2", status: "paused" }
              ],
              total: 2
            }, null, 2)
          }]
        };
      }
      
      throw new Error(`Unknown tool: ${request.params.name}`);
    });

    // Create transport and connect
    const transport = new SSEServerTransport('/', res);
    await server.connect(transport);
    console.error('=== MCP SERVER CONNECTED ===');
    
    // Keep connection alive
    const keepAlive = setInterval(() => {
      res.write(':keepalive\n\n');
    }, 30000);
    
    // Handle disconnect
    req.on('close', () => {
      console.error('=== CLIENT DISCONNECTED ===');
      clearInterval(keepAlive);
      server.close();
    });
    
  } else {
    // Regular HTTP request
    res.json({
      message: 'SmartLead MCP Server',
      status: 'running',
      mcp_endpoint: 'SSE available at /',
      test: 'Visit this URL with Accept: text/event-stream header'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Test with: curl -H "Accept: text/event-stream" http://localhost:${PORT}/`);
});
