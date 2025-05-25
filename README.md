# Enhanced SmartLead MCP Server

MCP (Model Context Protocol) server for SmartLead that enables Claude Desktop to interact with your SmartLead campaigns, leads, analytics, and more.

## Features

- 🚀 **Campaign Management**: Create, update, delete, and manage campaigns
- 👥 **Lead Management**: Add, update, and manage leads within campaigns
- 📊 **Analytics**: Get campaign and email account analytics
- 💬 **Reply Management**: Send replies and manage conversations
- 🔗 **Webhook Management**: Create and manage webhooks

## Deployment

This server is designed to be deployed on Railway and accessed via Claude Desktop.

### Railway Deployment

[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

1. Click the button above or deploy manually
2. Set the `SMARTLEAD_API_KEY` environment variable in Railway
3. Wait for deployment to complete
4. Copy your Railway URL

### Claude Desktop Setup

1. Open Claude Desktop
2. Go to Settings → Profile → Integrations
3. Click "Add more"
4. Enter your Railway URL: `https://your-app.up.railway.app`
5. Click "Add"

## Available Tools

- `list_campaigns` - List all campaigns
- `get_campaign` - Get campaign details
- `create_campaign` - Create new campaign
- `update_campaign` - Update campaign
- `delete_campaign` - Delete campaign
- `get_campaign_schedules` - Get campaign schedules
- `add_leads_to_campaign` - Add leads to campaign
- `get_leads_from_campaign` - Get leads from campaign
- `update_lead` - Update lead information
- `delete_lead` - Remove lead from campaign
- `get_campaign_analytics` - Get campaign analytics
- `get_email_account_analytics` - Get email analytics
- `get_master_inbox_stats` - Get inbox statistics
- `send_reply` - Send reply to lead
- `get_conversations` - Get conversations
- `list_webhooks` - List webhooks
- `create_webhook` - Create webhook
- `delete_webhook` - Delete webhook

## Environment Variables

- `SMARTLEAD_API_KEY` (required) - Your SmartLead API key
- `SMARTLEAD_API_URL` (optional) - Custom API URL
- `SMARTLEAD_RETRY_MAX_ATTEMPTS` (optional) - Max retry attempts
- `SMARTLEAD_RETRY_INITIAL_DELAY` (optional) - Initial retry delay
- `SMARTLEAD_RETRY_MAX_DELAY` (optional) - Max retry delay
- `SMARTLEAD_RETRY_BACKOFF_FACTOR` (optional) - Retry backoff factor

## License

MIT
