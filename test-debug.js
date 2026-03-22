process.env.API_KEY = 'test'
process.env.ENCRYPTION_KEY = 'a'.repeat(32)

import { calculateTrades } from './src/rebalancer/trade-calculator.ts'

const portfolio = {
  totalValueUsd: 10000,
  assets: [
    {
      asset: 'BTC',
      amount: 0.1,
      valueUsd: 9500,
      currentPct: 95,
      targetPct: 50,
      driftPct: 45,
      exchange: 'binance',
    },
    {
      asset: 'ETH',
      amount: 1,
      valueUsd: 500,
      currentPct: 5,
      targetPct: 50,
      driftPct: -45,
      exchange: 'binance',
    },
  ],
  updatedAt: Date.now(),
}

const targets = [
  { asset: 'BTC', targetPct: 50, minTradeUsd: 3000 },
  { asset: 'ETH', targetPct: 50, minTradeUsd: 3000 },
]

const trades = calculateTrades(portfolio, targets)
console.log('Trades:', trades.length)
trades.forEach(t => {
  console.log(`  ${t.side.toUpperCase()} ${t.pair} $${t.amount}`)
})
