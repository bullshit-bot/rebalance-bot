import { Cron } from 'croner'
import { eventBus } from '@events/event-bus'
import { priceCache } from '@price/price-cache'
import { portfolioTracker } from '@portfolio/portfolio-tracker'
import { snapshotService } from '@portfolio/snapshot-service'
import { copySyncEngine } from '@/copy-trading/copy-sync-engine'
import { marketSummaryService } from '@/ai/market-summary-service'
import { telegramNotifier } from '@/notifier/telegram-notifier'

// ─── CronScheduler ────────────────────────────────────────────────────────────

/**
 * Manages all periodic background jobs for the bot.
 *
 * Jobs:
 *  - Every 4 hours  → emit rebalance:trigger with trigger='periodic'
 *  - Every 5 minutes → save portfolio snapshot to database
 *  - Every 60 seconds → clear stale price cache entries
 *
 * Call start() once at boot and stop() during graceful shutdown.
 */
class CronScheduler {
  private jobs: Cron[] = []

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Register and start all cron jobs.
   * Calling start() while already running is a no-op (jobs array is non-empty).
   */
  start(): void {
    if (this.jobs.length > 0) return

    // Every 4 hours — trigger a periodic rebalance check
    const periodicRebalance = new Cron('0 */4 * * *', () => {
      console.log('[CronScheduler] Emitting periodic rebalance trigger')
      eventBus.emit('rebalance:trigger', { trigger: 'periodic' })
    })

    // Every 5 minutes — persist a portfolio snapshot
    const snapshotJob = new Cron('*/5 * * * *', () => {
      const portfolio = portfolioTracker.getPortfolio()
      if (!portfolio) {
        console.debug('[CronScheduler] Snapshot skipped — portfolio not yet available')
        return
      }

      snapshotService.saveSnapshot(portfolio).catch((err: unknown) => {
        console.error('[CronScheduler] Failed to save portfolio snapshot:', err)
      })
    })

    // Every 60 seconds — evict stale price entries from in-memory cache
    // '* * * * *' fires once per minute (60-second granularity)
    const priceCacheClean = new Cron('* * * * *', () => {
      priceCache.clearStale()
    })

    // Every 4 hours — sync all enabled copy trading sources
    const copySyncJob = new Cron('0 */4 * * *', () => {
      copySyncEngine.syncAll().catch((err: unknown) => {
        console.error('[CronScheduler] Copy trading sync failed:', err)
      })
    })

    // Daily at 08:00 UTC — generate and send market summary via Telegram
    const dailySummaryJob = new Cron('0 8 * * *', () => {
      marketSummaryService
        .generateSummary()
        .then((summary) => telegramNotifier.sendMessage(summary))
        .catch((err: unknown) => {
          console.error('[CronScheduler] Daily summary failed:', err)
        })
    })

    this.jobs = [periodicRebalance, snapshotJob, priceCacheClean, copySyncJob, dailySummaryJob]

    console.log('[CronScheduler] Started — 5 jobs scheduled')
  }

  /**
   * Stop all running cron jobs and clear the job list.
   */
  stop(): void {
    for (const job of this.jobs) {
      job.stop()
    }
    this.jobs = []
    console.log('[CronScheduler] All jobs stopped')
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const cronScheduler = new CronScheduler()

export { CronScheduler }
