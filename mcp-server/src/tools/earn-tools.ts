import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerEarnTools(server: McpServer) {
  server.tool(
    "get_earn_status",
    "Get Binance Flexible Earn status: enabled flag, active positions, total value, and APY rates per asset",
    {},
    async () => {
      const result = await apiClient.get("/api/earn/status");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_earn_apy_rates",
    "Get current APY rates for all available Simple Earn assets. Returns map of asset → APY percentage.",
    {},
    async () => {
      const earnStatus = await apiClient.get("/api/earn/status");
      const apyRates = earnStatus.apyRates || {};
      return { content: [{ type: "text", text: JSON.stringify(apyRates, null, 2) }] };
    }
  );
}
