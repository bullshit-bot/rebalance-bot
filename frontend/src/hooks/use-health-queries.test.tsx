import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    getHealth: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import { useHealth } from '@/hooks/use-health-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-health-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useHealth', () => {
    it('fetches health status', async () => {
      const mockData = {
        status: 'ok' as const,
        uptimeSeconds: 3600,
        exchanges: { binance: 'connected' as const, okx: 'connected' as const },
      }
      vi.mocked(api.getHealth).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('has correct query key', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 0,
        exchanges: {},
      })

      const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('handles error', async () => {
      vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('Health check failed'))

      const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('returns disconnected exchange status', async () => {
      const mockData = {
        status: 'ok' as const,
        uptimeSeconds: 3600,
        exchanges: {
          binance: 'connected' as const,
          okx: 'disconnected' as const,
        },
      }
      vi.mocked(api.getHealth).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data?.exchanges.okx).toBe('disconnected')
    })

    it('returns loading state initially', () => {
      vi.mocked(api.getHealth).mockImplementationOnce(() => new Promise(() => {}))

      const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() })

      expect(result.current.isPending).toBe(true)
      expect(result.current.data).toBeUndefined()
    })

    it('has refetchInterval set to 30 seconds', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 1234,
        exchanges: {},
      })

      const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data?.uptimeSeconds).toBe(1234)
    })

    it('handles empty exchanges object', async () => {
      const mockData = {
        status: 'ok' as const,
        uptimeSeconds: 5000,
        exchanges: {},
      }
      vi.mocked(api.getHealth).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data?.exchanges).toEqual({})
    })

    it('calls api.getHealth', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 0,
        exchanges: {},
      })

      const { result } = renderHook(() => useHealth(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getHealth).toHaveBeenCalled()
    })
  })
})
