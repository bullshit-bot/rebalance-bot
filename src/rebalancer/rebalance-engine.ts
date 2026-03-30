import { randomUUID } from 'node:crypto'
import { RebalanceModel } from '@db/database'
import { eventBus } from '@events/event-bus'
import { portfolioTracker } from '@portfolio/portfolio-tracker'
import { driftDetector } from '@rebalancer/drift-detector'
import { calculateTrades } from '@rebalancer/trade-calculator'
import { DEFAULT_BEAR_CASH_PCT } from '@rebalancer/drift-detector'
import { strategyManager } from '@rebalancer/strategy-manager'
import type { Portfolio, RebalanceEvent, RebalanceTrigger, TradeOrder, TradeResult } from '@/types/index'

// ─── OrderExecutor interface ──────────────────────────────────────────────────

/**
 * Minimal interface for the order executor.
 * The concrete implementation lives in src/executor/order-executor.ts
 * (created in a later phase). RebalanceEngine depends only on this contract.
 */
export interface OrderExecutor {
  /**
   * Submit a batch of trade orders to the exchange(s).
   * Returns one TradeResult per order in the same order.
   */
  executeOrders(orders: TradeOrder[], rebalanceId: string): Promise<TradeResult[]>
}

// ─── RebalanceEngine ──────────────────────────────────────────────────────────

/**
 * Orchestrates the full rebalance lifecycle:
 *   trigger → fetch state → calculate trades → persist → execute → update → emit
 *
 * Inject an OrderExecutor via setExecutor() before calling execute().
 * Until an executor is injected, execute() will throw.
 */
class RebalanceEngine {
  private executor: OrderExecutor | null = null
  private active = false

