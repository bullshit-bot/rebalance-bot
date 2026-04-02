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
    // 4 pair checkboxes + 3 feature checkboxes (DCA, Trend Filter, Simple Earn)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]')
    expect(checkboxes.length).toBe(7)
  })

  it('all 4 pairs are checked by default', () => {
    const { container } = wrap(<BacktestingPage />)
    const checkboxes = container.querySelectorAll('input[type="checkbox"]') as NodeListOf<HTMLInputElement>
    // First 4 checkboxes are pair checkboxes: BTC, ETH, SOL, BNB — all checked by default
    expect(checkboxes[0].checked).toBe(true) // BTC
    expect(checkboxes[1].checked).toBe(true) // ETH
    expect(checkboxes[2].checked).toBe(true) // SOL
    expect(checkboxes[3].checked).toBe(true) // BNB
  })

  it('renders date inputs', () => {
    wrap(<BacktestingPage />)
    expect(screen.getByDisplayValue('2021-03-30')).toBeInTheDocument()
    expect(screen.getByDisplayValue('2026-03-29')).toBeInTheDocument()
  })

  it('renders threshold slider', () => {
    wrap(<BacktestingPage />)
    expect(screen.getByText(/Rebalance Threshold/)).toBeInTheDocument()
  })

  it('renders balance and fee inputs', () => {
    wrap(<BacktestingPage />)
    expect(screen.getByDisplayValue('1000')).toBeInTheDocument()
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
    // Uncheck all 4 pair checkboxes (indices 0–3)
    fireEvent.click(checkboxes[0])
    fireEvent.click(checkboxes[1])
    fireEvent.click(checkboxes[2])
    fireEvent.click(checkboxes[3])
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
      data: {
        metrics: {
          totalReturnPct: 25.5,
          annualizedReturnPct: 40.2,
          sharpeRatio: 1.8,
          maxDrawdownPct: -15.3,
          totalTrades: 42,
          totalFeesPaid: 250.5,
        },
        trades: [],
      },
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
      data: {
        metrics: {},
        trades: [{ date: '2026-02-01', pair: 'BTC/USDT', side: 'buy', qty: 0.5, price: 45000, fee: 22.5, pnl: 1500 }],
      },
      isPending: false, isError: false, status: 'success', error: null,
    } as any)
    wrap(<BacktestingPage />)
    expect(screen.getByText(/Simulated Trades/)).toBeInTheDocument()
    expect(screen.getByText('2026-02-01')).toBeInTheDocument()
  })

  it('shows no trades message when empty', () => {
    vi.mocked(useRunBacktest).mockReturnValue({
      mutate: vi.fn(),
      data: { metrics: { totalReturnPct: 5.0 }, trades: [] },
      isPending: false, isError: false, status: 'success', error: null,
    } as any)
    wrap(<BacktestingPage />)
    expect(screen.getByText(/No trades in result/i)).toBeInTheDocument()
  })

  it('renders equity curve when available', () => {
    vi.mocked(useRunBacktest).mockReturnValue({
      mutate: vi.fn(),
      data: {
        metrics: {},
        trades: [],
        equityCurve: [{ timestamp: 1738368000000, value: 100000 }],
      },
      isPending: false, isError: false, status: 'success', error: null,
    } as any)
    wrap(<BacktestingPage />)
    expect(screen.getByText('Equity Curve')).toBeInTheDocument()
  })
})
