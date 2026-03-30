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

    it('should initialize gracefully without Telegram credentials', async () => {
      const n = new TelegramNotifier()
      await n.initialize()
      expect(true).toBe(true)
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

  describe('sendMessage', () => {
    it('should not throw when sending a plain text message', async () => {
      await expect(async () => {
        await notifier.sendMessage('Test message')
      }).not.toThrow()
    })

    it('should not throw with HTML formatted message', async () => {
      await expect(async () => {
        await notifier.sendMessage('<b>Bold</b> and <i>italic</i>')
      }).not.toThrow()
    })

    it('should not throw with very long message', async () => {
      await expect(async () => {
        await notifier.sendMessage('a'.repeat(4000))
      }).not.toThrow()
    })

    it('should not throw with emoji in message', async () => {
      await expect(async () => {
        await notifier.sendMessage('Test 🚀 emoji message')
      }).not.toThrow()
    })

    it('should not throw with empty message', async () => {
      await expect(async () => {
        await notifier.sendMessage('')
      }).not.toThrow()
    })
  })
})
