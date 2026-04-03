/**
 * strategy-manager.test.ts
 *
 * Tests for the real StrategyManager class (not the mock).
 * All external dependencies are mocked via mock.module so no DB/exchange
 * connections are needed.
 *
 * Run:
 *   MONGODB_URI="mongodb://localhost:27017/rebalance-test" API_KEY=test-ci-key \
 *   API_PORT=3001 ENCRYPTION_KEY=abcdefghijklmnopqrstuvwxyz123456 \
 *   REBALANCE_THRESHOLD=5 REBALANCE_COOLDOWN_HOURS=1 MIN_TRADE_USD=10 \
 *   MAX_TRADE_USD=5000 DAILY_LOSS_LIMIT_PCT=10 \
 *   bun test src/rebalancer/strategy-manager.test.ts
 */

import { beforeEach, describe, expect, it, mock } from "bun:test";
import type { IStrategyConfig } from "@db/models/strategy-config-model";

// ─── Captured event listeners (for testing eventBus wiring) ──────────────────

/** Holds the last listener registered with eventBus.on("strategy:config-changed", ...) */
let capturedConfigChangedListener: ((config: IStrategyConfig) => void) | null = null;

// ─── Dependency mocks (must be declared before any import of the module) ──────

mock.module("@config/app-config", () => ({
  env: {
    STRATEGY_MODE: "threshold",
    REBALANCE_THRESHOLD: 5,
    VOLATILITY_THRESHOLD: 50,
    DYNAMIC_THRESHOLD_LOW: 3,
    DYNAMIC_THRESHOLD_HIGH: 8,
    MOMENTUM_WINDOW_DAYS: 30,
  },
}));

const mockFindOne = mock(() => Promise.resolve(null));
mock.module("@db/database", () => ({
  StrategyConfigModel: {
    findOne: (...args: unknown[]) => mockFindOne(...args),
  },
}));

mock.module("@events/event-bus", () => ({
  eventBus: {
    on: (event: string, listener: (config: IStrategyConfig) => void) => {
      if (event === "strategy:config-changed") {
        capturedConfigChangedListener = listener;
      }
    },
    emit: () => true,
    off: () => {},
  },
}));

const mockGetMomentumAllocations = mock((allocs: unknown[]) => allocs);
mock.module("@rebalancer/momentum-calculator", () => ({
  momentumCalculator: {
    getMomentumAllocations: (allocs: unknown[]) => mockGetMomentumAllocations(allocs),
    getAllMomentumScores: () => ({ BTC: 0.1, ETH: -0.05 }),
  },
}));

const mockMeanReversionShouldRebalance = mock(() => false);
mock.module("@rebalancer/strategies/mean-reversion-strategy", () => ({
  meanReversionStrategy: {
    shouldRebalance: (drifts: unknown, params: unknown) =>
      mockMeanReversionShouldRebalance(drifts, params),
  },
}));

const mockVolAdjustedGetDynamicThreshold = mock(() => 6);
mock.module("@rebalancer/strategies/vol-adjusted-strategy", () => ({
  volAdjustedStrategy: {
    getDynamicThreshold: (params: unknown) => mockVolAdjustedGetDynamicThreshold(params),
  },
}));

const mockGetAdjustedAllocations = mock((allocs: unknown[]) => allocs);
mock.module("@rebalancer/strategies/momentum-weighted-strategy", () => ({
  momentumWeightedStrategy: {
    getAdjustedAllocations: (
      allocs: unknown[],
      priceHistories: unknown,
      params: unknown
    ) => mockGetAdjustedAllocations(allocs, priceHistories, params),
  },
}));

const mockIsHighVolatility = mock(() => false);
const mockGetVolatility = mock(() => 25);
mock.module("@rebalancer/volatility-tracker", () => ({
  volatilityTracker: {
    isHighVolatility: () => mockIsHighVolatility(),
    getVolatility: () => mockGetVolatility(),
  },
}));

const mockGetDCATarget = mock(() => null as string | null);
mock.module("@rebalancer/dca-target-resolver", () => ({
  getDCATarget: (portfolio: unknown, allocs: unknown) => mockGetDCATarget(portfolio, allocs),
}));

// ─── Import AFTER mocks are registered ────────────────────────────────────────

