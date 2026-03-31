import type { TradeOrder, TradeResult } from "@/types/index";
import { env } from "@config/app-config";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CanExecuteResult {
  allowed: boolean;
  reason?: string;
}

// ─── ExecutionGuard ───────────────────────────────────────────────────────────

/**
 * Safety guard that enforces per-trade and daily loss limits.
 *
 * Checks:
 *  - Max trade size (env.MAX_TRADE_USD) — prevents oversized individual orders
 *  - Daily loss limit (env.DAILY_LOSS_LIMIT_PCT % of portfolio value) — stops
 *    trading for the rest of the UTC day once the threshold is breached
 *
 * Daily loss accumulates fees from all trades (a conservative proxy for realised loss).
 * Additional explicit losses can be recorded via recordLoss(). Daily counters reset at midnight UTC.
 */
export class ExecutionGuard {
  /**
   * Accumulated realised loss in USD for the current UTC day.
   * Tracks fees from executed trades plus any explicit losses via recordLoss().
   */
  private dailyLossUsd = 0;

  /** UTC date string "YYYY-MM-DD" for the last reset */
  private lastResetDate = "";

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Determines whether a trade order is permitted under current safety limits.
   *
   * @param order        - The trade order to evaluate
   * @param currentPrice - Current market price for the order's pair
   * @param portfolioValueUsd - Current total portfolio value (used to compute daily loss %)
   */
  canExecute(order: TradeOrder, currentPrice: number, portfolioValueUsd: number): CanExecuteResult {
    this.maybeResetDaily();

    const tradeValueUsd = order.amount * currentPrice;

    // ── Max trade size check ──
    if (tradeValueUsd > env.MAX_TRADE_USD) {
      return {
        allowed: false,
        reason: `Trade value $${tradeValueUsd.toFixed(2)} exceeds MAX_TRADE_USD $${env.MAX_TRADE_USD}`,
      };
    }

    // ── Daily loss limit check ──
    if (portfolioValueUsd > 0) {
      const dailyLossLimitUsd = (env.DAILY_LOSS_LIMIT_PCT / 100) * portfolioValueUsd;
      if (this.dailyLossUsd >= dailyLossLimitUsd) {
        return {
          allowed: false,
          reason: `Daily loss $${this.dailyLossUsd.toFixed(2)} reached limit $${dailyLossLimitUsd.toFixed(2)} (${env.DAILY_LOSS_LIMIT_PCT}% of portfolio)`,
        };
      }
    }

    return { allowed: true };
  }

  /**
   * Records the outcome of an executed trade so the guard can track daily losses.
   * Accumulates fees from all trade directions as a conservative loss proxy.
   */
  recordTrade(result: TradeResult): void {
    this.maybeResetDaily();
    // Fees are real costs regardless of direction — conservative loss tracking
    this.dailyLossUsd += result.fee;
  }

  /**
   * Directly records an explicit USD loss (e.g. from external sources or mark-to-market PnL).
   * Adds to the daily loss counter used by the circuit breaker.
   */
  recordLoss(lossUsd: number): void {
    this.maybeResetDaily();
    this.dailyLossUsd += Math.abs(lossUsd);
  }

  /** Force-reset daily counters (useful for testing or manual intervention). */
  resetDaily(): void {
    this.dailyLossUsd = 0;
    this.lastResetDate = this.currentUtcDateString();
  }

  /** Returns accumulated daily loss in USD (read-only diagnostic). */
  getDailyLossUsd(): number {
    this.maybeResetDaily();
    return this.dailyLossUsd;
  }

  // ─── Private helpers ─────────────────────────────────────────────────────────

  /**
   * Resets counters if the UTC calendar date has rolled over since the last reset.
   * Called at the start of every canExecute / recordTrade call.
   */
  private maybeResetDaily(): void {
    const today = this.currentUtcDateString();
    if (today !== this.lastResetDate) {
      this.dailyLossUsd = 0;
      this.lastResetDate = today;
    }
  }

  /** Returns the current UTC date as "YYYY-MM-DD". */
  private currentUtcDateString(): string {
    return new Date().toISOString().slice(0, 10);
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const executionGuard = new ExecutionGuard();
