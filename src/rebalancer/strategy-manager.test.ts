/**
 * strategy-manager.test.ts
 *
 * Tests for StrategyManager using real dependencies (no mock.module).
 * Runs in the main test suite — coverage counts toward CI.
 *
 * Run:
 *   API_KEY=test-ci-key API_PORT=3001 ENCRYPTION_KEY=abcdefghijklmnopqrstuvwxyz123456 \
 *   MONGODB_URI="mongodb://localhost:27017/rebalance-test" REBALANCE_THRESHOLD=5 \
 *   REBALANCE_COOLDOWN_HOURS=1 MIN_TRADE_USD=10 MAX_TRADE_USD=5000 DAILY_LOSS_LIMIT_PCT=10 \
 *   bun test src/rebalancer/strategy-manager.test.ts --timeout 15000
 */

import { afterAll, beforeAll, beforeEach, describe, expect, it, spyOn } from "bun:test";
import type { Allocation, Portfolio, PortfolioAsset } from "@/types/index";
import type { IStrategyConfig } from "@db/models/strategy-config-model";
import { StrategyConfigModel } from "@db/models/strategy-config-model";
import { setupTestDB, teardownTestDB } from "@db/test-helpers";
import { momentumCalculator } from "@rebalancer/momentum-calculator";
import { StrategyManager } from "@rebalancer/strategy-manager";
import { volatilityTracker } from "@rebalancer/volatility-tracker";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function makeConfig(
  overrides: Partial<IStrategyConfig> & { params?: Record<string, unknown> } = {}
): IStrategyConfig {
  return {
    name: "test-config",
    description: "",
    params: { type: "threshold" },
    globalSettings: {},
    isActive: true,
    presetName: null,
    version: 1,
    history: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  };
}

function makeAllocations(assets: { asset: string; targetPct: number }[]): Allocation[] {
  return assets.map(({ asset, targetPct }) => ({ asset, targetPct, minTradeUsd: 10 }));
}

