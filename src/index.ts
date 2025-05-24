#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import express from 'express';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// Simple test tool
const TOOLS = [
  {
    name: "test",
    description: "Test tool",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  }
];

// CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', '*');  
  res.header('Access-Control-Allow-Headers', '*');
  next();
});

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

// Main endpoint
app.get('/', async (req, res) => {
  if (req.headers.accept?.includes('text/event-stream')) {
    console.log('=== NEW SSE CONNECTION ===');
    console.log('Headers:', JSON.stringify(req.headers, null, 2));
    
    try {
      // Create server with extensive logging
      const server = new Server(
        {
          name: 'test-mcp-server',
          version: '1.0.0'
        },
        {
          capabilities: {
            tools: {}
          }
        }
      );

      // Override internal logging
      const originalSend = server.send;
      server.send = async function(message: any) {
        console.log('>>> SENDING:', JSON.stringify(message));
        return originalSend.call(this, message);
      };

      // Log all incoming messages
      const originalHandle = server.handleMessage;
      server.handleMessage = async function(message: any) {
        console.log('<<< RECEIVED:', JSON.stringify(message));
        return originalHandle.call(this, message);
      };

      // Set up ALL possible handlers
      server.setRequestHandler({
        method: 'initialize'
      } as any, async (request) => {
        console.log('!!! INITIALIZE REQUEST !!!');
        return {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {}
          },
          serverInfo: {
            name: "test-mcp-server",
            version: "1.0.0"
          }
        };
      });

      server.setRequestHandler({
        method: 'tools/list'
      } as any, async () => {
        console.log('!!! TOOLS LIST REQUEST !!!');
        return { tools: TOOLS };
      });

      server.setRequestHandler({
        method: 'tools/call'
      } as any, async (request) => {
        console.log('!!! TOOL CALL REQUEST !!!');
        return {
          content: [{
            type: 'text',
            text: 'Tool called!'
          }]
        };
      });

      // Create transport
      console.log('Creating SSE transport...');
      const transport = new SSEServerTransport('/', res);
      
      // Connect
      console.log('Connecting server to transport...');
      await server.connect(transport);
      console.log('=== CONNECTED ===');

      // Handle disconnect
      req.on('close', () => {
        console.log('=== CLIENT DISCONNECTED ===');
        server.close();
      });

    } catch (error) {
      console.error('ERROR:', error);
    }
  } else {
    res.json({
      name: 'Test MCP Server',
      status: 'running'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Server on port ${PORT}`);
});
