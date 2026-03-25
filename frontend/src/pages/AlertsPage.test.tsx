import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import AlertsPage from './AlertsPage'

vi.mock('@/hooks/use-alert-queries', () => ({
  useAlerts: vi.fn(),
}))

import { useAlerts } from '@/hooks/use-alert-queries'

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  )
}

// Stable mock data references to avoid useEffect infinite loops
const EMPTY: never[] = []
const CRITICAL_ALERT = [
  { id: 'a1', severity: 'critical' as const, title: 'OKX Down', message: 'Exchange disconnected', time: '2026-03-21 10:30:45', dismissed: false },
]
const WARNING_ALERT = [
  { id: 'a2', severity: 'warning' as const, title: 'High Drift', message: 'Asset drifted 5%', time: '2026-03-21 11:15:30', dismissed: false },
]
const MIXED_ALERTS = [
  { id: 'a1', severity: 'critical' as const, title: 'Critical Alert', message: 'Critical issue', time: '2026-03-21 10:30:45', dismissed: false },
  { id: 'a2', severity: 'warning' as const, title: 'Warning Alert', message: 'Warning issue', time: '2026-03-21 11:00:00', dismissed: false },
  { id: 'a3', severity: 'info' as const, title: 'Info Alert', message: 'Information', time: '2026-03-21 12:00:00', dismissed: false },
]

function mockAlerts(data: unknown[], loading = false, error = false) {
  vi.mocked(useAlerts).mockReturnValue({
    data, isLoading: loading, isError: error, status: loading ? 'pending' : error ? 'error' : 'success',
  } as any)
}

describe('AlertsPage', () => {
  beforeEach(() => vi.clearAllMocks())

  it('renders page title', () => {
    mockAlerts(EMPTY)
    wrap(<AlertsPage />)
    expect(screen.getByText('Alerts')).toBeInTheDocument()
  })

  it('shows loading spinner', () => {
    mockAlerts(EMPTY, true)
    wrap(<AlertsPage />)
    expect(screen.getByText(/Checking for alerts/i)).toBeInTheDocument()
  })

  it('shows error message', () => {
    mockAlerts(EMPTY, false, true)
    wrap(<AlertsPage />)
    expect(screen.getByText(/Failed to load alerts/i)).toBeInTheDocument()
  })

  it('shows empty state when no alerts', () => {
    mockAlerts(EMPTY)
    wrap(<AlertsPage />)
    expect(screen.getByText(/No active alerts/i)).toBeInTheDocument()
  })

  it('renders critical alert', () => {
    mockAlerts(CRITICAL_ALERT)
    wrap(<AlertsPage />)
    expect(screen.getByText('OKX Down')).toBeInTheDocument()
    expect(screen.getByText('Exchange disconnected')).toBeInTheDocument()
  })

  it('renders warning alert', () => {
    mockAlerts(WARNING_ALERT)
    wrap(<AlertsPage />)
    expect(screen.getByText('High Drift')).toBeInTheDocument()
  })

  it('renders multiple alerts', () => {
    mockAlerts(MIXED_ALERTS)
    wrap(<AlertsPage />)
    expect(screen.getByText('Critical Alert')).toBeInTheDocument()
    expect(screen.getByText('Warning Alert')).toBeInTheDocument()
    expect(screen.getByText('Info Alert')).toBeInTheDocument()
  })

  it('shows alert timestamp', () => {
    mockAlerts(CRITICAL_ALERT)
    wrap(<AlertsPage />)
    expect(screen.getByText('2026-03-21 10:30:45')).toBeInTheDocument()
  })

  it('can dismiss an alert', () => {
    mockAlerts(CRITICAL_ALERT)
    wrap(<AlertsPage />)

    // Find dismiss button (the X button)
    const buttons = screen.getAllByRole('button')
    const dismissBtn = buttons.find(b => b.querySelector('svg'))
    expect(dismissBtn).toBeDefined()
    fireEvent.click(dismissBtn!)

    // After dismiss, should show "No active alerts" since only alert was dismissed
    expect(screen.getByText(/No active alerts/i)).toBeInTheDocument()
  })
})
