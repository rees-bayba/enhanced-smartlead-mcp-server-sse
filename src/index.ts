#!/usr/bin/env node
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
  Tool,
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance } from 'axios';
import dotenv from 'dotenv';
import cors from 'cors';

// Load environment variables
dotenv.config();

// Validate and get API key
function getApiKey(): string {
  const apiKey = process.env.SMARTLEAD_API_KEY;
  if (!apiKey) {
    console.error('SMARTLEAD_API_KEY environment variable is required');
    process.exit(1);
  }
  return apiKey;
}

const SMARTLEAD_API_KEY = getApiKey();
const API_BASE = 'https://server.smartlead.ai/api/v1';
const PORT = process.env.PORT || 8080;

// SmartLead API Client
class SmartLeadClient {
  private client: AxiosInstance;
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.client = axios.create({
      baseURL: API_BASE,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
      },
    });
  }

  async request(method: string, endpoint: string, data?: any, params?: any) {
    try {
      const response = await this.client.request({
        method,
        url: endpoint,
        data,
        params: {
          api_key: this.apiKey,
          ...params,
        },
      });
      return response.data;
    } catch (error) {
      if (axios.isAxiosError(error)) {
        throw new Error(`SmartLead API Error: ${error.response?.data?.message || error.message}`);
      }
      throw error;
    }
  }

  get(endpoint: string, params?: any) {
    return this.request('GET', endpoint, undefined, params);
  }

  post(endpoint: string, data?: any, params?: any) {
    return this.request('POST', endpoint, data, params);
  }

  delete(endpoint: string, params?: any) {
    return this.request('DELETE', endpoint, undefined, params);
  }
}

// Define all tools
const ALL_TOOLS: Tool[] = [
  // Campaign Management Tools
  {
    name: "campaign_list",
    description: "List all campaigns with their current status and statistics",
    inputSchema: {
      type: "object" as const,
      properties: {
        offset: {
          type: "number",
          description: "Number of records to skip",
          default: 0
        },
        limit: {
          type: "number",
          description: "Number of records to return",
          default: 100
        }
      }
    }
  },
  {
    name: "campaign_get",
    description: "Get detailed information about a specific campaign",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        }
      },
      required: ["campaignId"]
    }
  },
  {
    name: "campaign_status_update",
    description: "Update campaign status (START, PAUSE, STOP, RESUME)",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        },
        status: {
          type: "string",
          description: "New status: START, PAUSE, STOP, or RESUME",
          enum: ["START", "PAUSE", "STOP", "RESUME"]
        }
      },
      required: ["campaignId", "status"]
    }
  },
  
  // Lead Management Tools
  {
    name: "lead_list_by_campaign",
    description: "List all leads in a specific campaign",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        },
        offset: {
          type: "number",
          description: "Number of records to skip",
          default: 0
        },
        limit: {
          type: "number",
          description: "Number of records to return",
          default: 100
        }
      },
      required: ["campaignId"]
    }
  },
  {
    name: "lead_search_by_email",
    description: "Search for a lead by email address",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          description: "Email address to search for"
        }
      },
      required: ["email"]
    }
  },
  {
    name: "lead_update_category",
    description: "Update lead category (interested, not_interested, etc.)",
    inputSchema: {
      type: "object" as const,
      properties: {
        email: {
          type: "string",
          description: "Lead's email address"
        },
        campaignId: {
          type: "number",
          description: "Campaign ID"
        },
        leadCategory: {
          type: "string",
          description: "New category",
          enum: ["interested", "not_interested", "maybe_later", "meeting_booked", "meeting_completed"]
        }
      },
      required: ["email", "campaignId", "leadCategory"]
    }
  },
  {
    name: "lead_add_to_blocklist",
    description: "Add a lead to the blocklist",
    inputSchema: {
      type: "object" as const,
      properties: {
        emails: {
          type: "array",
          items: { type: "string" },
          description: "Array of email addresses to block"
        }
      },
      required: ["emails"]
    }
  },
  
  // Analytics Tools
  {
    name: "analytics_campaign_overview",
    description: "Get campaign statistics including sent, opened, clicked, replied counts",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        }
      },
      required: ["campaignId"]
    }
  },
  {
    name: "analytics_campaign_by_date",
    description: "Get campaign analytics for a specific date range",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        },
        startDate: {
          type: "string",
          description: "Start date (YYYY-MM-DD)"
        },
        endDate: {
          type: "string",
          description: "End date (YYYY-MM-DD)"
        }
      },
      required: ["campaignId", "startDate", "endDate"]
    }
  },
  {
    name: "analytics_sequence_performance",
    description: "Get performance metrics for each sequence step",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        }
      },
      required: ["campaignId"]
    }
  },
  
  // Reply Management Tools
  {
    name: "reply_get_all",
    description: "Get all replies for a campaign with full message content",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        },
        offset: {
          type: "number",
          description: "Number of records to skip",
          default: 0
        },
        limit: {
          type: "number",
          description: "Number of records to return",
          default: 100
        }
      },
      required: ["campaignId"]
    }
  },
  {
    name: "reply_get_message_history",
    description: "Get complete message history for a specific lead",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        },
        leadId: {
          type: "number",
          description: "The lead ID"
        }
      },
      required: ["campaignId", "leadId"]
    }
  },
  {
    name: "reply_send",
    description: "Send a reply to a lead",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        },
        leadId: {
          type: "number",
          description: "The lead ID"
        },
        message: {
          type: "string",
          description: "Reply message content"
        }
      },
      required: ["campaignId", "leadId", "message"]
    }
  },
  
  // Webhook Tools
  {
    name: "webhook_create",
    description: "Create a webhook for real-time event notifications",
    inputSchema: {
      type: "object" as const,
      properties: {
        url: {
          type: "string",
          description: "Webhook endpoint URL"
        },
        events: {
          type: "array",
          items: {
            type: "string",
            enum: ["EMAIL_SENT", "EMAIL_OPENED", "EMAIL_CLICKED", "EMAIL_REPLIED", "LEAD_CATEGORY_UPDATED"]
          },
          description: "Events to subscribe to"
        },
        campaignId: {
          type: "number",
          description: "Optional: Specific campaign ID to monitor"
        }
      },
      required: ["url", "events"]
    }
  },
  {
    name: "webhook_list",
    description: "List all active webhooks",
    inputSchema: {
      type: "object" as const,
      properties: {}
    }
  },
  {
    name: "webhook_delete",
    description: "Delete a webhook",
    inputSchema: {
      type: "object" as const,
      properties: {
        webhookId: {
          type: "string",
          description: "Webhook ID to delete"
        }
      },
      required: ["webhookId"]
    }
  }
];

