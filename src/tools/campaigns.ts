import { z } from 'zod';
import { SmartLeadClient } from '../utils/smartlead-client.js';
import { Tool } from '@modelcontextprotocol/sdk/types.js';

export const campaignTools: Tool[] = [
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
  }
];

export async function handleCampaignTool(name: string, args: any, apiKey: string) {
  const client = new SmartLeadClient(apiKey);

  switch (name) {
    case 'campaign_list': {
      const data = await client.get('/campaigns', {
        offset: args.offset || 0,
        limit: args.limit || 100
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }

    case 'campaign_get': {
      const data = await client.get(`/campaigns/${args.campaignId}`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }

    case 'campaign_status_update': {
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

    default:
      throw new Error(`Unknown campaign tool: ${name}`);
  }
}
