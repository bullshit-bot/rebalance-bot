import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAllocationTools(server: McpServer) {
  server.tool(
    "list_allocations",
    "List all target allocation configurations",
    {},
    async () => {
      const result = await apiClient.get("/api/allocations");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "create_allocation",
    "Create a new target allocation for an asset",
    {
      asset: z.string().describe("Asset symbol, e.g. BTC"),
      targetPct: z.number().describe("Target allocation percentage (0-100)"),
      exchange: z.string().optional().describe("Exchange to use for this allocation"),
      minTradeUsd: z.number().optional().describe("Minimum trade size in USD"),
    },
    async ({ asset, targetPct, exchange, minTradeUsd }) => {
      const body: Record<string, unknown> = { asset, targetPct };
      if (exchange !== undefined) body.exchange = exchange;
      if (minTradeUsd !== undefined) body.minTradeUsd = minTradeUsd;
      const result = await apiClient.post("/api/allocations", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_allocation",
    "Update an existing allocation by ID",
    {
      id: z.string().describe("Allocation document ID"),
      targetPct: z.number().optional().describe("New target percentage"),
      minTradeUsd: z.number().optional().describe("New minimum trade size in USD"),
    },
    async ({ id, targetPct, minTradeUsd }) => {
      const body: Record<string, unknown> = {};
      if (targetPct !== undefined) body.targetPct = targetPct;
      if (minTradeUsd !== undefined) body.minTradeUsd = minTradeUsd;
      const result = await apiClient.put(`/api/allocations/${id}`, body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "delete_allocation",
    "Delete an allocation by ID",
    {
      id: z.string().describe("Allocation document ID to delete"),
    },
    async ({ id }) => {
      const result = await apiClient.delete(`/api/allocations/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
