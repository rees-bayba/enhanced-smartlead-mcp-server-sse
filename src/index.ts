#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';

// Validate and get API key
function getApiKey(): string {
  const apiKey = process.env.SMARTLEAD_API_KEY;
  if (!apiKey) {
    console.error('SMARTLEAD_API_KEY environment variable is required');
    process.exit(1);
  }
  return apiKey;
}

// Get the API key once
const SMARTLEAD_API_KEY = getApiKey();

// SmartLead API Client
class SmartLeadClient {
  private apiKey: string;
  private baseUrl = 'https://server.smartlead.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async request(endpoint: string, method: string = 'GET', data?: any) {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
    };

    try {
      const response = await axios({
        method,
        url,
        headers,
        params: method === 'GET' ? { ...data, api_key: this.apiKey } : { api_key: this.apiKey },
        data: method !== 'GET' ? data : undefined,
      });
      return response.data;
    } catch (error: any) {
      throw new Error(`SmartLead API error: ${error.response?.data?.message || error.message}`);
    }
  }

  // Campaign endpoints
  async listCampaigns() {
    return this.request('/campaigns');
  }

  async getCampaign(campaignId: string) {
    return this.request(`/campaigns/${campaignId}`);
  }

  async createCampaign(data: any) {
    return this.request('/campaigns', 'POST', data);
  }

  async updateCampaign(campaignId: string, data: any) {
    return this.request(`/campaigns/${campaignId}`, 'PUT', data);
  }

  async deleteCampaign(campaignId: string) {
    return this.request(`/campaigns/${campaignId}`, 'DELETE');
  }

  async getCampaignSchedules(campaignId: string) {
    return this.request(`/campaigns/${campaignId}/schedules`);
  }

  // Lead endpoints
  async addLeadsToCampaign(campaignId: string, leads: any[]) {
    return this.request(`/campaigns/${campaignId}/leads`, 'POST', { leads });
  }

  async getLeadsFromCampaign(campaignId: string, offset: number = 0, limit: number = 100) {
    return this.request(`/campaigns/${campaignId}/leads`, 'GET', { offset, limit });
  }

  async updateLead(campaignId: string, email: string, data: any) {
    return this.request(`/campaigns/${campaignId}/leads/${email}`, 'PUT', data);
  }

  async deleteLead(campaignId: string, email: string) {
    return this.request(`/campaigns/${campaignId}/leads/${email}`, 'DELETE');
  }

  // Analytics endpoints
  async getCampaignAnalytics(campaignId: string) {
    return this.request(`/campaigns/${campaignId}/analytics`);
  }

  async getEmailAccountAnalytics() {
    return this.request('/analytics/email-accounts');
  }

  async getMasterInboxStats() {
    return this.request('/analytics/master-inbox');
  }

  // Reply endpoints
  async sendReply(data: any) {
    return this.request('/replies', 'POST', data);
  }

  async getConversations(campaignId?: string) {
    const params = campaignId ? { campaign_id: campaignId } : {};
    return this.request('/conversations', 'GET', params);
  }

  // Webhook endpoints
  async listWebhooks() {
    return this.request('/webhooks');
  }

  async createWebhook(data: any) {
    return this.request('/webhooks', 'POST', data);
  }

  async deleteWebhook(webhookId: string) {
    return this.request(`/webhooks/${webhookId}`, 'DELETE');
  }
}

// Create server with proper name
const server = new Server(
  {
    name: 'smartlead-mcp',
    version: '1.0.0',
  },
  {
    capabilities: {
      tools: {},
      logging: {},
    },
  }
);

