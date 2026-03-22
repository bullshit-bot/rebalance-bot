import { env } from '@config/app-config'
import { eventBus } from '@events/event-bus'
import { portfolioTracker } from '@portfolio/portfolio-tracker'
import type { Allocation, ExchangeName, Portfolio, TradeOrder } from '@/types/index'

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Minimum percentage change in total portfolio value to be considered a
 * potential deposit (filters out normal price fluctuations).
 */
const DEPOSIT_THRESHOLD_PCT = 1

/**
 * Cooldown in milliseconds between consecutive deposit detections.
 * Prevents multiple DCA allocations from the same deposit event.
 */
const DEPOSIT_COOLDOWN_MS = 60_000

// ─── DCAService ───────────────────────────────────────────────────────────────

/**
 * Smart DCA (Dollar-Cost Averaging) service.
 * Monitors portfolio:update events to detect new deposits and suggests
 * optimal buy orders that prioritise the most underweight assets first.
 */
class DCAService {
  /** Total portfolio USD value from the previous portfolio:update snapshot */
  private previousTotalValue: number = 0

  /** Timestamp of the last detected deposit — used for cooldown gating */
  private lastDepositAt: number = 0

  /** Whether the service is actively listening for portfolio updates */
  private running = false

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Start monitoring portfolio:update events for deposit detection. */
  start(): void {
    if (this.running) return
    this.running = true
    eventBus.on('portfolio:update', this.onPortfolioUpdate)
    console.log('[DCAService] Started — monitoring portfolio for deposits')
  }

  /** Stop monitoring and reset internal state. */
  stop(): void {
    if (!this.running) return
    this.running = false
    eventBus.off('portfolio:update', this.onPortfolioUpdate)
    this.previousTotalValue = 0
    console.log('[DCAService] Stopped')
  }

  /**
   * Calculate optimal DCA allocation orders for a new deposit.
   *
   * Strategy:
   *  1. Identify underweight assets (currentPct < targetPct).
   *  2. Sort by largest deficit first.
   *  3. Allocate deposit proportionally to deficits.
   *  4. Filter out orders below MIN_TRADE_USD.
   *
   * Returns buy TradeOrder[] — caller decides whether to execute.
   */
  calculateDCAAllocation(
    depositAmount: number,
    portfolio: Portfolio,
    targets: Allocation[],
  ): TradeOrder[] {
    const minTradeUsd = env.MIN_TRADE_USD

    // Build a map of targetPct by asset for quick lookup
    // Avoid spreading `exchange: undefined` — exactOptionalPropertyTypes disallows it
    const targetMap = new Map<string, { targetPct: number; exchange?: ExchangeName }>()
    for (const t of targets) {
      const entry: { targetPct: number; exchange?: ExchangeName } = { targetPct: t.targetPct }
      if (t.exchange !== undefined) entry.exchange = t.exchange
      targetMap.set(t.asset, entry)
    }

    // Identify underweight assets and compute deficits
    type DeficitEntry = {
      asset: string
      deficitPct: number
      exchange: ExchangeName
    }

    const underweight: DeficitEntry[] = []

    for (const portfolioAsset of portfolio.assets) {
      const target = targetMap.get(portfolioAsset.asset)
      if (!target) continue

      const deficit = target.targetPct - portfolioAsset.currentPct
      if (deficit > 0) {
        underweight.push({
          asset: portfolioAsset.asset,
          deficitPct: deficit,
          // Prefer allocation-level exchange override; fall back to the asset's current exchange
          exchange: target.exchange ?? portfolioAsset.exchange,
        })
      }
    }

    if (underweight.length === 0) {
      console.log('[DCAService] Portfolio is balanced — no DCA orders needed')
      return []
    }

    // Sort largest deficit first for priority allocation
    underweight.sort((a, b) => b.deficitPct - a.deficitPct)

    const totalDeficit = underweight.reduce((sum, e) => sum + e.deficitPct, 0)

    const orders: TradeOrder[] = []

    for (const entry of underweight) {
      // Proportional share of the deposit based on relative deficit
      const allocationUsd = (entry.deficitPct / totalDeficit) * depositAmount

      if (allocationUsd < minTradeUsd) continue

      // Derive the asset price from the portfolio snapshot to compute amount
      const portfolioAsset = portfolio.assets.find((a) => a.asset === entry.asset)
      if (!portfolioAsset || portfolioAsset.amount === 0 || portfolioAsset.valueUsd === 0) continue

      const priceUsd = portfolioAsset.valueUsd / portfolioAsset.amount
      const buyAmount = allocationUsd / priceUsd

      orders.push({
        exchange: entry.exchange,
        pair: `${entry.asset}/USDT`,
        side: 'buy',
        type: 'market',
        amount: buyAmount,
      })
    }

    return orders
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Handles each portfolio:update event.
   *
   * Heuristic deposit detection:
   *  - Skips the very first update (establishes baseline).
   *  - Computes absolute diff vs previous total value.
   *  - Only considers increases > MIN_TRADE_USD AND > DEPOSIT_THRESHOLD_PCT of portfolio.
   *  - Applies a cooldown window to avoid duplicate detections.
   *
   * Note: price-driven increases can reach 1 % on volatile days, so this is a
   * suggestion-only signal — the caller / operator confirms before executing.
   */
  private readonly onPortfolioUpdate = (portfolio: Portfolio): void => {
    // First update — set baseline and return
    if (this.previousTotalValue === 0) {
      this.previousTotalValue = portfolio.totalValueUsd
      console.log(
        `[DCAService] Baseline portfolio value set: $${portfolio.totalValueUsd.toFixed(2)}`,
      )
      return
    }

    const diff = portfolio.totalValueUsd - this.previousTotalValue

    // Only care about increases
    if (diff <= 0) {
      this.previousTotalValue = portfolio.totalValueUsd
      return
    }

    const diffPct = (diff / this.previousTotalValue) * 100
    const minTradeUsd = env.MIN_TRADE_USD
    const now = Date.now()
    const cooldownElapsed = now - this.lastDepositAt > DEPOSIT_COOLDOWN_MS

    const isLikelyDeposit =
      diff > minTradeUsd && diffPct > DEPOSIT_THRESHOLD_PCT && cooldownElapsed

    if (isLikelyDeposit) {
      this.lastDepositAt = now
      console.log(
        `[DCAService] Possible deposit detected: +$${diff.toFixed(2)} (+${diffPct.toFixed(2)}%)`,
      )

      // Fetch current targets and compute suggested DCA orders
      portfolioTracker
        .getTargetAllocations()
        .then((targets) => {
          const orders = this.calculateDCAAllocation(diff, portfolio, targets)

          if (orders.length === 0) {
            console.log('[DCAService] Portfolio balanced — no DCA suggestions')
          } else {
            console.log(`[DCAService] Suggested DCA orders for $${diff.toFixed(2)} deposit:`)
            for (const order of orders) {
              console.log(
                `  BUY ${order.amount.toFixed(6)} ${order.pair} on ${order.exchange} (market)`,
              )
            }
          }
        })
        .catch((err: unknown) => {
          console.error('[DCAService] Failed to fetch target allocations:', err)
        })
    }

    this.previousTotalValue = portfolio.totalValueUsd
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const dcaService = new DCAService()

export { DCAService }
