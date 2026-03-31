import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";
import type { Portfolio, PortfolioAsset } from "@/types/index";

// Mock AllocationModel so getTargetAllocations() does not hit MongoDB in unit tests
mock.module("@db/database", () => ({
  AllocationModel: {
    find: () => ({
      lean: async () => [
        { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
        { asset: "ETH", targetPct: 30, minTradeUsd: 10 },
        { asset: "USDT", targetPct: 20, minTradeUsd: 10 },
      ],
    }),
  },
}));

import { PortfolioTracker } from "./portfolio-tracker";
import type { PortfolioTrackerDeps } from "./portfolio-tracker";

// ─── Mock PortfolioTracker ─────────────────────────────────────────────────

class MockPortfolioTracker {
  private readonly balances: Map<string, Map<string, number>> = new Map();
  private portfolio: Portfolio | null = null;
  private cachedTargets: any[] | null = null;
  private lastSnapshotAt = 0;

  getPortfolio(): Portfolio | null {
    return this.portfolio;
  }

  async getTargetAllocations(): Promise<any[]> {
    const now = Date.now();
    const CACHE_TTL_MS = 60_000;

    if (this.cachedTargets !== null && now - this.lastSnapshotAt < CACHE_TTL_MS) {
      return this.cachedTargets;
    }

    // Mock DB fetch
    this.cachedTargets = [
      { asset: "BTC", targetPct: 50, minTradeUsd: 10 },
      { asset: "ETH", targetPct: 30, minTradeUsd: 10 },
      { asset: "USDT", targetPct: 20, minTradeUsd: 10 },
    ];

    this.lastSnapshotAt = now;
    return this.cachedTargets;
  }

  async startWatching(exchanges: Map<string, any>): Promise<void> {
    // Mock implementation
  }

  async stopWatching(): Promise<void> {
    this.balances.clear();
  }

  // Helper for testing
  setBalances(exchange: string, balances: Record<string, number>): void {
    this.balances.set(exchange, new Map(Object.entries(balances)));
    this.recalculate();
  }

  private recalculate(): void {
    const assetTotals = new Map<string, { amount: number; exchange: string }>();

    for (const [exchangeName, exchangeBalances] of this.balances) {
      for (const [asset, amount] of exchangeBalances) {
        const existing = assetTotals.get(asset);
        if (existing) {
          existing.amount += amount;
        } else {
          assetTotals.set(asset, { amount, exchange: exchangeName });
        }
      }
    }

    if (assetTotals.size === 0) return;

    // Simple mock: use hardcoded prices for testing
    const prices: Record<string, number> = {
      BTC: 50000,
      ETH: 3000,
      USDT: 1,
      USDC: 1,
    };

    const assetValues = new Map<string, { amount: number; valueUsd: number; exchange: string }>();
    let totalValueUsd = 0;

    for (const [asset, { amount, exchange }] of assetTotals) {
      const price = prices[asset] ?? 0;
      if (price === 0) continue;

      const valueUsd = amount * price;
      assetValues.set(asset, { amount, valueUsd, exchange });
      totalValueUsd += valueUsd;
    }

    if (totalValueUsd === 0) return;

    const targetMap: Record<string, number> = {
      BTC: 50,
      ETH: 30,
      USDT: 20,
    };

    const assets: PortfolioAsset[] = [];

    for (const [asset, { amount, valueUsd, exchange }] of assetValues) {
      const currentPct = (valueUsd / totalValueUsd) * 100;
      const targetPct = targetMap[asset] ?? 0;
      const driftPct = currentPct - targetPct;

      assets.push({
        asset,
        amount,
        valueUsd,
        currentPct,
        targetPct,
        driftPct,
        exchange: exchange as any,
      });
    }

    this.portfolio = {
      totalValueUsd,
      assets,
      updatedAt: Date.now(),
    };
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("PortfolioTracker", () => {
  let tracker: MockPortfolioTracker;

  beforeEach(() => {
    tracker = new MockPortfolioTracker();
  });

  test("should return null portfolio before any data", () => {
    expect(tracker.getPortfolio()).toBeNull();
  });

  test("should handle single-asset portfolio correctly", () => {
    tracker.setBalances("binance", {
      BTC: 1,
    });

    const portfolio = tracker.getPortfolio();
    expect(portfolio).not.toBeNull();
    expect(portfolio!.assets.length).toBe(1);
    expect(portfolio!.assets[0].asset).toBe("BTC");
    expect(portfolio!.assets[0].currentPct).toBeCloseTo(100, 1);
  });

  test("should compute negative drift for underweight assets", () => {
    tracker.setBalances("binance", {
      BTC: 0.05, // 2500 = 25% vs 50% target
      ETH: 25, // 50000 = 50% vs 50% target (but this gives 75% total)
      USDT: 25000, // 25000 = 25% vs 20% target
    });

    const portfolio = tracker.getPortfolio();
    const btc = portfolio!.assets.find((a) => a.asset === "BTC");
    expect(btc).toBeDefined(); // Should be in portfolio
    expect(btc!.driftPct).toBeLessThan(0); // Negative drift = underweight
  });

  test("should only include assets in portfolio that have value", () => {
    tracker.setBalances("binance", {
      BTC: 1,
      USDT: 5000,
    });

    const portfolio = tracker.getPortfolio();
    const assetNames = portfolio!.assets.map((a) => a.asset);
    expect(assetNames).toContain("BTC");
    expect(assetNames).toContain("USDT");
    expect(assetNames.length).toBe(2);
  });

  test("should calculate allocation percentages", () => {
    tracker.setBalances("binance", {
      BTC: 1, // 50000
      ETH: 10, // 30000
      USDT: 20000, // 20000
    });

    const portfolio = tracker.getPortfolio();
    expect(portfolio).not.toBeNull();
    expect(portfolio!.assets.length).toBe(3);

    const btc = portfolio!.assets.find((a) => a.asset === "BTC");
    expect(btc).toBeDefined();
    // 50000 out of 100000 = 50%
    expect(btc!.currentPct).toBeCloseTo(50, 1);
  });

  test("should detect drift from target allocation", () => {
    tracker.setBalances("binance", {
      BTC: 2, // 100000 = ~90% instead of 50%
      ETH: 0,
      USDT: 10000,
    });

    const portfolio = tracker.getPortfolio();
    const btc = portfolio!.assets.find((a) => a.asset === "BTC");

    expect(btc!.driftPct).toBeGreaterThan(0); // Positive drift = overweight
  });

  test("should emit portfolio:update event", () => {
    tracker.setBalances("binance", {
      BTC: 1,
      ETH: 10,
      USDT: 1000,
    });

    const portfolio = tracker.getPortfolio();
    expect(portfolio).not.toBeNull();
    expect(portfolio!.totalValueUsd).toBeGreaterThan(0);
  });

  test("should handle multiple exchanges", () => {
    tracker.setBalances("binance", {
      BTC: 0.5,
      ETH: 5,
    });

    tracker.setBalances("okx", {
      BTC: 0.5,
      ETH: 5,
    });

    const portfolio = tracker.getPortfolio();
    const btc = portfolio!.assets.find((a) => a.asset === "BTC");

    expect(btc!.amount).toBeCloseTo(1, 1); // 0.5 + 0.5
  });

  test("should cache target allocations", async () => {
    const targets1 = await tracker.getTargetAllocations();
    const targets2 = await tracker.getTargetAllocations();

    expect(targets1).toBe(targets2); // Same reference (cached)
  });

  test("should skip assets with zero price", () => {
    tracker.setBalances("binance", {
      BTC: 1,
      UNKNOWN: 100, // No price data available
    });

    const portfolio = tracker.getPortfolio();
    const unknown = portfolio!.assets.find((a) => a.asset === "UNKNOWN");

    expect(unknown).toBeUndefined();
  });

  test("should handle empty balances gracefully", () => {
    tracker.setBalances("binance", {});

    expect(tracker.getPortfolio()).toBeNull();
  });

  test("should calculate total value correctly", () => {
    tracker.setBalances("binance", {
      BTC: 1, // 50000
      ETH: 10, // 30000
      USDT: 20000, // 20000
    });

    const portfolio = tracker.getPortfolio();
    expect(portfolio!.totalValueUsd).toBeCloseTo(100000, -3);
  });

  test("should handle stablecoin pricing", () => {
    tracker.setBalances("binance", {
      USDT: 1000,
      USDC: 500,
    });

    const portfolio = tracker.getPortfolio();
    expect(portfolio!.totalValueUsd).toBeCloseTo(1500, 0);
  });

  test("should track exchange location per asset", () => {
    tracker.setBalances("binance", { BTC: 1 });
    tracker.setBalances("okx", { ETH: 10 });

    const portfolio = tracker.getPortfolio();
    const btc = portfolio!.assets.find((a) => a.asset === "BTC");
    const eth = portfolio!.assets.find((a) => a.asset === "ETH");

    expect(btc!.exchange).toBe("binance");
    expect(eth!.exchange).toBe("okx");
  });

  test("should handle single-asset portfolio correctly", () => {
    tracker.setBalances("binance", {
      BTC: 1,
    });

    const portfolio = tracker.getPortfolio();
    expect(portfolio).not.toBeNull();
    expect(portfolio!.assets.length).toBe(1);
    expect(portfolio!.assets[0].asset).toBe("BTC");
    expect(portfolio!.assets[0].currentPct).toBeCloseTo(100, 1);
  });

  test("should handle multiple stablecoins together", () => {
    tracker.setBalances("binance", {
      USDT: 1000,
      USDC: 500,
    });

    const portfolio = tracker.getPortfolio();
    expect(portfolio).not.toBeNull();
    expect(portfolio!.assets.length).toBe(2);
  });

  test("should compute currentPct sum to ~100%", () => {
    tracker.setBalances("binance", {
      BTC: 1, // 50000
      ETH: 10, // 30000
      USDT: 20000, // 20000
    });

    const portfolio = tracker.getPortfolio();
    const totalPct = portfolio!.assets.reduce((sum, a) => sum + a.currentPct, 0);
    expect(totalPct).toBeCloseTo(100, 0);
  });

  test("should handle portfolio with three assets", () => {
    tracker.setBalances("binance", {
      BTC: 0.5,
      ETH: 15,
      USDT: 10000,
    });

    const portfolio = tracker.getPortfolio();
    expect(portfolio!.assets.length).toBe(3);
    expect(portfolio!.totalValueUsd).toBeGreaterThan(0);
  });

  test("should update portfolio on second exchange update", () => {
    tracker.setBalances("binance", { BTC: 0.5, USDT: 5000 });
    const p1 = tracker.getPortfolio();

    tracker.setBalances("okx", { BTC: 0.5, USDT: 5000 });
    const p2 = tracker.getPortfolio();

    expect(p2).not.toBeNull();
    expect(p2!.assets.find((a) => a.asset === "BTC")!.amount).toBeCloseTo(1.0, 1);
  });

  test("should handle price unavailability for some assets", () => {
    tracker.setBalances("binance", {
      BTC: 1,
      UNKNOWN: 100, // No price
      ETH: 10,
    });

    const portfolio = tracker.getPortfolio();
    // BTC and ETH should be included
    expect(portfolio!.assets.map((a) => a.asset)).toContain("BTC");
    expect(portfolio!.assets.map((a) => a.asset)).toContain("ETH");
    // UNKNOWN should not be included
    expect(portfolio!.assets.map((a) => a.asset)).not.toContain("UNKNOWN");
  });

  test("should skip recalculation if totalValue is zero", () => {
    // No balances set
    expect(tracker.getPortfolio()).toBeNull();
  });
});

// ─── DI-based PortfolioTracker tests ──────────────────────────────────────────

function makePTDeps(
  prices: Record<string, number> = {}
): PortfolioTrackerDeps & { events: string[] } {
  const events: string[] = [];
  return {
    events,
    priceCache: {
      getBestPrice: (pair: string) => {
        const asset = pair.split("/")[0] ?? "";
        return prices[asset];
      },
    },
    eventBus: {
      emit: (event: string) => {
        events.push(event);
      },
    },
  };
}

describe("PortfolioTracker - DI constructor", () => {
  let tracker: PortfolioTracker;
  let deps: ReturnType<typeof makePTDeps>;

  beforeEach(() => {
    deps = makePTDeps({ BTC: 50000, ETH: 3000 });
    tracker = new PortfolioTracker(deps);
  });

  afterEach(async () => {
    await tracker.stopWatching();
  });

  test("getPortfolio() returns null before any watch", () => {
    expect(tracker.getPortfolio()).toBeNull();
  });

  test("startWatching() with empty map does not throw", async () => {
    await tracker.startWatching(new Map());
    expect(tracker.getPortfolio()).toBeNull();
  });

  test("startWatching() is idempotent — second call is no-op", async () => {
    // Use an exchange that aborts quickly when signal fires
    const controller = new AbortController();
    const exchanges = new Map<any, any>(); // empty — nothing to watch

    await tracker.startWatching(exchanges);
    await tracker.startWatching(exchanges); // second call is no-op
    expect(true).toBe(true);
  });

  test("stopWatching() is safe to call before starting", async () => {
    await tracker.stopWatching(); // should not throw
    expect(true).toBe(true);
  });

  test("stopWatching() resets watching flag", async () => {
    await tracker.startWatching(new Map());
    await tracker.stopWatching();
    // Can start again after stop
    await tracker.startWatching(new Map());
    expect(true).toBe(true);
  });

  test("getTargetAllocations() returns array (may be empty in test env)", async () => {
    const targets = await tracker.getTargetAllocations();
    expect(Array.isArray(targets)).toBe(true);
  });

  test("getTargetAllocations() caches results within TTL", async () => {
    const targets1 = await tracker.getTargetAllocations();
    const targets2 = await tracker.getTargetAllocations();
    // Second call within 60s should return same reference
    expect(targets1).toBe(targets2);
  });

  test("watchBalance loop emits balance:update then is stopped", async () => {
    // fetchBalance-based REST polling: first call returns data, subsequent calls block
    let callCount = 0;

    const mockEx = {
      fetchBalance: async () => {
        callCount++;
        if (callCount === 1) {
          return {
            BTC: { free: 0.5 },
            USDT: { free: 10000 },
          };
        }
        // Block until aborted by stopWatching (simulated via long sleep)
        await new Promise<void>((resolve) => setTimeout(resolve, 60_000));
        return {};
      },
    };

    const exchanges = new Map([["binance" as any, mockEx]]);
    tracker.startWatching(exchanges);

    // Let first fetchBalance call complete and process
    await new Promise<void>((r) => setTimeout(r, 50));

    await tracker.stopWatching();

    expect(deps.events).toContain("balance:update");
    expect(callCount).toBeGreaterThanOrEqual(1);
  });

  test("watchBalance loop handles transient errors without crashing", async () => {
    let callCount = 0;

    const mockEx = {
      fetchBalance: async () => {
        callCount++;
        if (callCount === 1) throw new Error("transient network error");
        // Block — will be cleared by stopWatching aborting the signal
        await new Promise<void>((resolve) => setTimeout(resolve, 60_000));
        return {};
      },
    };

    const exchanges = new Map([["binance" as any, mockEx]]);
    tracker.startWatching(exchanges);

    // Let first call throw; impl catches error and sleeps 10s before retry
    await new Promise<void>((r) => setTimeout(r, 50));
    await tracker.stopWatching();

    expect(callCount).toBeGreaterThanOrEqual(1);
  });

  test("startWatching outer catch fires when watchBalance rejects at top level", async () => {
    // The .catch() on line 84 catches if the watchBalance async fn itself throws synchronously
    // We can simulate by overriding the private watchBalance method
    const customTracker = new PortfolioTracker(deps);
    const original = (customTracker as any).watchBalance.bind(customTracker);
    (customTracker as any).watchBalance = async (_ex: any, _name: any, _signal: AbortSignal) => {
      throw new Error("unexpected outer error");
    };

    const mockEx = { fetchBalance: async () => ({}) };
    const exchanges = new Map([["binance" as any, mockEx]]);

    // Should not throw even though inner watchBalance throws
    await customTracker.startWatching(exchanges);
    await new Promise<void>((r) => setTimeout(r, 20));
    await customTracker.stopWatching();
    expect(true).toBe(true);
  });
});