// Define tool schemas
const toolSchemas = {
  // Campaign tools
  list_campaigns: {
    description: 'List all campaigns',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  get_campaign: {
    description: 'Get details of a specific campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['campaign_id'],
    },
  },
  create_campaign: {
    description: 'Create a new campaign',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Campaign name' },
        from_name: { type: 'string', description: 'Sender name' },
        from_email: { type: 'string', description: 'Sender email' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (HTML)' },
        schedule: { type: 'object', description: 'Campaign schedule settings' },
      },
      required: ['name', 'from_name', 'from_email', 'subject', 'body'],
    },
  },
  update_campaign: {
    description: 'Update an existing campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        name: { type: 'string', description: 'Campaign name' },
        from_name: { type: 'string', description: 'Sender name' },
        from_email: { type: 'string', description: 'Sender email' },
        subject: { type: 'string', description: 'Email subject' },
        body: { type: 'string', description: 'Email body (HTML)' },
      },
      required: ['campaign_id'],
    },
  },
  delete_campaign: {
    description: 'Delete a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['campaign_id'],
    },
  },
  get_campaign_schedules: {
    description: 'Get campaign schedules',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['campaign_id'],
    },
  },
  // Lead tools
  add_leads_to_campaign: {
    description: 'Add leads to a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        leads: {
          type: 'array',
          description: 'Array of lead objects',
          items: {
            type: 'object',
            properties: {
              email: { type: 'string' },
              first_name: { type: 'string' },
              last_name: { type: 'string' },
              company: { type: 'string' },
              custom_fields: { type: 'object' },
            },
            required: ['email'],
          },
        },
      },
      required: ['campaign_id', 'leads'],
    },
  },
  get_leads_from_campaign: {
    description: 'Get leads from a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        offset: { type: 'number', description: 'Offset for pagination' },
        limit: { type: 'number', description: 'Number of leads to retrieve' },
      },
      required: ['campaign_id'],
    },
  },
  update_lead: {
    description: 'Update a lead in a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        email: { type: 'string', description: 'Lead email' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        company: { type: 'string' },
        custom_fields: { type: 'object' },
      },
      required: ['campaign_id', 'email'],
    },
  },
  delete_lead: {
    description: 'Delete a lead from a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        email: { type: 'string', description: 'Lead email' },
      },
      required: ['campaign_id', 'email'],
    },
  },
  // Analytics tools
  get_campaign_analytics: {
    description: 'Get analytics for a specific campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['campaign_id'],
    },
  },
  get_email_account_analytics: {
    description: 'Get analytics for all email accounts',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  get_master_inbox_stats: {
    description: 'Get master inbox statistics',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // Reply tools
  send_reply: {
    description: 'Send a reply to a lead',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        lead_email: { type: 'string', description: 'Lead email' },
        message: { type: 'string', description: 'Reply message' },
      },
      required: ['campaign_id', 'lead_email', 'message'],
    },
  },
  get_conversations: {
    description: 'Get conversations, optionally filtered by campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID (optional)' },
      },
    },
  },
  // Webhook tools
  list_webhooks: {
    description: 'List all webhooks',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  create_webhook: {
    description: 'Create a new webhook',
    inputSchema: {
      type: 'object',
      properties: {
        url: { type: 'string', description: 'Webhook URL' },
        events: {
          type: 'array',
          description: 'Events to subscribe to',
          items: { type: 'string' },
        },
      },
      required: ['url', 'events'],
    },
  },
  delete_webhook: {
    description: 'Delete a webhook',
    inputSchema: {
      type: 'object',
      properties: {
        webhook_id: { type: 'string', description: 'Webhook ID' },
      },
      required: ['webhook_id'],
    },
  },
} as const;

// Handle list tools request
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.entries(toolSchemas).map(([name, schema]) => ({
      name,
      description: schema.description,
      inputSchema: schema.inputSchema,
    })),
  };
});

// Handle tool execution
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const client = new SmartLeadClient(SMARTLEAD_API_KEY);
  const { name, arguments: args } = request.params;

  try {
    let result;
    
    // Type guard to ensure args is defined
    if (!args) {
      throw new Error('No arguments provided');
    }
    
    // Cast args to any to bypass TypeScript strict checking
    const params = args as any;
    
    switch (name) {
      // Campaign tools
      case 'list_campaigns':
        result = await client.listCampaigns();
        break;
      case 'get_campaign':
        result = await client.getCampaign(params.campaign_id);
        break;
      case 'create_campaign':
        result = await client.createCampaign(params);
        break;
      case 'update_campaign':
        result = await client.updateCampaign(params.campaign_id, params);
        break;
      case 'delete_campaign':
        result = await client.deleteCampaign(params.campaign_id);
        break;
      case 'get_campaign_schedules':
        result = await client.getCampaignSchedules(params.campaign_id);
        break;
      
      // Lead tools
      case 'add_leads_to_campaign':
        result = await client.addLeadsToCampaign(params.campaign_id, params.leads);
        break;
      case 'get_leads_from_campaign':
        result = await client.getLeadsFromCampaign(params.campaign_id, params.offset, params.limit);
        break;
      case 'update_lead':
        result = await client.updateLead(params.campaign_id, params.email, params);
        break;
      case 'delete_lead':
        result = await client.deleteLead(params.campaign_id, params.email);
        break;
      
      // Analytics tools
      case 'get_campaign_analytics':
        result = await client.getCampaignAnalytics(params.campaign_id);
        break;
      case 'get_email_account_analytics':
        result = await client.getEmailAccountAnalytics();
        break;
      case 'get_master_inbox_stats':
        result = await client.getMasterInboxStats();
        break;
      
      // Reply tools
      case 'send_reply':
        result = await client.sendReply(params);
        break;
      case 'get_conversations':
        result = await client.getConversations(params.campaign_id);
        break;
      
      // Webhook tools
      case 'list_webhooks':
        result = await client.listWebhooks();
        break;
      case 'create_webhook':
        result = await client.createWebhook(params);
        break;
      case 'delete_webhook':
        result = await client.deleteWebhook(params.webhook_id);
        break;
      
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [
        {
          type: 'text',
          text: `Error: ${error.message}`,
        },
      ],
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('SmartLead MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
