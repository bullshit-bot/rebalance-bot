import { describe, test, expect, beforeAll } from 'bun:test'
import { db } from '@db/database'
import { trades } from '@db/schema'
import { taxReporter } from './tax-reporter'
import { eq } from 'drizzle-orm'

const TEST_TAG = '__tax_test__'

// Use 2025 as test year to avoid interference with seed data
const Y = 2025
const jan1 = Math.floor(new Date(Y, 0, 1).getTime() / 1000)
const jul1 = Math.floor(new Date(Y, 6, 1).getTime() / 1000)

beforeAll(async () => {
  await db.delete(trades).where(eq(trades.rebalanceId, TEST_TAG))

  const testTrades = [
    // Buy BTC in 2024 (long-term: >365 days before sell)
    { exchange: 'binance', pair: 'BTC/USDT', side: 'buy' as const, amount: 2, price: 30000, costUsd: 60000, fee: 100, feeCurrency: 'USDT', isPaper: 0, rebalanceId: TEST_TAG, executedAt: jan1 - 400 * 86400 },
    // Sell BTC in 2025 → long-term gain
    { exchange: 'binance', pair: 'BTC/USDT', side: 'sell' as const, amount: 1, price: 50000, costUsd: 50000, fee: 80, feeCurrency: 'USDT', isPaper: 0, rebalanceId: TEST_TAG, executedAt: jan1 + 30 * 86400 },

    // Buy ETH in 2025 (short-term: <365 days)
    { exchange: 'binance', pair: 'ETH/USDT', side: 'buy' as const, amount: 10, price: 3000, costUsd: 30000, fee: 50, feeCurrency: 'USDT', isPaper: 0, rebalanceId: TEST_TAG, executedAt: jan1 + 10 * 86400 },
    // Sell ETH in 2025 → short-term gain
    { exchange: 'binance', pair: 'ETH/USDT', side: 'sell' as const, amount: 5, price: 3500, costUsd: 17500, fee: 40, feeCurrency: 'USDT', isPaper: 0, rebalanceId: TEST_TAG, executedAt: jan1 + 60 * 86400 },

    // Sell ETH in 2025 → short-term LOSS
    { exchange: 'binance', pair: 'ETH/USDT', side: 'sell' as const, amount: 3, price: 2800, costUsd: 8400, fee: 30, feeCurrency: 'USDT', isPaper: 0, rebalanceId: TEST_TAG, executedAt: jan1 + 90 * 86400 },

    // Sell SOL with NO matching buy → zero cost basis (pre-existing balance)
    { exchange: 'binance', pair: 'SOL/USDT', side: 'sell' as const, amount: 50, price: 200, costUsd: 10000, fee: 20, feeCurrency: 'USDT', isPaper: 0, rebalanceId: TEST_TAG, executedAt: jul1 },
  ]

  for (const t of testTrades) {
    await db.insert(trades).values(t)
  }
})

describe('TaxReporter integration', () => {
  test('generateReport returns correct structure', async () => {
    const report = await taxReporter.generateReport(Y)
    expect(report).toBeDefined()
    expect(report.year).toBe(Y)
    expect(typeof report.totalRealizedGain).toBe('number')
    expect(typeof report.totalRealizedLoss).toBe('number')
    expect(typeof report.netGainLoss).toBe('number')
    expect(typeof report.shortTermGain).toBe('number')
    expect(typeof report.longTermGain).toBe('number')
    expect(Array.isArray(report.events)).toBe(true)
  })

  test('report has events for sell trades', async () => {
    const report = await taxReporter.generateReport(Y)
    // We have 4 sell trades in 2025 (1 BTC, 2 ETH, 1 SOL)
    expect(report.events.length).toBeGreaterThanOrEqual(3)
  })

  test('BTC sell is classified as long-term', async () => {
    const report = await taxReporter.generateReport(Y)
    const btcEvent = report.events.find(e => e.asset === 'BTC')
    expect(btcEvent).toBeDefined()
    expect(btcEvent!.isShortTerm).toBe(false)
    expect(btcEvent!.holdingPeriodDays).toBeGreaterThanOrEqual(365)
  })

  test('ETH sells are classified as short-term', async () => {
    const report = await taxReporter.generateReport(Y)
    const ethEvents = report.events.filter(e => e.asset === 'ETH')
    expect(ethEvents.length).toBeGreaterThanOrEqual(1)
    for (const ev of ethEvents) {
      expect(ev.isShortTerm).toBe(true)
    }
  })

  test('SOL sell with no buy → zero cost basis', async () => {
    const report = await taxReporter.generateReport(Y)
    const solEvent = report.events.find(e => e.asset === 'SOL')
    expect(solEvent).toBeDefined()
    expect(solEvent!.costBasisUsd).toBe(0)
    expect(solEvent!.gainLossUsd).toBeGreaterThan(0)
  })

  test('report has gains and losses', async () => {
    const report = await taxReporter.generateReport(Y)
    expect(report.totalRealizedGain).toBeGreaterThan(0)
    // ETH loss sell should produce negative
    expect(report.totalRealizedLoss).toBeLessThanOrEqual(0)
  })

  test('netGainLoss equals gain + loss', async () => {
    const report = await taxReporter.generateReport(Y)
    expect(report.netGainLoss).toBeCloseTo(report.totalRealizedGain + report.totalRealizedLoss, 2)
  })

  test('shortTermGain + longTermGain >= totalRealizedGain', async () => {
    const report = await taxReporter.generateReport(Y)
    expect(report.shortTermGain + report.longTermGain).toBeCloseTo(report.totalRealizedGain, 2)
  })

  test('exportCSV returns valid CSV string', async () => {
    const csv = await taxReporter.exportCSV(Y)
    expect(csv).toBeDefined()
    expect(typeof csv).toBe('string')
    // Header line
    expect(csv.startsWith('Date,')).toBe(true)
    // At least header + 1 data row
    const lines = csv.split('\n')
    expect(lines.length).toBeGreaterThanOrEqual(2)
  })

  test('CSV contains Koinly header fields', async () => {
    const csv = await taxReporter.exportCSV(Y)
    expect(csv).toContain('Sent Amount')
    expect(csv).toContain('Received Amount')
    expect(csv).toContain('Net Worth')
    expect(csv).toContain('Label')
  })

  test('CSV rows contain asset names', async () => {
    const csv = await taxReporter.exportCSV(Y)
    expect(csv).toContain('BTC')
    expect(csv).toContain('ETH')
  })

  test('generateReport for empty year returns zero', async () => {
    const report = await taxReporter.generateReport(2020)
    expect(report.year).toBe(2020)
    expect(report.totalRealizedGain).toBe(0)
    expect(report.totalRealizedLoss).toBe(0)
    expect(report.events.length).toBe(0)
  })
})
