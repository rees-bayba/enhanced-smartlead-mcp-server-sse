import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SmartLeadClient } from '../utils/smartlead-client.js';

export const replyTools: Tool[] = [
  {
    name: "reply_get_all",
    description: "Get all replies for a campaign with full message content",
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
    name: "reply_get_message_history",
    description: "Get complete message history for a specific lead",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        },
        leadId: {
          type: "number",
          description: "The lead ID"
        }
      },
      required: ["campaignId", "leadId"]
    }
  },
  {
    name: "reply_send",
    description: "Send a reply to a lead",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        },
        leadId: {
          type: "number",
          description: "The lead ID"
        },
        message: {
          type: "string",
          description: "Reply message content"
        }
      },
      required: ["campaignId", "leadId", "message"]
    }
  }
];

export async function handleReplyTool(name: string, args: any, apiKey: string) {
  const client = new SmartLeadClient(apiKey);

  switch (name) {
    case 'reply_get_all': {
      if (!args?.campaignId) {
        throw new Error('campaignId is required');
      }
      const data = await client.get(`/campaigns/${args.campaignId}/leads`, {
        offset: args?.offset || 0,
        limit: args?.limit || 100,
        lead_status: 'REPLIED' // Filter for only replied leads
      });
      
      // Extract just the replies with relevant info
      const replies = data.data?.filter((lead: any) => lead.last_reply) || [];
      const formattedReplies = replies.map((lead: any) => ({
        lead_email: lead.email,
        lead_name: `${lead.first_name || ''} ${lead.last_name || ''}`.trim(),
        company: lead.company_name,
        reply_date: lead.last_reply_time,
        reply_content: lead.last_reply,
        lead_category: lead.lead_category,
        lead_id: lead.id
      }));
      
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify({
            total_replies: data.total_replied || replies.length,
            replies: formattedReplies
          }, null, 2)
        }]
      };
    }

    case 'reply_get_message_history': {
      if (!args?.campaignId || !args?.leadId) {
        throw new Error('campaignId and leadId are required');
      }
      const data = await client.get(`/campaigns/${args.campaignId}/leads/${args.leadId}/message-history`);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(data, null, 2)
        }]
      };
    }

    case 'reply_send': {
      if (!args?.campaignId || !args?.leadId || !args?.message) {
        throw new Error('campaignId, leadId, and message are required');
      }
      const data = await client.post(`/campaigns/${args.campaignId}/leads/${args.leadId}/reply`, {
        message: args.message
      });
      return {
        content: [{
          type: "text" as const,
          text: `Reply sent successfully. Response: ${JSON.stringify(data, null, 2)}`
        }]
      };
    }

    default:
      throw new Error(`Unknown reply tool: ${name}`);
  }
}
