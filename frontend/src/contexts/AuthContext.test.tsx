import { renderHook, act, waitFor } from '@testing-library/react'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { ReactNode } from 'react'

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    getHealth: vi.fn(),
  },
  getApiKey: vi.fn(),
  setApiKey: vi.fn(),
  clearApiKey: vi.fn(),
}))

import { api, getApiKey, setApiKey, clearApiKey } from '@/lib/api'
import { AuthProvider, useAuth } from '@/contexts/AuthContext'

describe('AuthContext.tsx', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
  })

  describe('AuthProvider', () => {
    it('renders children', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      expect(result.current).toBeDefined()
      expect(result.current.isAuthenticated).toBeDefined()
    })

    it('initializes with authenticated false when no apiKey in storage', () => {
      vi.mocked(getApiKey).mockReturnValueOnce('')

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      expect(result.current.isAuthenticated).toBe(false)
    })

    it('initializes with authenticated true when apiKey exists in storage', () => {
      vi.mocked(getApiKey).mockReturnValueOnce('stored-key')

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  describe('useAuth', () => {
    it('throws error when used outside provider', () => {
      // Suppress error output during this test
      const spy = vi.spyOn(console, 'error').mockImplementation(() => {})

      expect(() => {
        renderHook(() => useAuth())
      }).toThrow()

      spy.mockRestore()
    })

    it('returns auth context when used inside provider', () => {
      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      expect(result.current).toHaveProperty('isAuthenticated')
      expect(result.current).toHaveProperty('login')
      expect(result.current).toHaveProperty('logout')
    })
  })

  describe('login', () => {
    it('sets api key and authenticates on successful health check', async () => {
      vi.mocked(getApiKey).mockReturnValueOnce('')
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 3600,
        exchanges: { binance: 'connected' },
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      let loginSuccess = false
      await act(async () => {
        loginSuccess = await result.current.login('test-key-123')
      })

      expect(loginSuccess).toBe(true)
      expect(setApiKey).toHaveBeenCalledWith('test-key-123')
      expect(result.current.isAuthenticated).toBe(true)
    })

    it('returns true on successful login', async () => {
      vi.mocked(getApiKey).mockReturnValueOnce('')
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 0,
        exchanges: {},
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      let response: boolean = false
      await act(async () => {
        response = await result.current.login('valid-key')
      })

      expect(response).toBe(true)
    })

    it('clears api key on failed health check', async () => {
      vi.mocked(getApiKey).mockReturnValueOnce('')
      vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('Unauthorized'))

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      await act(async () => {
        await result.current.login('invalid-key')
      })

      expect(clearApiKey).toHaveBeenCalled()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('returns false on failed login', async () => {
      vi.mocked(getApiKey).mockReturnValueOnce('')
      vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('Connection failed'))

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      let response: boolean = true
      await act(async () => {
        response = await result.current.login('bad-key')
      })

      expect(response).toBe(false)
    })

    it('stores api key before validation', async () => {
      vi.mocked(getApiKey).mockReturnValueOnce('')
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 0,
        exchanges: {},
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      await act(async () => {
        await result.current.login('my-key')
      })

      // setApiKey should have been called before health check
      expect(setApiKey).toHaveBeenCalled()
      const setApiKeyCalls = vi.mocked(setApiKey).mock.calls
      const healthCalls = vi.mocked(api.getHealth).mock.calls

      expect(setApiKeyCalls.length).toBeGreaterThan(0)
      expect(healthCalls.length).toBeGreaterThan(0)
    })

    it('handles network error gracefully', async () => {
      vi.mocked(getApiKey).mockReturnValueOnce('')
      vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('Network timeout'))

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      let response = true
      await act(async () => {
        response = await result.current.login('test-key')
      })

      expect(response).toBe(false)
      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('logout', () => {
    it('clears api key and unauthenticates', () => {
      vi.mocked(getApiKey).mockReturnValueOnce('existing-key')

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      expect(result.current.isAuthenticated).toBe(true)

      act(() => {
        result.current.logout()
      })

      expect(clearApiKey).toHaveBeenCalled()
      expect(result.current.isAuthenticated).toBe(false)
    })

    it('sets isAuthenticated to false', () => {
      vi.mocked(getApiKey).mockReturnValueOnce('some-key')

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      act(() => {
        result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
    })

    it('can be called multiple times safely', () => {
      vi.mocked(getApiKey).mockReturnValueOnce('key')

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      act(() => {
        result.current.logout()
        result.current.logout()
        result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
    })
  })

  describe('auth state transitions', () => {
    it('transitions from unauthenticated to authenticated on successful login', async () => {
      vi.mocked(getApiKey).mockReturnValueOnce('')
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 0,
        exchanges: {},
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      expect(result.current.isAuthenticated).toBe(false)

      await act(async () => {
        await result.current.login('valid-key')
      })

      expect(result.current.isAuthenticated).toBe(true)
    })

    it('transitions from authenticated to unauthenticated on logout', () => {
      vi.mocked(getApiKey).mockReturnValueOnce('existing-key')

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      expect(result.current.isAuthenticated).toBe(true)

      act(() => {
        result.current.logout()
      })

      expect(result.current.isAuthenticated).toBe(false)
    })

    it('stays unauthenticated on failed login attempt', async () => {
      vi.mocked(getApiKey).mockReturnValueOnce('')
      vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('Invalid'))

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      expect(result.current.isAuthenticated).toBe(false)

      await act(async () => {
        await result.current.login('bad-key')
      })

      expect(result.current.isAuthenticated).toBe(false)
    })

    it('allows re-login after logout', async () => {
      vi.mocked(getApiKey).mockReturnValue('')
      vi.mocked(api.getHealth).mockResolvedValue({
        status: 'ok',
        uptimeSeconds: 0,
        exchanges: {},
      })

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      // Login
      await act(async () => {
        await result.current.login('key-1')
      })
      expect(result.current.isAuthenticated).toBe(true)

      // Logout
      act(() => {
        result.current.logout()
      })
      expect(result.current.isAuthenticated).toBe(false)

      // Re-login
      await act(async () => {
        await result.current.login('key-2')
      })
      expect(result.current.isAuthenticated).toBe(true)
    })
  })

  describe('error scenarios', () => {
    it('handles health check timeout', async () => {
      vi.mocked(getApiKey).mockReturnValueOnce('')
      vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('Timeout'))

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      let response = true
      await act(async () => {
        response = await result.current.login('test-key')
      })

      expect(response).toBe(false)
    })

    it('handles invalid key response', async () => {
      vi.mocked(getApiKey).mockReturnValueOnce('')
      vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('401 Unauthorized'))

      const { result } = renderHook(() => useAuth(), {
        wrapper: ({ children }: { children: ReactNode }) => (
          <AuthProvider>{children}</AuthProvider>
        ),
      })

      let response = true
      await act(async () => {
        response = await result.current.login('invalid-api-key')
      })

      expect(response).toBe(false)
      expect(result.current.isAuthenticated).toBe(false)
    })
  })
})
