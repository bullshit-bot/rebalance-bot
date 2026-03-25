import { renderHook, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { vi, describe, it, expect, beforeEach } from 'vitest'
import { type ReactNode } from 'react'

vi.mock('@/lib/api', () => ({
  api: {
    getHealth: vi.fn(),
    getPortfolio: vi.fn(),
  },
}))

import { api } from '@/lib/api'
import { useAlerts } from '@/hooks/use-alert-queries'

function createWrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  )
}

describe('use-alert-queries.ts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('useAlerts', () => {
    it('fetches alerts', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 3600,
        exchanges: { binance: 'connected' },
      })
      vi.mocked(api.getPortfolio).mockResolvedValueOnce({
        totalValueUsd: 100000,
        assets: [],
        updatedAt: Date.now(),
      })

      const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(Array.isArray(result.current.data)).toBe(true)
    })

    it('calls both health and portfolio apis', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 0,
        exchanges: {},
      })
      vi.mocked(api.getPortfolio).mockResolvedValueOnce({
        totalValueUsd: 0,
        assets: [],
        updatedAt: 0,
      })

      const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(api.getHealth).toHaveBeenCalled()
      expect(api.getPortfolio).toHaveBeenCalled()
    })

    it('creates critical alert for disconnected exchange', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 3600,
        exchanges: {
          binance: 'disconnected',
          okx: 'connected',
        },
      })
      vi.mocked(api.getPortfolio).mockResolvedValueOnce({
        totalValueUsd: 100000,
        assets: [],
        updatedAt: Date.now(),
      })

      const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const alerts = result.current.data!
      const binanceAlert = alerts.find((a) => a.id === 'ex-binance')
      expect(binanceAlert).toBeDefined()
      expect(binanceAlert?.severity).toBe('critical')
      expect(binanceAlert?.title).toContain('binance')
      expect(binanceAlert?.title).toContain('Disconnected')
    })

    it('skips exchange alerts when health check fails', async () => {
      vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('Health check failed'))
      vi.mocked(api.getPortfolio).mockResolvedValueOnce({
        totalValueUsd: 100000,
        assets: [],
        updatedAt: Date.now(),
      })

      const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const alerts = result.current.data!
      const exchangeAlerts = alerts.filter((a) => a.id.startsWith('ex-'))
      expect(exchangeAlerts).toHaveLength(0)
    })

    it('creates warning alert for asset drift > 3%', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 3600,
        exchanges: { binance: 'connected' },
      })
      vi.mocked(api.getPortfolio).mockResolvedValueOnce({
        totalValueUsd: 100000,
        assets: [
          {
            asset: 'BTC',
            amount: 1,
            valueUsd: 50000,
            currentPct: 55,
            targetPct: 50,
            driftPct: 5, // > 3%, should alert
            exchange: 'binance',
          },
          {
            asset: 'ETH',
            amount: 10,
            valueUsd: 30000,
            currentPct: 30,
            targetPct: 30,
            driftPct: 0, // No drift
            exchange: 'binance',
          },
        ],
        updatedAt: Date.now(),
      })

      const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const alerts = result.current.data!
      const btcAlert = alerts.find((a) => a.id === 'drift-BTC')
      expect(btcAlert).toBeDefined()
      expect(btcAlert?.severity).toBe('warning')
      expect(btcAlert?.title).toContain('BTC')
      expect(btcAlert?.title).toContain('5.0%')
    })

    it('creates alert for negative drift', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 3600,
        exchanges: { binance: 'connected' },
      })
      vi.mocked(api.getPortfolio).mockResolvedValueOnce({
        totalValueUsd: 100000,
        assets: [
          {
            asset: 'SOL',
            amount: 100,
            valueUsd: 20000,
            currentPct: 15,
            targetPct: 20,
            driftPct: -5, // < -3%, should alert
            exchange: 'binance',
          },
        ],
        updatedAt: Date.now(),
      })

      const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const alerts = result.current.data!
      const solAlert = alerts.find((a) => a.id === 'drift-SOL')
      expect(solAlert).toBeDefined()
      expect(solAlert?.message).toContain('below')
      expect(solAlert?.message).toContain('5.0%')
    })

    it('skips drift alerts when portfolio check fails', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 3600,
        exchanges: { binance: 'connected' },
      })
      vi.mocked(api.getPortfolio).mockRejectedValueOnce(new Error('Portfolio fetch failed'))

      const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const alerts = result.current.data!
      const driftAlerts = alerts.filter((a) => a.id.startsWith('drift-'))
      expect(driftAlerts).toHaveLength(0)
    })

    it('returns empty array when no alerts', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 3600,
        exchanges: { binance: 'connected' },
      })
      vi.mocked(api.getPortfolio).mockResolvedValueOnce({
        totalValueUsd: 100000,
        assets: [
          {
            asset: 'BTC',
            amount: 1,
            valueUsd: 100000,
            currentPct: 50,
            targetPct: 50,
            driftPct: 0,
            exchange: 'binance',
          },
        ],
        updatedAt: Date.now(),
      })

      const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toHaveLength(0)
    })

    it('combines exchange and drift alerts', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 3600,
        exchanges: {
          binance: 'disconnected',
          okx: 'connected',
        },
      })
      vi.mocked(api.getPortfolio).mockResolvedValueOnce({
        totalValueUsd: 100000,
        assets: [
          {
            asset: 'BTC',
            amount: 1,
            valueUsd: 70000,
            currentPct: 70,
            targetPct: 50,
            driftPct: 20,
            exchange: 'binance',
          },
        ],
        updatedAt: Date.now(),
      })

      const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const alerts = result.current.data!
      expect(alerts).toHaveLength(2)
      expect(alerts.some((a) => a.id === 'ex-binance')).toBe(true)
      expect(alerts.some((a) => a.id === 'drift-BTC')).toBe(true)
    })

    it('sets dismissed to false for all alerts', async () => {
      vi.mocked(api.getHealth).mockResolvedValueOnce({
        status: 'ok',
        uptimeSeconds: 3600,
        exchanges: { binance: 'disconnected' },
      })
      vi.mocked(api.getPortfolio).mockResolvedValueOnce({
        totalValueUsd: 100000,
        assets: [],
        updatedAt: Date.now(),
      })

      const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))

      const alerts = result.current.data!
      alerts.forEach((alert) => {
        expect(alert.dismissed).toBe(false)
      })
    })

    it('handles error from both apis', async () => {
      vi.mocked(api.getHealth).mockRejectedValueOnce(new Error('Health failed'))
      vi.mocked(api.getPortfolio).mockRejectedValueOnce(new Error('Portfolio failed'))

      const { result } = renderHook(() => useAlerts(), { wrapper: createWrapper() })

      await waitFor(() => expect(result.current.isSuccess).toBe(true))
      expect(result.current.data).toEqual([])
    })
  })
})
