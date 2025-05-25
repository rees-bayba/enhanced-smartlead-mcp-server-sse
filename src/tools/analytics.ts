import { Tool } from '@modelcontextprotocol/sdk/types.js';
import { SmartLeadClient } from '../utils/smartlead-client.js';

export const analyticsTools: Tool[] = [
  {
    name: "analytics_campaign_overview",
    description: "Get campaign statistics including sent, opened, clicked, replied counts",
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
    name: "analytics_campaign_by_date",
    description: "Get campaign analytics for a specific date range",
    inputSchema: {
      type: "object" as const,
      properties: {
        campaignId: {
          type: "number",
          description: "The campaign ID"
        },
        startDate: {
          type: "string",
          description: "Start date (YYYY-MM-DD)"
        },
        endDate: {
          type: "string",
          description: "End date (YYYY-MM-DD)"
        }
      },
      required: ["campaignId", "startDate", "endDate"]
    }
  },
  {
    name: "analytics_sequence_performance",
    description: "Get performance metrics for each sequence step",
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
  }
];

export async function handleAnalyticsTool(name: string, args: any, apiKey: string) {
  const client = new SmartLeadClient(apiKey);

  switch (name) {
    case 'analytics_campaign_overview': {
      if (!args?.campaignId) {
        throw new Error('campaignId is required');
      }
      const data = await client.get(`/campaigns/${args.campaignId}/analytics`);
      
      // Calculate additional metrics
      const sentCount = data.sent_count || 0;
      const openCount = data.open_count || 0;
      const replyCount = data.reply_count || 0;
      const clickCount = data.click_count || 0;
      
      const openRate = sentCount > 0 ? (openCount / sentCount * 100).toFixed(2) : "0";
      const replyRate = sentCount > 0 ? (replyCount / sentCount * 100).toFixed(2) : "0";
      const clickRate = sentCount > 0 ? (clickCount / sentCount * 100).toFixed(2) : "0";
      
      const enhanced = {
        ...data,
        calculated_metrics: {
          open_rate: `${openRate}%`,
          reply_rate: `${replyRate}%`,
          click_rate: `${clickRate}%`
        }
      };
      
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(enhanced, null, 2)
        }]
      };
    }

    case 'analytics_campaign_by_date': {
      if (!args?.campaignId || !args?.startDate || !args?.endDate) {
        throw new Error('campaignId, startDate, and endDate are required');
      }
      const data = await client.get(`/campaigns/${args.campaignId}/analytics-by-date`, {
        start_date: args.startDate,
        end_date: args.endDate
      });
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(data, null, 2)
        }]
      };
    }

    case 'analytics_sequence_performance': {
      if (!args?.campaignId) {
        throw new Error('campaignId is required');
      }
      const data = await client.get(`/campaigns/${args.campaignId}/sequence-analytics`);
      return {
        content: [{
          type: "text" as const,
          text: JSON.stringify(data, null, 2)
        }]
      };
    }

    default:
      throw new Error(`Unknown analytics tool: ${name}`);
  }
}