function makePortfolio(assets: Partial<PortfolioAsset>[] = []): Portfolio {
  const full: PortfolioAsset[] = assets.map((a) => ({
    asset: "BTC",
    amount: 1,
    valueUsd: 50000,
    currentPct: 50,
    targetPct: 50,
    driftPct: 0,
    exchange: "binance",
    ...a,
  }));
  return {
    totalValueUsd: full.reduce((s, a) => s + a.valueUsd, 0),
    assets: full,
    updatedAt: Date.now(),
  };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("StrategyManager (no mock.module)", () => {
  let manager: StrategyManager;

  beforeEach(() => {
    // Fresh instance per test — no shared singleton state contamination
    manager = new StrategyManager();
  });

  // ─── constructor / getMode / getActiveConfig ────────────────────────────────

  describe("constructor", () => {
    it("initializes mode from env STRATEGY_MODE (undefined when not set in test env)", () => {
      // With skipValidation=true, @t3-oss/env-core skips defaults and coercion.
      // STRATEGY_MODE env var is not exported in test command → env.STRATEGY_MODE is undefined.
      // The constructor sets this.mode = env.STRATEGY_MODE which may be undefined.
      // We just verify the constructor doesn't throw and mode matches env.
      const { env } = require("@config/app-config");
      expect(manager.getMode()).toBe(env.STRATEGY_MODE);
    });

    it("starts with no active config", () => {
      expect(manager.getActiveConfig()).toBeNull();
    });
  });

  // ─── setMode / getMode ─────────────────────────────────────────────────────

  describe("setMode() / getMode()", () => {
    it("setMode updates the current mode", () => {
      manager.setMode("equal-weight");
      expect(manager.getMode()).toBe("equal-weight");
    });

    it("supports all valid strategy modes", () => {
      const modes = [
        "threshold",
        "equal-weight",
        "momentum-tilt",
        "vol-adjusted",
        "mean-reversion",
        "momentum-weighted",
      ] as const;
      for (const mode of modes) {
        manager.setMode(mode);
        expect(manager.getMode()).toBe(mode);
      }
    });

    it("setMode does not affect activeConfig", () => {
      const config = makeConfig({ params: { type: "threshold" } });
      manager.applyConfig(config);
      manager.setMode("equal-weight");
      expect(manager.getActiveConfig()).toBe(config);
      expect(manager.getMode()).toBe("equal-weight");
    });
  });

  // ─── applyConfig / getActiveConfig ────────────────────────────────────────

  describe("applyConfig()", () => {
    it("updates the strategy mode from config.params.type", () => {
      manager.applyConfig(makeConfig({ params: { type: "equal-weight" } }));
      expect(manager.getMode()).toBe("equal-weight");
    });

    it("stores the applied config as activeConfig", () => {
      const config = makeConfig({ params: { type: "vol-adjusted" } });
      manager.applyConfig(config);
      expect(manager.getActiveConfig()).toBe(config);
    });

    it("overwrites a previously applied config", () => {
      manager.applyConfig(makeConfig({ name: "first", params: { type: "momentum-tilt" } }));
      const second = makeConfig({ name: "second", params: { type: "mean-reversion" } });
      manager.applyConfig(second);
      expect(manager.getMode()).toBe("mean-reversion");
      expect(manager.getActiveConfig()).toBe(second);
    });
  });

  describe("getActiveConfig()", () => {
    it("returns null before any config is applied", () => {
      expect(manager.getActiveConfig()).toBeNull();
    });

    it("returns the config after applyConfig is called", () => {
      const config = makeConfig({ params: { type: "equal-weight" } });
      manager.applyConfig(config);
      expect(manager.getActiveConfig()).toBe(config);
    });
  });

  // ─── getEffectiveAllocations ───────────────────────────────────────────────

  describe("getEffectiveAllocations()", () => {
    it("threshold mode returns base allocations unchanged (same reference)", () => {
      manager.setMode("threshold");
      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 60 },
        { asset: "ETH", targetPct: 40 },
      ]);
      expect(manager.getEffectiveAllocations(allocs)).toBe(allocs);
    });

    it("vol-adjusted mode returns base allocations unchanged", () => {
      manager.setMode("vol-adjusted");
      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 70 },
        { asset: "ETH", targetPct: 30 },
      ]);
      expect(manager.getEffectiveAllocations(allocs)).toBe(allocs);
    });

    it("mean-reversion mode returns base allocations unchanged", () => {
      manager.setMode("mean-reversion");
      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);
      expect(manager.getEffectiveAllocations(allocs)).toBe(allocs);
    });

    it("equal-weight mode distributes weight equally across all assets", () => {
      manager.setMode("equal-weight");
      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 70 },
        { asset: "ETH", targetPct: 20 },
        { asset: "SOL", targetPct: 10 },
      ]);
      const result = manager.getEffectiveAllocations(allocs);
      expect(result.length).toBe(3);
      result.forEach((a) => expect(a.targetPct).toBeCloseTo(33.33, 1));
    });

    it("equal-weight mode preserves asset names and other properties", () => {
      manager.setMode("equal-weight");
      const allocs: Allocation[] = [
        { asset: "BTC", targetPct: 80, minTradeUsd: 100, exchange: "binance" },
        { asset: "ETH", targetPct: 20, minTradeUsd: 50, exchange: "kraken" },
      ];
      const result = manager.getEffectiveAllocations(allocs);
      expect(result[0].asset).toBe("BTC");
      expect(result[0].exchange).toBe("binance");
      expect(result[1].asset).toBe("ETH");
      expect(result[1].exchange).toBe("kraken");
    });

    it("equal-weight mode returns empty array for empty input", () => {
      manager.setMode("equal-weight");
      expect(manager.getEffectiveAllocations([])).toEqual([]);
    });

    it("equal-weight with single asset gives 100%", () => {
      manager.setMode("equal-weight");
      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);
      const result = manager.getEffectiveAllocations(allocs);
      expect(result[0].targetPct).toBeCloseTo(100, 5);
    });

    it("momentum-tilt mode delegates to real momentumCalculator", () => {
      manager.setMode("momentum-tilt");
      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ]);
      // Spy on the real singleton — capture call and return fixed value
      const spy = spyOn(momentumCalculator, "getMomentumAllocations").mockReturnValue(allocs);
      try {
        const result = manager.getEffectiveAllocations(allocs);
        expect(spy).toHaveBeenCalledWith(allocs);
        expect(result).toBe(allocs);
      } finally {
        spy.mockRestore();
      }
    });

    it("momentum-weighted mode without priceHistories returns base allocations", () => {
      const params = {
        type: "momentum-weighted",
        minTradeUsd: 10,
        rsiPeriod: 14,
        macdFast: 12,
        macdSlow: 26,
        weightFactor: 0.4,
      };
      manager.applyConfig(makeConfig({ params }));
      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);
      // No priceHistories argument → should short-circuit and return base
      expect(manager.getEffectiveAllocations(allocs)).toBe(allocs);
    });

    it("momentum-weighted mode without activeConfig params returns base allocations", () => {
      // setMode only — no applyConfig, so activeConfig is null
      manager.setMode("momentum-weighted");
      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);
      const priceHistories = new Map<string, number[]>([["BTC", [100, 110]]]);
      expect(manager.getEffectiveAllocations(allocs, priceHistories)).toBe(allocs);
    });
  });

  // ─── shouldRebalance ──────────────────────────────────────────────────────

  describe("shouldRebalance()", () => {
    it("threshold mode: true when drift >= REBALANCE_THRESHOLD", () => {
      // env.REBALANCE_THRESHOLD is "5" (string) in test env due to skipValidation.
      // The >= comparison coerces "5" to 5, so 5 >= "5" → true.
      manager.setMode("threshold");
      expect(manager.shouldRebalance(5)).toBe(true);
      expect(manager.shouldRebalance(6)).toBe(true);
    });

    it("threshold mode: false when drift < REBALANCE_THRESHOLD", () => {
      manager.setMode("threshold");
      expect(manager.shouldRebalance(4.9)).toBe(false);
      expect(manager.shouldRebalance(0)).toBe(false);
    });

    it("equal-weight mode: uses same threshold check as threshold mode", () => {
      manager.setMode("equal-weight");
      expect(manager.shouldRebalance(5)).toBe(true);
      expect(manager.shouldRebalance(4.9)).toBe(false);
    });

    it("mean-reversion mode: returns false when drifts not provided", () => {
      manager.applyConfig(
        makeConfig({
          params: {
            type: "mean-reversion",
            lookbackDays: 30,
            bandWidthSigma: 1.5,
            minDriftPct: 3,
            minTradeUsd: 10,
          },
        })
      );
      expect(manager.shouldRebalance(10)).toBe(false);
    });

    it("mean-reversion mode: returns false when activeConfig is null (no params)", () => {
      manager.setMode("mean-reversion");
      // No applyConfig → activeConfig null
      const drifts = new Map([["BTC", 5]]);
      expect(manager.shouldRebalance(10, drifts)).toBe(false);
    });

    it("vol-adjusted mode without params: returns false when volatility is low", () => {
      manager.setMode("vol-adjusted");
      // volatilityTracker has no recorded data → vol = 0 → isHighVolatility() = false
      const spy = spyOn(volatilityTracker, "isHighVolatility").mockReturnValue(false);
      try {
        expect(manager.shouldRebalance(10)).toBe(false);
      } finally {
        spy.mockRestore();
      }
    });

    it("vol-adjusted mode without params: falls through to getDynamicThreshold when high vol", () => {
      manager.setMode("vol-adjusted");
      const spy = spyOn(volatilityTracker, "isHighVolatility").mockReturnValue(true);
      try {
        // With skipValidation=true, env.DYNAMIC_THRESHOLD_LOW is undefined.
        // getDynamicThreshold() returns undefined when high vol.
        // maxDriftPct >= undefined is false (NaN comparison).
        // Behavior is consistent: shouldRebalance falls through to getDynamicThreshold.
        const threshold = manager.getDynamicThreshold();
        const result = manager.shouldRebalance(999);
        // If threshold is a real number, 999 should exceed it; otherwise NaN → false
        if (typeof threshold === "number" && !Number.isNaN(threshold)) {
          expect(result).toBe(999 >= threshold);
        } else {
          expect(result).toBe(false);
        }
      } finally {
        spy.mockRestore();
      }
    });
  });

  // ─── getDynamicThreshold ──────────────────────────────────────────────────

  describe("getDynamicThreshold()", () => {
    it("non-vol-adjusted modes return env.REBALANCE_THRESHOLD", () => {
      // With skipValidation=true, env.REBALANCE_THRESHOLD is the raw string "5" from process.env.
      // We compare against the actual env value to stay accurate.
      const { env } = require("@config/app-config");
      const modes = [
        "threshold",
        "equal-weight",
        "momentum-tilt",
        "mean-reversion",
        "momentum-weighted",
      ] as const;
      for (const mode of modes) {
        manager.setMode(mode);
        expect(String(manager.getDynamicThreshold())).toBe(String(env.REBALANCE_THRESHOLD));
      }
    });

    it("vol-adjusted without params returns env.DYNAMIC_THRESHOLD_HIGH when low vol", () => {
      manager.setMode("vol-adjusted");
      const { env } = require("@config/app-config");
      const spy = spyOn(volatilityTracker, "isHighVolatility").mockReturnValue(false);
      try {
        // env.DYNAMIC_THRESHOLD_HIGH may be undefined when skipValidation=true and not set
        expect(manager.getDynamicThreshold()).toBe(env.DYNAMIC_THRESHOLD_HIGH);
      } finally {
        spy.mockRestore();
      }
    });

    it("vol-adjusted without params returns env.DYNAMIC_THRESHOLD_LOW when high vol", () => {
      manager.setMode("vol-adjusted");
      const { env } = require("@config/app-config");
      const spy = spyOn(volatilityTracker, "isHighVolatility").mockReturnValue(true);
      try {
        expect(manager.getDynamicThreshold()).toBe(env.DYNAMIC_THRESHOLD_LOW);
      } finally {
        spy.mockRestore();
      }
    });
  });

  // ─── getStrategyInfo ──────────────────────────────────────────────────────

  describe("getStrategyInfo()", () => {
    it("returns an object with the correct shape", () => {
      const info = manager.getStrategyInfo();
      expect(info).toHaveProperty("mode");
      expect(info).toHaveProperty("threshold");
      expect(info).toHaveProperty("volatility");
      expect(info).toHaveProperty("momentumScores");
    });

    it("reflects current mode", () => {
      manager.setMode("equal-weight");
      expect(manager.getStrategyInfo().mode).toBe("equal-weight");
    });

    it("threshold equals getDynamicThreshold()", () => {
      manager.setMode("threshold");
      expect(manager.getStrategyInfo().threshold).toBe(manager.getDynamicThreshold());
    });

    it("volatility is a non-negative number", () => {
      const info = manager.getStrategyInfo();
      expect(typeof info.volatility).toBe("number");
      expect(info.volatility).toBeGreaterThanOrEqual(0);
    });

    it("momentumScores is an object", () => {
      const info = manager.getStrategyInfo();
      expect(typeof info.momentumScores).toBe("object");
      expect(info.momentumScores).not.toBeNull();
    });

    it("volatility comes from volatilityTracker.getVolatility()", () => {
      const spy = spyOn(volatilityTracker, "getVolatility").mockReturnValue(42);
      try {
        expect(manager.getStrategyInfo().volatility).toBe(42);
      } finally {
        spy.mockRestore();
      }
    });
  });

  // ─── getDCATarget ─────────────────────────────────────────────────────────

  describe("getDCATarget()", () => {
    it("returns null when activeConfig is null (no globalSettings)", () => {
      const portfolio = makePortfolio();
      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);
      expect(manager.getDCATarget(portfolio, allocs)).toBeNull();
    });

    it("returns null when dcaRebalanceEnabled is false", () => {
      manager.applyConfig(makeConfig({ globalSettings: { dcaRebalanceEnabled: false } }));
      const portfolio = makePortfolio();
      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);
      expect(manager.getDCATarget(portfolio, allocs)).toBeNull();
    });

    it("returns null when globalSettings exists but dcaRebalanceEnabled is absent", () => {
      manager.applyConfig(makeConfig({ globalSettings: { someOtherSetting: true } }));
      const portfolio = makePortfolio();
      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);
      expect(manager.getDCATarget(portfolio, allocs)).toBeNull();
    });

    it("delegates to getDCATarget resolver when dcaRebalanceEnabled=true and portfolio underweight", () => {
      manager.applyConfig(makeConfig({ globalSettings: { dcaRebalanceEnabled: true } }));
      // Portfolio: ETH is underweight — 20% actual vs 50% target
      const portfolio = makePortfolio([
        { asset: "BTC", valueUsd: 80000, currentPct: 80 },
        { asset: "ETH", valueUsd: 20000, currentPct: 20 },
      ]);
      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ]);
      // Real getDCATarget resolves: ETH has highest positive drift
      const result = manager.getDCATarget(portfolio, allocs);
      expect(result).toBe("ETH");
    });

    it("returns null when portfolio is balanced (no positive drift)", () => {
      manager.applyConfig(makeConfig({ globalSettings: { dcaRebalanceEnabled: true } }));
      // BTC at exactly target → no positive drift
      const portfolio = makePortfolio([{ asset: "BTC", valueUsd: 100000, currentPct: 100 }]);
      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);
      const result = manager.getDCATarget(portfolio, allocs);
      expect(result).toBeNull();
    });

    it("returns asset with highest underweight when multiple assets present", () => {
      manager.applyConfig(makeConfig({ globalSettings: { dcaRebalanceEnabled: true } }));
      // SOL most underweight: target 40%, actual ~11%
      const portfolio = makePortfolio([
        { asset: "BTC", valueUsd: 60000 },
        { asset: "ETH", valueUsd: 30000 },
        { asset: "SOL", valueUsd: 10000 },
      ]);
      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 60 },
        { asset: "ETH", targetPct: 30 },
        { asset: "SOL", targetPct: 40 },
      ]);
      // BTC 60k/100k=60% target 60% → 0 drift
      // ETH 30k/100k=30% target 30% → 0 drift
      // SOL 10k/100k=10% target 40% → +30 drift (most underweight)
      const result = manager.getDCATarget(portfolio, allocs);
      expect(result).toBe("SOL");
    });
  });

  // ─── EventBus wiring (real eventBus) ─────────────────────────────────────

  describe("EventBus: strategy:config-changed", () => {
    it("emitting strategy:config-changed applies the config", async () => {
      // Import real eventBus
      const { eventBus } = await import("@events/event-bus");
      const config = makeConfig({ name: "live-update", params: { type: "momentum-tilt" } });

      eventBus.emit("strategy:config-changed", config as never);

      // The singleton strategyManager receives this, but our fresh `manager`
      // instance also registered a listener in its constructor
      expect(manager.getMode()).toBe("momentum-tilt");
      expect(manager.getActiveConfig()).toBe(config);

      // Clean up: restore to default
      eventBus.emit(
        "strategy:config-changed",
        makeConfig({ name: "reset", params: { type: "threshold" } }) as never
      );
    });
  });

  // ─── loadFromDb (real MongoDB) ────────────────────────────────────────────

  describe("loadFromDb() — real MongoDB", () => {
    beforeAll(async () => {
      await setupTestDB();
    });

    afterAll(async () => {
      await teardownTestDB();
    });

    beforeEach(async () => {
      // Clear strategy configs before each DB test
      await StrategyConfigModel.deleteMany({});
    });

    it("applies config when an active config is found in DB", async () => {
      await StrategyConfigModel.create({
        name: "db-momentum",
        description: "loaded from DB",
        params: { type: "momentum-tilt" },
        globalSettings: {},
        isActive: true,
        presetName: null,
        version: 1,
        history: [],
      });

      await manager.loadFromDb();

      expect(manager.getMode()).toBe("momentum-tilt");
      expect(manager.getActiveConfig()).not.toBeNull();
      expect(manager.getActiveConfig()?.name).toBe("db-momentum");
    });

    it("keeps env defaults when no active config found in DB", async () => {
      // DB is empty — no documents seeded.
      // mode stays as whatever env.STRATEGY_MODE is (undefined with skipValidation).
      const { env } = require("@config/app-config");
      await manager.loadFromDb();

      expect(manager.getMode()).toBe(env.STRATEGY_MODE);
      expect(manager.getActiveConfig()).toBeNull();
    });

    it("handles DB errors gracefully (keeps env defaults)", async () => {
      // Spy on findOne to simulate a DB error.
      const { env } = require("@config/app-config");
      const spy = spyOn(StrategyConfigModel, "findOne").mockImplementation(() => {
        throw new Error("DB down");
      });
      try {
        await manager.loadFromDb();
        expect(manager.getMode()).toBe(env.STRATEGY_MODE);
        expect(manager.getActiveConfig()).toBeNull();
      } finally {
        spy.mockRestore();
      }
    });

    it("applies globalSettings from DB config", async () => {
      await StrategyConfigModel.create({
        name: "db-dca",
        description: "DCA config",
        params: { type: "threshold" },
        globalSettings: { dcaRebalanceEnabled: true },
        isActive: true,
        presetName: null,
        version: 1,
        history: [],
      });

      await manager.loadFromDb();

      const activeConfig = manager.getActiveConfig();
      expect(activeConfig).not.toBeNull();
      expect(activeConfig?.globalSettings).toMatchObject({ dcaRebalanceEnabled: true });
    });

    it("stores loaded config and enables getDCATarget", async () => {
      await StrategyConfigModel.create({
        name: "db-dca-enabled",
        params: { type: "threshold" },
        globalSettings: { dcaRebalanceEnabled: true },
        isActive: true,
        presetName: null,
        version: 1,
        history: [],
      });

      await manager.loadFromDb();

      // With dcaRebalanceEnabled=true, getDCATarget should resolve
      const portfolio = makePortfolio([
        { asset: "BTC", valueUsd: 80000 },
        { asset: "ETH", valueUsd: 20000 },
      ]);
      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ]);
      // ETH underweight → should return "ETH"
      expect(manager.getDCATarget(portfolio, allocs)).toBe("ETH");
    });
  });
});
