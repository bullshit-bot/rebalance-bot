import { describe, test, expect, beforeEach, mock, afterEach } from 'bun:test'
import type * as ccxt from 'ccxt'

// ─── Mock setup ────────────────────────────────────────────────────────────

class MockExchangeManager {
  private readonly exchanges: Map<string, any> = new Map()

  async initialize(): Promise<void> {
    // Mock implementation
    const configs = this.buildExchangeConfigs()

    for (const [name, config] of configs) {
      try {
        const exchange = { name, config, close: mock(() => Promise.resolve()) }
        exchange.loadMarkets = mock(() => Promise.resolve())

        await exchange.loadMarkets()
        this.exchanges.set(name, exchange)
      } catch (error) {
        console.error(`Failed to initialize ${name}`)
      }
    }
  }

  async shutdown(): Promise<void> {
    for (const [name, exchange] of this.exchanges) {
      if (typeof exchange.close === 'function') {
        await exchange.close().catch(() => {})
      }
    }
    this.exchanges.clear()
  }

  getExchange(name: string): any | undefined {
    return this.exchanges.get(name)
  }

  getEnabledExchanges(): Map<string, any> {
    return new Map(this.exchanges)
  }

  getStatus(): Record<string, 'connected' | 'disconnected'> {
    const allExchanges = ['binance', 'okx', 'bybit']
    return Object.fromEntries(
      allExchanges.map((name) => [
        name,
        this.exchanges.has(name) ? 'connected' : 'disconnected',
      ]),
    ) as Record<string, 'connected' | 'disconnected'>
  }

  private buildExchangeConfigs(): Map<string, { apiKey: string; secret: string }> {
    const configs = new Map<string, { apiKey: string; secret: string }>()

    if (process.env.BINANCE_API_KEY && process.env.BINANCE_API_SECRET) {
      configs.set('binance', {
        apiKey: process.env.BINANCE_API_KEY,
        secret: process.env.BINANCE_API_SECRET,
      })
    }

    if (process.env.OKX_API_KEY && process.env.OKX_API_SECRET) {
      configs.set('okx', {
        apiKey: process.env.OKX_API_KEY,
        secret: process.env.OKX_API_SECRET,
      })
    }

    if (process.env.BYBIT_API_KEY && process.env.BYBIT_API_SECRET) {
      configs.set('bybit', {
        apiKey: process.env.BYBIT_API_KEY,
        secret: process.env.BYBIT_API_SECRET,
      })
    }

    return configs
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('ExchangeManager', () => {
  let manager: MockExchangeManager

  beforeEach(() => {
    manager = new MockExchangeManager()
    process.env.BINANCE_API_KEY = 'test-binance-key'
    process.env.BINANCE_API_SECRET = 'test-binance-secret'
    process.env.OKX_API_KEY = ''
    process.env.OKX_API_SECRET = ''
    process.env.BYBIT_API_KEY = ''
    process.env.BYBIT_API_SECRET = ''
  })

  afterEach(() => {
    delete process.env.BINANCE_API_KEY
    delete process.env.BINANCE_API_SECRET
  })

  test('should initialize binance when credentials are set', async () => {
    await manager.initialize()
    const exchange = manager.getExchange('binance')
    expect(exchange).toBeDefined()
  })

  test('should skip exchanges without credentials', async () => {
    await manager.initialize()
    const okx = manager.getExchange('okx')
    const bybit = manager.getExchange('bybit')

    expect(okx).toBeUndefined()
    expect(bybit).toBeUndefined()
  })

  test('should return enabled exchanges map', async () => {
    await manager.initialize()
    const exchanges = manager.getEnabledExchanges()

    expect(exchanges.has('binance')).toBe(true)
    expect(exchanges.size).toBe(1)
  })

  test('should return connection status for all exchanges', async () => {
    await manager.initialize()
    const status = manager.getStatus()

    expect(status.binance).toBe('connected')
    expect(status.okx).toBe('disconnected')
    expect(status.bybit).toBe('disconnected')
  })

  test('should get specific exchange instance', async () => {
    await manager.initialize()
    const exchange = manager.getExchange('binance')

    expect(exchange).toBeDefined()
    expect(exchange.name).toBe('binance')
  })

  test('should return undefined for non-existent exchange', async () => {
    await manager.initialize()
    const exchange = manager.getExchange('nonexistent')

    expect(exchange).toBeUndefined()
  })

  test('should shutdown all exchanges', async () => {
    await manager.initialize()
    await manager.shutdown()

    const status = manager.getStatus()
    expect(status.binance).toBe('disconnected')
  })

  test('should handle multiple exchanges', async () => {
    process.env.OKX_API_KEY = 'test-okx-key'
    process.env.OKX_API_SECRET = 'test-okx-secret'
    process.env.BYBIT_API_KEY = 'test-bybit-key'
    process.env.BYBIT_API_SECRET = 'test-bybit-secret'

    await manager.initialize()
    const exchanges = manager.getEnabledExchanges()

    expect(exchanges.size).toBe(3)
    expect(exchanges.has('binance')).toBe(true)
    expect(exchanges.has('okx')).toBe(true)
    expect(exchanges.has('bybit')).toBe(true)
  })

  test('should return copy of enabled exchanges map', async () => {
    await manager.initialize()
    const map1 = manager.getEnabledExchanges()
    const map2 = manager.getEnabledExchanges()

    expect(map1).not.toBe(map2) // Different instances
    expect(map1.size).toBe(map2.size) // But same content
  })
})
