import { randomUUID } from "node:crypto";
import type { Allocation, ExchangeName, Portfolio, PortfolioAsset } from "@/types/index";
import { BacktestResultModel } from "@db/database";
import { calculateTrades } from "@rebalancer/trade-calculator";
import { benchmarkComparator } from "./benchmark-comparator";
import type { BenchmarkResult } from "./benchmark-comparator";
import { historicalDataLoader } from "./historical-data-loader";
import type { OHLCVCandle } from "./historical-data-loader";
import { metricsCalculator } from "./metrics-calculator";
import type { BacktestConfig, BacktestMetrics, SimulatedTrade } from "./metrics-calculator";
import { StrategyBacktestAdapter } from "./strategy-backtest-adapter";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface BacktestResult {
  id: string;
  config: BacktestConfig;
  metrics: BacktestMetrics;
  trades: SimulatedTrade[];
  equityCurve: { timestamp: number; value: number }[];
  finalPortfolio: Record<string, { amount: number; valueUsd: number }>;
  benchmark: BenchmarkResult;
}

/** Per-asset holding tracked during simulation. */
interface HoldingState {
  amount: number; // base asset quantity
  valueUsd: number; // current USD value
}

// ─── BacktestSimulator ────────────────────────────────────────────────────────

/**
 * Runs a full portfolio-rebalancing backtest over historical OHLCV data.
 *
 * Algorithm per candle:
 *  1. Update current prices from candle close.
 *  2. Compute current allocation % for every asset.
 *  3. If the maximum drift from any target exceeds `config.threshold`, trigger
 *     a rebalance: compute trades via calculateTrades, apply them, deduct fees.
 *  4. Record an equity curve data point.
 *
 * After simulation: compute metrics, run benchmark comparison, persist to DB.
 */
