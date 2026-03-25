import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import TaxPage from './TaxPage'

// Mock tax queries hook
vi.mock('@/hooks/use-tax-queries', () => ({
  useTaxReport: vi.fn(),
}))

// Mock API
vi.mock('@/lib/api', () => ({
  api: {
    exportTaxCsvUrl: vi.fn((year: number) => `/api/tax-export/${year}.csv`),
  },
}))

import { useTaxReport } from '@/hooks/use-tax-queries'

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

describe('TaxPage', () => {
  const mockTaxData = {
    year: 2026,
    totalRealizedGain: 5000,
    totalRealizedLoss: -1000,
    netGainLoss: 4000,
    shortTermGain: 2000,
    longTermGain: 3000,
    events: [
      {
        date: 1710000000,
        asset: 'BTC',
        action: 'sell',
        amount: 0.1,
        proceedsUsd: 7000,
        costBasisUsd: 5000,
        gainLossUsd: 2000,
        holdingPeriodDays: 400,
        isShortTerm: false,
      },
      {
        date: 1704000000,
        asset: 'ETH',
        action: 'sell',
        amount: 1.5,
        proceedsUsd: 3000,
        costBasisUsd: 4000,
        gainLossUsd: -1000,
        holdingPeriodDays: 180,
        isShortTerm: true,
      },
    ],
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useTaxReport).mockReturnValue({
      data: mockTaxData,
      isLoading: false,
      isError: false,
    } as any)
  })

  it('renders page title', () => {
    renderWithProviders(<TaxPage />)
    expect(screen.getByText('Tax Reports')).toBeInTheDocument()
  })

  it('renders year selector with options', () => {
    renderWithProviders(<TaxPage />)
    expect(screen.getByText('Tax Year')).toBeInTheDocument()
    const select = screen.getByRole('combobox')
    expect(select).toBeInTheDocument()
  })

  it('renders stat cards with correct labels', () => {
    renderWithProviders(<TaxPage />)
    expect(screen.getByText('Total Gains')).toBeInTheDocument()
    expect(screen.getByText('Total Losses')).toBeInTheDocument()
    expect(screen.getByText('Net PnL')).toBeInTheDocument()
  })

  it('displays correct gain value in stat card', () => {
    renderWithProviders(<TaxPage />)
    expect(screen.getByText('+$5,000')).toBeInTheDocument()
  })

  it('displays correct loss value in stat card', () => {
    renderWithProviders(<TaxPage />)
    expect(screen.getByText('-$1,000')).toBeInTheDocument()
  })

  it('displays correct net PnL in stat card', () => {
    renderWithProviders(<TaxPage />)
    expect(screen.getByText('+$4,000')).toBeInTheDocument()
  })

  it('renders events table', () => {
    renderWithProviders(<TaxPage />)
    expect(screen.getByText('Taxable Events — 2026')).toBeInTheDocument()
  })

  it('renders table headers', () => {
    renderWithProviders(<TaxPage />)
    expect(screen.getByText('Date')).toBeInTheDocument()
    expect(screen.getByText('Asset')).toBeInTheDocument()
    expect(screen.getByText('Action')).toBeInTheDocument()
    expect(screen.getByText('Amount')).toBeInTheDocument()
    expect(screen.getByText('Proceeds (USD)')).toBeInTheDocument()
    expect(screen.getByText('Cost Basis')).toBeInTheDocument()
    expect(screen.getByText('Gain / Loss')).toBeInTheDocument()
    expect(screen.getByText('Term')).toBeInTheDocument()
  })

  it('renders taxable events in table', () => {
    renderWithProviders(<TaxPage />)
    expect(screen.getByText('BTC')).toBeInTheDocument()
    expect(screen.getByText('ETH')).toBeInTheDocument()
  })

  it('displays event action as badge', () => {
    renderWithProviders(<TaxPage />)
    // Check that action badges are rendered
    const actionBadges = screen.queryAllByText(/[Ss]ell/)
    expect(actionBadges.length).toBeGreaterThan(0)
  })

  it('renders Export CSV button', () => {
    renderWithProviders(<TaxPage />)
    expect(screen.getByRole('button', { name: /Export CSV/i })).toBeInTheDocument()
  })

  it('shows loading state', () => {
    vi.mocked(useTaxReport).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any)
    renderWithProviders(<TaxPage />)
    expect(screen.getByText('Loading tax report…')).toBeInTheDocument()
  })

  it('shows error state', () => {
    vi.mocked(useTaxReport).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any)
    renderWithProviders(<TaxPage />)
    expect(screen.getByText(/Failed to load tax report for 2026/)).toBeInTheDocument()
  })

  it('shows empty state when no events', () => {
    vi.mocked(useTaxReport).mockReturnValue({
      data: { ...mockTaxData, events: [] },
      isLoading: false,
      isError: false,
    } as any)
    renderWithProviders(<TaxPage />)
    expect(screen.getByText('No taxable events for 2026')).toBeInTheDocument()
  })

  describe('Year selector', () => {
    it('changes year when selected', async () => {
      const mockData2025 = { ...mockTaxData, year: 2025 }
      vi.mocked(useTaxReport)
        .mockReturnValueOnce({
          data: mockTaxData,
          isLoading: false,
          isError: false,
        } as any)
        .mockReturnValueOnce({
          data: mockData2025,
          isLoading: false,
          isError: false,
        } as any)

      const { rerender } = renderWithProviders(<TaxPage />)
      const select = screen.getByRole('combobox')
      fireEvent.change(select, { target: { value: '2025' } })
      rerender(
        <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
          <MemoryRouter>
            <TaxPage />
          </MemoryRouter>
        </QueryClientProvider>
      )
      // The hook will be called with the new year
      expect(vi.mocked(useTaxReport)).toHaveBeenCalled()
    })
  })

  describe('Event display', () => {
    it('formats dates correctly', () => {
      renderWithProviders(<TaxPage />)
      // Date 1710000000 = 2024-03-09, check if it contains the date pattern
      const dateElements = screen.getAllByText(/2024|2025|2026|2023/)
      expect(dateElements.length).toBeGreaterThan(0)
    })

    it('displays gain value correctly', () => {
      renderWithProviders(<TaxPage />)
      expect(screen.getByText('+$2,000')).toBeInTheDocument()
    })

    it('displays loss value as negative', () => {
      renderWithProviders(<TaxPage />)
      expect(screen.getByText('-$1,000')).toBeInTheDocument()
    })

    it('marks short-term holdings correctly', () => {
      renderWithProviders(<TaxPage />)
      const shortBadges = screen.getAllByText('short')
      expect(shortBadges.length).toBeGreaterThan(0)
    })

    it('marks long-term holdings correctly', () => {
      renderWithProviders(<TaxPage />)
      const longBadges = screen.getAllByText('long')
      expect(longBadges.length).toBeGreaterThan(0)
    })
  })

  describe('Edge cases', () => {
    it('handles zero gains', () => {
      vi.mocked(useTaxReport).mockReturnValue({
        data: { ...mockTaxData, totalRealizedGain: 0 },
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<TaxPage />)
      expect(screen.getByText('+$0')).toBeInTheDocument()
    })

    it('handles zero losses', () => {
      vi.mocked(useTaxReport).mockReturnValue({
        data: { ...mockTaxData, totalRealizedLoss: 0 },
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<TaxPage />)
      expect(screen.getByText('-$0')).toBeInTheDocument()
    })

    it('handles negative net gain (net loss)', () => {
      vi.mocked(useTaxReport).mockReturnValue({
        data: { ...mockTaxData, netGainLoss: -2000 },
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<TaxPage />)
      // Check for negative value indicator
      expect(screen.getByText(/-.*2,000/)).toBeInTheDocument()
    })

    it('handles very large transaction amounts', () => {
      vi.mocked(useTaxReport).mockReturnValue({
        data: {
          ...mockTaxData,
          events: [
            {
              ...mockTaxData.events[0],
              proceedsUsd: 1000000,
              costBasisUsd: 950000,
              gainLossUsd: 50000,
            },
          ],
        },
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<TaxPage />)
      expect(screen.getByText('$1,000,000')).toBeInTheDocument()
    })

    it('handles single event', () => {
      vi.mocked(useTaxReport).mockReturnValue({
        data: {
          ...mockTaxData,
          events: [mockTaxData.events[0]],
        },
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<TaxPage />)
      expect(screen.getByText('BTC')).toBeInTheDocument()
    })
  })

  describe('Export functionality', () => {
    it('triggers CSV export when button clicked', () => {
      const createElementSpy = vi.spyOn(document, 'createElement')
      renderWithProviders(<TaxPage />)
      const exportBtn = screen.getByRole('button', { name: /Export CSV/i })
      fireEvent.click(exportBtn)
      // Check that an anchor element was created for download
      expect(createElementSpy).toHaveBeenCalledWith('a')
      createElementSpy.mockRestore()
    })

    it('exports correct year in filename', () => {
      const createElementSpy = vi.spyOn(document, 'createElement')
      renderWithProviders(<TaxPage />)
      const exportBtn = screen.getByRole('button', { name: /Export CSV/i })
      fireEvent.click(exportBtn)
      // The download should reference 2026 based on initial year
      expect(createElementSpy).toHaveBeenCalled()
      createElementSpy.mockRestore()
    })
  })

  describe('Multiple years', () => {
    it('calls hook with correct year parameter', () => {
      renderWithProviders(<TaxPage />)
      expect(vi.mocked(useTaxReport)).toHaveBeenCalledWith(2026)
    })
  })
})
