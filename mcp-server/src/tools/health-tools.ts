import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerHealthTools(server: McpServer) {
  server.tool(
    "get_health",
    "Check the health status of the backend API",
    {},
    async () => {
      const result = await apiClient.get("/api/health");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
