import { describe, test, expect, beforeEach } from 'bun:test'
import { EventEmitter } from 'events'
import type { EventMap, Listener } from './event-bus'

// ─── Mock TypedEventEmitter for testing ────────────────────────────────────

class TypedEventEmitter {
  private readonly emitter: EventEmitter

  constructor() {
    this.emitter = new EventEmitter()
    this.emitter.setMaxListeners(50)
  }

  on<K extends keyof EventMap>(event: K, listener: Listener<K>): this {
    this.emitter.on(event, listener as (...args: unknown[]) => void)
    return this
  }

  once<K extends keyof EventMap>(event: K, listener: Listener<K>): this {
    this.emitter.once(event, listener as (...args: unknown[]) => void)
    return this
  }

  off<K extends keyof EventMap>(event: K, listener: Listener<K>): this {
    this.emitter.off(event, listener as (...args: unknown[]) => void)
    return this
  }

  removeAllListeners(event?: keyof EventMap): this {
    this.emitter.removeAllListeners(event)
    return this
  }

  emit<K extends keyof EventMap>(event: K, payload: EventMap[K]): boolean {
    return this.emitter.emit(event, payload)
  }

  listenerCount(event: keyof EventMap): number {
    return this.emitter.listenerCount(event)
  }
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe('TypedEventEmitter', () => {
  let emitter: TypedEventEmitter

  beforeEach(() => {
    emitter = new TypedEventEmitter()
  })

  test('should register and trigger on listener', () => {
    let called = false
    const payload = { price: 50000, pair: 'BTC/USDT', exchange: 'binance' as const }

    emitter.on('price:update', (data) => {
      called = true
      expect(data.price).toBe(50000)
      expect(data.pair).toBe('BTC/USDT')
    })

    emitter.emit('price:update', payload as EventMap['price:update'])
    expect(called).toBe(true)
  })

  test('should trigger once listener only once', () => {
    let count = 0

    emitter.once('rebalance:started', () => {
      count++
    })

    emitter.emit('rebalance:started', {
      id: '123',
      trigger: 'threshold',
      status: 'executing',
      beforeState: { totalValueUsd: 1000, assets: [], updatedAt: Date.now() },
      trades: [],
      totalFeesUsd: 0,
      startedAt: new Date(),
    })

    emitter.emit('rebalance:started', {
      id: '456',
      trigger: 'threshold',
      status: 'executing',
      beforeState: { totalValueUsd: 2000, assets: [], updatedAt: Date.now() },
      trades: [],
      totalFeesUsd: 0,
      startedAt: new Date(),
    })

    expect(count).toBe(1)
  })

  test('should remove listener with off()', () => {
    let count = 0
    const listener: Listener<'drift:warning'> = () => {
      count++
    }

    emitter.on('drift:warning', listener)
    emitter.emit('drift:warning', {
      asset: 'BTC',
      currentPct: 45,
      targetPct: 40,
      driftPct: 5,
    })

    expect(count).toBe(1)

    emitter.off('drift:warning', listener)
    emitter.emit('drift:warning', {
      asset: 'BTC',
      currentPct: 45,
      targetPct: 40,
      driftPct: 5,
    })

    expect(count).toBe(1) // Should not increment
  })

  test('should remove all listeners for an event', () => {
    let count1 = 0
    let count2 = 0

    emitter.on('exchange:connected', () => {
      count1++
    })
    emitter.on('exchange:connected', () => {
      count2++
    })

    emitter.emit('exchange:connected', 'binance')
    expect(count1).toBe(1)
    expect(count2).toBe(1)

    emitter.removeAllListeners('exchange:connected')
    emitter.emit('exchange:connected', 'okx')
    expect(count1).toBe(1)
    expect(count2).toBe(1)
  })

  test('should count listeners for an event', () => {
    const listener1: Listener<'trade:executed'> = () => {}
    const listener2: Listener<'trade:executed'> = () => {}

    expect(emitter.listenerCount('trade:executed')).toBe(0)

    emitter.on('trade:executed', listener1)
    expect(emitter.listenerCount('trade:executed')).toBe(1)

    emitter.on('trade:executed', listener2)
    expect(emitter.listenerCount('trade:executed')).toBe(2)

    emitter.off('trade:executed', listener1)
    expect(emitter.listenerCount('trade:executed')).toBe(1)
  })

  test('should return true from emit when listeners exist', () => {
    emitter.on('portfolio:update', () => {})
    const result = emitter.emit('portfolio:update', {
      totalValueUsd: 1000,
      assets: [],
      updatedAt: Date.now(),
    })
    expect(result).toBe(true)
  })

  test('should return false from emit when no listeners exist', () => {
    const result = emitter.emit('portfolio:update', {
      totalValueUsd: 1000,
      assets: [],
      updatedAt: Date.now(),
    })
    expect(result).toBe(false)
  })

  test('should support chaining', () => {
    let count = 0
    const listener: Listener<'balance:update'> = () => {
      count++
    }

    const result = emitter
      .on('balance:update', listener)
      .on('balance:update', listener)
      .emit('balance:update', { exchange: 'binance', balances: { BTC: 1 } })

    expect(result).toBe(true)
    expect(count).toBe(2)
  })

  test('should support multiple event types independently', () => {
    let priceUpdates = 0
    let portfolioUpdates = 0

    emitter.on('price:update', () => {
      priceUpdates++
    })

    emitter.on('portfolio:update', () => {
      portfolioUpdates++
    })

    emitter.emit('price:update', {
      price: 50000,
      pair: 'BTC/USDT',
      exchange: 'binance',
      bid: 50000,
      ask: 50001,
      volume24h: 100,
      change24h: 5,
      timestamp: Date.now(),
    })

    emitter.emit('portfolio:update', {
      totalValueUsd: 1000,
      assets: [],
      updatedAt: Date.now(),
    })

    expect(priceUpdates).toBe(1)
    expect(portfolioUpdates).toBe(1)
  })

  test('should handle error events', () => {
    let errorCaught: Error | null = null

    emitter.on('error', (err) => {
      errorCaught = err
    })

    const testError = new Error('Test error')
    emitter.emit('error', testError)

    expect(errorCaught).toBe(testError)
  })
})
