import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { TrailingStopManager } from './trailing-stop-manager'
import { eventBus } from '@/events/event-bus'
import type { PriceData, TrailingStopConfig } from '@/types/index'

describe('TrailingStopManager', () => {
  let manager: TrailingStopManager
  let triggeredEvents: { asset: string; exchange: string; price: number; stopPrice: number }[] = []

  beforeEach(() => {
    manager = new TrailingStopManager()
    triggeredEvents = []
    eventBus.on('trailing-stop:triggered', (evt) => {
      triggeredEvents.push(evt)
    })
  })

  afterEach(() => {
    manager.stop()
    eventBus.removeAllListeners('trailing-stop:triggered')
  })

  test('addStop stores the stop with initial state', () => {
    const config: TrailingStopConfig = {
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    }

    manager.addStop(config)

    const stop = manager.getStop('BTC', 'binance')
    expect(stop).toBeDefined()
    expect(stop?.config.asset).toBe('BTC')
    expect(stop?.config.trailPct).toBe(5)
    expect(stop?.highestPrice).toBe(0)
    expect(stop?.activated).toBe(false)
  })

  test('getStops returns all tracked stops', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })
    manager.addStop({
      asset: 'ETH',
      exchange: 'binance',
      trailPct: 3,
      enabled: true,
    })

    const stops = manager.getStops()
    expect(stops.length).toBe(2)
  })

  test('removeStop deletes the stop', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })

    expect(manager.getStop('BTC', 'binance')).toBeDefined()
    manager.removeStop('BTC', 'binance')
    expect(manager.getStop('BTC', 'binance')).toBeUndefined()
  })

  test('price increase updates highestPrice and stopPrice', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })
    manager.start()

    const priceData: PriceData = {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 50000,
      bid: 49999,
      ask: 50001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    }

    eventBus.emit('price:update', priceData)

    const stop = manager.getStop('BTC', 'binance')
    expect(stop?.highestPrice).toBe(50000)
    expect(stop?.stopPrice).toBe(50000 * (1 - 5 / 100)) // 47500
  })

  test('price drop below stopPrice triggers stop event', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })
    manager.start()

    // Price rises to 50000
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 50000,
      bid: 49999,
      ask: 50001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    // Price drops below stop (47500)
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 47000,
      bid: 46999,
      ask: 47001,
      volume24h: 800,
      change24h: -3,
      timestamp: Date.now(),
    })

    expect(triggeredEvents.length).toBe(1)
    expect(triggeredEvents[0].asset).toBe('BTC')
    expect(triggeredEvents[0].price).toBe(47000)
  })

  test('triggered stop cannot be re-triggered', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })
    manager.start()

    // Price rises
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 50000,
      bid: 49999,
      ask: 50001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    // Price drops and triggers
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 47000,
      bid: 46999,
      ask: 47001,
      volume24h: 800,
      change24h: -3,
      timestamp: Date.now(),
    })

    expect(triggeredEvents.length).toBe(1)

    // Price rises again above the old stop
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 49000,
      bid: 48999,
      ask: 49001,
      volume24h: 900,
      change24h: 4.3,
      timestamp: Date.now(),
    })

    // Should NOT trigger again
    expect(triggeredEvents.length).toBe(1)
  })

  test('disabled stop does not trigger', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: false,
    })
    manager.start()

    // Price rises
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 50000,
      bid: 49999,
      ask: 50001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    // Price drops
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 47000,
      bid: 46999,
      ask: 47001,
      volume24h: 800,
      change24h: -3,
      timestamp: Date.now(),
    })

    expect(triggeredEvents.length).toBe(0)
  })

  test('start subscribes to price:update events', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })

    manager.start()

    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 50000,
      bid: 49999,
      ask: 50001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    const stop = manager.getStop('BTC', 'binance')
    expect(stop?.highestPrice).toBe(50000)
  })

  test('stop unsubscribes from price:update events', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })
    manager.start()

    // Update price before stopping
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 50000,
      bid: 49999,
      ask: 50001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    manager.stop()

    // Update price after stopping
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 51000,
      bid: 50999,
      ask: 51001,
      volume24h: 1100,
      change24h: 3,
      timestamp: Date.now(),
    })

    // Should not have updated (still 50000)
    const stop = manager.getStop('BTC', 'binance')
    expect(stop?.highestPrice).toBe(50000)
  })

  test('multiple trailing stops on same asset but different exchanges', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })
    manager.addStop({
      asset: 'BTC',
      exchange: 'okx',
      trailPct: 3,
      enabled: true,
    })
    manager.start()

    // Binance price rises
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 50000,
      bid: 49999,
      ask: 50001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    // OKX price rises to different level
    eventBus.emit('price:update', {
      exchange: 'okx',
      pair: 'BTC/USDT',
      price: 50500,
      bid: 50499,
      ask: 50501,
      volume24h: 1100,
      change24h: 2.8,
      timestamp: Date.now(),
    })

    const binanceStop = manager.getStop('BTC', 'binance')
    const okxStop = manager.getStop('BTC', 'okx')

    expect(binanceStop?.highestPrice).toBe(50000)
    expect(okxStop?.highestPrice).toBe(50500)
  })

  test('trailing stop with different trail percentages', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 10,
      enabled: true,
    })
    manager.addStop({
      asset: 'ETH',
      exchange: 'binance',
      trailPct: 2,
      enabled: true,
    })
    manager.start()

    // Both reach same price
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 100,
      bid: 99,
      ask: 101,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'ETH/USDT',
      price: 100,
      bid: 99,
      ask: 101,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    const btcStop = manager.getStop('BTC', 'binance')
    const ethStop = manager.getStop('ETH', 'binance')

    // BTC stop price: 100 * (1 - 10/100) = 90
    expect(btcStop?.stopPrice).toBe(90)
    // ETH stop price: 100 * (1 - 2/100) = 98
    expect(ethStop?.stopPrice).toBe(98)
  })

  test('addStop preserves existing highestPrice when replacing', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })
    manager.start()

    // Price rises
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 50000,
      bid: 49999,
      ask: 50001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    // Replace the stop
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 3,
      enabled: true,
    })

    const stop = manager.getStop('BTC', 'binance')
    expect(stop?.highestPrice).toBe(50000)
    expect(stop?.config.trailPct).toBe(3)
  })

  test('handles prices for same asset across different quote currencies', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })
    manager.start()

    // Emit price for BTC/USDT
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 45000,
      bid: 44999,
      ask: 45001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    // BTC stop should be updated
    const stop = manager.getStop('BTC', 'binance')
    expect(stop?.highestPrice).toBe(45000)

    // Emit price for BTC/BUSD (different quote, but same base asset)
    // The manager uses the base asset only for matching stops
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/BUSD',
      price: 46000,
      bid: 45999,
      ask: 46001,
      volume24h: 500,
      change24h: 2.2,
      timestamp: Date.now(),
    })

    // Since the stop matches on asset/exchange, it WILL be updated
    const updatedStop = manager.getStop('BTC', 'binance')
    expect(updatedStop?.highestPrice).toBe(46000)
  })

  test('getStop returns undefined for non-existent pair', () => {
    const stop = manager.getStop('NONEXISTENT', 'binance')
    expect(stop).toBeUndefined()
  })

  test('multiple calls to start are idempotent', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })

    manager.start()
    manager.start()
    manager.start()

    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 50000,
      bid: 49999,
      ask: 50001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    const stop = manager.getStop('BTC', 'binance')
    expect(stop?.highestPrice).toBe(50000)
  })

  test('multiple calls to stop are idempotent', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })
    manager.start()

    manager.stop()
    manager.stop()
    manager.stop()

    // Should not throw
  })

  test('price exactly at stopPrice triggers the stop', () => {
    manager.addStop({
      asset: 'BTC',
      exchange: 'binance',
      trailPct: 5,
      enabled: true,
    })
    manager.start()

    // Price rises
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 50000,
      bid: 49999,
      ask: 50001,
      volume24h: 1000,
      change24h: 2.5,
      timestamp: Date.now(),
    })

    // Price drops to exactly stopPrice (47500)
    eventBus.emit('price:update', {
      exchange: 'binance',
      pair: 'BTC/USDT',
      price: 47500,
      bid: 47499,
      ask: 47501,
      volume24h: 800,
      change24h: -5,
      timestamp: Date.now(),
    })

    expect(triggeredEvents.length).toBe(1)
  })
})
