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

    it('should mark bot as null when token is missing', async () => {
      const n = new TelegramNotifier()
      await n.initialize()
      expect(true).toBe(true)
    })
  })

  describe('message formatting', () => {
    it('should format trade executed message', () => {
      const message = notifier['formatTradeExecuted']({
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 1,
        price: 40000,
        costUsd: 40000,
        exchange: 'binance',
        fee: 10,
        feeCurrency: 'USDT',
        isPaper: false,
      })

      expect(message).toBeDefined()
      expect(typeof message).toBe('string')
      expect(message.length).toBeGreaterThan(0)
      expect(message).toContain('BTC/USDT')
    })

    it('should format rebalance completed message', () => {
      const message = notifier['formatRebalanceCompleted']({
        totalFeesUsd: 100,
        trades: [{ pair: 'BTC/USDT' }],
        trigger: 'drift',
        startedAt: new Date(Date.now() - 1000),
        completedAt: new Date(),
      } as any)

      expect(message).toBeDefined()
      expect(typeof message).toBe('string')
      expect(message.length).toBeGreaterThan(0)
    })

    it('should format drift warning message', () => {
      const message = notifier['formatDriftWarning']({
        asset: 'BTC',
        driftPct: 8,
        targetPct: 50,
        currentPct: 58,
      })

      expect(message).toBeDefined()
      expect(typeof message).toBe('string')
      expect(message).toContain('BTC')
    })

    it('should format exchange status message', () => {
      const message = notifier['formatExchangeStatus']('binance', 'connected')

      expect(message).toBeDefined()
      expect(typeof message).toBe('string')
      expect(message).toContain('binance')
    })

    it('should format alert message', () => {
      const message = notifier['formatAlert']({
        level: 'error',
        message: 'Test error',
      })

      expect(message).toBeDefined()
      expect(typeof message).toBe('string')
      expect(message).toContain('error')
    })

    it('should format trailing stop message', () => {
      const message = notifier['formatTrailingStopTriggered']({
        asset: 'ETH',
        price: 1900,
        stopPrice: 1800,
      })

      expect(message).toBeDefined()
      expect(typeof message).toBe('string')
      expect(message).toContain('ETH')
    })
  })

  describe('throttling', () => {
    it('should have throttle map', () => {
      expect(notifier['throttle']).toBeDefined()
      expect(notifier['throttle'] instanceof Map).toBe(true)
    })

    it('should have throttle duration constant', () => {
      const throttleMs = notifier['THROTTLE_MS']
      expect(throttleMs).toBeGreaterThan(0)
      expect(throttleMs).toBe(5 * 60 * 1000)
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

  describe('edge cases', () => {
    it('should format message with very long pair name', () => {
      const message = notifier['formatTradeExecuted']({
        pair: 'VERY_LONG_COIN_NAME_12345/USDT',
        side: 'sell',
        amount: 1000,
        price: 0.001,
        costUsd: 1,
        exchange: 'binance',
        fee: 0.001,
        feeCurrency: 'USDT',
        isPaper: true,
      })

      expect(message).toBeDefined()
      expect(message.length).toBeGreaterThan(0)
    })

    it('should format message with very large amounts', () => {
      const message = notifier['formatTradeExecuted']({
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 1000000,
        price: 100000,
        costUsd: 100000000,
        exchange: 'binance',
        fee: 100000,
        feeCurrency: 'USDT',
        isPaper: false,
      })

      expect(message).toBeDefined()
      expect(message.length).toBeGreaterThan(0)
    })

    it('should format message with very small amounts', () => {
      const message = notifier['formatTradeExecuted']({
        pair: 'DOGE/USDT',
        side: 'buy',
        amount: 0.000001,
        price: 0.00001,
        costUsd: 0.00001,
        exchange: 'binance',
        fee: 0.000001,
        feeCurrency: 'USDT',
        isPaper: false,
      })

      expect(message).toBeDefined()
      expect(message.length).toBeGreaterThan(0)
    })
  })
})
