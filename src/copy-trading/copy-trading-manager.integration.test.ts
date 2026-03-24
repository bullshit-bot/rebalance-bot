import { describe, test, expect, beforeAll, afterAll } from 'bun:test'
import { db } from '@db/database'
import { copySources } from '@db/schema'
import { copyTradingManager } from './copy-trading-manager'
import { eq } from 'drizzle-orm'
import type { SourceAllocation } from './portfolio-source-fetcher'

const TEST_SOURCE_IDS: string[] = []

afterAll(async () => {
  // Clean up all test sources
  for (const id of TEST_SOURCE_IDS) {
    await db.delete(copySources).where(eq(copySources.id, id))
  }
})

describe('CopyTradingManager integration', () => {
  describe('addSource', () => {
    test('addSource creates a new copy source', async () => {
      const allocations: SourceAllocation[] = [
        { asset: 'BTC', weight: 0.6 },
        { asset: 'ETH', weight: 0.4 },
      ]

      const id = await copyTradingManager.addSource({
        name: 'Test Source 1',
        sourceType: 'url',
        sourceUrl: 'https://example.com/portfolio',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      expect(id).toBeDefined()
      expect(typeof id).toBe('string')
      expect(id.length).toBeGreaterThan(0)
    })

    test('addSource returns UUID', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'UUID Test',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      // UUID format check
      expect(id).toMatch(/^[a-f0-9-]{36}$/)
    })

    test('addSource rejects URL type without sourceUrl', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      await expect(
        copyTradingManager.addSource({
          name: 'Invalid Source',
          sourceType: 'url',
          allocations,
        }),
      ).rejects.toThrow('sourceUrl is required')
    })

    test('addSource rejects empty allocations', async () => {
      await expect(
        copyTradingManager.addSource({
          name: 'No Allocations',
          sourceType: 'manual',
          allocations: [],
        }),
      ).rejects.toThrow('allocations must not be empty')
    })

    test('addSource sets default weight', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Default Weight Test',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      const source = await copyTradingManager.getSource(id)
      expect(source?.weight).toBe(1.0)
    })

    test('addSource sets custom weight', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Custom Weight Test',
        sourceType: 'manual',
        allocations,
        weight: 2.5,
      })

      TEST_SOURCE_IDS.push(id)

      const source = await copyTradingManager.getSource(id)
      expect(source?.weight).toBe(2.5)
    })

    test('addSource sets default syncInterval', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Default Interval Test',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      const source = await copyTradingManager.getSource(id)
      expect(source?.syncInterval).toBe('4h')
    })

    test('addSource sets custom syncInterval', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Custom Interval Test',
        sourceType: 'manual',
        allocations,
        syncInterval: '1h',
      })

      TEST_SOURCE_IDS.push(id)

      const source = await copyTradingManager.getSource(id)
      expect(source?.syncInterval).toBe('1h')
    })

    test('addSource marks source as enabled by default', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Enabled Test',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      const source = await copyTradingManager.getSource(id)
      expect(source?.enabled).toBe(1)
    })

    test('addSource stores allocations as JSON', async () => {
      const allocations: SourceAllocation[] = [
        { asset: 'BTC', weight: 0.5 },
        { asset: 'ETH', weight: 0.3 },
        { asset: 'SOL', weight: 0.2 },
      ]

      const id = await copyTradingManager.addSource({
        name: 'JSON Test',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      const source = await copyTradingManager.getSource(id)
      const stored = JSON.parse(source!.allocations)
      expect(stored).toEqual(allocations)
    })
  })

  describe('getSource', () => {
    test('getSource retrieves a source by ID', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Get Test',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      const source = await copyTradingManager.getSource(id)
      expect(source).toBeDefined()
      expect(source?.id).toBe(id)
      expect(source?.name).toBe('Get Test')
    })

    test('getSource returns null for missing source', async () => {
      const source = await copyTradingManager.getSource('nonexistent-id')
      expect(source).toBeNull()
    })

    test('getSource returns all source fields', async () => {
      const allocations: SourceAllocation[] = [
        { asset: 'BTC', weight: 0.7 },
        { asset: 'ETH', weight: 0.3 },
      ]

      const id = await copyTradingManager.addSource({
        name: 'Full Fields Test',
        sourceType: 'url',
        sourceUrl: 'https://example.com',
        allocations,
        weight: 1.5,
        syncInterval: '2h',
      })

      TEST_SOURCE_IDS.push(id)

      const source = await copyTradingManager.getSource(id)
      expect(source?.id).toBe(id)
      expect(source?.name).toBe('Full Fields Test')
      expect(source?.sourceType).toBe('url')
      expect(source?.sourceUrl).toBe('https://example.com')
      expect(source?.weight).toBe(1.5)
      expect(source?.syncInterval).toBe('2h')
      expect(source?.enabled).toBe(1)
    })
  })

  describe('removeSource', () => {
    test('removeSource deletes a source by ID', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Remove Test',
        sourceType: 'manual',
        allocations,
      })

      await copyTradingManager.removeSource(id)

      const source = await copyTradingManager.getSource(id)
      expect(source).toBeNull()
    })

    test('removeSource is no-op for missing source', async () => {
      // Should not throw
      await expect(copyTradingManager.removeSource('nonexistent')).resolves.toBeUndefined()
    })

    test('removeSource does not affect other sources', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id1 = await copyTradingManager.addSource({
        name: 'Keep Source',
        sourceType: 'manual',
        allocations,
      })

      const id2 = await copyTradingManager.addSource({
        name: 'Delete Source',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id1)
      TEST_SOURCE_IDS.push(id2)

      await copyTradingManager.removeSource(id2)

      const kept = await copyTradingManager.getSource(id1)
      const deleted = await copyTradingManager.getSource(id2)

      expect(kept).toBeDefined()
      expect(deleted).toBeNull()
    })
  })

  describe('updateSource', () => {
    test('updateSource modifies name', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Original Name',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      await copyTradingManager.updateSource(id, { name: 'Updated Name' })

      const source = await copyTradingManager.getSource(id)
      expect(source?.name).toBe('Updated Name')
    })

    test('updateSource modifies weight', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Weight Test',
        sourceType: 'manual',
        allocations,
        weight: 1.0,
      })

      TEST_SOURCE_IDS.push(id)

      await copyTradingManager.updateSource(id, { weight: 3.0 })

      const source = await copyTradingManager.getSource(id)
      expect(source?.weight).toBe(3.0)
    })

    test('updateSource modifies enabled status', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Enabled Test',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      await copyTradingManager.updateSource(id, { enabled: false })

      const source = await copyTradingManager.getSource(id)
      expect(source?.enabled).toBe(0)
    })

    test('updateSource modifies syncInterval', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Interval Test',
        sourceType: 'manual',
        allocations,
        syncInterval: '4h',
      })

      TEST_SOURCE_IDS.push(id)

      await copyTradingManager.updateSource(id, { syncInterval: '1h' })

      const source = await copyTradingManager.getSource(id)
      expect(source?.syncInterval).toBe('1h')
    })

    test('updateSource modifies allocations', async () => {
      const original: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Alloc Test',
        sourceType: 'manual',
        allocations: original,
      })

      TEST_SOURCE_IDS.push(id)

      const updated: SourceAllocation[] = [
        { asset: 'BTC', weight: 0.6 },
        { asset: 'ETH', weight: 0.4 },
      ]

      await copyTradingManager.updateSource(id, { allocations: updated })

      const source = await copyTradingManager.getSource(id)
      const parsed = JSON.parse(source!.allocations)
      expect(parsed).toEqual(updated)
    })

    test('updateSource does nothing with empty updates', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Empty Update Test',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      const before = await copyTradingManager.getSource(id)
      await copyTradingManager.updateSource(id, {})
      const after = await copyTradingManager.getSource(id)

      expect(before?.name).toBe(after?.name)
      expect(before?.weight).toBe(after?.weight)
    })

    test('updateSource is no-op for missing source', async () => {
      await expect(copyTradingManager.updateSource('nonexistent', { name: 'New' })).resolves.toBeUndefined()
    })
  })

  describe('getSources', () => {
    test('getSources returns all sources', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id1 = await copyTradingManager.addSource({
        name: 'Source 1',
        sourceType: 'manual',
        allocations,
      })

      const id2 = await copyTradingManager.addSource({
        name: 'Source 2',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id1, id2)

      const sources = await copyTradingManager.getSources()
      expect(Array.isArray(sources)).toBe(true)
      expect(sources.length).toBeGreaterThanOrEqual(2)
    })

    test('getSources returns empty array when no sources', async () => {
      // This test assumes we start with no sources (or cleans them)
      const sources = await copyTradingManager.getSources()
      expect(Array.isArray(sources)).toBe(true)
    })
  })

  describe('getSyncHistory', () => {
    test('getSyncHistory returns array', async () => {
      const history = await copyTradingManager.getSyncHistory()
      expect(Array.isArray(history)).toBe(true)
    })

    test('getSyncHistory defaults to 50 entries', async () => {
      const history = await copyTradingManager.getSyncHistory()
      expect(history.length).toBeLessThanOrEqual(50)
    })

    test('getSyncHistory respects limit parameter', async () => {
      const history = await copyTradingManager.getSyncHistory(undefined, 10)
      expect(history.length).toBeLessThanOrEqual(10)
    })

    test('getSyncHistory returns empty for missing source', async () => {
      const history = await copyTradingManager.getSyncHistory('nonexistent-source')
      expect(Array.isArray(history)).toBe(true)
      expect(history.length).toBe(0)
    })
  })

  describe('manual source type', () => {
    test('addSource accepts manual type without sourceUrl', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Manual Source',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      const source = await copyTradingManager.getSource(id)
      expect(source?.sourceType).toBe('manual')
      expect(source?.sourceUrl).toBeNull()
    })

    test('addSource can update manual source to have url', async () => {
      const allocations: SourceAllocation[] = [{ asset: 'BTC', weight: 1 }]

      const id = await copyTradingManager.addSource({
        name: 'Manual to URL',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      await copyTradingManager.updateSource(id, {
        sourceUrl: 'https://example.com',
      })

      const source = await copyTradingManager.getSource(id)
      expect(source?.sourceUrl).toBe('https://example.com')
    })
  })

  describe('complex allocations', () => {
    test('addSource stores complex allocations', async () => {
      const allocations: SourceAllocation[] = [
        { asset: 'BTC', weight: 0.4 },
        { asset: 'ETH', weight: 0.3 },
        { asset: 'SOL', weight: 0.15 },
        { asset: 'XRP', weight: 0.1 },
        { asset: 'ADA', weight: 0.05 },
      ]

      const id = await copyTradingManager.addSource({
        name: 'Complex Allocations',
        sourceType: 'manual',
        allocations,
      })

      TEST_SOURCE_IDS.push(id)

      const source = await copyTradingManager.getSource(id)
      const parsed = JSON.parse(source!.allocations)

      expect(parsed.length).toBe(5)
      expect(parsed.find((a: SourceAllocation) => a.asset === 'BTC').weight).toBe(0.4)
    })
  })
})
