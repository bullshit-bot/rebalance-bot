import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerConfigTools(server: McpServer) {
  server.tool(
    "get_ai_config",
    "Get current AI suggestion handler config (autoApprove, maxAllocationShiftPct)",
    {},
    async () => {
      // /api/config is mounted at /api/config via configRoutes (allocations only)
      // AI config is managed via PUT /api/ai/config — no GET endpoint exists
      // Return a descriptive message directing to use get_ai_suggestions instead
      const result = await apiClient.get("/api/ai/suggestions?limit=1");
      return {
        content: [{
          type: "text",
          text: "Note: no dedicated GET /api/ai/config endpoint exists. Use update_ai_config (PUT) to change autoApprove/maxShiftPct, and get_ai_suggestions to view pending suggestions.\n\nSample suggestions response:\n" + JSON.stringify(result, null, 2),
        }],
      };
    }
  );

  server.tool(
    "update_ai_config",
    "Update AI suggestion handler settings: autoApprove and/or maxShiftPct",
    {
      autoApprove: z.boolean().optional().describe("Automatically approve AI suggestions when true"),
      maxShiftPct: z.number().positive().optional().describe("Maximum allowed allocation shift percentage per suggestion"),
    },
    async ({ autoApprove, maxShiftPct }) => {
      const body: Record<string, unknown> = {};
      if (autoApprove !== undefined) body.autoApprove = autoApprove;
      if (maxShiftPct !== undefined) body.maxShiftPct = maxShiftPct;
      const result = await apiClient.put("/api/ai/config", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
