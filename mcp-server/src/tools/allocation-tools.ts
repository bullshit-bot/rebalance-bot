import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerAllocationTools(server: McpServer) {
  server.tool(
    "list_allocations",
    "List all target allocation configurations (read-only)",
    {},
    async () => {
      const result = await apiClient.get("/api/config/allocations");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
