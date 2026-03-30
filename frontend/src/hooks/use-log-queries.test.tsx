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
import { useLogs } from '@/hooks/use-log-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-log-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useLogs', () => {
    it('fetches logs from trades', async () => {
      const mockTrades = [
        {
          id: 1,
          exchange: 'binance',
          pair: 'BTC/USDT',
          side: 'buy' as const,
          amount: 0.1,
          price: 40000,
          costUsd: 4000,
          fee: 10,
          feeCurrency: 'USDT',
          orderId: 'ord-123',
          rebalanceId: null,
          executedAt: Math.floor(Date.now() / 1000),
        },
      ]
      vi.mocked(api.getTrades).mockResolvedValueOnce(mockTrades)

      const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toBeDefined()
      expect(Array.isArray(result.current.data)).toBe(true)
    })

    it('converts trades to log entries with correct structure', async () => {
      const mockTrades = [
        {
          id: 1,
          exchange: 'binance',
          pair: 'ETH/USDT',
          side: 'sell' as const,
          amount: 1.5,
          price: 2500,
          costUsd: 3750,
          fee: null,
          feeCurrency: null,
          orderId: null,
          rebalanceId: null,
          executedAt: Math.floor(Date.now() / 1000),
        },
      ]
      vi.mocked(api.getTrades).mockResolvedValueOnce(mockTrades)

      const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const logs = result.current.data!
      expect(logs).toHaveLength(1)
      expect(logs[0].id).toContain('T-')
      expect(logs[0].level).toBe('execution')
      expect(logs[0].message).toContain('SELL')
      expect(logs[0].message).toContain('ETH/USDT')
    })

    it('includes fee in message when present', async () => {
      const mockTrades = [
        {
          id: 42,
          exchange: 'okx',
          pair: 'BTC/USDT',
          side: 'buy' as const,
          amount: 0.1,
          price: 50000,
          costUsd: 5000,
          fee: 12.5,
          feeCurrency: 'USDT',
          orderId: 'ord-456',
          rebalanceId: null,
          executedAt: Math.floor(Date.now() / 1000),
        },
      ]
      vi.mocked(api.getTrades).mockResolvedValueOnce(mockTrades)

      const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const logs = result.current.data!
      expect(logs[0].message).toContain('fee:')
      expect(logs[0].message).toContain('12.50')
    })

    it('omits fee from message when null', async () => {
      const mockTrades = [
        {
          id: 10,
          exchange: 'binance',
          pair: 'SOL/USDT',
          side: 'buy' as const,
          amount: 10,
          price: 200,
          costUsd: 2000,
          fee: null,
          feeCurrency: null,
          orderId: 'ord-789',
          rebalanceId: null,
          executedAt: Math.floor(Date.now() / 1000),
        },
      ]
      vi.mocked(api.getTrades).mockResolvedValueOnce(mockTrades)

      const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const logs = result.current.data!
      expect(logs[0].message).not.toContain('fee:')
    })

    it('parses details as JSON', async () => {
      const mockTrades = [
        {
          id: 5,
          exchange: 'bybit',
          pair: 'BTC/USDT',
          side: 'sell' as const,
          amount: 0.05,
          price: 45000,
          costUsd: 2250,
          fee: 5,
          feeCurrency: 'USDT',
          orderId: 'ord-xyz',
          rebalanceId: 'reb-123',
          executedAt: Math.floor(Date.now() / 1000),
        },
      ]
      vi.mocked(api.getTrades).mockResolvedValueOnce(mockTrades)

      const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const logs = result.current.data!
      const details = JSON.parse(logs[0].details)
      expect(details.exchange).toBe('bybit')
      expect(details.orderId).toBe('ord-xyz')
    })

    it('calls getTrades with limit of 50', async () => {
      vi.mocked(api.getTrades).mockResolvedValueOnce([])

      renderHook(() => useLogs(), { wrapper: createWrapper() })

      await waitFor(() => expect(api.getTrades).toHaveBeenCalled())
      expect(api.getTrades).toHaveBeenCalledWith(50)
    })

    it('has correct query key', async () => {
      vi.mocked(api.getTrades).mockResolvedValueOnce([])

      const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
    })

    it('returns empty array when no trades', async () => {
      vi.mocked(api.getTrades).mockResolvedValueOnce([])

      const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })

    it('handles error', async () => {
      vi.mocked(api.getTrades).mockRejectedValueOnce(new Error('Trade fetch failed'))

      const { result } = renderHook(() => useLogs(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isError).toBe(true))
      expect(result.current.error).toBeInstanceOf(Error)
    })
  })
})
