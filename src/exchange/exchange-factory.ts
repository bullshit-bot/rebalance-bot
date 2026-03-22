// ccxt.pro classes exist at runtime but are not exposed in the TS declarations.
// We import the runtime default (which has .pro.*) and the named namespace for types.
import ccxtDefault from 'ccxt'
import type * as ccxt from 'ccxt'
import type { ExchangeName } from '@/types/index'

// ─── Exchange creation config ─────────────────────────────────────────────────

export interface ExchangeCredentials {
  apiKey: string
  secret: string
  /** Required by OKX */
  password?: string
  /** When true, connects to the exchange testnet/sandbox */
  sandbox?: boolean
}

// ─── Factory ──────────────────────────────────────────────────────────────────

/**
 * Creates a CCXT Pro exchange instance for the given exchange name.
 * Rate limiting is always enabled to stay within exchange API quotas.
 *
 * CCXT Pro classes (ccxt.pro.*) extend ccxt.Exchange but lack their own TS
 * declarations — we construct via the runtime default import and type the
 * return value as ccxt.Exchange (the verified base class).
 *
 * @throws If the exchange name is not supported
 */
export function createExchange(name: ExchangeName, config: ExchangeCredentials): ccxt.Exchange {
  const baseOptions = {
    apiKey: config.apiKey,
    secret: config.secret,
    enableRateLimit: true,
  }

  // ccxt.pro.* classes exist at runtime; cast through unknown to satisfy TS
  const pro = ccxtDefault.pro as Record<string, new (opts: Record<string, unknown>) => ccxt.Exchange>

  let exchange: ccxt.Exchange

  switch (name) {
    case 'binance': {
      const ExchangeClass = pro['binance']
      if (!ExchangeClass) throw new Error('ccxt.pro.binance not found')
      exchange = new ExchangeClass({ ...baseOptions, options: { defaultType: 'spot' } })
      break
    }

    case 'okx': {
      const ExchangeClass = pro['okx']
      if (!ExchangeClass) throw new Error('ccxt.pro.okx not found')
      // OKX requires a passphrase in addition to key+secret
      exchange = new ExchangeClass({ ...baseOptions, password: config.password ?? '' })
      break
    }

    case 'bybit': {
      const ExchangeClass = pro['bybit']
      if (!ExchangeClass) throw new Error('ccxt.pro.bybit not found')
      exchange = new ExchangeClass({ ...baseOptions })
      break
    }

    default: {
      // Exhaustiveness check — TypeScript will catch unknown ExchangeName values
      const _exhaustive: never = name
      throw new Error(`Unsupported exchange: ${_exhaustive}`)
    }
  }

  if (config.sandbox) {
    exchange.setSandboxMode(true)
  }

  return exchange
}
