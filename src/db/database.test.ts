import { describe, test, expect, beforeEach } from 'bun:test'

// ─── Mock Database ────────────────────────────────────────────────────────

interface MockRow {
  [key: string]: unknown
}

class MockDatabase {
  private tables: Map<string, MockRow[]> = new Map()

  constructor() {
    this.tables.set('allocations', [])
    this.tables.set('snapshots', [])
    this.tables.set('trades', [])
    this.tables.set('rebalances', [])
  }

  select() {
    return {
      from: (tableName: string) => {
        return {
          where: (condition?: (row: MockRow) => boolean) => {
            const rows = this.tables.get(tableName) || []
            const filtered = condition ? rows.filter(condition) : rows
            return Promise.resolve([...filtered])
          },
          orderBy: (sorter?: (a: MockRow, b: MockRow) => number) => {
            const rows = this.tables.get(tableName) || []
            const sorted = [...rows]
            if (sorter) sorted.sort(sorter)
            return {
              limit: (n: number) => Promise.resolve(sorted.slice(0, n)),
            }
          },
          limit: (n: number) => Promise.resolve((this.tables.get(tableName) || []).slice(0, n)),
        } as any
      },
    } as any
  }

  insert(tableName: string) {
    return {
      values: (row: MockRow) => {
        const table = this.tables.get(tableName) || []
        table.push({ ...row, id: Math.random().toString() })
        this.tables.set(tableName, table)
        return Promise.resolve()
      },
    } as any
  }

  update(tableName: string) {
    return {
      set: (updates: MockRow) => {
        return {
          where: (condition?: (row: MockRow) => boolean) => {
            const table = this.tables.get(tableName) || []
            for (let i = 0; i < table.length; i++) {
              if (!condition || condition(table[i])) {
                table[i] = { ...table[i], ...updates }
              }
            }
            this.tables.set(tableName, table)
            return Promise.resolve()
          },
        }
      },
    } as any
  }

  // Helper for testing
  getTable(tableName: string): MockRow[] {
    return this.tables.get(tableName) || []
  }

  clearTable(tableName: string): void {
    this.tables.set(tableName, [])
  }

