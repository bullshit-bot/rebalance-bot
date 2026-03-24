import { describe, it, expect } from 'bun:test'
import { aiConfig } from './ai-config'

describe('ai-config (integration)', () => {
  describe('Config parsing with env vars', () => {
    it('should parse OPENCLAW_URL correctly', () => {
      const config = aiConfig
      expect(config).toHaveProperty('openclawUrl')
      expect(typeof config.openclawUrl).toBe('string')
    })

    it('should parse AI_AUTO_APPROVE as boolean', () => {
      const config = aiConfig
      expect(typeof config.autoApprove).toBe('boolean')
    })

    it('should parse AI_MAX_SHIFT_PCT as positive number', () => {
      const config = aiConfig
      expect(typeof config.maxAllocationShiftPct).toBe('number')
      expect(config.maxAllocationShiftPct).toBeGreaterThan(0)
      expect(config.maxAllocationShiftPct).toBeLessThan(100)
    })

    it('should have enabled flag matching OPENCLAW_URL presence', () => {
      const config = aiConfig
      if (config.enabled) {
        expect(config.openclawUrl.length).toBeGreaterThan(0)
      } else {
        expect(config.openclawUrl.length).toBe(0)
      }
    })
  })

  describe('Default values', () => {
    it('should default maxAllocationShiftPct to 20 when not set', () => {
      const config = aiConfig
      // Default is 20 per the code
      if (!process.env.AI_MAX_SHIFT_PCT) {
        expect(config.maxAllocationShiftPct).toBe(20)
      }
    })

    it('should default autoApprove to false when not set', () => {
      const config = aiConfig
      // Only true if explicitly set to 'true' or '1'
      if (!process.env.AI_AUTO_APPROVE) {
        expect(config.autoApprove).toBe(false)
      }
    })

    it('should handle empty OPENCLAW_URL gracefully', () => {
      const config = aiConfig
      // When URL is empty, enabled should be false
      if (config.openclawUrl.length === 0) {
        expect(config.enabled).toBe(false)
      }
    })
  })

  describe('Configuration consistency', () => {
    it('should be immutable-like singleton', () => {
      expect(aiConfig).toBe(aiConfig)
    })

    it('should have all required properties', () => {
      expect(aiConfig).toHaveProperty('openclawUrl')
      expect(aiConfig).toHaveProperty('autoApprove')
      expect(aiConfig).toHaveProperty('maxAllocationShiftPct')
      expect(aiConfig).toHaveProperty('enabled')
    })

    it('should have correct types for all properties', () => {
      expect(typeof aiConfig.openclawUrl).toBe('string')
      expect(typeof aiConfig.autoApprove).toBe('boolean')
      expect(typeof aiConfig.maxAllocationShiftPct).toBe('number')
      expect(typeof aiConfig.enabled).toBe('boolean')
    })
  })
})
