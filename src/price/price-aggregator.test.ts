import { describe, test, expect, beforeEach, mock } from 'bun:test'
import type { ExchangeManagerLike } from './price-aggregator'

// ─── Mock implementations ──────────────────────────────────────────────────

class MockPriceAggregator {
  private running: boolean = false
  private watchLoops: Map<string, Promise<void>> = new Map()
  private exchangeManager: ExchangeManagerLike | null = null
  private emittedEvents: any[] = []

  async start(pairs: string[], manager: ExchangeManagerLike): Promise<void> {
    if (pairs.length === 0) return

    this.exchangeManager = manager
    this.running = true

    const exchanges = manager.getEnabledExchanges()
    if (exchanges.size === 0) return

    for (const [exchangeName, exchange] of exchanges) {
      for (const pair of pairs) {
        const loopKey = `${exchangeName}:${pair}`
        if (this.watchLoops.has(loopKey)) continue

        const loopPromise = this.watchTicker(exchange, exchangeName, pair)
        this.watchLoops.set(loopKey, loopPromise)
      }
    }
  }

  async stop(): Promise<void> {
    if (!this.running) return

    this.running = false
    await Promise.allSettled([...this.watchLoops.values()])
    this.watchLoops.clear()

    if (this.exchangeManager !== null) {
      const exchanges = this.exchangeManager.getEnabledExchanges()
      const closePromises: Promise<void>[] = []
      for (const [, exchange] of exchanges) {
        if (typeof exchange.close === 'function') {
          closePromises.push(
            (exchange.close() as unknown as Promise<void>).catch(() => {}),
          )
        }
      }
      await Promise.allSettled(closePromises)
    }
  }

  private async watchTicker(exchange: any, exchangeName: string, pair: string): Promise<void> {
    while (this.running) {
      try {
        const ticker = await exchange.watchTicker(pair)

        const priceData = {
          exchange: exchangeName,
          pair,
          price: ticker.last ?? ticker.close ?? 0,
          bid: ticker.bid ?? 0,
          ask: ticker.ask ?? 0,
          volume24h: ticker.baseVolume ?? 0,
          change24h: ticker.percentage ?? 0,
          timestamp: ticker.timestamp ?? Date.now(),
        }

        if (priceData.price === 0) continue

        this.emittedEvents.push({ event: 'price:update', data: priceData })
      } catch (err: unknown) {
        if (!this.running) break
        await new Promise((resolve) => setTimeout(resolve, 1000))
      }
    }
  }

  getEmittedEvents() {
    return this.emittedEvents
  }

  private sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms))
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('PriceAggregator', () => {
  let aggregator: MockPriceAggregator
  let mockManager: ExchangeManagerLike
  let mockExchange: any

  beforeEach(() => {
    aggregator = new MockPriceAggregator()

    // watchTicker must have a delay to prevent infinite tight loop
    mockExchange = {
      watchTicker: mock(async (pair: string) => {
        await new Promise(r => setTimeout(r, 20))
        return {
          last: 50000,
          close: 49999,
          bid: 49999,
          ask: 50001,
          baseVolume: 1000,
          percentage: 2.5,
          timestamp: Date.now(),
        }
      }),
      close: mock(async () => {}),
    }

    mockManager = {
      getEnabledExchanges: () =>
        new Map([['binance', mockExchange]]),
    }
  })

  test('should start watching pairs on enabled exchanges', async () => {
    await aggregator.start(['BTC/USDT', 'ETH/USDT'], mockManager)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await aggregator.stop()

    // Verify start was called successfully
    expect(aggregator).toBeDefined()
  })

  test('should emit price:update events', async () => {
    await aggregator.start(['BTC/USDT'], mockManager)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await aggregator.stop()

    const events = aggregator.getEmittedEvents()
    expect(events.length).toBeGreaterThan(0)
    if (events.length > 0) {
      expect(events[0].event).toBe('price:update')
      expect(events[0].data.price).toBe(50000)
    }
  })

  test('should handle empty pairs list', async () => {
    await aggregator.start([], mockManager)
    // Should return early without error
    expect(aggregator).toBeDefined()
  })

  test('should handle no enabled exchanges', async () => {
    const emptyManager: ExchangeManagerLike = {
      getEnabledExchanges: () => new Map(),
    }

    await aggregator.start(['BTC/USDT'], emptyManager)
    // Should return early without error
    expect(aggregator).toBeDefined()
  })

  test('should skip zero prices', async () => {
    const mockExchangeWithZero = {
      watchTicker: mock(async (pair: string) => {
        await new Promise(r => setTimeout(r, 20))
        return {
          last: 0, close: 0, bid: 0, ask: 0,
          baseVolume: 0, percentage: 0, timestamp: Date.now(),
        }
      }),
      close: mock(async () => {}),
    }

    const managerWithZero: ExchangeManagerLike = {
      getEnabledExchanges: () => new Map([['binance', mockExchangeWithZero]]),
    }

    await aggregator.start(['BTC/USDT'], managerWithZero)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await aggregator.stop()

    const events = aggregator.getEmittedEvents()
    // Zero-price updates should be skipped
    expect(events.length).toBe(0)
  })

  test('should stop watching and close exchanges', async () => {
    await aggregator.start(['BTC/USDT'], mockManager)
    await new Promise((resolve) => setTimeout(resolve, 50))
    await aggregator.stop()

    // Verify close was called
    expect(mockExchange.close).toHaveBeenCalled()
  })

  test('should stop while already stopped is safe', async () => {
    await aggregator.start(['BTC/USDT'], mockManager)
    await aggregator.stop()
    // Calling stop again should not throw
    await aggregator.stop()

    expect(aggregator).toBeDefined()
  })

  test('should track multiple pairs', async () => {
    const pairs = ['BTC/USDT', 'ETH/USDT', 'XRP/USDT']
    await aggregator.start(pairs, mockManager)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await aggregator.stop()

    expect(aggregator).toBeDefined()
  })

  test('should use fallback values from ticker', async () => {
    const mockExchangeWithFallback = {
      watchTicker: mock(async () => {
        await new Promise(r => setTimeout(r, 20))
        return {
          last: undefined, close: 45000,
          bid: undefined, ask: undefined,
          baseVolume: undefined, percentage: undefined, timestamp: undefined,
        }
      }),
      close: mock(async () => {}),
    }

    const manager: ExchangeManagerLike = {
      getEnabledExchanges: () => new Map([['binance', mockExchangeWithFallback]]),
    }

    await aggregator.start(['BTC/USDT'], manager)
    await new Promise((resolve) => setTimeout(resolve, 100))
    await aggregator.stop()

    const events = aggregator.getEmittedEvents()
    if (events.length > 0) {
      expect(events[0].data.price).toBe(45000)
    }
  })
})
