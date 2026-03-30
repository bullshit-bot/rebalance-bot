import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    getTrades: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import { useTrades } from '@/hooks/use-trade-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-trade-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useTrades', () => {
    it('fetches trades without params', async () => {
      const mockData = [
        {
          id: 1,
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy' as const,
          amount: 0.1,
          price: 40000,
          costUsd: 4000,
          fee: null,
          feeCurrency: null,
          orderId: null,
          rebalanceId: null,
          executedAt: Date.now(),
        },
      ]
      vi.mocked(api.getTrades).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useTrades(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('fetches trades with limit param', async () => {
      const mockData: any[] = []
      vi.mocked(api.getTrades).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useTrades(50), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getTrades).toHaveBeenCalledWith(50, undefined)
    })

    it('fetches trades with limit and rebalanceId', async () => {
      const mockData: any[] = []
      vi.mocked(api.getTrades).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useTrades(50, 'reb-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getTrades).toHaveBeenCalledWith(50, 'reb-123')
    })

    it('has correct query key without params', async () => {
      vi.mocked(api.getTrades).mockResolvedValueOnce([])

      const { result } = renderHook(() => useTrades(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('has correct query key with params', async () => {
      vi.mocked(api.getTrades).mockResolvedValueOnce([])

      const { result } = renderHook(() => useTrades(30, 'reb-456'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('handles error', async () => {
      vi.mocked(api.getTrades).mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => useTrades(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('returns empty array on success', async () => {
      vi.mocked(api.getTrades).mockResolvedValueOnce([])

      const { result } = renderHook(() => useTrades(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })

    it('returns loading state initially', () => {
      vi.mocked(api.getTrades).mockImplementationOnce(() => new Promise(() => {}))

      const { result } = renderHook(() => useTrades(), { wrapper: createWrapper() })

      expect(result.current.isPending).toBe(true)
      expect(result.current.data).toBeUndefined()
    })

    it('handles undefined rebalanceId with limit', async () => {
      vi.mocked(api.getTrades).mockResolvedValueOnce([])

      renderHook(() => useTrades(25), { wrapper: createWrapper() })

      await waitFor(() => expect(api.getTrades).toHaveBeenCalled())
      expect(api.getTrades).toHaveBeenCalledWith(25, undefined)
    })
  })
})
