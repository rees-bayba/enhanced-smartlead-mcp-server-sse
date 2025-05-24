import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Smartlead API client - keeping the same structure as the working original
class SmartleadClient {
  private apiKey: string;
  private baseUrl: string;
  private retryMaxAttempts: number;
  private retryInitialDelay: number;
  private retryMaxDelay: number;
  private retryBackoffFactor: number;

  constructor(config: {
    apiKey: string;
    baseUrl?: string;
    retryMaxAttempts?: number;
    retryInitialDelay?: number;
    retryMaxDelay?: number;
    retryBackoffFactor?: number;
  }) {
    this.apiKey = config.apiKey;
    this.baseUrl = config.baseUrl || 'https://server.smartlead.ai/api/v1';
    this.retryMaxAttempts = config.retryMaxAttempts || 3;
    this.retryInitialDelay = config.retryInitialDelay || 1000;
    this.retryMaxDelay = config.retryMaxDelay || 10000;
    this.retryBackoffFactor = config.retryBackoffFactor || 2;
  }

  private async makeRequest(endpoint: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.baseUrl}${endpoint}`;
    const headers = {
      'Content-Type': 'application/json',
      'X-API-KEY': this.apiKey,
      ...options.headers,
    };

    let attempt = 0;
    let delay = this.retryInitialDelay;

    while (attempt < this.retryMaxAttempts) {
      try {
        const response = await fetch(url, {
          ...options,
          headers,
        });

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        attempt++;
        if (attempt >= this.retryMaxAttempts) {
          throw error;
        }
        
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * this.retryBackoffFactor, this.retryMaxDelay);
      }
    }
  }

  // EXISTING METHODS (from working original server)
  async createCampaign(params: { name: string; client_id?: number }) {
    return this.makeRequest('/campaigns', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async updateCampaignSchedule(params: {
    campaign_id: number;
    days_of_the_week?: number[];
    start_hour?: string;
    end_hour?: string;
    max_new_leads_per_day?: number;
    min_time_btw_emails?: number;
    timezone?: string;
    schedule_start_time?: string;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/schedule`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  }

  async updateCampaignSettings(params: {
    campaign_id: number;
    name?: string;
    status?: string;
    settings?: any;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  }

  async getCampaign(params: { campaign_id: number }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}`);
  }

  async listCampaigns(params: { limit?: number; offset?: number; status?: string } = {}) {
    const queryParams = new URLSearchParams({
      limit: (params.limit || 50).toString(),
      offset: (params.offset || 0).toString(),
    });
    
    if (params.status && params.status !== 'all') {
      queryParams.append('status', params.status);
    }

    return this.makeRequest(`/campaigns?${queryParams}`);
  }

  async saveCampaignSequence(params: {
    campaign_id: number;
    sequences: any[];
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/sequences`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async getCampaignSequence(params: { campaign_id: number }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/sequences`);
  }

  async updateCampaignSequence(params: {
    campaign_id: number;
    sequence_id: number;
    subject?: string;
    body?: string;
    wait_days?: number;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/sequences/${params.sequence_id}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  }

  async deleteCampaignSequence(params: {
    campaign_id: number;
    sequence_id: number;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/sequences/${params.sequence_id}`, {
      method: 'DELETE',
    });
  }

  async addEmailAccountToCampaign(params: {
    campaign_id: number;
    email_account_id: number;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/email-accounts`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async updateEmailAccountInCampaign(params: {
    campaign_id: number;
    email_account_id: number;
    settings?: any;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/email-accounts/${params.email_account_id}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  }

  async deleteEmailAccountFromCampaign(params: {
    campaign_id: number;
    email_account_id: number;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/email-accounts/${params.email_account_id}`, {
      method: 'DELETE',
    });
  }

  async addLeadToCampaign(params: {
    campaign_id: number;
    lead_list: any[];
    settings?: any;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/leads`, {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async updateLeadInCampaign(params: {
    campaign_id: number;
    lead_id: number;
    lead: any;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/leads/${params.lead_id}`, {
      method: 'PUT',
      body: JSON.stringify(params),
    });
  }

  async deleteLeadFromCampaign(params: {
    campaign_id: number;
    lead_id: number;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/leads/${params.lead_id}`, {
      method: 'DELETE',
    });
  }

  // NEW ENHANCED METHODS (adding the missing analytics)
  async listLeadsByCampaign(params: {
    campaign_id: number;
    offset?: number;
    limit?: number;
    status_filter?: string;
  }) {
    const queryParams = new URLSearchParams({
      offset: (params.offset || 0).toString(),
      limit: (params.limit || 50).toString(),
    });
    
    if (params.status_filter) {
      queryParams.append('status_filter', params.status_filter);
    }

    return this.makeRequest(`/campaigns/${params.campaign_id}/leads?${queryParams}`);
  }

  async getCampaignStatistics(params: {
    campaign_id: number;
    email_sequence_number?: number;
    email_status?: string;
    offset?: number;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams({
      offset: (params.offset || 0).toString(),
      limit: (params.limit || 50).toString(),
    });
    
    if (params.email_sequence_number) {
      queryParams.append('email_sequence_number', params.email_sequence_number.toString());
    }
    if (params.email_status) {
      queryParams.append('email_status', params.email_status);
    }

    return this.makeRequest(`/campaigns/${params.campaign_id}/statistics?${queryParams}`);
  }

  async getLeadMessageHistory(params: {
    campaign_id: number;
    lead_id: number;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/leads/${params.lead_id}/messages`);
  }

  async getCampaignAnalytics(params: {
    campaign_id: number;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/analytics`);
  }

  async getCampaignAnalyticsByDate(params: {
    campaign_id: number;
    start_date: string;
    end_date: string;
  }) {
    const queryParams = new URLSearchParams({
      start_date: params.start_date,
      end_date: params.end_date,
    });

    return this.makeRequest(`/campaigns/${params.campaign_id}/analytics-by-date?${queryParams}`);
  }

  async searchLeadsByEmail(params: {
    email: string;
  }) {
    const queryParams = new URLSearchParams({
      email: params.email,
    });

    return this.makeRequest(`/leads/search?${queryParams}`);
  }
}

// Server setup - FIXED: Single argument to Server constructor
const server = new Server({
  name: 'enhanced-smartlead-server',
  version: '1.1.0',
  capabilities: {
    tools: {},
  },
});

const smartlead = new SmartleadClient({
  apiKey: process.env.SMARTLEAD_API_KEY!,
  baseUrl: process.env.SMARTLEAD_API_URL,
  retryMaxAttempts: parseInt(process.env.SMARTLEAD_RETRY_MAX_ATTEMPTS || '3'),
  retryInitialDelay: parseInt(process.env.SMARTLEAD_RETRY_INITIAL_DELAY || '1000'),
  retryMaxDelay: parseInt(process.env.SMARTLEAD_RETRY_MAX_DELAY || '10000'),
  retryBackoffFactor: parseFloat(process.env.SMARTLEAD_RETRY_BACKOFF_FACTOR || '2'),
});

// Tools - all existing ones PLUS the missing analytics
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      // EXISTING TOOLS (from working original)
      {
        name: 'smartlead_create_campaign',
        description: 'Create a new campaign in Smartlead.',
        inputSchema: {
          type: 'object',
          properties: {
            name: { type: 'string', description: 'Name of the campaign' },
            client_id: { type: 'number', description: 'Client ID for the campaign' },
          },
          required: ['name'],
        },
      },
      {
        name: 'smartlead_update_campaign_schedule',
        description: 'Update a campaign\'s schedule settings.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign to update' },
            days_of_the_week: { type: 'array', items: { type: 'number' }, description: 'Days of the week to send emails (1-7, where 1 is Monday)' },
            start_hour: { type: 'string', description: 'Start hour in 24-hour format (e.g., "09:00")' },
            end_hour: { type: 'string', description: 'End hour in 24-hour format (e.g., "17:00")' },
            max_new_leads_per_day: { type: 'number', description: 'Maximum number of new leads per day' },
            min_time_btw_emails: { type: 'number', description: 'Minimum time between emails in minutes' },
            timezone: { type: 'string', description: 'Timezone for the campaign (e.g., "America/Los_Angeles")' },
            schedule_start_time: { type: 'string', description: 'Schedule start time in ISO format' },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_update_campaign_settings',
        description: 'Update a campaign\'s general settings.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign to update' },
            name: { type: 'string', description: 'New name for the campaign' },
            status: { type: 'string', enum: ['active', 'paused', 'completed'], description: 'Status of the campaign' },
            settings: { type: 'object', description: 'Additional campaign settings' },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_get_campaign',
        description: 'Get details of a specific campaign by ID.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign to retrieve' },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_list_campaigns',
        description: 'List all campaigns with optional filtering.',
        inputSchema: {
          type: 'object',
          properties: {
            limit: { type: 'number', description: 'Maximum number of campaigns to return' },
            offset: { type: 'number', description: 'Offset for pagination' },
            status: { type: 'string', enum: ['active', 'paused', 'completed', 'all'], description: 'Filter campaigns by status' },
          },
        },
      },
      {
        name: 'smartlead_save_campaign_sequence',
        description: 'Save a sequence of emails for a campaign with A/B testing variants.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            sequences: { 
              type: 'array', 
              description: 'Array of email sequences to send',
              items: { type: 'object' }
            },
          },
          required: ['campaign_id', 'sequences'],
        },
      },
      {
        name: 'smartlead_get_campaign_sequence',
        description: 'Get the sequence of emails for a campaign.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_update_campaign_sequence',
        description: 'Update a specific email in a campaign sequence.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            sequence_id: { type: 'number', description: 'ID of the sequence email to update' },
            subject: { type: 'string', description: 'Updated email subject line' },
            body: { type: 'string', description: 'Updated email body content' },
            wait_days: { type: 'number', description: 'Updated days to wait before sending this email' },
          },
          required: ['campaign_id', 'sequence_id'],
        },
      },
      {
        name: 'smartlead_delete_campaign_sequence',
        description: 'Delete a specific email from a campaign sequence.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            sequence_id: { type: 'number', description: 'ID of the sequence email to delete' },
          },
          required: ['campaign_id', 'sequence_id'],
        },
      },
      {
        name: 'smartlead_add_email_account_to_campaign',
        description: 'Add an email account to a campaign.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            email_account_id: { type: 'number', description: 'ID of the email account to add' },
          },
          required: ['campaign_id', 'email_account_id'],
        },
      },
      {
        name: 'smartlead_update_email_account_in_campaign',
        description: 'Update an email account in a campaign.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            email_account_id: { type: 'number', description: 'ID of the email account to update' },
            settings: { type: 'object', description: 'Settings for the email account in this campaign' },
          },
          required: ['campaign_id', 'email_account_id'],
        },
      },
      {
        name: 'smartlead_delete_email_account_from_campaign',
        description: 'Remove an email account from a campaign.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            email_account_id: { type: 'number', description: 'ID of the email account to remove' },
          },
          required: ['campaign_id', 'email_account_id'],
        },
      },
      {
        name: 'smartlead_add_lead_to_campaign',
        description: 'Add leads to a campaign (up to 100 leads at once).',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            lead_list: { 
              type: 'array', 
              description: 'List of leads to add (max 100)',
              items: { type: 'object' }
            },
            settings: { type: 'object', description: 'Settings for lead addition' },
          },
          required: ['campaign_id', 'lead_list'],
        },
      },
      {
        name: 'smartlead_update_lead_in_campaign',
        description: 'Update a lead in a campaign.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            lead_id: { type: 'number', description: 'ID of the lead to update' },
            lead: { type: 'object', description: 'Updated lead information' },
          },
          required: ['campaign_id', 'lead_id', 'lead'],
        },
      },
      {
        name: 'smartlead_delete_lead_from_campaign',
        description: 'Remove a lead from a campaign.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            lead_id: { type: 'number', description: 'ID of the lead to remove' },
          },
          required: ['campaign_id', 'lead_id'],
        },
      },

      // NEW ENHANCED ANALYTICS TOOLS
      {
        name: 'smartlead_list_leads_by_campaign',
        description: 'List all leads in a campaign with their current status and sequence position.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            offset: { type: 'number', description: 'Offset for pagination' },
            limit: { type: 'number', description: 'Maximum number of leads to return' },
            status_filter: { type: 'string', description: 'Filter leads by status (STARTED, COMPLETED, BLOCKED, INPROGRESS)' },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_get_campaign_statistics',
        description: 'Get detailed campaign performance metrics filterable by sequence number to see which steps get replies.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            email_sequence_number: { type: 'number', description: 'Filter by specific sequence number' },
            email_status: { type: 'string', description: 'Filter by email status' },
            offset: { type: 'number', description: 'Offset for pagination' },
            limit: { type: 'number', description: 'Maximum number of results to return' },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_get_lead_message_history',
        description: 'Get individual lead\'s complete email interaction history to map replies to specific sequence steps.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            lead_id: { type: 'number', description: 'ID of the lead' },
          },
          required: ['campaign_id', 'lead_id'],
        },
      },
      {
        name: 'smartlead_get_campaign_analytics',
        description: 'Get comprehensive campaign analytics including sequence performance.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_get_campaign_analytics_by_date',
        description: 'Get campaign analytics for a specific date range to track performance trends.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            start_date: { type: 'string', description: 'Start date (YYYY-MM-DD format)' },
            end_date: { type: 'string', description: 'End date (YYYY-MM-DD format)' },
          },
          required: ['campaign_id', 'start_date', 'end_date'],
        },
      },
      {
        name: 'smartlead_search_leads_by_email',
        description: 'Search for leads by email address across all campaigns.',
        inputSchema: {
          type: 'object',
          properties: {
            email: { type: 'string', description: 'Email address to search for' },
          },
          required: ['email'],
        },
      },
    ],
  };
});

// Tool handlers - all existing ones PLUS the new analytics
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      // EXISTING TOOL HANDLERS (from working original)
      case 'smartlead_create_campaign':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.createCampaign(args as any), null, 2) }],
        };
      case 'smartlead_update_campaign_schedule':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.updateCampaignSchedule(args as any), null, 2) }],
        };
      case 'smartlead_update_campaign_settings':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.updateCampaignSettings(args as any), null, 2) }],
        };
      case 'smartlead_get_campaign':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.getCampaign(args as any), null, 2) }],
        };
      case 'smartlead_list_campaigns':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.listCampaigns(args as any), null, 2) }],
        };
      case 'smartlead_save_campaign_sequence':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.saveCampaignSequence(args as any), null, 2) }],
        };
      case 'smartlead_get_campaign_sequence':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.getCampaignSequence(args as any), null, 2) }],
        };
      case 'smartlead_update_campaign_sequence':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.updateCampaignSequence(args as any), null, 2) }],
        };
      case 'smartlead_delete_campaign_sequence':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.deleteCampaignSequence(args as any), null, 2) }],
        };
      case 'smartlead_add_email_account_to_campaign':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.addEmailAccountToCampaign(args as any), null, 2) }],
        };
      case 'smartlead_update_email_account_in_campaign':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.updateEmailAccountInCampaign(args as any), null, 2) }],
        };
      case 'smartlead_delete_email_account_from_campaign':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.deleteEmailAccountFromCampaign(args as any), null, 2) }],
        };
      case 'smartlead_add_lead_to_campaign':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.addLeadToCampaign(args as any), null, 2) }],
        };
      case 'smartlead_update_lead_in_campaign':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.updateLeadInCampaign(args as any), null, 2) }],
        };
      case 'smartlead_delete_lead_from_campaign':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.deleteLeadFromCampaign(args as any), null, 2) }],
        };

      // NEW ENHANCED ANALYTICS HANDLERS
      case 'smartlead_list_leads_by_campaign':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.listLeadsByCampaign(args as any), null, 2) }],
        };
      case 'smartlead_get_campaign_statistics':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.getCampaignStatistics(args as any), null, 2) }],
        };
      case 'smartlead_get_lead_message_history':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.getLeadMessageHistory(args as any), null, 2) }],
        };
      case 'smartlead_get_campaign_analytics':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.getCampaignAnalytics(args as any), null, 2) }],
        };
      case 'smartlead_get_campaign_analytics_by_date':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.getCampaignAnalyticsByDate(args as any), null, 2) }],
        };
      case 'smartlead_search_leads_by_email':
        return {
          content: [{ type: 'text', text: JSON.stringify(await smartlead.searchLeadsByEmail(args as any), null, 2) }],
        };

      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    throw new McpError(
      ErrorCode.InternalError,
      `Smartlead API error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
});

// Start server - same as working original
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Enhanced Smartlead MCP server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
