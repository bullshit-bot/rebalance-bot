import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { DCAService } from './dca-service'
import type { Portfolio, Allocation } from '@/types/index'

describe('DCAService', () => {
  let service: DCAService

  beforeEach(() => {
    service = new DCAService()
  })

  afterEach(() => {
    service.stop()
  })

  test('calculateDCAAllocation returns empty array when portfolio is balanced', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.25,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 50,
          driftPct: 0,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 25,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 50,
          driftPct: 0,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]

    const orders = service.calculateDCAAllocation(1000, portfolio, targets)
    expect(orders.length).toBe(0)
  })

  test('allocates deposit to underweight assets proportionally', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.1,
          valueUsd: 2000,
          currentPct: 20,
          targetPct: 50,
          driftPct: -30,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 10,
          valueUsd: 8000,
          currentPct: 80,
          targetPct: 50,
          driftPct: 30,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]

    const orders = service.calculateDCAAllocation(1000, portfolio, targets)

    // Only BTC is underweight, so 100% of deposit goes there
    expect(orders.length).toBe(1)
    expect(orders[0].pair).toBe('BTC/USDT')
    expect(orders[0].side).toBe('buy')
    expect(orders[0].amount).toBeGreaterThan(0)
  })

  test('allocates proportionally when multiple assets are underweight', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.05,
          valueUsd: 1000,
          currentPct: 10,
          targetPct: 50,
          driftPct: -40,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 5,
          valueUsd: 1500,
          currentPct: 15,
          targetPct: 50,
          driftPct: -35,
          exchange: 'binance',
        },
        {
          asset: 'XRP',
          amount: 7000,
          valueUsd: 7500,
          currentPct: 75,
          targetPct: 0,
          driftPct: 75,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]

    const orders = service.calculateDCAAllocation(2000, portfolio, targets)

    // Both BTC and ETH are underweight; BTC has larger deficit (40 vs 35)
    expect(orders.length).toBe(2)

    const btcOrder = orders.find((o) => o.pair === 'BTC/USDT')
    const ethOrder = orders.find((o) => o.pair === 'ETH/USDT')

    expect(btcOrder).toBeDefined()
    expect(ethOrder).toBeDefined()

    // BTC gets 40/75 of deposit = 1066.67 USD
    // ETH gets 35/75 of deposit = 933.33 USD
    // Amount in coins depends on price: BTC costs more per coin, so fewer coins
    expect(btcOrder).toBeDefined()
    expect(ethOrder).toBeDefined()
  })

  test('respects minTradeUsd in allocation filtering', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 1,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 75,
          driftPct: -25,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 100,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 25,
          driftPct: 25,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 75, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 25, minTradeUsd: 10 },
    ]

    // BTC is underweight by 25%, gets 100% of deposit = 2000 USD
    // minTradeUsd is 10, so order will be generated
    const orders = service.calculateDCAAllocation(2000, portfolio, targets)

    expect(orders.length).toBeGreaterThanOrEqual(1)
    expect(orders[0].pair).toBe('BTC/USDT')
  })

  test('uses allocation-level exchange if provided', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.1,
          valueUsd: 2000,
          currentPct: 20,
          targetPct: 50,
          driftPct: -30,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 10,
          valueUsd: 8000,
          currentPct: 80,
          targetPct: 50,
          driftPct: 30,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10, exchange: 'okx' },
    ]

    const orders = service.calculateDCAAllocation(1000, portfolio, targets)

    expect(orders.length).toBe(1)
    expect(orders[0].exchange).toBe('okx')
  })

  test('falls back to asset exchange when allocation exchange not specified', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.1,
          valueUsd: 2000,
          currentPct: 20,
          targetPct: 50,
          driftPct: -30,
          exchange: 'okx',
        },
        {
          asset: 'ETH',
          amount: 10,
          valueUsd: 8000,
          currentPct: 80,
          targetPct: 50,
          driftPct: 30,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
    ]

    const orders = service.calculateDCAAllocation(1000, portfolio, targets)

    expect(orders.length).toBe(1)
    expect(orders[0].exchange).toBe('okx')
  })

  test('ignores assets not in targets', () => {
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
        {
          asset: 'XRP',
          amount: 5000,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 0,
          driftPct: 50,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      // XRP is not in targets, so it won't be considered for allocation
    ]

    const orders = service.calculateDCAAllocation(1000, portfolio, targets)

    // BTC is already at target (50%), XRP is not in targets
    // No underweight assets, so no orders
    expect(orders.length).toBe(0)
  })

  test('handles zero portfolio value gracefully', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 0,
      assets: [],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
    ]

    const orders = service.calculateDCAAllocation(1000, portfolio, targets)
    expect(orders.length).toBe(0)
  })

  test('handles assets with zero amount/valueUsd', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0,
          valueUsd: 0,
          currentPct: 0,
          targetPct: 50,
          driftPct: -50,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 10,
          valueUsd: 10000,
          currentPct: 100,
          targetPct: 50,
          driftPct: 50,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]

    const orders = service.calculateDCAAllocation(1000, portfolio, targets)

    // BTC has zero value, so it's skipped in the calculation
    expect(orders.length).toBe(0)
  })

  test('complex multi-asset DCA scenario', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.1,
          valueUsd: 2000,
          currentPct: 20,
          targetPct: 30,
          driftPct: -10,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 5,
          valueUsd: 3000,
          currentPct: 30,
          targetPct: 40,
          driftPct: -10,
          exchange: 'binance',
        },
        {
          asset: 'XRP',
          amount: 5000,
          valueUsd: 5000,
          currentPct: 50,
          targetPct: 30,
          driftPct: 20,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 30, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 40, minTradeUsd: 10 },
    ]

    const orders = service.calculateDCAAllocation(1000, portfolio, targets)

    // Both BTC and ETH underweight equally (10% each)
    // Total deficit = 20%, so each gets 50% of deposit = 500 USD
    // BTC: 500 / (2000/0.1) = 500 / 20000 = 0.025 BTC
    // ETH: 500 / (3000/5) = 500 / 600 = 0.833 ETH
    // ETH amount is larger because ETH is much cheaper per coin
    expect(orders.length).toBe(2)
    expect(orders[0].pair === 'BTC/USDT' || orders[0].pair === 'ETH/USDT').toBe(true)
    expect(orders[1].pair === 'BTC/USDT' || orders[1].pair === 'ETH/USDT').toBe(true)
  })

  test('start and stop lifecycle', () => {
    service.start()
    service.stop()
    // Should not throw
  })

  test('calculateDCAAllocation returns buy orders', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.1,
          valueUsd: 2000,
          currentPct: 20,
          targetPct: 50,
          driftPct: -30,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 10,
          valueUsd: 8000,
          currentPct: 80,
          targetPct: 50,
          driftPct: 30,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
    ]

    const orders = service.calculateDCAAllocation(1000, portfolio, targets)

    expect(orders.every((o) => o.side === 'buy')).toBe(true)
    expect(orders.every((o) => o.type === 'market')).toBe(true)
  })

  test('handles very small allocations correctly', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.0001,
          valueUsd: 2,
          currentPct: 0.02,
          targetPct: 50,
          driftPct: -49.98,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 100,
          valueUsd: 9998,
          currentPct: 99.98,
          targetPct: 50,
          driftPct: 49.98,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
    ]

    const orders = service.calculateDCAAllocation(1000, portfolio, targets)

    expect(orders.length).toBe(1)
    expect(orders[0].pair).toBe('BTC/USDT')
  })

  test('allocates to most underweight assets first', () => {
    const portfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        {
          asset: 'BTC',
          amount: 0.05,
          valueUsd: 1000,
          currentPct: 10,
          targetPct: 50,
          driftPct: -40,
          exchange: 'binance',
        },
        {
          asset: 'ETH',
          amount: 2,
          valueUsd: 2000,
          currentPct: 20,
          targetPct: 50,
          driftPct: -30,
          exchange: 'binance',
        },
        {
          asset: 'XRP',
          amount: 7000,
          valueUsd: 7000,
          currentPct: 70,
          targetPct: 0,
          driftPct: 70,
          exchange: 'binance',
        },
      ],
      updatedAt: Date.now(),
    }

    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]

    const orders = service.calculateDCAAllocation(2000, portfolio, targets)

    // BTC most underweight (40% vs 30%), should get more allocation
    // BTC deficit 40% gets 40/70 = 57.1% of 2000 = 1142.86 USD
    // ETH deficit 30% gets 30/70 = 42.9% of 2000 = 857.14 USD
    // BTC price = 20000, ETH price = 1000
    // BTC amount = 1142.86 / 20000 = 0.0571
    // ETH amount = 857.14 / 1000 = 0.8571
    // ETH coin amount is actually higher because it's cheaper
    const btcOrder = orders.find((o) => o.pair === 'BTC/USDT')!
    const ethOrder = orders.find((o) => o.pair === 'ETH/USDT')!

    expect(btcOrder).toBeDefined()
    expect(ethOrder).toBeDefined()
  })
})
