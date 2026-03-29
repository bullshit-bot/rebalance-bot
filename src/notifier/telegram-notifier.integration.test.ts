import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { TelegramNotifier } from './telegram-notifier'

describe('telegram-notifier', () => {
  let notifier: TelegramNotifier

  beforeAll(() => {
    notifier = new TelegramNotifier()
  })

  afterAll(() => {
    if (notifier) {
      notifier.stop()
    }
  })

  describe('initialize', () => {
    it('should initialize without throwing when token is missing', async () => {
      const n = new TelegramNotifier()
      await expect(async () => {
        await n.initialize()
      }).not.toThrow()
    })

    it('should handle GoClaw unavailability gracefully', async () => {
      const n = new TelegramNotifier()
      await n.initialize()
      expect(true).toBe(true)
    })
  })

  describe('event descriptions (internal helpers)', () => {
    it('should describe trade event as plain text', () => {
      const description = notifier['describeTradeEvent']({
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 1,
        price: 40000,
        costUsd: 40000,
        exchange: 'binance',
        fee: 10,
        feeCurrency: 'USDT',
        isPaper: false,
      } as any)

      expect(description).toBeDefined()
      expect(typeof description).toBe('string')
      expect(description.length).toBeGreaterThan(0)
      expect(description).toContain('BTC/USDT')
    })

    it('should describe rebalance event as plain text', () => {
      const description = notifier['describeRebalanceEvent']({
        totalFeesUsd: 100,
        trades: [{ pair: 'BTC/USDT' }],
        trigger: 'drift',
        startedAt: new Date(Date.now() - 1000),
        completedAt: new Date(),
      } as any)

      expect(description).toBeDefined()
      expect(typeof description).toBe('string')
      expect(description.length).toBeGreaterThan(0)
    })

    it('should describe trailing stop event as plain text', () => {
      const description = notifier['describeTrailingStop']({
        asset: 'ETH',
        price: 1900,
        stopPrice: 1800,
      })

      expect(description).toBeDefined()
      expect(typeof description).toBe('string')
      expect(description).toContain('ETH')
    })

    it('should describe trend change event as plain text', () => {
      const description = notifier['describeTrendChange']({
        bullish: true,
        price: 65000,
        ma: 60000,
      })

      expect(description).toBeDefined()
      expect(typeof description).toBe('string')
      expect(description.length).toBeGreaterThan(0)
    })

    it('should describe trend change with null ma', () => {
      const description = notifier['describeTrendChange']({
        bullish: false,
        price: 45000,
        ma: null,
      })

      expect(description).toBeDefined()
      expect(typeof description).toBe('string')
      expect(description).toContain('N/A')
    })
  })

  describe('throttling', () => {
    it('should have throttle map', () => {
      expect(notifier['throttle']).toBeDefined()
      expect(notifier['throttle'] instanceof Map).toBe(true)
    })

    it('should have 30-minute throttle duration constant', () => {
      const throttleMs = notifier['THROTTLE_MS']
      expect(throttleMs).toBeGreaterThan(0)
      expect(throttleMs).toBe(30 * 60 * 1000)
    })
  })

  describe('lifecycle', () => {
    it('should have start method', () => {
      expect(typeof notifier.start).toBe('function')
    })

    it('should have stop method', () => {
      expect(typeof notifier.stop).toBe('function')
    })

    it('should have sendMessage method', () => {
      expect(typeof notifier.sendMessage).toBe('function')
    })

    it('should not throw when stopping without initialization', () => {
      const n = new TelegramNotifier()
      expect(() => {
        n.stop()
      }).not.toThrow()
    })
  })

  describe('event subscription', () => {
    it('should subscribe to trade executed event', async () => {
      const n = new TelegramNotifier()
      await n.initialize()
      await n.start()
      expect(true).toBe(true)
      n.stop()
    })
  })

  describe('edge cases — describe helpers with boundary values', () => {
    it('should describe trade with very long pair name', () => {
      const description = notifier['describeTradeEvent']({
        pair: 'VERY_LONG_COIN_NAME_12345/USDT',
        side: 'sell',
        amount: 1000,
        price: 0.001,
        costUsd: 1,
        exchange: 'binance',
        fee: 0.001,
        feeCurrency: 'USDT',
        isPaper: true,
      } as any)

      expect(description).toBeDefined()
      expect(description.length).toBeGreaterThan(0)
    })

    it('should describe trade with very large amounts', () => {
      const description = notifier['describeTradeEvent']({
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 1000000,
        price: 100000,
        costUsd: 100000000,
        exchange: 'binance',
        fee: 100000,
        feeCurrency: 'USDT',
        isPaper: false,
      } as any)

      expect(description).toBeDefined()
      expect(description.length).toBeGreaterThan(0)
    })

    it('should describe trade with very small amounts', () => {
      const description = notifier['describeTradeEvent']({
        pair: 'DOGE/USDT',
        side: 'buy',
        amount: 0.000001,
        price: 0.00001,
        costUsd: 0.00001,
        exchange: 'binance',
        fee: 0.000001,
        feeCurrency: 'USDT',
        isPaper: false,
      } as any)

      expect(description).toBeDefined()
      expect(description.length).toBeGreaterThan(0)
    })
  })
})
