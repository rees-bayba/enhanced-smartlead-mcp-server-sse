#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  Tool,
  CallToolRequestSchema,
  ListToolsRequestSchema,
  ErrorCode,
  McpError,
  // Ensure all necessary MCP types are imported if used by type guards or interfaces
} from '@modelcontextprotocol/sdk/types.js';
import axios, { AxiosInstance, AxiosError } from 'axios';
import dotenv from 'dotenv';

dotenv.config();

// --- Smartlead API Client Configuration & Helpers ---
const SMARTLEAD_API_URL_DEFAULT = 'https://server.smartlead.ai/api/v1';
const SMARTLEAD_API_KEY = process.env.SMARTLEAD_API_KEY;
const SMARTLEAD_API_URL = process.env.SMARTLEAD_API_URL || SMARTLEAD_API_URL_DEFAULT;

if (!SMARTLEAD_API_KEY) {
  console.error('FATAL: SMARTLEAD_API_KEY environment variable is not set. Server cannot start.');
  process.exit(1);
}

const apiClient: AxiosInstance = axios.create({
  baseURL: SMARTLEAD_API_URL,
  params: {
    api_key: SMARTLEAD_API_KEY, // API key as a query parameter for all requests via this client
  },
  headers: {
    'Content-Type': 'application/json',
  },
});

const RETRY_CONFIG = {
  maxAttempts: parseInt(process.env.SMARTLEAD_RETRY_MAX_ATTEMPTS || '3', 10),
  initialDelay: parseInt(process.env.SMARTLEAD_RETRY_INITIAL_DELAY || '1000', 10),
  maxDelay: parseInt(process.env.SMARTLEAD_RETRY_MAX_DELAY || '10000', 10),
  backoffFactor: parseFloat(process.env.SMARTLEAD_RETRY_BACKOFF_FACTOR || '2'),
};

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withRetry<T>(
  operation: () => Promise<T>,
  context: string,
  attempt = 1
): Promise<T> {
  try {
    return await operation();
  } catch (error) {
    const axiosError = error as AxiosError; // Type assertion
    let errorMessage = `Error during ${context}`;
    if (axiosError.isAxiosError) {
        errorMessage = `API Error during ${context}: ${axiosError.response?.status} ${axiosError.response?.statusText}. Response: ${JSON.stringify(axiosError.response?.data)}`;
    } else if (error instanceof Error) {
        errorMessage = `Error during ${context}: ${error.message}`;
    } else {
        errorMessage = `Unknown error during ${context}: ${String(error)}`;
    }

    const isRateLimit = axiosError.isAxiosError && axiosError.response?.status === 429;
    const isNetworkError = axiosError.isAxiosError && !axiosError.response; // Network error or timeout

    if (attempt < RETRY_CONFIG.maxAttempts && (isRateLimit || isNetworkError)) {
      const delayMs = Math.min(
        RETRY_CONFIG.initialDelay * Math.pow(RETRY_CONFIG.backoffFactor, attempt - 1),
        RETRY_CONFIG.maxDelay
      );
      console.warn(`Attempt ${attempt} for ${context} failed. Retrying in ${delayMs}ms. Error: ${errorMessage}`);
      await delay(delayMs);
      return withRetry(operation, context, attempt + 1);
    }
    console.error(`Final attempt for ${context} failed or non-retriable error: ${errorMessage}`);
    throw error; // Re-throw the original error or a new contextualized error
  }
}

function createTextResponse(data: any) {
  return { content: [{ type: 'text' as const, text: JSON.stringify(data, null, 2) }] };
}

function createMcpErrorResponse(message: string, code: ErrorCode = ErrorCode.InternalError) {
    console.error("MCP Error Response:", message);
    // For the client, only send the message, not the full McpError object structure if not needed
    return { content: [{ type: 'text' as const, text: message }], isError: true };
}


// --- Tool Definitions, Interfaces, and Type Guards ---

// 1. Create Campaign
interface CreateCampaignParams { name: string; client_id?: number; }
const CREATE_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_create_campaign',
  description: 'Create a new campaign in Smartlead.',
  inputSchema: {
    type: 'object',
    properties: {
      name: { type: 'string', description: 'Name of the campaign' },
      client_id: { type: 'number', description: 'Client ID for the campaign (optional)' },
    },
    required: ['name'],
  },
};
function isCreateCampaignParams(args: any): args is CreateCampaignParams {
  return typeof args === 'object' && args !== null && typeof args.name === 'string' && (args.client_id === undefined || typeof args.client_id === 'number');
}

