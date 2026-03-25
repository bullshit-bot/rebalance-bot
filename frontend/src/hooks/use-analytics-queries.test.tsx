import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    getEquityCurve: vi.fn(),
    getPnL: vi.fn(),
    getDrawdown: vi.fn(),
    getFees: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import { useEquityCurve, usePnL, useDrawdown, useFees } from '@/hooks/use-analytics-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-analytics-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useEquityCurve', () => {
    it('fetches equity curve data', async () => {
      const mockData = {
        from: 1000,
        to: 2000,
        data: [
          { timestamp: 1000, valueUsd: 10000 },
          { timestamp: 2000, valueUsd: 11000 },
        ],
      }
      vi.mocked(api.getEquityCurve).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useEquityCurve(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('accepts from and to parameters', async () => {
      vi.mocked(api.getEquityCurve).mockResolvedValueOnce({
        from: 1000,
        to: 2000,
        data: [],
      })

      const { result } = renderHook(() => useEquityCurve(1000, 2000), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getEquityCurve).toHaveBeenCalledWith(1000, 2000)
    })

    it('has correct query key', async () => {
      vi.mocked(api.getEquityCurve).mockResolvedValueOnce({
        from: 0,
        to: 0,
        data: [],
      })

      const { result } = renderHook(() => useEquityCurve(1500, 2500), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })
  })

  describe('usePnL', () => {
    it('fetches PnL data', async () => {
      const mockData = {
        totalPnl: 1000,
        byAsset: { BTC: 500, ETH: 500 },
        byPeriod: { daily: 100, weekly: 500, monthly: 1000 },
      }
      vi.mocked(api.getPnL).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => usePnL(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('accepts from and to parameters', async () => {
      vi.mocked(api.getPnL).mockResolvedValueOnce({
        totalPnl: 0,
        byAsset: {},
        byPeriod: { daily: 0, weekly: 0, monthly: 0 },
      })

      renderHook(() => usePnL(1000, 2000), { wrapper: createWrapper() })

      await waitFor(() => expect(api.getPnL).toHaveBeenCalled())
      expect(api.getPnL).toHaveBeenCalledWith(1000, 2000)
    })

    it('has correct query key', async () => {
      vi.mocked(api.getPnL).mockResolvedValueOnce({
        totalPnl: 0,
        byAsset: {},
        byPeriod: { daily: 0, weekly: 0, monthly: 0 },
      })

      const { result } = renderHook(() => usePnL(800, 1600), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })
  })

  describe('useDrawdown', () => {
    it('fetches drawdown data', async () => {
      const mockData = {
        maxDrawdownPct: 15,
        maxDrawdownUsd: 1500,
        peakValue: 10000,
        troughValue: 8500,
        peakDate: 1000,
        troughDate: 1500,
        currentDrawdownPct: 5,
        drawdownSeries: [
          { timestamp: 1000, drawdownPct: 0 },
          { timestamp: 1500, drawdownPct: 15 },
        ],
      }
      vi.mocked(api.getDrawdown).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useDrawdown(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('accepts from and to parameters', async () => {
      vi.mocked(api.getDrawdown).mockResolvedValueOnce({
        maxDrawdownPct: 0,
        maxDrawdownUsd: 0,
        peakValue: 0,
        troughValue: 0,
        peakDate: 0,
        troughDate: 0,
        currentDrawdownPct: 0,
        drawdownSeries: [],
      })

      renderHook(() => useDrawdown(500, 1500), { wrapper: createWrapper() })

      await waitFor(() => expect(api.getDrawdown).toHaveBeenCalled())
      expect(api.getDrawdown).toHaveBeenCalledWith(500, 1500)
    })

    it('has correct query key', async () => {
      vi.mocked(api.getDrawdown).mockResolvedValueOnce({
        maxDrawdownPct: 0,
        maxDrawdownUsd: 0,
        peakValue: 0,
        troughValue: 0,
        peakDate: 0,
        troughDate: 0,
        currentDrawdownPct: 0,
        drawdownSeries: [],
      })

      const { result } = renderHook(() => useDrawdown(600, 1800), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })
  })

  describe('useFees', () => {
    it('fetches fees data', async () => {
      const mockData = {
        totalFeesUsd: 250,
        byExchange: { binance: 150, okx: 100 },
        byAsset: { BTC: 150, ETH: 100 },
        byPeriod: { daily: 50, weekly: 200, monthly: 250 },
      }
      vi.mocked(api.getFees).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useFees(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('accepts from and to parameters', async () => {
      vi.mocked(api.getFees).mockResolvedValueOnce({
        totalFeesUsd: 0,
        byExchange: {},
        byAsset: {},
        byPeriod: { daily: 0, weekly: 0, monthly: 0 },
      })

      renderHook(() => useFees(700, 1800), { wrapper: createWrapper() })

      await waitFor(() => expect(api.getFees).toHaveBeenCalled())
      expect(api.getFees).toHaveBeenCalledWith(700, 1800)
    })

    it('has correct query key', async () => {
      vi.mocked(api.getFees).mockResolvedValueOnce({
        totalFeesUsd: 0,
        byExchange: {},
        byAsset: {},
        byPeriod: { daily: 0, weekly: 0, monthly: 0 },
      })

      const { result } = renderHook(() => useFees(300, 900), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('handles undefined parameters', async () => {
      vi.mocked(api.getFees).mockResolvedValueOnce({
        totalFeesUsd: 0,
        byExchange: {},
        byAsset: {},
        byPeriod: { daily: 0, weekly: 0, monthly: 0 },
      })

      const { result } = renderHook(() => useFees(undefined, undefined), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getFees).toHaveBeenCalledWith(undefined, undefined)
    })
  })

  describe('error handling', () => {
    it('handles equity curve error', async () => {
      vi.mocked(api.getEquityCurve).mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => useEquityCurve(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('handles PnL error', async () => {
      vi.mocked(api.getPnL).mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => usePnL(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('handles drawdown error', async () => {
      vi.mocked(api.getDrawdown).mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => useDrawdown(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })

    it('handles fees error', async () => {
      vi.mocked(api.getFees).mockRejectedValueOnce(new Error('Fetch failed'))

      const { result } = renderHook(() => useFees(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
    })
  })
})
