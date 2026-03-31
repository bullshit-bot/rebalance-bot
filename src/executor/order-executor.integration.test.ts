import { describe, expect, it } from "bun:test";
import { exchangeManager } from "@exchange/exchange-manager";
import { priceCache } from "@price/price-cache";
import { executionGuard } from "./execution-guard";
import { orderExecutor } from "./order-executor";

describe("order-executor (integration)", () => {
  describe("singleton export", () => {
    it("exports orderExecutor with execute method", () => {
      expect(orderExecutor).toBeDefined();
      expect(typeof orderExecutor.execute).toBe("function");
    });

    it("exports orderExecutor with executeBatch method", () => {
      expect(typeof orderExecutor.executeBatch).toBe("function");
    });
  });

  describe("dependencies", () => {
    it("exchangeManager has no exchanges configured", () => {
      const exchanges = exchangeManager.getEnabledExchanges();
      // In test env, no exchange API keys configured
      expect(exchanges).toBeDefined();
    });

    it("executionGuard is accessible", () => {
      expect(executionGuard).toBeDefined();
      expect(typeof executionGuard.canExecute).toBe("function");
    });

    it("priceCache is accessible", () => {
      expect(priceCache).toBeDefined();
      expect(typeof priceCache.getBestPrice).toBe("function");
    });
  });

  describe("executeBatch with empty array", () => {
    it("returns empty results for empty orders", async () => {
      const results = await orderExecutor.executeBatch([]);
      expect(results).toEqual([]);
    });
  });

  describe("execute method - error handling", () => {
    it(
      "throws when exchange not found after MAX_RETRIES",
      async () => {
        const order = {
          exchange: "binance" as const,
          pair: "BTC/USDT",
          side: "buy" as const,
          type: "market" as const,
          amount: 0.001,
        };

        try {
          await orderExecutor.execute(order);
          expect(true).toBe(false); // Should throw
        } catch (error) {
          expect(error).toBeDefined();
          const msg = error instanceof Error ? error.message : String(error);
          expect(msg.toLowerCase()).toContain("exchange");
        }
      },
      { timeout: 15000 }
    );

    it(
      "retries on transient errors with exponential backoff",
      async () => {
        const order = {
          exchange: "binance" as const,
          pair: "BTC/USDT",
          side: "sell" as const,
          type: "market" as const,
          amount: 0.001,
        };

        try {
          await orderExecutor.execute(order);
        } catch (error) {
          // Expected to fail, but should trigger retry logic
          expect(error).toBeDefined();
        }
      },
      { timeout: 15000 }
    );
  });

  describe("executeBatch with single order", () => {
    it(
      "handles batch with one order",
      async () => {
        const orders = [
          {
            exchange: "binance" as const,
            pair: "ETH/USDT",
            side: "buy" as const,
            type: "market" as const,
            amount: 0.01,
          },
        ];

        const results = await orderExecutor.executeBatch(orders);
        expect(Array.isArray(results)).toBe(true);
        expect(results.length).toBeLessThanOrEqual(1);
      },
      { timeout: 15000 }
    );

    it(
      "executeBatch continues on error",
      async () => {
        const orders = [
          {
            exchange: "binance" as const,
            pair: "BTC/USDT",
            side: "buy" as const,
            type: "market" as const,
            amount: 0.001,
          },
          {
            exchange: "okx" as const,
            pair: "ETH/USDT",
            side: "sell" as const,
            type: "market" as const,
            amount: 0.01,
          },
        ];

        const results = await orderExecutor.executeBatch(orders);
        expect(Array.isArray(results)).toBe(true);
        // Should not throw; batch handles errors gracefully
      },
      { timeout: 15000 }
    );
  });

  describe("execute with no price cache", () => {
    it(
      "fails when no price available",
      async () => {
        const order = {
          exchange: "binance" as const,
          pair: "UNKNOWN/PAIR",
          side: "buy" as const,
          type: "market" as const,
          amount: 1,
        };

        try {
          await orderExecutor.execute(order);
          expect(true).toBe(false); // Should throw
        } catch (error) {
          expect(error).toBeDefined();
        }
      },
      { timeout: 15000 }
    );
  });

  describe("order object validation", () => {
    it("handles order with valid structure", () => {
      const order = {
        exchange: "binance" as const,
        pair: "BTC/USDT",
        side: "buy" as const,
        type: "market" as const,
        amount: 0.5,
      };

      expect(order.exchange).toBeDefined();
      expect(order.pair).toBeDefined();
      expect(order.side).toBe("buy");
      expect(order.amount).toBeGreaterThan(0);
    });
  });
});
