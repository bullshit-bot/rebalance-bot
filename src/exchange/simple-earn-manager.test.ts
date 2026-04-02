import { describe, it, expect } from "bun:test";
import { SimpleEarnManager } from "./simple-earn-manager";
import type { EarnPosition, EarnProduct } from "./simple-earn-manager";

// Tests that don't require mocking exchange-manager (safe for CI)

describe("SimpleEarnManager", () => {
  describe("class structure", () => {
    it("exports SimpleEarnManager class", () => {
      expect(SimpleEarnManager).toBeDefined();
      expect(typeof SimpleEarnManager).toBe("function");
    });

    it("has expected public methods", () => {
      const manager = new SimpleEarnManager();
      expect(typeof manager.getFlexibleProducts).toBe("function");
      expect(typeof manager.getProductId).toBe("function");
      expect(typeof manager.subscribe).toBe("function");
      expect(typeof manager.redeem).toBe("function");
      expect(typeof manager.getFlexiblePositions).toBe("function");
      expect(typeof manager.getEarnBalanceMap).toBe("function");
      expect(typeof manager.subscribeAll).toBe("function");
      expect(typeof manager.redeemForRebalance).toBe("function");
      expect(typeof manager.waitForSettlement).toBe("function");
      expect(typeof manager.getApyMap).toBe("function");
    });
  });

  describe("graceful degradation (no exchange connected)", () => {
    const manager = new SimpleEarnManager();

    it("getFlexibleProducts returns empty when no exchange", async () => {
      const products = await manager.getFlexibleProducts();
      expect(products).toEqual([]);
    });

    it("getProductId returns null when no exchange", async () => {
      const id = await manager.getProductId("BTC");
      expect(id).toBeNull();
    });

    it("subscribe returns false when no exchange", async () => {
      const result = await manager.subscribe("BTC", 0.1);
      expect(result).toBe(false);
    });

    it("redeem returns false when no exchange", async () => {
      const result = await manager.redeem("BTC", 0.1);
      expect(result).toBe(false);
    });

    it("getFlexiblePositions returns empty when no exchange", async () => {
      const positions = await manager.getFlexiblePositions();
      expect(positions).toEqual([]);
    });

    it("getEarnBalanceMap returns empty when no exchange", async () => {
      const map = await manager.getEarnBalanceMap();
      expect(map.size).toBe(0);
    });

    it("subscribeAll returns without error when no exchange", async () => {
      await expect(manager.subscribeAll(["BTC", "ETH"])).resolves.toBeUndefined();
    });

    it("redeemForRebalance returns without error when no exchange", async () => {
      await expect(
        manager.redeemForRebalance([
          { exchange: "binance", pair: "BTC/USDT", side: "sell", type: "market", amount: 0.1 },
        ])
      ).resolves.toBeUndefined();
    });

    it("waitForSettlement resolves immediately when no exchange", async () => {
      await expect(manager.waitForSettlement(new Map([["BTC", 0.1]]), 1000)).resolves.toBeUndefined();
    });

    it("getApyMap returns empty when no exchange", async () => {
      const map = await manager.getApyMap();
      expect(Object.keys(map).length).toBe(0);
    });
  });

  describe("types", () => {
    it("EarnProduct type is correctly shaped", () => {
      const product: EarnProduct = { productId: "BTC001", asset: "BTC" };
      expect(product.productId).toBe("BTC001");
      expect(product.asset).toBe("BTC");
    });

    it("EarnPosition type is correctly shaped", () => {
      const position: EarnPosition = { asset: "BTC", amount: 0.5, productId: "BTC001" };
      expect(position.asset).toBe("BTC");
      expect(position.amount).toBe(0.5);
    });
  });
});