class BacktestSimulator {
  async run(config: BacktestConfig): Promise<BacktestResult> {
    // ── 1. Load OHLCV data for all pairs ──────────────────────────────────────
    const ohlcvData = await this._loadAllPairs(config);

    // ── 2. Build a merged, chronological candle timeline ──────────────────────
    const timeline = this._buildTimeline(ohlcvData);
    if (timeline.length === 0) {
      throw new Error("[BacktestSimulator] No candle data found for the given config");
    }

    // ── 3. Initialise virtual portfolio ───────────────────────────────────────
    // Buy at the close price of the very first candle per target allocation.
    const firstPrices = this._pricesAtTimestamp(ohlcvData, timeline[0]!);
    const holdings = this._initHoldings(config, firstPrices);

    // Create strategy adapter when a non-default strategy is configured
    const adapter =
      config.strategyType && config.strategyType !== "threshold" && config.strategyParams
        ? new StrategyBacktestAdapter(config.strategyParams)
        : null;

    // Rolling window of recent daily returns for per-candle volatility estimate
    const recentReturns: number[] = [];
    let prevTotalValue: number | null = null;

    const trades: SimulatedTrade[] = [];
    const equityCurve: { timestamp: number; value: number }[] = [];

    // ── DCA + Trend filter state ──────────────────────────────────────────────
    const dcaAmountUsd = config.dcaAmountUsd ?? 0;
    const dcaIntervalCandles = config.dcaIntervalCandles ?? 1;
    const trendMaPeriod = config.trendFilterMaPeriod ?? 0;
    const trendBearCashPct = config.trendFilterBearCashPct ?? 90;
    const trendCooldown = config.trendFilterCooldownCandles ?? 3;
    const cashReservePct = config.cashReservePct ?? 0;

    // BTC close prices accumulated for SMA calculation
    const btcCloses: number[] = [];
    const btcPair = "BTC/USDT";

    // Bear mode state: inBearMode = true when BTC < MA; cooldownRemaining prevents whipsaw
    let inBearMode = false;
    let trendCooldownRemaining = 0;

    // Cash balance: used for cash reserve + bear mode proceeds
    let cashUsd = 0;

    // Total DCA injected (sum of all DCA deposits, excluding initial balance)
    let totalDcaInjected = 0;

    // ── Trailing stop state ────────────────────────────────────────────────────
    const trailPct = config.trailingStopPct ?? 0;
    const trailCooldown = config.trailingStopCooldownCandles ?? 5;
    // Track per-asset: highest price seen, and cooldown remaining after stop-loss
    const assetHighest: Record<string, number> = {};
    const assetStopCooldown: Record<string, number> = {};

    let candleIndex = 0;

    // ── 4. Iterate through candles ────────────────────────────────────────────
    for (const ts of timeline) {
      const prices = this._pricesAtTimestamp(ohlcvData, ts);

      // Update USD values from current close prices
      for (const [pair, state] of Object.entries(holdings)) {
        const price = prices[pair];
        if (price !== undefined) state.valueUsd = state.amount * price;
      }

      // Accumulate BTC close for trend filter SMA
      if (trendMaPeriod > 0) {
        const btcClose = prices[btcPair];
        if (btcClose !== undefined) btcCloses.push(btcClose);
      }

      let totalValueUsd = Object.values(holdings).reduce((s, h) => s + h.valueUsd, 0) + cashUsd;

      // ── DCA injection (skip candle 0 = initial buy-in) ───────────────────
      if (candleIndex > 0 && dcaAmountUsd > 0 && candleIndex % dcaIntervalCandles === 0) {
        // Smart DCA: adjust amount based on BTC price vs MA
        let effectiveDca = dcaAmountUsd;
        if (config.smartDcaEnabled && btcCloses.length >= trendMaPeriod && trendMaPeriod > 0) {
          const btcMa = btcCloses.slice(-trendMaPeriod).reduce((s, v) => s + v, 0) / trendMaPeriod;
          const btcPrice = prices[btcPair] ?? 0;
          if (btcMa > 0 && btcPrice > 0) {
            effectiveDca = btcPrice < btcMa
              ? dcaAmountUsd * (config.smartDcaDipMultiplier ?? 1.5)
              : dcaAmountUsd * (config.smartDcaHighMultiplier ?? 0.5);
          }
        }

        if (inBearMode) {
          cashUsd += effectiveDca;
        } else {
          this._dcaInjectBullMode(
            holdings,
            config.allocations,
            prices,
            effectiveDca,
            cashReservePct,
            totalValueUsd,
            config.feePct
          );
        }
        totalDcaInjected += effectiveDca;
        totalValueUsd = Object.values(holdings).reduce((s, h) => s + h.valueUsd, 0) + cashUsd;
      }

      // ── Per-asset trailing stop ──────────────────────────────────────────
      if (trailPct > 0 && !inBearMode && candleIndex > 0) {
        for (const [pair, state] of Object.entries(holdings)) {
          const price = prices[pair];
          if (!price || state.amount <= 0) continue;

          // Decrement cooldown
          if (assetStopCooldown[pair] && assetStopCooldown[pair] > 0) {
            assetStopCooldown[pair]--;
            continue; // in cooldown, skip
          }

          // Update highest watermark
          if (!assetHighest[pair] || price > assetHighest[pair]) {
            assetHighest[pair] = price;
          }

          // Check stop breach
          const stopPrice = assetHighest[pair] * (1 - trailPct / 100);
          if (price <= stopPrice && assetHighest[pair] > 0) {
            // Sell entire position to cash
            const sellValue = state.amount * price;
            const fee = sellValue * (config.feePct ?? 0.001);
            cashUsd += sellValue - fee;
            trades.push({
              timestamp: ts,
              pair,
              side: "sell" as const,
              amount: state.amount,
              price,
              fee,
              costUsd: sellValue,
            });
            state.amount = 0;
            state.valueUsd = 0;
            // Set cooldown before re-entry
            assetStopCooldown[pair] = trailCooldown;
            assetHighest[pair] = 0; // reset watermark
          }
        }
        totalValueUsd = Object.values(holdings).reduce((s, h) => s + h.valueUsd, 0) + cashUsd;
      }

      // ── Trend filter: detect bull/bear transition ─────────────────────────
      if (trendMaPeriod > 0 && btcCloses.length >= trendMaPeriod) {
        const ma = btcCloses.slice(-trendMaPeriod).reduce((s, v) => s + v, 0) / trendMaPeriod;
        const btcCurrentPrice = btcCloses[btcCloses.length - 1]!;
        // Apply buffer: only bear if price is buffer% below MA (matches live trend-filter)
        const trendBuffer = config.trendFilterBuffer ?? 2;
        const nowBear = btcCurrentPrice < ma * (1 - trendBuffer / 100);

        if (trendCooldownRemaining > 0) {
          trendCooldownRemaining--;
        } else if (nowBear !== inBearMode) {
          // State flip; apply cooldown before accepting next flip
          inBearMode = nowBear;
          trendCooldownRemaining = trendCooldown;

          if (inBearMode) {
            // Transition to bear: sell holdings down to (100 - trendBearCashPct)% crypto
            const targetCashPct = trendBearCashPct / 100;
            const targetCashUsd = totalValueUsd * targetCashPct;
            const cryptoValueUsd = Object.values(holdings).reduce((s, h) => s + h.valueUsd, 0);
            if (cashUsd < targetCashUsd && cryptoValueUsd > 0) {
              const sellRatio = Math.min(1, (targetCashUsd - cashUsd) / cryptoValueUsd);
              for (const [pair, holding] of Object.entries(holdings)) {
                const price = prices[pair];
                if (!price || price <= 0 || holding.amount <= 0) continue;
                const sellQty = holding.amount * sellRatio;
                const proceeds = sellQty * price;
                const fee = proceeds * config.feePct;
                holding.amount -= sellQty;
                holding.valueUsd = holding.amount * price;
                cashUsd += proceeds - fee;
                trades.push({
                  timestamp: ts,
                  pair,
                  side: "sell",
                  amount: sellQty,
                  price,
                  costUsd: proceeds,
                  fee,
                });
              }
              totalValueUsd = Object.values(holdings).reduce((s, h) => s + h.valueUsd, 0) + cashUsd;
            }
          } else {
            // Transition to bull: re-deploy excess cash above cashReservePct
            const normalCashUsd = totalValueUsd * (cashReservePct / 100);
            const excessCash = cashUsd - normalCashUsd;
            if (excessCash > 0) {
              this._deployCash(
                holdings,
                config.allocations,
                prices,
                excessCash,
                config.feePct,
                totalValueUsd,
                trades,
                ts
              );
              cashUsd -= excessCash;
              totalValueUsd = Object.values(holdings).reduce((s, h) => s + h.valueUsd, 0) + cashUsd;
            }
          }
        }
      }

      // ── Simple Earn yield simulation (bull mode only) ─────────────────────
      // Per-asset APY rates based on Binance Flexible Earn (approximate)
      if (config.simpleEarnEnabled === true && !inBearMode) {
        const defaultApy = config.simpleEarnApyPct ?? 3;
        const assetApyMap: Record<string, number> = {
          'BTC/USDT': 1.0, 'ETH/USDT': 2.5, 'SOL/USDT': 5.5, 'BNB/USDT': 1.2,
          ...(config.simpleEarnApyMap as Record<string, number> | undefined),
        };
        for (const [pair, holding] of Object.entries(holdings)) {
          const apy = assetApyMap[pair] ?? defaultApy;
          const dailyYieldRate = apy / 100 / 365;
          const yieldAmount = holding.amount * dailyYieldRate;
          holding.amount += yieldAmount;
          holding.valueUsd = holding.amount * (prices[pair] ?? 0);
        }
        totalValueUsd = Object.values(holdings).reduce((s, h) => s + h.valueUsd, 0) + cashUsd;
      }

      // Maintain rolling return window for volatility calculation
      if (prevTotalValue !== null && prevTotalValue > 0) {
        recentReturns.push((totalValueUsd - prevTotalValue) / prevTotalValue);
        // Keep a 30-sample window (≈30 candles)
        if (recentReturns.length > 30) recentReturns.shift();
      }
      prevTotalValue = totalValueUsd;

      // Compute current annualised volatility from recent returns
      const currentVol = this._annualisedVol(recentReturns);

      // ── Rebalance check (skipped in bear mode when trend filter active) ───
      let shouldRebalance: boolean;
      let effectiveAllocations: Allocation[] = config.allocations;

      const skipRebalanceInBear = trendMaPeriod > 0 && inBearMode;

      // For rebalance calculations, use only the crypto portion (exclude cash)
      // This prevents the rebalancer from treating cash as drift
      const cryptoOnlyValue = Object.values(holdings).reduce((s, h) => s + h.valueUsd, 0);

      if (!skipRebalanceInBear && cryptoOnlyValue > 0) {
        if (adapter) {
          const drifts = new Map<string, number>();
          for (const alloc of config.allocations) {
            const pair = `${alloc.asset}/USDT`;
            const currentPct =
              cryptoOnlyValue > 0 ? ((holdings[pair]?.valueUsd ?? 0) / cryptoOnlyValue) * 100 : 0;
            drifts.set(alloc.asset, currentPct - alloc.targetPct);
          }

          adapter.updateState(drifts, currentVol, prices);
          shouldRebalance = adapter.needsRebalance(
            holdings,
            config.allocations,
            cryptoOnlyValue,
            config.threshold
          );
          if (shouldRebalance) {
            effectiveAllocations = adapter.getEffectiveAllocations(config.allocations);
          }
        } else {
          shouldRebalance = this._needsRebalance(
            holdings,
            config.allocations,
            cryptoOnlyValue,
            config.threshold
          );
        }

        if (shouldRebalance) {
          const rebalanceTrades = this._simulateRebalance(
            holdings,
            config,
            prices,
            cryptoOnlyValue,
            ts,
            effectiveAllocations
          );
          trades.push(...rebalanceTrades);
        }
      }

      // Record equity after any rebalance (crypto holdings + cash)
      const equity = Object.values(holdings).reduce((s, h) => s + h.valueUsd, 0) + cashUsd;
      equityCurve.push({ timestamp: ts, value: equity });
      candleIndex++;
    }

    // ── 5. Build final portfolio snapshot ────────────────────────────────────
    const finalPortfolio: Record<string, { amount: number; valueUsd: number }> = {};
    for (const [pair, state] of Object.entries(holdings)) {
      finalPortfolio[pair] = { amount: state.amount, valueUsd: state.valueUsd };
    }
    // Include cash position if non-zero
    if (cashUsd > 0) {
      finalPortfolio["USDT"] = { amount: cashUsd, valueUsd: cashUsd };
    }

    // ── 6. Compute metrics ────────────────────────────────────────────────────
    const metrics = metricsCalculator.calculate(equityCurve, trades, config, totalDcaInjected);

    // ── 7. Benchmark comparison ───────────────────────────────────────────────
    const benchmark = benchmarkComparator.compare(
      { config, metrics, trades, equityCurve },
      ohlcvData
    );

    const id = randomUUID();
    const result: BacktestResult = {
      id,
      config,
      metrics,
      trades,
      equityCurve,
      finalPortfolio,
      benchmark,
    };

    // ── 8. Persist to DB ──────────────────────────────────────────────────────
    await this._persist(result);

    return result;
  }

