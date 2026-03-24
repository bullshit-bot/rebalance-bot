# Bun:Test mock.module() Quick Reference Guide

## Quick Start

### Basic Pattern
```typescript
import { describe, it, expect, mock } from 'bun:test'

// 1. Mock FIRST (before any imports)
mock.module('@module/to-mock', () => ({
  exportedName: { method: mock(() => value) }
}))

// 2. Then import (will use mocked dependencies)
import { moduleUnderTest } from './module-under-test'

// 3. Write tests
describe('module-under-test', () => {
  it('should work', async () => {
    const result = await moduleUnderTest.doSomething()
    expect(result).toBeDefined()
  })
})
```

## Mock Patterns by Use Case

### Exchange Operations
```typescript
mock.module('@exchange/exchange-manager', () => ({
  exchangeManager: {
    getExchange: mock((name) => ({
      createOrder: mock(async (pair, type, side, amount, price) => ({
        id: 'order-123',
        filled: amount,
        average: price,
        cost: amount * price,
        status: 'closed'
      })),
      fetchOrder: mock(async (id, pair) => ({
        id, status: 'closed', filled: 1, average: 50000
      })),
      cancelOrder: mock(async (id, pair) => ({ id, status: 'canceled' })),
      fetchBalance: mock(async () => ({
        total: { USDT: 100000, BTC: 1 }
      })),
      fetchOpenOrders: mock(async (pair) => ([
        { id: '999', side: 'buy', amount: 0.5, price: 50000 }
      ])),
      loadMarkets: mock(async () => ({})),
      close: mock(async () => {})
    })),
    getEnabledExchanges: mock(() => new Map([['binance', mockExchange]])),
    initialize: mock(async () => {}),
    shutdown: mock(async () => {})
  }
}))
```

### Price Cache
```typescript
mock.module('@price/price-cache', () => ({
  priceCache: {
    getBestPrice: mock((pair) => 50000),
    set: mock(() => {}),
    get: mock((pair) => ({ price: 50000, bid: 49900, ask: 50100 })),
    clear: mock(() => {}),
    clearStale: mock(() => {})
  }
}))
```

### Database
```typescript
mock.module('@db/database', () => ({
  db: {
    insert: mock((table) => ({
      values: mock(async (data) => ({ changes: 1 }))
    })),
    select: mock(async () => [
      { id: '1', asset: 'BTC', targetPct: 50 }
    ]),
    update: mock((table) => ({
      set: mock(() => ({
        where: mock(async () => ({ changes: 1 }))
      }))
    }))
  }
}))
```

### Event Bus
```typescript
mock.module('@events/event-bus', () => ({
  eventBus: {
    emit: mock(() => {}),
    on: mock(() => {}),
    off: mock(() => {}),
    once: mock(() => {})
  }
}))
```

### Config/Environment
```typescript
mock.module('@config/app-config', () => ({
  env: {
    BINANCE_API_KEY: 'test-key',
    BINANCE_API_SECRET: 'test-secret',
    OKX_API_KEY: undefined,
    OKX_API_SECRET: undefined,
    REBALANCE_THRESHOLD: 5,
    REBALANCE_COOLDOWN_HOURS: 1
  }
}))
```

## Common Test Patterns

### Test Happy Path
```typescript
it('should execute successfully', async () => {
  const order = { exchange: 'binance', pair: 'BTC/USDT', side: 'buy', amount: 0.1 }
  const result = await orderExecutor.execute(order)

  expect(result).toBeDefined()
  expect(result.pair).toBe('BTC/USDT')
  expect(result.amount).toBeGreaterThan(0)
})
```

### Test Error Handling
```typescript
it('should handle missing exchange', async () => {
  try {
    await orderExecutor.execute(order)
    expect(true).toBe(false) // Should have thrown
  } catch (error) {
    expect(error).toBeDefined()
    expect(error.message).toContain('exchange')
  }
})
```

### Test Batch Operations
```typescript
it('should continue on error', async () => {
  const orders = [
    { exchange: 'binance', pair: 'BTC/USDT', side: 'buy', amount: 0.1 },
    { exchange: 'unknown', pair: 'ETH/USDT', side: 'sell', amount: 1 }
  ]

  const results = await orderExecutor.executeBatch(orders)
  expect(Array.isArray(results)).toBe(true)
  // Batch doesn't throw even if some fail
})
```

