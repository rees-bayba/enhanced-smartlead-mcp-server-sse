# Smartlead MCP Server + Analytics  
*A minimal fork of the original work by **[Jacob Dietl](https://github.com/jacob-dietle/smartlead-mcp-server-sse)**.*

This keeps **everything** that already works in Jacob’s Smartlead MCP server and **adds just the analytics endpoints you’ve probably been missing.**

---

## 1 — What’s New

| Function | Purpose |
| --- | --- |
| `smartlead_list_leads_by_campaign` | All leads in a campaign with status & sequence position |
| `smartlead_get_campaign_statistics` | Sequence-level reply / open / click metrics |
| `smartlead_get_lead_message_history` | Full email history for one lead |
| `smartlead_get_campaign_analytics` | Roll-up performance for a campaign |
| `smartlead_get_campaign_analytics_by_date` | Day-by-day performance trend |
| `smartlead_search_leads_by_email` | Find one lead across every campaign |

---

## 2 — Deploy to Railway

```bash
# one-click (same as the original template)
https://railway.app/new/template
