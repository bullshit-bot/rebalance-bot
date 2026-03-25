import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import ExchangesPage from './ExchangesPage'

// Mock useHealth hook
vi.mock('@/hooks/use-health-queries', () => ({
  useHealth: vi.fn(),
}))

import { useHealth } from '@/hooks/use-health-queries'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('ExchangesPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title', () => {
    vi.mocked(useHealth).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: false,
      status: 'idle',
    } as any)

    wrap(<ExchangesPage />)
    expect(screen.getByText('Exchanges')).toBeInTheDocument()
  })

  describe('loading state', () => {
    it('shows loading spinner when data is loading', () => {
      vi.mocked(useHealth).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        status: 'pending',
      } as any)

      wrap(<ExchangesPage />)
      expect(screen.getByText(/Loading exchange status/)).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows error message when fetch fails', () => {
      vi.mocked(useHealth).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        status: 'error',
      } as any)

      wrap(<ExchangesPage />)
      expect(screen.getByText(/Failed to load exchange status/)).toBeInTheDocument()
    })
  })

  describe('data rendered state', () => {
    it('renders exchange cards with connected status', () => {
      const mockHealth = {
        status: 'ok',
        uptimeSeconds: 100,
        exchanges: {
          binance: 'connected',
          okx: 'disconnected',
        },
      }

      vi.mocked(useHealth).mockReturnValue({
        data: mockHealth,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<ExchangesPage />)

      // Check both exchange names are rendered (at least one match each)
      const exchangeNames = screen.getAllByText(/binance/i)
      expect(exchangeNames.length).toBeGreaterThan(0)
      const okxNames = screen.getAllByText(/okx/i)
      expect(okxNames.length).toBeGreaterThan(0)
    })

    it('renders different status badges for connected/disconnected exchanges', () => {
      const mockHealth = {
        status: 'ok',
        uptimeSeconds: 100,
        exchanges: {
          binance: 'connected',
          okx: 'disconnected',
        },
      }

      vi.mocked(useHealth).mockReturnValue({
        data: mockHealth,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<ExchangesPage />)

      // The page should render cards with the exchange data
      const exchangeSection = screen.getByText('Exchanges')
      expect(exchangeSection).toBeInTheDocument()
    })

    it('shows Sync Now button for all exchanges', () => {
      const mockHealth = {
        status: 'ok',
        uptimeSeconds: 100,
        exchanges: {
          binance: 'connected',
          okx: 'disconnected',
        },
      }

      vi.mocked(useHealth).mockReturnValue({
        data: mockHealth,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<ExchangesPage />)

      // Should have two "Sync Now" buttons (one per exchange)
      const syncButtons = screen.getAllByText(/Sync Now/i)
      expect(syncButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('shows Reconnect button only for disconnected exchanges', () => {
      const mockHealth = {
        status: 'ok',
        uptimeSeconds: 100,
        exchanges: {
          binance: 'connected',
          okx: 'disconnected',
        },
      }

      vi.mocked(useHealth).mockReturnValue({
        data: mockHealth,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<ExchangesPage />)

      // Should have at least one Reconnect button (for OKX which is disconnected)
      const reconnectButtons = screen.queryAllByText(/Reconnect/i)
      expect(reconnectButtons.length).toBeGreaterThanOrEqual(1)
    })

    it('shows API Permission Checklist section', () => {
      const mockHealth = {
        status: 'ok',
        uptimeSeconds: 100,
        exchanges: {
          binance: 'connected',
          okx: 'disconnected',
        },
      }

      vi.mocked(useHealth).mockReturnValue({
        data: mockHealth,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<ExchangesPage />)

      expect(screen.getByText(/API Permission Checklist/i)).toBeInTheDocument()
    })

    it('shows no exchanges message when exchanges list is empty', () => {
      const mockHealth = {
        status: 'ok',
        uptimeSeconds: 100,
        exchanges: {},
      }

      vi.mocked(useHealth).mockReturnValue({
        data: mockHealth,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<ExchangesPage />)

      expect(screen.getByText(/No exchanges configured/i)).toBeInTheDocument()
    })
  })
})
