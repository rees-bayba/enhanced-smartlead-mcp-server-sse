# Enhanced Smartlead MCP Server with Analytics

> **Built on the proven working Smartlead MCP server + critical missing analytics**

This is an enhanced version of the working [Smartlead MCP Server](https://github.com/jacob-dietle/smartlead-mcp-server-sse) that adds the missing analytics capabilities you need for campaign performance insights.

## ✅ What's Proven to Work (Kept Exactly the Same)

- All existing Smartlead campaign management tools
- Railway deployment with Supergateway + SSE
- Same environment variables and configuration
- Same Docker setup and health checks
- Same Claude Desktop integration pattern

## 🚀 What's New (Critical Missing Analytics)

### **The Big 3 Analytics Functions**
- **`smartlead_list_leads_by_campaign`** - Get all leads with status and sequence position
- **`smartlead_get_campaign_statistics`** - Detailed metrics filterable by sequence number  
- **`smartlead_get_lead_message_history`** - Individual lead email interaction history

### **Additional Analytics**
- **`smartlead_get_campaign_analytics`** - Comprehensive campaign performance
- **`smartlead_get_campaign_analytics_by_date`** - Time-series performance tracking
- **`smartlead_search_leads_by_email`** - Cross-campaign lead lookup

## 🎯 Key Questions This Now Answers

✅ "Which sequence gets the most replies?"
✅ "What leads replied and when?"
✅ "How is my campaign performing over time?"
✅ "Which leads are in which campaigns?"
✅ "What's the customer journey for lead X?"

## 🚀 Deploy to Railway (Same as Original)

### **One-Click Deploy**
[![Deploy on Railway](https://railway.app/button.svg)](https://railway.app/new/template)

### **Manual Deploy**
1. Fork this repository
2. Create Railway project from GitHub repo
3. Add environment variable: `SMARTLEAD_API_KEY=your_key`
4. Deploy!

## 📱 Claude Desktop Integration (Same Pattern)

Add to your `mcp.json`:

```json
{
  "mcpServers": {
    "enhanced_smartlead_sse": {
      "url": "https://your-railway-app.railway.app/sse",
      "disabled": false,
      "alwaysAllow": [
        // Original working tools
        "smartlead_create_campaign",
        "smartlead_list_campaigns",
        "smartlead_get_campaign",
        "smartlead_save_campaign_sequence",
        "smartlead_get_campaign_sequence",
        "smartlead_add_lead_to_campaign",
        
        // NEW: Enhanced analytics
        "smartlead_list_leads_by_campaign",
        "smartlead_get_campaign_statistics",
        "smartlead_get_lead_message_history",
        "smartlead_get_campaign_analytics",
        "smartlead_search_leads_by_email"
      ],
      "timeout": 300
    }
  }
}
🔥 Usage Examples
Sequence Performance Analysis
"Which sequence in campaign 123 gets the most replies?"

"Show me performance statistics for sequence 2 in campaign 123"
Lead Journey Tracking
"Show me all leads in campaign 123 and their current status"

"What's the complete email history for lead 456 in campaign 123?"
Cross-Campaign Analysis
"Search for john@company.com across all my campaigns"

"Show me campaign 123 performance trends over the last month"
🛠️ Environment Variables (Same as Original)
VariableRequiredDefaultDescriptionSMARTLEAD_API_KEY✅-Your Smartlead API keySMARTLEAD_API_URL❌https://server.smartlead.ai/api/v1API base URLDEBUG❌falseEnable debug loggingPORT❌8000Server port (set by Railway)
🔧 Local Development (Same Process)
bash# Clone and setup
git clone <your-repo>
cd enhanced-smartlead-mcp-server-sse
npm install

# Configure
cp .env.example .env
# Edit .env with your SMARTLEAD_API_KEY

# Build and run
npm run build
npm start
✅ What This Maintains
Same Reliability

Exact same MCP server architecture
Same Supergateway + SSE setup
Same error handling patterns
Same retry logic and configuration

Same Deployment

Identical Railway deployment process
Same Dockerfile and health checks
Same environment variable structure
Same Claude Desktop integration

All Original Tools

Campaign creation and management
Email sequence management
Lead addition and updates
Email account management
Campaign scheduling

🆕 What This Adds
Campaign Analytics

Sequence-level performance metrics
Time-series campaign analytics
Lead engagement tracking

Lead Intelligence

Complete lead journey tracking
Cross-campaign lead search
Lead status and sequence position

Performance Insights

Reply attribution to specific sequences
Campaign optimization data
Lead behavior analysis

🐛 Troubleshooting (Same as Original)
Connection Issues

Verify Railway URL includes /sse
Check Railway deployment is running
Restart Claude Desktop after config changes

API Issues

Verify SMARTLEAD_API_KEY in Railway dashboard
Check API key permissions in Smartlead
Enable DEBUG=true for verbose logging


Built on the proven foundation of jacob-dietle/smartlead-mcp-server-sse
Same reliability, same deployment, enhanced analytics.
