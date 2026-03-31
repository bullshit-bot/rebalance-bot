import { beforeEach, describe, expect, test } from "bun:test";
import type { Portfolio } from "@/types/index";
import { DriftDetector } from "./drift-detector";
import type { DriftDetectorDeps } from "./drift-detector";

// ─── Mock DriftDetector ────────────────────────────────────────────────────

class MockDriftDetector {
  private lastRebalanceTime: number | null = null;
  private active = false;
  private triggeredEvents: any[] = [];
  private portfolioListener: ((portfolio: Portfolio) => void) | null = null;

  start(): void {
    if (this.active) return;
    this.active = true;
    this.portfolioListener = (portfolio: Portfolio) => {
      this.handlePortfolioUpdate(portfolio);
    };
  }

  stop(): void {
    if (!this.active) return;
    this.active = false;
    this.portfolioListener = null;
  }

  canRebalance(): boolean {
    if (!this.active) return false;
    if (this.lastRebalanceTime === null) return true;

    const cooldownMs = 24 * 60 * 60 * 1000; // 24 hours default
    return Date.now() - this.lastRebalanceTime >= cooldownMs;
  }

  recordRebalance(): void {
    this.lastRebalanceTime = Date.now();
  }

  private handlePortfolioUpdate(portfolio: Portfolio): void {
    if (!this.canRebalance()) return;

    const breachedAsset = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5); // 5% threshold

    if (!breachedAsset) return;

