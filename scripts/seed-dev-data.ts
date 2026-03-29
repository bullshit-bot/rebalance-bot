/**
 * Seed script: inserts demo data into MongoDB for local development.
 * Run: bun run scripts/seed-dev-data.ts
 */
import { connectDB, disconnectDB } from '../src/db/connection'
import {
  AllocationModel,
  SnapshotModel,
  TradeModel,
  RebalanceModel,
  AISuggestionModel,
  StrategyConfigModel,
} from '../src/db/models'

async function run() {
  await connectDB()
  console.log('Connected to MongoDB')

  // Clear existing seed data (idempotent)
  await Promise.all([
    AllocationModel.deleteMany({}),
    SnapshotModel.deleteMany({}),
    TradeModel.deleteMany({}),
    RebalanceModel.deleteMany({}),
    AISuggestionModel.deleteMany({}),
    StrategyConfigModel.deleteMany({}),
  ])
  console.log('Cleared existing collections')

  // ── Seed optimal strategy config (backtest-validated) ──────────────────────
  await StrategyConfigModel.create({
    name: 'optimal-backtest-validated',
    displayName: 'Optimal (Backtest Validated)',
    isActive: true,
    version: 1,
    params: {
      type: 'threshold',
      thresholdPct: 5,
      minTradeUsd: 10,
    },
    globalSettings: {
      baseAsset: 'USDT',
      cashReservePct: 0,
      dcaRebalanceEnabled: true,
      hardRebalanceThreshold: 15,
      trendFilterEnabled: true,
      trendFilterMA: 100,
      bearCashPct: 90,
      trendFilterCooldownDays: 3,
      trendFilterBuffer: 2,
      autoExecute: false,
      cooldownHours: 4,
      dynamicThreshold: true,
      trendAware: false,
      feeAware: true,
      maxDailyVolume: 50000,
      partialFactor: 0.75,
    },
    history: [],
  })
  console.log('Seeded optimal strategy config (backtest-validated)')

  // ── Seed allocations (optimal: BTC 40/ETH 25/BNB 15/SOL 20) ───────────────
  const allocs = [
    { asset: 'BTC', targetPct: 40, exchange: 'binance' },
    { asset: 'ETH', targetPct: 25, exchange: 'binance' },
    { asset: 'BNB', targetPct: 15, exchange: 'binance' },
    { asset: 'SOL', targetPct: 20, exchange: 'binance' },
  ]
  await AllocationModel.insertMany(allocs.map(a => ({
    asset: a.asset,
    targetPct: a.targetPct,
    exchange: a.exchange,
    minTradeUsd: 10,
  })))
  console.log(`Seeded ${allocs.length} allocations`)

  // ── Seed portfolio snapshots (7 days) ───────────────────────────────────────
  const now = Date.now()
  const values = [141200, 143800, 142100, 145600, 144300, 146100, 145491, 147832]
  const snapshots = values.map((val, i) => ({
    totalValueUsd: val,
    holdings: {
      BTC: { amount: 0.842, valueUsd: val * 0.389 },
      ETH: { amount: 8.15, valueUsd: val * 0.212 },
      SOL: { amount: 142, valueUsd: val * 0.18 },
      USDT: { amount: 12450, valueUsd: val * 0.084 },
      AVAX: { amount: 285, valueUsd: val * 0.074 },
      LINK: { amount: 520, valueUsd: val * 0.06 },
    },
    allocations: allocs.map(a => ({ asset: a.asset, targetPct: a.targetPct })),
    createdAt: new Date(now - (7 - i) * 86400_000),
  }))
  await SnapshotModel.insertMany(snapshots)
  console.log(`Seeded ${snapshots.length} snapshots`)

  // ── Seed trades (last 7 days) ───────────────────────────────────────────────
  const seedTrades = [
    { pair: 'BTC/USDT', side: 'sell' as const, amount: 0.034, price: 68420, fee: 2.33, days: 0 },
    { pair: 'ETH/USDT', side: 'buy' as const, amount: 0.82, price: 3842, fee: 3.15, days: 0 },
    { pair: 'SOL/USDT', side: 'sell' as const, amount: 12.5, price: 187.5, fee: 2.34, days: 0 },
    { pair: 'AVAX/USDT', side: 'buy' as const, amount: 14.2, price: 38.75, fee: 0.55, days: 1 },
    { pair: 'LINK/USDT', side: 'buy' as const, amount: 45, price: 17.12, fee: 0.77, days: 1 },
    { pair: 'ETH/USDT', side: 'buy' as const, amount: 0.5, price: 3810, fee: 1.91, days: 1 },
    { pair: 'BTC/USDT', side: 'sell' as const, amount: 0.012, price: 67890, fee: 0.81, days: 2 },
    { pair: 'SOL/USDT', side: 'sell' as const, amount: 8, price: 185.2, fee: 1.48, days: 2 },
    { pair: 'BTC/USDT', side: 'buy' as const, amount: 0.05, price: 66800, fee: 3.34, days: 3 },
    { pair: 'ETH/USDT', side: 'sell' as const, amount: 1.2, price: 3720, fee: 4.46, days: 4 },
    { pair: 'SOL/USDT', side: 'buy' as const, amount: 20, price: 180, fee: 3.6, days: 5 },
    { pair: 'BTC/USDT', side: 'sell' as const, amount: 0.03, price: 65200, fee: 1.96, days: 6 },
  ]
  const tradeDocs = seedTrades.map(t => ({
    exchange: 'binance',
    pair: t.pair,
    side: t.side,
    amount: t.amount,
    price: t.price,
    costUsd: t.amount * t.price,
    fee: t.fee,
    feeCurrency: 'USDT',
    isPaper: true,
    rebalanceId: t.days <= 1 ? 'rb-001' : null,
    executedAt: new Date(now - t.days * 86400_000 - Math.floor(Math.random() * 3600_000)),
  }))
  await TradeModel.insertMany(tradeDocs)
  console.log(`Seeded ${tradeDocs.length} trades`)

  // ── Seed rebalance record ───────────────────────────────────────────────────
  await RebalanceModel.create({
    _id: 'rb-001',
    triggerType: 'manual',
    status: 'completed',
    beforeState: {},
    afterState: {},
    totalTrades: 3,
    totalFeesUsd: 7.82,
    startedAt: new Date(now - 3600_000),
    completedAt: new Date(now - 3590_000),
  })
  console.log('Seeded 1 rebalance record')

  // ── Seed AI suggestions ────────────────────────────────────────────────────
  const suggestions = [
    { _id: 'ai-01', suggestedAllocations: [{ asset: 'BTC', targetPct: 33 }, { asset: 'ETH', targetPct: 27 }], reasoning: 'BTC momentum turning bearish on 4h. ETH showing accumulation pattern. Shift 2% from BTC to ETH.', status: 'pending', agoMs: 3600_000 },
    { _id: 'ai-02', suggestedAllocations: [{ asset: 'SOL', targetPct: 13 }, { asset: 'USDT', targetPct: 12 }], reasoning: 'SOL RSI at 78, overbought. Reduce SOL exposure by 2%.', status: 'pending', agoMs: 7200_000 },
    { _id: 'ai-03', suggestedAllocations: [{ asset: 'BTC', targetPct: 37 }, { asset: 'AVAX', targetPct: 6 }], reasoning: 'Strong BTC dominance signal. Rotating alts to BTC.', status: 'approved', agoMs: 86400_000 },
  ]
  await AISuggestionModel.insertMany(suggestions.map(s => ({
    _id: s._id,
    source: 'goclaw',
    suggestedAllocations: s.suggestedAllocations,
    reasoning: s.reasoning,
    status: s.status,
    createdAt: new Date(now - s.agoMs),
  })))
  console.log(`Seeded ${suggestions.length} AI suggestions`)

  await disconnectDB()
  console.log('Seed complete!')
  process.exit(0)
}

run().catch((e) => { console.error(e); process.exit(1) })
