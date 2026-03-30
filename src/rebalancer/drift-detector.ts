import { env } from '@config/app-config'
import { eventBus } from '@events/event-bus'
import { strategyManager } from '@rebalancer/strategy-manager'
import { trendFilter } from '@rebalancer/trend-filter'
import type { Portfolio } from '@/types/index'

/** Default bear market cash target — shared with RebalanceEngine */
export const DEFAULT_BEAR_CASH_PCT = 70

/** Sentinel value indicating no previous trend state recorded */
const TREND_STATE_UNKNOWN = null

// ─── Dependency injection ─────────────────────────────────────────────────────

export interface IEventBusDepDD {
  on(event: string, listener: (data: unknown) => void): void
  off(event: string, listener: (data: unknown) => void): void
  emit(event: string, data?: unknown): void
}

export interface DriftDetectorDeps {
  eventBus: IEventBusDepDD
}

// ─── DriftDetector ────────────────────────────────────────────────────────────

/**
 * Monitors portfolio drift by listening to portfolio:update events.
 * Emits rebalance:trigger when any asset's |driftPct| exceeds the configured
 * threshold AND the cooldown period has elapsed since the last rebalance.
 *
 * Accepts optional deps for dependency injection in tests.
 */
class DriftDetector {
  private readonly deps: DriftDetectorDeps

  constructor(deps?: Partial<DriftDetectorDeps>) {
    this.deps = {
      eventBus: deps?.eventBus ?? (eventBus as unknown as IEventBusDepDD),
    }
  }
  /** Timestamp (ms) of the last triggered rebalance; null = never rebalanced */
  private lastRebalanceTime: number | null = null

  /** Whether the detector is actively listening */
  private active = false

  /** Last observed trend-filter bull/bear state — null until first evaluation */
  private lastTrendBullish: boolean | null = TREND_STATE_UNKNOWN

  /** Bound listener reference — stored so we can remove it cleanly in stop() */
  private readonly portfolioListener = (portfolio: Portfolio): void => {
    this.handlePortfolioUpdate(portfolio)
  }

  // ─── Public API ─────────────────────────────────────────────────────────────

  /** Start listening for portfolio updates and checking for drift. */
  start(): void {
    if (this.active) return
    this.active = true
    this.deps.eventBus.on('portfolio:update', this.portfolioListener as (data: unknown) => void)
    console.info(`[DriftDetector] Started — threshold=${env.REBALANCE_THRESHOLD}% cooldown=${env.REBALANCE_COOLDOWN_HOURS}h`)
  }

  /** Stop listening and clean up. */
  stop(): void {
    if (!this.active) return
    this.active = false
    this.deps.eventBus.off('portfolio:update', this.portfolioListener as (data: unknown) => void)
    console.info('[DriftDetector] Stopped')
  }

  /**
   * Returns true when both conditions are met:
   *  1. No rebalance has occurred within the cooldown window.
   *  2. The detector is active.
   */
  canRebalance(): boolean {
    if (!this.active) return false
    if (this.lastRebalanceTime === null) return true

    const cooldownMs = env.REBALANCE_COOLDOWN_HOURS * 60 * 60 * 1_000
    return Date.now() - this.lastRebalanceTime >= cooldownMs
  }

  /**
   * Record that a rebalance has just executed.
   * Called externally by RebalanceEngine after a successful run so the
   * cooldown timer resets correctly.
   */
  recordRebalance(): void {
    this.lastRebalanceTime = Date.now()
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private handlePortfolioUpdate(portfolio: Portfolio): void {
    if (!this.canRebalance()) return

    const activeConfig = strategyManager.getActiveConfig()
    const gs = activeConfig?.globalSettings as Record<string, unknown> | undefined

    // Bear mode: trend filter takes priority over normal drift checking
    if (gs?.trendFilterEnabled) {
      const maPeriod = typeof gs.trendFilterMA === 'number' ? gs.trendFilterMA : 100
      const buffer = typeof gs.trendFilterBuffer === 'number' ? gs.trendFilterBuffer : 2
      const bearCashPct = typeof gs.bearCashPct === 'number' ? gs.bearCashPct : DEFAULT_BEAR_CASH_PCT
      const cooldownDays = typeof gs.trendFilterCooldownDays === 'number' ? gs.trendFilterCooldownDays : 3

      const isBull = trendFilter.isBullishWithCooldown(maPeriod, buffer, cooldownDays)

      if (!isBull) {
        // Track trend state for bull recovery detection on next flip
        this.lastTrendBullish = false

        // Calculate current cash percentage
        const stablecoins = new Set(['USDT', 'USDC', 'BUSD', 'TUSD', 'DAI', 'USD'])
        const cashUsd = portfolio.assets
          .filter((a) => stablecoins.has(a.asset))
          .reduce((sum, a) => sum + a.valueUsd, 0)
        const cashPct = portfolio.totalValueUsd > 0
          ? (cashUsd / portfolio.totalValueUsd) * 100
          : 0

        if (cashPct < bearCashPct) {
          console.info(`[DriftDetector] Bear market — cash=${cashPct.toFixed(1)}% < target=${bearCashPct}%, triggering defensive rebalance`)
          this.lastRebalanceTime = Date.now()
          this.deps.eventBus.emit('rebalance:trigger', { trigger: 'trend-filter-bear' })
        }
        // Skip normal drift check in bear mode
        return
      }

      // Bull recovery: trend just flipped from bear → bull
      if (this.lastTrendBullish === false) {
        console.info('[DriftDetector] Bull recovery — triggering re-entry rebalance')
        this.lastTrendBullish = true
        this.lastRebalanceTime = Date.now()
        this.deps.eventBus.emit('rebalance:trigger', { trigger: 'trend-filter-bull-recovery' })
        return
      }

      // First evaluation or continuing bull — record state and fall through to normal drift check
      this.lastTrendBullish = true
    }

    // Use hardRebalanceThreshold from active config when DCA routing is enabled,
    // otherwise fall back to env.REBALANCE_THRESHOLD
    const threshold = (gs?.dcaRebalanceEnabled && gs?.hardRebalanceThreshold)
      ? Number(gs.hardRebalanceThreshold)
      : env.REBALANCE_THRESHOLD

    const breachedAsset = portfolio.assets.find(
      (a) => Math.abs(a.driftPct) > threshold,
    )
    if (!breachedAsset) return

    console.info(`[DriftDetector] Threshold breached — asset=${breachedAsset.asset} drift=${breachedAsset.driftPct.toFixed(2)}% (threshold=${threshold}%)`)

    // Optimistically mark the rebalance time to block concurrent triggers
    // while the engine is executing.
    this.lastRebalanceTime = Date.now()

    this.deps.eventBus.emit('rebalance:trigger', { trigger: 'threshold' })
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const driftDetector = new DriftDetector()

export { DriftDetector }