### Test Lifecycle
```typescript
it('should start and stop cleanly', async () => {
  await manager.initialize()
  expect(manager.getEnabledExchanges().size).toBeGreaterThanOrEqual(0)

  await manager.shutdown()
  expect(manager.getEnabledExchanges().size).toBe(0)
})
```

### Test State Changes
```typescript
it('should track state', async () => {
  expect(detector.canRebalance()).toBe(false) // Before start

  detector.start()
  const result = detector.canRebalance()
  expect(typeof result).toBe('boolean')

  detector.stop()
  expect(detector.canRebalance()).toBe(false) // After stop
})
```

## Mock Verification

### Check if mock was called
```typescript
const emitMock = mock(() => {})
mock.module('@events/event-bus', () => ({
  eventBus: { emit: emitMock }
}))

// After running tests:
expect(emitMock).toHaveBeenCalled()
expect(emitMock).toHaveBeenCalledWith('rebalance:trigger', expect.any(Object))
expect(emitMock.mock.calls.length).toBeGreaterThan(0)
```

### Clear mock between tests
```typescript
beforeEach(() => {
  emitMock.mockClear()
})
```

## Timeout Configuration

### Long-running async tests
```typescript
it('should handle polling', async () => {
  const result = await orderExecutor.execute(order)
  expect(result).toBeDefined()
}, { timeout: 10000 }) // 10 seconds
```

## Common Pitfalls

### ❌ DON'T: Import before mocking
```typescript
// WRONG - module loads before mocks are set up
import { orderExecutor } from './order-executor'

mock.module('@exchange/exchange-manager', () => ({ ... }))
```

### ✅ DO: Mock first, import second
```typescript
// CORRECT - mocks set up first
mock.module('@exchange/exchange-manager', () => ({ ... }))

import { orderExecutor } from './order-executor'
```

### ❌ DON'T: Return undefined from mocks
```typescript
// WRONG - causes "X is not a function" errors
getBestPrice: mock(() => undefined)
```

### ✅ DO: Return sensible defaults
```typescript
// CORRECT
getBestPrice: mock((pair) => 50000) // Always returns a number
```

### ❌ DON'T: Use old mock syntax
```typescript
// WRONG - bun:test uses mock() not vi.fn()
vi.fn()
```

### ✅ DO: Use bun:test mock
```typescript
// CORRECT
import { mock } from 'bun:test'
const fn = mock(() => {})
```

## Coverage Targets

**Good:** 80%+ line coverage
**Excellent:** 90%+ line coverage
**Target:** 95%+ for critical paths

## Test File Structure

```typescript
// tests/module.integration.test.ts
import { describe, it, expect, mock } from 'bun:test'

// Mocks FIRST
mock.module('@deps/dep1', () => ({ ... }))
mock.module('@deps/dep2', () => ({ ... }))

// Imports SECOND
import { moduleUnderTest } from '../module'

// Tests THIRD
describe('moduleUnderTest', () => {
  describe('feature 1', () => {
    it('should work', () => { ... })
  })
})
```

## Real Example: order-executor

**Files mocked for 30 tests:**
- @exchange/exchange-manager - createOrder, fetchOrder, cancelOrder, fetchBalance, fetchOpenOrders
- @price/price-cache - getBestPrice, set, get, clear
- @executor/execution-guard - canExecute, recordTrade
- @events/event-bus - emit, on, off
- @db/database - insert, select, update

**Result:** 84% line coverage in single test file

## Performance Tips

1. **Mock heavy operations:** Polling, network calls, DB operations
2. **Use immediate returns:** Don't add artificial delays to mocks
3. **Batch related tests:** Test all features of one class together
4. **Async timeouts:** Increase timeout only if actually needed (polling, waiting)
5. **Clear mocks:** Call mockClear() if tracking call counts between tests

## Resources

- Bun docs: https://bun.sh/docs/test/mocking
- Test file examples: src/executor/order-executor.integration.test.ts
- Full coverage pattern: src/exchange/exchange-manager.integration.test.ts
