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
      
      console.error('SmartLead API Error Details:', JSON.stringify(errorDetails, null, 2));
      
      if (error.response?.status === 404) {
        throw new Error(`This Smartlead API endpoint does not exist: ${endpoint}`);
      }
      
      // Provide more specific error messages
      const apiError = error.response?.data?.error || error.response?.data?.message || error.message;
      throw new Error(`SmartLead API error: ${apiError}`);
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
    return this.request('/campaigns/create', 'POST', data);
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

  // New campaign endpoints
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
    return this.request(`/campaigns/${campaignId}/sequences`, 'POST', { sequences });
  }

  async getCampaignsByLead(leadId: string) {
    return this.request(`/leads/${leadId}/campaigns`);
  }

  async exportCampaignData(campaignId: string) {
    return this.request(`/campaigns/${campaignId}/leads-export`);
  }

  async getCampaignAnalyticsByDate(campaignId: string, startDate: string, endDate: string) {
    return this.request(`/campaigns/${campaignId}/analytics-by-date`, 'GET', {
      start_date: startDate,
      end_date: endDate,
    });
  }

  async getCampaignStatistics(campaignId: string, params?: any) {
    // Remove campaign_id from params if it exists (since it's in the URL path)
    const { campaign_id, ...cleanParams } = params || {};
    return this.request(`/campaigns/${campaignId}/statistics`, 'GET', cleanParams);
  }

  // Lead endpoints
  async addLeadsToCampaign(campaignId: string, leads: any[], settings?: any) {
    const payload: any = { lead_list: leads };
    if (settings) payload.settings = settings;
    return this.request(`/campaigns/${campaignId}/leads`, 'POST', payload);
  }

  async getLeadsFromCampaign(campaignId: string, offset: number = 0, limit: number = 100) {
    return this.request(`/campaigns/${campaignId}/leads`, 'GET', { offset, limit });
  }

  async updateLead(campaignId: string, leadId: string, data: any) {
    return this.request(`/campaigns/${campaignId}/leads/${leadId}`, 'POST', data);
  }

  async deleteLead(campaignId: string, leadId: string) {
    return this.request(`/campaigns/${campaignId}/leads/${leadId}`, 'DELETE');
  }

  // New lead endpoints
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

  // Reply endpoints (keeping for backwards compatibility)
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
        client_id: { type: 'number', description: 'Client ID (optional)' },
      },
      required: ['name'],
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
  // New campaign tools
  update_campaign_schedule: {
    description: 'Update campaign schedule settings',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        timezone: { type: 'string', description: 'Timezone (e.g., America/Los_Angeles)' },
        days_of_the_week: {
          type: 'array',
          items: { type: 'number' },
          description: 'Days to send (0-6, where 0 is Sunday)',
        },
        start_hour: { type: 'string', description: 'Start time (e.g., 09:00)' },
        end_hour: { type: 'string', description: 'End time (e.g., 17:00)' },
        min_time_btw_emails: { type: 'number', description: 'Minutes between emails' },
        max_new_leads_per_day: { type: 'number', description: 'Max new leads per day' },
        schedule_start_time: { type: 'string', description: 'Schedule start time (ISO format)' },
      },
      required: ['campaign_id'],
    },
  },
  update_campaign_settings: {
    description: 'Update campaign general settings',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        track_settings: {
          type: 'array',
          items: { 
            type: 'string',
            enum: ['DONT_TRACK_EMAIL_OPEN', 'DONT_TRACK_LINK_CLICK', 'DONT_TRACK_REPLY_TO_AN_EMAIL'],
          },
          description: 'Tracking settings',
        },
        stop_lead_settings: {
          type: 'string',
          enum: ['REPLY_TO_AN_EMAIL', 'CLICK_ON_A_LINK', 'OPEN_AN_EMAIL'],
          description: 'When to stop sending to lead',
        },
        unsubscribe_text: { type: 'string', description: 'Unsubscribe link text' },
        send_as_plain_text: { type: 'boolean', description: 'Send as plain text' },
        follow_up_percentage: { type: 'number', description: 'Follow up percentage (0-100)' },
        client_id: { type: 'number', description: 'Client ID' },
        enable_ai_esp_matching: { type: 'boolean', description: 'Enable AI ESP matching' },
      },
      required: ['campaign_id'],
    },
  },
  update_campaign_status: {
    description: 'Start, pause, or stop a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        status: { 
          type: 'string', 
          enum: ['START', 'PAUSED', 'STOPPED'],
          description: 'New campaign status' 
        },
      },
      required: ['campaign_id', 'status'],
    },
  },
  save_campaign_sequence: {
    description: 'Save email sequence for a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        sequences: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              seq_number: { type: 'number', description: 'Sequence number' },
              seq_delay_details: {
                type: 'object',
                properties: {
                  delay_in_days: { type: 'number', description: 'Days to wait' },
                },
                required: ['delay_in_days'],
              },
              subject: { type: 'string', description: 'Email subject (blank for follow-up in thread)' },
              email_body: { type: 'string', description: 'Email body HTML' },
              seq_variants: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    subject: { type: 'string' },
                    email_body: { type: 'string' },
                    variant_label: { type: 'string' },
                  },
                },
                description: 'A/B test variants',
              },
            },
            required: ['seq_number', 'seq_delay_details'],
          },
        },
      },
      required: ['campaign_id', 'sequences'],
    },
  },
  get_campaign_sequence: {
    description: 'Get email sequence for a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['campaign_id'],
    },
  },
  get_campaigns_by_lead: {
    description: 'Get all campaigns a specific lead belongs to',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'Lead ID' },
      },
      required: ['lead_id'],
    },
  },
  export_campaign_data: {
    description: 'Export all campaign data as CSV',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['campaign_id'],
    },
  },
  get_campaign_analytics_by_date: {
    description: 'Get campaign analytics for a specific date range',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
        end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
      },
      required: ['campaign_id', 'start_date', 'end_date'],
    },
  },
  get_campaign_statistics: {
    description: 'Get detailed campaign statistics with filtering options',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        offset: { type: 'number', description: 'Pagination offset' },
        limit: { type: 'number', description: 'Number of results' },
        email_sequence_number: { type: 'number', description: 'Filter by sequence number' },
        email_status: { 
          type: 'string',
          enum: ['opened', 'clicked', 'replied', 'unsubscribed', 'bounced'],
          description: 'Filter by email status' 
        },
      },
      required: ['campaign_id'],
    },
  },
  // Lead tools
  add_leads_to_campaign: {
    description: 'Add leads to a campaign (max 100 per call)',
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
              company_name: { type: 'string' },
              phone_number: { type: 'string' },
              website: { type: 'string' },
              location: { type: 'string' },
              custom_fields: { type: 'object', description: 'Max 20 custom fields' },
              linkedin_profile: { type: 'string' },
              company_url: { type: 'string' },
            },
            required: ['email'],
          },
        },
        settings: {
          type: 'object',
          properties: {
            ignore_global_block_list: { type: 'boolean' },
            ignore_unsubscribe_list: { type: 'boolean' },
            ignore_community_bounce_list: { type: 'boolean' },
            ignore_duplicate_leads_in_other_campaign: { type: 'boolean' },
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
        lead_id: { type: 'string', description: 'Lead ID' },
        email: { type: 'string' },
        first_name: { type: 'string' },
        last_name: { type: 'string' },
        company_name: { type: 'string' },
        phone_number: { type: 'string' },
        website: { type: 'string' },
        location: { type: 'string' },
        custom_fields: { type: 'object' },
        linkedin_profile: { type: 'string' },
        company_url: { type: 'string' },
      },
      required: ['campaign_id', 'lead_id'],
    },
  },
  delete_lead: {
    description: 'Delete a lead from a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        lead_id: { type: 'string', description: 'Lead ID' },
      },
      required: ['campaign_id', 'lead_id'],
    },
  },
  // New lead tools
  get_lead_by_email: {
    description: 'Find a lead by email address across all campaigns',
    inputSchema: {
      type: 'object',
      properties: {
        email: { type: 'string', description: 'Email address to search' },
      },
      required: ['email'],
    },
  },
  get_lead_categories: {
    description: 'Get all available lead categories',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  update_lead_category: {
    description: 'Update a lead\'s category in a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        lead_id: { type: 'string', description: 'Lead ID' },
        category_id: { type: 'string', description: 'Category ID' },
        pause_lead: { type: 'boolean', description: 'Pause lead after category update' },
      },
      required: ['campaign_id', 'lead_id', 'category_id'],
    },
  },
  pause_lead: {
    description: 'Pause a lead in a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        lead_id: { type: 'string', description: 'Lead ID' },
      },
      required: ['campaign_id', 'lead_id'],
    },
  },
  resume_lead: {
    description: 'Resume a paused lead in a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        lead_id: { type: 'string', description: 'Lead ID' },
        resume_lead_with_delay_days: { type: 'number', description: 'Days to wait before resuming' },
      },
      required: ['campaign_id', 'lead_id'],
    },
  },
  unsubscribe_lead_from_campaign: {
    description: 'Unsubscribe a lead from a specific campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        lead_id: { type: 'string', description: 'Lead ID' },
      },
      required: ['campaign_id', 'lead_id'],
    },
  },
  unsubscribe_lead_global: {
    description: 'Unsubscribe a lead from all campaigns globally',
    inputSchema: {
      type: 'object',
      properties: {
        lead_id: { type: 'string', description: 'Lead ID' },
      },
      required: ['lead_id'],
    },
  },
  get_all_leads: {
    description: 'Fetch all leads from entire account with pagination',
    inputSchema: {
      type: 'object',
      properties: {
        offset: { type: 'number', description: 'Pagination offset' },
        limit: { type: 'number', description: 'Number of results (max 100)' },
      },
    },
  },
  get_blocklist: {
    description: 'Get all leads/domains in global blocklist',
    inputSchema: {
      type: 'object',
      properties: {
        offset: { type: 'number', description: 'Pagination offset' },
        limit: { type: 'number', description: 'Number of results' },
      },
    },
  },
  add_to_blocklist: {
    description: 'Add emails or domains to global blocklist',
    inputSchema: {
      type: 'object',
      properties: {
        domains: {
          type: 'array',
          items: { type: 'string' },
          description: 'Email addresses or domains to block',
        },
        client_id: { type: 'string', description: 'Client ID (optional, for client-specific blocking)' },
      },
      required: ['domains'],
    },
  },
  get_message_history: {
    description: 'Get the complete message history for a lead in a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        lead_id: { type: 'string', description: 'Lead ID' },
      },
      required: ['campaign_id', 'lead_id'],
    },
  },
  reply_to_lead: {
    description: 'Reply to a lead in a campaign thread',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        email_stats_id: { type: 'string', description: 'Email stats ID from message history' },
        email_body: { type: 'string', description: 'Reply message body' },
        reply_message_id: { type: 'string', description: 'Message ID to reply to' },
        reply_email_time: { type: 'string', description: 'Time of the email being replied to' },
        reply_email_body: { type: 'string', description: 'Body of the email being replied to' },
        cc: { type: 'string', description: 'CC email addresses (optional)' },
        bcc: { type: 'string', description: 'BCC email addresses (optional)' },
        add_signature: { type: 'boolean', description: 'Add signature to reply (optional)' },
      },
      required: ['campaign_id', 'email_stats_id', 'email_body', 'reply_message_id', 'reply_email_time', 'reply_email_body'],
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
  // Email account tools
  get_email_accounts: {
    description: 'Get all email accounts with warmup details',
    inputSchema: {
      type: 'object',
      properties: {
        offset: { type: 'number', description: 'Pagination offset' },
        limit: { type: 'number', description: 'Number of results (max 100)' },
      },
    },
  },
  get_email_account: {
    description: 'Get specific email account details',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Email account ID' },
      },
      required: ['account_id'],
    },
  },
  create_email_account: {
    description: 'Create a new email account',
    inputSchema: {
      type: 'object',
      properties: {
        from_name: { type: 'string', description: 'Sender name' },
        from_email: { type: 'string', description: 'Sender email' },
        user_name: { type: 'string', description: 'SMTP username' },
        password: { type: 'string', description: 'SMTP password' },
        smtp_host: { type: 'string', description: 'SMTP host' },
        smtp_port: { type: 'number', description: 'SMTP port' },
        imap_host: { type: 'string', description: 'IMAP host' },
        imap_port: { type: 'number', description: 'IMAP port' },
        max_email_per_day: { type: 'number', description: 'Daily sending limit' },
        warmup_enabled: { type: 'boolean', description: 'Enable warmup' },
      },
      required: ['from_name', 'from_email', 'user_name', 'password', 'smtp_host', 'smtp_port'],
    },
  },
  update_email_account: {
    description: 'Update email account settings',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Email account ID' },
        max_email_per_day: { type: 'number', description: 'Daily sending limit' },
        custom_tracking_url: { type: 'string', description: 'Custom tracking domain' },
        bcc: { type: 'string', description: 'BCC email address' },
        signature: { type: 'string', description: 'Email signature HTML' },
        client_id: { type: 'string', description: 'Assign to client' },
        time_to_wait_in_mins: { type: 'number', description: 'Minimum wait between sends' },
      },
      required: ['account_id'],
    },
  },
  get_campaign_email_accounts: {
    description: 'List all email accounts used in a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['campaign_id'],
    },
  },
  add_email_to_campaign: {
    description: 'Add email accounts to a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        email_account_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Email account IDs to add',
        },
      },
      required: ['campaign_id', 'email_account_ids'],
    },
  },
  remove_email_from_campaign: {
    description: 'Remove email accounts from a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        email_account_ids: {
          type: 'array',
          items: { type: 'number' },
          description: 'Email account IDs to remove',
        },
      },
      required: ['campaign_id', 'email_account_ids'],
    },
  },
  update_warmup: {
    description: 'Configure email warmup settings',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Email account ID' },
        warmup_enabled: { type: 'boolean', description: 'Enable/disable warmup' },
        total_warmup_per_day: { type: 'number', description: 'Daily warmup emails' },
        daily_rampup: { type: 'number', description: 'Daily increase amount' },
        reply_rate_percentage: { type: 'number', description: 'Target reply rate %' },
      },
      required: ['account_id', 'warmup_enabled'],
    },
  },
  get_warmup_stats: {
    description: 'Get email warmup statistics for last 7 days',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: { type: 'string', description: 'Email account ID' },
      },
      required: ['account_id'],
    },
  },
  reconnect_failed_accounts: {
    description: 'Bulk reconnect all failed email accounts (max 3 times per day)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  // Reply tools (keeping for backwards compatibility)
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
    description: 'List all webhooks for a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
      },
      required: ['campaign_id'],
    },
  },
  create_webhook: {
    description: 'Create a new webhook for a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        name: { type: 'string', description: 'Webhook name' },
        webhook_url: { type: 'string', description: 'Webhook URL' },
        event_types: {
          type: 'array',
          items: {
            type: 'string',
            enum: ['EMAIL_SENT', 'EMAIL_OPEN', 'EMAIL_LINK_CLICK', 'EMAIL_REPLY', 'LEAD_UNSUBSCRIBED', 'LEAD_CATEGORY_UPDATED'],
          },
          description: 'Events to subscribe to',
        },
        categories: {
          type: 'array',
          items: { type: 'string' },
          description: 'Categories to filter (for LEAD_CATEGORY_UPDATED)',
        },
      },
      required: ['campaign_id', 'name', 'webhook_url', 'event_types'],
    },
  },
  delete_webhook: {
    description: 'Delete a webhook from a campaign',
    inputSchema: {
      type: 'object',
      properties: {
        campaign_id: { type: 'string', description: 'Campaign ID' },
        webhook_id: { type: 'string', description: 'Webhook ID' },
      },
      required: ['campaign_id', 'webhook_id'],
    },
  },
  // Client tools
  create_client: {
    description: 'Add a new client to your whitelabel system',
    inputSchema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: 'Client name' },
        email: { type: 'string', description: 'Client email' },
        password: { type: 'string', description: 'Client password' },
        permission: {
          type: 'array',
          items: { type: 'string' },
          description: 'Permissions (e.g., ["reply_master_inbox"] or ["full_access"])',
        },
        logo: { type: 'string', description: 'Company name for branding' },
        logo_url: { type: 'string', description: 'Logo URL' },
      },
      required: ['name', 'email', 'password', 'permission'],
    },
  },
  list_clients: {
    description: 'Get all clients in your whitelabel system',
    inputSchema: {
      type: 'object',
      properties: {},
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
      case 'update_campaign_schedule':
        result = await client.updateCampaignSchedule(params.campaign_id, params);
        break;
      case 'update_campaign_settings':
        result = await client.updateCampaignSettings(params.campaign_id, params);
        break;
      case 'update_campaign_status':
        result = await client.updateCampaignStatus(params.campaign_id, params.status);
        break;
      case 'save_campaign_sequence':
        result = await client.saveCampaignSequence(params.campaign_id, params.sequences);
        break;
      case 'get_campaign_sequence':
        result = await client.getCampaignSequence(params.campaign_id);
        break;
      case 'get_campaigns_by_lead':
        result = await client.getCampaignsByLead(params.lead_id);
        break;
      case 'export_campaign_data':
        result = await client.exportCampaignData(params.campaign_id);
        break;
      case 'get_campaign_analytics_by_date':
        result = await client.getCampaignAnalyticsByDate(params.campaign_id, params.start_date, params.end_date);
        break;
      case 'get_campaign_statistics':
        // CRITICAL FIX: Remove campaign_id from params to avoid parameter contamination
        const { campaign_id, ...statsParams } = params;
        result = await client.getCampaignStatistics(campaign_id, statsParams);
        break;
      
      // Lead tools
      case 'add_leads_to_campaign':
        result = await client.addLeadsToCampaign(params.campaign_id, params.leads, params.settings);
        break;
      case 'get_leads_from_campaign':
        result = await client.getLeadsFromCampaign(params.campaign_id, params.offset, params.limit);
        break;
      case 'update_lead':
        // Clean parameter separation for lead updates
        const { campaign_id: cId, lead_id, ...updateData } = params;
        result = await client.updateLead(cId, lead_id, updateData);
        break;
      case 'delete_lead':
        result = await client.deleteLead(params.campaign_id, params.lead_id);
        break;
      case 'get_lead_by_email':
        result = await client.getLeadByEmail(params.email);
        break;
      case 'get_lead_categories':
        result = await client.getLeadCategories();
        break;
      case 'update_lead_category':
        result = await client.updateLeadCategory(params.campaign_id, params.lead_id, params.category_id, params.pause_lead);
        break;
      case 'pause_lead':
        result = await client.pauseLead(params.campaign_id, params.lead_id);
        break;
      case 'resume_lead':
        result = await client.resumeLead(params.campaign_id, params.lead_id, params.resume_lead_with_delay_days);
        break;
      case 'unsubscribe_lead_from_campaign':
        result = await client.unsubscribeLeadFromCampaign(params.campaign_id, params.lead_id);
        break;
      case 'unsubscribe_lead_global':
        result = await client.unsubscribeLeadGlobal(params.lead_id);
        break;
      case 'get_all_leads':
        result = await client.getAllLeads(params.offset, params.limit);
        break;
      case 'get_blocklist':
        result = await client.getBlocklist(params.offset, params.limit);
        break;
      case 'add_to_blocklist':
        result = await client.addToBlocklist(params.domains, params.client_id);
        break;
      case 'get_message_history':
        result = await client.getMessageHistory(params.campaign_id, params.lead_id);
        break;
      case 'reply_to_lead':
        result = await client.replyToLead(params.campaign_id, params);
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
      
      // Email account tools
      case 'get_email_accounts':
        result = await client.getEmailAccounts(params.offset, params.limit);
        break;
      case 'get_email_account':
        result = await client.getEmailAccount(params.account_id);
        break;
      case 'create_email_account':
        result = await client.createEmailAccount(params);
        break;
      case 'update_email_account':
        result = await client.updateEmailAccount(params.account_id, params);
        break;
      case 'get_campaign_email_accounts':
        result = await client.getCampaignEmailAccounts(params.campaign_id);
        break;
      case 'add_email_to_campaign':
        result = await client.addEmailAccountToCampaign(params.campaign_id, params.email_account_ids);
        break;
      case 'remove_email_from_campaign':
        result = await client.removeEmailAccountFromCampaign(params.campaign_id, params.email_account_ids);
        break;
      case 'update_warmup':
        result = await client.updateWarmup(params.account_id, params);
        break;
      case 'get_warmup_stats':
        result = await client.getWarmupStats(params.account_id);
        break;
      case 'reconnect_failed_accounts':
        result = await client.reconnectFailedAccounts();
        break;
      
      // Reply tools (keeping for backwards compatibility)
      case 'send_reply':
        result = await client.sendReply(params);
        break;
      case 'get_conversations':
        result = await client.getConversations(params.campaign_id);
        break;
      
      // Webhook tools
      case 'list_webhooks':
        result = await client.listWebhooks(params.campaign_id);
        break;
      case 'create_webhook':
        result = await client.createWebhook(params.campaign_id, params);
        break;
      case 'delete_webhook':
        result = await client.deleteWebhook(params.campaign_id, params.webhook_id);
        break;
      
      // Client tools
      case 'create_client':
        result = await client.createClient(params);
        break;
      case 'list_clients':
        result = await client.listClients();
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
  console.error('Smartlead MCP Server running on stdio');
}

main().catch((error) => {
  console.error('Server error:', error);
  process.exit(1);
});
