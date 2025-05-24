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
app.use(cors());

app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'smartlead-mcp-server' });
});

// SSE endpoint at root for Claude Desktop
app.get('/', async (req, res) => {
  // Check if this is an SSE request from Claude
  if (req.headers.accept?.includes('text/event-stream')) {
    console.error('SSE connection requested');
    
    const apiKey = req.headers.authorization?.replace('Bearer ', '') || process.env.SMARTLEAD_API_KEY;
    
    if (!apiKey) {
      console.error('No API key provided');
      res.status(401).json({ error: 'API key required' });
      return;
    }

    // Set up SSE headers FIRST
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    
    // Create transport with request and response objects
    const transport = new SSEServerTransport(req, res);

    // Create server instance
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

    // Combine all tools
    const allTools = [
      ...campaignTools,
      ...leadTools,
      ...analyticsTools,
      ...replyTools,
      ...webhookTools
    ];

    console.error(`Registering ${allTools.length} tools`);

    // Setup handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.error('ListTools request received');
      return { tools: allTools };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      console.error(`CallTool request for: ${request.params.name}`);
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
        console.error('Tool execution error:', error);
        if (error instanceof McpError) throw error;
        
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
        );
      }
    });

    try {
      await server.connect(transport);
      console.error('MCP server connected via SSE');
    } catch (error) {
      console.error('Failed to connect MCP server:', error);
      return;
    }
    
    // Handle connection close
    req.on('close', () => {
      console.error('SSE connection closed');
      server.close();
    });
  } else {
    // Regular browser request
    res.json({ 
      message: 'SmartLead MCP Server',
      status: 'running',
      version: '1.0.0',
      endpoint: 'SSE endpoint available at root path',
      tools: [
        ...campaignTools,
        ...leadTools,
        ...analyticsTools,
        ...replyTools,
        ...webhookTools
      ].length + ' tools available'
    });
  }
});

// Error handling
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error('Express error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`SmartLead MCP Server running on port ${PORT}`);
  console.log(`Server URL: http://localhost:${PORT}`);
});
