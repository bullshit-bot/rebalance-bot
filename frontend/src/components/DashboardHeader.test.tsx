import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import { DashboardHeader } from './DashboardHeader'

vi.mock('@/contexts/AuthContext', () => ({
  useAuth: vi.fn(),
}))

vi.mock('@/hooks/use-portfolio-queries', () => ({
  usePortfolio: vi.fn(),
  usePortfolioHistory: vi.fn(),
}))

vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom')
  return { ...actual, useNavigate: vi.fn() }
})

import { useAuth } from '@/contexts/AuthContext'
import { usePortfolio } from '@/hooks/use-portfolio-queries'
import { useNavigate } from 'react-router-dom'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

describe('DashboardHeader', () => {
  const mockLogout = vi.fn()
  const mockNavigate = vi.fn()

  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(useAuth).mockReturnValue({ logout: mockLogout, login: vi.fn(), isAuthenticated: true } as any)
    vi.mocked(useNavigate).mockReturnValue(mockNavigate)
    vi.mocked(usePortfolio).mockReturnValue({ data: undefined, isLoading: true, isError: false } as any)
  })

  it('renders title', () => {
    wrap(<DashboardHeader />)
    expect(screen.getByText('Rebalance Bot')).toBeInTheDocument()
  })

  it('renders Personal Mode badge', () => {
    wrap(<DashboardHeader />)
    expect(screen.getByText('Personal Mode')).toBeInTheDocument()
  })

  it('renders exchange badges', () => {
    wrap(<DashboardHeader />)
    expect(screen.getByText(/Binance/)).toBeInTheDocument()
    expect(screen.getByText(/OKX/)).toBeInTheDocument()
  })

  it('shows dash when portfolio not loaded', () => {
    wrap(<DashboardHeader />)
    // Portfolio value shows "—" when data is undefined
    const portfolioSection = screen.getByText('Portfolio')
    expect(portfolioSection).toBeInTheDocument()
  })

  it('shows portfolio value when loaded', () => {
    vi.mocked(usePortfolio).mockReturnValue({
      data: { totalValueUsd: 147832, assets: [], updatedAt: Date.now() },
      isLoading: false, isError: false,
    } as any)
    wrap(<DashboardHeader />)
    expect(screen.getByText('$147,832')).toBeInTheDocument()
  })

  it('renders Dry Run button', () => {
    wrap(<DashboardHeader />)
    expect(screen.getByText('Dry Run')).toBeInTheDocument()
  })

  it('renders Pause button', () => {
    wrap(<DashboardHeader />)
    expect(screen.getByText('Pause')).toBeInTheDocument()
  })

  it('renders Logout button', () => {
    wrap(<DashboardHeader />)
    expect(screen.getByText('Logout')).toBeInTheDocument()
  })

  it('calls logout and navigates on logout click', () => {
    wrap(<DashboardHeader />)
    fireEvent.click(screen.getByText('Logout'))
    expect(mockLogout).toHaveBeenCalled()
    expect(mockNavigate).toHaveBeenCalledWith('/login', { replace: true })
  })
})
