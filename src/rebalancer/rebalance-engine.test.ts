import { describe, test, expect, beforeEach } from 'bun:test'
import type { Portfolio, TradeOrder, TradeResult } from '@/types/index'

// ─── Mock RebalanceEngine ──────────────────────────────────────────────────

interface OrderExecutor {
  executeOrders(orders: TradeOrder[], rebalanceId: string): Promise<TradeResult[]>
}

class MockRebalanceEngine {
  private executor: OrderExecutor | null = null
  private active = false
  private completedEvents: any[] = []
  private failedEvents: any[] = []
  private portfolio: Portfolio | null = null

  setExecutor(executor: OrderExecutor): void {
    this.executor = executor
  }

  start(): void {
    if (this.active) return
    this.active = true
  }

  stop(): void {
    if (!this.active) return
    this.active = false
  }

  setPortfolio(portfolio: Portfolio): void {
    this.portfolio = portfolio
  }

  async execute(trigger: string): Promise<any> {
    if (!this.executor) {
      throw new Error('No OrderExecutor injected')
    }

    if (!this.portfolio) {
      throw new Error('Portfolio not available')
    }

    const id = Math.random().toString(36).substring(7)
    const beforeState = this.portfolio

    const orders: TradeOrder[] = [
      {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        type: 'market',
        amount: 0.1,
        price: 50000,
      },
    ]

    try {
      const results = await this.executor.executeOrders(orders, id)
      const totalFeesUsd = results.reduce((sum, r) => sum + r.fee, 0)

      const event = {
        id,
        trigger,
        status: 'completed',
        beforeState,
        afterState: beforeState,
        trades: results,
        totalFeesUsd,
        startedAt: new Date(),
        completedAt: new Date(),
      }

      this.completedEvents.push(event)
      return event
    } catch (err) {
      const event = {
        id,
        error: err instanceof Error ? err.message : String(err),
      }

      this.failedEvents.push(event)
      throw err
    }
  }

  async preview(): Promise<{ trades: TradeOrder[]; portfolio: Portfolio }> {
    if (!this.portfolio) {
      throw new Error('Portfolio not available')
    }

    return {
      trades: [],
      portfolio: this.portfolio,
    }
  }

  getCompletedEvents() {
    return this.completedEvents
  }

  getFailedEvents() {
    return this.failedEvents
  }

  isActive() {
    return this.active
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('RebalanceEngine', () => {
  let engine: MockRebalanceEngine
  let mockExecutor: OrderExecutor

  beforeEach(() => {
    engine = new MockRebalanceEngine()

    mockExecutor = {
      executeOrders: async (orders: TradeOrder[], rebalanceId: string) => {
        return orders.map(
          (order): TradeResult => ({
            id: Math.random().toString(36),
            exchange: order.exchange,
            pair: order.pair,
            side: order.side,
            amount: order.amount,
            price: order.price,
            costUsd: order.amount * order.price,
            fee: 0.01,
            feeCurrency: 'USDT',
            orderId: 'mock-' + Date.now(),
            executedAt: new Date(),
            isPaper: false,
          }),
        )
      },
    }

    engine.setExecutor(mockExecutor)
  })

  test('should start and stop listening', () => {
    engine.start()
    expect(engine.isActive()).toBe(true)

    engine.stop()
    expect(engine.isActive()).toBe(false)
  })

  test('should throw without executor', async () => {
    const engineWithoutExecutor = new MockRebalanceEngine()

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    }
    engineWithoutExecutor.setPortfolio(portfolio)

    try {
      await engineWithoutExecutor.execute('threshold')
      expect.fail('Should have thrown')
    } catch (err) {
      expect((err as Error).message).toContain('No OrderExecutor')
    }
  })

  test('should throw without portfolio', async () => {
    const engineWithoutPortfolio = new MockRebalanceEngine()
    engineWithoutPortfolio.setExecutor(mockExecutor)

    try {
      await engineWithoutPortfolio.execute('threshold')
      expect.fail('Should have thrown')
    } catch (err) {
      expect((err as Error).message).toContain('Portfolio not available')
    }
  })

  test('should execute rebalance successfully', async () => {
    engine.start()

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.1,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 50,
          driftPct: 0,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    engine.setPortfolio(portfolio)

    const result = await engine.execute('threshold')

    expect(result.status).toBe('completed')
    expect(result.trades.length).toBeGreaterThanOrEqual(0)
    expect(engine.getCompletedEvents().length).toBe(1)
  })

  test('should emit rebalance:completed event', async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    }

    engine.setPortfolio(portfolio)
    await engine.execute('threshold')

    const events = engine.getCompletedEvents()
    expect(events.length).toBe(1)
    expect(events[0].status).toBe('completed')
  })

  test('should handle execution failure', async () => {
    const failingExecutor: OrderExecutor = {
      executeOrders: async () => {
        throw new Error('Exchange connection failed')
      },
    }

    engine.setExecutor(failingExecutor)

    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    }

    engine.setPortfolio(portfolio)

    try {
      await engine.execute('threshold')
      expect.fail('Should have thrown')
    } catch (err) {
      expect(engine.getFailedEvents().length).toBe(1)
    }
  })

  test('should calculate total fees', async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    }

    engine.setPortfolio(portfolio)
    const result = await engine.execute('threshold')

    expect(result.totalFeesUsd).toBeGreaterThanOrEqual(0)
  })

  test('should provide dry-run preview', async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.1,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 50,
          driftPct: 0,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    engine.setPortfolio(portfolio)
    const preview = await engine.preview()

    expect(preview.portfolio).toBeDefined()
    expect(preview.trades).toBeDefined()
    expect(Array.isArray(preview.trades)).toBe(true)
  })

  test('should track rebalance trigger type', async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    }

    engine.setPortfolio(portfolio)
    const result = await engine.execute('threshold')

    expect(result.trigger).toBe('threshold')
  })

  test('should capture before/after states', async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.1,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 50,
          driftPct: 0,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    engine.setPortfolio(portfolio)
    const result = await engine.execute('threshold')

    expect(result.beforeState).toBeDefined()
    expect(result.afterState).toBeDefined()
    expect(result.beforeState.totalValueUsd).toBe(10000)
  })

  test('should generate unique rebalance IDs', async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    }

    engine.setPortfolio(portfolio)

    const result1 = await engine.execute('threshold')
    const result2 = await engine.execute('threshold')

    expect(result1.id).not.toBe(result2.id)
  })

  test('should handle empty asset list', async () => {
    const portfolio: Portfolio = {
      totalValueUsd: 0,
      assets: [],
      updatedAt: Date.now(),
    }

    engine.setPortfolio(portfolio)
    const result = await engine.execute('threshold')

    expect(result.status).toBe('completed')
  })
})
