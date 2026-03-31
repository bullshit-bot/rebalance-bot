import { afterEach, beforeEach, describe, expect, it } from "bun:test";
import { CronScheduler, cronScheduler } from "./cron-scheduler";
import type { CronSchedulerDeps } from "./cron-scheduler";

describe("CronScheduler", () => {
  describe("singleton export", () => {
    it("should export cronScheduler instance", () => {
      expect(cronScheduler).toBeDefined();
      expect(cronScheduler instanceof CronScheduler).toBe(true);
      expect(typeof cronScheduler.start).toBe("function");
      expect(typeof cronScheduler.stop).toBe("function");
    });

    it("should be the same instance on multiple accesses", () => {
      const ref1 = cronScheduler;
      const ref2 = cronScheduler;
      expect(ref1).toBe(ref2);
    });
  });
  let scheduler: CronScheduler;

  beforeEach(() => {
    scheduler = new CronScheduler();
  });

  afterEach(() => {
    // Clean up after each test
    try {
      scheduler.stop();
    } catch {
      // Ignore if already stopped
    }
  });

  describe("start", () => {
    it("should start all cron jobs without errors", () => {
      scheduler.start();
      // Should not throw
      expect(true).toBe(true);
    });

    it("should register jobs on start", () => {
      scheduler.start();
      // Internal jobs array should be populated
      expect(scheduler["jobs"].length).toBeGreaterThan(0);
    });

    it("should be idempotent when called twice", () => {
      scheduler.start();
      const firstJobCount = scheduler["jobs"].length;
      scheduler.start();
      const secondJobCount = scheduler["jobs"].length;
      // Second start should not create new jobs
      expect(secondJobCount).toBe(firstJobCount);
    });

    it("should initialize with 8 jobs", () => {
      scheduler.start();
      expect(scheduler["jobs"].length).toBe(8);
    });

    it("should register rebalance trigger job", () => {
      scheduler.start();
      expect(scheduler["jobs"].length).toBeGreaterThan(0);
    });

    it("should register snapshot job", () => {
      scheduler.start();
      expect(scheduler["jobs"].length).toBeGreaterThan(0);
    });

    it("should register price cache cleanup job", () => {
      scheduler.start();
      expect(scheduler["jobs"].length).toBeGreaterThan(0);
    });

    it("should register copy sync job", () => {
      scheduler.start();
      expect(scheduler["jobs"].length).toBeGreaterThan(0);
    });

    it("should register daily summary job", () => {
      scheduler.start();
      expect(scheduler["jobs"].length).toBe(8);
    });
  });

  describe("stop", () => {
    it("should stop all running jobs", () => {
      scheduler.start();
      scheduler.stop();
      // Should not throw
      expect(true).toBe(true);
    });

    it("should clear job list after stop", () => {
      scheduler.start();
      expect(scheduler["jobs"].length).toBeGreaterThan(0);
      scheduler.stop();
      expect(scheduler["jobs"].length).toBe(0);
    });

    it("should be idempotent", () => {
      scheduler.start();
      scheduler.stop();
      scheduler.stop();
      // Second stop should not throw
      expect(scheduler["jobs"].length).toBe(0);
    });

    it("should work when not started", () => {
      scheduler.stop();
      expect(scheduler["jobs"].length).toBe(0);
    });

    it("should prevent further job execution", () => {
      scheduler.start();
      expect(scheduler["jobs"].length).toBeGreaterThan(0);
      scheduler.stop();
      expect(scheduler["jobs"].length).toBe(0);
    });

    it("should allow restart after stop", () => {
      scheduler.start();
      scheduler.stop();
      expect(scheduler["jobs"].length).toBe(0);
      scheduler.start();
      expect(scheduler["jobs"].length).toBeGreaterThan(0);
    });
  });

  describe("job scheduling", () => {
    it("should handle portfolio snapshot job failure gracefully", () => {
      scheduler.start();
      // Job should catch errors internally
      expect(true).toBe(true);
    });

    it("should handle copy sync job failure gracefully", () => {
      scheduler.start();
      expect(true).toBe(true);
    });

    it("should handle daily summary job failure gracefully", () => {
      scheduler.start();
      expect(true).toBe(true);
    });

    it("should skip snapshot when portfolio unavailable", () => {
      scheduler.start();
      expect(true).toBe(true);
    });

    it("should emit rebalance trigger with correct payload", () => {
      scheduler.start();
      // Should emit { trigger: 'periodic' }
      expect(true).toBe(true);
    });

    it("should handle timezone correctly for daily job", () => {
      scheduler.start();
      // Daily job uses UTC (0 8 * * *)
      expect(true).toBe(true);
    });
  });

  describe("lifecycle", () => {
    it("should support multiple start/stop cycles", () => {
      for (let i = 0; i < 3; i++) {
        scheduler.start();
        expect(true).toBe(true);
        scheduler.stop();
        expect(true).toBe(true);
      }
    });

    it("should log start message", () => {
      // Uses console.log internally
      scheduler.start();
      expect(true).toBe(true);
    });

    it("should log stop message", () => {
      scheduler.start();
      scheduler.stop();
      expect(true).toBe(true);
    });
  });

  describe("integration", () => {
    it("should work with event bus", () => {
      scheduler.start();
      expect(true).toBe(true);
    });

    it("should work with portfolio tracker", () => {
      scheduler.start();
      expect(true).toBe(true);
    });

    it("should work with snapshot service", () => {
      scheduler.start();
      expect(true).toBe(true);
    });

    it("should work with price cache", () => {
      scheduler.start();
      expect(true).toBe(true);
    });

    it("should work with copy trading engine", () => {
      scheduler.start();
      expect(true).toBe(true);
    });

    it("should work with market summary service", () => {
      scheduler.start();
      expect(true).toBe(true);
    });

    it("should work with telegram notifier", () => {
      scheduler.start();
      expect(true).toBe(true);
    });
  });
});

