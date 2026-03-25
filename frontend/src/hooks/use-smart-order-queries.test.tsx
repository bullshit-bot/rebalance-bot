import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    getActiveSmartOrders: vi.fn(),
    createSmartOrder: vi.fn(),
    pauseSmartOrder: vi.fn(),
    resumeSmartOrder: vi.fn(),
    cancelSmartOrder: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import {
  useActiveSmartOrders,
  useCreateSmartOrder,
  usePauseSmartOrder,
  useResumeSmartOrder,
  useCancelSmartOrder,
} from '@/hooks/use-smart-order-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-smart-order-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useActiveSmartOrders', () => {
    it('fetches active smart orders', async () => {
      const mockData = [
        {
          id: 'so-1',
          type: 'twap' as const,
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy' as const,
          totalAmount: 1,
          durationMs: 3600000,
          status: 'active' as const,
          filledAmount: 0.5,
          filledPct: 50,
          avgPrice: 42000,
          slicesCompleted: 5,
          slicesTotal: 10,
          estimatedCompletion: Date.now() + 1800000,
          rebalanceId: null,
          createdAt: Date.now(),
        },
      ]
      vi.mocked(api.getActiveSmartOrders).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useActiveSmartOrders(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('has correct query key', async () => {
      vi.mocked(api.getActiveSmartOrders).mockResolvedValueOnce([])

      const { result } = renderHook(() => useActiveSmartOrders(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('handles error', async () => {
      vi.mocked(api.getActiveSmartOrders).mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => useActiveSmartOrders(), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useCreateSmartOrder', () => {
    it('creates smart order', async () => {
      const mockData = { orderId: 'so-new' }
      vi.mocked(api.createSmartOrder).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useCreateSmartOrder(), {
        wrapper: createWrapper(),
      })

      const input = {
        type: 'vwap' as const,
        exchange: 'okx',
        pair: 'ETH/USDT',
        side: 'sell' as const,
        totalAmount: 10,
        durationMs: 7200000,
        slices: 20,
      }

      await act(async () => {
        result.current.mutate(input)
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('invalidates smart-orders-active query on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.createSmartOrder).mockResolvedValueOnce({ orderId: 'so-456' })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useCreateSmartOrder(), { wrapper })

      await act(async () => {
        result.current.mutate({
          type: 'twap',
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy',
          totalAmount: 0.5,
          durationMs: 1800000,
          slices: 10,
        })
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['smart-orders-active'] })
      )
    })
  })

  describe('usePauseSmartOrder', () => {
    it('pauses smart order', async () => {
      const mockData = { id: 'so-1', status: 'paused' }
      vi.mocked(api.pauseSmartOrder).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => usePauseSmartOrder(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('so-1')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.pauseSmartOrder).toHaveBeenCalledWith('so-1')
    })

    it('invalidates smart-orders-active on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.pauseSmartOrder).mockResolvedValueOnce({ id: 'so-2', status: 'paused' })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => usePauseSmartOrder(), { wrapper })

      await act(async () => {
        result.current.mutate('so-2')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['smart-orders-active'] })
      )
    })
  })

  describe('useResumeSmartOrder', () => {
    it('resumes smart order', async () => {
      const mockData = { id: 'so-3', status: 'active' }
      vi.mocked(api.resumeSmartOrder).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useResumeSmartOrder(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('so-3')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.resumeSmartOrder).toHaveBeenCalledWith('so-3')
    })

    it('invalidates smart-orders-active on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.resumeSmartOrder).mockResolvedValueOnce({ id: 'so-4', status: 'active' })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useResumeSmartOrder(), { wrapper })

      await act(async () => {
        result.current.mutate('so-4')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['smart-orders-active'] })
      )
    })
  })

  describe('useCancelSmartOrder', () => {
    it('cancels smart order', async () => {
      const mockData = { id: 'so-5', status: 'cancelled' }
      vi.mocked(api.cancelSmartOrder).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useCancelSmartOrder(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('so-5')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.cancelSmartOrder).toHaveBeenCalledWith('so-5')
    })

    it('invalidates smart-orders-active on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.cancelSmartOrder).mockResolvedValueOnce({ id: 'so-6', status: 'cancelled' })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useCancelSmartOrder(), { wrapper })

      await act(async () => {
        result.current.mutate('so-6')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['smart-orders-active'] })
      )
    })
  })

  describe('error handling', () => {
    it('handles pause error', async () => {
      vi.mocked(api.pauseSmartOrder).mockRejectedValueOnce(new Error('Pause failed'))

      const { result } = renderHook(() => usePauseSmartOrder(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('so-invalid')
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('handles resume error', async () => {
      vi.mocked(api.resumeSmartOrder).mockRejectedValueOnce(new Error('Resume failed'))

      const { result } = renderHook(() => useResumeSmartOrder(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('so-invalid')
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('handles cancel error', async () => {
      vi.mocked(api.cancelSmartOrder).mockRejectedValueOnce(new Error('Cancel failed'))

      const { result } = renderHook(() => useCancelSmartOrder(), {
        wrapper: createWrapper(),
      })

      await act(async () => {
        result.current.mutate('so-invalid')
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })
})
