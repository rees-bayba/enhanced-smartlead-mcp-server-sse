#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
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

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// Enable CORS for Claude Desktop
app.use(cors({
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  credentials: true
}));

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'smartlead-mcp-server' });
});

// SSE endpoint at root for Claude Desktop
app.get('/', async (req, res) => {
  // Check if this is an SSE request from Claude
  if (req.headers.accept?.includes('text/event-stream')) {
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || process.env.SMARTLEAD_API_KEY;
    
    if (!apiKey) {
      res.status(401).json({ error: 'API key required' });
      return;
    }

    // Set up SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');

    const transport = new SSEServerTransport('/', res);
    const server = new Server(
      {
        name: "smartlead-mcp-server",
        version: "1.0.0",
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    // Setup handlers
    const allTools = [
      ...campaignTools,
      ...leadTools,
      ...analyticsTools,
      ...replyTools,
      ...webhookTools
    ];

    server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: allTools,
    }));

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
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
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    await server.connect(transport);
    
    // Handle connection close
    req.on('close', () => {
      server.close();
    });
  } else {
    // Regular browser request
    res.json({ 
      message: 'SmartLead MCP Server',
      status: 'running',
      version: '1.0.0',
      endpoint: 'SSE endpoint available at root path'
    });
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SmartLead MCP Server running on port ${PORT}`);
  console.log(`Server URL: http://localhost:${PORT}`);
});
