import { describe, it, expect } from 'bun:test'
import {
  allocations,
  snapshots,
  trades,
  rebalances,
  exchangeConfigs,
  ohlcvCandles,
  backtestResults,
  smartOrders,
  gridBots,
  gridOrders,
  aiSuggestions,
  copySources,
  copySyncLog,
  type Allocation,
  type NewAllocation,
  type Snapshot,
  type NewSnapshot,
  type Trade,
  type NewTrade,
  type Rebalance,
  type NewRebalance,
  type ExchangeConfig,
  type NewExchangeConfig,
  type OhlcvCandle,
  type NewOhlcvCandle,
  type BacktestResult,
  type NewBacktestResult,
  type SmartOrder,
  type NewSmartOrder,
  type GridBot,
  type NewGridBot,
  type GridOrder,
  type NewGridOrder,
  type AISuggestion,
  type NewAISuggestion,
  type CopySource,
  type NewCopySource,
  type CopySyncLog,
  type NewCopySyncLog,
} from './schema'

describe('Database Schema', () => {
  describe('Core tables export', () => {
    it('should export allocations table', () => {
      expect(allocations).toBeDefined()
      expect(allocations).not.toBeNull()
    })

    it('should export snapshots table', () => {
      expect(snapshots).toBeDefined()
      expect(snapshots).not.toBeNull()
    })

    it('should export trades table', () => {
      expect(trades).toBeDefined()
      expect(trades).not.toBeNull()
    })

    it('should export rebalances table', () => {
      expect(rebalances).toBeDefined()
      expect(rebalances).not.toBeNull()
    })

    it('should export exchangeConfigs table', () => {
      expect(exchangeConfigs).toBeDefined()
      expect(exchangeConfigs).not.toBeNull()
    })
  })

  describe('Backtesting tables export', () => {
    it('should export ohlcvCandles table', () => {
      expect(ohlcvCandles).toBeDefined()
      expect(ohlcvCandles).not.toBeNull()
    })

    it('should export backtestResults table', () => {
      expect(backtestResults).toBeDefined()
      expect(backtestResults).not.toBeNull()
    })
  })

  describe('Smart order tables export', () => {
    it('should export smartOrders table', () => {
      expect(smartOrders).toBeDefined()
      expect(smartOrders).not.toBeNull()
    })
  })

  describe('Grid bot tables export', () => {
    it('should export gridBots table', () => {
      expect(gridBots).toBeDefined()
      expect(gridBots).not.toBeNull()
    })

    it('should export gridOrders table', () => {
      expect(gridOrders).toBeDefined()
      expect(gridOrders).not.toBeNull()
    })
  })

  describe('AI tables export', () => {
    it('should export aiSuggestions table', () => {
      expect(aiSuggestions).toBeDefined()
      expect(aiSuggestions).not.toBeNull()
    })
  })

  describe('Copy trading tables export', () => {
    it('should export copySources table', () => {
      expect(copySources).toBeDefined()
      expect(copySources).not.toBeNull()
    })

    it('should export copySyncLog table', () => {
      expect(copySyncLog).toBeDefined()
      expect(copySyncLog).not.toBeNull()
    })
  })

  describe('Type exports - core tables', () => {
    it('should export Allocation and NewAllocation types', () => {
      const allocation: Allocation | undefined = undefined
      const newAllocation: NewAllocation | undefined = undefined
      expect(allocation).toBeUndefined()
      expect(newAllocation).toBeUndefined()
    })

    it('should export Snapshot and NewSnapshot types', () => {
      const snapshot: Snapshot | undefined = undefined
      const newSnapshot: NewSnapshot | undefined = undefined
      expect(snapshot).toBeUndefined()
      expect(newSnapshot).toBeUndefined()
    })

    it('should export Trade and NewTrade types', () => {
      const trade: Trade | undefined = undefined
      const newTrade: NewTrade | undefined = undefined
      expect(trade).toBeUndefined()
      expect(newTrade).toBeUndefined()
    })

    it('should export Rebalance and NewRebalance types', () => {
      const rebalance: Rebalance | undefined = undefined
      const newRebalance: NewRebalance | undefined = undefined
      expect(rebalance).toBeUndefined()
      expect(newRebalance).toBeUndefined()
    })

    it('should export ExchangeConfig and NewExchangeConfig types', () => {
      const config: ExchangeConfig | undefined = undefined
      const newConfig: NewExchangeConfig | undefined = undefined
      expect(config).toBeUndefined()
      expect(newConfig).toBeUndefined()
    })
  })

  describe('Type exports - backtesting tables', () => {
    it('should export OhlcvCandle and NewOhlcvCandle types', () => {
      const candle: OhlcvCandle | undefined = undefined
      const newCandle: NewOhlcvCandle | undefined = undefined
      expect(candle).toBeUndefined()
      expect(newCandle).toBeUndefined()
    })

    it('should export BacktestResult and NewBacktestResult types', () => {
      const result: BacktestResult | undefined = undefined
      const newResult: NewBacktestResult | undefined = undefined
      expect(result).toBeUndefined()
      expect(newResult).toBeUndefined()
    })
  })

  describe('Type exports - smart orders', () => {
    it('should export SmartOrder and NewSmartOrder types', () => {
      const order: SmartOrder | undefined = undefined
      const newOrder: NewSmartOrder | undefined = undefined
      expect(order).toBeUndefined()
      expect(newOrder).toBeUndefined()
    })
  })

  describe('Type exports - grid bots', () => {
    it('should export GridBot and NewGridBot types', () => {
      const bot: GridBot | undefined = undefined
      const newBot: NewGridBot | undefined = undefined
      expect(bot).toBeUndefined()
      expect(newBot).toBeUndefined()
    })

    it('should export GridOrder and NewGridOrder types', () => {
      const order: GridOrder | undefined = undefined
      const newOrder: NewGridOrder | undefined = undefined
      expect(order).toBeUndefined()
      expect(newOrder).toBeUndefined()
    })
  })

  describe('Type exports - AI tables', () => {
    it('should export AISuggestion and NewAISuggestion types', () => {
      const suggestion: AISuggestion | undefined = undefined
      const newSuggestion: NewAISuggestion | undefined = undefined
      expect(suggestion).toBeUndefined()
      expect(newSuggestion).toBeUndefined()
    })
  })

  describe('Type exports - copy trading', () => {
    it('should export CopySource and NewCopySource types', () => {
      const source: CopySource | undefined = undefined
      const newSource: NewCopySource | undefined = undefined
      expect(source).toBeUndefined()
      expect(newSource).toBeUndefined()
    })

    it('should export CopySyncLog and NewCopySyncLog types', () => {
      const log: CopySyncLog | undefined = undefined
      const newLog: NewCopySyncLog | undefined = undefined
      expect(log).toBeUndefined()
      expect(newLog).toBeUndefined()
    })
  })

  describe('Schema integrity', () => {
    it('should have all 13 tables defined', () => {
      const tables = [
        allocations,
        snapshots,
        trades,
        rebalances,
        exchangeConfigs,
        ohlcvCandles,
        backtestResults,
        smartOrders,
        gridBots,
        gridOrders,
        aiSuggestions,
        copySources,
        copySyncLog,
      ]
      tables.forEach((table) => {
        expect(table).toBeDefined()
        expect(table).not.toBeNull()
      })
    })

    it('should be Drizzle ORM table instances', () => {
      // All should be object instances (Drizzle SQLiteTable)
      expect(typeof allocations).toBe('object')
      expect(typeof snapshots).toBe('object')
      expect(typeof trades).toBe('object')
      expect(typeof rebalances).toBe('object')
    })
  })

  describe('Type safety validation', () => {
    it('should allow type assignments for select models', () => {
      const testAllocation: Allocation = {
        id: 1,
        asset: 'BTC',
        targetPct: 50,
        exchange: null,
        minTradeUsd: 10,
        updatedAt: null,
      }
      expect(testAllocation.asset).toBe('BTC')
    })

    it('should allow type assignments for insert models', () => {
      const testTrade: NewTrade = {
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        amount: 0.5,
        price: 50000,
        costUsd: 25000,
      }
      expect(testTrade.side).toBe('buy')
    })
  })
})
