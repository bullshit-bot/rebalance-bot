import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPortfolioTools(server: McpServer) {
  server.tool(
    "get_portfolio",
    "Get current portfolio: balances, allocations, totalInvested, and PnL data across all exchanges",
    {},
    async () => {
      const result = await apiClient.get("/api/portfolio");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_capital_flows",
    "Get capital flow history: all deposits and their amounts. Used for PnL tracking (totalInvested = sum of deposits).",
    {},
    async () => {
      const result = await apiClient.get("/api/portfolio/capital-flows");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
