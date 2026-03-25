import { env } from '@config/app-config'
import { OrderExecutor, orderExecutor } from '@executor/order-executor'
import { PaperTradingEngine, paperTradingEngine } from '@executor/paper-trading-engine'
import type { IOrderExecutor } from '@executor/order-executor'

export type { IOrderExecutor }
export { OrderExecutor, PaperTradingEngine }
export { orderExecutor, paperTradingEngine }
export { executionGuard } from '@executor/execution-guard'

/**
 * Returns the appropriate executor based on the PAPER_TRADING env flag.
 *
 * - PAPER_TRADING=true  → PaperTradingEngine (safe simulation, default)
 * - PAPER_TRADING=false → OrderExecutor (live exchange orders)
 *
 * Both implement IOrderExecutor so callers require no conditional logic.
 */
export function getExecutor(): IOrderExecutor {
  if (env.PAPER_TRADING) {
    console.log('[Executor] Paper trading mode active')
    return paperTradingEngine
  }

  console.log('[Executor] Live trading mode active')
  return orderExecutor
}