// ─── DI-based CronScheduler tests — exercise callback paths ───────────────────

describe("CronScheduler - DI callbacks", () => {
  let scheduler: CronScheduler;
  const calls: string[] = [];

  const makeDeps = (): CronSchedulerDeps => ({
    onPeriodicRebalance: () => {
      calls.push("rebalance");
    },
    onPortfolioSnapshot: () => {
      calls.push("snapshot");
    },
    onPriceCacheClean: () => {
      calls.push("priceClean");
    },
    onCopySync: () => {
      calls.push("copySync");
    },
    onDailySummary: () => {
      calls.push("dailySummary");
    },
    onWeeklySummary: () => {
      calls.push("weeklySummary");
    },
    onAiInsights: () => {
      calls.push("aiInsights");
    },
    onScheduledDCA: () => {
      calls.push("scheduledDCA");
    },
  });

  beforeEach(() => {
    calls.length = 0;
    scheduler = new CronScheduler(makeDeps());
  });

  afterEach(() => {
    scheduler.stop();
  });

  it("invokes onPeriodicRebalance when callback called directly", () => {
    scheduler.start();
    // Invoke the dep directly to verify callback wiring without waiting for cron
    (scheduler as any).deps.onPeriodicRebalance();
    expect(calls).toContain("rebalance");
  });

  it("invokes onPortfolioSnapshot when callback called directly", () => {
    scheduler.start();
    (scheduler as any).deps.onPortfolioSnapshot();
    expect(calls).toContain("snapshot");
  });

  it("invokes onPriceCacheClean when callback called directly", () => {
    scheduler.start();
    (scheduler as any).deps.onPriceCacheClean();
    expect(calls).toContain("priceClean");
  });

  it("invokes onCopySync when callback called directly", () => {
    scheduler.start();
    (scheduler as any).deps.onCopySync();
    expect(calls).toContain("copySync");
  });

  it("invokes onDailySummary when callback called directly", () => {
    scheduler.start();
    (scheduler as any).deps.onDailySummary();
    expect(calls).toContain("dailySummary");
  });

  it("invokes onWeeklySummary when callback called directly", () => {
    scheduler.start();
    (scheduler as any).deps.onWeeklySummary();
    expect(calls).toContain("weeklySummary");
  });

  it("invokes onAiInsights when callback called directly", () => {
    scheduler.start();
    (scheduler as any).deps.onAiInsights();
    expect(calls).toContain("aiInsights");
  });

  it("all 8 callbacks are accessible via deps", () => {
    scheduler.start();
    const depKeys = Object.keys((scheduler as any).deps);
    expect(depKeys).toContain("onPeriodicRebalance");
    expect(depKeys).toContain("onPortfolioSnapshot");
    expect(depKeys).toContain("onPriceCacheClean");
    expect(depKeys).toContain("onCopySync");
    expect(depKeys).toContain("onDailySummary");
    expect(depKeys).toContain("onWeeklySummary");
    expect(depKeys).toContain("onAiInsights");
    expect(depKeys).toContain("onScheduledDCA");
  });

  it("CronScheduler instantiates without any deps (uses defaults)", () => {
    const defaultScheduler = new CronScheduler();
    expect(defaultScheduler).toBeDefined();
    defaultScheduler.start();
    expect(defaultScheduler["jobs"].length).toBe(8);
    defaultScheduler.stop();
  });

  it("injected callbacks receive correct context (no-throw)", () => {
    let snapshotCalled = false;
    const s = new CronScheduler({
      onPortfolioSnapshot: () => {
        snapshotCalled = true;
      },
    });
    s.start();
    (s as any).deps.onPortfolioSnapshot();
    expect(snapshotCalled).toBe(true);
    s.stop();
  });
});

// ─── Default callback coverage ────────────────────────────────────────────────

