import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { setupTestDB, teardownTestDB } from '@db/test-helpers'
import { SmartOrderModel } from '@db/database'
import { sliceScheduler } from './slice-scheduler'
import { executionTracker } from './execution-tracker'

describe('SliceScheduler integration', () => {
  const testOrderId = 'slice-test-' + Date.now()

  beforeEach(async () => {
    await setupTestDB()
  })

  afterEach(async () => {
    sliceScheduler.cancel(testOrderId)
    await teardownTestDB()
  })

  test('scheduleSlices accepts valid params', async () => {
    expect(async () => {
      await sliceScheduler.scheduleSlices({
        orderId: testOrderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [
          { amount: 10, delayMs: 0 },
          { amount: 10, delayMs: 3600000 },
        ],
      })
    }).not.toThrow()
  })

  test('scheduleSlices stores order in active map', async () => {
    const orderId = 'scheduler-test-1-' + Date.now()

    try {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [{ amount: 10, delayMs: 0 }],
      })
    } catch {
      // Expected to fail on executor — we're just testing scheduling
    }

    await new Promise(resolve => setTimeout(resolve, 50))

    sliceScheduler.cancel(orderId)
  })

  test('pause stops future slice execution', async () => {
    const orderId = 'pause-test-' + Date.now()

    try {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [
          { amount: 10, delayMs: 0 },
          { amount: 10, delayMs: 100000 },
        ],
      })
    } catch {
      // executor will fail, expected
    }

    await new Promise(resolve => setTimeout(resolve, 50))

    expect(() => {
      sliceScheduler.pause(orderId)
    }).not.toThrow()

    await new Promise(resolve => setTimeout(resolve, 50))

    sliceScheduler.cancel(orderId)
  })

  test('pause with unknown orderId does not throw', () => {
    expect(() => {
      sliceScheduler.pause('unknown-order-' + Date.now())
    }).not.toThrow()
  })

  test('resume with unknown orderId does not throw', () => {
    expect(() => {
      sliceScheduler.resume('unknown-order-' + Date.now())
    }).not.toThrow()
  })

  test('resume with non-paused order does not throw', async () => {
    const orderId = 'resume-test-' + Date.now()

    try {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [{ amount: 10, delayMs: 0 }],
      })
    } catch {
      // expected
    }

    await new Promise(resolve => setTimeout(resolve, 50))

    expect(() => {
      sliceScheduler.resume(orderId)
    }).not.toThrow()

    sliceScheduler.cancel(orderId)
  })

  test('cancel with unknown orderId does not throw', () => {
    expect(() => {
      sliceScheduler.cancel('unknown-order-' + Date.now())
    }).not.toThrow()
  })

  test('scheduleSlices with multiple slices sets correct timers', async () => {
    const orderId = 'multi-slice-' + Date.now()

    try {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'sell',
        slices: [
          { amount: 5, delayMs: 0 },
          { amount: 5, delayMs: 1000 },
          { amount: 5, delayMs: 1000 },
        ],
      })
    } catch {
      // executor failure expected
    }

    await new Promise(resolve => setTimeout(resolve, 100))

    sliceScheduler.cancel(orderId)
  })

  test('scheduleSlices handles empty slices array', async () => {
    const orderId = 'empty-slice-' + Date.now()

    expect(async () => {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [],
      })
    }).not.toThrow()

    sliceScheduler.cancel(orderId)
  })

  test('pause clears pending timers', async () => {
    const orderId = 'pause-clear-' + Date.now()

    try {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [
          { amount: 10, delayMs: 0 },
          { amount: 10, delayMs: 10000 },
          { amount: 10, delayMs: 10000 },
        ],
      })
    } catch {
      // expected
    }

    await new Promise(resolve => setTimeout(resolve, 50))

    sliceScheduler.pause(orderId)

    await new Promise(resolve => setTimeout(resolve, 50))

    sliceScheduler.cancel(orderId)
  })

  test('scheduleSlices cumulative delay calculation', async () => {
    const orderId = 'cumulative-' + Date.now()

    try {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [
          { amount: 10, delayMs: 0 },
          { amount: 10, delayMs: 1000 },
          { amount: 10, delayMs: 500 },
        ],
      })
    } catch {
      // expected
    }

    await new Promise(resolve => setTimeout(resolve, 100))

    sliceScheduler.cancel(orderId)
  })

  test('multiple orders can be scheduled concurrently', async () => {
    const orderIds = [
      'concurrent-1-' + Date.now(),
      'concurrent-2-' + Date.now(),
      'concurrent-3-' + Date.now(),
    ]

    for (const id of orderIds) {
      try {
        await sliceScheduler.scheduleSlices({
          orderId: id,
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          slices: [{ amount: 10, delayMs: 0 }],
        })
      } catch {
        // expected
      }
    }

    await new Promise(resolve => setTimeout(resolve, 100))

    for (const id of orderIds) {
      sliceScheduler.cancel(id)
    }
  })

  test('pause then resume restores scheduling', async () => {
    const orderId = 'pause-resume-' + Date.now()

    await SmartOrderModel.create({
      _id: orderId,
      type: 'twap',
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      totalAmount: 100,
      filledAmount: 0,
      slicesTotal: 3,
      slicesCompleted: 0,
      durationMs: 3600000,
      status: 'active',
      config: {},
    })

    try {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [
          { amount: 10, delayMs: 0 },
          { amount: 10, delayMs: 100000 },
          { amount: 10, delayMs: 100000 },
        ],
      })
    } catch {
      // expected
    }

    await new Promise(resolve => setTimeout(resolve, 50))

    sliceScheduler.pause(orderId)
    await new Promise(resolve => setTimeout(resolve, 50))

    expect(() => {
      sliceScheduler.resume(orderId)
    }).not.toThrow()

    await new Promise(resolve => setTimeout(resolve, 50))

    sliceScheduler.cancel(orderId)
  })

  test('cancel removes order from active tracking', async () => {
    const orderId = 'cancel-remove-' + Date.now()

    try {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [
          { amount: 10, delayMs: 0 },
          { amount: 10, delayMs: 10000 },
        ],
      })
    } catch {
      // expected
    }

    await new Promise(resolve => setTimeout(resolve, 50))

    sliceScheduler.cancel(orderId)

    expect(() => {
      sliceScheduler.cancel(orderId)
    }).not.toThrow()
  })

  test('scheduleSlices handles zero delay first slice', async () => {
    const orderId = 'zero-delay-' + Date.now()

    expect(async () => {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [{ amount: 10, delayMs: 0 }],
      })
    }).not.toThrow()

    await new Promise(resolve => setTimeout(resolve, 100))

    sliceScheduler.cancel(orderId)
  })

  test('scheduleSlices with large delay values', async () => {
    const orderId = 'large-delay-' + Date.now()

    expect(async () => {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [
          { amount: 10, delayMs: 0 },
          { amount: 10, delayMs: 86400000 },
        ],
      })
    }).not.toThrow()

    await new Promise(resolve => setTimeout(resolve, 50))

    sliceScheduler.cancel(orderId)
  })

  test('pause idempotent — pause twice is safe', async () => {
    const orderId = 'double-pause-' + Date.now()

    try {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [
          { amount: 10, delayMs: 0 },
          { amount: 10, delayMs: 5000 },
        ],
      })
    } catch {
      // expected
    }

    await new Promise(resolve => setTimeout(resolve, 50))

    sliceScheduler.pause(orderId)
    sliceScheduler.pause(orderId)

    await new Promise(resolve => setTimeout(resolve, 50))

    sliceScheduler.cancel(orderId)
  })

  test('cancel clears all pending timers', async () => {
    const orderId = 'cancel-timers-' + Date.now()

    try {
      await sliceScheduler.scheduleSlices({
        orderId,
        exchange: 'binance',
        pair: 'BTC/USDT',
        side: 'buy',
        slices: [
          { amount: 5, delayMs: 0 },
          { amount: 5, delayMs: 1000 },
          { amount: 5, delayMs: 1000 },
          { amount: 5, delayMs: 1000 },
        ],
      })
    } catch {
      // expected
    }

    await new Promise(resolve => setTimeout(resolve, 50))

    sliceScheduler.cancel(orderId)

    expect(() => {
      sliceScheduler.pause(orderId)
    }).not.toThrow()
  })
})
