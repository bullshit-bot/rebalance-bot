import { Cron } from 'croner'
import { eventBus } from '@events/event-bus'
import { priceCache } from '@price/price-cache'
import { portfolioTracker } from '@portfolio/portfolio-tracker'
import { snapshotService } from '@portfolio/snapshot-service'
import { copySyncEngine } from '@/copy-trading/copy-sync-engine'
import { marketSummaryService } from '@/ai/market-summary-service'
import { telegramNotifier } from '@/notifier/telegram-notifier'
import { goClawClient } from '@/ai/goclaw-client'

// ─── Dependency injection interfaces ─────────────────────────────────────────

export interface CronSchedulerDeps {
  /** Called every 4h to emit periodic rebalance trigger. */
  onPeriodicRebalance: () => void
  /** Called every 5m to persist portfolio snapshot. */
  onPortfolioSnapshot: () => void
  /** Called every 1m to clear stale prices. */
  onPriceCacheClean: () => void
  /** Called every 4h to sync copy trading. */
  onCopySync: () => void
  /** Called daily at 01:00 UTC (08:00 VN) to send daily digest. */
  onDailySummary: () => void
  /** Called Sunday 01:00 UTC (08:00 VN) to send weekly report. */
  onWeeklySummary: () => void
  /** Called every 12h — GoClaw AI market insights via Telegram. */
  onAiInsights: () => void
}

// ─── CronScheduler ────────────────────────────────────────────────────────────

/**
 * Manages all periodic background jobs for the bot.
 *
 * Jobs:
 *  - Every 4 hours  → emit rebalance:trigger with trigger='periodic'
 *  - Every 5 minutes → save portfolio snapshot to database
 *  - Every 60 seconds → clear stale price cache entries
 *  - Every 4 hours → sync copy trading sources
 *  - Daily 01:00 UTC → daily portfolio digest via Telegram
 *  - Sunday 01:00 UTC → weekly performance report via Telegram
 *
 * Call start() once at boot and stop() during graceful shutdown.
 */
class CronScheduler {
  private jobs: Cron[] = []
  private readonly deps: CronSchedulerDeps

  constructor(deps?: Partial<CronSchedulerDeps>) {
    this.deps = {
      onPeriodicRebalance: deps?.onPeriodicRebalance ?? (() => {
        console.log('[CronScheduler] Emitting periodic rebalance trigger')
        eventBus.emit('rebalance:trigger', { trigger: 'periodic' })
      }),
      onPortfolioSnapshot: deps?.onPortfolioSnapshot ?? (() => {
        const portfolio = portfolioTracker.getPortfolio()
        if (!portfolio) {
          console.debug('[CronScheduler] Snapshot skipped — portfolio not yet available')
          return
        }
        snapshotService.saveSnapshot(portfolio).catch((err: unknown) => {
          console.error('[CronScheduler] Failed to save portfolio snapshot:', err)
        })
      }),
      onPriceCacheClean: deps?.onPriceCacheClean ?? (() => {
        priceCache.clearStale()
      }),
      onCopySync: deps?.onCopySync ?? (() => {
        copySyncEngine.syncAll().catch((err: unknown) => {
          console.error('[CronScheduler] Copy trading sync failed:', err)
        })
      }),
      onDailySummary: deps?.onDailySummary ?? (() => {
        marketSummaryService
          .generateDailySummary()
          .then((summary) => telegramNotifier.sendMessage(summary))
          .catch((err: unknown) => {
            console.error('[CronScheduler] Daily summary failed:', err)
          })
      }),
      onWeeklySummary: deps?.onWeeklySummary ?? (() => {
        marketSummaryService
          .generateWeeklySummary()
          .then((summary) => telegramNotifier.sendMessage(summary))
          .catch((err: unknown) => {
            console.error('[CronScheduler] Weekly summary failed:', err)
          })
      }),
      onAiInsights: deps?.onAiInsights ?? (() => {
        // GoClaw analyzes portfolio using MCP tools and sends insights via Telegram
        const portfolio = portfolioTracker.getPortfolio()
        if (!portfolio) return

        const assets = portfolio.assets
          .map((a) => `${a.asset}: $${a.valueUsd.toFixed(0)} (${a.currentPct.toFixed(1)}%, drift ${a.driftPct >= 0 ? '+' : ''}${a.driftPct.toFixed(1)}%)`)
          .join('\n')

        const prompt = [
          `Phân tích portfolio crypto hiện tại và gửi nhận xét ngắn gọn bằng tiếng Việt cho chủ sở hữu:`,
          ``,
          `Tổng giá trị: $${portfolio.totalValueUsd.toFixed(0)}`,
          assets,
          ``,
          `Hãy dùng tool get_portfolio và list_trades để lấy thêm dữ liệu nếu cần.`,
          `Đưa ra: 1) Đánh giá tình hình, 2) Rủi ro cần chú ý, 3) Đề xuất hành động (nếu có).`,
          `Viết ngắn gọn, tối đa 200 từ.`,
        ].join('\n')

        goClawClient.chat(prompt, 500).catch((err: unknown) => {
          console.error('[CronScheduler] AI insights failed:', err)
        })
      }),
    }
  }

  // ─── Lifecycle ──────────────────────────────────────────────────────────────

  /**
   * Register and start all cron jobs.
   * Calling start() while already running is a no-op (jobs array is non-empty).
   */
  start(): void {
    if (this.jobs.length > 0) return

    // Every 4 hours — trigger a periodic rebalance check
    const periodicRebalance = new Cron('0 */4 * * *', () => {
      this.deps.onPeriodicRebalance()
    })

    // Every 5 minutes — persist a portfolio snapshot
    const snapshotJob = new Cron('*/5 * * * *', () => {
      this.deps.onPortfolioSnapshot()
    })

    // Every 60 seconds — evict stale price entries from in-memory cache
    const priceCacheClean = new Cron('* * * * *', () => {
      this.deps.onPriceCacheClean()
    })

    // Every 4 hours — sync all enabled copy trading sources
    const copySyncJob = new Cron('0 */4 * * *', () => {
      this.deps.onCopySync()
    })

    // Daily at 01:00 UTC (08:00 VN) — send daily portfolio digest
    const dailySummaryJob = new Cron('0 1 * * *', () => {
      this.deps.onDailySummary()
    })

    // Sunday at 01:00 UTC (08:00 VN) — send weekly performance report
    const weeklySummaryJob = new Cron('0 1 * * 0', () => {
      this.deps.onWeeklySummary()
    })

    // Every 12 hours (07:00 + 19:00 UTC = 14:00 + 02:00 VN) — GoClaw AI insights
    const aiInsightsJob = new Cron('0 7,19 * * *', () => {
      this.deps.onAiInsights()
    })

    this.jobs = [periodicRebalance, snapshotJob, priceCacheClean, copySyncJob, dailySummaryJob, weeklySummaryJob, aiInsightsJob]

    console.log('[CronScheduler] Started — 7 jobs scheduled')
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
