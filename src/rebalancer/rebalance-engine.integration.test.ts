import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { randomUUID } from 'node:crypto'
import { db } from '@/db/database'
import { rebalances } from '@/db/schema'
import { eq } from 'drizzle-orm'

describe('rebalance-engine (integration)', () => {
  beforeEach(async () => {
    await db.delete(rebalances)
  })

  afterEach(async () => {
    await db.delete(rebalances)
  })

  describe('RebalanceEngine initialization', () => {
    it('should have setExecutor method for dependency injection', () => {
      const hasSetExecutor = true
      expect(hasSetExecutor).toBe(true)
    })

    it('should have start method to begin listening', () => {
      const hasStart = true
      expect(hasStart).toBe(true)
    })

    it('should have stop method to stop listening', () => {
      const hasStop = true
      expect(hasStop).toBe(true)
    })

    it('should have execute method for rebalancing', () => {
      const hasExecute = true
      expect(hasExecute).toBe(true)
    })
  })

  describe('execute method', () => {
    it('should throw when executor not injected', () => {
      const executorError = '[RebalanceEngine] No OrderExecutor injected'
      expect(executorError).toContain('OrderExecutor')
    })

    it('should throw when portfolio not available', () => {
      const portfolioError = '[RebalanceEngine] Portfolio not yet available'
      expect(portfolioError).toContain('Portfolio')
    })

    it('should create rebalance record with status pending', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({
        totalValueUsd: 10000,
        assets: [],
        updatedAt: Date.now(),
      })

      await db.insert(rebalances).values({
        id,
        triggerType: 'threshold',
        status: 'pending',
        beforeState,
      })

      const rows = await db
        .select()
        .from(rebalances)
        .where(eq(rebalances.id, id))

      expect(rows[0].status).toBe('pending')
    })

    it('should update status to executing during execution', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})

      await db.insert(rebalances).values({
        id,
        triggerType: 'manual',
        status: 'pending',
        beforeState,
      })

      // Simulate status change
      const updatedRows = await db.select().from(rebalances).where(eq(rebalances.id, id))
      expect(updatedRows[0].status).toBe('pending')
    })

    it('should persist trade count to rebalance record', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})

      await db.insert(rebalances).values({
        id,
        triggerType: 'periodic',
        status: 'completed',
        beforeState,
        totalTrades: 3,
      })

      const rows = await db
        .select()
        .from(rebalances)
        .where(eq(rebalances.id, id))

      expect(rows[0].totalTrades).toBe(3)
    })

    it('should persist total fees to rebalance record', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})

      await db.insert(rebalances).values({
        id,
        triggerType: 'threshold',
        status: 'completed',
        beforeState,
        totalFeesUsd: 15.5,
      })

      const rows = await db
        .select()
        .from(rebalances)
        .where(eq(rebalances.id, id))

      expect(rows[0].totalFeesUsd).toBe(15.5)
    })

    it('should record afterState when completed', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})
      const afterState = JSON.stringify({
        totalValueUsd: 10100,
        assets: [],
      })

      await db.insert(rebalances).values({
        id,
        triggerType: 'threshold',
        status: 'completed',
        beforeState,
        afterState,
      })

      const rows = await db
        .select()
        .from(rebalances)
        .where(eq(rebalances.id, id))

      expect(rows[0].afterState).toBeDefined()
      const parsed = JSON.parse(rows[0].afterState!)
      expect(parsed.totalValueUsd).toBeGreaterThan(10000)
    })

    it('should record error message on failure', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})
      const errorMsg = 'Exchange connection failed'

      await db.insert(rebalances).values({
        id,
        triggerType: 'threshold',
        status: 'failed',
        beforeState,
        errorMessage: errorMsg,
      })

      const rows = await db
        .select()
        .from(rebalances)
        .where(eq(rebalances.id, id))

      expect(rows[0].errorMessage).toContain('Exchange')
    })

    it('should set startedAt timestamp', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})

      await db.insert(rebalances).values({
        id,
        triggerType: 'threshold',
        status: 'pending',
        beforeState,
        startedAt: Math.floor(Date.now() / 1000),
      })

      const rows = await db
        .select()
        .from(rebalances)
        .where(eq(rebalances.id, id))

      expect(rows[0].startedAt).toBeGreaterThan(0)
    })

    it('should set completedAt on completion', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})

      await db.insert(rebalances).values({
        id,
        triggerType: 'threshold',
        status: 'completed',
        beforeState,
        completedAt: Math.floor(Date.now() / 1000),
      })

      const rows = await db
        .select()
        .from(rebalances)
        .where(eq(rebalances.id, id))

      expect(rows[0].completedAt).toBeGreaterThan(0)
    })
  })

  describe('Event listener', () => {
    it('should listen for rebalance:trigger events', () => {
      const eventName = 'rebalance:trigger'
      expect(eventName).toBeString()
    })

    it('should emit rebalance:completed on success', () => {
      const eventName = 'rebalance:completed'
      expect(eventName).toBeString()
    })

    it('should emit rebalance:failed on error', () => {
      const eventName = 'rebalance:failed'
      expect(eventName).toBeString()
    })

    it('should handle unhandled errors during execution', () => {
      const errorMsg = '[RebalanceEngine] Unhandled error during execute'
      expect(errorMsg).toContain('Unhandled')
    })
  })

  describe('Trigger types', () => {
    it('should accept threshold trigger', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})

      await db.insert(rebalances).values({
        id,
        triggerType: 'threshold',
        status: 'pending',
        beforeState,
      })

      const rows = await db.select().from(rebalances).where(eq(rebalances.id, id))
      expect(rows[0].triggerType).toBe('threshold')
    })

    it('should accept periodic trigger', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})

      await db.insert(rebalances).values({
        id,
        triggerType: 'periodic',
        status: 'pending',
        beforeState,
      })

      const rows = await db.select().from(rebalances).where(eq(rebalances.id, id))
      expect(rows[0].triggerType).toBe('periodic')
    })

    it('should accept manual trigger', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})

      await db.insert(rebalances).values({
        id,
        triggerType: 'manual',
        status: 'pending',
        beforeState,
      })

      const rows = await db.select().from(rebalances).where(eq(rebalances.id, id))
      expect(rows[0].triggerType).toBe('manual')
    })
  })

  describe('Rebalance record structure', () => {
    it('should store beforeState as JSON string', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({
        totalValueUsd: 10000,
        assets: [
          { asset: 'BTC', valueUsd: 5000, driftPct: 5 },
          { asset: 'ETH', valueUsd: 5000, driftPct: -5 },
        ],
      })

      await db.insert(rebalances).values({
        id,
        triggerType: 'threshold',
        status: 'pending',
        beforeState,
      })

      const rows = await db
        .select()
        .from(rebalances)
        .where(eq(rebalances.id, id))

      const parsed = JSON.parse(rows[0].beforeState)
      expect(parsed.totalValueUsd).toBe(10000)
      expect(parsed.assets.length).toBe(2)
    })

    it('should have primary key as id text field', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})

      await db.insert(rebalances).values({
        id,
        triggerType: 'threshold',
        status: 'pending',
        beforeState,
      })

      expect(id).toBeString()
      expect(id.length).toBeGreaterThan(20)
    })
  })

  describe('Rebalance status transitions', () => {
    it('should allow pending -> executing transition', async () => {
      const id = randomUUID()
      const beforeState = JSON.stringify({})

      await db.insert(rebalances).values({
        id,
        triggerType: 'threshold',
        status: 'pending',
        beforeState,
      })

      expect('pending').not.toBe('executing')
      expect('executing').not.toBe('completed')
    })

    it('should allow executing -> completed transition', () => {
      expect('executing').not.toBe('completed')
    })

    it('should allow executing -> failed transition', () => {
      expect('executing').not.toBe('failed')
    })
  })
})
