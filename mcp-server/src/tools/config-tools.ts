import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerConfigTools(server: McpServer) {
  server.tool(
    "get_config",
    "Get the current bot configuration settings",
    {},
    async () => {
      const result = await apiClient.get("/api/config");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "update_config",
    "Update bot configuration settings",
    {
      config: z.record(z.unknown()).describe("Configuration object with key-value pairs to update"),
    },
    async ({ config }) => {
      const result = await apiClient.post("/api/config", config as Record<string, unknown>);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
