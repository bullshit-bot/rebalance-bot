import { randomUUID } from 'node:crypto'
import { env } from '@config/app-config'
import { db } from '@db/database'
import { trades } from '@db/schema'
import { eventBus } from '@events/event-bus'
import { exchangeManager } from '@exchange/exchange-manager'
import { executionGuard } from '@executor/execution-guard'
import { priceCache } from '@price/price-cache'
import type { TradeOrder, TradeResult } from '@/types/index'

// ─── Constants ────────────────────────────────────────────────────────────────

const LIMIT_ORDER_WAIT_MS = 30_000
const POLL_INTERVAL_MS = 2_000
const MAX_RETRIES = 3

// ─── Interface ────────────────────────────────────────────────────────────────

export interface IOrderExecutor {
  execute(order: TradeOrder): Promise<TradeResult>
  executeBatch(orders: TradeOrder[]): Promise<TradeResult[]>
}

// ─── OrderExecutor ────────────────────────────────────────────────────────────

/**
 * Executes real orders against configured exchanges via CCXT.
 *
 * Strategy per order:
 *  1. Check safety limits via ExecutionGuard
 *  2. Place a limit order at current market price
 *  3. Poll for fill for up to 30 seconds
 *  4. If unfilled → cancel and place a market order
 *  5. Retry up to 3 times with exponential back-off on transient errors
 *  6. Persist trade to DB and emit trade:executed
 */
