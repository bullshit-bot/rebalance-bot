import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSmartOrderTools(server: McpServer) {
  server.tool(
    "create_smart_order",
    "Create a TWAP/smart order that executes in slices over time",
    {
      type: z.string().describe("Order type, e.g. TWAP"),
      exchange: z.string().describe("Exchange to execute on"),
      pair: z.string().describe("Trading pair, e.g. ETH/USDT"),
      side: z.enum(["buy", "sell"]).describe("Order side"),
      totalAmount: z.number().describe("Total order amount"),
      slicesTotal: z.number().int().positive().describe("Number of slices to split the order into"),
      durationMs: z.number().int().positive().describe("Total execution duration in milliseconds"),
    },
    async ({ type, exchange, pair, side, totalAmount, slicesTotal, durationMs }) => {
      const result = await apiClient.post("/api/smart-orders", {
        type, exchange, pair, side, totalAmount, slicesTotal, durationMs,
      });
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_smart_orders",
    "List all smart orders and their execution status",
    {},
    async () => {
      const result = await apiClient.get("/api/smart-orders");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "cancel_smart_order",
    "Cancel a pending or running smart order by ID",
    {
      id: z.string().describe("Smart order document ID to cancel"),
    },
    async ({ id }) => {
      const result = await apiClient.post(`/api/smart-orders/${id}/cancel`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
