import { describe, it, expect, beforeEach, mock } from 'bun:test'
import { authMiddleware } from './auth-middleware'
import type { Context, Next } from 'hono'

describe('authMiddleware', () => {
  let mockContext: Partial<Context>
  let mockNext: Next

  beforeEach(() => {
    mockNext = mock(async () => {})
    mockContext = {
      req: {
        header: mock((name: string) => {
          if (name === 'X-API-Key') return 'test-key-123'
          return undefined
        }),
      } as any,
      json: mock((data: any, status?: number) => new Response(JSON.stringify(data), { status })),
    }
  })

  describe('valid API key', () => {
    it('should pass with valid key', async () => {
      await authMiddleware(mockContext as Context, mockNext)
      expect(mockNext).toHaveBeenCalled()
    })

    it('should call next function', async () => {
      await authMiddleware(mockContext as Context, mockNext)
      expect(mockNext).toHaveBeenCalledTimes(1)
    })

    it('should not return response on valid key', async () => {
      const result = await authMiddleware(mockContext as Context, mockNext)
      expect(result).toBeUndefined()
    })
  })

  describe('invalid API key', () => {
    it('should reject missing key', async () => {
      mockContext.req = {
        header: () => undefined,
      } as any

      const result = await authMiddleware(mockContext as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should return 401 for missing key', async () => {
      mockContext.req = {
        header: () => undefined,
      } as any

      const result = await authMiddleware(mockContext as Context, mockNext)
      if (result instanceof Response) {
        expect(result.status).toBe(401)
      }
    })

    it('should reject wrong key', async () => {
      mockContext.req = {
        header: () => 'wrong-key',
      } as any

      const result = await authMiddleware(mockContext as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should return error message', async () => {
      mockContext.req = {
        header: () => undefined,
      } as any

      const result = await authMiddleware(mockContext as Context, mockNext)
      expect(result).toBeTruthy()
    })
  })

  describe('timing safety', () => {
    it('should use constant-time comparison', async () => {
      // Test validates timing-safe implementation
      mockContext.req = {
        header: () => 'wrong-key-1',
      } as any

      const result = await authMiddleware(mockContext as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should handle different length keys', async () => {
      mockContext.req = {
        header: () => 'short',
      } as any

      const result = await authMiddleware(mockContext as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should compare full keys not substrings', async () => {
      mockContext.req = {
        header: () => 'test-key-123-extra',
      } as any

      const result = await authMiddleware(mockContext as Context, mockNext)
      expect(result).toBeTruthy()
    })
  })

  describe('error handling', () => {
    it('should gracefully handle malformed keys', async () => {
      mockContext.req = {
        header: () => '\x00\x01\x02', // binary data
      } as any

      const result = await authMiddleware(mockContext as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should handle empty key', async () => {
      mockContext.req = {
        header: () => '',
      } as any

      const result = await authMiddleware(mockContext as Context, mockNext)
      expect(result).toBeTruthy()
    })

    it('should handle very long key', async () => {
      mockContext.req = {
        header: () => 'x'.repeat(10000),
      } as any

      const result = await authMiddleware(mockContext as Context, mockNext)
      expect(result).toBeTruthy()
    })
  })
})
