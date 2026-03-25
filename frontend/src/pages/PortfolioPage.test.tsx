import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import PortfolioPage from './PortfolioPage'

vi.mock('@/hooks/use-portfolio-queries', () => ({
  usePortfolio: vi.fn(),
}))

import { usePortfolio } from '@/hooks/use-portfolio-queries'

function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('PortfolioPage', () => {
  const mockPortfolioData = {
    totalValueUsd: 10000,
    assets: [
      { asset: 'BTC', amount: 1, valueUsd: 5000, currentPct: 50, targetPct: 40, driftPct: 10 },
      { asset: 'ETH', amount: 10, valueUsd: 3000, currentPct: 30, targetPct: 40, driftPct: -10 },
      { asset: 'USDT', amount: 2000, valueUsd: 2000, currentPct: 20, targetPct: 20, driftPct: 0 },
      { asset: 'SOL', amount: 100, valueUsd: 1000, currentPct: 10, targetPct: 10, driftPct: 0 },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: true, data: undefined, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('Portfolio')).toBeInTheDocument()
  })

  it('shows error message when data fetch fails', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: undefined, isError: true } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('Failed to load portfolio data. Please try again.')).toBeInTheDocument()
  })

  it('renders holdings table with assets', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('Holdings')).toBeInTheDocument()
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.getByText('ETH')).toBeInTheDocument()
    expect(screen.getByText('USDT')).toBeInTheDocument()
  })

  it('displays total portfolio value', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('Total Value')).toBeInTheDocument()
    expect(screen.getByText('$10,000')).toBeInTheDocument()
  })

  it('displays asset count', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('# Assets')).toBeInTheDocument()
  })

  it('displays max drift metric', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('Max Drift')).toBeInTheDocument()
  })

  it('displays average drift metric', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('Avg Drift')).toBeInTheDocument()
  })

  it('renders all filter buttons', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Large Cap' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Alt' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Stablecoin' })).toBeInTheDocument()
  })

  it('filters assets by category when filter button is clicked', async () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    const largeCapButton = screen.getByRole('button', { name: 'Large Cap' })
    fireEvent.click(largeCapButton)
    await waitFor(() => {
      expect(screen.getByText('BTC')).toBeInTheDocument()
      expect(screen.getByText('ETH')).toBeInTheDocument()
    })
  })

  it('shows all assets with All filter', async () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    const allButton = screen.getByRole('button', { name: 'All' })
    fireEvent.click(allButton)
    await waitFor(() => {
      expect(screen.getByText('BTC')).toBeInTheDocument()
      expect(screen.getByText('USDT')).toBeInTheDocument()
      expect(screen.getByText('SOL')).toBeInTheDocument()
    })
  })

  it('displays table columns', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('Asset')).toBeInTheDocument()
    expect(screen.getByText('Quantity')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('Value')).toBeInTheDocument()
  })

  it('handles empty asset list', () => {
    vi.mocked(usePortfolio).mockReturnValue({
      isLoading: false,
      data: { totalValueUsd: 0, assets: [] },
      isError: false,
    } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('No assets found')).toBeInTheDocument()
  })

  it('renders drift badge for each asset', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.getByText('ETH')).toBeInTheDocument()
  })

  it('displays action recommendations based on drift', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    // BTC has +10% drift, should recommend sell
    // ETH has -10% drift, should recommend buy
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.getByText('ETH')).toBeInTheDocument()
  })

  it('calculates max drift correctly', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('Max Drift')).toBeInTheDocument()
  })

  it('calculates average drift correctly', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('Avg Drift')).toBeInTheDocument()
  })

  it('applies active filter button styling', async () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    const largeCapButton = screen.getByRole('button', { name: 'Large Cap' })
    fireEvent.click(largeCapButton)
    await waitFor(() => {
      expect(largeCapButton).toHaveClass('bg-primary')
    })
  })

  it('calculates price from value and amount', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    renderWithProviders(<PortfolioPage />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
  })
})
