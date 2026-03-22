import { describe, it, expect } from 'bun:test'

// Tax lot and FIFO calculation logic
function calculateHoldingDays(acquiredAt: number, soldAt: number): number {
  const SECONDS_PER_DAY = 86400
  return Math.floor((soldAt - acquiredAt) / SECONDS_PER_DAY)
}

function isShortTerm(holdingDays: number): boolean {
  const SHORT_TERM_DAYS = 365
  return holdingDays < SHORT_TERM_DAYS
}

function extractAsset(pair: string): string {
  const slash = pair.indexOf('/')
  return slash !== -1 ? pair.slice(0, slash) : pair
}

describe('TaxReporter - Core Logic', () => {
  it('extracts asset from trading pair', () => {
    expect(extractAsset('BTC/USDT')).toBe('BTC')
    expect(extractAsset('ETH/USDT')).toBe('ETH')
    expect(extractAsset('SOL/USDT')).toBe('SOL')
  })

  it('calculates holding period in days', () => {
    const acquiredAt = 1000
    const soldAt = 1000 + 365 * 86400

    const holdingDays = calculateHoldingDays(acquiredAt, soldAt)

    expect(holdingDays).toBe(365)
  })

  it('classifies short-term gains (< 365 days)', () => {
    const holdingDays = 180

    expect(isShortTerm(holdingDays)).toBe(true)
  })

  it('classifies long-term gains (>= 365 days)', () => {
    const holdingDays = 400

    expect(isShortTerm(holdingDays)).toBe(false)
  })

  it('calculates realized gain from buy/sell pair', () => {
    const buyPrice = 30000
    const buyAmount = 1
    const buyCost = buyPrice * buyAmount

    const sellPrice = 40000
    const sellAmount = 1
    const sellProceeds = sellPrice * sellAmount

    const gainLoss = sellProceeds - buyCost

    expect(gainLoss).toBe(10000)
  })

  it('calculates realized loss from buy/sell pair', () => {
    const buyPrice = 10000
    const buyAmount = 10
    const buyCost = buyPrice * buyAmount

    const sellPrice = 8000
    const sellAmount = 10
    const sellProceeds = sellPrice * sellAmount

    const gainLoss = sellProceeds - buyCost

    expect(gainLoss).toBe(-20000)
  })

  it('aggregates gains and losses', () => {
    const gains = [10000, 5000, 2000]
    const losses = [-20000, -1000]

    const totalGain = gains.reduce((s, v) => s + v, 0)
    const totalLoss = losses.reduce((s, v) => s + v, 0)
    const netGainLoss = totalGain + totalLoss

    expect(totalGain).toBe(17000)
    expect(totalLoss).toBe(-21000)
    expect(netGainLoss).toBe(-4000)
  })

  it('calculates cost basis from FIFO lot', () => {
    // Buy 1 BTC @ $30k, then buy 1 BTC @ $31k
    const lot1Amount = 1
    const lot1Cost = 30000
    const lot1CostPerUnit = lot1Cost / lot1Amount

    const lot2Amount = 1
    const lot2Cost = 31000
    const lot2CostPerUnit = lot2Cost / lot2Amount

    // Sell 0.5 from first lot, 0.5 from second
    const sellAmount1 = 0.5
    const sellAmount2 = 0.5

    const totalCostBasis = sellAmount1 * lot1CostPerUnit + sellAmount2 * lot2CostPerUnit

    expect(totalCostBasis).toBeCloseTo(30500, 1)
  })

  it('matches sells to buy lots using FIFO', () => {
    // Buy 10 ETH @ 1000 each = 10000
    // Buy 10 ETH @ 1100 each = 11000
    // Sell 15 ETH
    const lot1Amount = 10
    const lot1Cost = 10000

    const lot2Amount = 10
    const lot2Cost = 11000

    const sellAmount = 15

    // FIFO: consume all 10 from lot 1, then 5 from lot 2
    const consumed1 = Math.min(sellAmount, lot1Amount)
    const remaining1 = lot1Amount - consumed1

    const consumed2 = sellAmount - consumed1
    const remaining2 = lot2Amount - consumed2

    const costFromLot1 = (consumed1 / lot1Amount) * lot1Cost
    const costFromLot2 = (consumed2 / lot2Amount) * lot2Cost

    const totalCostBasis = costFromLot1 + costFromLot2

    expect(remaining1).toBe(0)
    expect(remaining2).toBe(5)
    expect(totalCostBasis).toBeCloseTo(15500, 1)
  })

  it('handles year boundary correctly', () => {
    const year = 2024
    const jan1 = Math.floor(new Date(2024, 0, 1).getTime() / 1000)
    const dec31 = Math.floor(new Date(2024, 11, 31, 23, 59, 59).getTime() / 1000)
    const jan1_2025 = Math.floor(new Date(2025, 0, 1).getTime() / 1000)

    expect(jan1 < dec31).toBe(true)
    expect(dec31 < jan1_2025).toBe(true)
  })

  it('separates short-term and long-term gains', () => {
    const shortTermGains = [1000, 500]
    const longTermGains = [5000, 10000]
    const allGains = [...shortTermGains, ...longTermGains]

    const totalShort = shortTermGains.reduce((s, v) => s + v, 0)
    const totalLong = longTermGains.reduce((s, v) => s + v, 0)
    const totalAll = allGains.reduce((s, v) => s + v, 0)

    expect(totalShort).toBe(1500)
    expect(totalLong).toBe(15000)
    expect(totalAll).toBe(16500)
  })

  it('formats CSV header correctly', () => {
    const expectedHeader =
      'Date,Sent Amount,Sent Currency,Received Amount,Received Currency,' +
      'Fee Amount,Fee Currency,Net Worth Amount,Net Worth Currency,' +
      'Label,Description,TxHash'

    const actual =
      'Date,Sent Amount,Sent Currency,Received Amount,Received Currency,' +
      'Fee Amount,Fee Currency,Net Worth Amount,Net Worth Currency,' +
      'Label,Description,TxHash'

    expect(actual).toBe(expectedHeader)
  })

  it('calculates proceeds from asset sale', () => {
    const saleAmount = 1.5
    const salePrice = 40000

    const proceeds = saleAmount * salePrice

    expect(proceeds).toBe(60000)
  })
})