// 2. Update Campaign Schedule
interface UpdateCampaignScheduleParams { campaign_id: number; days_of_the_week?: number[]; start_hour?: string; end_hour?: string; max_new_leads_per_day?: number; min_time_btw_emails?: number; timezone?: string; schedule_start_time?: string; }
const UPDATE_CAMPAIGN_SCHEDULE_TOOL: Tool = {
  name: 'smartlead_update_campaign_schedule',
  description: "Update a campaign's schedule settings.",
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign to update' },
      days_of_the_week: { type: 'array', items: { type: 'number' }, description: 'Days of the week to send emails (1-7, 1=Monday)' },
      start_hour: { type: 'string', description: 'Start hour (e.g., "09:00")' },
      end_hour: { type: 'string', description: 'End hour (e.g., "17:00")' },
      max_new_leads_per_day: { type: 'number', description: 'Max new leads per day' },
      min_time_btw_emails: { type: 'number', description: 'Min time between emails (minutes)' },
      timezone: { type: 'string', description: 'Timezone (e.g., "America/Los_Angeles")' },
      schedule_start_time: { type: 'string', description: 'Schedule start time (ISO format)' },
    },
    required: ['campaign_id'],
  },
};
function isUpdateCampaignScheduleParams(args: any): args is UpdateCampaignScheduleParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number';
}

// 3. Update Campaign Settings
interface UpdateCampaignSettingsParams { campaign_id: number; name?: string; status?: 'active' | 'paused' | 'completed'; settings?: Record<string, any>; }
const UPDATE_CAMPAIGN_SETTINGS_TOOL: Tool = {
  name: 'smartlead_update_campaign_settings',
  description: "Update a campaign's general settings.",
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign to update' },
      name: { type: 'string', description: 'New name for the campaign' },
      status: { type: 'string', enum: ['active', 'paused', 'completed'], description: 'Status of the campaign' },
      settings: { type: 'object', additionalProperties: true, description: 'Additional campaign settings' },
    },
    required: ['campaign_id'],
  },
};
function isUpdateCampaignSettingsParams(args: any): args is UpdateCampaignSettingsParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number';
}

// 4. Get Campaign
interface GetCampaignParams { campaign_id: number; }
const GET_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_get_campaign',
  description: 'Get details of a specific campaign by ID.',
  inputSchema: {
    type: 'object',
    properties: { campaign_id: { type: 'number', description: 'ID of the campaign to retrieve' } },
    required: ['campaign_id'],
  },
};
function isGetCampaignParams(args: any): args is GetCampaignParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number';
}

// 5. List Campaigns
interface ListCampaignsParams { limit?: number; offset?: number; status?: 'active' | 'paused' | 'completed' | 'all'; }
const LIST_CAMPAIGNS_TOOL: Tool = {
  name: 'smartlead_list_campaigns',
  description: 'List all campaigns with optional filtering.',
  inputSchema: {
    type: 'object',
    properties: {
      limit: { type: 'number', description: 'Max number of campaigns to return' },
      offset: { type: 'number', description: 'Offset for pagination' },
      status: { type: 'string', enum: ['active', 'paused', 'completed', 'all'], description: 'Filter by status' },
    },
  },
};
function isListCampaignsParams(args: any): args is ListCampaignsParams {
  return typeof args === 'object' && args !== null; // All params are optional
}

// 6. Save Campaign Sequence
interface SequenceItem { id?: number; seq_number: number; seq_delay_details: { delay_in_days: number; }; [key: string]: any; } // Add more specific sequence item props if known
interface SaveCampaignSequenceParams { campaign_id: number; sequences: SequenceItem[]; }
const SAVE_CAMPAIGN_SEQUENCE_TOOL: Tool = {
  name: 'smartlead_save_campaign_sequence',
  description: 'Save a sequence of emails for a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign' },
      sequences: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'Array of email sequences' },
    },
    required: ['campaign_id', 'sequences'],
  },
};
function isSaveCampaignSequenceParams(args: any): args is SaveCampaignSequenceParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number' && Array.isArray(args.sequences);
}

