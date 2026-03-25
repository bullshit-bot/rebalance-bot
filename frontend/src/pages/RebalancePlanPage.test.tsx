import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import RebalancePlanPage from './RebalancePlanPage'

vi.mock('@/hooks/use-rebalance-queries', () => ({
  useRebalancePreview: vi.fn(),
  useTriggerRebalance: vi.fn(),
}))

vi.mock('@/hooks/use-portfolio-queries', () => ({
  usePortfolio: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { useRebalancePreview, useTriggerRebalance } from '@/hooks/use-rebalance-queries'
import { usePortfolio } from '@/hooks/use-portfolio-queries'
import { toast } from 'sonner'

function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('RebalancePlanPage', () => {
  const mockPortfolioData = {
    totalValueUsd: 10000,
    assets: [
      { asset: 'BTC', amount: 1, valueUsd: 5000, currentPct: 50, targetPct: 40, driftPct: 10 },
      { asset: 'ETH', amount: 10, valueUsd: 3000, currentPct: 30, targetPct: 40, driftPct: -10 },
    ],
  }

  const mockPreviewData = {
    trades: [
      {
        side: 'sell',
        pair: 'BTC/USDT',
        exchange: 'binance',
        type: 'limit',
        amount: 0.1,
        price: 50000,
      },
      {
        side: 'buy',
        pair: 'ETH/USDT',
        exchange: 'binance',
        type: 'limit',
        amount: 1,
        price: 3000,
      },
    ],
  }

  const mockTriggerMutation = {
    mutate: vi.fn(),
    isPending: false,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton when data is loading', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: true, data: undefined, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: undefined, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getByText('Rebalance Plan')).toBeInTheDocument()
  })

  it('shows error message when data fetch fails', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: undefined, isError: true } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: undefined, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getByText('Failed to load rebalance plan data. Please try again.')).toBeInTheDocument()
  })

  it('renders stat cards section', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getByText('Portfolio NAV')).toBeInTheDocument()
    expect(screen.getByText('$10,000')).toBeInTheDocument()
  })

  it('displays total actions count', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getByText('Total Actions')).toBeInTheDocument()
  })

  it('renders proposed actions section with trade cards', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getByText('Proposed Actions')).toBeInTheDocument()
    expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
    expect(screen.getByText('ETH/USDT')).toBeInTheDocument()
  })

  it('renders approve and execute button', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getByRole('button', { name: /Approve & Execute/i })).toBeInTheDocument()
  })

  it('renders dry run button', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getByRole('button', { name: /Dry Run/i })).toBeInTheDocument()
  })

  it('renders reject plan button', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getByRole('button', { name: /Reject Plan/i })).toBeInTheDocument()
  })

  it('opens confirmation dialog when approve button is clicked', async () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    const approveButton = screen.getByRole('button', { name: /Approve & Execute/i })
    fireEvent.click(approveButton)
    await waitFor(() => {
      expect(screen.getByText('Approve & Execute Rebalance')).toBeInTheDocument()
    })
  })

  it('calls trigger mutation when confirm dialog is confirmed', async () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    const approveButton = screen.getByRole('button', { name: /Approve & Execute/i })
    fireEvent.click(approveButton)
    await waitFor(() => {
      expect(screen.getByText('Approve & Execute Rebalance')).toBeInTheDocument()
    })
  })

  it('shows success toast on successful rebalance', async () => {
    const mutate = vi.fn((_, opts) => {
      opts.onSuccess()
    })
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue({ mutate, isPending: false } as any)

    renderWithProviders(<RebalancePlanPage />)
    const approveButton = screen.getByRole('button', { name: /Approve & Execute/i })
    fireEvent.click(approveButton)
    await waitFor(() => {
      expect(screen.getByText('Approve & Execute Rebalance')).toBeInTheDocument()
    })
  })

  it('shows error toast on rebalance failure', async () => {
    const mutate = vi.fn((_, opts) => {
      opts.onError(new Error('Rebalance failed'))
    })
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue({ mutate, isPending: false } as any)

    renderWithProviders(<RebalancePlanPage />)
    const approveButton = screen.getByRole('button', { name: /Approve & Execute/i })
    fireEvent.click(approveButton)
    await waitFor(() => {
      expect(screen.getByText('Approve & Execute Rebalance')).toBeInTheDocument()
    })
  })

  it('displays preview section with trade details', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getByText('Preview')).toBeInTheDocument()
  })

  it('shows no rebalance needed message when trades array is empty', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: { trades: [] }, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getByText('No rebalance actions needed at this time.')).toBeInTheDocument()
  })

  it('disables approve button when no trades exist', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: { trades: [] }, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    const approveButton = screen.getByRole('button', { name: /Approve & Execute/i })
    expect(approveButton).toBeDisabled()
  })

  it('disables approve button while executing', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue({ mutate: vi.fn(), isPending: true } as any)

    renderWithProviders(<RebalancePlanPage />)
    const approveButton = screen.getByRole('button', { name: /Executing/i })
    expect(approveButton).toBeDisabled()
  })

  it('displays trade side with badge styling', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
    expect(screen.getByText('ETH/USDT')).toBeInTheDocument()
  })

  it('displays exchange information for each trade', () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    expect(screen.getAllByText('binance').length).toBeGreaterThan(0)
  })

  it('closes confirmation dialog on cancel', async () => {
    vi.mocked(usePortfolio).mockReturnValue({ isLoading: false, data: mockPortfolioData, isError: false } as any)
    vi.mocked(useRebalancePreview).mockReturnValue({ isLoading: false, data: mockPreviewData, isError: false } as any)
    vi.mocked(useTriggerRebalance).mockReturnValue(mockTriggerMutation as any)

    renderWithProviders(<RebalancePlanPage />)
    const approveButton = screen.getByRole('button', { name: /Approve & Execute/i })
    fireEvent.click(approveButton)
    await waitFor(() => {
      expect(screen.getByText('Approve & Execute Rebalance')).toBeInTheDocument()
    })
  })
})
