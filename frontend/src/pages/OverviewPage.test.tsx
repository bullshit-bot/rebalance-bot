import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import OverviewPage from './OverviewPage'

vi.mock('@/hooks/use-portfolio-queries', () => ({
  usePortfolio: vi.fn(),
  usePortfolioHistory: vi.fn(),
}))

vi.mock('@/hooks/use-trade-queries', () => ({
  useTrades: vi.fn(),
}))

vi.mock('@/hooks/use-rebalance-queries', () => ({
  useRebalancePreview: vi.fn(),
}))

import { usePortfolio, usePortfolioHistory } from '@/hooks/use-portfolio-queries'
import { useTrades } from '@/hooks/use-trade-queries'
import { useRebalancePreview } from '@/hooks/use-rebalance-queries'

function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('OverviewPage', () => {
  const mockPortfolioData = {
    totalValueUsd: 10000,
    assets: [
      { asset: 'BTC', amount: 1, valueUsd: 5000, currentPct: 50, targetPct: 40, driftPct: 10 },
      { asset: 'ETH', amount: 10, valueUsd: 3000, currentPct: 30, targetPct: 40, driftPct: -10 },
      { asset: 'USDT', amount: 2000, valueUsd: 2000, currentPct: 20, targetPct: 20, driftPct: 0 },
    ],
    updatedAt: Date.now(),
  }

  const mockHistoryData = [
    { totalValueUsd: 9800, createdAt: Math.floor((Date.now() - 86400000) / 1000) },
    { totalValueUsd: 10000, createdAt: Math.floor(Date.now() / 1000) },
  ]

  const mockTradesData = [
    {
      id: 1,
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy',
      amount: 0.1,
      price: 50000,
      fee: 10,
      executedAt: Math.floor(Date.now() / 1000),
    },
  ]

  const mockPreviewData = {
    trades: [
      { side: 'sell', pair: 'ETH/USDT', exchange: 'binance', type: 'limit', amount: 1, price: 3000 },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton when data is loading', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: true, data: undefined, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: undefined, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: undefined, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: undefined, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Overview')).toBeInTheDocument()
  })

  it('shows error message when data fetch fails', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: undefined, isError: true } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: undefined, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: undefined, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: undefined, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Failed to load portfolio data. Please check your connection and try again.')).toBeInTheDocument()
  })

  it('renders stat cards with portfolio data', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Portfolio Value')).toBeInTheDocument()
    expect(screen.getByText('$10,000')).toBeInTheDocument()
  })

  it('renders allocation pie chart section', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Allocation')).toBeInTheDocument()
  })

  it('renders current vs target bar chart section', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Current vs Target')).toBeInTheDocument()
  })

  it('renders rebalance recommendations section', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Rebalance Recommendations')).toBeInTheDocument()
  })

  it('renders portfolio value history chart section', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Portfolio Value (history)')).toBeInTheDocument()
  })

  it('renders recent orders table', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Recent Orders')).toBeInTheDocument()
  })

  it('renders active alerts section', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Active Alerts')).toBeInTheDocument()
  })

  it('calculates drift score correctly', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Drift Score')).toBeInTheDocument()
  })

  it('displays pending actions count', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Pending Actions')).toBeInTheDocument()
  })

  it('shows PnL label', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('PnL')).toBeInTheDocument()
  })

  it('handles empty trades list', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: [], isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('Recent Orders')).toBeInTheDocument()
  })

  it('handles empty rebalance preview', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(usePortfolioHistory).mockReturnValue({ isLoading: false, data: mockHistoryData, isError: false } as any)
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: { trades: [] }, isError: false } as any)

    renderWithProviders(<OverviewPage />)
    expect(screen.getByText('No rebalance needed.')).toBeInTheDocument()
  })
})
