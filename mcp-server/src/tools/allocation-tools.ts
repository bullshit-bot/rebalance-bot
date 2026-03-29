import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAllocationTools(server: McpServer) {
  server.tool(
    "list_allocations",
    "List all target allocation configurations",
    {},
    async () => {
      const result = await apiClient.get("/api/config/allocations");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "set_allocations",
    "Replace all target allocations at once. Replaces the full set — include all desired assets. Total targetPct must not exceed 100.",
    {
      allocations: z.array(z.object({
        asset: z.string().describe("Asset symbol, e.g. BTC"),
        targetPct: z.number().min(0).max(100).describe("Target allocation percentage (0-100)"),
        exchange: z.string().optional().describe("Exchange override, e.g. 'binance'"),
        minTradeUsd: z.number().optional().describe("Minimum trade size in USD"),
      })).describe("Complete list of allocations to apply"),
    },
    async ({ allocations }) => {
      const result = await apiClient.put("/api/config/allocations", allocations as unknown as Record<string, unknown>);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "delete_allocation",
    "Delete all allocation rows for a specific asset symbol",
    {
      asset: z.string().describe("Asset symbol to remove, e.g. BTC"),
    },
    async ({ asset }) => {
      const result = await apiClient.delete(`/api/config/allocations/${asset}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
