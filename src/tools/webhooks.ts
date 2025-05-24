import { SmartLeadClient } from '../utils/smartlead-client.js';

export const webhookTools = [
  {
    name: "webhook_create",
    description: "Create a webhook for real-time event notifications",
    inputSchema: {
      type: "object",
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
      type: "object",
      properties: {}
    }
  },
  {
    name: "webhook_delete",
    description: "Delete a webhook",
    inputSchema: {
      type: "object",
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
      const data = await client.post('/webhooks', {
        url: args.url,
        events: args.events,
        campaignId: args.campaignId
      });
      return {
        content: [{
          type: "text",
          text: `Webhook created successfully. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }

    case 'webhook_list': {
      const data = await client.get('/webhooks');
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }

    case 'webhook_delete': {
      const data = await client.delete(`/webhooks/${args.webhookId}`);
      return {
        content: [{
          type: "text",
          text: `Webhook deleted successfully. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }

    default:
      throw new Error(`Unknown webhook tool: ${name}`);
  }
}