// 7. Get Campaign Sequence
interface GetCampaignSequenceParams { campaign_id: number; }
const GET_CAMPAIGN_SEQUENCE_TOOL: Tool = {
  name: 'smartlead_get_campaign_sequence',
  description: 'Get the sequence of emails for a campaign.',
  inputSchema: {
    type: 'object',
    properties: { campaign_id: { type: 'number', description: 'ID of the campaign' } },
    required: ['campaign_id'],
  },
};
function isGetCampaignSequenceParams(args: any): args is GetCampaignSequenceParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number';
}

// 8. Update Campaign Sequence
interface UpdateCampaignSequenceParams { campaign_id: number; sequence_id: number; subject?: string; body?: string; wait_days?: number; }
const UPDATE_CAMPAIGN_SEQUENCE_TOOL: Tool = {
  name: 'smartlead_update_campaign_sequence',
  description: 'Update a specific email in a campaign sequence.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign' },
      sequence_id: { type: 'number', description: 'ID of the sequence email' },
      subject: { type: 'string', description: 'Updated subject' },
      body: { type: 'string', description: 'Updated body content' },
      wait_days: { type: 'number', description: 'Updated wait days' },
    },
    required: ['campaign_id', 'sequence_id'],
  },
};
function isUpdateCampaignSequenceParams(args: any): args is UpdateCampaignSequenceParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number' && typeof args.sequence_id === 'number';
}

// 9. Delete Campaign Sequence
interface DeleteCampaignSequenceParams { campaign_id: number; sequence_id: number; }
const DELETE_CAMPAIGN_SEQUENCE_TOOL: Tool = {
  name: 'smartlead_delete_campaign_sequence',
  description: 'Delete a specific email from a campaign sequence.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign' },
      sequence_id: { type: 'number', description: 'ID of the sequence email' },
    },
    required: ['campaign_id', 'sequence_id'],
  },
};
function isDeleteCampaignSequenceParams(args: any): args is DeleteCampaignSequenceParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number' && typeof args.sequence_id === 'number';
}

// 10. Add Email Account To Campaign
interface AddEmailAccountToCampaignParams { campaign_id: number; email_account_id: number; }
const ADD_EMAIL_ACCOUNT_TO_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_add_email_account_to_campaign',
  description: 'Add an email account to a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign' },
      email_account_id: { type: 'number', description: 'ID of the email account' },
    },
    required: ['campaign_id', 'email_account_id'],
  },
};
function isAddEmailAccountToCampaignParams(args: any): args is AddEmailAccountToCampaignParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number' && typeof args.email_account_id === 'number';
}

// 11. Update Email Account In Campaign
interface UpdateEmailAccountInCampaignParams { campaign_id: number; email_account_id: number; settings?: Record<string, any>; }
const UPDATE_EMAIL_ACCOUNT_IN_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_update_email_account_in_campaign',
  description: 'Update an email account in a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign' },
      email_account_id: { type: 'number', description: 'ID of the email account' },
      settings: { type: 'object', additionalProperties: true, description: 'Settings for the email account' },
    },
    required: ['campaign_id', 'email_account_id'],
  },
};
function isUpdateEmailAccountInCampaignParams(args: any): args is UpdateEmailAccountInCampaignParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number' && typeof args.email_account_id === 'number';
}

// 12. Delete Email Account From Campaign
interface DeleteEmailAccountFromCampaignParams { campaign_id: number; email_account_id: number; }
const DELETE_EMAIL_ACCOUNT_FROM_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_delete_email_account_from_campaign',
  description: 'Remove an email account from a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign' },
      email_account_id: { type: 'number', description: 'ID of the email account' },
    },
    required: ['campaign_id', 'email_account_id'],
  },
};
function isDeleteEmailAccountFromCampaignParams(args: any): args is DeleteEmailAccountFromCampaignParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number' && typeof args.email_account_id === 'number';
}

