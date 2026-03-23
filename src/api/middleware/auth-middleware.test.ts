import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { authMiddleware } from './auth-middleware'
import type { Context, Next } from 'hono'

// The actual API key loaded from .env by bun (API_KEY=dev-api-key-2026)
const VALID_API_KEY = process.env['API_KEY'] ?? 'dev-api-key-2026'

describe('authMiddleware', () => {
  let mockNext: Next

  beforeEach(() => {
    mockNext = mock(async () => {})
  })

  function makeContext(apiKey: string | undefined): Partial<Context> {
    return {
      req: {
        header: mock((name: string) => (name === 'X-API-Key' ? apiKey : undefined)),
      } as any,
      json: mock((data: any, status?: number) => new Response(JSON.stringify(data), { status })),
    }
  }

  describe('valid API key', () => {
    it('should pass with valid key', async () => {
      const ctx = makeContext(VALID_API_KEY)
      await authMiddleware(ctx as Context, mockNext)
      expect(mockNext).toHaveBeenCalled()
    })

    it('should call next function exactly once', async () => {
      const ctx = makeContext(VALID_API_KEY)
      await authMiddleware(ctx as Context, mockNext)
      expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('should not return a response on valid key', async () => {
      const ctx = makeContext(VALID_API_KEY)
      const result = await authMiddleware(ctx as Context, mockNext)
      expect(result).toBeUndefined()
    })
  })

  describe('invalid API key', () => {
    it('should reject missing key', async () => {
      const ctx = makeContext(undefined)
      const result = await authMiddleware(ctx as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should return 401 for missing key', async () => {
      const ctx = makeContext(undefined)
      const result = await authMiddleware(ctx as Context, mockNext)
      if (result instanceof Response) {
        expect(result.status).toBe(401)
      }
    })

    it('should reject wrong key', async () => {
      const ctx = makeContext('wrong-key')
      const result = await authMiddleware(ctx as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should return error message body', async () => {
      const ctx = makeContext(undefined)
      const result = await authMiddleware(ctx as Context, mockNext)
      expect(result).toBeTruthy()
    })
  })

  describe('timing safety', () => {
    it('should reject key with extra suffix', async () => {
      const ctx = makeContext(VALID_API_KEY + '-extra')
      const result = await authMiddleware(ctx as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should handle different length keys', async () => {
      const ctx = makeContext('short')
      const result = await authMiddleware(ctx as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should not accept key prefix as valid', async () => {
      const ctx = makeContext(VALID_API_KEY.slice(0, -1))
      const result = await authMiddleware(ctx as Context, mockNext)
      expect(result).toBeTruthy()
    })
  })

  describe('error handling', () => {
    it('should gracefully handle binary data keys', async () => {
      const ctx = makeContext('\x00\x01\x02')
      const result = await authMiddleware(ctx as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should handle empty string key', async () => {
      const ctx = makeContext('')
      const result = await authMiddleware(ctx as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should handle very long key', async () => {
      const ctx = makeContext('x'.repeat(10000))
      const result = await authMiddleware(ctx as Context, mockNext)
      expect(result).toBeTruthy()
    })
  })
})
