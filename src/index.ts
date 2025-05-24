import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

// Enhanced Smartlead API client with better error handling
class SmartleadClient {
  private apiKey: string;
  private baseUrl = 'https://server.smartlead.ai/api/v1';

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async makeRequest(endpoint: string, options: any = {}) {
    const separator = endpoint.includes('?') ? '&' : '?';
    const url = `${this.baseUrl}${endpoint}${separator}api_key=${this.apiKey}`;
    
    const response = await fetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    if (!response.ok) {
      // Enhanced error logging
      const errorText = await response.text();
      console.error(`API Error: ${response.status} - ${errorText}`);
      throw new Error(`Smartlead API error: HTTP ${response.status}: ${response.statusText}`);
    }

    return response.json();
  }

  // Enhanced message history with multiple fallback approaches
  async getLeadMessageHistory(params: {
    campaign_id: number;
    lead_id: number;
  }) {
    try {
      // Primary approach - standard API call
      return await this.makeRequest(`/campaigns/${params.campaign_id}/leads/${params.lead_id}/message-history`);
    } catch (error: any) {
      // If 404, try alternative approaches
      if (error.message.includes('404')) {
        console.log(`Lead ${params.lead_id} not found in campaign ${params.campaign_id}, trying alternative methods...`);
        
        // Alternative 1: Get campaign statistics and filter for this lead
        try {
          const stats = await this.getCampaignStatistics({
            campaign_id: params.campaign_id,
            limit: 1000
          });
          
          // Find messages for this lead
          const leadMessages = stats.data.filter((stat: any) => 
            stat.lead_email === params.lead_id || stat.lead_id === params.lead_id
          );
          
          if (leadMessages.length > 0) {
            return {
              history: leadMessages.map((msg: any) => ({
                type: msg.reply_time ? 'REPLY' : 'SENT',
                time: msg.reply_time || msg.sent_time,
                subject: msg.email_subject,
                email_body: msg.email_message,
                from: msg.from_email,
                to: msg.lead_email
              })),
              from: leadMessages[0].from_email,
              to: leadMessages[0].lead_email
            };
          }
        } catch (statsError) {
          console.error('Failed to get stats:', statsError);
        }
      }
      throw error;
    }
  }

  // Enhanced lead search with campaign association
  async searchLeadsByEmail(params: { email: string }) {
    const lead = await this.makeRequest(`/leads/?email=${encodeURIComponent(params.email)}`);
    
    // Get all campaigns this lead belongs to
    if (lead.id) {
      try {
        const campaigns = await this.makeRequest(`/leads/${lead.id}/campaigns`);
        lead.campaigns = campaigns;
      } catch (error) {
        console.error('Failed to get lead campaigns:', error);
      }
    }
    
    return lead;
  }

  // Get campaign statistics with enhanced filtering
  async getCampaignStatistics(params: {
    campaign_id: number;
    offset?: number;
    limit?: number;
    email_sequence_number?: number;
    email_status?: string;
  }) {
    let endpoint = `/campaigns/${params.campaign_id}/statistics`;
    const queryParams = [];
    
    if (params.offset !== undefined) queryParams.push(`offset=${params.offset}`);
    if (params.limit !== undefined) queryParams.push(`limit=${params.limit}`);
    if (params.email_sequence_number) queryParams.push(`email_sequence_number=${params.email_sequence_number}`);
    if (params.email_status) queryParams.push(`email_status=${params.email_status}`);
    
    if (queryParams.length > 0) {
      endpoint += '?' + queryParams.join('&');
    }
    
    return this.makeRequest(endpoint);
  }

