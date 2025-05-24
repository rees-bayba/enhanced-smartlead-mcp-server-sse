import { SmartLeadClient } from '../utils/smartlead-client.js';

export const analyticsTools = [
  {
    name: "analytics_campaign_overview",
    description: "Get campaign statistics including sent, opened, clicked, replied counts",
    inputSchema: {
      type: "object",
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
      type: "object",
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
      type: "object",
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
      const data = await client.get(`/campaigns/${args.campaignId}/analytics`);
      
      // Calculate additional metrics
      const openRate = data.sent_count > 0 ? (data.open_count / data.sent_count * 100).toFixed(2) : 0;
      const replyRate = data.sent_count > 0 ? (data.reply_count / data.sent_count * 100).toFixed(2) : 0;
      
      const enhanced = {
        ...data,
        calculated_metrics: {
          open_rate: `${openRate}%`,
          reply_rate: `${replyRate}%`,
          click_rate: data.sent_count > 0 ? `${(data.click_count / data.sent_count * 100).toFixed(2)}%` : '0%'
        }
      };
      
      return {
        content: [{
          type: "text",
          text: JSON.stringify(enhanced, null, 2)
        }]
      };
    }

    case 'analytics_campaign_by_date': {
      const data = await client.get(`/campaigns/${args.campaignId}/analytics-by-date`, {
        start_date: args.startDate,
        end_date: args.endDate
      });
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }

    case 'analytics_sequence_performance': {
      const data = await client.get(`/campaigns/${args.campaignId}/sequence-analytics`);
      return {
        content: [{
          type: "text",
          text: JSON.stringify(data, null, 2)
        }]
      };
    }

    default:
      throw new Error(`Unknown analytics tool: ${name}`);
  }
}
