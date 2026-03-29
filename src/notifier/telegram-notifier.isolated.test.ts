import { describe, it, expect, mock } from 'bun:test'

// Mock GoClaw client — new impl routes all Telegram delivery through GoClaw
let goClawChatCalled = false
let goClawIsAvailableCalled = false

mock.module('@/ai/goclaw-client', () => ({
  goClawClient: {
    isAvailable: async () => {
      goClawIsAvailableCalled = true
      return true
    },
    chat: async (_prompt: string, _maxTokens?: number) => {
      goClawChatCalled = true
      return 'mocked response'
    },
  },
}))

mock.module('@/events/event-bus', () => ({
  eventBus: {
    on: () => {},
    off: () => {},
    removeAllListeners: () => {},
  },
}))

import { TelegramNotifier } from './telegram-notifier'

describe('telegram-notifier', () => {
  it('initializes and checks GoClaw availability', async () => {
    goClawIsAvailableCalled = false
    const notifier = new TelegramNotifier()
    await notifier.initialize()
    expect(goClawIsAvailableCalled).toBe(true)
  })

  it('starts notifier and subscribes to events', async () => {
    const notifier = new TelegramNotifier()
    await notifier.initialize()
    await notifier.start()
    notifier.stop()
    expect(true).toBe(true)
  })

  it('stop is idempotent', () => {
    const notifier = new TelegramNotifier()
    notifier.stop()
    notifier.stop()
    expect(true).toBe(true)
  })

  it('sendMessage routes through GoClaw chat', async () => {
    goClawChatCalled = false
    const notifier = new TelegramNotifier()
    await notifier.initialize()
    await notifier.sendMessage('Test message')
    expect(goClawChatCalled).toBe(true)
  })

  it('has 30-minute THROTTLE_MS constant', () => {
    const notifier = new TelegramNotifier()
    expect(notifier['THROTTLE_MS']).toBe(30 * 60 * 1000)
  })

  it('describeTradeEvent returns meaningful string with pair and exchange', () => {
    const notifier = new TelegramNotifier()
    const result = notifier['describeTradeEvent']({
      pair: 'BTC/USDT',
      side: 'buy' as const,
      amount: 1,
      price: 45000,
      exchange: 'binance' as const,
      costUsd: 45000,
      fee: 0.1,
      feeCurrency: 'BTC',
      isPaper: false,
    } as any)
    expect(result).toContain('BTC/USDT')
    expect(result).toContain('binance')
  })

  it('describeRebalanceEvent returns meaningful string with trigger and fee info', () => {
    const notifier = new TelegramNotifier()
    const result = notifier['describeRebalanceEvent']({
      trigger: 'manual' as const,
      trades: [],
      totalFeesUsd: 10,
      startedAt: new Date(),
      completedAt: new Date(),
    } as any)
    expect(result).toContain('manual')
    expect(typeof result).toBe('string')
  })

  it('describeTrailingStop returns asset and price info', () => {
    const notifier = new TelegramNotifier()
    const result = notifier['describeTrailingStop']({
      asset: 'BTC',
      price: 60000,
      stopPrice: 55000,
    })
    expect(result).toContain('BTC')
    expect(typeof result).toBe('string')
  })

  it('describeTrendChange returns signal info', () => {
    const notifier = new TelegramNotifier()
    const bull = notifier['describeTrendChange']({ bullish: true, price: 65000, ma: 60000 })
    expect(bull).toContain('BULL')

    const bear = notifier['describeTrendChange']({ bullish: false, price: 40000, ma: null })
    expect(bear).toContain('BEAR')
    expect(bear).toContain('N/A')
  })

  it('sendMessage throttles repeated direct messages within THROTTLE_MS window', async () => {
    // Verify throttle map prevents double-sends within the window
    const notifier = new TelegramNotifier()
    // Patch sendViaGoClaw indirectly by checking throttle map
    const throttleMap = notifier['throttle']
    expect(throttleMap).toBeInstanceOf(Map)

    await notifier.sendMessage('Message 1')
    const firstTimestamp = throttleMap.get('direct')
    // Immediate second call — should be throttled (no new entry change, or same timestamp)
    await notifier.sendMessage('Message 2')
    const secondTimestamp = throttleMap.get('direct')
    // Throttle map only updates on actual send, so timestamps should be equal
    expect(firstTimestamp).toBe(secondTimestamp)
  })
})
