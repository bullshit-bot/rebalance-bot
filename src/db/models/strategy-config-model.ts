import { Schema, model } from 'mongoose'

export interface IStrategyConfig {
  name: string
  description: string
  params: Record<string, unknown>
  globalSettings: Record<string, unknown>
  isActive: boolean
  presetName: string | null
  version: number
  history: { params: Record<string, unknown>; changedAt: Date }[]
  createdAt: Date
  updatedAt: Date
}

const strategyConfigSchema = new Schema<IStrategyConfig>({
  name: { type: String, required: true, unique: true },
  description: { type: String, default: '' },
  params: { type: Schema.Types.Mixed, required: true },
  globalSettings: { type: Schema.Types.Mixed, default: {} },
  isActive: { type: Boolean, default: false },
  presetName: { type: String, default: null },
  version: { type: Number, default: 1 },
  history: [{
    params: { type: Schema.Types.Mixed },
    changedAt: { type: Date, default: Date.now },
  }],
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
})

// Only one active config at a time
strategyConfigSchema.index(
  { isActive: 1 },
  { unique: true, partialFilterExpression: { isActive: true } }
)

export const StrategyConfigModel = model<IStrategyConfig>('StrategyConfig', strategyConfigSchema)

// ─── Built-in presets ────────────────────────────────────────────────────────

export const STRATEGY_PRESETS = {
  Conservative: {
    description: 'Wide threshold, slow rebalance — minimizes trading',
    params: { type: 'threshold', thresholdPct: 8, minTradeUsd: 25 },
    globalSettings: { partialFactor: 0.5, cooldownHours: 8, feeAware: true, autoExecute: false },
  },
  Balanced: {
    description: 'Standard configuration — good balance of cost and drift control',
    params: { type: 'threshold', thresholdPct: 5, minTradeUsd: 15 },
    globalSettings: { partialFactor: 0.75, cooldownHours: 4, dynamicThreshold: true, feeAware: true, autoExecute: false },
  },
  Aggressive: {
    description: 'Tight threshold, fast rebalance — maximizes target accuracy',
    params: { type: 'threshold', thresholdPct: 2, minTradeUsd: 10 },
    globalSettings: { partialFactor: 1, cooldownHours: 1, dynamicThreshold: true, feeAware: false, autoExecute: false },
  },
  MeanReversion: {
    description: 'Bollinger-band style — rebalance only when drift exceeds volatility bands',
    params: { type: 'mean-reversion', minTradeUsd: 15, lookbackDays: 30, bandWidthSigma: 1.5, minDriftPct: 3 },
    globalSettings: { partialFactor: 0.75, cooldownHours: 4, dynamicThreshold: true, feeAware: true, autoExecute: false },
  },
  VolatilityAdjusted: {
    description: 'Dynamic threshold scales with market volatility — trades less in calm, more in storms',
    params: { type: 'vol-adjusted', minTradeUsd: 15, baseThresholdPct: 5, volLookbackDays: 30, minThresholdPct: 3, maxThresholdPct: 20 },
    globalSettings: { partialFactor: 0.75, cooldownHours: 4, dynamicThreshold: true, feeAware: true, autoExecute: false },
  },
  CashAwareBalanced: {
    description: 'Balanced with 20% USDT cash reserve — crypto targets scaled to 80% of portfolio',
    params: { type: 'equal-weight', thresholdPct: 5, minTradeUsd: 10 },
    globalSettings: { cashReservePct: 20, partialFactor: 0.75, cooldownHours: 4, feeAware: true, autoExecute: false },
  },
  DCARebalance: {
    description: 'DCA routes to underweight assets, hard rebalance at 15% drift only',
    params: { type: 'threshold', thresholdPct: 15, minTradeUsd: 10 },
    globalSettings: { cashReservePct: 20, dcaRebalanceEnabled: true, hardRebalanceThreshold: 15, feeAware: true, autoExecute: false },
  },
} as const

export type PresetName = keyof typeof STRATEGY_PRESETS