import { StrategyManager } from "@rebalancer/strategy-manager";
import type { StrategyMode } from "@rebalancer/strategy-manager";
import type { Allocation, Portfolio, PortfolioAsset } from "@/types/index";

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

describe("StrategyManager (real class)", () => {
  let manager: StrategyManager;

  beforeEach(() => {
    // Reset call counts on all mocks
    mockFindOne.mockReset();
    mockGetMomentumAllocations.mockReset();
    mockMeanReversionShouldRebalance.mockReset();
    mockVolAdjustedGetDynamicThreshold.mockReset();
    mockGetAdjustedAllocations.mockReset();
    mockIsHighVolatility.mockReset();
    mockGetVolatility.mockReset();
    mockGetDCATarget.mockReset();

    // Restore sensible defaults after reset
    mockFindOne.mockImplementation(() => Promise.resolve(null));
    mockGetMomentumAllocations.mockImplementation((allocs) => allocs);
    mockMeanReversionShouldRebalance.mockImplementation(() => false);
    mockVolAdjustedGetDynamicThreshold.mockImplementation(() => 6);
    mockGetAdjustedAllocations.mockImplementation((allocs) => allocs);
    mockIsHighVolatility.mockImplementation(() => false);
    mockGetVolatility.mockImplementation(() => 25);
    mockGetDCATarget.mockImplementation(() => null);

    capturedConfigChangedListener = null;
    manager = new StrategyManager();
  });

  // ─── Constructor ────────────────────────────────────────────────────────────

  describe("constructor", () => {
    it("reads STRATEGY_MODE from env and sets it as the initial mode", () => {
      expect(manager.getMode()).toBe("threshold");
    });

    it("starts with no active config", () => {
      expect(manager.getActiveConfig()).toBeNull();
    });

    it("registers a listener on strategy:config-changed event bus", () => {
      // capturedConfigChangedListener is set when StrategyManager calls eventBus.on()
      expect(typeof capturedConfigChangedListener).toBe("function");
    });
  });

  // ─── loadFromDb ─────────────────────────────────────────────────────────────

  describe("loadFromDb()", () => {
    it("applies config when an active config is found in DB", async () => {
      const config = makeConfig({ name: "momentum", params: { type: "momentum-tilt" } });
      mockFindOne.mockImplementation(() =>
        Promise.resolve({ ...config, lean: () => config })
      );
      // StrategyConfigModel.findOne returns a chainable { lean() } object
      const leanConfig = { ...config };
      mockFindOne.mockImplementation(() => ({ lean: () => Promise.resolve(leanConfig) }));

      await manager.loadFromDb();

      expect(manager.getMode()).toBe("momentum-tilt");
      expect(manager.getActiveConfig()).toBe(leanConfig);
    });

    it("uses env defaults when no active config found in DB", async () => {
      mockFindOne.mockImplementation(() => ({ lean: () => Promise.resolve(null) }));

      await manager.loadFromDb();

      expect(manager.getMode()).toBe("threshold");
      expect(manager.getActiveConfig()).toBeNull();
    });

    it("handles DB errors gracefully and keeps env defaults", async () => {
      mockFindOne.mockImplementation(() => ({ lean: () => Promise.reject(new Error("DB down")) }));

      // Should not throw
      await manager.loadFromDb();

      expect(manager.getMode()).toBe("threshold");
      expect(manager.getActiveConfig()).toBeNull();
    });
  });

  // ─── applyConfig ────────────────────────────────────────────────────────────

  describe("applyConfig()", () => {
    it("updates the strategy mode from config.params.type", () => {
      const config = makeConfig({ params: { type: "equal-weight" } });
      manager.applyConfig(config);
      expect(manager.getMode()).toBe("equal-weight");
    });

    it("stores the applied config as activeConfig", () => {
      const config = makeConfig({ params: { type: "vol-adjusted" } });
      manager.applyConfig(config);
      expect(manager.getActiveConfig()).toBe(config);
    });

    it("overwrites a previously applied config", () => {
      const first = makeConfig({ name: "first", params: { type: "momentum-tilt" } });
      const second = makeConfig({ name: "second", params: { type: "mean-reversion" } });

      manager.applyConfig(first);
      manager.applyConfig(second);

      expect(manager.getMode()).toBe("mean-reversion");
      expect(manager.getActiveConfig()).toBe(second);
    });
  });

  // ─── getActiveConfig ────────────────────────────────────────────────────────

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

  // ─── getEffectiveAllocations ─────────────────────────────────────────────────

  describe("getEffectiveAllocations()", () => {
    it("threshold mode returns base allocations unchanged", () => {
      manager.setMode("threshold");
      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 60 },
        { asset: "ETH", targetPct: 40 },
      ]);
      const result = manager.getEffectiveAllocations(allocs);
      expect(result).toBe(allocs); // Same reference — no transformation
    });

    it("vol-adjusted mode returns base allocations unchanged (threshold-only)", () => {
      manager.setMode("vol-adjusted");
      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 70 },
        { asset: "ETH", targetPct: 30 },
      ]);
      const result = manager.getEffectiveAllocations(allocs);
      expect(result).toBe(allocs);
    });

    it("equal-weight mode distributes weight equally across assets", () => {
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

    it("equal-weight mode preserves asset names and metadata", () => {
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

    it("momentum-tilt mode delegates to momentumCalculator", () => {
      manager.setMode("momentum-tilt");
      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ]);
      const tilted = makeAllocations([
        { asset: "BTC", targetPct: 60 },
        { asset: "ETH", targetPct: 40 },
      ]);
      mockGetMomentumAllocations.mockImplementation(() => tilted);

      const result = manager.getEffectiveAllocations(allocs);

      expect(mockGetMomentumAllocations).toHaveBeenCalledWith(allocs);
      expect(result).toBe(tilted);
    });

    it("momentum-weighted mode with params and priceHistories delegates to strategy", () => {
      const params = {
        type: "momentum-weighted",
        minTradeUsd: 10,
        rsiPeriod: 14,
        macdFast: 12,
        macdSlow: 26,
        weightFactor: 0.4,
      };
      manager.applyConfig(makeConfig({ params }));

      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ]);
      const priceHistories = new Map<string, number[]>([
        ["BTC", [100, 110, 105]],
        ["ETH", [50, 55, 52]],
      ]);
      const weighted = makeAllocations([
        { asset: "BTC", targetPct: 55 },
        { asset: "ETH", targetPct: 45 },
      ]);
      mockGetAdjustedAllocations.mockImplementation(() => weighted);

      const result = manager.getEffectiveAllocations(allocs, priceHistories);

      expect(mockGetAdjustedAllocations).toHaveBeenCalledWith(allocs, priceHistories, params);
      expect(result).toBe(weighted);
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
      const result = manager.getEffectiveAllocations(allocs); // no priceHistories

      expect(result).toBe(allocs);
      expect(mockGetAdjustedAllocations).not.toHaveBeenCalled();
    });

    it("momentum-weighted mode without activeConfig params returns base allocations", () => {
      manager.setMode("momentum-weighted");
      // No applyConfig call → activeConfig is null

      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);
      const priceHistories = new Map<string, number[]>([["BTC", [100, 110]]]);
      const result = manager.getEffectiveAllocations(allocs, priceHistories);

      expect(result).toBe(allocs);
      expect(mockGetAdjustedAllocations).not.toHaveBeenCalled();
    });
  });

  // ─── shouldRebalance ─────────────────────────────────────────────────────────

  describe("shouldRebalance()", () => {
    it("threshold mode: returns true when drift >= env.REBALANCE_THRESHOLD", () => {
      manager.setMode("threshold");
      expect(manager.shouldRebalance(5)).toBe(true);
      expect(manager.shouldRebalance(6)).toBe(true);
    });

    it("threshold mode: returns false when drift < env.REBALANCE_THRESHOLD", () => {
      manager.setMode("threshold");
      expect(manager.shouldRebalance(4.9)).toBe(false);
      expect(manager.shouldRebalance(0)).toBe(false);
    });

    it("mean-reversion mode: returns false when drifts is not provided", () => {
      manager.applyConfig(makeConfig({ params: { type: "mean-reversion", lookbackDays: 30, bandWidthSigma: 1.5, minDriftPct: 3, minTradeUsd: 10 } }));
      const result = manager.shouldRebalance(10);
      expect(result).toBe(false);
      expect(mockMeanReversionShouldRebalance).not.toHaveBeenCalled();
    });

    it("mean-reversion mode: returns false when params are not set", () => {
      manager.setMode("mean-reversion");
      // No applyConfig → activeConfig is null → params is undefined
      const drifts = new Map([["BTC", 5]]);
      const result = manager.shouldRebalance(10, drifts);
      expect(result).toBe(false);
      expect(mockMeanReversionShouldRebalance).not.toHaveBeenCalled();
    });

    it("mean-reversion mode: delegates to meanReversionStrategy when drifts and params present", () => {
      const params = { type: "mean-reversion", lookbackDays: 30, bandWidthSigma: 1.5, minDriftPct: 3, minTradeUsd: 10 };
      manager.applyConfig(makeConfig({ params }));
      const drifts = new Map([["BTC", 8], ["ETH", -3]]);
      mockMeanReversionShouldRebalance.mockImplementation(() => true);

      const result = manager.shouldRebalance(10, drifts);

      expect(mockMeanReversionShouldRebalance).toHaveBeenCalledWith(drifts, params);
      expect(result).toBe(true);
    });

    it("vol-adjusted mode with params: uses volAdjustedStrategy.getDynamicThreshold", () => {
      const params = { type: "vol-adjusted", minTradeUsd: 10, baseThresholdPct: 5, volLookbackDays: 30, minThresholdPct: 3, maxThresholdPct: 20 };
      manager.applyConfig(makeConfig({ params }));
      mockVolAdjustedGetDynamicThreshold.mockImplementation(() => 7);

      // drift 8 >= dynamic threshold 7 → true
      expect(manager.shouldRebalance(8)).toBe(true);
      // drift 6 < dynamic threshold 7 → false
      expect(manager.shouldRebalance(6)).toBe(false);

      expect(mockVolAdjustedGetDynamicThreshold).toHaveBeenCalledWith(params);
    });

    it("vol-adjusted mode without params: returns false when volatility is low", () => {
      manager.setMode("vol-adjusted");
      // No applyConfig → activeConfig null → no params
      mockIsHighVolatility.mockImplementation(() => false);

      const result = manager.shouldRebalance(10);
      expect(result).toBe(false);
    });

    it("vol-adjusted mode without params: uses DYNAMIC_THRESHOLD_LOW (3) when high vol", () => {
      manager.setMode("vol-adjusted");
      mockIsHighVolatility.mockImplementation(() => true);

      // high vol → getDynamicThreshold returns DYNAMIC_THRESHOLD_LOW = 3
      // drift 3 >= 3 → true; drift 2 < 3 → false
      expect(manager.shouldRebalance(3)).toBe(true);
      expect(manager.shouldRebalance(2)).toBe(false);
    });
  });

  // ─── getDynamicThreshold ────────────────────────────────────────────────────

  describe("getDynamicThreshold()", () => {
    it("non-vol-adjusted modes return env.REBALANCE_THRESHOLD", () => {
      for (const mode of ["threshold", "equal-weight", "momentum-tilt", "mean-reversion", "momentum-weighted"] as StrategyMode[]) {
        manager.setMode(mode);
        expect(manager.getDynamicThreshold()).toBe(5);
      }
    });

    it("vol-adjusted with params delegates to volAdjustedStrategy", () => {
      const params = { type: "vol-adjusted", minTradeUsd: 10, baseThresholdPct: 5, volLookbackDays: 30, minThresholdPct: 3, maxThresholdPct: 20 };
      manager.applyConfig(makeConfig({ params }));
      mockVolAdjustedGetDynamicThreshold.mockImplementation(() => 9);

      expect(manager.getDynamicThreshold()).toBe(9);
      expect(mockVolAdjustedGetDynamicThreshold).toHaveBeenCalledWith(params);
    });

    it("vol-adjusted without params returns DYNAMIC_THRESHOLD_LOW when high vol", () => {
      manager.setMode("vol-adjusted");
      mockIsHighVolatility.mockImplementation(() => true);

      expect(manager.getDynamicThreshold()).toBe(3); // env.DYNAMIC_THRESHOLD_LOW
    });

    it("vol-adjusted without params returns DYNAMIC_THRESHOLD_HIGH when low vol", () => {
      manager.setMode("vol-adjusted");
      mockIsHighVolatility.mockImplementation(() => false);

      expect(manager.getDynamicThreshold()).toBe(8); // env.DYNAMIC_THRESHOLD_HIGH
    });
  });

  // ─── getStrategyInfo ─────────────────────────────────────────────────────────

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

    it("volatility comes from volatilityTracker.getVolatility()", () => {
      mockGetVolatility.mockImplementation(() => 42);
      expect(manager.getStrategyInfo().volatility).toBe(42);
    });

    it("momentumScores comes from momentumCalculator.getAllMomentumScores()", () => {
      const info = manager.getStrategyInfo();
      expect(typeof info.momentumScores).toBe("object");
      expect(info.momentumScores).toHaveProperty("BTC");
    });
  });

  // ─── getDCATarget ───────────────────────────────────────────────────────────

  describe("getDCATarget()", () => {
    it("returns null when activeConfig is null (no dcaRebalanceEnabled)", () => {
      // No applyConfig → activeConfig null → globalSettings undefined
      const portfolio = makePortfolio();
      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);
      expect(manager.getDCATarget(portfolio, allocs)).toBeNull();
      expect(mockGetDCATarget).not.toHaveBeenCalled();
    });

    it("returns null when dcaRebalanceEnabled is false in globalSettings", () => {
      manager.applyConfig(
        makeConfig({ globalSettings: { dcaRebalanceEnabled: false } })
      );
      const portfolio = makePortfolio();
      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);
      expect(manager.getDCATarget(portfolio, allocs)).toBeNull();
      expect(mockGetDCATarget).not.toHaveBeenCalled();
    });

    it("delegates to getDCATarget resolver when dcaRebalanceEnabled is true", () => {
      manager.applyConfig(
        makeConfig({ globalSettings: { dcaRebalanceEnabled: true } })
      );
      mockGetDCATarget.mockImplementation(() => "ETH");

      const portfolio = makePortfolio();
      const allocs = makeAllocations([
        { asset: "BTC", targetPct: 50 },
        { asset: "ETH", targetPct: 50 },
      ]);
      const result = manager.getDCATarget(portfolio, allocs);

      expect(mockGetDCATarget).toHaveBeenCalledWith(portfolio, allocs);
      expect(result).toBe("ETH");
    });

    it("returns null from resolver when portfolio is balanced", () => {
      manager.applyConfig(
        makeConfig({ globalSettings: { dcaRebalanceEnabled: true } })
      );
      mockGetDCATarget.mockImplementation(() => null);

      const portfolio = makePortfolio();
      const allocs = makeAllocations([{ asset: "BTC", targetPct: 100 }]);

      expect(manager.getDCATarget(portfolio, allocs)).toBeNull();
    });
  });

  // ─── setMode / getMode ───────────────────────────────────────────────────────

  describe("setMode() / getMode()", () => {
    it("setMode updates the current mode", () => {
      manager.setMode("equal-weight");
      expect(manager.getMode()).toBe("equal-weight");
    });

    it("supports all valid strategy modes", () => {
      const modes: StrategyMode[] = [
        "threshold",
        "equal-weight",
        "momentum-tilt",
        "vol-adjusted",
        "mean-reversion",
        "momentum-weighted",
      ];
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

  // ─── EventBus wiring ─────────────────────────────────────────────────────────

  describe("EventBus: strategy:config-changed listener", () => {
    it("calling the listener triggers applyConfig with the provided config", () => {
      expect(capturedConfigChangedListener).not.toBeNull();

      const config = makeConfig({ name: "live-update", params: { type: "momentum-tilt" } });
      // Simulate the event bus emitting strategy:config-changed
      capturedConfigChangedListener!(config);

      expect(manager.getMode()).toBe("momentum-tilt");
      expect(manager.getActiveConfig()).toBe(config);
    });

    it("multiple event emissions apply configs in order", () => {
      const first = makeConfig({ name: "first", params: { type: "equal-weight" } });
      const second = makeConfig({ name: "second", params: { type: "vol-adjusted" } });

      capturedConfigChangedListener!(first);
      expect(manager.getMode()).toBe("equal-weight");

      capturedConfigChangedListener!(second);
      expect(manager.getMode()).toBe("vol-adjusted");
      expect(manager.getActiveConfig()).toBe(second);
    });
  });
});