  // ─── Private helpers ──────────────────────────────────────────────────────

  /**
   * Loads OHLCV candles for every pair via getCachedData first; falls back to
   * loadData (exchange fetch + DB write) when cache is empty.
   */
  private async _loadAllPairs(config: BacktestConfig): Promise<Record<string, OHLCVCandle[]>> {
    const result: Record<string, OHLCVCandle[]> = {};

    for (const pair of config.pairs) {
      let candles = await historicalDataLoader.getCachedData({
        exchange: config.exchange,
        pair,
        timeframe: config.timeframe,
        since: config.startDate,
        until: config.endDate,
      });

      if (candles.length === 0) {
        candles = await historicalDataLoader.loadData({
          exchange: config.exchange,
          pair,
          timeframe: config.timeframe,
          since: config.startDate,
          until: config.endDate,
        });
      }

      // Filter to requested date range
      result[pair] = candles.filter(
        (c) => c.timestamp >= config.startDate && c.timestamp <= config.endDate
      );
    }

    return result;
  }

  /**
   * Merges all per-pair timestamps into a single sorted, deduplicated timeline.
   * Only timestamps where ALL pairs have a candle are included (inner join).
   */
  private _buildTimeline(ohlcvData: Record<string, OHLCVCandle[]>): number[] {
    const pairs = Object.keys(ohlcvData);
    if (pairs.length === 0) return [];

    // Start with timestamps from first pair, intersect with the rest
    let common = new Set(ohlcvData[pairs[0]!]!.map((c) => c.timestamp));

    for (let i = 1; i < pairs.length; i++) {
      const pairTs = new Set(ohlcvData[pairs[i]!]!.map((c) => c.timestamp));
      common = new Set([...common].filter((ts) => pairTs.has(ts)));
    }

    return [...common].sort((a, b) => a - b);
  }

