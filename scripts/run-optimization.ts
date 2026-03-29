/**
 * CLI script: grid-search strategy optimizer
 * Runs all strategy parameter combinations against historical data and prints ranked results.
 *
 * Usage: bun run scripts/run-optimization.ts [--strategy threshold,mean-reversion] [--top 20]
 */
import { connectDB } from '../src/db/connection'
import { strategyOptimizer } from '../src/backtesting/strategy-optimizer'
import type { StrategyType } from '../src/rebalancer/strategies/strategy-config-types'

// ─── Config ───────────────────────────────────────────────────────────────────

const PAIRS = ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'BNB/USDT']
const ALLOCATIONS = [
  { asset: 'BTC', targetPct: 40 },
  { asset: 'ETH', targetPct: 30 },
  { asset: 'SOL', targetPct: 15 },
  { asset: 'BNB', targetPct: 15 },
]
const INITIAL_BALANCE = 100_000
const FEE_PCT = 0.001
const YEARS = 5

// ─── Parse CLI args ───────────────────────────────────────────────────────────

function parseArgs(): { strategyTypes?: StrategyType[]; topN: number } {
  const args = process.argv.slice(2)
  let strategyTypes: StrategyType[] | undefined
  let topN = 20

  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--strategy' && args[i + 1]) {
      strategyTypes = args[i + 1]!.split(',') as StrategyType[]
      i++
    }
    if (args[i] === '--top' && args[i + 1]) {
      topN = parseInt(args[i + 1]!, 10)
      i++
    }
  }

  return { strategyTypes, topN }
}

// ─── Format helpers ───────────────────────────────────────────────────────────

function pad(s: string, len: number): string {
  return s.length >= len ? s.slice(0, len) : s + ' '.repeat(len - s.length)
}

function fmt(n: number, decimals = 2): string {
  return n.toFixed(decimals)
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const { strategyTypes, topN } = parseArgs()

  console.log('\n=== Strategy Optimizer ===')
  console.log(`Pairs: ${PAIRS.join(', ')}`)
  console.log(`Period: last ${YEARS} years | Balance: $${INITIAL_BALANCE.toLocaleString()} | Fee: ${FEE_PCT * 100}%`)
  if (strategyTypes) console.log(`Filtering: ${strategyTypes.join(', ')}`)
  console.log('')

  await connectDB()

  const now = Date.now()
  const startDate = now - YEARS * 365 * 24 * 60 * 60 * 1000

  const result = await strategyOptimizer.optimize(
    {
      exchange: 'binance',
      pairs: PAIRS,
      timeframe: '1d',
      startDate,
      endDate: now,
      initialBalance: INITIAL_BALANCE,
      allocations: ALLOCATIONS as import('../src/types/index').Allocation[],
      feePct: FEE_PCT,
      strategyTypes,
      topN,
    },
    (completed, total) => {
      process.stdout.write(`\rProgress: ${completed}/${total}`)
    },
  )

  console.log(`\n\nCompleted in ${(result.elapsedMs / 1000).toFixed(1)}s`)
  console.log(`Ran: ${result.ranCombinations} | Skipped: ${result.skippedCombinations} | Total grid: ${result.totalCombinations}`)
  console.log(`Best strategy: ${result.bestStrategy}\n`)

  // Print table header
  const header = `${pad('Rank', 5)} ${pad('Label', 30)} ${pad('Return%', 9)} ${pad('Sharpe', 8)} ${pad('MaxDD%', 8)} ${pad('Trades', 8)} ${pad('Score', 8)}`
  console.log(header)
  console.log('-'.repeat(header.length))

  for (const r of result.results) {
    console.log(
      `${pad(String(r.rank), 5)} ${pad(r.label, 30)} ${pad(fmt(r.totalReturn), 9)} ${pad(fmt(r.sharpeRatio), 8)} ${pad(fmt(r.maxDrawdown), 8)} ${pad(String(r.totalTrades), 8)} ${pad(fmt(r.compositeScore, 4), 8)}`,
    )
  }

  console.log('')
  process.exit(0)
}

main().catch((err) => {
  console.error('Optimization failed:', err)
  process.exit(1)
})