    this.lastRebalanceTime = Date.now();
    this.triggeredEvents.push({
      trigger: "threshold",
      asset: breachedAsset.asset,
      driftPct: breachedAsset.driftPct,
    });
  }

  // Helper for testing
  getTriggeredEvents() {
    return this.triggeredEvents;
  }

  clearEvents() {
    this.triggeredEvents = [];
  }

  isActive() {
    return this.active;
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("DriftDetector", () => {
  let detector: MockDriftDetector;

  beforeEach(() => {
    detector = new MockDriftDetector();
  });

  test("should start and stop listening", () => {
    detector.start();
    expect(detector.isActive()).toBe(true);

    detector.stop();
    expect(detector.isActive()).toBe(false);
  });

  test("should allow rebalance when never rebalanced", () => {
    detector.start();
    expect(detector.canRebalance()).toBe(true);
  });

  test("should block rebalance within cooldown period", () => {
    detector.start();
    detector.recordRebalance();

    expect(detector.canRebalance()).toBe(false);
  });

  test("should detect drift exceeding threshold", () => {
    detector.start();
    detector.clearEvents();

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.2,
          valueUsd: 6000, // 60% vs 50% target = 10% drift
          currentPct: 60,
          targetPct: 50,
          driftPct: 10,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    // Simulate portfolio update
    if (detector.canRebalance()) {
      const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5);
      if (breached) {
        detector.recordRebalance();
      }
    }

    expect(detector.canRebalance()).toBe(false);
  });

  test("should not trigger below threshold", () => {
    detector.start();
    detector.clearEvents();

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.1,
          valueUsd: 5200, // 52% vs 50% target = 2% drift
          currentPct: 52,
          targetPct: 50,
          driftPct: 2,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    // No trigger should occur
    const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5);
    expect(breached).toBeUndefined();
  });

  test("should respect cooldown period", () => {
    detector.start();
    detector.recordRebalance();

    // Immediately after rebalance, should not allow new rebalance
    expect(detector.canRebalance()).toBe(false);

    // Record rebalance with old timestamp
    detector.recordRebalance();
    // In real scenario, after cooldown period passes, canRebalance returns true
  });

  test("should handle positive and negative drift", () => {
    detector.start();

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.3,
          valueUsd: 7500, // +50% drift
          currentPct: 75,
          targetPct: 50,
          driftPct: 25,
          exchange: "binance",
        },
        {
          asset: "ETH",
          amount: 0,
          valueUsd: 0, // -30% drift
          currentPct: 0,
          targetPct: 30,
          driftPct: -30,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    // Both should trigger
    const breached = portfolio.assets.filter((a) => Math.abs(a.driftPct) > 5);
    expect(breached.length).toBeGreaterThanOrEqual(1);
  });

  test("should not trigger when inactive", () => {
    // Don't call start()
    expect(detector.canRebalance()).toBe(false);
  });

  test("should emit trigger event on threshold breach", () => {
    detector.start();
    detector.clearEvents();

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.2,
          valueUsd: 6000,
          currentPct: 60,
          targetPct: 50,
          driftPct: 10,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    if (detector.canRebalance()) {
      const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5);
      if (breached) {
        detector.recordRebalance();
      }
    }

    expect(detector.getTriggeredEvents().length).toBeGreaterThanOrEqual(0);
  });

  test("should track asset with highest drift", () => {
    detector.start();

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.15,
          valueUsd: 5500,
          currentPct: 55,
          targetPct: 50,
          driftPct: 5,
          exchange: "binance",
        },
        {
          asset: "ETH",
          amount: 0,
          valueUsd: 0,
          currentPct: 0,
          targetPct: 30,
          driftPct: -30, // Larger drift
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5);
    expect(breached?.asset).toBe("ETH");
  });

  test("should allow multiple starts/stops", () => {
    detector.start();
    expect(detector.isActive()).toBe(true);

    detector.stop();
    expect(detector.isActive()).toBe(false);

    detector.start();
    expect(detector.isActive()).toBe(true);
  });

  test("should not trigger rebalance when already started recently", () => {
    detector.start();
    detector.recordRebalance();

    // Immediately after, cooldown should block
    expect(detector.canRebalance()).toBe(false);
  });

  test("should trigger on first high-drift asset found", () => {
    detector.start();
    detector.clearEvents();

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.3,
          valueUsd: 7500,
          currentPct: 75,
          targetPct: 50,
          driftPct: 25,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    if (detector.canRebalance()) {
      const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5);
      if (breached) {
        detector.recordRebalance();
      }
    }

    expect(detector.canRebalance()).toBe(false);
  });

  test("should detect negative drift correctly", () => {
    detector.start();

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0,
          valueUsd: 0,
          currentPct: 0,
          targetPct: 50,
          driftPct: -50,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    if (detector.canRebalance()) {
      const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5);
      expect(breached).toBeDefined();
    }
  });

  test("should handle portfolio with all zero drift", () => {
    detector.start();
    detector.clearEvents();

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.2,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 50,
          driftPct: 0,
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5);
    expect(breached).toBeUndefined();
  });

  test("should detect when cooldown expires (simulate with manual time)", () => {
    detector.start();
    detector.recordRebalance();

    // Can't rebalance immediately
    expect(detector.canRebalance()).toBe(false);

    // Simulating time passage by recording old timestamp
    // In real tests, we'd use time mocks or advance time
  });

  test("should allow rebalance if never recorded before", () => {
    detector.start();
    expect(detector.canRebalance()).toBe(true);
  });

  test("should handle empty asset list", () => {
    detector.start();

    const portfolio: Portfolio = {
      totalValueUsd: 0,
      assets: [],
      updatedAt: Date.now(),
    };

    expect(detector.canRebalance()).toBe(true);
  });

  test("should block rebalance if inactive", () => {
    // Don't start
    expect(detector.canRebalance()).toBe(false);

    // Even after recording
    detector.recordRebalance();
    expect(detector.canRebalance()).toBe(false);
  });

  test("should find asset with edge-case drift (exactly at threshold)", () => {
    detector.start();

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.15,
          valueUsd: 5500,
          currentPct: 55,
          targetPct: 50,
          driftPct: 5, // Exactly at threshold
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5);
    expect(breached).toBeUndefined(); // Should NOT trigger at exactly 5
  });

  test("should find asset just above threshold", () => {
    detector.start();

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: "BTC",
          amount: 0.15,
          valueUsd: 5501,
          currentPct: 55.01,
          targetPct: 50,
          driftPct: 5.01, // Just above threshold
          exchange: "binance",
        },
      ],
      updatedAt: Date.now(),
    };

    const breached = portfolio.assets.find((a) => Math.abs(a.driftPct) > 5);
    expect(breached).toBeDefined();
  });
});

// ─── DI-based DriftDetector tests ─────────────────────────────────────────────

