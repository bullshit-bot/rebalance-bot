import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAiTools(server: McpServer) {
  server.tool(
    "get_ai_suggestions",
    "Get AI-generated rebalancing or trade suggestions. Optionally filter by status.",
    {
      status: z.enum(["pending", "approved", "rejected"]).optional().describe("Filter by suggestion status"),
      limit: z.number().int().positive().optional().describe("Max number of suggestions to return"),
    },
    async ({ status, limit }) => {
      const params = new URLSearchParams();
      if (status !== undefined) params.set("status", status);
      if (limit !== undefined) params.set("limit", String(limit));
      const qs = params.toString() ? `?${params.toString()}` : "";
      const result = await apiClient.get(`/api/ai/suggestions${qs}`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "approve_suggestion",
    "Approve a pending AI suggestion to apply its allocations",
    {
      id: z.string().describe("AI suggestion document ID to approve"),
    },
    async ({ id }) => {
      // Route is PUT /api/ai/suggestion/:id/approve (singular)
      const result = await apiClient.put(`/api/ai/suggestion/${id}/approve`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "reject_suggestion",
    "Reject a pending AI suggestion to dismiss it without applying",
    {
      id: z.string().describe("AI suggestion document ID to reject"),
    },
    async ({ id }) => {
      // Route is PUT /api/ai/suggestion/:id/reject (singular)
      const result = await apiClient.put(`/api/ai/suggestion/${id}/reject`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
