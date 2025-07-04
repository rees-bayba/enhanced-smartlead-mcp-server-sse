#!/usr/bin/env node
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import axios from 'axios';
import { Buffer } from 'buffer';

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

  private async request(endpoint: string, method: string = 'GET', data?: any, responseType: any = 'json') {
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
        responseType,
      });
      return response.data;
    } catch (error: any) {
      // Enhanced error reporting for debugging
      const errorDetails = {
        endpoint,
        method,
        url,
        params: method === 'GET' ? { ...data, api_key: '[REDACTED]' } : { api_key: '[REDACTED]' },
        status: error.response?.status,
        statusText: error.response?.statusText,
        responseData: error.response?.data,
        message: error.message
      };
      
      // Surface all error codes/messages
      if (error.response) {
        throw new Error(JSON.stringify(error.response.data));
      }
      throw new Error('SmartLead API error: ' + error.message);
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
    // Allow arbitrary custom fields
    return this.request('/campaigns/create', 'POST', data);
  }

  async updateCampaign(campaignId: string, data: any) {
    // Allow arbitrary custom fields
    return this.request(`/campaigns/${campaignId}`, 'PUT', data);
  }

  async deleteCampaign(campaignId: string) {
    return this.request(`/campaigns/${campaignId}`, 'DELETE');
  }

  async getCampaignSchedules(campaignId: string) {
    return this.request(`/campaigns/${campaignId}/schedules`);
  }

  async updateCampaignSchedule(campaignId: string, data: any) {
    return this.request(`/campaigns/${campaignId}/schedule`, 'POST', data);
  }

  async updateCampaignSettings(campaignId: string, data: any) {
    return this.request(`/campaigns/${campaignId}/settings`, 'POST', data);
  }

  async updateCampaignStatus(campaignId: string, status: string) {
    return this.request(`/campaigns/${campaignId}/status`, 'POST', { status });
  }

  async getCampaignSequence(campaignId: string) {
    return this.request(`/campaigns/${campaignId}/sequences`);
  }

  async saveCampaignSequence(campaignId: string, sequences: any[]) {
    // Allow arbitrary custom fields in sequences
    return this.request(`/campaigns/${campaignId}/sequences`, 'POST', { sequences });
  }

  async getCampaignsByLead(leadId: string) {
    return this.request(`/leads/${leadId}/campaigns`);
  }

  async exportCampaignData(campaignId: string, asCsv: boolean = false) {
    // Support CSV/raw export
    if (asCsv) {
      return this.request(`/campaigns/${campaignId}/leads-export`, 'GET', undefined, 'arraybuffer');
    }
    return this.request(`/campaigns/${campaignId}/leads-export`);
  }

  async getCampaignAnalyticsByDate(campaignId: string, startDate: string, endDate: string) {
    return this.request(`/campaigns/${campaignId}/analytics-by-date`, 'GET', {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async getCampaignStatistics(campaignId: string, params?: any) {
    // Support all optional query params
    const { campaign_id, ...cleanParams } = params || {};
    return this.request(`/campaigns/${campaignId}/statistics`, 'GET', cleanParams);
  }

  // Lead endpoints
  async addLeadsToCampaign(campaignId: string, leads: any[], settings?: any) {
    // Allow arbitrary custom fields in leads
    const payload: any = { lead_list: leads };
    if (settings) payload.settings = settings;
    return this.request(`/campaigns/${campaignId}/leads`, 'POST', payload);
  }

  async getLeadsFromCampaign(campaignId: string, offset: number = 0, limit: number = 100) {
    return this.request(`/campaigns/${campaignId}/leads`, 'GET', { offset, limit });
  }

  async updateLead(campaignId: string, leadId: string, data: any) {
    // Allow arbitrary custom fields
    return this.request(`/campaigns/${campaignId}/leads/${leadId}`, 'POST', data);
  }

  async deleteLead(campaignId: string, leadId: string) {
    return this.request(`/campaigns/${campaignId}/leads/${leadId}`, 'DELETE');
  }

  async getLeadByEmail(email: string) {
    return this.request('/leads', 'GET', { email });
  }

  async getLeadCategories() {
    return this.request('/leads/fetch-categories');
  }

  async updateLeadCategory(campaignId: string, leadId: string, categoryId: string, pauseLead: boolean = false) {
    return this.request(`/campaigns/${campaignId}/leads/${leadId}/category`, 'POST', {
      category_id: categoryId,
      pause_lead: pauseLead,
    });
  }

  async pauseLead(campaignId: string, leadId: string) {
    return this.request(`/campaigns/${campaignId}/leads/${leadId}/pause`, 'POST');
  }

  async resumeLead(campaignId: string, leadId: string, delayDays?: number) {
    return this.request(`/campaigns/${campaignId}/leads/${leadId}/resume`, 'POST', 
      { resume_lead_with_delay_days: delayDays || 0 });
  }

  async unsubscribeLeadFromCampaign(campaignId: string, leadId: string) {
    return this.request(`/campaigns/${campaignId}/leads/${leadId}/unsubscribe`, 'POST');
  }

  async unsubscribeLeadGlobal(leadId: string) {
    return this.request(`/leads/${leadId}/unsubscribe`, 'POST');
  }

  async getAllLeads(offset: number = 0, limit: number = 100) {
    return this.request('/leads/all', 'GET', { offset, limit });
  }

  async getBlocklist(offset: number = 0, limit: number = 100) {
    return this.request('/leads/global-block-list', 'GET', { offset, limit });
  }

  async addToBlocklist(domains: string[], clientId?: string) {
    return this.request('/leads/add-domain-block-list', 'POST', {
      domain_block_list: domains,
      client_id: clientId || null,
    });
  }

  async getMessageHistory(campaignId: string, leadId: string) {
    return this.request(`/campaigns/${campaignId}/leads/${leadId}/message-history`);
  }

  async replyToLead(campaignId: string, data: any) {
    return this.request(`/campaigns/${campaignId}/reply-email-thread`, 'POST', data);
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

  // Email account endpoints
  async getEmailAccounts(offset: number = 0, limit: number = 100) {
    return this.request('/email-accounts', 'GET', { offset, limit });
  }

  async getEmailAccount(accountId: string) {
    return this.request(`/email-accounts/${accountId}`);
  }

  async createEmailAccount(data: any) {
    return this.request('/email-accounts/save', 'POST', data);
  }

  async updateEmailAccount(accountId: string, data: any) {
    return this.request(`/email-accounts/${accountId}`, 'POST', data);
  }

  async getCampaignEmailAccounts(campaignId: string) {
    return this.request(`/campaigns/${campaignId}/email-accounts`);
  }

  async addEmailAccountToCampaign(campaignId: string, emailAccountIds: number[]) {
    return this.request(`/campaigns/${campaignId}/email-accounts`, 'POST', { email_account_ids: emailAccountIds });
  }

  async removeEmailAccountFromCampaign(campaignId: string, emailAccountIds: number[]) {
    return this.request(`/campaigns/${campaignId}/email-accounts`, 'DELETE', { email_account_ids: emailAccountIds });
  }

  async updateWarmup(accountId: string, settings: any) {
    return this.request(`/email-accounts/${accountId}/warmup`, 'POST', settings);
  }

  async getWarmupStats(accountId: string) {
    return this.request(`/email-accounts/${accountId}/warmup-stats`);
  }

  async reconnectFailedAccounts() {
    return this.request('/email-accounts/reconnect-failed-email-accounts', 'POST', {});
  }

  // Webhook endpoints
  async listWebhooks(campaignId: string) {
    return this.request(`/campaigns/${campaignId}/webhooks`);
  }

  async createWebhook(campaignId: string, data: any) {
    // Support all event types and category filters
    return this.request(`/campaigns/${campaignId}/webhooks`, 'POST', data);
  }

  async deleteWebhook(campaignId: string, webhookId: string) {
    return this.request(`/campaigns/${campaignId}/webhooks`, 'DELETE', { id: webhookId });
  }

  // Client management endpoints
  async createClient(data: any) {
    return this.request('/client/save', 'POST', data);
  }

  async listClients() {
    return this.request('/client');
  }

  // Reply endpoints (backwards compatibility)
  async sendReply(data: any) {
    return this.request('/replies', 'POST', data);
  }

  async getConversations(campaignId?: string) {
    const params = campaignId ? { campaign_id: campaignId } : {};
    return this.request('/conversations', 'GET', params);
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

// Tool schemas (abbreviated for brevity, but should include all tools)
const toolSchemas = {
  list_campaigns: {
    description: 'List all campaigns',
    inputSchema: { type: 'object', properties: {} },
  },
  get_campaign: {
    description: 'Get details of a specific campaign',
    inputSchema: {
      type: 'object',
      properties: { campaign_id: { type: 'string', description: 'Campaign ID' } },
      required: ['campaign_id'],
    },
  },
  // ... (all other tools, ensure input schemas allow custom fields where needed)
  export_campaign_data: {
    description: 'Export all campaign data as CSV or JSON',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        as_csv: { type: 'boolean', description: 'Return as CSV (base64-encoded)' },
      },
      required: ['campaign_id'],
    },
  },
  // ... (continue for all endpoints)
};

// List tools handler
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: Object.entries(toolSchemas).map(([name, schema]) => ({
      name,
      description: schema.description,
      inputSchema: schema.inputSchema,
    })),
  };
});

// Tool execution handler
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const client = new SmartLeadClient(SMARTLEAD_API_KEY);
  const { name, arguments: args } = request.params;

  try {
    if (!args) throw new Error('No arguments provided');
    const params = args as any;
    let result;

    switch (name) {
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
      // ... (all other tools, ensure all tactical improvements)
      case 'export_campaign_data':
        if (params.as_csv) {
          const csvBuffer = await client.exportCampaignData(params.campaign_id, true);
          // Return as base64-encoded string
          return {
            content: [
              {
                type: 'text',
                text: Buffer.from(csvBuffer).toString('base64'),
              },
            ],
          };
        } else {
          result = await client.exportCampaignData(params.campaign_id);
        }
        break;
      // ... (continue for all endpoints)
      default:
        throw new Error(`Unknown tool: ${name}`);
    }

    // Always return all response fields
    return {
      content: [
        {
          type: 'text',
          text: typeof result === 'string' ? result : JSON.stringify(result, null, 2),
        },
      ],
    };
  } catch (error: any) {
    // Surface all error codes/messages
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
  console.error('Smartlead MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