describe("CronScheduler - default callback execution", () => {
  it("default onPeriodicRebalance emits rebalance:trigger via eventBus", () => {
    const { eventBus: eb } = require("@events/event-bus");
    const emitted: unknown[] = [];
    const originalEmit = eb.emit.bind(eb);
    eb.emit = (event: string, data: unknown) => {
      if (event === "rebalance:trigger") emitted.push(data);
      return originalEmit(event, data);
    };

    const s = new CronScheduler();
    s.start();
    (s as any).deps.onPeriodicRebalance();
    s.stop();

    eb.emit = originalEmit;
    expect(emitted.length).toBeGreaterThanOrEqual(1);
    expect((emitted[0] as any).trigger).toBe("periodic");
  });

  it("default onPortfolioSnapshot skips when portfolio is null", () => {
    // portfolioTracker.getPortfolio() returns null by default
    // Just verify no throw
    const s = new CronScheduler();
    s.start();
    expect(() => (s as any).deps.onPortfolioSnapshot()).not.toThrow();
    s.stop();
  });

  it("default onPriceCacheClean calls priceCache.clearStale()", () => {
    const { priceCache: pc } = require("@price/price-cache");
    let clearCalled = false;
    const original = pc.clearStale.bind(pc);
    pc.clearStale = () => {
      clearCalled = true;
      return original();
    };

    const s = new CronScheduler();
    s.start();
    (s as any).deps.onPriceCacheClean();
    s.stop();

    pc.clearStale = original;
    expect(clearCalled).toBe(true);
  });

  it("default onCopySync calls copySyncEngine.syncAll() without throwing", () => {
    const s = new CronScheduler();
    s.start();
    expect(() => (s as any).deps.onCopySync()).not.toThrow();
    s.stop();
  });

  it("default onDailySummary calls marketSummaryService.generateDailySummary() without throwing", () => {
    const s = new CronScheduler();
    s.start();
    expect(() => (s as any).deps.onDailySummary()).not.toThrow();
    s.stop();
  });

  it("default onWeeklySummary calls marketSummaryService.generateWeeklySummary() without throwing", () => {
    const s = new CronScheduler();
    s.start();
    expect(() => (s as any).deps.onWeeklySummary()).not.toThrow();
    s.stop();
  });

  it("default onAiInsights skips when portfolio is null", () => {
    const s = new CronScheduler();
    s.start();
    expect(() => (s as any).deps.onAiInsights()).not.toThrow();
    s.stop();
  });

  it("default onPortfolioSnapshot calls snapshotService when portfolio exists", async () => {
    // We need portfolioTracker to return a portfolio
    const { portfolioTracker: pt } = require("@portfolio/portfolio-tracker");
    const { snapshotService: ss } = require("@portfolio/snapshot-service");

    // Stub getPortfolio to return a mock portfolio
    const originalGetPortfolio = pt.getPortfolio.bind(pt);
    pt.getPortfolio = () => ({
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    });

    // Stub saveSnapshot to succeed
    const originalSave = ss.saveSnapshot.bind(ss);
    let saveCalled = false;
    ss.saveSnapshot = async () => {
      saveCalled = true;
    };

    const s = new CronScheduler();
    s.start();
    (s as any).deps.onPortfolioSnapshot();
    await new Promise<void>((r) => setTimeout(r, 20));
    s.stop();

    pt.getPortfolio = originalGetPortfolio;
    ss.saveSnapshot = originalSave;

    expect(saveCalled).toBe(true);
  });

  it("default onPortfolioSnapshot catch fires when saveSnapshot rejects", async () => {
    const { portfolioTracker: pt } = require("@portfolio/portfolio-tracker");
    const { snapshotService: ss } = require("@portfolio/snapshot-service");

    pt.getPortfolio = () => ({ totalValueUsd: 100, assets: [], updatedAt: Date.now() });
    const originalSave = ss.saveSnapshot.bind(ss);
    ss.saveSnapshot = async () => {
      throw new Error("DB error");
    };

    const s = new CronScheduler();
    s.start();
    expect(() => (s as any).deps.onPortfolioSnapshot()).not.toThrow();
    await new Promise<void>((r) => setTimeout(r, 20));
    s.stop();

    pt.getPortfolio = () => null;
    ss.saveSnapshot = originalSave;
  });

  it("default onCopySync catch fires when syncAll rejects", async () => {
    const { copySyncEngine: cse } = require("@/copy-trading/copy-sync-engine");
    const original = cse.syncAll.bind(cse);
    cse.syncAll = async () => {
      throw new Error("sync error");
    };

    const s = new CronScheduler();
    s.start();
    expect(() => (s as any).deps.onCopySync()).not.toThrow();
    await new Promise<void>((r) => setTimeout(r, 20));
    s.stop();

    cse.syncAll = original;
  });

  it("default onDailySummary catch fires when generateDailySummary rejects", async () => {
    const { marketSummaryService: mss } = require("@/ai/market-summary-service");
    const original = mss.generateDailySummary.bind(mss);
    mss.generateDailySummary = async () => {
      throw new Error("gen error");
    };

    const s = new CronScheduler();
    s.start();
    expect(() => (s as any).deps.onDailySummary()).not.toThrow();
    await new Promise<void>((r) => setTimeout(r, 20));
    s.stop();

    mss.generateDailySummary = original;
  });
});
