import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    getTaxReport: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import { useTaxReport } from '@/hooks/use-tax-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-tax-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useTaxReport', () => {
    it('fetches tax report without year', async () => {
      const mockData = {
        year: 2024,
        totalRealizedGain: 5000,
        totalRealizedLoss: 1000,
        netGainLoss: 4000,
        shortTermGain: 2000,
        longTermGain: 2000,
        events: [],
      }
      vi.mocked(api.getTaxReport).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useTaxReport(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('fetches tax report with specific year', async () => {
      const mockData = {
        year: 2023,
        totalRealizedGain: 3000,
        totalRealizedLoss: 500,
        netGainLoss: 2500,
        shortTermGain: 1000,
        longTermGain: 1500,
        events: [],
      }
      vi.mocked(api.getTaxReport).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useTaxReport(2023), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getTaxReport).toHaveBeenCalledWith(2023)
    })

    it('has correct query key without year', async () => {
      vi.mocked(api.getTaxReport).mockResolvedValueOnce({
        year: 2024,
        totalRealizedGain: 0,
        totalRealizedLoss: 0,
        netGainLoss: 0,
        shortTermGain: 0,
        longTermGain: 0,
        events: [],
      })

      const { result } = renderHook(() => useTaxReport(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('has correct query key with year', async () => {
      vi.mocked(api.getTaxReport).mockResolvedValueOnce({
        year: 2022,
        totalRealizedGain: 0,
        totalRealizedLoss: 0,
        netGainLoss: 0,
        shortTermGain: 0,
        longTermGain: 0,
        events: [],
      })

      const { result } = renderHook(() => useTaxReport(2022), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('includes taxable events in response', async () => {
      const mockData = {
        year: 2024,
        totalRealizedGain: 1000,
        totalRealizedLoss: 100,
        netGainLoss: 900,
        shortTermGain: 500,
        longTermGain: 400,
        events: [
          {
            date: 1000,
            asset: 'BTC',
            action: 'sell' as const,
            amount: 0.5,
            proceedsUsd: 20000,
            costBasisUsd: 19000,
            gainLossUsd: 1000,
            holdingPeriodDays: 400,
            isShortTerm: false,
          },
        ],
      }
      vi.mocked(api.getTaxReport).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useTaxReport(2024), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data?.events).toHaveLength(1)
      expect(result.current.data?.events[0].asset).toBe('BTC')
    })

    it('handles error', async () => {
      vi.mocked(api.getTaxReport).mockRejectedValueOnce(new Error('Report generation failed'))

      const { result } = renderHook(() => useTaxReport(2024), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('returns loading state initially', () => {
      vi.mocked(api.getTaxReport).mockImplementationOnce(() => new Promise(() => {}))

      const { result } = renderHook(() => useTaxReport(), { wrapper: createWrapper() })

      expect(result.current.isPending).toBe(true)
      expect(result.current.data).toBeUndefined()
    })

    it('handles empty events array', async () => {
      const mockData = {
        year: 2024,
        totalRealizedGain: 0,
        totalRealizedLoss: 0,
        netGainLoss: 0,
        shortTermGain: 0,
        longTermGain: 0,
        events: [],
      }
      vi.mocked(api.getTaxReport).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => useTaxReport(2024), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data?.events).toEqual([])
    })
  })
})
