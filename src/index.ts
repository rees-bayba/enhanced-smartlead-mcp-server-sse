#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';

// Import our tools
import { campaignTools } from './tools/campaigns.js';
import { leadTools } from './tools/leads.js';
import { analyticsTools } from './tools/analytics.js';
import { replyTools } from './tools/replies.js';
import { webhookTools } from './tools/webhooks.js';

dotenv.config();

// Get API key from environment
const SMARTLEAD_API_KEY = process.env.SMARTLEAD_API_KEY;
if (!SMARTLEAD_API_KEY) {
  console.error('Error: SMARTLEAD_API_KEY environment variable is required');
  process.exit(1);
}

// Combine all tools like Jacob does
const ALL_TOOLS: Tool[] = [
  ...campaignTools,
  ...leadTools,
  ...analyticsTools,
  ...replyTools,
  ...webhookTools
];

console.error(`Loaded ${ALL_TOOLS.length} tools`);

// Create Express app for SSE
const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

app.use(cors());
app.use(express.json());

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'smartlead-mcp-server' });
});

// Main SSE endpoint
app.get('/', async (req, res) => {
  if (req.headers.accept?.includes('text/event-stream')) {
    console.error('SSE connection initiated');
    
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    
    // Create MCP server instance
    const server = new Server(
      {
        name: 'smartlead-mcp',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Set up handlers BEFORE connecting
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.error('ListTools request - returning tools');
      return { tools: ALL_TOOLS };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.error(`CallTool request: ${name}`);
      
      const apiKey = req.headers.authorization?.replace('Bearer ', '') || SMARTLEAD_API_KEY;

      try {
        // Route to appropriate handler based on tool prefix
        if (name.startsWith('campaign_')) {
          const { handleCampaignTool } = await import('./tools/campaigns.js');
          return await handleCampaignTool(name, args, apiKey);
        } else if (name.startsWith('lead_')) {
          const { handleLeadTool } = await import('./tools/leads.js');
          return await handleLeadTool(name, args, apiKey);
        } else if (name.startsWith('analytics_')) {
          const { handleAnalyticsTool } = await import('./tools/analytics.js');
          return await handleAnalyticsTool(name, args, apiKey);
        } else if (name.startsWith('reply_')) {
          const { handleReplyTool } = await import('./tools/replies.js');
          return await handleReplyTool(name, args, apiKey);
        } else if (name.startsWith('webhook_')) {
          const { handleWebhookTool } = await import('./tools/webhooks.js');
          return await handleWebhookTool(name, args, apiKey);
        }

        throw new McpError(
          ErrorCode.MethodNotFound,
          `Unknown tool: ${name}`
        );
      } catch (error) {
        if (error instanceof McpError) throw error;
        
        console.error('Tool execution error:', error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    // Create SSE transport and connect
    const transport = new SSEServerTransport('/', res);
    
    await server.connect(transport);
    console.error('MCP server connected successfully');

    // Handle disconnect
    req.on('close', () => {
      console.error('Client disconnected');
      server.close();
    });
    
  } else {
    // Regular HTTP request - show server info
    res.json({
      name: 'smartlead-mcp',
      version: '1.0.0',
      tools: ALL_TOOLS.length,
      status: 'running'
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.log(`SmartLead MCP Server (SSE) running on port ${PORT}`);
  console.log(`Loaded ${ALL_TOOLS.length} tools`);
});
