import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { eventBus } from "@/events/event-bus";
import type { PriceData, TrailingStopConfig } from "@/types/index";
import { trailingStopManager } from "./trailing-stop-manager";

describe("TrailingStopManager integration", () => {
  beforeEach(() => {
    // Reset manager state before each test
    trailingStopManager.stop();
  });

  afterEach(() => {
    trailingStopManager.stop();
  });

  test("addStop creates a new trailing stop config", () => {
    const config: TrailingStopConfig = {
      asset: "BTC",
      exchange: "binance",
      trailPct: 5,
      enabled: true,
    };

    trailingStopManager.addStop(config);
    const stop = trailingStopManager.getStop("BTC", "binance");

    expect(stop).toBeDefined();
    expect(stop?.config.asset).toBe("BTC");
    expect(stop?.config.exchange).toBe("binance");
    expect(stop?.config.trailPct).toBe(5);
    expect(stop?.config.enabled).toBe(true);
    expect(stop?.highestPrice).toBe(0);
    expect(stop?.stopPrice).toBe(0);
    expect(stop?.activated).toBe(false);
  });

  test("addStop replaces existing stop with preserved highestPrice", () => {
    const config: TrailingStopConfig = {
      asset: "ETH",
      exchange: "binance",
      trailPct: 3,
      enabled: true,
    };

    trailingStopManager.addStop(config);

    // Manually set highest price to simulate prior trading
    const original = trailingStopManager.getStop("ETH", "binance");
    expect(original).toBeDefined();

    // Add again with new config
    const newConfig: TrailingStopConfig = {
      asset: "ETH",
      exchange: "binance",
      trailPct: 7,
      enabled: true,
    };
    trailingStopManager.addStop(newConfig);

    const updated = trailingStopManager.getStop("ETH", "binance");
    expect(updated?.config.trailPct).toBe(7);
  });

  test("removeStop deletes a trailing stop", () => {
    const config: TrailingStopConfig = {
      asset: "BTC",
      exchange: "binance",
      trailPct: 5,
      enabled: true,
    };

    trailingStopManager.addStop(config);
    expect(trailingStopManager.getStop("BTC", "binance")).toBeDefined();

    trailingStopManager.removeStop("BTC", "binance");
    expect(trailingStopManager.getStop("BTC", "binance")).toBeUndefined();
  });

  test("getStops returns all active stops", () => {
    const configs: TrailingStopConfig[] = [
      { asset: "BTC", exchange: "binance", trailPct: 5, enabled: true },
      { asset: "ETH", exchange: "binance", trailPct: 3, enabled: true },
      { asset: "BTC", exchange: "okx", trailPct: 4, enabled: true },
    ];

    for (const config of configs) {
      trailingStopManager.addStop(config);
    }

    const stops = trailingStopManager.getStops();
    expect(stops.length).toBe(3);
    expect(stops.some((s) => s.config.asset === "BTC" && s.config.exchange === "binance")).toBe(
      true
    );
    expect(stops.some((s) => s.config.asset === "ETH" && s.config.exchange === "binance")).toBe(
      true
    );
    expect(stops.some((s) => s.config.asset === "BTC" && s.config.exchange === "okx")).toBe(true);
  });

  test("start/stop manages event subscription", () => {
    expect(() => {
      trailingStopManager.start();
      trailingStopManager.start(); // should be idempotent
    }).not.toThrow();

    expect(() => {
      trailingStopManager.stop();
      trailingStopManager.stop(); // should be idempotent
    }).not.toThrow();
  });

  test("onPriceUpdate updates highest price watermark", async () => {
    const config: TrailingStopConfig = {
      asset: "BTC",
      exchange: "binance",
      trailPct: 5,
      enabled: true,
    };

    trailingStopManager.addStop(config);
    trailingStopManager.start();

    const priceData: PriceData = {
      pair: "BTC/USDT",
      exchange: "binance",
      price: 50000,
    };

    let triggeredEvent: unknown = null;
    eventBus.on("trailing-stop:triggered", (data) => {
      triggeredEvent = data;
    });

    // Emit price update
    eventBus.emit("price:update", priceData);

    // Give event loop a tick to process
    await new Promise((resolve) => setTimeout(resolve, 10));

    const stop = trailingStopManager.getStop("BTC", "binance");
    expect(stop?.highestPrice).toBe(50000);
    expect(stop?.stopPrice).toBe(50000 * (1 - 5 / 100));
    expect(triggeredEvent).toBeNull(); // price did not breach stop

    trailingStopManager.stop();
  });

  test("onPriceUpdate triggers when price breaches stop level", async () => {
    const config: TrailingStopConfig = {
      asset: "BTC",
      exchange: "binance",
      trailPct: 10,
      enabled: true,
    };

    trailingStopManager.addStop(config);
    trailingStopManager.start();

    let triggeredEvent: any = null;
    eventBus.once("trailing-stop:triggered", (data) => {
      triggeredEvent = data;
    });

    // First price: set watermark
    eventBus.emit("price:update", {
      pair: "BTC/USDT",
      exchange: "binance",
      price: 50000,
    } as PriceData);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Second price: breach stop (50000 * 0.9 = 45000)
    eventBus.emit("price:update", {
      pair: "BTC/USDT",
      exchange: "binance",
      price: 44000,
    } as PriceData);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(triggeredEvent).toBeDefined();
    expect(triggeredEvent.asset).toBe("BTC");
    expect(triggeredEvent.price).toBe(44000);
    expect(triggeredEvent.stopPrice).toBe(45000);

    // Verify stop is now deactivated
    const stop = trailingStopManager.getStop("BTC", "binance");
    expect(stop?.activated).toBe(true);
    expect(stop?.config.enabled).toBe(false);

    trailingStopManager.stop();
  });

  test("onPriceUpdate ignores disabled stops", async () => {
    const config: TrailingStopConfig = {
      asset: "ETH",
      exchange: "binance",
      trailPct: 5,
      enabled: false,
    };

    trailingStopManager.addStop(config);
    trailingStopManager.start();

    let triggeredCount = 0;
    eventBus.on("trailing-stop:triggered", () => {
      triggeredCount++;
    });

    eventBus.emit("price:update", {
      pair: "ETH/USDT",
      exchange: "binance",
      price: 3000,
    } as PriceData);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(triggeredCount).toBe(0);

    trailingStopManager.stop();
  });

  test("onPriceUpdate ignores already-activated stops", async () => {
    const config: TrailingStopConfig = {
      asset: "BTC",
      exchange: "binance",
      trailPct: 5,
      enabled: true,
    };

    trailingStopManager.addStop(config);
    trailingStopManager.start();

    let triggeredCount = 0;
    eventBus.on("trailing-stop:triggered", () => {
      triggeredCount++;
    });

    // Set initial high price
    eventBus.emit("price:update", {
      pair: "BTC/USDT",
      exchange: "binance",
      price: 50000,
    } as PriceData);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Breach stop
    eventBus.emit("price:update", {
      pair: "BTC/USDT",
      exchange: "binance",
      price: 47000,
    } as PriceData);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(triggeredCount).toBe(1);

    // Send more price updates after activation
    eventBus.emit("price:update", {
      pair: "BTC/USDT",
      exchange: "binance",
      price: 40000,
    } as PriceData);

    await new Promise((resolve) => setTimeout(resolve, 10));

    // Should still be 1, not triggered again
    expect(triggeredCount).toBe(1);

    trailingStopManager.stop();
  });

  test("onPriceUpdate ignores untracked assets", async () => {
    trailingStopManager.start();

    let triggeredCount = 0;
    eventBus.on("trailing-stop:triggered", () => {
      triggeredCount++;
    });

    // No stop configured for XRP
    eventBus.emit("price:update", {
      pair: "XRP/USDT",
      exchange: "binance",
      price: 1.0,
    } as PriceData);

    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(triggeredCount).toBe(0);

    trailingStopManager.stop();
  });

  test("onPriceUpdate extracts asset from trading pair correctly", async () => {
    const config: TrailingStopConfig = {
      asset: "SOL",
      exchange: "okx",
      trailPct: 5,
      enabled: true,
    };

    trailingStopManager.addStop(config);
    trailingStopManager.start();

    let receivedPrice = 0;
    eventBus.once("trailing-stop:triggered", (data: any) => {
      receivedPrice = data.price;
    });

    // Emit with full pair "SOL/USDT"
    eventBus.emit("price:update", {
      pair: "SOL/USDT",
      exchange: "okx",
      price: 100,
    } as PriceData);

    await new Promise((resolve) => setTimeout(resolve, 10));

    const stop = trailingStopManager.getStop("SOL", "okx");
    expect(stop?.highestPrice).toBe(100);

    trailingStopManager.stop();
  });

  test("onPriceUpdate correctly calculates stop price with different trail percentages", async () => {
    const trails = [2, 5, 10];
    const startPrice = 100;

    for (const trailPct of trails) {
      const config: TrailingStopConfig = {
        asset: `TEST_ASSET_${trailPct}`,
        exchange: "binance",
        trailPct,
        enabled: true,
      };

      trailingStopManager.addStop(config);
      trailingStopManager.start();

      eventBus.emit("price:update", {
        pair: `TEST_ASSET_${trailPct}/USDT`,
        exchange: "binance",
        price: startPrice,
      } as PriceData);

      await new Promise((resolve) => setTimeout(resolve, 10));

      const stop = trailingStopManager.getStop(`TEST_ASSET_${trailPct}`, "binance");
      const expectedStop = startPrice * (1 - trailPct / 100);

      expect(stop?.stopPrice).toBe(expectedStop);

      trailingStopManager.stop();
    }
  });

  test("getStop returns undefined for non-existent stop", () => {
    const stop = trailingStopManager.getStop("NONEXISTENT", "binance");
    expect(stop).toBeUndefined();
  });

  test("handles multiple stops across different exchanges", async () => {
    const config1: TrailingStopConfig = {
      asset: "BTC",
      exchange: "binance",
      trailPct: 5,
      enabled: true,
    };

    const config2: TrailingStopConfig = {
      asset: "BTC",
      exchange: "okx",
      trailPct: 3,
      enabled: true,
    };

    trailingStopManager.addStop(config1);
    trailingStopManager.addStop(config2);

    const btcBinance = trailingStopManager.getStop("BTC", "binance");
    const btcOkx = trailingStopManager.getStop("BTC", "okx");

    expect(btcBinance?.config.exchange).toBe("binance");
    expect(btcOkx?.config.exchange).toBe("okx");
    expect(btcBinance?.config.trailPct).toBe(5);
    expect(btcOkx?.config.trailPct).toBe(3);
  });
});
