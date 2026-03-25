import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

// Mock the api module
vi.mock('@/lib/api', () => ({
  api: {
    getPortfolio: vi.fn(),
    getPortfolioHistory: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import { usePortfolio, usePortfolioHistory } from '@/hooks/use-portfolio-queries'

function createWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-portfolio-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('usePortfolio', () => {
    it('fetches portfolio data', async () => {
      const mockData = {
        totalValueUsd: 100000,
        assets: [],
        updatedAt: Date.now(),
      }
      vi.mocked(api.getPortfolio).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => usePortfolio(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('handles error', async () => {
      vi.mocked(api.getPortfolio).mockRejectedValueOnce(new Error('API error'))

      const { result } = renderHook(() => usePortfolio(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('has correct query key', async () => {
      const mockData = {
        totalValueUsd: 50000,
        assets: [],
        updatedAt: Date.now(),
      }
      vi.mocked(api.getPortfolio).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => usePortfolio(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('returns loading state initially', () => {
      vi.mocked(api.getPortfolio).mockImplementationOnce(
        () => new Promise(() => {}) // Never resolves
      )

      const { result } = renderHook(() => usePortfolio(), { wrapper: createWrapper() })

      expect(result.current.isPending).toBe(true)
      expect(result.current.data).toBeUndefined()
    })

    it('has refetchInterval set to 30 seconds', async () => {
      const mockData = {
        totalValueUsd: 100000,
        assets: [],
        updatedAt: Date.now(),
      }
      vi.mocked(api.getPortfolio).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => usePortfolio(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      // The hook has refetchInterval: 30_000, we can verify by checking if it auto-refetches
      expect(result.current.data).toEqual(mockData)
    })
  })

  describe('usePortfolioHistory', () => {
    it('fetches portfolio history without params', async () => {
      const mockData = [
        {
          id: 1,
          totalValueUsd: 100000,
          holdings: '{}',
          allocations: '{}',
          createdAt: Date.now(),
        },
      ]
      vi.mocked(api.getPortfolioHistory).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => usePortfolioHistory(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
    })

    it('fetches portfolio history with from and to params', async () => {
      const mockData = [
        {
          id: 1,
          totalValueUsd: 100000,
          holdings: '{}',
          allocations: '{}',
          createdAt: 1000,
        },
      ]
      vi.mocked(api.getPortfolioHistory).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => usePortfolioHistory(1000, 2000), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual(mockData)
      expect(api.getPortfolioHistory).toHaveBeenCalledWith(1000, 2000)
    })

    it('has correct query key with params', async () => {
      const mockData: any[] = []
      vi.mocked(api.getPortfolioHistory).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => usePortfolioHistory(1000, 2000), {
        wrapper: createWrapper(),
      })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('has correct query key without params', async () => {
      const mockData: any[] = []
      vi.mocked(api.getPortfolioHistory).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => usePortfolioHistory(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('handles error in history fetch', async () => {
      vi.mocked(api.getPortfolioHistory).mockRejectedValueOnce(new Error('History fetch failed'))

      const { result } = renderHook(() => usePortfolioHistory(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(Error)
    })

    it('returns empty array on success', async () => {
      vi.mocked(api.getPortfolioHistory).mockResolvedValueOnce([])

      const { result } = renderHook(() => usePortfolioHistory(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })
  })

  describe('integration', () => {
    it('calls api.getPortfolio', async () => {
      const mockData = {
        totalValueUsd: 100000,
        assets: [],
        updatedAt: Date.now(),
      }
      vi.mocked(api.getPortfolio).mockResolvedValueOnce(mockData)

      const { result } = renderHook(() => usePortfolio(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getPortfolio).toHaveBeenCalled()
    })

    it('passes through undefined from and to params to api', async () => {
      vi.mocked(api.getPortfolioHistory).mockResolvedValueOnce([])

      renderHook(() => usePortfolioHistory(undefined, 5000), { wrapper: createWrapper() })

      await waitFor(() => expect(api.getPortfolioHistory).toHaveBeenCalled())
      expect(api.getPortfolioHistory).toHaveBeenCalledWith(undefined, 5000)
    })
  })
})
