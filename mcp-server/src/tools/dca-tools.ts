import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerDcaTools(server: McpServer) {
  server.tool(
    "trigger_dca",
    "Manually trigger a DCA (Dollar-Cost Averaging) deposit. Executes scheduled DCA orders independently of the cron schedule.",
    {},
    async () => {
      const result = await apiClient.post("/api/dca/trigger");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
