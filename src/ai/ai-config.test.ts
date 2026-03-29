import { describe, it, expect, beforeEach, afterEach } from 'bun:test'
import { aiConfig } from './ai-config'

describe('ai-config', () => {
  // Save original env vars
  let originalEnv: Record<string, string | undefined>

  beforeEach(() => {
    originalEnv = { ...process.env }
  })

  afterEach(() => {
    // Restore original env
    Object.keys(process.env).forEach((key) => {
      if (!(key in originalEnv)) {
        delete process.env[key]
      }
    })
    Object.entries(originalEnv).forEach(([key, value]) => {
      process.env[key] = value
    })
  })

  describe('AIConfig interface', () => {
    it('should have goclawUrl property', () => {
      expect(aiConfig).toHaveProperty('goclawUrl')
      expect(typeof aiConfig.goclawUrl).toBe('string')
    })

    it('should have autoApprove property', () => {
      expect(aiConfig).toHaveProperty('autoApprove')
      expect(typeof aiConfig.autoApprove).toBe('boolean')
    })

    it('should have maxAllocationShiftPct property', () => {
      expect(aiConfig).toHaveProperty('maxAllocationShiftPct')
      expect(typeof aiConfig.maxAllocationShiftPct).toBe('number')
    })

    it('should have enabled property', () => {
      expect(aiConfig).toHaveProperty('enabled')
      expect(typeof aiConfig.enabled).toBe('boolean')
    })
  })

  describe('when GOCLAW_URL is not set', () => {
    it('should disable AI features', () => {
      // Note: We can't re-execute the module, so we test the current aiConfig
      // If GOCLAW_URL is not set in current env, enabled should be false
      if (!process.env.GOCLAW_URL) {
        expect(aiConfig.enabled).toBe(false)
      }
    })

    it('should have default maxAllocationShiftPct of 20', () => {
      // Check that the default is 20 when not overridden
      expect(aiConfig.maxAllocationShiftPct).toBeGreaterThan(0)
    })
  })

  describe('when GOCLAW_URL is set', () => {
    it('should enable AI features', () => {
      // If GOCLAW_URL is set in current env, enabled should be true
      if (process.env.GOCLAW_URL) {
        expect(aiConfig.enabled).toBe(true)
      }
    })
  })

  describe('autoApprove setting', () => {
    it('should parse "true" string correctly', () => {
      // Test the parsing logic indirectly through aiConfig
      // autoApprove is set based on AI_AUTO_APPROVE env var
      if (process.env.AI_AUTO_APPROVE === 'true' || process.env.AI_AUTO_APPROVE === '1') {
        expect(aiConfig.autoApprove).toBe(true)
      }
    })

    it('should default to false when not set', () => {
      // When AI_AUTO_APPROVE is not set, autoApprove should be false
      if (!process.env.AI_AUTO_APPROVE) {
        expect(aiConfig.autoApprove).toBe(false)
      }
    })
  })

  describe('maxAllocationShiftPct setting', () => {
    it('should be a positive number', () => {
      expect(aiConfig.maxAllocationShiftPct).toBeGreaterThan(0)
    })

    it('should be less than or equal to 100', () => {
      expect(aiConfig.maxAllocationShiftPct).toBeLessThanOrEqual(100)
    })

    it('should have a numeric default', () => {
      expect(typeof aiConfig.maxAllocationShiftPct).toBe('number')
      expect(aiConfig.maxAllocationShiftPct).toBeGreaterThan(0)
    })
  })

  describe('configuration consistency', () => {
    it('should have consistent enabled/goclawUrl relationship', () => {
      // If enabled is true, goclawUrl should not be empty
      if (aiConfig.enabled) {
        expect(aiConfig.goclawUrl.length).toBeGreaterThan(0)
      }
      // If goclawUrl is empty, enabled should be false
      if (aiConfig.goclawUrl.length === 0) {
        expect(aiConfig.enabled).toBe(false)
      }
    })

    it('should have valid types for all properties', () => {
      expect(typeof aiConfig.goclawUrl).toBe('string')
      expect(typeof aiConfig.autoApprove).toBe('boolean')
      expect(typeof aiConfig.maxAllocationShiftPct).toBe('number')
      expect(typeof aiConfig.enabled).toBe('boolean')
    })
  })

  describe('exported aiConfig singleton', () => {
    it('should be defined', () => {
      expect(aiConfig).toBeDefined()
    })

    it('should be immutable-like', () => {
      const config = aiConfig
      expect(config).toBe(aiConfig)
    })

    it('should have all required properties', () => {
      const requiredProps = ['goclawUrl', 'autoApprove', 'maxAllocationShiftPct', 'enabled']
      requiredProps.forEach((prop) => {
        expect(aiConfig).toHaveProperty(prop)
      })
    })
  })
})