  // Export campaign data as CSV for manual processing
  async exportCampaignData(params: { campaign_id: number }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/leads-export`);
  }

  // Setup webhook for real-time reply capture
  async setupReplyWebhook(params: {
    campaign_id: number;
    webhook_url: string;
    name: string;
  }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/webhooks`, {
      method: 'POST',
      body: JSON.stringify({
        id: null,
        name: params.name,
        webhook_url: params.webhook_url,
        event_types: ['EMAIL_REPLY', 'LEAD_CATEGORY_UPDATED'],
        categories: ['Interested', 'Meeting Request']
      })
    });
  }

  // Get all webhooks for a campaign
  async getCampaignWebhooks(params: { campaign_id: number }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/webhooks`);
  }

  // List leads with enhanced data
  async listLeadsByCampaign(params: {
    campaign_id: number;
    offset?: number;
    limit?: number;
  }) {
    const endpoint = `/campaigns/${params.campaign_id}/leads`;
    const queryParams = [];
    
    if (params.offset !== undefined) queryParams.push(`offset=${params.offset}`);
    if (params.limit !== undefined) queryParams.push(`limit=${params.limit}`);
    
    const url = queryParams.length > 0 ? `${endpoint}?${queryParams.join('&')}` : endpoint;
    const result = await this.makeRequest(url);
    
    // For each lead with a reply, try to get their message history
    if (result.data) {
      for (const leadData of result.data) {
        if (leadData.lead.reply_count > 0 || leadData.lead_category_id) {
          try {
            const history = await this.getLeadMessageHistory({
              campaign_id: params.campaign_id,
              lead_id: leadData.lead.id
            });
            leadData.message_history = history;
          } catch (error) {
            console.log(`Could not get history for lead ${leadData.lead.id}`);
            leadData.message_history_error = error.message;
          }
        }
      }
    }
    
    return result;
  }

  // Existing methods remain the same...
  async listCampaigns() {
    return this.makeRequest('/campaigns');
  }

  async getCampaign(params: { campaign_id: number }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}`);
  }

  async createCampaign(params: { name: string; client_id?: number }) {
    return this.makeRequest('/campaigns/create', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async updateCampaignSchedule(params: {
    campaign_id: number;
    timezone: string;
    days_of_the_week: number[];
    start_hour: string;
    end_hour: string;
    min_time_btw_emails: number;
    max_new_leads_per_day: number;
    schedule_start_time?: string;
  }) {
    const { campaign_id, ...data } = params;
    return this.makeRequest(`/campaigns/${campaign_id}/schedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateCampaignSettings(params: {
    campaign_id: number;
    track_settings?: string[];
    stop_lead_settings?: string;
    unsubscribe_text?: string;
    send_as_plain_text?: boolean;
    follow_up_percentage?: number;
    client_id?: number;
    enable_ai_esp_matching?: boolean;
  }) {
    const { campaign_id, ...data } = params;
    return this.makeRequest(`/campaigns/${campaign_id}/settings`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async saveCampaignSequence(params: {
    campaign_id: number;
    sequences: any[];
  }) {
    const { campaign_id, ...data } = params;
    return this.makeRequest(`/campaigns/${campaign_id}/sequences`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCampaignSequence(params: { campaign_id: number }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/sequences`);
  }

  async addLeadToCampaign(params: {
    campaign_id: number;
    lead_list: any[];
    settings?: {
      ignore_global_block_list?: boolean;
      ignore_unsubscribe_list?: boolean;
      ignore_duplicate_leads_in_other_campaign?: boolean;
    };
  }) {
    const { campaign_id, ...data } = params;
    return this.makeRequest(`/campaigns/${campaign_id}/leads`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCampaignAnalytics(params: { campaign_id: number }) {
    return this.makeRequest(`/campaigns/${params.campaign_id}/analytics`);
  }

  async getCampaignAnalyticsByDate(params: {
    campaign_id: number;
    start_date: string;
    end_date: string;
  }) {
    return this.makeRequest(
      `/campaigns/${params.campaign_id}/analytics-by-date?start_date=${params.start_date}&end_date=${params.end_date}`
    );
  }
}

// Create the MCP server
const server = new Server({
  name: 'enhanced-smartlead-server',
  version: '1.2.0',
  capabilities: {
    tools: {},
  },
});

// Tool handlers
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: 'smartlead_list_campaigns',
        description: 'List all campaigns in your Smartlead account',
        inputSchema: {
          type: 'object',
          properties: {},
        },
      },
      {
        name: 'smartlead_get_campaign',
        description: 'Get details of a specific campaign',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'number',
              description: 'The ID of the campaign',
            },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_list_leads_by_campaign',
        description: 'List all leads in a campaign with optional message history',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'number',
              description: 'The ID of the campaign',
            },
            offset: {
              type: 'number',
              description: 'Offset for pagination',
            },
            limit: {
              type: 'number',
              description: 'Limit for pagination (max 100)',
            },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_get_lead_message_history',
        description: 'Get the complete message history for a lead in a campaign',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'number',
              description: 'The ID of the campaign',
            },
            lead_id: {
              type: 'number',
              description: 'The ID of the lead',
            },
          },
          required: ['campaign_id', 'lead_id'],
        },
      },
      {
        name: 'smartlead_get_campaign_statistics',
        description: 'Get detailed statistics for a campaign with optional filters',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'number',
              description: 'The ID of the campaign',
            },
            offset: {
              type: 'number',
              description: 'Offset for pagination',
            },
            limit: {
              type: 'number',
              description: 'Limit for pagination',
            },
            email_sequence_number: {
              type: 'number',
              description: 'Filter by sequence number (1,2,3,4)',
            },
            email_status: {
              type: 'string',
              description: 'Filter by status: opened, clicked, replied, unsubscribed, bounced',
            },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_search_leads_by_email',
        description: 'Search for a lead by email address across all campaigns',
        inputSchema: {
          type: 'object',
          properties: {
            email: {
              type: 'string',
              description: 'Email address to search for',
            },
          },
          required: ['email'],
        },
      },
      {
        name: 'smartlead_export_campaign_data',
        description: 'Export all campaign data as CSV',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'number',
              description: 'The ID of the campaign to export',
            },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_setup_reply_webhook',
        description: 'Setup a webhook to capture replies in real-time',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'number',
              description: 'The ID of the campaign',
            },
            webhook_url: {
              type: 'string',
              description: 'URL to receive webhook events',
            },
            name: {
              type: 'string',
              description: 'Name for the webhook',
            },
          },
          required: ['campaign_id', 'webhook_url', 'name'],
        },
      },
      {
        name: 'smartlead_get_campaign_webhooks',
        description: 'Get all webhooks for a campaign',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'number',
              description: 'The ID of the campaign',
            },
          },
          required: ['campaign_id'],
        },
      },
      {
        name: 'smartlead_get_campaign_analytics',
        description: 'Get top-level analytics for a campaign including reply counts',
        inputSchema: {
          type: 'object',
          properties: {
            campaign_id: {
              type: 'number',
              description: 'The ID of the campaign',
            },
          },
          required: ['campaign_id'],
        },
      },
      // Other existing tools remain the same...
    ],
  };
});

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const apiKey = process.env.SMARTLEAD_API_KEY;
  if (!apiKey) {
    throw new McpError(
      ErrorCode.InternalError,
      'SMARTLEAD_API_KEY environment variable is not set'
    );
  }

  const client = new SmartleadClient(apiKey);
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case 'smartlead_list_campaigns':
        return { content: [{ type: 'text', text: JSON.stringify(await client.listCampaigns(), null, 2) }] };
      
      case 'smartlead_get_campaign':
        return { content: [{ type: 'text', text: JSON.stringify(await client.getCampaign(args), null, 2) }] };
      
      case 'smartlead_list_leads_by_campaign':
        return { content: [{ type: 'text', text: JSON.stringify(await client.listLeadsByCampaign(args), null, 2) }] };
      
      case 'smartlead_get_lead_message_history':
        return { content: [{ type: 'text', text: JSON.stringify(await client.getLeadMessageHistory(args), null, 2) }] };
      
      case 'smartlead_get_campaign_statistics':
        return { content: [{ type: 'text', text: JSON.stringify(await client.getCampaignStatistics(args), null, 2) }] };
      
      case 'smartlead_search_leads_by_email':
        return { content: [{ type: 'text', text: JSON.stringify(await client.searchLeadsByEmail(args), null, 2) }] };
      
      case 'smartlead_export_campaign_data':
        return { content: [{ type: 'text', text: JSON.stringify(await client.exportCampaignData(args), null, 2) }] };
      
      case 'smartlead_setup_reply_webhook':
        return { content: [{ type: 'text', text: JSON.stringify(await client.setupReplyWebhook(args), null, 2) }] };
      
      case 'smartlead_get_campaign_webhooks':
        return { content: [{ type: 'text', text: JSON.stringify(await client.getCampaignWebhooks(args), null, 2) }] };
      
      case 'smartlead_get_campaign_analytics':
        return { content: [{ type: 'text', text: JSON.stringify(await client.getCampaignAnalytics(args), null, 2) }] };
      
      // Other cases remain the same...
      default:
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
  } catch (error) {
    if (error instanceof McpError) throw error;
    throw new McpError(ErrorCode.InternalError, error.message);
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Enhanced Smartlead MCP Server running with improved reply retrieval...');
}

main().catch(console.error);