  clearAll(): void {
    for (const tableName of this.tables.keys()) {
      this.tables.set(tableName, [])
    }
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('Database', () => {
  let db: MockDatabase

  beforeEach(() => {
    db = new MockDatabase()
  })

  test('should initialize with empty tables', () => {
    expect(db.getTable('allocations').length).toBe(0)
    expect(db.getTable('snapshots').length).toBe(0)
  })

  test('should insert allocation record', async () => {
    await db.insert('allocations').values({
      asset: 'BTC',
      targetPct: 50,
      minTradeUsd: 10,
    })

    const allocations = db.getTable('allocations')
    expect(allocations.length).toBe(1)
    expect(allocations[0].asset).toBe('BTC')
  })

  test('should insert multiple allocations', async () => {
    await db.insert('allocations').values({
      asset: 'BTC',
      targetPct: 50,
      minTradeUsd: 10,
    })

    await db.insert('allocations').values({
      asset: 'ETH',
      targetPct: 50,
      minTradeUsd: 10,
    })

    const allocations = db.getTable('allocations')
    expect(allocations.length).toBe(2)
  })

  test('should insert snapshot record', async () => {
    await db.insert('snapshots').values({
      totalValueUsd: 10000,
      holdings: '{"BTC":{"amount":0.1,"valueUsd":5000}}',
      allocations: '{"BTC":{"currentPct":50,"targetPct":50}}',
    })

    const snapshots = db.getTable('snapshots')
    expect(snapshots.length).toBe(1)
    expect(snapshots[0].totalValueUsd).toBe(10000)
  })

  test('should insert trade record', async () => {
    await db.insert('trades').values({
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
      costUsd: 5000,
      fee: 5,
      feeCurrency: 'USDT',
      orderId: 'order123',
    })

    const trades = db.getTable('trades')
    expect(trades.length).toBe(1)
    expect(trades[0].pair).toBe('BTC/USDT')
  })

  test('should insert rebalance record', async () => {
    await db.insert('rebalances').values({
      id: 'rebalance-1',
      triggerType: 'threshold',
      status: 'executing',
      beforeState: '{}',
      totalTrades: 2,
      totalFeesUsd: 10,
    })

    const rebalances = db.getTable('rebalances')
    expect(rebalances.length).toBe(1)
    expect(rebalances[0].status).toBe('executing')
  })

  test('should query with select', async () => {
    await db.insert('allocations').values({
      asset: 'BTC',
      targetPct: 50,
      minTradeUsd: 10,
    })

    const rows = await db.select().from('allocations').where()

    expect(rows.length).toBe(1)
  })

  test('should update record', async () => {
    await db.insert('rebalances').values({
      id: 'rebalance-1',
      triggerType: 'threshold',
      status: 'executing',
      totalTrades: 2,
    })

    await db.update('rebalances').set({ status: 'completed' }).where()

    const rebalances = db.getTable('rebalances')
    expect(rebalances[0].status).toBe('completed')
  })

  test('should support updates', async () => {
    db.clearTable('rebalances')

    await db.insert('rebalances').values({
      id: 'rebalance-1',
      status: 'executing',
    })

    await db.update('rebalances')
      .set({ status: 'completed' })
      .where()

    const rebalances = db.getTable('rebalances')
    expect(rebalances.length).toBe(1)
    expect(rebalances[0].status).toBe('completed')
  })

  test('should handle JSON serialization for holdings', async () => {
    const holdings = { BTC: { amount: 0.1, valueUsd: 5000 } }

    await db.insert('snapshots').values({
      totalValueUsd: 10000,
      holdings: JSON.stringify(holdings),
      allocations: '{}',
    })

    const snapshots = db.getTable('snapshots')
    const parsed = JSON.parse(snapshots[0].holdings as string)

    expect(parsed.BTC.amount).toBe(0.1)
  })

  test('should handle JSON serialization for allocations', async () => {
    const allocations = {
      BTC: { currentPct: 50, targetPct: 50, driftPct: 0 },
    }

    await db.insert('snapshots').values({
      totalValueUsd: 10000,
      holdings: '{}',
      allocations: JSON.stringify(allocations),
    })

    const snapshots = db.getTable('snapshots')
    const parsed = JSON.parse(snapshots[0].allocations as string)

    expect(parsed.BTC.currentPct).toBe(50)
  })

  test('should clear table', () => {
    db.insert('allocations').values({ asset: 'BTC', targetPct: 50 })
    db.clearTable('allocations')

    expect(db.getTable('allocations').length).toBe(0)
  })

  test('should generate unique IDs for inserts', async () => {
    await db.insert('allocations').values({ asset: 'BTC', targetPct: 50 })
    await db.insert('allocations').values({ asset: 'ETH', targetPct: 50 })

    const allocations = db.getTable('allocations')
    expect(allocations[0].id).not.toBe(allocations[1].id)
  })

  test('should support numeric types', async () => {
    await db.insert('allocations').values({
      asset: 'BTC',
      targetPct: 50.5,
      minTradeUsd: 10,
    })

    const allocations = db.getTable('allocations')
    expect(allocations[0].targetPct).toBe(50.5)
    expect(allocations[0].minTradeUsd).toBe(10)
  })

  test('should support string types', async () => {
    await db.insert('trades').values({
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
      costUsd: 5000,
      fee: 5,
      feeCurrency: 'USDT',
      orderId: 'long-order-id-123',
    })

    const trades = db.getTable('trades')
    expect(trades[0].orderId).toBe('long-order-id-123')
  })

  test('should handle null/undefined values', async () => {
    await db.insert('allocations').values({
      asset: 'BTC',
      targetPct: 50,
      exchange: undefined,
    })

    const allocations = db.getTable('allocations')
    expect(allocations[0].asset).toBe('BTC')
  })

  test('should support ordering', async () => {
    await db.insert('snapshots').values({ totalValueUsd: 1000 })
    await db.insert('snapshots').values({ totalValueUsd: 2000 })
    await db.insert('snapshots').values({ totalValueUsd: 3000 })

    const snapshots = db.getTable('snapshots')
    const sorted = [...snapshots].sort(
      (a, b) => (b.totalValueUsd as number) - (a.totalValueUsd as number),
    )

    expect(sorted[0].totalValueUsd).toBe(3000)
  })

  test('should support limit queries', async () => {
    await db.insert('allocations').values({ asset: 'BTC', targetPct: 50 })
    await db.insert('allocations').values({ asset: 'ETH', targetPct: 50 })
    await db.insert('allocations').values({ asset: 'XRP', targetPct: 50 })

    const allocations = db.getTable('allocations')
    expect(allocations.length).toBeLessThanOrEqual(3)
  })
})
