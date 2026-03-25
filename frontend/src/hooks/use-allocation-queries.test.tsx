import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    getAllocations: vi.fn(),
    updateAllocations: vi.fn(),
    deleteAllocation: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import {
  useAllocations,
  useUpdateAllocations,
} from '@/hooks/use-allocation-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-allocation-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useAllocations', () => {
    it('fetches allocations', async () => {
      const mockData = [
        {
          id: 1,
          asset: 'BTC',
          targetPct: 50,
          exchange: null,
          minTradeUsd: null,
          updatedAt: Date.now(),
        },
        {
          id: 2,
          asset: 'ETH',
          targetPct: 50,
          exchange: null,
          minTradeUsd: null,
          updatedAt: Date.now(),
        },
      ]
      vi.mocked(api.getAllocations).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useAllocations(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('has correct query key', async () => {
      vi.mocked(api.getAllocations).mockResolvedValueOnce([])

      const { result } = renderHook(() => useAllocations(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('handles error', async () => {
      vi.mocked(api.getAllocations).mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => useAllocations(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('returns empty array on success', async () => {
      vi.mocked(api.getAllocations).mockResolvedValueOnce([])

      const { result } = renderHook(() => useAllocations(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })

    it('returns loading state initially', () => {
      vi.mocked(api.getAllocations).mockImplementationOnce(() => new Promise(() => {}))

      const { result } = renderHook(() => useAllocations(), { wrapper: createWrapper() })

      expect(result.current.isPending).toBe(true)
      expect(result.current.data).toBeUndefined()
    })
  })

  describe('useUpdateAllocations', () => {
    it('updates allocations via mutation', async () => {
      const mockData = [
        {
          id: 1,
          asset: 'BTC',
          targetPct: 60,
          exchange: null,
          minTradeUsd: null,
          updatedAt: Date.now(),
        },
      ]
      vi.mocked(api.updateAllocations).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useUpdateAllocations(), { wrapper: createWrapper() })

      const input = [{ asset: 'BTC', targetPct: 60 }]

      await act(async () => {
        result.current.mutate(input)
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
      expect(api.updateAllocations).toHaveBeenCalledWith(input)
    })

    it('passes allocation data to api.updateAllocations', async () => {
      vi.mocked(api.updateAllocations).mockResolvedValueOnce([])

      const { result } = renderHook(() => useUpdateAllocations(), { wrapper: createWrapper() })

      const input = [
        { asset: 'BTC', targetPct: 40, exchange: 'binance' },
        { asset: 'ETH', targetPct: 60 },
      ]

      await act(async () => {
        result.current.mutate(input)
      })

      await waitFor(() => expect(api.updateAllocations).toHaveBeenCalled())
      expect(api.updateAllocations).toHaveBeenCalledWith(input)
    })

    it('invalidates allocations query on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.updateAllocations).mockResolvedValueOnce([])

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useUpdateAllocations(), { wrapper })

      await act(async () => {
        result.current.mutate([{ asset: 'BTC', targetPct: 50 }])
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['allocations'] })
      )
    })

    it('invalidates portfolio query on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.updateAllocations).mockResolvedValueOnce([])

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useUpdateAllocations(), { wrapper })

      await act(async () => {
        result.current.mutate([{ asset: 'BTC', targetPct: 50 }])
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['portfolio'] })
      )
    })

    it('handles error', async () => {
      vi.mocked(api.updateAllocations).mockRejectedValueOnce(new Error('Update failed'))

      const { result } = renderHook(() => useUpdateAllocations(), { wrapper: createWrapper() })

      await act(async () => {
        result.current.mutate([{ asset: 'BTC', targetPct: 50 }])
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('returns initial isPending state', () => {
      vi.mocked(api.updateAllocations).mockImplementationOnce(() => new Promise(() => {}))

      const { result } = renderHook(() => useUpdateAllocations(), { wrapper: createWrapper() })

      expect(result.current.isPending).toBe(false)
    })
  })
})
