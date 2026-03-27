import type { Allocation } from "@/types/index";
import { env } from "@config/app-config";
import { momentumCalculator } from "@rebalancer/momentum-calculator";
import { volatilityTracker } from "@rebalancer/volatility-tracker";
import { StrategyConfigModel, type IStrategyConfig } from "@db/database";
import { eventBus } from "@events/event-bus";
import { meanReversionStrategy } from "@rebalancer/strategies/mean-reversion-strategy";
import { volAdjustedStrategy } from "@rebalancer/strategies/vol-adjusted-strategy";
import { momentumWeightedStrategy } from "@rebalancer/strategies/momentum-weighted-strategy";
import {
  MeanReversionParamsSchema,
  VolAdjustedParamsSchema,
  MomentumWeightedParamsSchema,
} from "@rebalancer/strategies/strategy-config-types";
import type { z } from "zod";

type MeanReversionParams = z.infer<typeof MeanReversionParamsSchema>;
type VolAdjustedParams = z.infer<typeof VolAdjustedParamsSchema>;
type MomentumWeightedParams = z.infer<typeof MomentumWeightedParamsSchema>;

// ─── Types ────────────────────────────────────────────────────────────────────

export type StrategyMode = "threshold" | "equal-weight" | "momentum-tilt" | "vol-adjusted" | "mean-reversion" | "momentum-weighted";

export interface StrategyInfo {
  mode: StrategyMode;
  threshold: number;
  volatility: number;
  momentumScores: Record<string, number>;
}

// ─── StrategyManager ──────────────────────────────────────────────────────────

/**
 * Central strategy selector — decides WHEN and HOW to rebalance.
 *
 * Modes:
 *  - threshold     Classic fixed-threshold drift check (env.REBALANCE_THRESHOLD)
 *  - equal-weight  Override allocations to equal weight, fixed threshold
 *  - momentum-tilt Use 50/50 blend of base + momentum-weighted allocations
 *  - vol-adjusted  Rebalance only when vol > VOLATILITY_THRESHOLD;
 *                  dynamic threshold: low-vol → HIGH limit, high-vol → LOW limit
 *
 * The drift-detector and rebalance-engine will call this in a later integration
 * step — this module is purely additive.
 */
class StrategyManager {
  private mode: StrategyMode;
  private activeConfig: IStrategyConfig | null = null;

  constructor() {
    this.mode = env.STRATEGY_MODE as StrategyMode;
    // Listen for config changes via EventBus
    eventBus.on('strategy:config-changed', (config: unknown) => {
      this.applyConfig(config as IStrategyConfig);
    });
  }

  /** Load active config from DB on startup. Falls back to env if none found. */
  async loadFromDb(): Promise<void> {
    try {
      const config = await StrategyConfigModel.findOne({ isActive: true }).lean();
      if (config) {
        this.applyConfig(config);
        console.log(`[StrategyManager] Loaded active config "${config.name}" (${(config.params as Record<string, unknown>).type})`);
      } else {
        console.log(`[StrategyManager] No active DB config — using env defaults (${this.mode})`);
      }
    } catch (err) {
      console.warn('[StrategyManager] Failed to load from DB, using env defaults:', err);
    }
  }

  /** Apply a strategy config from DB (hot-reload). */
  applyConfig(config: IStrategyConfig): void {
    const params = config.params as Record<string, unknown>;
    const newMode = params.type as StrategyMode;
    console.info(`[StrategyManager] Config applied: "${config.name}" mode=${newMode}`);
    this.mode = newMode;
    this.activeConfig = config;
  }

  /** Returns the currently active DB config, or null if using env defaults. */
  getActiveConfig(): IStrategyConfig | null {
    return this.activeConfig;
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Returns effective target allocations after applying the active strategy.
   * For threshold / vol-adjusted modes the base allocations are returned unchanged.
   */
  getEffectiveAllocations(
    baseAllocations: Allocation[],
    priceHistories?: Map<string, number[]>,
  ): Allocation[] {
    switch (this.mode) {
      case "equal-weight":
        return this.toEqualWeight(baseAllocations);

      case "momentum-tilt":
        return momentumCalculator.getMomentumAllocations(baseAllocations);

      case "momentum-weighted": {
        const params = this.activeConfig?.params as MomentumWeightedParams | undefined;
        if (!params || !priceHistories) return baseAllocations;
        return momentumWeightedStrategy.getAdjustedAllocations(baseAllocations, priceHistories, params);
      }

      default:
        return baseAllocations;
    }
  }

  /**
   * Returns true when the strategy allows a rebalance at this moment.
   *
   * @param maxDriftPct - largest absolute drift across all assets (%)
   * @param drifts      - per-asset drift map (required for mean-reversion mode)
   */
  shouldRebalance(maxDriftPct: number, drifts?: Map<string, number>): boolean {
    if (this.mode === "mean-reversion") {
      if (!drifts) return false;
      const params = this.activeConfig?.params as MeanReversionParams | undefined;
      if (!params) return false;
      return meanReversionStrategy.shouldRebalance(drifts, params);
    }

    if (this.mode === "vol-adjusted") {
      const params = this.activeConfig?.params as VolAdjustedParams | undefined;
      if (params) {
        // Continuous formula: use dynamic threshold from vol history
        const threshold = volAdjustedStrategy.getDynamicThreshold(params);
        return maxDriftPct >= threshold;
      }
      // Fallback: legacy binary high-vol gate
      if (!volatilityTracker.isHighVolatility()) return false;
    }

    return maxDriftPct >= this.getDynamicThreshold();
  }

  /**
   * Returns the effective drift threshold (%) for the current strategy + vol regime.
   *
   * - threshold / equal-weight / momentum-tilt / mean-reversion / momentum-weighted:
   *     always env.REBALANCE_THRESHOLD
   * - vol-adjusted with DB params: continuous formula via volAdjustedStrategy
   * - vol-adjusted without DB params: legacy binary high/low from env
   */
  getDynamicThreshold(): number {
    if (this.mode !== "vol-adjusted") return env.REBALANCE_THRESHOLD;

    const params = this.activeConfig?.params as VolAdjustedParams | undefined;
    if (params) {
      return volAdjustedStrategy.getDynamicThreshold(params);
    }

    return volatilityTracker.isHighVolatility()
      ? env.DYNAMIC_THRESHOLD_LOW
      : env.DYNAMIC_THRESHOLD_HIGH;
  }

  /** Snapshot of current strategy state for API / logging. */
  getStrategyInfo(): StrategyInfo {
    return {
      mode: this.mode,
      threshold: this.getDynamicThreshold(),
      volatility: volatilityTracker.getVolatility(),
      momentumScores: momentumCalculator.getAllMomentumScores(),
    };
  }

  /** Hot-swap the strategy mode at runtime (e.g. from an API endpoint). */
  setMode(mode: StrategyMode): void {
    console.info("[StrategyManager] Mode changed %s → %s", this.mode, mode);
    this.mode = mode;
  }

  getMode(): StrategyMode {
    return this.mode;
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /** Distribute weight equally across all non-stablecoin allocations. */
  private toEqualWeight(allocations: Allocation[]): Allocation[] {
    if (allocations.length === 0) return [];
    const equalPct = 100 / allocations.length;
    return allocations.map((a) => ({ ...a, targetPct: equalPct }));
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const strategyManager = new StrategyManager();

export { StrategyManager };
