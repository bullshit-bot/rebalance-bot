import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    getRebalancePreview: vi.fn(),
    triggerRebalance: vi.fn(),
    getRebalanceHistory: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import {
  useRebalancePreview,
  useTriggerRebalance,
  useRebalanceHistory,
} from '@/hooks/use-rebalance-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-rebalance-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useRebalancePreview', () => {
    it('fetches rebalance preview', async () => {
      const mockData = {
        trades: [],
        portfolio: { totalValueUsd: 100000, assets: [], updatedAt: Date.now() },
      }
      vi.mocked(api.getRebalancePreview).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useRebalancePreview(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('has correct query key', async () => {
      vi.mocked(api.getRebalancePreview).mockResolvedValueOnce({
        trades: [],
        portfolio: { totalValueUsd: 0, assets: [], updatedAt: 0 },
      })

      const { result } = renderHook(() => useRebalancePreview(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('handles error', async () => {
      vi.mocked(api.getRebalancePreview).mockRejectedValueOnce(new Error('API error'))

      const { result } = renderHook(() => useRebalancePreview(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(Error)
    })
  })

  describe('useTriggerRebalance', () => {
    it('triggers rebalance mutation', async () => {
      const mockData = {
        id: 'reb-123',
        trigger: 'threshold',
        status: 'executing',
        createdAt: Date.now(),
      }
      vi.mocked(api.triggerRebalance).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useTriggerRebalance(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate()
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('calls api.triggerRebalance', async () => {
      vi.mocked(api.triggerRebalance).mockResolvedValueOnce({
        id: 'reb-456',
        trigger: 'manual',
        status: 'executing',
        createdAt: Date.now(),
      })

      const { result } = renderHook(() => useTriggerRebalance(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate()
      })

      await waitFor(() => expect(api.triggerRebalance).toHaveBeenCalled())
    })

    it('invalidates portfolio and trades queries on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.triggerRebalance).mockResolvedValueOnce({
        id: 'reb-789',
        trigger: 'threshold',
        status: 'complete',
        createdAt: Date.now(),
      })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useTriggerRebalance(), { wrapper })

      await act(async () => {
        result.current.mutate()
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      // onSuccess callback invalidates portfolio and trades
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['portfolio'] }))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(expect.objectContaining({ queryKey: ['trades'] }))
    })

    it('handles error', async () => {
      vi.mocked(api.triggerRebalance).mockRejectedValueOnce(new Error('Trigger failed'))

      const { result } = renderHook(() => useTriggerRebalance(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate()
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('returns initial isPending state', () => {
      vi.mocked(api.triggerRebalance).mockImplementationOnce(
        () => new Promise(() => {})
      )

      const { result } = renderHook(() => useTriggerRebalance(), {
        wrapper: createWrapper(),
      })

      expect(result.current.isPending).toBe(false)
    })
  })

  describe('useRebalanceHistory', () => {
    it('fetches rebalance history without params', async () => {
      const mockData = [
        {
          id: 'reb-1',
          trigger: 'threshold',
          status: 'complete',
          createdAt: Date.now(),
        },
      ]
      vi.mocked(api.getRebalanceHistory).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useRebalanceHistory(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('fetches rebalance history with limit', async () => {
      const mockData: any[] = []
      vi.mocked(api.getRebalanceHistory).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useRebalanceHistory(50), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getRebalanceHistory).toHaveBeenCalledWith(50)
    })

    it('has correct query key without params', async () => {
      vi.mocked(api.getRebalanceHistory).mockResolvedValueOnce([])

      const { result } = renderHook(() => useRebalanceHistory(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('has correct query key with limit', async () => {
      vi.mocked(api.getRebalanceHistory).mockResolvedValueOnce([])

      const { result } = renderHook(() => useRebalanceHistory(30), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('handles error', async () => {
      vi.mocked(api.getRebalanceHistory).mockRejectedValueOnce(new Error('History fetch failed'))

      const { result } = renderHook(() => useRebalanceHistory(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('returns empty array on success', async () => {
      vi.mocked(api.getRebalanceHistory).mockResolvedValueOnce([])

      const { result } = renderHook(() => useRebalanceHistory(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })
  })
})
