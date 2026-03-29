import { z } from "zod";
import { apiClient } from "../api-client.js";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

export function registerSmartOrderTools(server: McpServer) {
  server.tool(
    "create_smart_order",
    "Create a TWAP or VWAP smart order that executes in slices over time",
    {
      type: z.enum(["twap", "vwap"]).describe("Order type: 'twap' (time-weighted) or 'vwap' (volume-weighted)"),
      exchange: z.string().describe("Exchange to execute on"),
      pair: z.string().describe("Trading pair, e.g. ETH/USDT"),
      side: z.enum(["buy", "sell"]).describe("Order side"),
      totalAmount: z.number().describe("Total order amount"),
      slices: z.number().int().positive().describe("Number of slices to split the order into"),
      durationMs: z.number().int().positive().describe("Total execution duration in milliseconds"),
      rebalanceId: z.string().optional().describe("Optional rebalance operation ID to link this order to"),
    },
    async ({ type, exchange, pair, side, totalAmount, slices, durationMs, rebalanceId }) => {
      const body: Record<string, unknown> = { type, exchange, pair, side, totalAmount, slices, durationMs };
      if (rebalanceId !== undefined) body.rebalanceId = rebalanceId;
      const result = await apiClient.post("/api/smart-order", body);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "list_smart_orders",
    "List all currently active smart orders and their execution progress",
    {},
    async () => {
      const result = await apiClient.get("/api/smart-order/active");
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );

  server.tool(
    "cancel_smart_order",
    "Cancel a pending or running smart order by ID. Partial fills are preserved.",
    {
      id: z.string().describe("Smart order document ID to cancel"),
    },
    async ({ id }) => {
      // Route is PUT /api/smart-order/:id/cancel
      const result = await apiClient.put(`/api/smart-order/${id}/cancel`);
      return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
    }
  );
}
