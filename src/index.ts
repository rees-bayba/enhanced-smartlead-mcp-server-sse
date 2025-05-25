#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import dotenv from 'dotenv';

// Import tools
import { campaignTools, handleCampaignTool } from './tools/campaigns.js';
import { leadTools, handleLeadTool } from './tools/leads.js';
import { analyticsTools, handleAnalyticsTool } from './tools/analytics.js';
import { replyTools, handleReplyTool } from './tools/replies.js';
import { webhookTools, handleWebhookTool } from './tools/webhooks.js';

// Load environment variables
dotenv.config();

const API_KEY = process.env.SMARTLEAD_API_KEY;
if (!API_KEY) {
  console.error('SMARTLEAD_API_KEY environment variable is required');
  process.exit(1);
}

// Combine all tools
const ALL_TOOLS = [
  ...campaignTools,
  ...leadTools,
  ...analyticsTools,
  ...replyTools,
  ...webhookTools
];

// Main server function
async function main() {
  const server = new Server(
    {
      name: 'smartlead-mcp-server',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // Handle list tools request
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    console.error(`[MCP] Listing ${ALL_TOOLS.length} tools`);
    return { tools: ALL_TOOLS };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;
    console.error(`[MCP] Executing tool: ${name}`);

    try {
      // Route to appropriate handler based on tool prefix
      let result;
      
      if (name.startsWith('campaign_')) {
        result = await handleCampaignTool(name, args, API_KEY);
      } else if (name.startsWith('lead_')) {
        result = await handleLeadTool(name, args, API_KEY);
      } else if (name.startsWith('analytics_')) {
        result = await handleAnalyticsTool(name, args, API_KEY);
      } else if (name.startsWith('reply_')) {
        result = await handleReplyTool(name, args, API_KEY);
      } else if (name.startsWith('webhook_')) {
        result = await handleWebhookTool(name, args, API_KEY);
      } else {
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      return result;
    } catch (error) {
      console.error(`[MCP] Tool execution error:`, error);
      
      if (error instanceof McpError) {
        throw error;
      }
      
      throw new McpError(
        ErrorCode.InternalError,
        `Tool execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`
      );
    }
  });

  // Create stdio transport
  const transport = new StdioServerTransport();
  
  // Start the server
  await server.connect(transport);
  console.error('SmartLead MCP Server running on stdio');
}

// Run the server
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
