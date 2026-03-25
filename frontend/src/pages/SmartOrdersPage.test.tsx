import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import type { ReactNode } from 'react'
import SmartOrdersPage from './SmartOrdersPage'

// Mock smart order hooks
vi.mock('@/hooks/use-smart-order-queries', () => ({
  useActiveSmartOrders: vi.fn(),
  useCreateSmartOrder: vi.fn(),
  usePauseSmartOrder: vi.fn(),
  useResumeSmartOrder: vi.fn(),
  useCancelSmartOrder: vi.fn(),
}))

import {
  useActiveSmartOrders,
  useCreateSmartOrder,
  usePauseSmartOrder,
  useResumeSmartOrder,
  useCancelSmartOrder,
} from '@/hooks/use-smart-order-queries'

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

describe('SmartOrdersPage', () => {
  const mockSmartOrder = {
    id: 'so1',
    type: 'twap',
    exchange: 'binance',
    pair: 'BTC/USDT',
    side: 'buy',
    totalAmount: 0.5,
    durationMs: 14400000,
    status: 'active' as const,
    filledAmount: 0.2,
    filledPct: 40,
    avgPrice: 67000,
    slicesCompleted: 3,
    slicesTotal: 8,
    estimatedCompletion: null,
    rebalanceId: null,
    createdAt: 1710000000,
  }

  const mockSmartOrder2 = {
    ...mockSmartOrder,
    id: 'so2',
    type: 'vwap',
    pair: 'ETH/USDT',
    side: 'sell' as const,
    status: 'paused' as const,
    totalAmount: 2.5,
    filledAmount: 1.0,
    filledPct: 40,
    slicesCompleted: 2,
    slicesTotal: 5,
  }

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useActiveSmartOrders).mockReturnValue({
      data: [mockSmartOrder, mockSmartOrder2],
      isLoading: false,
      isError: false,
    } as any)
    vi.mocked(useCreateSmartOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)
    vi.mocked(usePauseSmartOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)
    vi.mocked(useResumeSmartOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)
    vi.mocked(useCancelSmartOrder).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
      isError: false,
      error: null,
    } as any)
  })

  it('renders page title', () => {
    renderWithProviders(<SmartOrdersPage />)
    expect(screen.getByText('Smart Orders')).toBeInTheDocument()
  })

  it('renders create form section', () => {
    renderWithProviders(<SmartOrdersPage />)
    const titles = screen.getAllByText('Create Smart Order')
    expect(titles.length).toBeGreaterThan(0)
  })

  it('renders form fields', () => {
    renderWithProviders(<SmartOrdersPage />)
    expect(screen.getByText(/Order Type/i)).toBeInTheDocument()
    expect(screen.getByText(/Pair/i)).toBeInTheDocument()
    expect(screen.getByText(/Side/i)).toBeInTheDocument()
    expect(screen.getByText(/Total Amount/i)).toBeInTheDocument()
    expect(screen.getByText(/Duration/i)).toBeInTheDocument()
  })

  it('renders order type radio buttons', () => {
    renderWithProviders(<SmartOrdersPage />)
    expect(screen.getByRole('radio', { name: 'TWAP' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'VWAP' })).toBeInTheDocument()
  })

  it('renders side radio buttons', () => {
    renderWithProviders(<SmartOrdersPage />)
    expect(screen.getByRole('radio', { name: 'BUY' })).toBeInTheDocument()
    expect(screen.getByRole('radio', { name: 'SELL' })).toBeInTheDocument()
  })

  it('renders Create Smart Order button', () => {
    renderWithProviders(<SmartOrdersPage />)
    expect(screen.getByRole('button', { name: /Create Smart Order/i })).toBeInTheDocument()
  })

  it('renders Active Orders section', () => {
    renderWithProviders(<SmartOrdersPage />)
    expect(screen.getByText('Active Orders')).toBeInTheDocument()
  })

  it('renders order cards with correct pair names', () => {
    renderWithProviders(<SmartOrdersPage />)
    const btcPairs = screen.getAllByText('BTC/USDT')
    const ethPairs = screen.getAllByText('ETH/USDT')
    expect(btcPairs.length).toBeGreaterThan(0)
    expect(ethPairs.length).toBeGreaterThan(0)
  })

  it('displays order type badges', () => {
    renderWithProviders(<SmartOrdersPage />)
    const twapBadges = screen.getAllByText('TWAP')
    const vwapBadges = screen.getAllByText('VWAP')
    expect(twapBadges.length).toBeGreaterThan(0)
    expect(vwapBadges.length).toBeGreaterThan(0)
  })

  it('displays side badges with correct styling', () => {
    renderWithProviders(<SmartOrdersPage />)
    const buyBadges = screen.getAllByText('BUY')
    const sellBadges = screen.getAllByText('SELL')
    expect(buyBadges.length).toBeGreaterThan(0)
    expect(sellBadges.length).toBeGreaterThan(0)
  })

  it('displays progress information', () => {
    renderWithProviders(<SmartOrdersPage />)
    const sliceTexts = screen.queryAllByText(/slices filled/)
    expect(sliceTexts.length).toBeGreaterThan(0)
    const percentageTexts = screen.queryAllByText(/\d+%/)
    expect(percentageTexts.length).toBeGreaterThan(0)
  })

  it('displays filled amounts', () => {
    renderWithProviders(<SmartOrdersPage />)
    expect(screen.getByText('0.2 / 0.5')).toBeInTheDocument()
  })

  it('displays average price', () => {
    renderWithProviders(<SmartOrdersPage />)
    const priceTexts = screen.queryAllByText(/\$/)
    expect(priceTexts.length).toBeGreaterThan(0)
  })

  it('shows pause button for active orders', () => {
    renderWithProviders(<SmartOrdersPage />)
    const pauseButtons = screen.getAllByRole('button', { name: /Pause/i })
    expect(pauseButtons.length).toBeGreaterThan(0)
  })

  it('shows resume button for paused orders', () => {
    renderWithProviders(<SmartOrdersPage />)
    const resumeButtons = screen.getAllByRole('button', { name: /Resume/i })
    expect(resumeButtons.length).toBeGreaterThan(0)
  })

  it('shows cancel button for orders', () => {
    renderWithProviders(<SmartOrdersPage />)
    const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i })
    expect(cancelButtons.length).toBeGreaterThan(0)
  })

  it('shows loading state', () => {
    vi.mocked(useActiveSmartOrders).mockReturnValue({
      data: undefined,
      isLoading: true,
      isError: false,
    } as any)
    renderWithProviders(<SmartOrdersPage />)
    expect(screen.getByText('Loading orders…')).toBeInTheDocument()
  })

  it('shows error state', () => {
    vi.mocked(useActiveSmartOrders).mockReturnValue({
      data: undefined,
      isLoading: false,
      isError: true,
    } as any)
    renderWithProviders(<SmartOrdersPage />)
    expect(screen.getByText('Failed to load smart orders.')).toBeInTheDocument()
  })

  describe('Form submission', () => {
    it('submits form with correct data', () => {
      const mockMutate = vi.fn()
      vi.mocked(useCreateSmartOrder).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<SmartOrdersPage />)

      const submitButton = screen.getByRole('button', { name: /Create Smart Order/i })
      fireEvent.click(submitButton)

      expect(mockMutate).toHaveBeenCalled()
      const callArgs = mockMutate.mock.calls[0][0]
      expect(callArgs.exchange).toBe('binance')
      expect(callArgs.type).toBe('twap')
      expect(callArgs.pair).toBe('BTC/USDT')
      expect(callArgs.side).toBe('buy')
    })

    it('shows loading state during creation', () => {
      vi.mocked(useCreateSmartOrder).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<SmartOrdersPage />)
      expect(screen.getByRole('button', { name: /Creating/i })).toBeInTheDocument()
    })

    it('disables submit button during creation', () => {
      vi.mocked(useCreateSmartOrder).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<SmartOrdersPage />)
      const submitButton = screen.getByRole('button', { name: /Creating/i })
      expect(submitButton).toBeDisabled()
    })

    it('shows error message on creation failure', () => {
      vi.mocked(useCreateSmartOrder).mockReturnValue({
        mutate: vi.fn(),
        isPending: false,
        isError: true,
        error: new Error('Invalid order amount'),
      } as any)
      renderWithProviders(<SmartOrdersPage />)
      expect(screen.getByText('Invalid order amount')).toBeInTheDocument()
    })
  })

  describe('Pause/Resume functionality', () => {
    it('calls pause mutation when pause button clicked', () => {
      const mockMutate = vi.fn()
      vi.mocked(usePauseSmartOrder).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<SmartOrdersPage />)

      const pauseButtons = screen.getAllByRole('button', { name: /Pause/i })
      fireEvent.click(pauseButtons[0])

      expect(mockMutate).toHaveBeenCalledWith('so1')
    })

    it('calls resume mutation when resume button clicked', () => {
      const mockMutate = vi.fn()
      vi.mocked(useResumeSmartOrder).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<SmartOrdersPage />)

      const resumeButtons = screen.getAllByRole('button', { name: /Resume/i })
      fireEvent.click(resumeButtons[0])

      expect(mockMutate).toHaveBeenCalledWith('so2')
    })

    it('disables pause/resume buttons during action', () => {
      vi.mocked(usePauseSmartOrder).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<SmartOrdersPage />)
      const pauseButtons = screen.getAllByRole('button', { name: /Pause/i })
      expect(pauseButtons[0]).toBeDisabled()
    })
  })

  describe('Cancel functionality', () => {
    it('calls cancel mutation when cancel button clicked', () => {
      const mockMutate = vi.fn()
      vi.mocked(useCancelSmartOrder).mockReturnValue({
        mutate: mockMutate,
        isPending: false,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<SmartOrdersPage />)

      const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i })
      fireEvent.click(cancelButtons[0])

      expect(mockMutate).toHaveBeenCalledWith('so1')
    })

    it('disables cancel button during cancellation', () => {
      vi.mocked(useCancelSmartOrder).mockReturnValue({
        mutate: vi.fn(),
        isPending: true,
        isError: false,
        error: null,
      } as any)
      renderWithProviders(<SmartOrdersPage />)
      const cancelButtons = screen.getAllByRole('button', { name: /Cancel/i })
      expect(cancelButtons[0]).toBeDisabled()
    })
  })

  describe('Order display', () => {
    it('displays duration in human readable format', () => {
      renderWithProviders(<SmartOrdersPage />)
      expect(screen.getAllByText(/\d+h/).length).toBeGreaterThan(0)
    })

    it('shows order ID', () => {
      renderWithProviders(<SmartOrdersPage />)
      expect(screen.getByText(/so1/)).toBeInTheDocument()
    })

    it('calculates progress percentage correctly', () => {
      renderWithProviders(<SmartOrdersPage />)
      // Both orders have 40% filled
      const progressLabels = screen.getAllByText('40%')
      expect(progressLabels.length).toBeGreaterThan(0)
    })
  })

  describe('Edge cases', () => {
    it('handles empty order list', () => {
      vi.mocked(useActiveSmartOrders).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<SmartOrdersPage />)
      expect(screen.getByText('Smart Orders')).toBeInTheDocument()
    })

    it('handles order with zero filled amount', () => {
      const orderZeroFilled = { ...mockSmartOrder, filledAmount: 0, filledPct: 0, slicesCompleted: 0 }
      vi.mocked(useActiveSmartOrders).mockReturnValue({
        data: [orderZeroFilled],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<SmartOrdersPage />)
      expect(screen.getByText('0/8 slices filled')).toBeInTheDocument()
      expect(screen.getByText('0%')).toBeInTheDocument()
    })

    it('handles order with fully filled amount', () => {
      const orderFullyFilled = {
        ...mockSmartOrder,
        filledAmount: 0.5,
        filledPct: 100,
        slicesCompleted: 8,
      }
      vi.mocked(useActiveSmartOrders).mockReturnValue({
        data: [orderFullyFilled],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<SmartOrdersPage />)
      expect(screen.getByText('8/8 slices filled')).toBeInTheDocument()
      expect(screen.getAllByText('100%').length).toBeGreaterThan(0)
    })

    it('handles order with null average price', () => {
      const orderNullPrice = { ...mockSmartOrder, avgPrice: null }
      vi.mocked(useActiveSmartOrders).mockReturnValue({
        data: [orderNullPrice],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<SmartOrdersPage />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('handles order with zero average price', () => {
      const orderZeroPrice = { ...mockSmartOrder, avgPrice: 0 }
      vi.mocked(useActiveSmartOrders).mockReturnValue({
        data: [orderZeroPrice],
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<SmartOrdersPage />)
      expect(screen.getByText('—')).toBeInTheDocument()
    })

    it('handles multiple orders with different statuses', () => {
      const orders = [mockSmartOrder, mockSmartOrder2]
      vi.mocked(useActiveSmartOrders).mockReturnValue({
        data: orders,
        isLoading: false,
        isError: false,
      } as any)
      renderWithProviders(<SmartOrdersPage />)
      // Should have pause and resume buttons
      const pauseButtons = screen.getAllByRole('button', { name: /Pause/i })
      const resumeButtons = screen.getAllByRole('button', { name: /Resume/i })
      expect(pauseButtons.length).toBeGreaterThan(0)
      expect(resumeButtons.length).toBeGreaterThan(0)
    })
  })

  describe('Form field changes', () => {
    it('allows changing order type', () => {
      renderWithProviders(<SmartOrdersPage />)
      const vwapRadio = screen.getByRole('radio', { name: 'VWAP' })
      fireEvent.click(vwapRadio)
      expect((vwapRadio as HTMLInputElement).checked).toBe(true)
    })

    it('allows changing pair', () => {
      renderWithProviders(<SmartOrdersPage />)
      const selects = screen.getAllByRole('combobox')
      fireEvent.change(selects[0], { target: { value: 'ETH/USDT' } })
      expect((selects[0] as HTMLSelectElement).value).toBe('ETH/USDT')
    })

    it('allows changing side', () => {
      renderWithProviders(<SmartOrdersPage />)
      const sellRadio = screen.getByRole('radio', { name: 'SELL' })
      fireEvent.click(sellRadio)
      expect((sellRadio as HTMLInputElement).checked).toBe(true)
    })

    it('allows changing amount', () => {
      renderWithProviders(<SmartOrdersPage />)
      const inputs = screen.getAllByRole('spinbutton')
      fireEvent.change(inputs[0], { target: { value: '1.5' } })
      expect((inputs[0] as HTMLInputElement).value).toBe('1.5')
    })

    it('allows changing duration', () => {
      renderWithProviders(<SmartOrdersPage />)
      const selects = screen.getAllByRole('combobox')
      fireEvent.change(selects[1], { target: { value: '1h' } })
      expect((selects[1] as HTMLSelectElement).value).toBe('1h')
    })

    it('allows changing slices with slider', () => {
      renderWithProviders(<SmartOrdersPage />)
      const sliders = screen.getAllByRole('slider')
      fireEvent.change(sliders[0], { target: { value: '16' } })
      expect((sliders[0] as HTMLInputElement).value).toBe('16')
    })
  })
})