// 13. Add Lead To Campaign
interface LeadItem { email: string; [key: string]: any; } // Add more specific lead item props if known
interface AddLeadToCampaignParams { campaign_id: number; lead_list: LeadItem[]; settings?: Record<string, any>; }
const ADD_LEAD_TO_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_add_lead_to_campaign',
  description: 'Add leads to a campaign (up to 100 at once).',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign' },
      lead_list: { type: 'array', items: { type: 'object', additionalProperties: true }, description: 'List of leads (max 100)' },
      settings: { type: 'object', additionalProperties: true, description: 'Settings for lead addition' },
    },
    required: ['campaign_id', 'lead_list'],
  },
};
function isAddLeadToCampaignParams(args: any): args is AddLeadToCampaignParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number' && Array.isArray(args.lead_list);
}

// 14. Update Lead In Campaign
interface UpdateLeadInCampaignParams { campaign_id: number; lead_id: number; lead: Record<string, any>; }
const UPDATE_LEAD_IN_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_update_lead_in_campaign',
  description: 'Update a lead in a campaign.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign' },
      lead_id: { type: 'number', description: 'ID of the lead to update' },
      lead: { type: 'object', additionalProperties: true, description: 'Updated lead information' },
    },
    required: ['campaign_id', 'lead_id', 'lead'],
  },
};
function isUpdateLeadInCampaignParams(args: any): args is UpdateLeadInCampaignParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number' && typeof args.lead_id === 'number' && typeof args.lead === 'object';
}

// 15. Delete Lead From Campaign
interface DeleteLeadFromCampaignParams { campaign_id: number; lead_id: number; }
const DELETE_LEAD_FROM_CAMPAIGN_TOOL: Tool = {
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
};
function isDeleteLeadFromCampaignParams(args: any): args is DeleteLeadFromCampaignParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number' && typeof args.lead_id === 'number';
}

// --- NEW ENHANCED ANALYTICS TOOLS ---

// 16. List Leads By Campaign (Enhanced)
interface ListLeadsByCampaignParams { campaign_id: number; offset?: number; limit?: number; }
const LIST_LEADS_BY_CAMPAIGN_TOOL: Tool = {
  name: 'smartlead_list_leads_by_campaign',
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
};
function isListLeadsByCampaignParams(args: any): args is ListLeadsByCampaignParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number';
}

// 17. Get Campaign Statistics (Enhanced)
interface GetCampaignStatisticsParams { campaign_id: number; email_sequence_number?: number; email_status?: string; offset?: number; limit?: number; }
const GET_CAMPAIGN_STATISTICS_TOOL: Tool = {
  name: 'smartlead_get_campaign_statistics',
  description: 'Get detailed campaign performance metrics filterable by sequence number.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign' },
      email_sequence_number: { type: 'number', description: 'Filter by specific sequence number' },
      email_status: { type: 'string', description: 'Filter by email status (e.g., opened, clicked, replied)' },
      offset: { type: 'number', description: 'Offset for pagination' },
      limit: { type: 'number', description: 'Maximum results' },
    },
    required: ['campaign_id'],
  },
};
function isGetCampaignStatisticsParams(args: any): args is GetCampaignStatisticsParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number';
}

// 18. Get Lead Message History (Enhanced)
interface GetLeadMessageHistoryParams { campaign_id: number; lead_id: number; }
const GET_LEAD_MESSAGE_HISTORY_TOOL: Tool = {
  name: 'smartlead_get_lead_message_history',
  description: "Get a lead's complete email interaction history.",
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign' },
      lead_id: { type: 'number', description: 'ID of the lead' },
    },
    required: ['campaign_id', 'lead_id'],
  },
};
function isGetLeadMessageHistoryParams(args: any): args is GetLeadMessageHistoryParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number' && typeof args.lead_id === 'number';
}

// 19. Get Campaign Analytics (Enhanced)
interface GetCampaignAnalyticsParams { campaign_id: number; }
const GET_CAMPAIGN_ANALYTICS_TOOL: Tool = {
  name: 'smartlead_get_campaign_analytics',
  description: 'Get comprehensive campaign analytics.',
  inputSchema: {
    type: 'object',
    properties: { campaign_id: { type: 'number', description: 'ID of the campaign' } },
    required: ['campaign_id'],
  },
};
function isGetCampaignAnalyticsParams(args: any): args is GetCampaignAnalyticsParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number';
}

