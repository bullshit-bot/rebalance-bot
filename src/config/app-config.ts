import { createEnv } from '@t3-oss/env-core'
import { z } from 'zod'

/**
 * Validated environment configuration using @t3-oss/env-core + zod.
 * All env vars are validated at startup — missing required vars crash early.
 */
export const env = createEnv({
  server: {
    // API server
    API_PORT: z.coerce.number().int().positive().default(3001),
    API_KEY: z.string().min(1),

    // Exchange credentials (all optional — user enables what they have)
    BINANCE_API_KEY: z.string().optional(),
    BINANCE_API_SECRET: z.string().optional(),
    BINANCE_SANDBOX: z.string().optional(),

    OKX_API_KEY: z.string().optional(),
    OKX_API_SECRET: z.string().optional(),
    OKX_PASSPHRASE: z.string().optional(),

    BYBIT_API_KEY: z.string().optional(),
    BYBIT_API_SECRET: z.string().optional(),

    // Security
    ENCRYPTION_KEY: z.string().length(32),

    // Notifications (optional)
    TELEGRAM_BOT_TOKEN: z.string().optional(),
    TELEGRAM_CHAT_ID: z.string().optional(),

    // Rebalance strategy settings
    REBALANCE_THRESHOLD: z.coerce.number().positive().default(5),
    REBALANCE_COOLDOWN_HOURS: z.coerce.number().int().positive().default(1),
    MIN_TRADE_USD: z.coerce.number().positive().default(10),
    MAX_TRADE_USD: z.coerce.number().positive().default(5000),
    DAILY_LOSS_LIMIT_PCT: z.coerce.number().positive().default(10),

    // Trading mode — defaults to true (safe paper-trading until explicitly disabled)
    PAPER_TRADING: z
      .enum(['true', 'false', '1', '0'])
      .transform((v) => v === 'true' || v === '1')
      .default('true'),

    // Database
    DATABASE_URL: z.string().default('file:./data/bot.db'),

    // GoClaw AI agent (for scheduled reports and autonomous actions)
    GOCLAW_URL: z.string().url().optional(),
    GOCLAW_GATEWAY_TOKEN: z.string().optional(),

    // Advanced strategy settings
    STRATEGY_MODE: z.enum(['threshold', 'equal-weight', 'momentum-tilt', 'vol-adjusted']).default('threshold'),
    MOMENTUM_WINDOW_DAYS: z.coerce.number().int().positive().default(30),
    VOLATILITY_THRESHOLD: z.coerce.number().positive().default(50),
    DYNAMIC_THRESHOLD_LOW: z.coerce.number().positive().default(3),
    DYNAMIC_THRESHOLD_HIGH: z.coerce.number().positive().default(8),
  },

  /**
   * In Bun, process.env is available globally.
   * We runtimeEnv all keys explicitly so env-core can validate them.
   */
  runtimeEnv: {
    API_PORT: process.env['API_PORT'],
    API_KEY: process.env['API_KEY'],

    BINANCE_API_KEY: process.env['BINANCE_API_KEY'],
    BINANCE_API_SECRET: process.env['BINANCE_API_SECRET'],
    BINANCE_SANDBOX: process.env['BINANCE_SANDBOX'],

    OKX_API_KEY: process.env['OKX_API_KEY'],
    OKX_API_SECRET: process.env['OKX_API_SECRET'],
    OKX_PASSPHRASE: process.env['OKX_PASSPHRASE'],

    BYBIT_API_KEY: process.env['BYBIT_API_KEY'],
    BYBIT_API_SECRET: process.env['BYBIT_API_SECRET'],

    ENCRYPTION_KEY: process.env['ENCRYPTION_KEY'],

    TELEGRAM_BOT_TOKEN: process.env['TELEGRAM_BOT_TOKEN'],
    TELEGRAM_CHAT_ID: process.env['TELEGRAM_CHAT_ID'],

    REBALANCE_THRESHOLD: process.env['REBALANCE_THRESHOLD'],
    REBALANCE_COOLDOWN_HOURS: process.env['REBALANCE_COOLDOWN_HOURS'],
    MIN_TRADE_USD: process.env['MIN_TRADE_USD'],
    MAX_TRADE_USD: process.env['MAX_TRADE_USD'],
    DAILY_LOSS_LIMIT_PCT: process.env['DAILY_LOSS_LIMIT_PCT'],

    PAPER_TRADING: process.env['PAPER_TRADING'],

    DATABASE_URL: process.env['DATABASE_URL'],

    STRATEGY_MODE: process.env['STRATEGY_MODE'],
    MOMENTUM_WINDOW_DAYS: process.env['MOMENTUM_WINDOW_DAYS'],
    VOLATILITY_THRESHOLD: process.env['VOLATILITY_THRESHOLD'],
    DYNAMIC_THRESHOLD_LOW: process.env['DYNAMIC_THRESHOLD_LOW'],
    DYNAMIC_THRESHOLD_HIGH: process.env['DYNAMIC_THRESHOLD_HIGH'],

    GOCLAW_URL: process.env['GOCLAW_URL'],
    GOCLAW_GATEWAY_TOKEN: process.env['GOCLAW_GATEWAY_TOKEN'],
  },

  // Skip validation during tests to avoid needing real env vars
  skipValidation: process.env['NODE_ENV'] === 'test',

  // Treat empty strings as undefined so optional fields degrade gracefully
  emptyStringAsUndefined: true,
})
