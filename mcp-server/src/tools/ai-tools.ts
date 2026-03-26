import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAiTools(server: McpServer) {
  server.tool(
    "get_ai_suggestions",
    "Get AI-generated rebalancing or trade suggestions",
    {},
    async () => {
      const result = await apiClient.get("/api/ai/suggestions");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "approve_suggestion",
    "Approve an AI suggestion to execute it",
    {
      id: z.string().describe("AI suggestion document ID to approve"),
    },
    async ({ id }) => {
      const result = await apiClient.post(`/api/ai/suggestions/${id}/approve`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "reject_suggestion",
    "Reject an AI suggestion to dismiss it",
    {
      id: z.string().describe("AI suggestion document ID to reject"),
    },
    async ({ id }) => {
      const result = await apiClient.post(`/api/ai/suggestions/${id}/reject`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
