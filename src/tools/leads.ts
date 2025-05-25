import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SmartLeadClient } from '../utils/smartlead-client.js';

export const leadTools: Tool[] = [
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
  }
];

export async function handleLeadTool(name: string, args: any, apiKey: string) {
  const client = new SmartLeadClient(apiKey);

  switch (name) {
    case 'lead_list_by_campaign': {
      if (!args?.campaignId) {
        throw new Error('campaignId is required');
      }
      const data = await client.get(`/campaigns/${args.campaignId}/leads`, {
        offset: args?.offset || 0,
        limit: args?.limit || 100
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(data, null, 2)
        }]
      };
    }

    case 'lead_search_by_email': {
      if (!args?.email) {
        throw new Error('email is required');
      }
      const data = await client.get('/leads/search', {
        email: args.email
      });
      return {
        content: [{
          type: "text" as const,
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
          type: "text" as const,
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
          type: "text" as const,
          text: `Added ${args.emails.length} email(s) to blocklist. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }

    default:
      throw new Error(`Unknown lead tool: ${name}`);
  }
}