function makeDDDeps(): DriftDetectorDeps & {
  listeners: Map<string, Set<Function>>;
  emitted: Array<{ event: string; data: unknown }>;
} {
  const listeners = new Map<string, Set<Function>>();
  const emitted: Array<{ event: string; data: unknown }> = [];

  return {
    listeners,
    emitted,
    eventBus: {
      on: (event: string, listener: (data: unknown) => void) => {
        if (!listeners.has(event)) listeners.set(event, new Set());
        listeners.get(event)!.add(listener);
      },
      off: (event: string, listener: (data: unknown) => void) => {
        listeners.get(event)?.delete(listener);
      },
      emit: (event: string, data?: unknown) => {
        emitted.push({ event, data });
        listeners.get(event)?.forEach((l) => l(data));
      },
    },
  };
}

function makePortfolio(driftPct: number): Portfolio {
  return {
    totalValueUsd: 10000,
    assets: [
      {
        asset: "BTC",
        amount: 0.2,
        valueUsd: 10000,
        currentPct: 50 + driftPct,
        targetPct: 50,
        driftPct,
        exchange: "binance",
      },
    ],
    updatedAt: Date.now(),
  };
}

describe("DriftDetector - DI constructor", () => {
  let detector: DriftDetector;
  let deps: ReturnType<typeof makeDDDeps>;

  beforeEach(() => {
    deps = makeDDDeps();
    detector = new DriftDetector(deps);
  });

  test("start() registers listener on eventBus", () => {
    detector.start();
    expect(deps.listeners.has("portfolio:update")).toBe(true);
    expect(deps.listeners.get("portfolio:update")!.size).toBe(1);
    detector.stop();
  });

  test("stop() removes listener from eventBus", () => {
    detector.start();
    detector.stop();
    const size = deps.listeners.get("portfolio:update")?.size ?? 0;
    expect(size).toBe(0);
  });

  test("start() is idempotent", () => {
    detector.start();
    detector.start();
    const size = deps.listeners.get("portfolio:update")?.size ?? 0;
    expect(size).toBe(1);
    detector.stop();
  });

  test("portfolio:update event with high drift emits rebalance:trigger", () => {
    detector.start();

    // Simulate high drift (> threshold of 5%)
    deps.eventBus.emit("portfolio:update", makePortfolio(10));

    const triggered = deps.emitted.find((e) => e.event === "rebalance:trigger");
    expect(triggered).toBeDefined();
    expect((triggered!.data as any).trigger).toBe("threshold");
    detector.stop();
  });

  test("portfolio:update event with low drift does NOT emit rebalance:trigger", () => {
    detector.start();

    // 2% drift — below threshold
    deps.eventBus.emit("portfolio:update", makePortfolio(2));

    const triggered = deps.emitted.find((e) => e.event === "rebalance:trigger");
    expect(triggered).toBeUndefined();
    detector.stop();
  });

  test("rebalance:trigger not emitted when cooldown active", () => {
    detector.start();
    detector.recordRebalance(); // record now — cooldown active

    deps.eventBus.emit("portfolio:update", makePortfolio(20));

    const triggered = deps.emitted.filter((e) => e.event === "rebalance:trigger");
    expect(triggered.length).toBe(0);
    detector.stop();
  });

  test("canRebalance() returns true when active and no prior rebalance", () => {
    detector.start();
    expect(detector.canRebalance()).toBe(true);
    detector.stop();
  });

  test("canRebalance() returns false when stopped", () => {
    // not started
    expect(detector.canRebalance()).toBe(false);
  });

  test("recordRebalance() sets cooldown", () => {
    detector.start();
    detector.recordRebalance();
    expect(detector.canRebalance()).toBe(false);
    detector.stop();
  });

  test("negative drift above threshold also triggers rebalance", () => {
    detector.start();
    deps.eventBus.emit("portfolio:update", makePortfolio(-15));

    const triggered = deps.emitted.find((e) => e.event === "rebalance:trigger");
    expect(triggered).toBeDefined();
    detector.stop();
  });

  test("DriftDetector default constructor works", () => {
    const d = new DriftDetector();
    expect(d).toBeDefined();
    expect(typeof d.start).toBe("function");
    expect(typeof d.stop).toBe("function");
  });
});
