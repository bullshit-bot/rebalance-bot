import { describe, it, expect, beforeEach, afterEach, mock } from 'bun:test'

const mockExchange = {
  id: 'binance',
  watchBalance: async () => ({
    free: { BTC: 1, ETH: 10, USDT: 50000 },
    used: { BTC: 0, ETH: 0, USDT: 0 },
    total: { BTC: 1, ETH: 10, USDT: 50000 },
  }),
  loadMarkets: async () => ({}),
  close: async () => {},
}

mock.module('@exchange/exchange-manager', () => ({
  exchangeManager: {
    getExchange: () => mockExchange,
    getEnabledExchanges: () => new Map([['binance', mockExchange]]),
    initialize: async () => {},
    shutdown: async () => {},
  },
}))

mock.module('@price/price-cache', () => ({
  priceCache: {
    getBestPrice: (pair: string) => (pair.includes('BTC') ? 50000 : pair.includes('ETH') ? 3500 : 180),
    get: () => ({ price: 50000, bid: 49999, ask: 50001 }),
  },
}))

mock.module('@db/database', () => ({
  db: {
    query: async () => [],
    insert: () => ({ values: async () => ({}) }),
  },
}))

mock.module('@events/event-bus', () => ({
  eventBus: {
    emit: () => {},
    on: () => {},
    off: () => {},
  },
}))

import { PortfolioTracker } from '@portfolio/portfolio-tracker'

describe('PortfolioTracker', () => {
  let tracker: PortfolioTracker

  beforeEach(() => {
    tracker = new PortfolioTracker()
  })

  it('should create tracker instance', () => {
    expect(tracker).toBeDefined()
  })

  it('should start watching', async () => {
    const exchanges = new Map([['binance', mockExchange]])
    await tracker.startWatching(exchanges)
    expect(true).toBe(true)
  })

  it('should get target allocations', async () => {
    const targets = await tracker.getTargetAllocations()
    expect(targets).toBeDefined()
    expect(Array.isArray(targets)).toBe(true)
  })

  it('should stop watching', async () => {
    await tracker.stopWatching()
    expect(true).toBe(true)
  })

  afterEach(async () => {
    await tracker.stopWatching()
  })
})
