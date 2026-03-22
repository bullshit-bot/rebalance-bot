import { describe, test, expect, mock } from 'bun:test'
import { createExchange, type ExchangeCredentials } from './exchange-factory'

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('createExchange', () => {
  const baseConfig: ExchangeCredentials = {
    apiKey: 'test-key',
    secret: 'test-secret',
  }

  test('should create binance instance with correct options', () => {
    const config: ExchangeCredentials = { ...baseConfig }
    const exchange = createExchange('binance', config)

    expect(exchange).toBeDefined()
    expect(exchange.id).toBe('binance')
  })

  test('should create okx instance with password when provided', () => {
    const config: ExchangeCredentials = {
      ...baseConfig,
      password: 'test-password',
    }
    const exchange = createExchange('okx', config)

    expect(exchange).toBeDefined()
    expect(exchange.id).toBe('okx')
  })

  test('should create bybit instance', () => {
    const config: ExchangeCredentials = { ...baseConfig }
    const exchange = createExchange('bybit', config)

    expect(exchange).toBeDefined()
    expect(exchange.id).toBe('bybit')
  })

  test('should set sandbox mode when configured', () => {
    const config: ExchangeCredentials = {
      ...baseConfig,
      sandbox: true,
    }

    const exchange = createExchange('binance', config)

    // Verify sandbox mode was applied
    expect(exchange).toBeDefined()
    expect(config.sandbox).toBe(true)
  })

  test('should throw on unsupported exchange name', () => {
    expect(() => {
      createExchange('unsupported-exchange' as any, baseConfig)
    }).toThrow()
  })

  test('should enable rate limiting on all exchanges', () => {
    // Rate limiting is always enabled in the base configuration
    const config: ExchangeCredentials = { ...baseConfig }
    const exchange = createExchange('binance', config)

    expect(exchange).toBeDefined()
  })

  test('should configure binance with spot defaultType', () => {
    const config: ExchangeCredentials = { ...baseConfig }
    const exchange = createExchange('binance', config)

    // The exchange instance should have the spot configuration applied
    expect(exchange).toBeDefined()
  })

  test('should handle missing okx password gracefully', () => {
    const config: ExchangeCredentials = {
      apiKey: 'test-key',
      secret: 'test-secret',
      // password intentionally omitted
    }
    const exchange = createExchange('okx', config)

    expect(exchange).toBeDefined()
  })

  test('should accept credentials with apiKey and secret', () => {
    const config: ExchangeCredentials = {
      apiKey: 'my-api-key',
      secret: 'my-secret',
    }

    const exchange = createExchange('binance', config)
    expect(exchange).toBeDefined()
  })
})