export class OrderExecutor implements IOrderExecutor {
  async execute(order: TradeOrder): Promise<TradeResult> {
    let lastError: Error | undefined

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      try {
        if (attempt > 0) {
          const backoffMs = Math.pow(2, attempt) * 1_000
          await sleep(backoffMs)
        }

        return await this.executeOnce(order)
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error))
        console.error(
          `[OrderExecutor] Attempt ${attempt + 1}/${MAX_RETRIES} failed for ${order.pair}: ${lastError.message}`,
        )
      }
    }

    throw lastError ?? new Error(`[OrderExecutor] Failed to execute order after ${MAX_RETRIES} attempts`)
  }

  async executeBatch(orders: TradeOrder[]): Promise<TradeResult[]> {
    const results: TradeResult[] = []

    for (const order of orders) {
      try {
        const result = await this.execute(order)
        results.push(result)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[OrderExecutor] Batch order failed for ${order.pair}: ${message}`)
      }
    }

    return results
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  private async executeOnce(order: TradeOrder): Promise<TradeResult> {
    const exchange = exchangeManager.getExchange(order.exchange)
    if (!exchange) {
      throw new Error(`[OrderExecutor] Exchange ${order.exchange} not connected`)
    }

    // Resolve current market price
    const currentPrice = priceCache.getBestPrice(order.pair) ?? order.price
    if (currentPrice === undefined) {
      throw new Error(`[OrderExecutor] No price available for ${order.pair}`)
    }

    // Safety check
    const portfolioValueUsd = await this.estimatePortfolioValueUsd(order.exchange, currentPrice, order.pair)
    const guard = executionGuard.canExecute(order, currentPrice, portfolioValueUsd)
    if (!guard.allowed) {
      throw new Error(`[OrderExecutor] Blocked by execution guard: ${guard.reason}`)
    }

    // Try limit order → fall back to market if unfilled
    let ccxtOrder: Record<string, unknown>

    try {
      console.log(`[OrderExecutor] Placing limit ${order.side} ${order.amount} ${order.pair} @ ${currentPrice}`)
      const limitOrder = await exchange.createOrder(
        order.pair,
        'limit',
        order.side,
        order.amount,
        currentPrice,
      )

      const orderId = String(limitOrder['id'])
      const filled = await this.waitForFill(exchange, order.pair, orderId, LIMIT_ORDER_WAIT_MS)

      if (!filled) {
        console.warn(`[OrderExecutor] Limit order not filled in ${LIMIT_ORDER_WAIT_MS}ms — cancelling, placing market`)
        try {
          await exchange.cancelOrder(orderId, order.pair)
        } catch {
          // Best-effort cancel — may already be partially filled
        }

        console.log(`[OrderExecutor] Placing market ${order.side} ${order.amount} ${order.pair}`)
        ccxtOrder = (await exchange.createOrder(order.pair, 'market', order.side, order.amount)) as unknown as Record<string, unknown>
      } else {
        ccxtOrder = filled
      }
    } catch (error) {
      // If limit order creation itself fails, try market directly
      const message = error instanceof Error ? error.message : String(error)
      console.warn(`[OrderExecutor] Limit order error, falling back to market: ${message}`)
      ccxtOrder = (await exchange.createOrder(order.pair, 'market', order.side, order.amount)) as unknown as Record<string, unknown>
    }

    const result = this.mapCcxtOrderToResult(ccxtOrder, order, false)
    await this.persistAndEmit(result)
    return result
  }

  /**
   * Polls until an order is fully filled or the timeout elapses.
   * Returns the filled order object or null on timeout.
   */
  private async waitForFill(
    exchange: { fetchOrder: (id: string, symbol: string) => Promise<unknown> },
    pair: string,
    orderId: string,
    timeoutMs: number,
  ): Promise<Record<string, unknown> | null> {
    const deadline = Date.now() + timeoutMs

    while (Date.now() < deadline) {
      await sleep(POLL_INTERVAL_MS)

      try {
        const fetched = (await exchange.fetchOrder(orderId, pair)) as Record<string, unknown>
        const status = String(fetched['status'] ?? '')

        if (status === 'closed' || status === 'filled') {
          return fetched
        }
        if (status === 'canceled' || status === 'expired' || status === 'rejected') {
          return null
        }
      } catch {
        // Transient fetch error — keep polling until deadline
      }
    }

    return null
  }

  /**
   * Maps a raw CCXT order object to our internal TradeResult.
   */
  private mapCcxtOrderToResult(
    ccxtOrder: Record<string, unknown>,
    original: TradeOrder,
    isPaper: boolean,
  ): TradeResult {
    const filledPrice = toNumber(ccxtOrder['average'] ?? ccxtOrder['price']) ?? toNumber(original.price) ?? 0
    const filledAmount = toNumber(ccxtOrder['filled'] ?? ccxtOrder['amount']) ?? original.amount
    const costUsd = toNumber(ccxtOrder['cost']) ?? filledAmount * filledPrice

    const feeInfo = ccxtOrder['fee'] as Record<string, unknown> | undefined
    const fee = toNumber(feeInfo?.['cost']) ?? 0
    const feeCurrency = String(feeInfo?.['currency'] ?? 'USDT')

    return {
      id: randomUUID(),
      exchange: original.exchange,
      pair: original.pair,
      side: original.side,
      amount: filledAmount,
      price: filledPrice,
      costUsd,
      fee,
      feeCurrency,
      orderId: String(ccxtOrder['id'] ?? ''),
      executedAt: new Date(),
      isPaper,
    }
  }

  /**
   * Rough portfolio value estimate: fetches USDT balance for the given exchange.
   * Used only for daily loss limit % calculation — not a precise valuation.
   */
  private async estimatePortfolioValueUsd(
    exchangeName: string,
    _currentPrice: number,
    _pair: string,
  ): Promise<number> {
    try {
      const exchange = exchangeManager.getExchange(exchangeName as Parameters<typeof exchangeManager.getExchange>[0])
      if (!exchange) return 0

      const balances = (await exchange.fetchBalance()) as Record<string, unknown>
      const total = balances['total'] as Record<string, number> | undefined
      return total?.['USDT'] ?? 0
    } catch {
      return 0
    }
  }

  private async persistAndEmit(result: TradeResult): Promise<void> {
    try {
      await db.insert(trades).values({
        exchange: result.exchange,
        pair: result.pair,
        side: result.side,
        amount: result.amount,
        price: result.price,
        costUsd: result.costUsd,
        fee: result.fee,
        feeCurrency: result.feeCurrency,
        orderId: result.orderId,
        rebalanceId: result.rebalanceId,
        isPaper: result.isPaper ? 1 : 0,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[OrderExecutor] Failed to persist trade to DB: ${message}`)
    }

    executionGuard.recordTrade(result)
    eventBus.emit('trade:executed', result)
  }
}

// ─── Utilities ────────────────────────────────────────────────────────────────

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function toNumber(value: unknown): number | undefined {
  const n = Number(value)
  return isNaN(n) ? undefined : n
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const orderExecutor = new OrderExecutor()

// Re-export env for use in paper engine factory
export { env }
