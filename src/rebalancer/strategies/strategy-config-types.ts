import { z } from 'zod'

// ─── Per-strategy parameter schemas ──────────────────────────────────────────

export const ThresholdParamsSchema = z.object({
  type: z.literal('threshold'),
  thresholdPct: z.number().min(0.1).max(50).default(5),
  minTradeUsd: z.number().min(1).max(100000).default(10),
})

export const EqualWeightParamsSchema = z.object({
  type: z.literal('equal-weight'),
  thresholdPct: z.number().min(0.1).max(50).default(5),
  minTradeUsd: z.number().min(1).max(100000).default(10),
})

export const MomentumTiltParamsSchema = z.object({
  type: z.literal('momentum-tilt'),
  thresholdPct: z.number().min(0.1).max(50).default(5),
  minTradeUsd: z.number().min(1).max(100000).default(10),
  momentumWindowDays: z.number().min(5).max(365).default(14),
  momentumWeight: z.number().min(0).max(1).default(0.5),
})

export const VolAdjustedParamsSchema = z.object({
  type: z.literal('vol-adjusted'),
  minTradeUsd: z.number().min(1).max(100000).default(10),
  baseThresholdPct: z.number().min(0.1).max(50).default(5),
  volLookbackDays: z.number().min(5).max(365).default(30),
  minThresholdPct: z.number().min(0.1).max(10).default(3),
  maxThresholdPct: z.number().min(5).max(50).default(20),
})

export const MeanReversionParamsSchema = z.object({
  type: z.literal('mean-reversion'),
  minTradeUsd: z.number().min(1).max(100000).default(10),
  lookbackDays: z.number().min(5).max(365).default(30),
  bandWidthSigma: z.number().min(0.5).max(4).default(1.5),
  minDriftPct: z.number().min(0.1).max(20).default(3),
})

export const MomentumWeightedParamsSchema = z.object({
  type: z.literal('momentum-weighted'),
  minTradeUsd: z.number().min(1).max(100000).default(10),
  rsiPeriod: z.number().min(5).max(50).default(14),
  macdFast: z.number().min(5).max(20).default(12),
  macdSlow: z.number().min(15).max(50).default(26),
  weightFactor: z.number().min(0.1).max(1).default(0.4),
})

// ─── Discriminated union of all strategy params ──────────────────────────────

export const StrategyParamsSchema = z.discriminatedUnion('type', [
  ThresholdParamsSchema,
  EqualWeightParamsSchema,
  MomentumTiltParamsSchema,
  VolAdjustedParamsSchema,
  MeanReversionParamsSchema,
  MomentumWeightedParamsSchema,
])

// ─── Global settings (apply to all strategies) ──────────────────────────────

export const GlobalSettingsSchema = z.object({
  baseAsset: z.string().default('USDT'),
  maxDailyVolume: z.number().min(100).max(10000000).default(50000),
  partialFactor: z.number().min(0.1).max(1).default(0.75),
  cooldownHours: z.number().min(0).max(168).default(4),
  dynamicThreshold: z.boolean().default(true),
  trendAware: z.boolean().default(false),
  feeAware: z.boolean().default(true),
  autoExecute: z.boolean().default(false),
  // Cash reserve: % of portfolio held in stablecoins, never traded
  cashReservePct: z.number().min(0).max(50).default(0),
  // DCA routing: when true, DCA buys target only the most underweight asset
  dcaRebalanceEnabled: z.boolean().default(false),
  // Scheduled DCA amount per execution (USD)
  dcaAmountUsd: z.number().min(1).max(100000).default(20),
  // Hard rebalance threshold: full rebalance only fires when drift exceeds this
  hardRebalanceThreshold: z.number().min(5).max(50).default(15),
  // Trend filter: MA-based bear market protection
  trendFilterEnabled: z.boolean().default(false),
  trendFilterMA: z.number().min(20).max(365).default(100),
  bearCashPct: z.number().min(30).max(100).default(70),
  trendFilterBuffer: z.number().min(0).max(10).default(2),
  // Cooldown between bull/bear flips to prevent whipsaw trades
  trendFilterCooldownDays: z.number().min(0).max(14).default(3),
})

// ─── Full config input schema ────────────────────────────────────────────────

export const CreateStrategyConfigSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  params: StrategyParamsSchema,
  globalSettings: GlobalSettingsSchema.optional(),
})

export const UpdateStrategyConfigSchema = z.object({
  description: z.string().max(500).optional(),
  params: StrategyParamsSchema.optional(),
  globalSettings: GlobalSettingsSchema.partial().optional(),
})

// ─── Inferred types ──────────────────────────────────────────────────────────

export type StrategyParams = z.infer<typeof StrategyParamsSchema>
export type GlobalSettings = z.infer<typeof GlobalSettingsSchema>
export type CreateStrategyConfig = z.infer<typeof CreateStrategyConfigSchema>
export type UpdateStrategyConfig = z.infer<typeof UpdateStrategyConfigSchema>
export type StrategyType = StrategyParams['type']