  /** Extracts a pair → close-price map for a given timestamp. */
  private _pricesAtTimestamp(
    ohlcvData: Record<string, OHLCVCandle[]>,
    ts: number
  ): Record<string, number> {
    const prices: Record<string, number> = {};
    for (const [pair, candles] of Object.entries(ohlcvData)) {
      const candle = candles.find((c) => c.timestamp === ts);
      if (candle) prices[pair] = candle.close;
    }
    return prices;
  }

  /**
   * Initialises holdings by buying each target asset at its first available
   * price, proportional to target allocation weights.
   */
  private _initHoldings(
    config: BacktestConfig,
    prices: Record<string, number>
  ): Record<string, HoldingState> {
    const holdings: Record<string, HoldingState> = {};

    for (const alloc of config.allocations) {
      const pair = `${alloc.asset}/USDT`;
      const price = prices[pair];
      if (!price || price <= 0) continue;

      const usdAlloc = (alloc.targetPct / 100) * config.initialBalance;
      holdings[pair] = {
        amount: usdAlloc / price,
        valueUsd: usdAlloc,
      };
    }

    return holdings;
  }

  /**
   * Computes annualised volatility from a window of fractional returns.
   * Returns 0 when fewer than 2 samples are available.
   */
  private _annualisedVol(returns: number[]): number {
    if (returns.length < 2) return 0;
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance = returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    return Math.sqrt(variance) * Math.sqrt(365);
  }

