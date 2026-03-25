import { env } from '@config/app-config'
import { eventBus } from '@events/event-bus'
import type { Portfolio } from '@/types/index'

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
    console.info('[DriftDetector] Started — threshold=%.1f%% cooldown=%dh',
      env.REBALANCE_THRESHOLD, env.REBALANCE_COOLDOWN_HOURS)
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

    // Check whether any asset breaches the drift threshold
    const breachedAsset = portfolio.assets.find(
      (a) => Math.abs(a.driftPct) > env.REBALANCE_THRESHOLD,
    )
    if (!breachedAsset) return

    console.info(
      '[DriftDetector] Threshold breached — asset=%s drift=%.2f%% (threshold=%.1f%%)',
      breachedAsset.asset,
      breachedAsset.driftPct,
      env.REBALANCE_THRESHOLD,
    )

    // Optimistically mark the rebalance time to block concurrent triggers
    // while the engine is executing.
    this.lastRebalanceTime = Date.now()

    this.deps.eventBus.emit('rebalance:trigger', { trigger: 'threshold' })
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const driftDetector = new DriftDetector()

export { DriftDetector }
