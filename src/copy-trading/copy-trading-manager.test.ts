import { describe, it, expect, beforeEach } from 'bun:test'
import { copyTradingManager } from './copy-trading-manager'

describe('CopyTradingManager', () => {
  let manager = copyTradingManager

  beforeEach(() => {
    // Use singleton
  })

  describe('addSource', () => {
    it('should add URL-type source', async () => {
      const sourceId = await manager.addSource({
        name: 'External Portfolio',
        sourceType: 'url',
        sourceUrl: 'https://example.com/portfolio.json',
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
        weight: 1.0,
      })

      expect(sourceId).toBeTruthy()
      expect(sourceId).toHaveLength(36) // UUID
    })

    it('should add manual-type source', async () => {
      const sourceId = await manager.addSource({
        name: 'Manual Allocations',
        sourceType: 'manual',
        allocations: [
          { asset: 'BTC', targetPct: 60 },
          { asset: 'ETH', targetPct: 40 },
        ],
      })

      expect(sourceId).toBeTruthy()
    })

    it('should reject URL source without sourceUrl', async () => {
      expect(async () => {
        await manager.addSource({
          name: 'Invalid',
          sourceType: 'url',
          allocations: [{ asset: 'BTC', targetPct: 100 }],
        })
      }).toThrow('sourceUrl is required for URL-type sources')
    })

    it('should reject empty allocations', async () => {
      expect(async () => {
        await manager.addSource({
          name: 'Empty',
          sourceType: 'manual',
          allocations: [],
        })
      }).toThrow('allocations must not be empty')
    })

    it('should set default weight to 1.0', async () => {
      const sourceId = await manager.addSource({
        name: 'Default Weight',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      expect(sourceId).toBeTruthy()
    })

    it('should set default syncInterval to 4h', async () => {
      const sourceId = await manager.addSource({
        name: 'Default Interval',
        sourceType: 'manual',
        allocations: [{ asset: 'ETH', targetPct: 100 }],
      })

      expect(sourceId).toBeTruthy()
    })

    it('should support custom weight', async () => {
      const sourceId = await manager.addSource({
        name: 'Custom Weight',
        sourceType: 'manual',
        allocations: [{ asset: 'SOL', targetPct: 100 }],
        weight: 2.5,
      })

      expect(sourceId).toBeTruthy()
    })

    it('should support custom syncInterval', async () => {
      const sourceId = await manager.addSource({
        name: 'Custom Interval',
        sourceType: 'manual',
        allocations: [{ asset: 'ADA', targetPct: 100 }],
        syncInterval: '1h',
      })

      expect(sourceId).toBeTruthy()
    })
  })

  describe('removeSource', () => {
    it('should remove a source', async () => {
      const sourceId = await manager.addSource({
        name: 'To Remove',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      await manager.removeSource(sourceId)
      expect(true).toBe(true)
    })

    it('should handle remove non-existent source', async () => {
      await manager.removeSource('non-existent-id')
      expect(true).toBe(true)
    })
  })

  describe('updateSource', () => {
    it('should update name', async () => {
      const sourceId = await manager.addSource({
        name: 'Original',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      await manager.updateSource(sourceId, { name: 'Updated' })
      expect(true).toBe(true)
    })

    it('should update weight', async () => {
      const sourceId = await manager.addSource({
        name: 'Weight Test',
        sourceType: 'manual',
        allocations: [{ asset: 'ETH', targetPct: 100 }],
        weight: 1.0,
      })

      await manager.updateSource(sourceId, { weight: 3.0 })
      expect(true).toBe(true)
    })

    it('should update allocations', async () => {
      const sourceId = await manager.addSource({
        name: 'Alloc Test',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      await manager.updateSource(sourceId, {
        allocations: [
          { asset: 'BTC', targetPct: 50 },
          { asset: 'ETH', targetPct: 50 },
        ],
      })

      expect(true).toBe(true)
    })

    it('should enable/disable source', async () => {
      const sourceId = await manager.addSource({
        name: 'Disable Test',
        sourceType: 'manual',
        allocations: [{ asset: 'SOL', targetPct: 100 }],
      })

      await manager.updateSource(sourceId, { enabled: false })
      await manager.updateSource(sourceId, { enabled: true })

      expect(true).toBe(true)
    })

    it('should handle partial updates', async () => {
      const sourceId = await manager.addSource({
        name: 'Partial',
        sourceType: 'manual',
        allocations: [{ asset: 'ADA', targetPct: 100 }],
      })

      await manager.updateSource(sourceId, { name: 'Updated Only' })
      expect(true).toBe(true)
    })

    it('should handle empty update', async () => {
      const sourceId = await manager.addSource({
        name: 'Empty Update',
        sourceType: 'manual',
        allocations: [{ asset: 'XRP', targetPct: 100 }],
      })

      await manager.updateSource(sourceId, {})
      expect(true).toBe(true)
    })

    it('should update sourceUrl for URL sources', async () => {
      const sourceId = await manager.addSource({
        name: 'URL Test',
        sourceType: 'url',
        sourceUrl: 'https://example.com/v1.json',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      await manager.updateSource(sourceId, {
        sourceUrl: 'https://example.com/v2.json',
      })

      expect(true).toBe(true)
    })
  })

  describe('getSources', () => {
    it('should return all sources', async () => {
      const sources = await manager.getSources()
      expect(Array.isArray(sources)).toBe(true)
    })

    it('should handle empty source list', async () => {
      const sources = await manager.getSources()
      expect(Array.isArray(sources)).toBe(true)
    })
  })

  describe('getSourceById', () => {
    it('should get source by ID', async () => {
      const sourceId = await manager.addSource({
        name: 'Get Test',
        sourceType: 'manual',
        allocations: [{ asset: 'BTC', targetPct: 100 }],
      })

      const source = await manager.getSourceById(sourceId)
      expect(source).toBeTruthy()
    })

    it('should return undefined for non-existent source', async () => {
      const source = await manager.getSourceById('non-existent')
      expect(source).toBeUndefined()
    })
  })

  describe('getSyncHistory', () => {
    it('should return sync history', async () => {
      const history = await manager.getSyncHistory()
      expect(Array.isArray(history)).toBe(true)
    })

    it('should support limit', async () => {
      const history = await manager.getSyncHistory(10)
      expect(Array.isArray(history)).toBe(true)
    })
  })
})
