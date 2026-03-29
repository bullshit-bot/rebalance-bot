import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerCopyTradingTools(server: McpServer) {
  server.tool(
    "list_copy_sources",
    "List all copy trading sources being tracked",
    {},
    async () => {
      const result = await apiClient.get("/api/copy/sources");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "create_copy_source",
    "Add a new copy trading source to follow. sourceType must be 'url' or 'manual'.",
    {
      name: z.string().describe("Display name for this copy source"),
      sourceType: z.enum(["url", "manual"]).describe("Type of source: 'url' or 'manual'"),
      sourceUrl: z.string().optional().describe("URL or address of the source (required when sourceType is 'url')"),
      allocations: z.array(z.object({
        asset: z.string(),
        targetPct: z.number(),
      })).describe("Asset allocation array, e.g. [{asset: 'BTC', targetPct: 60}]"),
      weight: z.number().optional().describe("Weight of this source in the overall portfolio (0-1)"),
      syncInterval: z.number().int().positive().optional().describe("Sync interval in milliseconds"),
    },
    async ({ name, sourceType, sourceUrl, allocations, weight, syncInterval }) => {
      const body: Record<string, unknown> = { name, sourceType, allocations };
      if (sourceUrl !== undefined) body.sourceUrl = sourceUrl;
      if (weight !== undefined) body.weight = weight;
      if (syncInterval !== undefined) body.syncInterval = syncInterval;
      const result = await apiClient.post("/api/copy/source", body);
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
      const result = await apiClient.delete(`/api/copy/source/${id}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