  /** Bound listener so we can cleanly remove it in stop(). */
  private readonly triggerListener = ({ trigger }: { trigger: RebalanceTrigger }): void => {
    this.execute(trigger).catch((err: unknown) => {
      console.error('[RebalanceEngine] Unhandled error during execute:', err)
    })
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /**
   * Inject the order executor dependency.
   * Must be called before the first execute() invocation in live mode.
   */
  setExecutor(executor: OrderExecutor): void {
    this.executor = executor
  }

  /** Start listening for rebalance:trigger events. */
  start(): void {
    if (this.active) return
    this.active = true
    eventBus.on('rebalance:trigger', this.triggerListener)

  }

  /** Stop listening and clean up. */
  stop(): void {
    if (!this.active) return
    this.active = false
    eventBus.off('rebalance:trigger', this.triggerListener)
    console.info('[RebalanceEngine] Stopped')
  }

  /**
   * Execute a full rebalance cycle.
   *
   * Steps:
   *  1. Acquire current portfolio snapshot.
   *  2. Fetch target allocations from DB.
   *  3. Calculate required trades.
   *  4. Persist a rebalance record (status: 'executing').
   *  5. Execute trades via OrderExecutor.
   *  6. Capture updated portfolio snapshot.
   *  7. Update DB record (status: 'completed' | 'failed').
   *  8. Emit rebalance:completed or rebalance:failed.
   *
   * @throws if no portfolio data is available yet.
   */
  async execute(trigger: RebalanceTrigger): Promise<RebalanceEvent> {
    if (!this.executor) {
      throw new Error('[RebalanceEngine] No OrderExecutor injected — call setExecutor() first')
    }

    const startedAt = new Date()
    const id = randomUUID()

    // ── Step 1: current portfolio ─────────────────────────────────────────────
    const beforeState = portfolioTracker.getPortfolio()
    if (!beforeState) {
      throw new Error('[RebalanceEngine] Portfolio not yet available — skipping rebalance')
    }

    // ── Step 2: target allocations ────────────────────────────────────────────
    const targets = await portfolioTracker.getTargetAllocations()

    // ── Step 3: calculate trades ──────────────────────────────────────────────
    // Bear trigger: override cash reserve to bearCashPct (sell to safety)
    // Bull recovery: use normal cashReservePct (buy crypto with excess cash)
    let cashReservePct: number | undefined
    if (trigger === 'trend-filter-bear') {
      const gs = strategyManager.getActiveConfig()?.globalSettings as Record<string, unknown> | undefined
      cashReservePct = typeof gs?.bearCashPct === 'number' ? gs.bearCashPct : DEFAULT_BEAR_CASH_PCT
      console.info('[RebalanceEngine] Bear trigger — targeting %d%% cash reserve', cashReservePct)
    } else if (trigger === 'trend-filter-bull-recovery') {
      const gs = strategyManager.getActiveConfig()?.globalSettings as Record<string, unknown> | undefined
      // Use the normal cash reserve — trade calculator will buy back crypto with excess cash
      cashReservePct = typeof gs?.cashReservePct === 'number' ? gs.cashReservePct : undefined
      console.info('[RebalanceEngine] Bull recovery trigger — re-entering crypto positions (cashReserve=%s%%)',
        cashReservePct ?? 'default')
    }
    let orders: TradeOrder[]

    // In DCA mode, drift-triggered rebalances use DCA-sized trades (not full rebalance)
    const config = strategyManager.getActiveConfig()
    const gs = config?.globalSettings as Record<string, unknown> | undefined
    if (gs?.dcaRebalanceEnabled && (trigger === 'threshold' || trigger === 'periodic' || trigger === 'manual')) {
      const dcaAmount = typeof gs.dcaAmountUsd === 'number' ? gs.dcaAmountUsd : 20
      const { dcaService } = await import('@dca/dca-service')
      orders = dcaService.calculateDCAAllocation(dcaAmount, beforeState, targets)
      console.info(`[RebalanceEngine] DCA mode: capping drift rebalance to $${dcaAmount}`)
    } else {
      orders = calculateTrades(beforeState, targets, undefined, cashReservePct)
    }

    // ── Step 4: persist initial record ───────────────────────────────────────
    await RebalanceModel.create({
      _id: id,
      triggerType: trigger,
      status: 'executing',
      beforeState: beforeState as unknown as Record<string, unknown>,
      totalTrades: orders.length,
      totalFeesUsd: 0,
    })

    eventBus.emit('rebalance:started', {
      id,
      trigger,
      status: 'executing',
      beforeState,
      trades: [],
      totalFeesUsd: 0,
      startedAt,
    })

    // ── Steps 5–8: execute and settle ─────────────────────────────────────────
    try {
      const results = await this.executor.executeOrders(orders, id)
      const afterState = portfolioTracker.getPortfolio() ?? beforeState
      const totalFeesUsd = results.reduce((sum, r) => sum + r.fee, 0)
      const completedAt = new Date()

      await RebalanceModel.updateOne(
        { _id: id },
        {
          status: 'completed',
          afterState: afterState as unknown as Record<string, unknown>,
          totalTrades: results.length,
          totalFeesUsd,
          completedAt,
        },
      )

      // Tell the drift detector the rebalance finished so cooldown resets correctly
      driftDetector.recordRebalance()

      const event: RebalanceEvent = {
        id,
        trigger,
        status: 'completed',
        beforeState,
        afterState,
        trades: results,
        totalFeesUsd,
        startedAt,
        completedAt,
      }

      eventBus.emit('rebalance:completed', event)
      console.info(`[RebalanceEngine] Completed id=${id} trades=${results.length} fees=$${totalFeesUsd.toFixed(4)}`)
      return event
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : String(err)
      console.error('[RebalanceEngine] Failed id=%s error=%s', id, errorMessage)

      await RebalanceModel.updateOne(
        { _id: id },
        {
          status: 'failed',
          errorMessage,
          completedAt: new Date(),
        },
      )

      eventBus.emit('rebalance:failed', { id, error: errorMessage })

      // Re-throw so the caller is aware; also propagates to triggerListener's .catch()
      throw err
    }
  }

  /**
   * Dry-run preview: compute what trades would be generated without persisting
   * or submitting anything.
   */
  async preview(): Promise<{ trades: TradeOrder[]; portfolio: Portfolio }> {
    const portfolio = portfolioTracker.getPortfolio()
    if (!portfolio) {
      throw new Error('[RebalanceEngine] Portfolio not yet available')
    }

    const targets = await portfolioTracker.getTargetAllocations()

    // When DCA mode is enabled, preview shows DCA-sized trades (not full rebalance)
    const config = strategyManager.getActiveConfig()
    const gs = config?.globalSettings as Record<string, unknown> | undefined
    if (gs?.dcaRebalanceEnabled) {
      const dcaAmount = typeof gs.dcaAmountUsd === 'number' ? gs.dcaAmountUsd : 20
      const { dcaService } = await import('@dca/dca-service')
      const dcaTrades = dcaService.calculateDCAAllocation(dcaAmount, portfolio, targets)
      return { trades: dcaTrades, portfolio }
    }

    const trades = calculateTrades(portfolio, targets)
    return { trades, portfolio }
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const rebalanceEngine = new RebalanceEngine()

export { RebalanceEngine }
