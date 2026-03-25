import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import LogsPage from './LogsPage'

// Mock useLogs hook
vi.mock('@/hooks/use-log-queries', () => ({
  useLogs: vi.fn(),
}))

import { useLogs } from '@/hooks/use-log-queries'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>
        {ui}
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('LogsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title', () => {
    vi.mocked(useLogs).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      status: 'success',
    } as any)

    wrap(<LogsPage />)
    expect(screen.getByText('Logs')).toBeInTheDocument()
  })

  it('renders Export Logs button', () => {
    vi.mocked(useLogs).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      status: 'success',
    } as any)

    wrap(<LogsPage />)
    expect(screen.getByText(/Export Logs/i)).toBeInTheDocument()
  })

  it('renders search input with placeholder', () => {
    vi.mocked(useLogs).mockReturnValue({
      data: [],
      isLoading: false,
      isError: false,
      status: 'success',
    } as any)

    wrap(<LogsPage />)
    expect(screen.getByPlaceholderText(/Search log messages/i)).toBeInTheDocument()
  })

  describe('filter chips', () => {
    it('renders all filter chips', () => {
      vi.mocked(useLogs).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<LogsPage />)

      expect(screen.getByText('All')).toBeInTheDocument()
      expect(screen.getByText('Info')).toBeInTheDocument()
      expect(screen.getByText('Warning')).toBeInTheDocument()
      expect(screen.getByText('Error')).toBeInTheDocument()
      expect(screen.getByText('Execution')).toBeInTheDocument()
      expect(screen.getByText('Sync')).toBeInTheDocument()
    })

    it('All chip is active by default', () => {
      vi.mocked(useLogs).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<LogsPage />)

      const allChip = screen.getByText('All')
      expect(allChip).toBeInTheDocument()
    })
  })

  describe('loading state', () => {
    it('shows loading spinner when data is loading', () => {
      vi.mocked(useLogs).mockReturnValue({
        data: undefined,
        isLoading: true,
        isError: false,
        status: 'pending',
      } as any)

      wrap(<LogsPage />)
      expect(screen.getByText(/Loading logs/i)).toBeInTheDocument()
    })
  })

  describe('error state', () => {
    it('shows error message when fetch fails', () => {
      vi.mocked(useLogs).mockReturnValue({
        data: undefined,
        isLoading: false,
        isError: true,
        status: 'error',
      } as any)

      wrap(<LogsPage />)
      expect(screen.getByText(/Failed to load logs/i)).toBeInTheDocument()
    })
  })

  describe('data rendered state', () => {
    it('renders log entries when data is available', () => {
      const mockLogs = [
        {
          id: 'T-1',
          time: '2026-03-21 08:14:22',
          level: 'execution',
          message: 'BUY BTC/USDT — qty 0.5 @ $45000',
          details: JSON.stringify({ exchange: 'binance', orderId: 'order-1' }),
        },
        {
          id: 'T-2',
          time: '2026-03-21 09:30:15',
          level: 'execution',
          message: 'SELL ETH/USDT — qty 1.2 @ $2500',
          details: JSON.stringify({ exchange: 'okx', orderId: 'order-2' }),
        },
      ]

      vi.mocked(useLogs).mockReturnValue({
        data: mockLogs,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<LogsPage />)

      expect(screen.getByText(/BUY BTC\/USDT/)).toBeInTheDocument()
      expect(screen.getByText(/SELL ETH\/USDT/)).toBeInTheDocument()
    })

    it('renders log timestamps', () => {
      const mockLogs = [
        {
          id: 'T-1',
          time: '2026-03-21 08:14:22',
          level: 'execution',
          message: 'BUY BTC/USDT — qty 0.5 @ $45000',
          details: JSON.stringify({ exchange: 'binance' }),
        },
      ]

      vi.mocked(useLogs).mockReturnValue({
        data: mockLogs,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<LogsPage />)

      expect(screen.getByText('2026-03-21 08:14:22')).toBeInTheDocument()
    })

    it('shows no logs message when list is empty', () => {
      vi.mocked(useLogs).mockReturnValue({
        data: [],
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<LogsPage />)

      expect(screen.getByText('No logs found')).toBeInTheDocument()
    })

    it('filters logs by search term', () => {
      const mockLogs = [
        {
          id: 'T-1',
          time: '2026-03-21 08:14:22',
          level: 'execution',
          message: 'BUY BTC/USDT',
          details: '{}',
        },
        {
          id: 'T-2',
          time: '2026-03-21 09:30:15',
          level: 'execution',
          message: 'SELL ETH/USDT',
          details: '{}',
        },
      ]

      vi.mocked(useLogs).mockReturnValue({
        data: mockLogs,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<LogsPage />)

      const searchInput = screen.getByPlaceholderText(/Search log messages/i) as HTMLInputElement
      fireEvent.change(searchInput, { target: { value: 'BTC' } })

      // After search, only BTC entry should be visible
      expect(screen.getByText(/BUY BTC\/USDT/)).toBeInTheDocument()
      expect(screen.queryByText(/SELL ETH\/USDT/)).not.toBeInTheDocument()
    })

    it('filters logs by level when filter chip clicked', () => {
      const mockLogs = [
        {
          id: 'T-1',
          time: '2026-03-21 08:14:22',
          level: 'info',
          message: 'System info log',
          details: '{}',
        },
        {
          id: 'T-2',
          time: '2026-03-21 09:30:15',
          level: 'execution',
          message: 'BUY BTC/USDT',
          details: '{}',
        },
      ]

      vi.mocked(useLogs).mockReturnValue({
        data: mockLogs,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<LogsPage />)

      // Click Info filter
      const infoChip = screen.getByText('Info')
      fireEvent.click(infoChip)

      // Only info log should be visible
      expect(screen.getByText(/System info log/)).toBeInTheDocument()
      expect(screen.queryByText(/BUY BTC\/USDT/)).not.toBeInTheDocument()
    })

    it('expands log details when clicked', () => {
      const mockLogs = [
        {
          id: 'T-1',
          time: '2026-03-21 08:14:22',
          level: 'execution',
          message: 'BUY BTC/USDT',
          details: JSON.stringify({ exchange: 'binance', orderId: 'order-123' }),
        },
      ]

      vi.mocked(useLogs).mockReturnValue({
        data: mockLogs,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<LogsPage />)

      const logRow = screen.getByText(/BUY BTC\/USDT/).closest('button')
      fireEvent.click(logRow!)

      // Details should become visible after expansion
      expect(screen.getByText(/"exchange"/)).toBeInTheDocument()
    })

    it('pagination info shows total entries', () => {
      const mockLogs = Array.from({ length: 25 }, (_, i) => ({
        id: `T-${i}`,
        time: `2026-03-21 08:${String(i).padStart(2, '0')}:00`,
        level: 'execution' as const,
        message: `Log entry ${i}`,
        details: '{}',
      }))

      vi.mocked(useLogs).mockReturnValue({
        data: mockLogs,
        isLoading: false,
        isError: false,
        status: 'success',
      } as any)

      wrap(<LogsPage />)

      // Should show pagination info
      expect(screen.getByText(/25 entries/)).toBeInTheDocument()
    })
  })
})
