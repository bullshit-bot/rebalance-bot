import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerPortfolioTools(server: McpServer) {
  server.tool(
    "get_portfolio",
    "Get the current portfolio balances and allocations across all exchanges",
    {},
    async () => {
      const result = await apiClient.get("/api/portfolio");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
