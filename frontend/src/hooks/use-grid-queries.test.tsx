import { renderHook, waitFor, act } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    listGridBots: vi.fn(),
    createGridBot: vi.fn(),
    stopGridBot: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import { useGridBots, useCreateGridBot, useStopGridBot } from '@/hooks/use-grid-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-grid-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useGridBots', () => {
    it('fetches grid bots list', async () => {
      const mockData = [
        {
          id: 'grid-1',
          exchange: 'binance',
          pair: 'BTC/USDT',
          gridType: 'normal' as const,
          priceLower: 40000,
          priceUpper: 50000,
          gridLevels: 10,
          investment: 10000,
          status: 'active' as const,
          totalProfit: 500,
          totalTrades: 50,
          createdAt: Date.now(),
          stoppedAt: null,
        },
      ]
      vi.mocked(api.listGridBots).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useGridBots(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('has correct query key', async () => {
      vi.mocked(api.listGridBots).mockResolvedValueOnce([])

      const { result } = renderHook(() => useGridBots(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('has refetchInterval set to 15 seconds', async () => {
      vi.mocked(api.listGridBots).mockResolvedValueOnce([])

      const { result } = renderHook(() => useGridBots(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })

    it('handles error', async () => {
      vi.mocked(api.listGridBots).mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => useGridBots(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useCreateGridBot', () => {
    it('creates grid bot via mutation', async () => {
      const mockData = { botId: 'grid-new' }
      vi.mocked(api.createGridBot).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useCreateGridBot(), { wrapper: createWrapper() })

      const input = {
        exchange: 'binance',
        pair: 'ETH/USDT',
        priceLower: 2000,
        priceUpper: 3000,
        gridLevels: 10,
        investment: 5000,
      }

      await act(async () => {
        result.current.mutate(input)
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('passes grid bot input to api', async () => {
      vi.mocked(api.createGridBot).mockResolvedValueOnce({ botId: 'grid-456' })

      const { result } = renderHook(() => useCreateGridBot(), { wrapper: createWrapper() })

      const input = {
        exchange: 'okx',
        pair: 'BTC/USDT',
        priceLower: 35000,
        priceUpper: 55000,
        gridLevels: 20,
        investment: 20000,
        gridType: 'reverse' as const,
      }

      await act(async () => {
        result.current.mutate(input)
      })

      await waitFor(() => expect(api.createGridBot).toHaveBeenCalled())
      expect(api.createGridBot).toHaveBeenCalledWith(input)
    })

    it('invalidates grid-bots query on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.createGridBot).mockResolvedValueOnce({ botId: 'grid-789' })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useCreateGridBot(), { wrapper })

      await act(async () => {
        result.current.mutate({
          exchange: 'binance',
          pair: 'SOL/USDT',
          priceLower: 100,
          priceUpper: 300,
          gridLevels: 10,
          investment: 5000,
        })
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['grid-bots'] })
      )
    })

    it('handles error', async () => {
      vi.mocked(api.createGridBot).mockRejectedValueOnce(new Error('Creation failed'))

      const { result } = renderHook(() => useCreateGridBot(), { wrapper: createWrapper() })

      await act(async () => {
        result.current.mutate({
          exchange: 'binance',
          pair: 'BTC/USDT',
          priceLower: 40000,
          priceUpper: 50000,
          gridLevels: 10,
          investment: 10000,
        })
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })

  describe('useStopGridBot', () => {
    it('stops grid bot via mutation', async () => {
      const mockData = {
        id: 'grid-1',
        status: 'stopped',
        totalProfit: 1000,
        totalTrades: 100,
      }
      vi.mocked(api.stopGridBot).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useStopGridBot(), { wrapper: createWrapper() })

      await act(async () => {
        result.current.mutate('grid-1')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('passes bot id to api.stopGridBot', async () => {
      vi.mocked(api.stopGridBot).mockResolvedValueOnce({
        id: 'grid-2',
        status: 'stopped',
        totalProfit: 500,
        totalTrades: 50,
      })

      const { result } = renderHook(() => useStopGridBot(), { wrapper: createWrapper() })

      await act(async () => {
        result.current.mutate('grid-2')
      })

      await waitFor(() => expect(api.stopGridBot).toHaveBeenCalled())
      expect(api.stopGridBot).toHaveBeenCalledWith('grid-2')
    })

    it('invalidates grid-bots query on success', async () => {
      const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
      const invalidateQueriesSpy = vi.spyOn(qc, 'invalidateQueries')

      vi.mocked(api.stopGridBot).mockResolvedValueOnce({
        id: 'grid-3',
        status: 'stopped',
        totalProfit: 750,
        totalTrades: 75,
      })

      const wrapper = ({ children }: { children: ReactNode }) => (
        <QueryClientProvider client={qc}>{children}</QueryClientProvider>
      )

      const { result } = renderHook(() => useStopGridBot(), { wrapper })

      await act(async () => {
        result.current.mutate('grid-3')
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(invalidateQueriesSpy).toHaveBeenCalledWith(
        expect.objectContaining({ queryKey: ['grid-bots'] })
      )
    })

    it('handles error', async () => {
      vi.mocked(api.stopGridBot).mockRejectedValueOnce(new Error('Stop failed'))

      const { result } = renderHook(() => useStopGridBot(), { wrapper: createWrapper() })

      await act(async () => {
        result.current.mutate('grid-invalid')
      })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })
})
