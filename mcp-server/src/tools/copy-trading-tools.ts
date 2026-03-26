import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCopyTradingTools(server: McpServer) {
  server.tool(
    "list_copy_sources",
    "List all copy trading sources being tracked",
    {},
    async () => {
      const result = await apiClient.get("/api/copy-trading");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "create_copy_source",
    "Add a new copy trading source to follow",
    {
      name: z.string().describe("Display name for this copy source"),
      sourceType: z.string().describe("Type of source, e.g. wallet, exchange"),
      sourceUrl: z.string().optional().describe("URL or address of the source"),
      allocations: z.record(z.number()).describe("Asset allocation map, e.g. {BTC: 60, ETH: 40}"),
      weight: z.number().optional().describe("Weight of this source in the overall portfolio (0-1)"),
    },
    async ({ name, sourceType, sourceUrl, allocations, weight }) => {
      const body: Record<string, unknown> = { name, sourceType, allocations };
      if (sourceUrl !== undefined) body.sourceUrl = sourceUrl;
      if (weight !== undefined) body.weight = weight;
      const result = await apiClient.post("/api/copy-trading", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "delete_copy_source",
    "Remove a copy trading source by ID",
    {
      id: z.string().describe("Copy source document ID to delete"),
    },
    async ({ id }) => {
      const result = await apiClient.delete(`/api/copy-trading/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
