import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    listBacktests: vi.fn(),
    getBacktestResult: vi.fn(),
    runBacktest: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import { useBacktestList, useBacktestResult, useRunBacktest } from '@/hooks/use-backtest-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-backtest-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useBacktestList', () => {
    it('fetches backtest list', async () => {
      const mockData = [
        {
          id: 'bt-1',
          createdAt: Date.now(),
          config: {} as any,
          metrics: {},
          trades: [],
          benchmark: {},
        },
      ]
      vi.mocked(api.listBacktests).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useBacktestList(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('has correct query key', async () => {
      vi.mocked(api.listBacktests).mockResolvedValueOnce([])

      const { result } = renderHook(() => useBacktestList(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('handles error', async () => {
      vi.mocked(api.listBacktests).mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => useBacktestList(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useBacktestResult', () => {
    it('fetches backtest result when id is provided', async () => {
      const mockData = {
        id: 'bt-123',
        createdAt: Date.now(),
        config: {} as any,
        metrics: { sharpeRatio: 1.5 },
        trades: [],
        benchmark: {},
      }
      vi.mocked(api.getBacktestResult).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useBacktestResult('bt-123'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('does not fetch when id is null', async () => {
      const { result } = renderHook(() => useBacktestResult(null), {
        wrapper: createWrapper(),
      })

      // Should remain in idle state, not fetch when id is null
      expect(result.current.data).toBeUndefined()
      expect(api.getBacktestResult).not.toHaveBeenCalled()
    })

    it('has correct query key with id', async () => {
      vi.mocked(api.getBacktestResult).mockResolvedValueOnce({
        id: 'bt-456',
        createdAt: 0,
        config: {} as any,
        metrics: {},
        trades: [],
        benchmark: {},
      })

      const { result } = renderHook(() => useBacktestResult('bt-456'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('handles error', async () => {
      vi.mocked(api.getBacktestResult).mockRejectedValueOnce(new Error('Not found'))

      const { result } = renderHook(() => useBacktestResult('invalid-id'), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useRunBacktest', () => {
    it('runs backtest mutation', async () => {
      const mockResult = {
        id: 'bt-new',
        createdAt: Date.now(),
        config: {} as any,
        metrics: { totalReturn: 25 },
        trades: [],
        benchmark: {},
      }
      vi.mocked(api.runBacktest).mockResolvedValueOnce(mockResult)

      const { result } = renderHook(() => useRunBacktest(), { wrapper: createWrapper() })

      const config = {
        pairs: ['BTC/USDT'],
        allocations: [],
        startDate: 1000,
        endDate: 2000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.1,
        timeframe: '1d' as const,
        exchange: 'binance',
      }

      await act(async () => {
        result.current.mutate(config)
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockResult)
    })

    it('passes config to api.runBacktest', async () => {
      vi.mocked(api.runBacktest).mockResolvedValueOnce({
        id: 'bt-789',
        createdAt: 0,
        config: {} as any,
        metrics: {},
        trades: [],
        benchmark: {},
      })

      const { result } = renderHook(() => useRunBacktest(), { wrapper: createWrapper() })

      const config = {
        pairs: ['ETH/USDT'],
        allocations: [],
        startDate: 100,
        endDate: 200,
        initialBalance: 5000,
        threshold: 2,
        feePct: 0.05,
        timeframe: '1h' as const,
        exchange: 'okx',
      }

      await act(async () => {
        result.current.mutate(config)
      })

      await waitFor(() => expect(api.runBacktest).toHaveBeenCalled())
      expect(api.runBacktest).toHaveBeenCalledWith(config)
    })

    it('handles error', async () => {
      vi.mocked(api.runBacktest).mockRejectedValueOnce(new Error('Backtest failed'))

      const { result } = renderHook(() => useRunBacktest(), { wrapper: createWrapper() })

      const config = {
        pairs: ['BTC/USDT'],
        allocations: [],
        startDate: 1000,
        endDate: 2000,
        initialBalance: 10000,
        threshold: 5,
        feePct: 0.1,
        timeframe: '1d' as const,
        exchange: 'binance',
      }

      await act(async () => {
        result.current.mutate(config)
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('returns initial isPending state', () => {
      vi.mocked(api.runBacktest).mockImplementationOnce(() => new Promise(() => {}))

      const { result } = renderHook(() => useRunBacktest(), { wrapper: createWrapper() })

      expect(result.current.isPending).toBe(false)
    })
  })
})
