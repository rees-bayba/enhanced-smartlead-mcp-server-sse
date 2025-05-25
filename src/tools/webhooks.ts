import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SmartLeadClient } from '../utils/smartlead-client.js';

export const webhookTools: Tool[] = [
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

export async function handleWebhookTool(name: string, args: any, apiKey: string) {
  const client = new SmartLeadClient(apiKey);

  switch (name) {
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
          type: "text" as const,
          text: `Webhook created successfully. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }

    case 'webhook_list': {
      const data = await client.get('/webhooks');
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(data, null, 2)
        }]
      };
    }

    case 'webhook_delete': {
      if (!args?.webhookId) {
        throw new Error('webhookId is required');
      }
      const data = await client.delete(`/webhooks/${args.webhookId}`);
      return {
        content: [{
          type: "text" as const,
          text: `Webhook deleted successfully. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }

    default:
      throw new Error(`Unknown webhook tool: ${name}`);
  }
}
