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
    // Add API key as query parameter, not header (as per Smartlead docs)
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${this.baseUrl}${endpoint}${separator}api_key=${this.apiKey}`;
    
    const headers = {
      'Content-Type': 'application/json',
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
          // Attempt to get error message from Smartlead response body
          let errorBody = '';
          try {
            errorBody = await response.text(); // Use text() first, as it might not be JSON
          } catch (e) {
            // Ignore if can't read body
          }
          throw new Error(`HTTP ${response.status}: ${response.statusText}. Response: ${errorBody}`);
        }

        // Handle cases where response might be empty but still OK (e.g., 204 No Content for DELETE)
        if (response.status === 204) {
            return { success: true, status: 204, message: "Operation successful, no content returned." };
        }
        
        const responseText = await response.text();
        if (!responseText) {
            return { success: true, status: response.status, message: "Operation successful, empty response body." };
        }

        return JSON.parse(responseText);

      } catch (error) {
        attempt++;
        if (attempt >= this.retryMaxAttempts) {
          console.error(`Final attempt failed for ${url}:`, error);
          throw error;
        }
        
        console.warn(`Attempt ${attempt} failed for ${url}. Retrying in ${delay}ms... Error: ${error}`);
        await new Promise(resolve => setTimeout(resolve, delay));
        delay = Math.min(delay * this.retryBackoffFactor, this.retryMaxDelay);
      }
    }
    // Should not be reached if retryMaxAttempts > 0 due to throw in catch,
    // but as a fallback for an exhaustive retry scenario.
    throw new Error(`Exhausted retry attempts for ${endpoint}`);
  }

  // EXISTING METHODS (from working original server, with endpoint corrections)
  async createCampaign(params: { name: string; client_id?: number }) {
    return this.makeRequest('/campaigns/create', {
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
    // Smartlead API docs suggest PUT for updates, but some operations might be POST
    // Assuming POST based on common patterns if PUT not specified for /schedule
    return this.makeRequest(`/campaigns/${params.campaign_id}/schedule`, {
      method: 'POST', // Verify this HTTP method with Smartlead docs for /schedule
      body: JSON.stringify(params),
    });
  }

  async updateCampaignSettings(params: {
    campaign_id: number;
    name?: string;
    status?: string;
    settings?: any;
  }) {
    // Corrected based on history: uses /settings sub-endpoint
    return this.makeRequest(`/campaigns/${params.campaign_id}/settings`, {
      method: 'POST', // Verify this HTTP method. Often updates are PUT or PATCH.
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

  async updateLeadInCampaign(params: { // Note: Smartlead docs usually have lead updates by list, single lead update might differ
    campaign_id: number;
    lead_id: number; // Individual lead update might not be supported or have a different endpoint structure
    lead: any;
  }) {
    // This endpoint is speculative based on common REST patterns; Smartlead often uses list-based updates for leads.
    // Verify with Smartlead API docs if a single lead update endpoint like this exists.
    // From the logs, listLeadsByCampaign had a status_filter removed. This method might need a different approach.
    return this.makeRequest(`/campaigns/${params.campaign_id}/leads/${params.lead_id}`, {
      method: 'POST', // Or PUT. POST is sometimes used for "update" if it's a partial update or specific action.
      body: JSON.stringify(params), // Ensure the body structure matches what the API expects for a single lead update.
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

  // NEW ENHANCED METHODS (incorporating fixes from history)
  async listLeadsByCampaign(params: { // status_filter was removed as unsupported
    campaign_id: number;
    offset?: number;
    limit?: number;
  }) {
    const queryParams = new URLSearchParams({
      offset: (params.offset || 0).toString(),
      limit: (params.limit || 50).toString(),
    });

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

  async getLeadMessageHistory(params: { // Corrected endpoint
    campaign_id: number;
    lead_id: number;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/leads/${params.lead_id}/message-history`);
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

  async searchLeadsByEmail(params: { // Corrected endpoint based on typical API patterns
    email: string;
  }) {
    // Assuming general leads search; Smartlead might require specific campaign context or have a different global search.
    // The original /leads/search? was based on a guess. /leads/?email= is more common.
    return this.makeRequest(`/leads/?email=${encodeURIComponent(params.email)}`);
  }
}


// Server setup - Correct single object argument
const server = new Server({
  name: 'enhanced-smartlead-server',
  version: '1.1.0',
  capabilities: {
    tools: {},
  },
});

