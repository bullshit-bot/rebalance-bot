import { OrderExecutor, orderExecutor } from '@executor/order-executor'
import type { IOrderExecutor } from '@executor/order-executor'

export type { IOrderExecutor }
export { OrderExecutor }
export { orderExecutor }
export { executionGuard } from '@executor/execution-guard'

/**
 * Returns the order executor (always real execution).
 * On testnet, BINANCE_SANDBOX controls fake-money vs real-money — not this layer.
 */
export function getExecutor(): IOrderExecutor {
  return orderExecutor
}
