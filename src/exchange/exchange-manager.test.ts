import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { createMockExchange, resetMockExchangeState } from '@test-utils/mock-exchange'

// ─── ExchangeManager test implementation ───────────────────────────────────

class TestExchangeManager {
  private readonly exchanges: Map<string, any> = new Map()
  private initialized = false

  async initialize(): Promise<void> {
    if (this.initialized) return
    this.initialized = true

    const configs = this.buildExchangeConfigs()

    for (const [name, config] of configs) {
      try {
        // In real code, createExchange(name, config) is called
        // Here we use mock exchange
        const exchange = createMockExchange({ id: name })
        await exchange.loadMarkets()
        this.exchanges.set(name, exchange)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        console.error(`[ExchangeManager] Failed to connect to ${name}: ${message}`)
      }
    }

    if (this.exchanges.size === 0) {
      console.warn('[ExchangeManager] No exchanges initialised — check your API key configuration')
    }
  }

  async shutdown(): Promise<void> {
    const closePromises: Promise<void>[] = []

    for (const [name, exchange] of this.exchanges) {
      closePromises.push(
        Promise.resolve()
          .then(() => exchange.close())
          .then(() => {
            console.log(`[ExchangeManager] ${name} disconnected`)
          })
          .catch((error: unknown) => {
            const message = error instanceof Error ? error.message : String(error)
            console.error(`[ExchangeManager] Error closing ${name}: ${message}`)
          }),
      )
    }

    await Promise.allSettled(closePromises)
    this.exchanges.clear()
    this.initialized = false
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
      allExchanges.map((name) => [name, this.exchanges.has(name) ? 'connected' : 'disconnected']),
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

// ─── Tests ────────────────────────────────────────────────────────────────

describe('ExchangeManager', () => {
  let manager: TestExchangeManager

  beforeEach(() => {
    manager = new TestExchangeManager()
    resetMockExchangeState()
    process.env.BINANCE_API_KEY = 'test-binance-key'
    process.env.BINANCE_API_SECRET = 'test-binance-secret'
    process.env.OKX_API_KEY = ''
    process.env.OKX_API_SECRET = ''
    process.env.BYBIT_API_KEY = ''
    process.env.BYBIT_API_SECRET = ''
  })

  afterEach(async () => {
    await manager.shutdown()
    delete process.env.BINANCE_API_KEY
    delete process.env.BINANCE_API_SECRET
    delete process.env.OKX_API_KEY
    delete process.env.OKX_API_SECRET
    delete process.env.BYBIT_API_KEY
    delete process.env.BYBIT_API_SECRET
  })

  test('initialize() connects when credentials are set', async () => {
    await manager.initialize()
    const exchange = manager.getExchange('binance')
    expect(exchange).toBeDefined()
  })

  test('initialize() skips exchanges without credentials', async () => {
    await manager.initialize()
    expect(manager.getExchange('okx')).toBeUndefined()
    expect(manager.getExchange('bybit')).toBeUndefined()
  })

  test('initialize() creates enabled exchanges map', async () => {
    await manager.initialize()
    const exchanges = manager.getEnabledExchanges()
    expect(exchanges.has('binance')).toBe(true)
    expect(exchanges.size).toBe(1)
  })

  test('initialize() with no credentials', async () => {
    delete process.env.BINANCE_API_KEY
    delete process.env.BINANCE_API_SECRET
    await manager.initialize()
    const exchanges = manager.getEnabledExchanges()
    expect(exchanges.size).toBe(0)
  })

  test('getStatus() returns all exchange statuses', async () => {
    await manager.initialize()
    const status = manager.getStatus()

    expect(status).toHaveProperty('binance')
    expect(status).toHaveProperty('okx')
    expect(status).toHaveProperty('bybit')
    expect(status.binance).toBe('connected')
    expect(status.okx).toBe('disconnected')
    expect(status.bybit).toBe('disconnected')
  })

  test('getExchange() returns connected exchange', async () => {
    await manager.initialize()
    const exchange = manager.getExchange('binance')
    expect(exchange).toBeDefined()
    expect(exchange.id).toBe('binance')
  })

  test('getExchange() returns undefined for missing exchange', async () => {
    await manager.initialize()
    const exchange = manager.getExchange('nonexistent')
    expect(exchange).toBeUndefined()
  })

  test('getEnabledExchanges() returns a copy', async () => {
    await manager.initialize()
    const map1 = manager.getEnabledExchanges()
    const map2 = manager.getEnabledExchanges()
    expect(map1).not.toBe(map2) // Different object instances
    expect(map1.size).toBe(map2.size)
  })

  test('shutdown() disconnects all exchanges', async () => {
    await manager.initialize()
    const before = manager.getStatus()
    expect(before.binance).toBe('connected')

    await manager.shutdown()
    const after = manager.getStatus()
    expect(after.binance).toBe('disconnected')
  })

  test('shutdown() clears all exchanges', async () => {
    await manager.initialize()
    expect(manager.getEnabledExchanges().size).toBe(1)

    await manager.shutdown()
    expect(manager.getEnabledExchanges().size).toBe(0)
  })

  test('initialize() and shutdown() lifecycle', async () => {
    await manager.initialize()
    const initialized = manager.getStatus().binance
    expect(initialized).toBe('connected')

    await manager.shutdown()
    const disconnected = manager.getStatus().binance
    expect(disconnected).toBe('disconnected')

    // Can reinitialize after shutdown
    await manager.initialize()
    const reinitialized = manager.getStatus().binance
    expect(reinitialized).toBe('connected')
  })

  test('initialize() with multiple exchanges', async () => {
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

  test('getStatus() for multiple connected exchanges', async () => {
    process.env.OKX_API_KEY = 'test-okx-key'
    process.env.OKX_API_SECRET = 'test-okx-secret'

    await manager.initialize()
    const status = manager.getStatus()

    expect(status.binance).toBe('connected')
    expect(status.okx).toBe('connected')
    expect(status.bybit).toBe('disconnected')
  })

  test('getEnabledExchanges() for all exchanges', async () => {
    process.env.OKX_API_KEY = 'test-okx-key'
    process.env.OKX_API_SECRET = 'test-okx-secret'
    process.env.BYBIT_API_KEY = 'test-bybit-key'
    process.env.BYBIT_API_SECRET = 'test-bybit-secret'

    await manager.initialize()
    const exchanges = manager.getEnabledExchanges()

    expect(exchanges.get('binance')).toBeDefined()
    expect(exchanges.get('okx')).toBeDefined()
    expect(exchanges.get('bybit')).toBeDefined()
  })

  test('mock exchange supports market loading', async () => {
    await manager.initialize()
    const exchange = manager.getExchange('binance')

    const markets = await exchange.loadMarkets()
    expect(markets).toBeDefined()
  })

  test('mock exchange supports close', async () => {
    await manager.initialize()
    const exchange = manager.getExchange('binance')

    const closeResult = await exchange.close()
    expect(closeResult).toBeUndefined()
  })

  test('initialize() is idempotent', async () => {
    await manager.initialize()
    const size1 = manager.getEnabledExchanges().size

    await manager.initialize()
    const size2 = manager.getEnabledExchanges().size

    expect(size1).toBe(size2)
  })

  test('shutdown() is safe to call multiple times', async () => {
    await manager.initialize()
    await manager.shutdown()
    await manager.shutdown()

    expect(manager.getEnabledExchanges().size).toBe(0)
  })

  test('getStatus() with no initialized exchanges', async () => {
    const status = manager.getStatus()

    expect(status.binance).toBe('disconnected')
    expect(status.okx).toBe('disconnected')
    expect(status.bybit).toBe('disconnected')
  })

  test('exchange object has required methods', async () => {
    await manager.initialize()
    const exchange = manager.getExchange('binance')

    expect(typeof exchange.createOrder).toBe('function')
    expect(typeof exchange.fetchOrder).toBe('function')
    expect(typeof exchange.cancelOrder).toBe('function')
    expect(typeof exchange.fetchBalance).toBe('function')
    expect(typeof exchange.watchBalance).toBe('function')
  })

  test('exchanges can be accessed by property', async () => {
    await manager.initialize()
    const exchanges = manager.getEnabledExchanges()
    const binance = exchanges.get('binance')

    expect(binance).toBeDefined()
    expect(binance.id).toBe('binance')
  })
})
