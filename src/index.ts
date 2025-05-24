#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError
} from "@modelcontextprotocol/sdk/types.js";
import express from 'express';
import dotenv from 'dotenv';

// Import our tools
import { campaignTools } from './tools/campaigns.js';
import { leadTools } from './tools/leads.js';
import { analyticsTools } from './tools/analytics.js';
import { replyTools } from './tools/replies.js';
import { webhookTools } from './tools/webhooks.js';

dotenv.config();

// Health check server for Railway
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'smartlead-mcp-server' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Health check server running on port ${PORT}`);
});

// MCP Server
class SmartLeadMCPServer {
  private server: Server;
  private apiKey: string;

  constructor() {
    this.apiKey = process.env.SMARTLEAD_API_KEY || '';
    if (!this.apiKey) {
      throw new Error('SMARTLEAD_API_KEY environment variable is required');
    }

    this.server = new Server(
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

    this.setupHandlers();
    
    // Error handling
    this.server.onerror = (error) => console.error("[MCP Error]", error);
    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers() {
    // Combine all tools
    const allTools = [
      ...campaignTools,
      ...leadTools,
      ...analyticsTools,
      ...replyTools,
      ...webhookTools
    ];

    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: allTools,
    }));

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // Dynamic tool handler import based on tool name prefix
        if (name.startsWith('campaign_')) {
          const { handleCampaignTool } = await import('./tools/campaigns.js');
          return await handleCampaignTool(name, args, this.apiKey);
        } else if (name.startsWith('lead_')) {
          const { handleLeadTool } = await import('./tools/leads.js');
          return await handleLeadTool(name, args, this.apiKey);
        } else if (name.startsWith('analytics_')) {
          const { handleAnalyticsTool } = await import('./tools/analytics.js');
          return await handleAnalyticsTool(name, args, this.apiKey);
        } else if (name.startsWith('reply_')) {
          const { handleReplyTool } = await import('./tools/replies.js');
          return await handleReplyTool(name, args, this.apiKey);
        } else if (name.startsWith('webhook_')) {
          const { handleWebhookTool } = await import('./tools/webhooks.js');
          return await handleWebhookTool(name, args, this.apiKey);
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
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('SmartLead MCP server running on stdio');
  }
}

// Main execution
const server = new SmartLeadMCPServer();
server.run().catch(console.error);
