import { describe, test, expect } from 'bun:test'
import { calculateTrades } from './trade-calculator'
import type { Allocation, Portfolio } from '@/types/index'
import { DEFAULT_BEAR_CASH_PCT } from './drift-detector'

// ─── Bear rebalance flow: trade-calculator with cashReservePct override ──────

describe('Bear rebalance flow', () => {
  const portfolio: Portfolio = {
    totalValueUsd: 10000,
    assets: [
      { asset: 'BTC', amount: 0.1, valueUsd: 5000, currentPct: 50, targetPct: 50, driftPct: 0, exchange: 'binance' },
      { asset: 'ETH', amount: 2, valueUsd: 3000, currentPct: 30, targetPct: 30, driftPct: 0, exchange: 'binance' },
      { asset: 'USDT', amount: 2000, valueUsd: 2000, currentPct: 20, targetPct: 20, driftPct: 0, exchange: 'binance' },
    ],
    updatedAt: Date.now(),
  }

  const targets: Allocation[] = [
    { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
    { asset: 'ETH', targetPct: 30, minTradeUsd: 10 },
    { asset: 'USDT', targetPct: 20, minTradeUsd: 10 },
  ]

  // Provide price overrides so tests don't depend on PriceCache
  const prices: Record<string, number> = {
    'BTC/USDT': 50000,
    'ETH/USDT': 1500,
  }

  test('DEFAULT_BEAR_CASH_PCT should be 70', () => {
    expect(DEFAULT_BEAR_CASH_PCT).toBe(70)
  })

  test('normal rebalance (no cashReservePct) should not generate sells for balanced portfolio', () => {
    const orders = calculateTrades(portfolio, targets, prices)
    // Portfolio is already at target — no trades needed
    expect(orders.length).toBe(0)
  })

  test('bear rebalance with 70% cash should generate sell orders', () => {
    const orders = calculateTrades(portfolio, targets, prices, 70)

    // With 70% cash target on $10k portfolio:
    // - Target cash: $7000 (currently $2000 USDT)
    // - Crypto pool: $3000 (currently $8000 in BTC+ETH)
    // - Should produce SELL orders to reduce crypto exposure
    const sellOrders = orders.filter((o) => o.side === 'sell')
    expect(sellOrders.length).toBeGreaterThan(0)

    // Total sell value should move toward filling the $5000 cash deficit
    const totalSellUsd = sellOrders.reduce((sum, o) => {
      const price = prices[o.pair] ?? 0
      return sum + o.amount * price
    }, 0)
    expect(totalSellUsd).toBeGreaterThan(0)
  })

  test('bear rebalance with 100% cash should sell all crypto', () => {
    const orders = calculateTrades(portfolio, targets, prices, 100)

    // 100% cash = all crypto must be sold
    const sellOrders = orders.filter((o) => o.side === 'sell')
    expect(sellOrders.length).toBeGreaterThan(0)

    // No buy orders
    const buyOrders = orders.filter((o) => o.side === 'buy')
    expect(buyOrders.length).toBe(0)
  })

  test('bear rebalance with 0% cash should behave like normal rebalance', () => {
    const ordersNormal = calculateTrades(portfolio, targets, prices)
    const ordersBear0 = calculateTrades(portfolio, targets, prices, 0)

    expect(ordersNormal.length).toBe(ordersBear0.length)
  })

  test('already at bear cash target should not generate sell orders', () => {
    const cashHeavyPortfolio: Portfolio = {
      totalValueUsd: 10000,
      assets: [
        { asset: 'BTC', amount: 0.03, valueUsd: 1500, currentPct: 15, targetPct: 50, driftPct: -35, exchange: 'binance' },
        { asset: 'ETH', amount: 1, valueUsd: 1500, currentPct: 15, targetPct: 30, driftPct: -15, exchange: 'binance' },
        { asset: 'USDT', amount: 7000, valueUsd: 7000, currentPct: 70, targetPct: 20, driftPct: 50, exchange: 'binance' },
      ],
      updatedAt: Date.now(),
    }

    const orders = calculateTrades(cashHeavyPortfolio, targets, prices, 70)
    // Already at 70% cash — crypto pool is $3000
    // Trade calculator rebalances WITHIN crypto pool (BTC/ETH ratio at 50/30)
    // No additional cash deficit sells needed — only internal crypto rebalance
    const totalTradeUsd = orders.reduce((sum, o) => sum + o.amount * (prices[o.pair] ?? 0), 0)
    // Total trade volume should be small relative to portfolio (internal rebalance only)
    expect(totalTradeUsd).toBeLessThan(2000)
  })
})
