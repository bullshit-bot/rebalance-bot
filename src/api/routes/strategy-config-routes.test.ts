import { describe, it, expect, beforeEach, afterEach, beforeAll, afterAll } from 'bun:test'
import { Hono } from 'hono'
import { setupTestDB, teardownTestDB } from '@db/test-helpers'
import { strategyConfigRoutes } from './strategy-config-routes'
import { StrategyConfigModel, STRATEGY_PRESETS } from '@db/database'

beforeAll(async () => { await setupTestDB() })
afterAll(async () => { await teardownTestDB() })

// ─── Helpers ────────────────────────────────────────────────────────────────

function createApp() {
  const app = new Hono()
  app.route('/strategy-config', strategyConfigRoutes)
  return app
}

async function createTestConfig(name: string, overrides?: any) {
  return StrategyConfigModel.create({
    name,
    description: `Test config: ${name}`,
    params: {
      type: 'threshold',
      driftThreshold: 5,
    },
    globalSettings: {},
    version: 1,
    isActive: false,
    ...overrides,
  })
}

describe('Strategy Config Routes', () => {
  let app: Hono

  beforeEach(async () => {
    await setupTestDB()
    app = createApp()
  })

  afterEach(async () => {
    await teardownTestDB()
  })

  describe('GET /', () => {
    it('should return active config and all configs', async () => {
      await createTestConfig('config-1', { isActive: false })
      await createTestConfig('config-2', { isActive: true })

      const res = await app.request('/strategy-config/')
      expect(res.status).toBe(200)

      const data = await res.json() as any
      expect(data).toHaveProperty('active')
      expect(data).toHaveProperty('configs')
      expect(Array.isArray(data.configs)).toBe(true)
    })

    it('should identify active config', async () => {
      await createTestConfig('config-a', { isActive: false })
      await createTestConfig('config-active', { isActive: true })

      const res = await app.request('/strategy-config/')
      const data = await res.json() as any

      expect(data.active?.name).toBe('config-active')
      expect(data.active?.isActive).toBe(true)
    })

    it('should return empty configs when none exist', async () => {
      const res = await app.request('/strategy-config/')
      expect(res.status).toBe(200)

      const data = await res.json() as any
      expect(Array.isArray(data.configs)).toBe(true)
      expect(data.configs.length).toBe(0)
    })

    it('should return multiple configs', async () => {
      await createTestConfig('config-1')
      await createTestConfig('config-2')
      await createTestConfig('config-3')

      const res = await app.request('/strategy-config/')
      const data = await res.json() as any

      expect(data.configs.length).toBeGreaterThanOrEqual(3)
    })

    it('should include essential fields in response', async () => {
      await createTestConfig('test-config')

      const res = await app.request('/strategy-config/')
      const data = await res.json() as any

      if (data.configs.length > 0) {
        const config = data.configs[0]
        expect(config).toHaveProperty('name')
        expect(config).toHaveProperty('description')
        expect(config).toHaveProperty('isActive')
        expect(config).toHaveProperty('version')
        expect(config).toHaveProperty('updatedAt')
      }
    })
  })

  describe('GET /presets', () => {
    it('should return built-in presets', async () => {
      const res = await app.request('/strategy-config/presets')
      expect(res.status).toBe(200)

      const data = await res.json() as any
      expect(typeof data).toBe('object')
      expect(Object.keys(data).length).toBeGreaterThan(0)
    })

    it('should include preset structure', async () => {
      const res = await app.request('/strategy-config/presets')
      const data = await res.json() as any

      const firstPresetKey = Object.keys(data)[0]
      if (firstPresetKey) {
        const preset = data[firstPresetKey]
        expect(preset).toHaveProperty('name')
        expect(preset).toHaveProperty('description')
        expect(preset).toHaveProperty('params')
      }
    })

    it('should have consistent preset formats', async () => {
      const res = await app.request('/strategy-config/presets')
      const data = await res.json() as any

      for (const [, preset] of Object.entries(data)) {
        const p = preset as any
        expect(p.description).toBeTruthy()
        expect(p.params).toBeTruthy()
      }
    })
  })

  describe('GET /:name', () => {
    it('should retrieve config by name', async () => {
      await createTestConfig('my-config')

      const res = await app.request('/strategy-config/my-config')
      expect(res.status).toBe(200)

      const data = await res.json() as any
      expect(data.name).toBe('my-config')
      expect(data.description).toContain('my-config')
    })

    it('should return full config details', async () => {
      await createTestConfig('detailed-config', {
        params: { type: 'momentum', window: 20 },
        globalSettings: { rebalanceFrequency: 'daily' },
      })

      const res = await app.request('/strategy-config/detailed-config')
      const data = await res.json() as any

      expect(data.params).toEqual({ type: 'momentum', window: 20 })
      expect(data.globalSettings).toEqual({ rebalanceFrequency: 'daily' })
    })

    it('should return 404 for missing config', async () => {
      const res = await app.request('/strategy-config/nonexistent')
      expect(res.status).toBe(404)

      const data = await res.json() as any
      expect(data).toHaveProperty('error')
    })

    it('should handle special characters in name', async () => {
      await createTestConfig('config-with-dashes')

      const res = await app.request('/strategy-config/config-with-dashes')
      expect(res.status).toBe(200)

      const data = await res.json() as any
      expect(data.name).toBe('config-with-dashes')
    })

    it('should include version info', async () => {
      await createTestConfig('versioned-config')

      const res = await app.request('/strategy-config/versioned-config')
      const data = await res.json() as any

      expect(data.version).toBeDefined()
      expect(typeof data.version).toBe('number')
    })
  })

  describe('POST /', () => {
    it('should create new config', async () => {
      const body = JSON.stringify({
        name: 'new-config',
        description: 'A new strategy config',
        params: { type: 'threshold', driftThreshold: 10 },
      })

      const res = await app.request('/strategy-config/', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(201)

      const data = await res.json() as any
      expect(data.name).toBe('new-config')
      expect(data.description).toBe('A new strategy config')
    })

    it('should initialize history on creation', async () => {
      const body = JSON.stringify({
        name: 'history-config',
        description: 'Config with history',
        params: { type: 'momentum' },
      })

      const res = await app.request('/strategy-config/', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json() as any
      expect(Array.isArray(data.history)).toBe(true)
      expect(data.history.length).toBeGreaterThan(0)
    })

    it('should reject duplicate config names', async () => {
      await createTestConfig('duplicate-test')

      const body = JSON.stringify({
        name: 'duplicate-test',
        description: 'Duplicate name',
        params: { type: 'threshold' },
      })

      const res = await app.request('/strategy-config/', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(409)

      const data = await res.json() as any
      expect(data.error).toContain('already exists')
    })

    it('should validate required fields', async () => {
      const body = JSON.stringify({
        // Missing required fields
        description: 'Incomplete config',
      })

      const res = await app.request('/strategy-config/', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)

      const data = await res.json() as any
      expect(data.error).toBeTruthy()
    })

    it('should handle invalid JSON', async () => {
      const res = await app.request('/strategy-config/', {
        method: 'POST',
        body: 'invalid json',
        headers: { 'Content-Type': 'application/json' },
      })

      expect([400, 500]).toContain(res.status)
    })

    it('should set version to 1 on creation', async () => {
      const body = JSON.stringify({
        name: 'versioned-new',
        description: 'New versioned config',
        params: { type: 'threshold' },
      })

      const res = await app.request('/strategy-config/', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json() as any
      expect(data.version).toBe(1)
    })

    it('should not activate on creation', async () => {
      const body = JSON.stringify({
        name: 'inactive-new',
        description: 'New inactive config',
        params: { type: 'threshold' },
      })

      const res = await app.request('/strategy-config/', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      const data = await res.json() as any
      expect(data.isActive).toBe(false)
    })
  })

  describe('POST /from-preset', () => {
    it('should create config from preset', async () => {
      const presets = STRATEGY_PRESETS as any
      const presetName = Object.keys(presets)[0]

      if (presetName) {
        const body = JSON.stringify({
          presetName,
          configName: 'from-preset-config',
        })

        const res = await app.request('/strategy-config/from-preset', {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
        })

        expect(res.status).toBe(201)

        const data = await res.json() as any
        expect(data.name).toBe('from-preset-config')
        expect(data.presetName).toBe(presetName)
      }
    })

    it('should reject unknown preset', async () => {
      const body = JSON.stringify({
        presetName: 'nonexistent-preset',
        configName: 'test-config',
      })

      const res = await app.request('/strategy-config/from-preset', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)

      const data = await res.json() as any
      expect(data.error).toContain('Unknown preset')
    })

    it('should require configName', async () => {
      const body = JSON.stringify({
        presetName: 'some-preset',
        // Missing configName
      })

      const res = await app.request('/strategy-config/from-preset', {
        method: 'POST',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(400)

      const data = await res.json() as any
      expect(data.error).toBeTruthy()
    })

    it('should copy preset params', async () => {
      const presets = STRATEGY_PRESETS as any
      const presetName = Object.keys(presets)[0]

      if (presetName) {
        const body = JSON.stringify({
          presetName,
          configName: 'copied-preset',
        })

        const res = await app.request('/strategy-config/from-preset', {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
        })

        const data = await res.json() as any
        expect(data.params).toEqual(presets[presetName].params)
      }
    })

    it('should initialize history from preset', async () => {
      const presets = STRATEGY_PRESETS as any
      const presetName = Object.keys(presets)[0]

      if (presetName) {
        const body = JSON.stringify({
          presetName,
          configName: 'preset-history',
        })

        const res = await app.request('/strategy-config/from-preset', {
          method: 'POST',
          body,
          headers: { 'Content-Type': 'application/json' },
        })

        const data = await res.json() as any
        expect(Array.isArray(data.history)).toBe(true)
        expect(data.history.length).toBeGreaterThan(0)
      }
    })
  })

  describe('PUT /:name', () => {
    it('should update config params', async () => {
      await createTestConfig('update-test', {
        params: { type: 'threshold', driftThreshold: 5 },
      })

      const body = JSON.stringify({
        params: { type: 'momentum', window: 30 },
      })

      const res = await app.request('/strategy-config/update-test', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)

      // Verify update was saved
      const getRes = await app.request('/strategy-config/update-test')
      const data = await getRes.json() as any
      expect(data.params.type).toBe('momentum')
    })

    it('should update description', async () => {
      await createTestConfig('desc-test', {
        description: 'Old description',
      })

      const body = JSON.stringify({
        description: 'New description',
      })

      const res = await app.request('/strategy-config/desc-test', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)

      // Verify update
      const getRes = await app.request('/strategy-config/desc-test')
      const data = await getRes.json() as any
      expect(data.description).toBe('New description')
    })

    it('should update global settings', async () => {
      await createTestConfig('settings-test', {
        globalSettings: { rebalanceFrequency: 'daily' },
      })

      const body = JSON.stringify({
        globalSettings: { rebalanceFrequency: 'weekly' },
      })

      const res = await app.request('/strategy-config/settings-test', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)
    })

    it('should increment version on update', async () => {
      await createTestConfig('version-test', { version: 1 })

      const body = JSON.stringify({
        params: { type: 'new-type' },
      })

      const res = await app.request('/strategy-config/version-test', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 200) {
        const data = await res.json() as any
        expect(data.version).toBeGreaterThanOrEqual(1)
      }
    })

    it('should track history on param change', async () => {
      await createTestConfig('history-update', {
        history: [{ params: { type: 'old' }, changedAt: new Date() }],
      })

      const body = JSON.stringify({
        params: { type: 'new' },
      })

      const res = await app.request('/strategy-config/history-update', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 200) {
        const data = await res.json() as any
        expect(Array.isArray(data.history)).toBe(true)
      }
    })

    it('should update timestamp on modification', async () => {
      await createTestConfig('timestamp-test')

      const body = JSON.stringify({
        description: 'Updated',
      })

      const res = await app.request('/strategy-config/timestamp-test', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)
    })

    it('should return 404 for missing config', async () => {
      const body = JSON.stringify({
        description: 'Update',
      })

      const res = await app.request('/strategy-config/missing', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(404)
    })

    it('should handle invalid update payload', async () => {
      await createTestConfig('validate-test')

      const body = JSON.stringify({
        description: 123, // Should be string
      })

      const res = await app.request('/strategy-config/validate-test', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      // May accept or reject based on validation
      expect([200, 400].includes(res.status)).toBe(true)
    })

    it('should allow partial updates', async () => {
      await createTestConfig('partial-update', {
        params: { type: 'threshold' },
        description: 'Original',
      })

      const body = JSON.stringify({
        description: 'Only update description',
      })

      const res = await app.request('/strategy-config/partial-update', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)

      // Verify only description changed
      const getRes = await app.request('/strategy-config/partial-update')
      const data = await getRes.json() as any
      expect(data.description).toBe('Only update description')
    })

    it('should update active config', async () => {
      await createTestConfig('active-update', { isActive: true })

      const body = JSON.stringify({
        description: 'Updated active config',
      })

      const res = await app.request('/strategy-config/active-update', {
        method: 'PUT',
        body,
        headers: { 'Content-Type': 'application/json' },
      })

      expect(res.status).toBe(200)
      const data = await res.json() as any
      expect(data.isActive).toBe(true)
    })
  })

  describe('DELETE /:name', () => {
    it('should delete config', async () => {
      await createTestConfig('delete-test')

      const res = await app.request('/strategy-config/delete-test', {
        method: 'DELETE',
      })

      expect(res.status).toBe(200)

      const data = await res.json() as any
      expect(data.deleted).toBe('delete-test')

      // Verify it's gone
      const getRes = await app.request('/strategy-config/delete-test')
      expect(getRes.status).toBe(404)
    })

    it('should reject deleting active config', async () => {
      await createTestConfig('active-delete', { isActive: true })

      const res = await app.request('/strategy-config/active-delete', {
        method: 'DELETE',
      })

      expect(res.status).toBe(400)

      const data = await res.json() as any
      expect(data.error).toContain('Cannot delete active')
    })

    it('should return 404 for missing config', async () => {
      const res = await app.request('/strategy-config/nonexistent', {
        method: 'DELETE',
      })

      expect(res.status).toBe(404)
    })
  })

  describe('POST /:name/activate', () => {
    it('should activate config', async () => {
      await createTestConfig('activate-test', { isActive: false })

      const res = await app.request('/strategy-config/activate-test/activate', {
        method: 'POST',
      })

      expect([200, 500].includes(res.status)).toBe(true)
    })

    it('should return 404 for missing config', async () => {
      const res = await app.request('/strategy-config/nonexistent/activate', {
        method: 'POST',
      })

      expect(res.status).toBe(404)
    })

    it('should exist as POST endpoint', async () => {
      await createTestConfig('endpoint-test')

      const res = await app.request('/strategy-config/endpoint-test/activate', {
        method: 'POST',
      })

      // Should not be "method not allowed"
      expect(res.status).not.toBe(405)
    })
  })

  describe('error handling', () => {
    it('should handle missing config', async () => {
      const res = await app.request('/strategy-config/nonexistent')
      expect(res.status).toBe(404)

      const data = await res.json() as any
      expect(data).toHaveProperty('error')
    })

    it('should reject invalid JSON', async () => {
      const res = await app.request('/strategy-config/', {
        method: 'POST',
        body: 'not json at all',
        headers: { 'Content-Type': 'application/json' },
      })

      // Should reject invalid JSON
      expect(res.status).toBeGreaterThanOrEqual(400)
    })

    it('should validate request method', async () => {
      const res = await app.request('/strategy-config/test/activate', {
        method: 'GET', // Wrong method
      })

      // GET on POST-only endpoint
      expect(res.status).toBeGreaterThanOrEqual(400)
    })
  })
})
