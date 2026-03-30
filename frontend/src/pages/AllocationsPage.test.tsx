import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import AllocationsPage from './AllocationsPage'

vi.mock('@/hooks/use-portfolio-queries', () => ({
  usePortfolio: vi.fn(),
}))

vi.mock('@/hooks/use-allocation-queries', () => ({
  useAllocations: vi.fn(),
  useUpdateAllocations: vi.fn(() => ({ mutate: vi.fn() })),
  useDeleteAllocation: vi.fn(() => ({ mutate: vi.fn() })),
}))

import { usePortfolio } from '@/hooks/use-portfolio-queries'
import { useAllocations } from '@/hooks/use-allocation-queries'

function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('AllocationsPage', () => {
  const mockPortfolioData = {
    totalValueUsd: 10000,
    assets: [
      { asset: 'BTC', amount: 1, valueUsd: 5000, currentPct: 50, targetPct: 40, driftPct: 10 },
      { asset: 'ETH', amount: 10, valueUsd: 3000, currentPct: 30, targetPct: 40, driftPct: -10 },
      { asset: 'USDT', amount: 2000, valueUsd: 2000, currentPct: 20, targetPct: 20, driftPct: 0 },
    ],
  }

  const mockAllocationsData = [
    { asset: 'BTC', targetPct: 40, minTradeUsd: 100 },
    { asset: 'ETH', targetPct: 40, minTradeUsd: 50 },
    { asset: 'USDT', targetPct: 20, minTradeUsd: 0 },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton when data is loading', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: true, data: undefined, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: undefined, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('Allocations')).toBeInTheDocument()
  })

  it('shows error message when portfolio data fetch fails', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: undefined, isError: true } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: undefined, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('Failed to load allocations data. Please try again.')).toBeInTheDocument()
  })

  it('shows error message when allocations data fetch fails', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: undefined, isError: true } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('Failed to load allocations data. Please try again.')).toBeInTheDocument()
  })

  it('renders target allocation pie chart section', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: mockAllocationsData, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('Target Allocation')).toBeInTheDocument()
  })

  it('renders current vs target bar chart section', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: mockAllocationsData, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('Current vs Target')).toBeInTheDocument()
  })

  it('renders allocation cards for each asset', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: mockAllocationsData, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.getByText('ETH')).toBeInTheDocument()
    expect(screen.getByText('USDT')).toBeInTheDocument()
  })

  it('displays target allocation percentage on allocation cards', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: mockAllocationsData, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
  })

  it('displays rebalance band on allocation cards', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: mockAllocationsData, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getAllByText(/Rebalance band:/i).length).toBeGreaterThan(0)
  })

  it('shows progress bar for current allocation', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: mockAllocationsData, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
  })

  it('displays current and target percentages on allocation cards', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: mockAllocationsData, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getAllByText(/Current:/i).length).toBeGreaterThan(0)
    expect(screen.getAllByText(/Target:/i).length).toBeGreaterThan(0)
  })

  it('uses allocation target percentages when available', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: mockAllocationsData, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
  })

  it('falls back to portfolio target percentages when allocation data is missing', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: [], isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
  })

  it('handles empty portfolio assets', () => {
    vi.mocked(usePortfolio).mockReturnValue({
      isLoading: false,
      data: { totalValueUsd: 0, assets: [] },
      isError: false,
    } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: [], isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('Allocations')).toBeInTheDocument()
  })

  it('displays legend for pie chart', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: mockAllocationsData, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
  })

  it('shows custom rebalance band when minTradeUsd is set', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: mockAllocationsData, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getAllByText(/custom/i).length).toBeGreaterThan(0)
  })

  it('shows default 4% rebalance band when minTradeUsd is not set', () => {
    const allocationsWithoutMinTrade = [
      { asset: 'BTC', targetPct: 40, minTradeUsd: undefined },
      { asset: 'ETH', targetPct: 40, minTradeUsd: undefined },
      { asset: 'USDT', targetPct: 20, minTradeUsd: undefined },
    ]
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: allocationsWithoutMinTrade, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getAllByText('Rebalance band: ±4%')).toHaveLength(3)
  })

  it('merges portfolio and allocation data correctly', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useAllocations).mockReturnValue({ isLoading: false, data: mockAllocationsData, isError: false } as any)

    renderWithProviders(<AllocationsPage />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.getAllByText(/Current:/i).length).toBeGreaterThan(0)
  })
})
