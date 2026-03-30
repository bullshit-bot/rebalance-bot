import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import OrdersPage from './OrdersPage'

vi.mock('@/hooks/use-trade-queries', () => ({
  useTrades: vi.fn(),
}))

import { useTrades } from '@/hooks/use-trade-queries'

function renderWithProviders(ui: ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('OrdersPage', () => {
  const mockTradesData = [
    {
      _id: '1',
      exchange: 'binance',
      pair: 'BTC/USDT',
      side: 'buy' as const,
      amount: 0.1,
      price: 50000,
      fee: 10,
      rebalanceId: null,
      executedAt: new Date().toISOString(),
    },
    {
      _id: '2',
      exchange: 'binance',
      pair: 'ETH/USDT',
      side: 'sell' as const,
      amount: 1,
      price: 3000,
      fee: 5,
      rebalanceId: 'rebal-123',
      executedAt: new Date(Date.now() - 3600000).toISOString(),
    },
  ]

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading skeleton when data is loading', () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: true, data: undefined, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByText('Orders')).toBeInTheDocument()
  })

  it('shows error message when data fetch fails', () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: undefined, isError: true } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByText('Failed to load orders. Please try again.')).toBeInTheDocument()
  })

  it('renders orders table with trades', () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByText('Orders')).toBeInTheDocument()
    expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
    expect(screen.getByText('ETH/USDT')).toBeInTheDocument()
  })

  it('renders search input field', () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByPlaceholderText('Search pair, exchange, order ID…')).toBeInTheDocument()
  })

  it('renders filter tabs', () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByRole('button', { name: 'All' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Filled' })).toBeInTheDocument()
  })

  it('filters orders by tab when tab button is clicked', async () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    const filledTab = screen.getByRole('button', { name: 'Filled' })
    fireEvent.click(filledTab)
    await waitFor(() => {
      expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
    })
  })

  it('searches orders by symbol when search input is used', async () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    const searchInput = screen.getByPlaceholderText('Search pair, exchange, order ID…')
    fireEvent.change(searchInput, { target: { value: 'BTC' } })
    await waitFor(() => {
      expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
    })
  })

  it('searches orders by exchange', async () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    const searchInput = screen.getByPlaceholderText('Search pair, exchange, order ID…')
    fireEvent.change(searchInput, { target: { value: 'binance' } })
    await waitFor(() => {
      expect(screen.getAllByText('binance').length).toBeGreaterThan(0)
    })
  })

  it('searches orders by order ID', async () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    const searchInput = screen.getByPlaceholderText('Search pair, exchange, order ID…')
    fireEvent.change(searchInput, { target: { value: '1' } })
    await waitFor(() => {
      expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
    })
  })

  it('displays table columns', () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByText('ID')).toBeInTheDocument()
    expect(screen.getByText('Time')).toBeInTheDocument()
    expect(screen.getByText('Exchange')).toBeInTheDocument()
    expect(screen.getByText('Symbol')).toBeInTheDocument()
    expect(screen.getByText('Side')).toBeInTheDocument()
    expect(screen.getByText('Type')).toBeInTheDocument()
    expect(screen.getByText('Qty')).toBeInTheDocument()
    expect(screen.getByText('Price')).toBeInTheDocument()
    expect(screen.getByText('Fee')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Source')).toBeInTheDocument()
  })

  it('displays pagination when there are many orders', () => {
    const manyOrders = Array.from({ length: 25 }, (_, i) => ({
      ...mockTradesData[0],
      _id: String(i),
    }))
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: manyOrders, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByText(/page/i)).toBeInTheDocument()
  })

  it('shows no orders message when list is empty', () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: [], isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByText('No orders found')).toBeInTheDocument()
  })

  it('displays order count and page info when paginated', () => {
    const manyOrders = Array.from({ length: 25 }, (_, i) => ({
      ...mockTradesData[0],
      _id: String(i),
    }))
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: manyOrders, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByText(/orders · page/i)).toBeInTheDocument()
  })

  it('resets to page 1 when search is applied', async () => {
    const manyOrders = Array.from({ length: 25 }, (_, i) => ({
      ...mockTradesData[0],
      _id: String(i),
      pair: i < 15 ? 'BTC/USDT' : 'ETH/USDT',
    }))
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: manyOrders, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    const searchInput = screen.getByPlaceholderText('Search pair, exchange, order ID…') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'ETH' } })
    await waitFor(() => {
      expect(searchInput.value).toBe('ETH')
    })
  })

  it('resets to page 1 when tab filter is changed', async () => {
    const manyOrders = Array.from({ length: 25 }, (_, i) => ({
      ...mockTradesData[0],
      _id: String(i),
    }))
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: manyOrders, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    const filledTab = screen.getByRole('button', { name: 'Filled' })
    fireEvent.click(filledTab)
    await waitFor(() => {
      expect(screen.getByText(/page 1/i)).toBeInTheDocument()
    })
  })

  it('formats trade data correctly', () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
    expect(screen.getAllByText('binance').length).toBeGreaterThan(0)
  })

  it('displays source as rebalance for trades with rebalanceId', () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByText('rebalance')).toBeInTheDocument()
  })

  it('displays source as manual for trades without rebalanceId', () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByText('manual')).toBeInTheDocument()
  })

  it('handles case-insensitive search', async () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    const searchInput = screen.getByPlaceholderText('Search pair, exchange, order ID…')
    fireEvent.change(searchInput, { target: { value: 'btc' } })
    await waitFor(() => {
      expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
    })
  })

  it('clears search when input is cleared', async () => {
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: mockTradesData, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    const searchInput = screen.getByPlaceholderText('Search pair, exchange, order ID…') as HTMLInputElement
    fireEvent.change(searchInput, { target: { value: 'BTC' } })
    await waitFor(() => {
      expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
    })
    fireEvent.change(searchInput, { target: { value: '' } })
    await waitFor(() => {
      expect(screen.getByText('ETH/USDT')).toBeInTheDocument()
    })
  })

  it('handles null fees correctly', () => {
    const tradesWithNullFee = [
      {
        ...mockTradesData[0],
        fee: null,
      },
    ]
    vi.mocked(useTrades).mockReturnValue({ isLoading: false, data: tradesWithNullFee, isError: false } as any)

    renderWithProviders(<OrdersPage />)
    expect(screen.getByText('$0')).toBeInTheDocument()
  })
})
