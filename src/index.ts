import { env } from '@config/app-config'
import { connectDB, disconnectDB, AllocationModel } from '@db/database'
import { exchangeManager } from '@exchange/exchange-manager'
import { priceAggregator } from '@price/price-aggregator'
import { portfolioTracker } from '@portfolio/portfolio-tracker'
import { rebalanceEngine } from '@rebalancer/rebalance-engine'
import { driftDetector } from '@rebalancer/drift-detector'
import { getExecutor, type IOrderExecutor } from '@executor/index'
import type { OrderExecutor as EngineExecutor } from '@rebalancer/rebalance-engine'
import { trailingStopManager } from '@trailing-stop/trailing-stop-manager'
import { dcaService } from '@dca/dca-service'
import { telegramNotifier } from '@notifier/telegram-notifier'
import { cronScheduler } from '@scheduler/cron-scheduler'
import { startServer } from '@api/server'

// ─── Default trading pairs ────────────────────────────────────────────────────

const DEFAULT_PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT']

/**
 * Derives the list of trading pairs to watch from DB allocations.
 * Each allocated asset is mapped to an <ASSET>/USDT pair.
 * Falls back to DEFAULT_PAIRS when no allocations are configured yet.
 */
async function resolvePairs(): Promise<string[]> {
  try {
    const rows = await AllocationModel.find({}, 'asset').lean()
    if (rows.length === 0) return DEFAULT_PAIRS

    const pairs = rows
      .map((r) => `${r.asset}/USDT`)
      .filter((p) => p !== 'USDT/USDT') // skip stablecoin self-pair
    // Always include default pairs for price anchoring
    for (const defaultPair of DEFAULT_PAIRS) {
      if (!pairs.includes(defaultPair)) pairs.push(defaultPair)
    }
    return pairs
  } catch {
    console.warn('[main] Failed to read allocations from DB — using default pairs')
    return DEFAULT_PAIRS
  }
}

// ─── Bootstrap ────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  console.log('Rebalance Bot starting...')

  // Step 1: Connect to MongoDB
  await connectDB()
  console.log('[main] Database ready')

  // Step 2: Connect to exchanges (skips any exchange missing credentials)
  try {
    await exchangeManager.initialize()
    console.log('[main] Exchange connections initialised')
  } catch (err) {
    console.error('[main] Exchange initialisation error:', err)
    // Non-fatal — bot runs in degraded mode without exchange access
  }

  // Step 3: Resolve the executor (paper or live) and wire it into the engine.
  // IOrderExecutor uses executeBatch(); RebalanceEngine expects executeOrders() —
  // a thin adapter bridges the two interfaces.
  const rawExecutor: IOrderExecutor = getExecutor()
  const engineExecutor: EngineExecutor = {
    executeOrders: (orders, _rebalanceId) => rawExecutor.executeBatch(orders),
  }
  rebalanceEngine.setExecutor(engineExecutor)
  console.log('[main] Executor wired into rebalance engine')

  // Step 4: Determine which pairs to stream price data for
  const pairs = await resolvePairs()
  console.log('[main] Watching pairs:', pairs.join(', '))

  // Step 5: Start price aggregator (WebSocket ticker streams)
  try {
    await priceAggregator.start(pairs, exchangeManager)
    console.log('[main] Price aggregator started')
  } catch (err) {
    console.error('[main] Price aggregator start error:', err)
  }

  // Step 6: Start portfolio tracker (WebSocket balance streams)
  try {
    await portfolioTracker.startWatching(exchangeManager.getEnabledExchanges())
    console.log('[main] Portfolio tracker started')
  } catch (err) {
    console.error('[main] Portfolio tracker start error:', err)
  }

  // Step 7: Start drift detector (listens on portfolio:update events)
  driftDetector.start()
  console.log('[main] Drift detector started')

  // Step 8: Start rebalance engine (listens on rebalance:trigger events)
  rebalanceEngine.start()
  console.log('[main] Rebalance engine started')

  // Step 9: Start trailing stop manager (listens on price:update events)
  trailingStopManager.start()
  console.log('[main] Trailing stop manager started')

  // Step 10: Start DCA service (listens on portfolio:update events)
  dcaService.start()
  console.log('[main] DCA service started')

  // Step 11: Initialise and start Telegram notifier (skips gracefully if not configured)
  try {
    await telegramNotifier.initialize()
    await telegramNotifier.start()
    console.log('[main] Telegram notifier started')
  } catch (err) {
    console.error('[main] Telegram notifier error (non-fatal):', err)
  }

  // Step 12: Start cron scheduler (periodic rebalance, snapshots, cache cleanup)
  cronScheduler.start()
  console.log('[main] Cron scheduler started')

  // Step 13: Start HTTP API server
  startServer()

  console.log(`Bot running on port ${env.API_PORT}`)
  console.log(`Mode: ${env.PAPER_TRADING ? 'PAPER TRADING' : 'LIVE TRADING'}`)

  // ─── Graceful shutdown ─────────────────────────────────────────────────────

  const shutdown = async (): Promise<void> => {
    console.log('Shutting down...')

    // Stop in reverse startup order
    cronScheduler.stop()
    driftDetector.stop()
    rebalanceEngine.stop()
    trailingStopManager.stop()
    dcaService.stop()

    try {
      await priceAggregator.stop()
    } catch (err) {
      console.error('[main] Error stopping price aggregator:', err)
    }

    try {
      await portfolioTracker.stopWatching()
    } catch (err) {
      console.error('[main] Error stopping portfolio tracker:', err)
    }

    try {
      await exchangeManager.shutdown()
    } catch (err) {
      console.error('[main] Error shutting down exchange manager:', err)
    }

    try {
      await disconnectDB()
    } catch (err) {
      console.error('[main] Error disconnecting from database:', err)
    }

    console.log('Shutdown complete')
    process.exit(0)
  }

  process.on('SIGINT', () => {
    shutdown().catch(console.error)
  })
  process.on('SIGTERM', () => {
    shutdown().catch(console.error)
  })
}

main().catch((err: unknown) => {
  console.error('Fatal startup error:', err)
  process.exit(1)
})