// Check for required environment variable
if (!process.env.SMARTLEAD_API_KEY) {
  console.error('ERROR: SMARTLEAD_API_KEY environment variable is not set');
  // Optionally, you could throw an error here to prevent server from starting misconfigured
  // For Railway, it might be better to let it try and fail if the key is missing,
  // as process.exit(1) might lead to restart loops depending on Railway's policy.
  // But for tsc compilation, this check is fine. It's a runtime check though.
  // process.exit(1); // Consider if this is the best behavior for a Railway deployment
}

const smartleadApiKey = process.env.SMARTLEAD_API_KEY;
if (!smartleadApiKey) {
    console.error('FATAL: SMARTLEAD_API_KEY environment variable is not set. Server cannot start.');
    // Forcing an exit if essential config is missing, to make it obvious in logs.
    // This will prevent tsc from completing if run in an env where key is not set,
    // but tsc itself doesn't use env vars. This is a runtime concern.
    // For Railway, ensure the variable is set in the environment.
    throw new Error('SMARTLEAD_API_KEY is not configured.');
}

const smartlead = new SmartleadClient({
  apiKey: smartleadApiKey, // Use the validated key
  baseUrl: process.env.SMARTLEAD_API_URL, // Optional, defaults in client
  retryMaxAttempts: parseInt(process.env.SMARTLEAD_RETRY_MAX_ATTEMPTS || '3'),
  retryInitialDelay: parseInt(process.env.SMARTLEAD_RETRY_INITIAL_DELAY || '1000'),
  retryMaxDelay: parseInt(process.env.SMARTLEAD_RETRY_MAX_DELAY || '10000'),
  retryBackoffFactor: parseFloat(process.env.SMARTLEAD_RETRY_BACKOFF_FACTOR || '2'),
});

// Tools - all existing ones PLUS the missing analytics
// THIS IS THE SECTION WHERE THE TS2554 ERROR OCCURS DURING 'tsc'
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
      { // This is the tool where the error (TS2554) is often reported (around line 293 of this file)
        name: 'smartlead_update_campaign_schedule',
        description: 'Update a campaign\'s schedule settings.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign to update' },
            days_of_the_week: { type: 'array', items: { type: 'number' }, description: 'Days of the week to send emails (1-7, where 1 is Monday)' },
            start_hour: { type: 'string', description: 'Start hour in 24-hour format (e.g., "09:00")' },
            end_hour: { type: 'string', description: 'End hour in 24-hour format (e.g., "17:00")' }, // Error often near here
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
            settings: { type: 'object', description: 'Additional campaign settings' }, // 'any' type for settings in client method
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
              items: { type: 'object' } // Assuming sequence items are objects; define schema if known
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
            settings: { type: 'object', description: 'Settings for the email account in this campaign' }, // 'any' in client
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
              description: 'List of leads to add (max 100)', // 'any[]' in client
              items: { type: 'object' } // Assuming lead items are objects; define schema if known
            },
            settings: { type: 'object', description: 'Settings for lead addition' }, // 'any' in client
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
            lead: { type: 'object', description: 'Updated lead information' }, // 'any' in client
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
        name: 'smartlead_list_leads_by_campaign', // status_filter was removed from client method params
        description: 'List all leads in a campaign with their current status.',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: { type: 'number', description: 'ID of the campaign' },
            offset: { type: 'number', description: 'Offset for pagination' },
            limit: { type: 'number', description: 'Maximum number of leads to return' },
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
            email_status: { type: 'string', description: 'Filter by email status (opened, clicked, replied, unsubscribed, bounced)' },
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
  } catch (error: any) { // Explicitly type error
    console.error(`Error in tool handler for ${name}:`, error); // Log the actual error
    // Construct a more detailed error message string
    let errorMessage = `Smartlead API error during ${name}`;
    if (error instanceof Error) {
      errorMessage += `: ${error.message}`;
      // Optionally append stack if helpful, but can be verbose
      // if (error.stack) errorMessage += `\nStack: ${error.stack}`;
    } else {
      errorMessage += `: ${String(error)}`;
    }
    
    throw new McpError(
      ErrorCode.InternalError, // Or a more specific error code if applicable
      errorMessage 
    );
  }
});

// Start server - same as working original
async function main() {
  // Ensure API key is checked at the very start of main, before server connection
  if (!process.env.SMARTLEAD_API_KEY) {
    console.error('FATAL: SMARTLEAD_API_KEY environment variable is not set. Server cannot start.');
    process.exit(1); // Exit immediately if key is not set.
  }
  
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    console.error('Enhanced Smartlead MCP server running on stdio'); // Use console.error for logs on Railway
  } catch (connectionError) {
    console.error('Failed to connect server to transport:', connectionError);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled error in main:', error);
  process.exit(1);
});
