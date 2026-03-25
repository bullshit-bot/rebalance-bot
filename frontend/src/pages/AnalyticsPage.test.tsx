import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import AnalyticsPage from './AnalyticsPage'

// Mock analytics hooks
vi.mock('@/hooks/use-analytics-queries', () => ({
  useEquityCurve: vi.fn(),
  usePnL: vi.fn(),
  useDrawdown: vi.fn(),
  useFees: vi.fn(),
}))

import {
  useEquityCurve,
  usePnL,
  useDrawdown,
  useFees,
} from '@/hooks/use-analytics-queries'

function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false },
    },
  })
}

function renderWithProviders(ui: ReactNode) {
  const qc = createQueryClient()
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AnalyticsPage', () => {
  const mockEquityData = {
    from: 1000,
    to: 2000,
    data: [
      { timestamp: 1500, valueUsd: 100000 },
      { timestamp: 1600, valueUsd: 110000 },
      { timestamp: 1700, valueUsd: 105000 },
    ],
  }

  const mockPnLData = {
    totalPnl: 5000,
    byAsset: { BTC: 3000, ETH: 2000 },
    byPeriod: { daily: 100, weekly: 700, monthly: 3000 },
  }

  const mockDrawdownData = {
    maxDrawdownPct: -0.15,
    maxDrawdownUsd: -15000,
    peakValue: 100000,
    troughValue: 85000,
    peakDate: 1000,
    troughDate: 1500,
    currentDrawdownPct: -0.05,
    drawdownSeries: [{ timestamp: 1500, drawdownPct: -0.15 }],
  }

  const mockFeeData = {
    totalFeesUsd: 500,
    byExchange: { binance: 300, okx: 200 },
    byAsset: { BTC: 250, ETH: 250 },
    byPeriod: { daily: 10, weekly: 70, monthly: 300 },
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useEquityCurve).mockReturnValue({
      data: mockEquityData,
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(usePnL).mockReturnValue({
      data: mockPnLData,
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useDrawdown).mockReturnValue({
      data: mockDrawdownData,
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useFees).mockReturnValue({
      data: mockFeeData,
      isLoading: false,
      isError: false,
    } as any)
  })

  it('renders page title', () => {
    renderWithProviders(<AnalyticsPage />)
    expect(screen.getByText('Analytics')).toBeInTheDocument()
  })

  it('renders all tabs', () => {
    renderWithProviders(<AnalyticsPage />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('PnL')).toBeInTheDocument()
    expect(screen.getByText('Drawdown')).toBeInTheDocument()
    expect(screen.getByText('Fees')).toBeInTheDocument()
  })

  describe('Overview Tab', () => {
    it('renders stat cards with correct values', () => {
      renderWithProviders(<AnalyticsPage />)
      expect(screen.getByText('Total Return')).toBeInTheDocument()
      expect(screen.getByText('Net PnL')).toBeInTheDocument()
      expect(screen.getByText('Max Drawdown')).toBeInTheDocument()
      expect(screen.getByText('Total Fees')).toBeInTheDocument()
    })

    it('displays equity curve chart when data loaded', () => {
      renderWithProviders(<AnalyticsPage />)
      expect(screen.getByText('Equity Curve (90d)')).toBeInTheDocument()
    })

    it('shows loading state for equity curve', async () => {
      vi.mocked(useEquityCurve).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      expect(screen.getByText('Loading…')).toBeInTheDocument()
    })

    it('shows error state for equity curve', () => {
      vi.mocked(useEquityCurve).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      expect(screen.getByText('Failed to load equity data.')).toBeInTheDocument()
    })

    it('calculates total return correctly', () => {
      renderWithProviders(<AnalyticsPage />)
      // Return = (105000 - 100000) / 100000 * 100 = 5%
      expect(screen.getByText('+5.0%')).toBeInTheDocument()
    })

    it('displays net pnl', () => {
      renderWithProviders(<AnalyticsPage />)
      expect(screen.getByText('$5,000')).toBeInTheDocument()
    })
  })

  describe('PnL Tab', () => {
    it('renders PnL tab content when clicked', async () => {
      renderWithProviders(<AnalyticsPage />)
      const pnlTab = screen.getByText('PnL')
      fireEvent.click(pnlTab)
      await waitFor(() => {
        expect(screen.getByText('PnL — Daily')).toBeInTheDocument()
      })
    })

    it('shows loading state in PnL tab', async () => {
      vi.mocked(usePnL).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('PnL'))
      await waitFor(() => {
        expect(screen.getByText('Loading…')).toBeInTheDocument()
      })
    })

    it('shows error state in PnL tab', async () => {
      vi.mocked(usePnL).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('PnL'))
      await waitFor(() => {
        expect(screen.getByText('Failed to load PnL data.')).toBeInTheDocument()
      })
    })

    it('switches between period filters', async () => {
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('PnL'))
      await waitFor(() => {
        const weeklyButton = screen.getAllByText('weekly')[0]
        fireEvent.click(weeklyButton)
        expect(screen.getByText('PnL — Weekly')).toBeInTheDocument()
      })
    })

    it('displays asset data in chart when available', async () => {
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('PnL'))
      await waitFor(() => {
        // Chart data should be rendered (we can check for the section title)
        expect(screen.getByText('PnL — Daily')).toBeInTheDocument()
      })
    })

    it('shows empty state when no asset data', async () => {
      vi.mocked(usePnL).mockReturnValue({
        data: { ...mockPnLData, byAsset: {} },
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('PnL'))
      await waitFor(() => {
        expect(screen.getByText('No PnL data available.')).toBeInTheDocument()
      })
    })
  })

  describe('Drawdown Tab', () => {
    it('renders Drawdown tab content', async () => {
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('Drawdown'))
      await waitFor(() => {
        expect(screen.getByText('Drawdown (90d)')).toBeInTheDocument()
      })
    })

    it('shows loading state in Drawdown tab', async () => {
      vi.mocked(useDrawdown).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('Drawdown'))
      await waitFor(() => {
        expect(screen.getByText('Loading…')).toBeInTheDocument()
      })
    })

    it('shows error state in Drawdown tab', async () => {
      vi.mocked(useDrawdown).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('Drawdown'))
      await waitFor(() => {
        expect(screen.getByText('Failed to load drawdown data.')).toBeInTheDocument()
      })
    })
  })

  describe('Fees Tab', () => {
    it('renders Fees tab content', async () => {
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('Fees'))
      await waitFor(() => {
        expect(screen.getByText('Fees by Exchange')).toBeInTheDocument()
        expect(screen.getByText('Fee Breakdown')).toBeInTheDocument()
      })
    })

    it('shows loading state in Fees tab', async () => {
      vi.mocked(useFees).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('Fees'))
      await waitFor(() => {
        const loadingElements = screen.getAllByText('Loading…')
        expect(loadingElements.length).toBeGreaterThan(0)
      })
    })

    it('shows error state in Fees tab', async () => {
      vi.mocked(useFees).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('Fees'))
      await waitFor(() => {
        const errorElements = screen.getAllByText('Failed to load fee data.')
        expect(errorElements.length).toBeGreaterThan(0)
      })
    })

    it('renders fee breakdown table with correct data', async () => {
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('Fees'))
      await waitFor(() => {
        expect(screen.getByText('binance')).toBeInTheDocument()
        expect(screen.getByText('okx')).toBeInTheDocument()
      })
    })

    it('calculates fee percentages correctly', async () => {
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('Fees'))
      await waitFor(() => {
        // binance: 300 / 500 = 60%
        expect(screen.getByText('60.0%')).toBeInTheDocument()
        // okx: 200 / 500 = 40%
        expect(screen.getByText('40.0%')).toBeInTheDocument()
      })
    })
  })

  describe('Error handling', () => {
    it('handles all hooks loading simultaneously', () => {
      vi.mocked(useEquityCurve).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any)
      vi.mocked(usePnL).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any)
      vi.mocked(useDrawdown).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any)
      vi.mocked(useFees).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      const loadingElements = screen.getAllByText('Loading…')
      expect(loadingElements.length).toBeGreaterThan(0)
    })

    it('handles all hooks with errors simultaneously', async () => {
      vi.mocked(useEquityCurve).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as any)
      vi.mocked(usePnL).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as any)
      vi.mocked(useDrawdown).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as any)
      vi.mocked(useFees).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      expect(screen.getByText('Failed to load equity data.')).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('handles empty equity data array', () => {
      vi.mocked(useEquityCurve).mockReturnValue({
        data: { from: 0, to: 0, data: [] },
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      expect(screen.getByText('+0.0%')).toBeInTheDocument()
    })

    it('handles zero investment scenario', async () => {
      vi.mocked(useFees).mockReturnValue({
        data: { ...mockFeeData, totalFeesUsd: 0 },
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      fireEvent.click(screen.getByText('Fees'))
      await waitFor(() => {
        expect(screen.getByText('$0.0')).toBeInTheDocument()
      })
    })

    it('handles negative PnL values', () => {
      vi.mocked(usePnL).mockReturnValue({
        data: { ...mockPnLData, totalPnl: -1000 },
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<AnalyticsPage />)
      expect(screen.getByText('$-1,000')).toBeInTheDocument()
    })
  })
})