// 20. Get Campaign Analytics By Date (Enhanced)
interface GetCampaignAnalyticsByDateParams { campaign_id: number; start_date: string; end_date: string; }
const GET_CAMPAIGN_ANALYTICS_BY_DATE_TOOL: Tool = {
  name: 'smartlead_get_campaign_analytics_by_date',
  description: 'Get campaign analytics for a specific date range.',
  inputSchema: {
    type: 'object',
    properties: {
      campaign_id: { type: 'number', description: 'ID of the campaign' },
      start_date: { type: 'string', description: 'Start date (YYYY-MM-DD)' },
      end_date: { type: 'string', description: 'End date (YYYY-MM-DD)' },
    },
    required: ['campaign_id', 'start_date', 'end_date'],
  },
};
function isGetCampaignAnalyticsByDateParams(args: any): args is GetCampaignAnalyticsByDateParams {
  return typeof args === 'object' && args !== null && typeof args.campaign_id === 'number' && typeof args.start_date === 'string' && typeof args.end_date === 'string';
}

// 21. Search Leads By Email (Enhanced)
interface SearchLeadsByEmailParams { email: string; }
const SEARCH_LEADS_BY_EMAIL_TOOL: Tool = {
  name: 'smartlead_search_leads_by_email',
  description: 'Search for leads by email address across all campaigns.',
  inputSchema: {
    type: 'object',
    properties: { email: { type: 'string', description: 'Email address to search for' } },
    required: ['email'],
  },
};
function isSearchLeadsByEmailParams(args: any): args is SearchLeadsByEmailParams {
  return typeof args === 'object' && args !== null && typeof args.email === 'string';
}

// --- MCP Server Setup ---
// Using the ONE-ARGUMENT constructor as determined to be correct for @modelcontextprotocol/sdk@^0.6.0
const server = new Server({
  name: 'enhanced-smartlead-server',
  version: '1.1.0',
  capabilities: {
    tools: {}, // Tool definitions are provided by ListToolsRequestSchema handler
  },
});

server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: [
    CREATE_CAMPAIGN_TOOL,
    UPDATE_CAMPAIGN_SCHEDULE_TOOL,
    UPDATE_CAMPAIGN_SETTINGS_TOOL,
    GET_CAMPAIGN_TOOL,
    LIST_CAMPAIGNS_TOOL,
    SAVE_CAMPAIGN_SEQUENCE_TOOL,
    GET_CAMPAIGN_SEQUENCE_TOOL,
    UPDATE_CAMPAIGN_SEQUENCE_TOOL,
    DELETE_CAMPAIGN_SEQUENCE_TOOL,
    ADD_EMAIL_ACCOUNT_TO_CAMPAIGN_TOOL,
    UPDATE_EMAIL_ACCOUNT_IN_CAMPAIGN_TOOL,
    DELETE_EMAIL_ACCOUNT_FROM_CAMPAIGN_TOOL,
    ADD_LEAD_TO_CAMPAIGN_TOOL,
    UPDATE_LEAD_IN_CAMPAIGN_TOOL,
    DELETE_LEAD_FROM_CAMPAIGN_TOOL,
    // Enhanced Analytics Tools
    LIST_LEADS_BY_CAMPAIGN_TOOL,
    GET_CAMPAIGN_STATISTICS_TOOL,
    GET_LEAD_MESSAGE_HISTORY_TOOL,
    GET_CAMPAIGN_ANALYTICS_TOOL,
    GET_CAMPAIGN_ANALYTICS_BY_DATE_TOOL,
    SEARCH_LEADS_BY_EMAIL_TOOL,
  ],
}));

