import { randomUUID } from 'node:crypto'
import { TradeModel } from '@db/database'
import { eventBus } from '@events/event-bus'
import { priceCache } from '@price/price-cache'
import type { IOrderExecutor } from '@executor/order-executor'
import type { TradeOrder, TradeResult } from '@/types/index'

// ─── Constants ────────────────────────────────────────────────────────────────

/** Simulated taker fee applied to every paper trade */
const PAPER_FEE_RATE = 0.001 // 0.1%

/** Min and max slippage bounds applied to fill price */
const SLIPPAGE_MIN = 0.0001 // 0.01%
const SLIPPAGE_MAX = 0.001  // 0.10%

// ─── PaperTradingEngine ───────────────────────────────────────────────────────

/**
 * Simulates order execution without touching any real exchange.
 * Implements the same IOrderExecutor interface as OrderExecutor so callers
 * are completely unaware of which mode is active.
 *
 * Simulation model:
 *  - Fill price = current cached price ± random slippage (0.01–0.10%)
 *    Buys fill slightly above market (adverse slippage), sells slightly below.
 *  - Fee = fill cost × 0.1% (taker rate)
 *  - Trade is persisted to the DB with isPaper = 1
 *  - trade:executed is emitted on the event bus
 */
export class PaperTradingEngine implements IOrderExecutor {
  async execute(order: TradeOrder): Promise<TradeResult> {
    const currentPrice = priceCache.getBestPrice(order.pair) ?? order.price
    if (currentPrice === undefined) {
      throw new Error(`[PaperTradingEngine] No cached price for ${order.pair}`)
    }

    const fillPrice = this.applySlippage(currentPrice, order.side)
    const costUsd = order.amount * fillPrice
    const fee = costUsd * PAPER_FEE_RATE

    const result: TradeResult = {
      id: randomUUID(),
      exchange: order.exchange,
      pair: order.pair,
      side: order.side,
      amount: order.amount,
      price: fillPrice,
      costUsd,
      fee,
      feeCurrency: 'USDT',
      orderId: `paper-${randomUUID()}`,
      executedAt: new Date(),
      isPaper: true,
    }

    await this.persistAndEmit(result)
    return result
  }

  async executeBatch(orders: TradeOrder[]): Promise<TradeResult[]> {
    const results: TradeResult[] = []

    for (const order of orders) {
      try {
        const result = await this.execute(order)
        results.push(result)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[PaperTradingEngine] Batch order failed for ${order.pair}: ${message}`)
      }
    }

    return results
  }

  // ─── Private helpers ────────────────────────────────────────────────────────

  /**
   * Applies a random adverse slippage to the fill price.
   * Buys fill above market (you pay more), sells fill below market (you receive less).
   */
  private applySlippage(price: number, side: TradeOrder['side']): number {
    const slippage = SLIPPAGE_MIN + Math.random() * (SLIPPAGE_MAX - SLIPPAGE_MIN)
    const direction = side === 'buy' ? 1 : -1
    return price * (1 + direction * slippage)
  }

  private async persistAndEmit(result: TradeResult): Promise<void> {
    try {
      await TradeModel.create({
        exchange: result.exchange,
        pair: result.pair,
        side: result.side,
        amount: result.amount,
        price: result.price,
        costUsd: result.costUsd,
        fee: result.fee,
        feeCurrency: result.feeCurrency,
        orderId: result.orderId ?? null,
        rebalanceId: result.rebalanceId ?? null,
        isPaper: true,
      })
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      console.error(`[PaperTradingEngine] Failed to persist trade to DB: ${message}`)
    }

    eventBus.emit('trade:executed', result)
  }
}

// ─── Singleton ────────────────────────────────────────────────────────────────

export const paperTradingEngine = new PaperTradingEngine()
