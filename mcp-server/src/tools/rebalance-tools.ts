import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerRebalanceTools(server: McpServer) {
  server.tool(
    "trigger_rebalance",
    "Trigger a portfolio rebalance to bring allocations back to target percentages",
    {},
    async () => {
      const result = await apiClient.post("/api/rebalance");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "get_rebalance_history",
    "Get the history of past rebalance operations",
    {
      limit: z.number().int().positive().optional().describe("Max number of records to return"),
    },
    async ({ limit }) => {
      const qs = limit !== undefined ? `?limit=${limit}` : "";
      const result = await apiClient.get(`/api/rebalance/history${qs}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
