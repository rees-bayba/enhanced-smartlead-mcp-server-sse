#!/usr/bin/env node
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { SSEServerTransport } from "@modelcontextprotocol/sdk/server/sse.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  Tool,
} from "@modelcontextprotocol/sdk/types.js";
import express from 'express';
import axios from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// Get API key
const SMARTLEAD_API_KEY = process.env.SMARTLEAD_API_KEY;
if (!SMARTLEAD_API_KEY) {
  console.error('Error: SMARTLEAD_API_KEY environment variable is required');
  process.exit(1);
}

// API client setup
const apiClient = axios.create({
  baseURL: 'https://server.smartlead.ai/api/v1',
  params: {
    api_key: SMARTLEAD_API_KEY,
  },
  headers: {
    'Content-Type': 'application/json',
  },
});

// Define tools
const CAMPAIGN_LIST_TOOL: Tool = {
  name: 'smartlead_list_campaigns',
  description: 'List all campaigns with optional filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['active', 'paused', 'completed', 'all'],
        description: 'Filter campaigns by status',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of campaigns to return',
      },
      offset: {
        type: 'number',
        description: 'Offset for pagination',
      },
    },
  },
};

const GET_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_get_campaign',
  description: 'Get details of a specific campaign by ID.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign to retrieve',
      },
    },
    required: ['campaign_id'],
  },
};

const GET_CAMPAIGN_ANALYTICS_TOOL: Tool = {
  name: 'smartlead_get_campaign_analytics',
  description: 'Get analytics for a specific campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: {
        type: 'number',
        description: 'ID of the campaign',
      },
    },
    required: ['campaign_id'],
  },
};

// Express app for SSE
const app = express();
const PORT = parseInt(process.env.PORT || '8080', 10);

// CORS
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
  res.json({ status: 'ok', tools: 3 });
});

// Main SSE endpoint
app.get('/', async (req, res) => {
  if (req.headers.accept?.includes('text/event-stream')) {
    console.error('SSE connection initiated');
    
    try {
      // Create server instance
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

      // Tool handlers
      server.setRequestHandler(ListToolsRequestSchema, async () => {
        console.error('Tools requested - returning tools');
        return {
          tools: [
            CAMPAIGN_LIST_TOOL,
            GET_CAMPAIGN_TOOL,
            GET_CAMPAIGN_ANALYTICS_TOOL,
          ],
        };
      });

      server.setRequestHandler(CallToolRequestSchema, async (request) => {
        const { name, arguments: args } = request.params;
        console.error(`Tool called: ${name}`);

        try {
          switch (name) {
            case 'smartlead_list_campaigns': {
              const response = await apiClient.get('/campaigns', { 
                params: args || {} 
              });
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(response.data, null, 2),
                }],
              };
            }

            case 'smartlead_get_campaign': {
              if (!args || typeof args.campaign_id !== 'number') {
                throw new Error('campaign_id is required and must be a number');
              }
              const response = await apiClient.get(`/campaigns/${args.campaign_id}`);
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(response.data, null, 2),
                }],
              };
            }

            case 'smartlead_get_campaign_analytics': {
              if (!args || typeof args.campaign_id !== 'number') {
                throw new Error('campaign_id is required and must be a number');
              }
              const response = await apiClient.get(
                `/campaigns/${args.campaign_id}/analytics`
              );
              return {
                content: [{
                  type: 'text',
                  text: JSON.stringify(response.data, null, 2),
                }],
              };
            }

            default:
              return {
                content: [{
                  type: 'text',
                  text: `Unknown tool: ${name}`,
                }],
                isError: true,
              };
          }
        } catch (error) {
          const errorMessage = axios.isAxiosError(error)
            ? `API Error: ${error.response?.data?.message || error.message}`
            : `Error: ${error instanceof Error ? error.message : String(error)}`;

          return {
            content: [{ type: 'text', text: errorMessage }],
            isError: true,
          };
        }
      });

      // Create transport and connect
      const transport = new SSEServerTransport('/', res);
      await server.connect(transport);
      console.error('MCP server connected');

      // Handle disconnect
      req.on('close', () => {
        console.error('Client disconnected');
        server.close().catch(console.error);
      });

    } catch (error) {
      console.error('Error:', error);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Failed to establish SSE connection' });
      }
    }
  } else {
    // Regular HTTP request
    res.json({
      name: 'smartlead-mcp',
      version: '1.0.0',
      tools: 3,
    });
  }
});

// Start server
app.listen(PORT, '0.0.0.0', () => {
  console.error(`Smartlead MCP Server running on port ${PORT}`);
});
