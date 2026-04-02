import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerStrategyConfigTools(server: McpServer) {
  server.tool(
    "get_strategy_config",
    "Get the active strategy configuration and list of all saved strategy configs (read-only)",
    {},
    async () => {
      const result = await apiClient.get("/api/strategy-config");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_strategy_presets",
    "List all built-in strategy presets (read-only)",
    {},
    async () => {
      const result = await apiClient.get("/api/strategy-config/presets");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
