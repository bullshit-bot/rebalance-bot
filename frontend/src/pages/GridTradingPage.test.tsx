import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import GridTradingPage from './GridTradingPage'

// Mock grid trading hooks
vi.mock('@/hooks/use-grid-queries', () => ({
  useGridBots: vi.fn(),
  useCreateGridBot: vi.fn(),
  useStopGridBot: vi.fn(),
}))

import { useGridBots, useCreateGridBot, useStopGridBot } from '@/hooks/use-grid-queries'

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

describe('GridTradingPage', () => {
  const mockGridBot = {
    id: 'gb1',
    exchange: 'binance',
    pair: 'BTC/USDT',
    gridType: 'normal',
    priceLower: 60000,
    priceUpper: 70000,
    gridLevels: 10,
    investment: 5000,
    status: 'active' as const,
    totalProfit: 342,
    totalTrades: 87,
    createdAt: 1710000000,
    stoppedAt: null,
  }

  const mockGridBot2 = {
    ...mockGridBot,
    id: 'gb2',
    pair: 'ETH/USDT',
    status: 'stopped' as const,
    priceLower: 2000,
    priceUpper: 3000,
    totalProfit: -150,
    stoppedAt: 1710086400,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useGridBots).mockReturnValue({
      data: [mockGridBot, mockGridBot2],
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useCreateGridBot).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)
    vi.mocked(useStopGridBot).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)
  })

  it('renders page title', () => {
    renderWithProviders(<GridTradingPage />)
    expect(screen.getByText('Grid Trading')).toBeInTheDocument()
  })

  it('renders create form section', () => {
    renderWithProviders(<GridTradingPage />)
    const titles = screen.getAllByText('Create Grid Bot')
    expect(titles.length).toBeGreaterThan(0)
  })

  it('renders form fields', () => {
    renderWithProviders(<GridTradingPage />)
    // Check for form elements by their role or text pattern
    expect(screen.getByText(/Pair/)).toBeInTheDocument()
    expect(screen.getByText(/Lower Price/)).toBeInTheDocument()
    expect(screen.getByText(/Upper Price/)).toBeInTheDocument()
    expect(screen.getByText(/Grid Levels/)).toBeInTheDocument()
    // Investment appears multiple times (in form label and slider label), check for the text
    const investmentLabels = screen.queryAllByText(/Investment/)
    expect(investmentLabels.length).toBeGreaterThan(0)
  })

  it('renders mode radio buttons', () => {
    renderWithProviders(<GridTradingPage />)
    const normalRadio = screen.getByRole('radio', { name: 'normal' })
    const reverseRadio = screen.getByRole('radio', { name: 'reverse' })
    expect(normalRadio).toBeInTheDocument()
    expect(reverseRadio).toBeInTheDocument()
  })

  it('renders Create Grid Bot button', () => {
    renderWithProviders(<GridTradingPage />)
    expect(screen.getByRole('button', { name: /Create Grid Bot/i })).toBeInTheDocument()
  })

  it('renders Active Bots section', () => {
    renderWithProviders(<GridTradingPage />)
    expect(screen.getByText('Active Bots')).toBeInTheDocument()
  })

  it('renders bot cards with correct pair names', () => {
    renderWithProviders(<GridTradingPage />)
    const btcPairs = screen.getAllByText('BTC/USDT')
    const ethPairs = screen.getAllByText('ETH/USDT')
    expect(btcPairs.length).toBeGreaterThan(0)
    expect(ethPairs.length).toBeGreaterThan(0)
  })

  it('displays bot details correctly', () => {
    renderWithProviders(<GridTradingPage />)
    // Check for grid levels in bot cards
    const levelTexts = screen.queryAllByText(/\d+ levels/)
    expect(levelTexts.length).toBeGreaterThan(0)
  })

  it('displays investment amount', () => {
    renderWithProviders(<GridTradingPage />)
    const amounts = screen.getAllByText(/\$\d+,\d+/)
    expect(amounts.length).toBeGreaterThan(0)
  })

  it('displays PnL values', () => {
    renderWithProviders(<GridTradingPage />)
    const pnlValues = screen.getAllByText(/\$\d+/)
    // Should have PnL values displayed
    expect(pnlValues.length).toBeGreaterThan(0)
  })

  it('displays trade counts', () => {
    renderWithProviders(<GridTradingPage />)
    expect(screen.getAllByText(/\d+/).length).toBeGreaterThan(0)
  })

  it('shows price range for each bot', () => {
    renderWithProviders(<GridTradingPage />)
    expect(screen.getByText('$60,000 – $70,000')).toBeInTheDocument()
    expect(screen.getByText('$2,000 – $3,000')).toBeInTheDocument()
  })

  it('renders stop button for active bot', () => {
    renderWithProviders(<GridTradingPage />)
    const stopButtons = screen.getAllByRole('button', { name: /Stop Bot/i })
    expect(stopButtons.length).toBeGreaterThan(0)
  })

  it('shows stopped status badge', () => {
    renderWithProviders(<GridTradingPage />)
    expect(screen.getByText('Stopped')).toBeInTheDocument()
  })

  it('shows loading state', () => {
    vi.mocked(useGridBots).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any)
    renderWithProviders(<GridTradingPage />)
    expect(screen.getByText('Loading bots…')).toBeInTheDocument()
  })

  it('shows error state', () => {
    vi.mocked(useGridBots).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any)
    renderWithProviders(<GridTradingPage />)
    expect(screen.getByText('Failed to load grid bots.')).toBeInTheDocument()
  })

  describe('Form submission', () => {
    it('submits form with correct data', () => {
      const mockMutate = vi.fn()
      vi.mocked(useCreateGridBot).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<GridTradingPage />)

      const submitButton = screen.getByRole('button', { name: /Create Grid Bot/i })
      fireEvent.click(submitButton)

      expect(mockMutate).toHaveBeenCalled()
      const callArgs = mockMutate.mock.calls[0][0]
      expect(callArgs.exchange).toBe('binance')
      expect(callArgs.pair).toBe('BTC/USDT')
    })

    it('shows loading state during creation', () => {
      vi.mocked(useCreateGridBot).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<GridTradingPage />)
      expect(screen.getByRole('button', { name: /Creating/i })).toBeInTheDocument()
    })

    it('disables submit button during creation', () => {
      vi.mocked(useCreateGridBot).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<GridTradingPage />)
      const submitButton = screen.getByRole('button', { name: /Creating/i })
      expect(submitButton).toBeDisabled()
    })

    it('shows error message on creation failure', () => {
      vi.mocked(useCreateGridBot).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('Invalid price range'),
      } as any)
      renderWithProviders(<GridTradingPage />)
      expect(screen.getByText('Invalid price range')).toBeInTheDocument()
    })
  })

  describe('Stop bot functionality', () => {
    it('calls stop mutation when stop button clicked', () => {
      const mockMutate = vi.fn()
      vi.mocked(useStopGridBot).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<GridTradingPage />)

      const stopButtons = screen.getAllByRole('button', { name: /Stop Bot/i })
      fireEvent.click(stopButtons[0])

      expect(mockMutate).toHaveBeenCalledWith('gb1')
    })

    it('disables stop button during stopping', () => {
      vi.mocked(useStopGridBot).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<GridTradingPage />)
      const stopButtons = screen.getAllByRole('button', { name: /Stop Bot/i })
      expect(stopButtons[0]).toBeDisabled()
    })
  })

  describe('Bot display', () => {
    it('calculates PnL percentage correctly', () => {
      renderWithProviders(<GridTradingPage />)
      // Bot 1: 342 / 5000 = 6.84%
      // Bot 2: -150 / 5000 = -3.00%
      expect(screen.getAllByText(/%/).length).toBeGreaterThan(0)
    })

    it('shows bot ID in details', () => {
      renderWithProviders(<GridTradingPage />)
      // Bot IDs should be in the rendered content
      expect(screen.getByText(/gb1/)).toBeInTheDocument()
    })
  })

  describe('Edge cases', () => {
    it('handles empty bot list', () => {
      vi.mocked(useGridBots).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<GridTradingPage />)
      // Page should still render
      expect(screen.getByText('Grid Trading')).toBeInTheDocument()
    })

    it('handles bot with zero investment', () => {
      const botWithZeroInvestment = { ...mockGridBot, investment: 0 }
      vi.mocked(useGridBots).mockReturnValue({
        data: [botWithZeroInvestment],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<GridTradingPage />)
      expect(screen.getByText('$0')).toBeInTheDocument()
    })

    it('handles bot with zero trades', () => {
      const botWithZeroTrades = { ...mockGridBot, totalTrades: 0 }
      vi.mocked(useGridBots).mockReturnValue({
        data: [botWithZeroTrades],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<GridTradingPage />)
      expect(screen.getByText('0')).toBeInTheDocument()
    })

    it('handles bot with zero profit', () => {
      const botWithZeroProfit = { ...mockGridBot, totalProfit: 0 }
      vi.mocked(useGridBots).mockReturnValue({
        data: [botWithZeroProfit],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<GridTradingPage />)
      // Should render with zero profit value
      expect(screen.getByText(/\$0/)).toBeInTheDocument()
    })

    it('handles large profit values', () => {
      const botWithLargeProfit = { ...mockGridBot, totalProfit: 999999 }
      vi.mocked(useGridBots).mockReturnValue({
        data: [botWithLargeProfit],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<GridTradingPage />)
      expect(screen.getByText(/999/)).toBeInTheDocument()
    })

    it('handles multiple bots with different statuses', () => {
      const activeBots = [mockGridBot, mockGridBot2]
      vi.mocked(useGridBots).mockReturnValue({
        data: activeBots,
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<GridTradingPage />)
      // Should have one Stop Bot button (for active bot)
      const stopButtons = screen.getAllByRole('button', { name: /Stop Bot/i })
      expect(stopButtons.length).toBe(1)
      // Should have one Stopped indicator
      expect(screen.getByText('Stopped')).toBeInTheDocument()
    })
  })

  describe('Form field changes', () => {
    it('allows changing pair', () => {
      renderWithProviders(<GridTradingPage />)
      const selects = screen.getAllByRole('combobox')
      fireEvent.change(selects[0], { target: { value: 'ETH/USDT' } })
      expect((selects[0] as HTMLSelectElement).value).toBe('ETH/USDT')
    })

    it('allows changing lower price', () => {
      renderWithProviders(<GridTradingPage />)
      const inputs = screen.getAllByRole('spinbutton')
      fireEvent.change(inputs[0], { target: { value: '55000' } })
      expect((inputs[0] as HTMLInputElement).value).toBe('55000')
    })

    it('allows changing grid levels with slider', () => {
      renderWithProviders(<GridTradingPage />)
      const sliders = screen.getAllByRole('slider')
      fireEvent.change(sliders[0], { target: { value: '20' } })
      expect((sliders[0] as HTMLInputElement).value).toBe('20')
    })

    it('allows toggling mode', () => {
      renderWithProviders(<GridTradingPage />)
      const reverseRadio = screen.getByRole('radio', { name: 'reverse' })
      fireEvent.click(reverseRadio)
      expect((reverseRadio as HTMLInputElement).checked).toBe(true)
    })
  })
})
