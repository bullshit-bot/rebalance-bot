// Shared TypeScript types matching backend API response shapes
// All timestamps are Unix epoch seconds unless noted otherwise

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface PortfolioAsset {
  asset: string
  amount: number
  valueUsd: number
  currentPct: number
  targetPct: number
  driftPct: number
  exchange: 'binance' | 'okx' | 'bybit'
}

export interface Portfolio {
  totalValueUsd: number
  assets: PortfolioAsset[]
  updatedAt: number // Unix epoch ms
}

export interface Snapshot {
  id: number
  totalValueUsd: number
  holdings: string // JSON-stringified
  allocations: string // JSON-stringified
  createdAt: number
}

// ─── Trades ───────────────────────────────────────────────────────────────────

export interface Trade {
  id: number
  exchange: string
  pair: string
  side: 'buy' | 'sell'
  amount: number
  price: number
  costUsd: number
  fee: number | null
  feeCurrency: string | null
  orderId: string | null
  rebalanceId: string | null
  executedAt: number
}

// ─── Rebalance ────────────────────────────────────────────────────────────────

export interface TradeOrder {
  exchange: 'binance' | 'okx' | 'bybit'
  pair: string
  side: 'buy' | 'sell'
  type: 'limit' | 'market'
  amount: number
  price?: number
}

export interface RebalancePreview {
  trades: TradeOrder[]
  portfolio: Portfolio
}

export interface RebalanceEvent {
  id: string
  trigger: string
  status: string
  createdAt: number
}

// ─── Config / Allocations ─────────────────────────────────────────────────────

export interface Allocation {
  id: number
  asset: string
  targetPct: number
  exchange: string | null
  minTradeUsd: number | null
  updatedAt: number
}

export interface AllocationInput {
  asset: string
  targetPct: number
  exchange?: string
  minTradeUsd?: number
}

// ─── Health ───────────────────────────────────────────────────────────────────

export interface TrendStatus {
  enabled: boolean
  bullish: boolean
  ma: number | null
  price: number
  dataPoints: number
}

export interface HealthResponse {
  status: 'ok'
  uptimeSeconds: number
  exchanges: Record<string, 'connected' | 'disconnected'>
  trendStatus?: TrendStatus
}

// ─── Backtesting ──────────────────────────────────────────────────────────────

export interface BacktestConfig {
  pairs: string[]
  allocations: AllocationInput[]
  startDate: number
  endDate: number
  initialBalance: number
  threshold: number
  feePct: number
  timeframe: '1h' | '1d'
  exchange: string
}

export interface BacktestResult {
  id: string
  createdAt: number
  config: BacktestConfig
  metrics: Record<string, unknown>
  trades: unknown[]
  benchmark: unknown
}

// ─── Analytics ────────────────────────────────────────────────────────────────

export interface EquityPoint {
  timestamp: number
  valueUsd: number
}

export interface EquityCurveResponse {
  from: number
  to: number
  data: EquityPoint[]
}

export interface PnLSummary {
  totalPnl: number
  byAsset: Record<string, number>
  byPeriod: { daily: number; weekly: number; monthly: number }
}

export interface DrawdownPoint {
  timestamp: number
  drawdownPct: number
}

export interface DrawdownResult {
  maxDrawdownPct: number
  maxDrawdownUsd: number
  peakValue: number
  troughValue: number
  peakDate: number
  troughDate: number
  currentDrawdownPct: number
  drawdownSeries: DrawdownPoint[]
}

export interface FeeSummary {
  totalFeesUsd: number
  byExchange: Record<string, number>
  byAsset: Record<string, number>
  byPeriod: { daily: number; weekly: number; monthly: number }
}

// ─── Tax ──────────────────────────────────────────────────────────────────────

export interface TaxableEvent {
  date: number
  asset: string
  action: 'sell'
  amount: number
  proceedsUsd: number
  costBasisUsd: number
  gainLossUsd: number
  holdingPeriodDays: number
  isShortTerm: boolean
}

export interface TaxReport {
  year: number
  totalRealizedGain: number
  totalRealizedLoss: number
  netGainLoss: number
  shortTermGain: number
  longTermGain: number
  events: TaxableEvent[]
}

// ─── Strategy Optimizer ───────────────────────────────────────────────────────

export interface OptimizationRequest {
  pairs: string[]
  allocations: AllocationInput[]
  startDate: number
  endDate: number
  initialBalance: number
  feePct: number
  timeframe: '1h' | '1d'
  exchange: string
  strategyTypes?: string[]
  topN?: number
  /** When true, runs additional cash-reserve + DCA routing scenarios */
  includeCashScenarios?: boolean
}

export interface OptimizationResultItem {
  rank: number
  label: string
  strategyType: string
  params: Record<string, unknown>
  totalReturn: number
  sharpeRatio: number
  maxDrawdown: number
  totalTrades: number
  compositeScore: number
  cashReservePct?: number
  dcaRebalanceEnabled?: boolean
}

export interface OptimizationResult {
  results: OptimizationResultItem[]
  bestStrategy: string
  totalCombinations: number
  ranCombinations: number
  skippedCombinations: number
  elapsedMs: number
}

