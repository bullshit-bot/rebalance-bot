// ─── Exchange primitives ──────────────────────────────────────────────────────

export type ExchangeName = 'binance' | 'okx' | 'bybit'
export type OrderSide = 'buy' | 'sell'
export type OrderType = 'limit' | 'market'
export type RebalanceTrigger = 'threshold' | 'periodic' | 'manual'
export type RebalanceStatus = 'pending' | 'executing' | 'completed' | 'failed'

// ─── Market data ──────────────────────────────────────────────────────────────

export interface PriceData {
  exchange: ExchangeName
  /** Trading pair symbol, e.g. "BTC/USDT" */
  pair: string
  /** Last traded price */
  price: number
  bid: number
  ask: number
  volume24h: number
  /** Percentage change over 24h, e.g. 2.5 for +2.5% */
  change24h: number
  /** Unix epoch ms */
  timestamp: number
}

// ─── Portfolio ────────────────────────────────────────────────────────────────

export interface PortfolioAsset {
  asset: string
  amount: number
  valueUsd: number
  /** Current allocation percentage (0–100) */
  currentPct: number
  /** Target allocation percentage (0–100) */
  targetPct: number
  /** Deviation from target: currentPct - targetPct */
  driftPct: number
  exchange: ExchangeName
}

export interface Portfolio {
  totalValueUsd: number
  assets: PortfolioAsset[]
  /** Unix epoch ms */
  updatedAt: number
}

// ─── Allocation config ────────────────────────────────────────────────────────

export interface Allocation {
  asset: string
  /** Target allocation percentage (0–100) */
  targetPct: number
  /** Preferred exchange for this asset; if omitted, best price wins */
  exchange?: ExchangeName
  minTradeUsd: number
}

// ─── Orders & trades ─────────────────────────────────────────────────────────

export interface TradeOrder {
  exchange: ExchangeName
  /** e.g. "BTC/USDT" */
  pair: string
  side: OrderSide
  type: OrderType
  amount: number
  /** Required for limit orders */
  price?: number
}

export interface TradeResult {
  id: string
  exchange: ExchangeName
  pair: string
  side: OrderSide
  amount: number
  price: number
  costUsd: number
  fee: number
  feeCurrency: string
  orderId: string
  rebalanceId?: string
  executedAt: Date
  isPaper: boolean
}

// ─── Rebalance lifecycle ──────────────────────────────────────────────────────

export interface RebalanceEvent {
  id: string
  trigger: RebalanceTrigger
  status: RebalanceStatus
  beforeState: Portfolio
  afterState?: Portfolio
  trades: TradeResult[]
  totalFeesUsd: number
  errorMessage?: string
  startedAt: Date
  completedAt?: Date
}

// ─── Trailing stop ────────────────────────────────────────────────────────────

export interface TrailingStopConfig {
  asset: string
  exchange: ExchangeName
  /** Trail distance in percent, e.g. 5 for 5% */
  trailPct: number
  enabled: boolean
}

export interface TrailingStopState {
  config: TrailingStopConfig
  highestPrice: number
  stopPrice: number
  activated: boolean
}

// ─── Exchange status ──────────────────────────────────────────────────────────

export interface ExchangeStatus {
  name: ExchangeName
  connected: boolean
  /** Unix epoch ms of last successful ping */
  lastPing: number
  error?: string
}

// ─── WebSocket messages (backend → React) ────────────────────────────────────

export type WSMessage =
  | { type: 'prices'; data: Record<string, PriceData> }
  | { type: 'portfolio'; data: Portfolio }
  | { type: 'rebalance:started'; data: { id: string; trigger: RebalanceTrigger } }
  | { type: 'rebalance:completed'; data: RebalanceEvent }
  | { type: 'trade:executed'; data: TradeResult }
  | { type: 'alert'; data: { level: 'info' | 'warn' | 'error'; message: string } }
  | { type: 'exchange:status'; data: Record<ExchangeName, 'connected' | 'disconnected' | 'reconnecting'> }
  | { type: 'trailing-stop:triggered'; data: { asset: string; price: number; stopPrice: number } }
