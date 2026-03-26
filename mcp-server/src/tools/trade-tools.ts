import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerTradeTools(server: McpServer) {
  server.tool(
    "list_trades",
    "List recent trades executed by the bot",
    {
      limit: z.number().int().positive().optional().describe("Max number of trades to return"),
      exchange: z.string().optional().describe("Filter by exchange name"),
    },
    async ({ limit, exchange }) => {
      const params = new URLSearchParams();
      if (limit !== undefined) params.set("limit", String(limit));
      if (exchange !== undefined) params.set("exchange", exchange);
      const qs = params.toString() ? `?${params.toString()}` : "";
      const result = await apiClient.get(`/api/trades${qs}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
