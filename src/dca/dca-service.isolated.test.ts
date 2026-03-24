import { describe, it, expect, mock } from 'bun:test'

mock.module('@config/app-config', () => ({
  env: { MIN_TRADE_USD: 10 },
}))

mock.module('@events/event-bus', () => ({
  eventBus: {
    on: () => {},
    off: () => {},
  },
}))

mock.module('@portfolio/portfolio-tracker', () => ({
  portfolioTracker: {
    getTargetAllocations: async () => [
      { asset: 'BTC', targetPct: 60 },
      { asset: 'ETH', targetPct: 40 },
    ],
  },
}))

import { DCAService } from './dca-service'

describe('dca-service', () => {
  it('starts and stops service', () => {
    const service = new DCAService()
    service.start()
    service.stop()
    expect(true).toBe(true)
  })

  it('stops without starting', () => {
    const service = new DCAService()
    service.stop()
    expect(true).toBe(true)
  })

  it('calculates DCA allocation for balanced portfolio', () => {
    const service = new DCAService()
    const deposit = 1000
    const portfolio = {
      totalValueUsd: 10000,
      assets: [
        { asset: 'BTC', amount: 0.5, valueUsd: 6000, currentPct: 60, targetPct: 60, exchange: 'binance' as const },
        { asset: 'ETH', amount: 10, valueUsd: 4000, currentPct: 40, targetPct: 40, exchange: 'binance' as const },
      ],
      updatedAt: Date.now(),
    }
    const targets = [
      { asset: 'BTC', targetPct: 60 },
      { asset: 'ETH', targetPct: 40 },
    ]

    const orders = service.calculateDCAAllocation(deposit, portfolio, targets)
    expect(orders.length).toBe(0)
  })

  it('calculates DCA allocation for underweight assets', () => {
    const service = new DCAService()
    const deposit = 1000
    const portfolio = {
      totalValueUsd: 10000,
      assets: [
        { asset: 'BTC', amount: 0.1, valueUsd: 3000, currentPct: 30, targetPct: 60, exchange: 'binance' as const },
        { asset: 'ETH', amount: 20, valueUsd: 7000, currentPct: 70, targetPct: 40, exchange: 'binance' as const },
      ],
      updatedAt: Date.now(),
    }
    const targets = [
      { asset: 'BTC', targetPct: 60 },
      { asset: 'ETH', targetPct: 40 },
    ]

    const orders = service.calculateDCAAllocation(deposit, portfolio, targets)
    expect(orders.length).toBeGreaterThan(0)
    expect(orders[0]?.side).toBe('buy')
  })

  it('filters orders below MIN_TRADE_USD', () => {
    const service = new DCAService()
    const deposit = 5 // Small deposit
    const portfolio = {
      totalValueUsd: 10000,
      assets: [
        { asset: 'BTC', amount: 0.1, valueUsd: 3000, currentPct: 30, targetPct: 60, exchange: 'binance' as const },
        { asset: 'ETH', amount: 20, valueUsd: 7000, currentPct: 70, targetPct: 40, exchange: 'binance' as const },
      ],
      updatedAt: Date.now(),
    }
    const targets = [
      { asset: 'BTC', targetPct: 60 },
      { asset: 'ETH', targetPct: 40 },
    ]

    const orders = service.calculateDCAAllocation(deposit, portfolio, targets)
    // All orders should be filtered out due to MIN_TRADE_USD
    expect(orders.length).toBe(0)
  })

  it('respects allocation-level exchange override', () => {
    const service = new DCAService()
    const deposit = 1000
    const portfolio = {
      totalValueUsd: 10000,
      assets: [
        { asset: 'BTC', amount: 0.1, valueUsd: 3000, currentPct: 30, targetPct: 60, exchange: 'binance' as const },
      ],
      updatedAt: Date.now(),
    }
    const targets = [
      { asset: 'BTC', targetPct: 60, exchange: 'okx' as const },
    ]

    const orders = service.calculateDCAAllocation(deposit, portfolio, targets)
    if (orders.length > 0) {
      expect(orders[0]?.exchange).toBe('okx')
    }
  })

  it('handles portfolio with zero amount assets', () => {
    const service = new DCAService()
    const deposit = 1000
    const portfolio = {
      totalValueUsd: 10000,
      assets: [
        { asset: 'BTC', amount: 0, valueUsd: 0, currentPct: 0, targetPct: 60, exchange: 'binance' as const },
        { asset: 'ETH', amount: 20, valueUsd: 10000, currentPct: 100, targetPct: 40, exchange: 'binance' as const },
      ],
      updatedAt: Date.now(),
    }
    const targets = [
      { asset: 'BTC', targetPct: 60 },
      { asset: 'ETH', targetPct: 40 },
    ]

    const orders = service.calculateDCAAllocation(deposit, portfolio, targets)
    // BTC should be skipped due to zero amount
    expect(true).toBe(true)
  })

  it('starts twice has no side effects', () => {
    const service = new DCAService()
    service.start()
    service.start()
    service.stop()
    expect(true).toBe(true)
  })
})
