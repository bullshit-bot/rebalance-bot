/**
 * Shared CCXT mock exchange for testing across multiple backend modules.
 * Provides a fully functional mock that mimics CCXT Pro exchange behavior
 * without hitting real networks.
 */

export interface MockExchange {
  id: string
  name?: string
  watchTicker: (pair: string) => Promise<Record<string, unknown>>
  watchBalance: () => Promise<Record<string, unknown>>
  createOrder: (pair: string, type: string, side: string, amount: number, price?: number) => Promise<Record<string, unknown>>
  fetchOrder: (id: string, pair: string) => Promise<Record<string, unknown>>
  cancelOrder: (id: string, pair?: string) => Promise<Record<string, unknown>>
  fetchOHLCV: (pair: string, timeframe: string, since?: number, limit?: number) => Promise<number[][]>
  fetchBalance: () => Promise<Record<string, unknown>>
  fetchOpenOrders?: (pair: string) => Promise<Record<string, unknown>[]>
  loadMarkets: () => Promise<Record<string, unknown>>
  close: () => Promise<void>
}

/** In-memory storage for mock exchange state during test */
interface MockExchangeState {
  orders: Map<string, Record<string, unknown>>
  balances: Record<string, unknown>
  nextOrderId: number
}

const state: MockExchangeState = {
  orders: new Map(),
  balances: {
    free: { BTC: 1, ETH: 10, USDT: 50000 },
    used: {},
    total: { BTC: 1, ETH: 10, USDT: 50000 },
  },
  nextOrderId: 1000,
}

/**
 * Creates a mock CCXT exchange with sensible defaults.
 * Pass `overrides` to customize behavior for specific test scenarios.
 *
 * Example:
 *   const mockEx = createMockExchange({
 *     watchBalance: async () => ({ free: { BTC: 2 }, ... })
 *   })
 */
export function createMockExchange(overrides?: Partial<MockExchange>): MockExchange {
  return {
    id: 'mock-binance',
    name: 'Mock Binance',

    watchTicker: async (pair: string) => ({
      last: 50000,
      close: 49999,
      bid: 49998,
      ask: 50002,
      baseVolume: 1000,
      percentage: 2.5,
      timestamp: Date.now(),
      symbol: pair,
    }),

    watchBalance: async () => {
      return state.balances
    },

    createOrder: async (pair: string, type: string, side: string, amount: number, price?: number) => {
      const orderId = `mock-${state.nextOrderId++}`
      const filled = type === 'market' ? amount : 0 // Market orders fill immediately
      const cost = amount * (price ?? 50000)
      const fee = { cost: cost * 0.001, currency: 'USDT' }

      const order = {
        id: orderId,
        clientOrderId: null,
        timestamp: Date.now(),
        datetime: new Date().toISOString(),
        lastTradeTimestamp: null,
        symbol: pair,
        type,
        side,
        price: price ?? 50000,
        amount,
        cost,
        average: price ?? 50000,
        filled,
        remaining: amount - filled,
        status: type === 'market' ? 'closed' : 'open',
        fee,
        fees: [fee],
        trades: [],
        info: {},
      }

      state.orders.set(orderId, order)
      return order
    },

    fetchOrder: async (id: string, _pair: string) => {
      const order = state.orders.get(id)
      if (!order) {
        throw new Error(`Order ${id} not found`)
      }
      return order
    },

    cancelOrder: async (id: string, _pair?: string) => {
      const order = state.orders.get(id)
      if (!order) {
        throw new Error(`Order ${id} not found`)
      }

      const cancelled = {
        ...order,
        status: 'cancelled',
        remaining: order['amount'],
        filled: 0,
      }

      state.orders.set(id, cancelled)
      return cancelled
    },

    fetchOHLCV: async (_pair: string, _timeframe: string, since?: number, limit?: number) => {
      // Generate mock OHLCV data
      const now = Date.now()
      const bars = limit ?? 30
      const interval = _timeframe === '1d' ? 86400000 : 3600000 // Daily or hourly

      const candles: number[][] = []
      for (let i = 0; i < bars; i++) {
        const timestamp = (since ?? now - bars * interval) + i * interval
        const basePrice = 48000 + Math.random() * 2000
        candles.push([
          timestamp,
          basePrice, // open
          basePrice + Math.random() * 500, // high
          basePrice - Math.random() * 500, // low
          basePrice + Math.random() * 200, // close
          1000 + Math.random() * 500, // volume
        ])
      }

      return candles
    },

    fetchBalance: async () => {
      return state.balances
    },

    fetchOpenOrders: async (pair: string) => {
      // Return all open (non-closed) orders
      return Array.from(state.orders.values()).filter(
        (order) => order['symbol'] === pair && (order['status'] === 'open' || order['status'] === 'pending'),
      )
    },

    loadMarkets: async () => {
      return {
        'BTC/USDT': { id: 'BTCUSDT', symbol: 'BTC/USDT' },
        'ETH/USDT': { id: 'ETHUSDT', symbol: 'ETH/USDT' },
        'BNB/USDT': { id: 'BNBUSDT', symbol: 'BNB/USDT' },
      }
    },

    close: async () => {
      // No-op for mock
    },

    ...overrides,
  }
}

/**
 * Resets the in-memory state of all mock exchanges.
 * Call this in beforeEach() if sharing state across tests.
 */
export function resetMockExchangeState(): void {
  state.orders.clear()
  state.balances = {
    free: { BTC: 1, ETH: 10, USDT: 50000 },
    used: {},
    total: { BTC: 1, ETH: 10, USDT: 50000 },
  }
  state.nextOrderId = 1000
}

/**
 * Sets mock balance for testing portfolio scenarios.
 */
export function setMockBalance(asset: string, amount: number, type: 'free' | 'used' | 'total' = 'total'): void {
  const balances = state.balances as Record<string, Record<string, number>>
  if (!balances[type]) {
    balances[type] = {}
  }
  balances[type][asset] = amount
}

/**
 * Gets current mock balances (for test assertions).
 */
export function getMockBalance(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(state.balances))
}

/**
 * Gets all mock orders created during test (for assertions).
 */
export function getMockOrders(): Record<string, Record<string, unknown>> {
  const result: Record<string, Record<string, unknown>> = {}
  for (const [id, order] of state.orders) {
    result[id] = order
  }
  return result
}