server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;
  let responseData: any;
  // Default to passing all args; specific handlers can modify `paramsForApi`
  let paramsForApi: any = args; 

  try {
    switch (name) {
      case CREATE_CAMPAIGN_TOOL.name:
        if (!isCreateCampaignParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        responseData = (await withRetry(() => apiClient.post('/campaigns/create', args), name)).data;
        break;
      
      case UPDATE_CAMPAIGN_SCHEDULE_TOOL.name:
        if (!isUpdateCampaignScheduleParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        paramsForApi = { ...args }; delete paramsForApi.campaign_id;
        responseData = (await withRetry(() => apiClient.post(`/campaigns/${args.campaign_id}/schedule`, paramsForApi), name)).data;
        break;

      case UPDATE_CAMPAIGN_SETTINGS_TOOL.name:
        if (!isUpdateCampaignSettingsParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        paramsForApi = { ...args }; delete paramsForApi.campaign_id;
        // Smartlead API might use POST or PUT/PATCH for settings. Using POST as per user's prior version.
        responseData = (await withRetry(() => apiClient.post(`/campaigns/${args.campaign_id}/settings`, paramsForApi), name)).data;
        break;

      case GET_CAMPAIGN_TOOL.name:
        if (!isGetCampaignParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        responseData = (await withRetry(() => apiClient.get(`/campaigns/${args.campaign_id}`), name)).data;
        break;

      case LIST_CAMPAIGNS_TOOL.name:
        if (!isListCampaignsParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        // Filter out undefined params for cleaner query
        paramsForApi = {};
        if (args.limit !== undefined) paramsForApi.limit = args.limit;
        if (args.offset !== undefined) paramsForApi.offset = args.offset;
        if (args.status !== undefined && args.status !== 'all') paramsForApi.status = args.status;
        responseData = (await withRetry(() => apiClient.get('/campaigns', { params: paramsForApi }), name)).data;
        break;

      case SAVE_CAMPAIGN_SEQUENCE_TOOL.name:
        if (!isSaveCampaignSequenceParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        paramsForApi = { sequences: args.sequences };
        responseData = (await withRetry(() => apiClient.post(`/campaigns/${args.campaign_id}/sequences`, paramsForApi), name)).data;
        break;

      case GET_CAMPAIGN_SEQUENCE_TOOL.name:
        if (!isGetCampaignSequenceParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        responseData = (await withRetry(() => apiClient.get(`/campaigns/${args.campaign_id}/sequences`), name)).data;
        break;

      case UPDATE_CAMPAIGN_SEQUENCE_TOOL.name:
        if (!isUpdateCampaignSequenceParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        paramsForApi = { ...args }; delete paramsForApi.campaign_id; delete paramsForApi.sequence_id;
        responseData = (await withRetry(() => apiClient.put(`/campaigns/${args.campaign_id}/sequences/${args.sequence_id}`, paramsForApi), name)).data;
        break;

      case DELETE_CAMPAIGN_SEQUENCE_TOOL.name:
        if (!isDeleteCampaignSequenceParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        responseData = (await withRetry(() => apiClient.delete(`/campaigns/${args.campaign_id}/sequences/${args.sequence_id}`), name)).data;
        break;

      case ADD_EMAIL_ACCOUNT_TO_CAMPAIGN_TOOL.name:
        if (!isAddEmailAccountToCampaignParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        responseData = (await withRetry(() => apiClient.post(`/campaigns/${args.campaign_id}/email-accounts`, { email_account_id: args.email_account_id }), name)).data;
        break;

      case UPDATE_EMAIL_ACCOUNT_IN_CAMPAIGN_TOOL.name:
        if (!isUpdateEmailAccountInCampaignParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        paramsForApi = { settings: args.settings || {} };
        responseData = (await withRetry(() => apiClient.put(`/campaigns/${args.campaign_id}/email-accounts/${args.email_account_id}`, paramsForApi), name)).data;
        break;

      case DELETE_EMAIL_ACCOUNT_FROM_CAMPAIGN_TOOL.name:
        if (!isDeleteEmailAccountFromCampaignParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        responseData = (await withRetry(() => apiClient.delete(`/campaigns/${args.campaign_id}/email-accounts/${args.email_account_id}`), name)).data;
        break;
      
      case ADD_LEAD_TO_CAMPAIGN_TOOL.name:
        if (!isAddLeadToCampaignParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        paramsForApi = { lead_list: args.lead_list, settings: args.settings || {} };
        responseData = (await withRetry(() => apiClient.post(`/campaigns/${args.campaign_id}/leads`, paramsForApi), name)).data;
        break;

      case UPDATE_LEAD_IN_CAMPAIGN_TOOL.name:
        if (!isUpdateLeadInCampaignParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        paramsForApi = { lead: args.lead };
        // Smartlead API for single lead update might be POST or PUT. User's old code used POST.
        responseData = (await withRetry(() => apiClient.post(`/campaigns/${args.campaign_id}/leads/${args.lead_id}`, paramsForApi), name)).data;
        break;

      case DELETE_LEAD_FROM_CAMPAIGN_TOOL.name:
        if (!isDeleteLeadFromCampaignParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        responseData = (await withRetry(() => apiClient.delete(`/campaigns/${args.campaign_id}/leads/${args.lead_id}`), name)).data;
        break;

      // --- Enhanced Analytics Tool Handlers ---
      case LIST_LEADS_BY_CAMPAIGN_TOOL.name:
        if (!isListLeadsByCampaignParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        paramsForApi = { ...args }; delete paramsForApi.campaign_id; // campaign_id is in path
        responseData = (await withRetry(() => apiClient.get(`/campaigns/${args.campaign_id}/leads`, { params: paramsForApi }), name)).data;
        break;

      case GET_CAMPAIGN_STATISTICS_TOOL.name:
        if (!isGetCampaignStatisticsParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        paramsForApi = { ...args }; delete paramsForApi.campaign_id; // campaign_id is in path
        responseData = (await withRetry(() => apiClient.get(`/campaigns/${args.campaign_id}/statistics`, { params: paramsForApi }), name)).data;
        break;

      case GET_LEAD_MESSAGE_HISTORY_TOOL.name:
        if (!isGetLeadMessageHistoryParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        responseData = (await withRetry(() => apiClient.get(`/campaigns/${args.campaign_id}/leads/${args.lead_id}/message-history`), name)).data;
        break;

      case GET_CAMPAIGN_ANALYTICS_TOOL.name:
        if (!isGetCampaignAnalyticsParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        responseData = (await withRetry(() => apiClient.get(`/campaigns/${args.campaign_id}/analytics`), name)).data;
        break;

      case GET_CAMPAIGN_ANALYTICS_BY_DATE_TOOL.name:
        if (!isGetCampaignAnalyticsByDateParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        paramsForApi = { start_date: args.start_date, end_date: args.end_date };
        responseData = (await withRetry(() => apiClient.get(`/campaigns/${args.campaign_id}/analytics-by-date`, { params: paramsForApi }), name)).data;
        break;

      case SEARCH_LEADS_BY_EMAIL_TOOL.name:
        if (!isSearchLeadsByEmailParams(args)) throw new McpError(ErrorCode.InvalidParams, `Invalid args for ${name}`);
        // Using the corrected endpoint style from user's previous working client
        responseData = (await withRetry(() => apiClient.get(`/leads/`, { params: { email: args.email } }), name)).data;
        break;

      default:
        console.error(`Unknown tool called: ${name}`);
        throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }
    return createTextResponse(responseData);

  } catch (error) {
    let mcpError: McpError;
    if (error instanceof McpError) {
      mcpError = error;
    } else if (axios.isAxiosError(error)) {
      const axiosError = error as AxiosError;
      const status = axiosError.response?.status || 500;
      let message = `Smartlead API Error: ${status} ${axiosError.message}`;
      if (axiosError.response?.data) {
        // Try to get more specific error message from Smartlead
        const responseData = axiosError.response.data as any;
        message += ` - ${responseData.message || responseData.error || JSON.stringify(responseData)}`;
      }
      mcpError = new McpError(ErrorCode.InternalError, message); // Or map status to MCP error codes
    } else if (error instanceof Error) {
      mcpError = new McpError(ErrorCode.InternalError, `Tool handler error: ${error.message}`);
    } else {
      mcpError = new McpError(ErrorCode.InternalError, `Unknown error in tool handler: ${String(error)}`);
    }
    console.error(`Error processing ${name}:`, mcpError);
    // Return an error structure that MCP clients expect for CallToolResponse
    return createMcpErrorResponse(mcpError.message, mcpError.code as ErrorCode);
  }
});


// --- Server Startup ---
async function main() {
  if (!SMARTLEAD_API_KEY) { // Redundant check, already did global, but good for main's scope
    console.error('FATAL: SMARTLEAD_API_KEY environment variable is not set in main. Server cannot start.');
    process.exit(1);
  }
  
  const transport = new StdioServerTransport();
  try {
    await server.connect(transport);
    console.error('Enhanced Smartlead MCP server running on stdio');
  } catch (connectionError) {
    console.error('Failed to connect server to transport:', connectionError);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Unhandled fatal error in main execution:', error);
  process.exit(1);
});