// Tool handler
async function handleToolCall(name: string, args: any): Promise<{ content: Array<{ type: string; text: string }> }> {
  const client = new SmartLeadClient(SMARTLEAD_API_KEY);
  
  switch (name) {
    // Campaign tools
    case 'campaign_list': {
      const data = await client.get('/campaigns', {
        offset: args?.offset || 0,
        limit: args?.limit || 100
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
    
    case 'campaign_get': {
      if (!args?.campaignId) throw new Error('campaignId is required');
      const data = await client.get(`/campaigns/${args.campaignId}`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
    
    case 'campaign_status_update': {
      if (!args?.campaignId || !args?.status) throw new Error('campaignId and status are required');
      const endpoint = args.status === 'START' 
        ? `/campaigns/${args.campaignId}/start`
        : args.status === 'PAUSE'
        ? `/campaigns/${args.campaignId}/pause`
        : args.status === 'STOP'
        ? `/campaigns/${args.campaignId}/stop`
        : `/campaigns/${args.campaignId}/resume`;
      
      const data = await client.post(endpoint);
      return {
        content: [{
          type: "text",
          text: `Campaign ${args.campaignId} status updated to ${args.status}. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }
    
    // Lead tools
    case 'lead_list_by_campaign': {
      if (!args?.campaignId) throw new Error('campaignId is required');
      const data = await client.get(`/campaigns/${args.campaignId}/leads`, {
        offset: args?.offset || 0,
        limit: args?.limit || 100
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
    
    case 'lead_search_by_email': {
      if (!args?.email) throw new Error('email is required');
      const data = await client.get('/leads/search', {
        email: args.email
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
    
    case 'lead_update_category': {
      if (!args?.email || !args?.campaignId || !args?.leadCategory) {
        throw new Error('email, campaignId, and leadCategory are required');
      }
      const data = await client.post('/leads/category/update', {
        email: args.email,
        campaignId: args.campaignId,
        leadCategory: args.leadCategory
      });
      return {
        content: [{
          type: "text",
          text: `Lead category updated successfully. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }
    
    case 'lead_add_to_blocklist': {
      if (!args?.emails || !Array.isArray(args.emails)) {
        throw new Error('emails array is required');
      }
      const data = await client.post('/leads/block-list', {
        emails: args.emails
      });
      return {
        content: [{
          type: "text",
          text: `Added ${args.emails.length} email(s) to blocklist. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }
    
    // Analytics tools
    case 'analytics_campaign_overview': {
      if (!args?.campaignId) throw new Error('campaignId is required');
      const data = await client.get(`/campaigns/${args.campaignId}/analytics`);
      
      const sentCount = data.sent_count || 0;
      const openCount = data.open_count || 0;
      const replyCount = data.reply_count || 0;
      const clickCount = data.click_count || 0;
      
      const enhanced = {
        ...data,
        calculated_metrics: {
          open_rate: sentCount > 0 ? `${(openCount / sentCount * 100).toFixed(2)}%` : '0%',
          reply_rate: sentCount > 0 ? `${(replyCount / sentCount * 100).toFixed(2)}%` : '0%',
          click_rate: sentCount > 0 ? `${(clickCount / sentCount * 100).toFixed(2)}%` : '0%'
        }
      };
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(enhanced, null, 2)
        }]
      };
    }
    
    case 'analytics_campaign_by_date': {
      if (!args?.campaignId || !args?.startDate || !args?.endDate) {
        throw new Error('campaignId, startDate, and endDate are required');
      }
      const data = await client.get(`/campaigns/${args.campaignId}/analytics-by-date`, {
        start_date: args.startDate,
        end_date: args.endDate
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
    
    case 'analytics_sequence_performance': {
      if (!args?.campaignId) throw new Error('campaignId is required');
      const data = await client.get(`/campaigns/${args.campaignId}/sequence-analytics`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
    
    // Reply tools
    case 'reply_get_all': {
      if (!args?.campaignId) throw new Error('campaignId is required');
      const data = await client.get(`/campaigns/${args.campaignId}/leads`, {
        offset: args?.offset || 0,
        limit: args?.limit || 100,
        lead_status: 'REPLIED'
      });
      
      const replies = data.data?.filter((lead: any) => lead.last_reply) || [];
      const formattedReplies = replies.map((lead: any) => ({
        lead_email: lead.email,
        lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
        company: lead.company_name,
        reply_date: lead.last_reply_time,
        reply_content: lead.last_reply,
        lead_category: lead.lead_category,
        lead_id: lead.id
      }));
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify({
            total_replies: data.total_replied || replies.length,
            replies: formattedReplies
          }, null, 2)
        }]
      };
    }
    
    case 'reply_get_message_history': {
      if (!args?.campaignId || !args?.leadId) {
        throw new Error('campaignId and leadId are required');
      }
      const data = await client.get(`/campaigns/${args.campaignId}/leads/${args.leadId}/message-history`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
    
    case 'reply_send': {
      if (!args?.campaignId || !args?.leadId || !args?.message) {
        throw new Error('campaignId, leadId, and message are required');
      }
      const data = await client.post(`/campaigns/${args.campaignId}/leads/${args.leadId}/reply`, {
        message: args.message
      });
      return {
        content: [{
          type: "text",
          text: `Reply sent successfully. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }
    
    // Webhook tools
    case 'webhook_create': {
      if (!args?.url || !args?.events || !Array.isArray(args.events)) {
        throw new Error('url and events array are required');
      }
      const data = await client.post('/webhooks', {
        url: args.url,
        events: args.events,
        campaignId: args.campaignId
      });
      return {
        content: [{
          type: "text",
          text: `Webhook created successfully. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }
    
    case 'webhook_list': {
      const data = await client.get('/webhooks');
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }
    
    case 'webhook_delete': {
      if (!args?.webhookId) throw new Error('webhookId is required');
      const data = await client.delete(`/webhooks/${args.webhookId}`);
      return {
        content: [{
          type: "text",
          text: `Webhook deleted successfully. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }
    
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

// Create Express app
const app = express();
app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'healthy', service: 'smartlead-mcp-server' });
});

// Main SSE endpoint for MCP
app.get('/', async (req, res) => {
  // Check if this is an SSE request
  if (req.headers.accept === 'text/event-stream') {
    console.log('[SSE] New connection request');
    
    // Create MCP server
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

    // Set up handlers
    server.setRequestHandler(ListToolsRequestSchema, async () => {
      console.log(`[MCP] Listing ${ALL_TOOLS.length} tools`);
      return { tools: ALL_TOOLS };
    });

    server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;
      console.log(`[MCP] Executing tool: ${name}`);

      try {
        const result = await handleToolCall(name, args);
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

    // Create SSE transport
    const transport = new SSEServerTransport(req, res);
    
    // Connect server to transport
    await server.connect(transport);
    console.log('[MCP] Server connected via SSE');
    
    // Handle connection close
    req.on('close', () => {
      console.log('[SSE] Client disconnected');
    });
  } else {
    // Regular HTTP request - return server info
    res.json({
      name: 'smartlead-mcp-server',
      version: '1.0.0',
      description: 'Enhanced SmartLead MCP Server with Analytics and Webhooks',
      mcp: {
        endpoint: '/',
        transport: 'sse'
      }
    });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`SmartLead MCP Server running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  console.log(`MCP SSE endpoint: http://localhost:${PORT}/`);
});