  /**
   * Returns true when any asset drifts more than `threshold` percentage points
   * from its target allocation.
   */
  private _needsRebalance(
    holdings: Record<string, HoldingState>,
    allocations: Allocation[],
    totalValueUsd: number,
    threshold: number
  ): boolean {
    if (totalValueUsd <= 0) return false;

    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`;
      const currentUsd = holdings[pair]?.valueUsd ?? 0;
      const currentPct = (currentUsd / totalValueUsd) * 100;
      const drift = Math.abs(currentPct - alloc.targetPct);
      if (drift >= threshold) return true;
    }

    return false;
  }

  /**
   * Simulates a rebalance:
   *  1. Builds a Portfolio snapshot from current holdings.
   *  2. Runs calculateTrades to determine required trades.
   *  3. Applies each trade (adjusting amounts), deducting fees.
   *  4. Returns SimulatedTrade records for audit trail.
   *
   * @param effectiveAllocations - targets to use; defaults to config.allocations
   *                               (overridden by momentum-weighted / equal-weight)
   */
  private _simulateRebalance(
    holdings: Record<string, HoldingState>,
    config: BacktestConfig,
    prices: Record<string, number>,
    totalValueUsd: number,
    ts: number,
    effectiveAllocations: Allocation[] = config.allocations
  ): SimulatedTrade[] {
    // Build Portfolio shape expected by calculateTrades
    const portfolio: Portfolio = {
      totalValueUsd,
      updatedAt: ts,
      assets: effectiveAllocations
        .map((alloc): PortfolioAsset | null => {
          const pair = `${alloc.asset}/USDT`;
          const holding = holdings[pair];
          const price = prices[pair];
          if (!holding || !price) return null;

          const currentPct = totalValueUsd > 0 ? (holding.valueUsd / totalValueUsd) * 100 : 0;
          return {
            asset: alloc.asset,
            amount: holding.amount,
            valueUsd: holding.valueUsd,
            currentPct,
            targetPct: alloc.targetPct,
            driftPct: currentPct - alloc.targetPct,
            exchange: (alloc.exchange ?? config.exchange) as ExchangeName,
          };
        })
        .filter((a): a is PortfolioAsset => a !== null),
    };

    const orders = calculateTrades(portfolio, effectiveAllocations, prices);
    const simTrades: SimulatedTrade[] = [];

    for (const order of orders) {
      const price = prices[order.pair];
      if (!price || price <= 0) continue;

      // order.amount is in base asset units (e.g., 0.5 BTC), convert to USD
      const assetAmount = order.amount;
      const costUsd = assetAmount * price;
      const fee = costUsd * config.feePct;

      // Apply trade to holdings
      const holding = holdings[order.pair];
      if (order.side === "buy") {
        if (holding) {
          holding.amount += assetAmount;
          holding.valueUsd += costUsd - fee;
        } else {
          holdings[order.pair] = {
            amount: assetAmount,
            valueUsd: costUsd - fee,
          };
        }
      } else {
        // sell
        if (holding) {
          holding.amount = Math.max(0, holding.amount - assetAmount);
          holding.valueUsd = Math.max(0, holding.valueUsd - costUsd);
        }
      }

      simTrades.push({
        timestamp: ts,
        pair: order.pair,
        side: order.side,
        amount: assetAmount,
        price,
        costUsd,
        fee,
      });
    }

    return simTrades;
  }

  /**
   * DCA injection in bull mode: buy the most underweight asset.
   * Mirrors the logic from scripts/run-backtest.ts simulateTrendScenarios.
   *
   * @param totalValueUsd - current total portfolio value including cash
   */
  private _dcaInjectBullMode(
    holdings: Record<string, HoldingState>,
    allocations: Allocation[],
    prices: Record<string, number>,
    dcaAmountUsd: number,
    cashReservePct: number,
    totalValueUsd: number,
    feePct = 0.001
  ): void {
    // Investable pool excludes cash reserve
    const cryptoPool = totalValueUsd * (1 - cashReservePct / 100);

    let maxDrift = Number.NEGATIVE_INFINITY;
    let targetAsset: string | null = null;

    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`;
      const heldUsd = holdings[pair]?.valueUsd ?? 0;
      const targetUsd = (alloc.targetPct / 100) * (cryptoPool > 0 ? cryptoPool : totalValueUsd);
      const drift = targetUsd - heldUsd;
      if (drift > maxDrift) {
        maxDrift = drift;
        targetAsset = pair;
      }
    }

