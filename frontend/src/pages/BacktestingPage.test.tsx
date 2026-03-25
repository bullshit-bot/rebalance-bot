import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import BacktestingPage from './BacktestingPage'

vi.mock('@/hooks/use-backtest-queries', () => ({
  useRunBacktest: vi.fn(),
  useBacktestList: vi.fn(),
  useBacktestResult: vi.fn(),
}))

import { useRunBacktest } from '@/hooks/use-backtest-queries'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('BacktestingPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useRunBacktest).mockReturnValue({
      mutate: vi.fn(),
      data: undefined,
      isPending: false,
      isError: false,
      status: 'idle',
      error: null,
    } as any)
  })

  it('renders page title', () => {
    wrap(<BacktestingPage />)
    expect(screen.getByText('Backtesting')).toBeInTheDocument()
  })

  it('renders Configuration section', () => {
    wrap(<BacktestingPage />)
    expect(screen.getByText('Configuration')).toBeInTheDocument()
  })

  it('renders pair labels', () => {
    wrap(<BacktestingPage />)
    expect(screen.getByText('BTC/USDT')).toBeInTheDocument()
    expect(screen.getByText('ETH/USDT')).toBeInTheDocument()
    expect(screen.getByText('SOL/USDT')).toBeInTheDocument()
    expect(screen.getByText('BNB/USDT')).toBeInTheDocument()
  })

  it('renders pair checkboxes', () => {
    const { container } = wrap(<BacktestingPage />)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes.length).toBe(4)
  })

  it('BTC and ETH are checked by default', () => {
    const { container } = wrap(<BacktestingPage />)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>
    expect(checkboxes[0].checked).toBe(true) // BTC
    expect(checkboxes[1].checked).toBe(true) // ETH
    expect(checkboxes[2].checked).toBe(false) // SOL
    expect(checkboxes[3].checked).toBe(false) // BNB
  })

  it('renders date inputs', () => {
    wrap(<BacktestingPage />)
    expect(screen.getByDisplayValue('2026-02-01')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-03-01')).toBeInTheDocument()
  })

  it('renders threshold slider', () => {
    wrap(<BacktestingPage />)
    expect(screen.getByText(/Rebalance Threshold/)).toBeInTheDocument()
  })

  it('renders balance and fee inputs', () => {
    wrap(<BacktestingPage />)
    expect(screen.getByDisplayValue('100000')).toBeInTheDocument()
    expect(screen.getByDisplayValue('0.1')).toBeInTheDocument()
  })

  it('renders run button', () => {
    wrap(<BacktestingPage />)
    const btn = screen.getByRole('button', { name: /Run Backtest/i })
    expect(btn).toBeInTheDocument()
    expect(btn).not.toBeDisabled()
  })

  it('disables run button when no pairs selected', () => {
    const { container } = wrap(<BacktestingPage />)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    // Uncheck BTC and ETH
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    const btn = screen.getByRole('button', { name: /Run Backtest/i })
    expect(btn).toBeDisabled()
  })

  it('shows placeholder when no results', () => {
    wrap(<BacktestingPage />)
    expect(screen.getByText(/Configure parameters above/i)).toBeInTheDocument()
  })

  it('shows loading state when pending', () => {
    vi.mocked(useRunBacktest).mockReturnValue({
      mutate: vi.fn(), data: undefined, isPending: true, isError: false, status: 'pending', error: null,
    } as any)
    wrap(<BacktestingPage />)
    expect(screen.getByText(/Running/i)).toBeInTheDocument()
  })

  it('shows error message on failure', () => {
    vi.mocked(useRunBacktest).mockReturnValue({
      mutate: vi.fn(), data: undefined, isPending: false, isError: true, status: 'error', error: new Error('fail'),
    } as any)
    wrap(<BacktestingPage />)
    expect(screen.getByText(/Backtest failed/)).toBeInTheDocument()
  })

  it('renders metrics when result available', () => {
    vi.mocked(useRunBacktest).mockReturnValue({
      mutate: vi.fn(),
      data: { metrics: { totalReturn: 25.5, annualized: 40.2, sharpe: 1.8, maxDrawdown: -15.3, trades: 42, fees: 250.5 }, trades: [] },
      isPending: false, isError: false, status: 'success', error: null,
    } as any)
    wrap(<BacktestingPage />)
    expect(screen.getByText('+25.5%')).toBeInTheDocument()
    expect(screen.getByText('Sharpe Ratio')).toBeInTheDocument()
    expect(screen.getByText('Total Trades')).toBeInTheDocument()
  })

  it('renders trade table with data', () => {
    vi.mocked(useRunBacktest).mockReturnValue({
      mutate: vi.fn(),
      data: { metrics: {}, trades: [{ date: '2026-02-01', pair: 'BTC/USDT', side: 'buy', qty: 0.5, price: 45000, fee: 22.5, pnl: 1500 }] },
      isPending: false, isError: false, status: 'success', error: null,
    } as any)
    wrap(<BacktestingPage />)
    expect(screen.getByText('Simulated Trades')).toBeInTheDocument()
    expect(screen.getByText('2026-02-01')).toBeInTheDocument()
  })

  it('shows no trades message when empty', () => {
    vi.mocked(useRunBacktest).mockReturnValue({
      mutate: vi.fn(),
      data: { metrics: { totalReturn: 5.0 }, trades: [] },
      isPending: false, isError: false, status: 'success', error: null,
    } as any)
    wrap(<BacktestingPage />)
    expect(screen.getByText(/No trades in result/i)).toBeInTheDocument()
  })

  it('renders equity curve when available', () => {
    vi.mocked(useRunBacktest).mockReturnValue({
      mutate: vi.fn(),
      data: { metrics: { equityCurve: [{ date: '2026-02-01', strategy: 100000 }] }, trades: [] },
      isPending: false, isError: false, status: 'success', error: null,
    } as any)
    wrap(<BacktestingPage />)
    expect(screen.getByText('Equity Curve')).toBeInTheDocument()
  })
})
