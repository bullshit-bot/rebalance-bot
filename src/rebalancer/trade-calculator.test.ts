import { describe, test, expect, beforeEach } from 'bun:test'
import { calculateTrades } from './trade-calculator'
import type { Portfolio, Allocation } from '@/types/index'

describe('trade-calculator', () => {
  let portfolio: Portfolio

  beforeEach(() => {
    portfolio = {
      totalValueUsd: 10000,
      assets: [],
      updatedAt: Date.now(),
    }
  })

  test('returns empty array when portfolio has zero value', () => {
    portfolio.totalValueUsd = 0
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]
    const trades = calculateTrades(portfolio, targets)
    expect(trades).toEqual([])
  })

  test('returns empty array when portfolio is balanced', () => {
    portfolio.assets = [
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
        amount: 10,
        valueUsd: 5000,
        currentPct: 50,
        targetPct: 50,
        driftPct: 0,
        exchange: 'binance',
      },
    ]
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]
    const trades = calculateTrades(portfolio, targets)
    expect(trades).toEqual([])
  })

  test('generates buy orders for underweight assets', () => {
    portfolio.assets = [
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
        amount: 20,
        valueUsd: 8000,
        currentPct: 80,
        targetPct: 50,
        driftPct: 30,
        exchange: 'binance',
      },
    ]
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]
    const trades = calculateTrades(portfolio, targets)

    // Should buy BTC (underweight) and sell ETH (overweight)
    expect(trades.length).toBe(2)

    const btcTrade = trades.find((t) => t.pair === 'BTC/USDT')
    expect(btcTrade).toBeDefined()
    expect(btcTrade?.side).toBe('buy')
    expect(btcTrade?.amount).toBe(3000) // Need to buy $3000 worth

    const ethTrade = trades.find((t) => t.pair === 'ETH/USDT')
    expect(ethTrade).toBeDefined()
    expect(ethTrade?.side).toBe('sell')
    expect(ethTrade?.amount).toBe(3000) // Need to sell $3000 worth
  })

  test('generates sell orders for overweight assets', () => {
    portfolio.assets = [
      {
        asset: 'BTC',
        amount: 1,
        valueUsd: 9000,
        currentPct: 90,
        targetPct: 50,
        driftPct: 40,
        exchange: 'binance',
      },
      {
        asset: 'ETH',
        amount: 1,
        valueUsd: 1000,
        currentPct: 10,
        targetPct: 50,
        driftPct: -40,
        exchange: 'binance',
      },
    ]
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]
    const trades = calculateTrades(portfolio, targets)

    expect(trades.length).toBe(2)
    const btcTrade = trades.find((t) => t.pair === 'BTC/USDT')
    expect(btcTrade?.side).toBe('sell')
  })

  test('filters out trades below MIN_TRADE_USD', () => {
    portfolio.assets = [
      {
        asset: 'BTC',
        amount: 0.1,
        valueUsd: 5050,
        currentPct: 50.5,
        targetPct: 50,
        driftPct: 0.5,
        exchange: 'binance',
      },
      {
        asset: 'ETH',
        amount: 1,
        valueUsd: 4950,
        currentPct: 49.5,
        targetPct: 50,
        driftPct: -0.5,
        exchange: 'binance',
      },
    ]
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 100 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 100 },
    ]
    const trades = calculateTrades(portfolio, targets)

    // BTC delta: $5000 - $5050 = -$50 (need to sell) < 100 → filtered
    // ETH delta: $5000 - $4950 = $50 (need to buy) < 100 → filtered
    // No trades should be generated
    expect(trades.length).toBe(0)
  })

  test('respects allocation-level minTradeUsd over env default', () => {
    portfolio.assets = [
      {
        asset: 'BTC',
        amount: 0.1,
        valueUsd: 5200,
        currentPct: 52,
        targetPct: 50,
        driftPct: 2,
        exchange: 'binance',
      },
      {
        asset: 'ETH',
        amount: 1,
        valueUsd: 4800,
        currentPct: 48,
        targetPct: 50,
        driftPct: -2,
        exchange: 'binance',
      },
    ]
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 50 }, // Low threshold, should allow
      { asset: 'ETH', targetPct: 50, minTradeUsd: 300 }, // High threshold, should block
    ]
    const trades = calculateTrades(portfolio, targets)

    // BTC delta: $5000 - $5200 = -$200 (need to sell) > 50 ✓
    // ETH delta: $5000 - $4800 = $200 (need to buy) < 300 ✗
    // Only BTC trade should be generated
    expect(trades.length).toBe(1)
    expect(trades[0].pair).toBe('BTC/USDT')
    expect(trades[0].side).toBe('sell')
  })

  test('includes assets in targets but not yet in portfolio (pure buys)', () => {
    portfolio.assets = [
      {
        asset: 'BTC',
        amount: 0.5,
        valueUsd: 10000,
        currentPct: 100,
        targetPct: 50,
        driftPct: 50,
        exchange: 'binance',
      },
    ]
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]
    const trades = calculateTrades(portfolio, targets)

    // Should sell BTC and buy ETH (which is not yet held)
    expect(trades.length).toBe(2)
    const ethTrade = trades.find((t) => t.pair === 'ETH/USDT')
    expect(ethTrade).toBeDefined()
    expect(ethTrade?.side).toBe('buy')
    expect(ethTrade?.amount).toBe(5000) // 50% of $10000
  })

  test('ignores stablecoins (USDT, USDC, BUSD)', () => {
    portfolio.assets = [
      {
        asset: 'USDT',
        amount: 3000,
        valueUsd: 3000,
        currentPct: 30,
        targetPct: 0,
        driftPct: 30,
        exchange: 'binance',
      },
      {
        asset: 'BTC',
        amount: 0.35,
        valueUsd: 7000,
        currentPct: 70,
        targetPct: 100,
        driftPct: -30,
        exchange: 'binance',
      },
    ]
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 100, minTradeUsd: 10 },
    ]
    const trades = calculateTrades(portfolio, targets)

    // Should not generate a trade for USDT
    expect(trades.every((t) => !t.pair.includes('USDT') || t.pair === 'BTC/USDT')).toBe(true)
  })

  test('sorts trades by largest absolute drift first', () => {
    portfolio.assets = [
      {
        asset: 'BTC',
        amount: 0.1,
        valueUsd: 1000,
        currentPct: 10,
        targetPct: 50,
        driftPct: -40,
        exchange: 'binance',
      },
      {
        asset: 'ETH',
        amount: 10,
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
    ]
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]
    const trades = calculateTrades(portfolio, targets)

    // First trade should be for the largest drift (XRP sell $3500)
    expect(trades[0].pair).toBe('XRP/USDT')
    expect(trades[0].side).toBe('sell')
  })

  test('uses exchange from allocation config if provided', () => {
    portfolio.assets = [
      {
        asset: 'BTC',
        amount: 0.1,
        valueUsd: 10000,
        currentPct: 100,
        targetPct: 50,
        driftPct: 50,
        exchange: 'binance',
      },
    ]
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10, exchange: 'okx' },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10, exchange: 'bybit' },
    ]
    const trades = calculateTrades(portfolio, targets)

    const btcTrade = trades.find((t) => t.pair === 'BTC/USDT')
    expect(btcTrade?.exchange).toBe('okx')

    const ethTrade = trades.find((t) => t.pair === 'ETH/USDT')
    expect(ethTrade?.exchange).toBe('bybit')
  })

  test('uses asset exchange when allocation exchange not specified', () => {
    portfolio.assets = [
      {
        asset: 'BTC',
        amount: 0.1,
        valueUsd: 10000,
        currentPct: 100,
        targetPct: 50,
        driftPct: 50,
        exchange: 'okx',
      },
    ]
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 50, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 50, minTradeUsd: 10 },
    ]
    const trades = calculateTrades(portfolio, targets)

    const btcTrade = trades.find((t) => t.pair === 'BTC/USDT')
    expect(btcTrade?.exchange).toBe('okx')

    // ETH not in portfolio, should default to 'binance'
    const ethTrade = trades.find((t) => t.pair === 'ETH/USDT')
    expect(ethTrade?.exchange).toBe('binance')
  })

  test('handles edge case: asset in targets but with zero target percentage', () => {
    portfolio.assets = [
      {
        asset: 'BTC',
        amount: 1,
        valueUsd: 10000,
        currentPct: 100,
        targetPct: 100,
        driftPct: 0,
        exchange: 'binance',
      },
    ]
    const targets: Allocation[] = [
      { asset: 'ETH', targetPct: 0, minTradeUsd: 10 },
    ]
    const trades = calculateTrades(portfolio, targets)

    // ETH target is 0, so no buy order should be generated
    expect(trades.every((t) => !t.pair.includes('ETH'))).toBe(true)
  })

  test('complex rebalance scenario with multiple assets', () => {
    portfolio.assets = [
      {
        asset: 'BTC',
        amount: 0.25,
        valueUsd: 5000,
        currentPct: 50,
        targetPct: 30,
        driftPct: 20,
        exchange: 'binance',
      },
      {
        asset: 'ETH',
        amount: 25,
        valueUsd: 3000,
        currentPct: 30,
        targetPct: 40,
        driftPct: -10,
        exchange: 'binance',
      },
      {
        asset: 'XRP',
        amount: 10000,
        valueUsd: 2000,
        currentPct: 20,
        targetPct: 30,
        driftPct: -10,
        exchange: 'binance',
      },
    ]
    const targets: Allocation[] = [
      { asset: 'BTC', targetPct: 30, minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 40, minTradeUsd: 10 },
      { asset: 'XRP', targetPct: 30, minTradeUsd: 10 },
    ]
    const trades = calculateTrades(portfolio, targets)

    expect(trades.length).toBeGreaterThan(0)
    // BTC is overweight, should sell
    const btcTrade = trades.find((t) => t.pair === 'BTC/USDT')
    expect(btcTrade?.side).toBe('sell')
    // ETH and XRP are underweight, should buy
    const ethTrade = trades.find((t) => t.pair === 'ETH/USDT')
    expect(ethTrade?.side).toBe('buy')
    const xrpTrade = trades.find((t) => t.pair === 'XRP/USDT')
    expect(xrpTrade?.side).toBe('buy')
  })
})