    if (targetAsset && maxDrift > 0) {
      const price = prices[targetAsset];
      if (price && price > 0) {
        const fee = dcaAmountUsd * feePct;
        const netAmount = dcaAmountUsd - fee;
        const holding = holdings[targetAsset];
        if (holding) {
          holding.amount += netAmount / price;
          holding.valueUsd += netAmount;
        } else {
          holdings[targetAsset] = {
            amount: netAmount / price,
            valueUsd: netAmount,
          };
        }
      }
    }
    // If no suitable target, the dcaAmountUsd effectively becomes cash (absorbed into cashUsd by caller if needed)
  }

  /**
   * Re-deploy excess cash into assets proportional to target allocation (bull transition).
   * Distributes across ALL assets, not just the most underweight one.
   * Records trades for audit trail.
   */
  private _deployCash(
    holdings: Record<string, HoldingState>,
    allocations: Allocation[],
    prices: Record<string, number>,
    excessCash: number,
    feePct: number,
    _totalValueUsd: number,
    trades: SimulatedTrade[],
    ts: number
  ): void {
    // Distribute excess cash across all assets by target allocation weight
    for (const alloc of allocations) {
      const pair = `${alloc.asset}/USDT`;
      const price = prices[pair];
      if (!price || price <= 0) continue;

      const buyAmount = excessCash * (alloc.targetPct / 100);
      if (buyAmount <= 0) continue;

      const fee = buyAmount * feePct;
      const assetQty = (buyAmount - fee) / price;

      const holding = holdings[pair];
      if (holding) {
        holding.amount += assetQty;
        holding.valueUsd += buyAmount - fee;
      } else {
        holdings[pair] = { amount: assetQty, valueUsd: buyAmount - fee };
      }

      trades.push({
        timestamp: ts,
        pair,
        side: "buy",
        amount: assetQty,
        price,
        costUsd: buyAmount,
        fee,
      });
    }
  }

  /** Serialises and persists a completed backtest result to the DB. */
  private async _persist(result: BacktestResult): Promise<void> {
    try {
      await BacktestResultModel.create({
        _id: result.id,
        config: result.config as unknown as Record<string, unknown>,
        metrics: result.metrics as unknown as Record<string, unknown>,
        trades: result.trades as unknown as Record<string, unknown>[],
        benchmark: result.benchmark as unknown as Record<string, unknown>,
      });
    } catch (err) {
      // Non-fatal: log but don't crash the simulation
      console.error("[BacktestSimulator] Failed to persist result:", err);
    }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const backtestSimulator = new BacktestSimulator();
export { BacktestSimulator };

// Re-export types consumed downstream
export type { BacktestConfig, BacktestMetrics, SimulatedTrade, BenchmarkResult };
