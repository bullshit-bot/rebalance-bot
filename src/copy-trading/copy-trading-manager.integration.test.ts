import { describe, it, expect, beforeAll, afterAll } from 'bun:test'
import { db } from '@db/database'
import { copySources, copySyncLog } from '@db/schema'
import { eq } from 'drizzle-orm'
import { copyTradingManager } from './copy-trading-manager'

describe('copy-trading-manager', () => {
  let testSourceId: string

  beforeAll(async () => {
    // Clean up test data
    await db.delete(copySyncLog)
    await db.delete(copySources)
  })

  afterAll(async () => {
    // Clean up test data
    await db.delete(copySyncLog)
    await db.delete(copySources)
  })

  describe('addSource', () => {
    it('should add a manual source', async () => {
      const id = await copyTradingManager.addSource({
        name: 'Test Manual Source',
        sourceType: 'manual',
        allocations: [
          { asset: 'BTC', targetPct: 60 },
          { asset: 'ETH', targetPct: 40 },
        ],
      })

      testSourceId = id
      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    it('should throw error when URL type missing sourceUrl', async () => {
      try {
        await copyTradingManager.addSource({
          name: 'Bad URL Source',
          sourceType: 'url',
          allocations: [{ asset: 'BTC', targetPct: 100 }],
        })
        expect(true).toBe(false)
      } catch (err) {
        expect(err instanceof Error).toBe(true)
        if (err instanceof Error) {
          expect(err.message).toContain('sourceUrl')
        }
      }
    })

    it('should throw error when allocations empty', async () => {
      try {
        await copyTradingManager.addSource({
          name: 'Empty Allocations',
          sourceType: 'manual',
          allocations: [],
        })
        expect(true).toBe(false)
      } catch (err) {
        expect(err instanceof Error).toBe(true)
      }
    })

    it('should add source with weight and syncInterval', async () => {
      const id = await copyTradingManager.addSource({
        name: 'Advanced Source',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
        weight: 2.0,
        syncInterval: '2h',
      })

      expect(id).toBeDefined()
    })
  })

  describe('getSources', () => {
    it('should return all sources', async () => {
      const sources = await copyTradingManager.getSources()

      expect(Array.isArray(sources)).toBe(true)
      expect(sources.length).toBeGreaterThan(0)
    })

    it('should include added source in list', async () => {
      const id = await copyTradingManager.addSource({
        name: 'List Test Source',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      const sources = await copyTradingManager.getSources()
      const found = sources.find((s) => s.id === id)

      expect(found).toBeDefined()
    })
  })

  describe('removeSource', () => {
    it('should remove a source', async () => {
      const id = await copyTradingManager.addSource({
        name: 'To Remove',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      // Remove related sync logs first
      await db.delete(copySyncLog).where(eq(copySyncLog.sourceId, id))
      await copyTradingManager.removeSource(id)

      const sources = await copyTradingManager.getSources()
      const found = sources.find((s) => s.id === id)

      expect(found).toBeUndefined()
    })

    it('should be idempotent (no error when removing non-existent)', async () => {
      await expect(async () => {
        await copyTradingManager.removeSource('non-existent-id')
      }).not.toThrow()
    })
  })

  describe('updateSource', () => {
    it('should update source name', async () => {
      const id = await copyTradingManager.addSource({
        name: 'Original Name',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      await copyTradingManager.updateSource(id, { name: 'Updated Name' })

      const sources = await copyTradingManager.getSources()
      const updated = sources.find((s) => s.id === id)

      expect(updated?.name).toBe('Updated Name')
    })

    it('should update enabled flag', async () => {
      const id = await copyTradingManager.addSource({
        name: 'Enable Test',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      await copyTradingManager.updateSource(id, { enabled: false })

      const sources = await copyTradingManager.getSources()
      const updated = sources.find((s) => s.id === id)

      expect(updated?.enabled).toBe(0)
    })

    it('should update allocations', async () => {
      const id = await copyTradingManager.addSource({
        name: 'Allocation Test',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      await copyTradingManager.updateSource(id, {
        allocations: [
          { asset: 'BTC', targetPct: 60 },
          { asset: 'ETH', targetPct: 40 },
        ],
      })

      const sources = await copyTradingManager.getSources()
      const updated = sources.find((s) => s.id === id)

      const allocs = JSON.parse(updated?.allocations || '[]')
      expect(allocs.length).toBe(2)
    })
  })

  describe('getSyncHistory', () => {
    it('should return sync history', async () => {
      const id = await copyTradingManager.addSource({
        name: 'History Test',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      const history = await copyTradingManager.getSyncHistory(id)

      expect(Array.isArray(history)).toBe(true)
    })
  })

  describe('edge cases', () => {
    it('should handle source with many allocations', async () => {
      const allocations = Array.from({ length: 50 }, (_, i) => ({
        asset: `COIN${i}`,
        targetPct: 2,
      }))

      const id = await copyTradingManager.addSource({
        name: 'Many Allocations',
        sourceType: 'manual',
        allocations,
      })

      expect(id).toBeDefined()

      const sources = await copyTradingManager.getSources()
      const found = sources.find((s) => s.id === id)
      const foundAllocs = JSON.parse(found?.allocations || '[]')
      expect(foundAllocs.length).toBe(50)
    })

    it('should handle special characters in name', async () => {
      const id = await copyTradingManager.addSource({
        name: 'Special!@#$%^&*() Name',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      const sources = await copyTradingManager.getSources()
      const found = sources.find((s) => s.id === id)

      expect(found?.name).toContain('Special')
    })
  })
})
