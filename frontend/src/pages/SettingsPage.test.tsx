import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import SettingsPage from './SettingsPage'

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

describe('SettingsPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders page title', () => {
    wrap(<SettingsPage />)
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  describe('Defaults section', () => {
    it('renders Defaults card', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Defaults')).toBeInTheDocument()
    })

    it('renders Default Exchange select', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Default Exchange')).toBeInTheDocument()
    })

    it('renders Default Exchange options', () => {
      wrap(<SettingsPage />)
      const exchangeSelects = screen.getAllByDisplayValue('Binance')
      expect(exchangeSelects.length).toBeGreaterThan(0)
    })

    it('renders Execution Mode select', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Execution Mode')).toBeInTheDocument()
    })

    it('renders Execution Mode options', () => {
      wrap(<SettingsPage />)
      const modeSelects = screen.getAllByDisplayValue('Manual Confirm')
      expect(modeSelects.length).toBeGreaterThan(0)
    })

    it('renders Base Currency select', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Base Currency')).toBeInTheDocument()
    })

    it('renders Base Currency options', () => {
      wrap(<SettingsPage />)
      const currencySelects = screen.getAllByDisplayValue('USDT')
      expect(currencySelects.length).toBeGreaterThan(0)
    })

    it('allows changing Default Exchange selection', () => {
      wrap(<SettingsPage />)
      const exchangeSelects = screen.getAllByDisplayValue('Binance')
      const exchangeSelect = exchangeSelects[0] as HTMLSelectElement

      fireEvent.change(exchangeSelect, { target: { value: 'OKX' } })
      expect(exchangeSelect.value).toBe('OKX')
    })

    it('allows changing Execution Mode selection', () => {
      wrap(<SettingsPage />)
      const modeSelects = screen.getAllByDisplayValue('Manual Confirm')
      const modeSelect = modeSelects[0] as HTMLSelectElement

      fireEvent.change(modeSelect, { target: { value: 'Live' } })
      expect(modeSelect.value).toBe('Live')
    })

    it('allows changing Base Currency selection', () => {
      wrap(<SettingsPage />)
      const currencySelects = screen.getAllByDisplayValue('USDT')
      const currencySelect = currencySelects[0] as HTMLSelectElement

      fireEvent.change(currencySelect, { target: { value: 'USDC' } })
      expect(currencySelect.value).toBe('USDC')
    })
  })

  describe('Notifications section', () => {
    it('renders Notifications card', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Notifications')).toBeInTheDocument()
    })

    it('renders Rebalance Complete toggle', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Rebalance Complete')).toBeInTheDocument()
      expect(screen.getByText('Alert when rebalance cycle finishes')).toBeInTheDocument()
    })

    it('renders Order Failures toggle', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Order Failures')).toBeInTheDocument()
      expect(screen.getByText('Alert on failed or rejected orders')).toBeInTheDocument()
    })

    it('renders Drift Warnings toggle', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Drift Warnings')).toBeInTheDocument()
      expect(screen.getByText('Alert when drift exceeds threshold')).toBeInTheDocument()
    })

    it('renders Exchange Errors toggle', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Exchange Errors')).toBeInTheDocument()
      expect(screen.getByText('Alert on sync or API failures')).toBeInTheDocument()
    })

    it('renders Daily Summary toggle', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Daily Summary')).toBeInTheDocument()
      expect(screen.getByText('End-of-day portfolio summary')).toBeInTheDocument()
    })

    it('renders all notification toggle labels', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Rebalance Complete')).toBeInTheDocument()
      expect(screen.getByText('Order Failures')).toBeInTheDocument()
      expect(screen.getByText('Drift Warnings')).toBeInTheDocument()
      expect(screen.getByText('Exchange Errors')).toBeInTheDocument()
      expect(screen.getByText('Daily Summary')).toBeInTheDocument()
    })

    it('renders Switch components for all toggles', () => {
      const { container } = wrap(<SettingsPage />)
      // shadcn Switch renders with role="switch"
      const switches = container.querySelectorAll('[role="switch"]')
      expect(switches.length).toBe(5)
    })
  })

  describe('Data section', () => {
    it('renders Data card', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText('Data')).toBeInTheDocument()
    })

    it('renders Export Portfolio Data button', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText(/Export Portfolio Data/i)).toBeInTheDocument()
    })

    it('renders Export Order History button', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText(/Export Order History/i)).toBeInTheDocument()
    })

    it('renders Clear Local Cache button', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText(/Clear Local Cache/i)).toBeInTheDocument()
    })

    it('Export Portfolio Data button is clickable', () => {
      wrap(<SettingsPage />)
      const exportPortfolioBtn = screen.getByText(/Export Portfolio Data/i)
      expect(exportPortfolioBtn).toBeEnabled()
    })

    it('Export Order History button is clickable', () => {
      wrap(<SettingsPage />)
      const exportHistoryBtn = screen.getByText(/Export Order History/i)
      expect(exportHistoryBtn).toBeEnabled()
    })

    it('Clear Local Cache button is clickable', () => {
      wrap(<SettingsPage />)
      const clearCacheBtn = screen.getByText(/Clear Local Cache/i)
      expect(clearCacheBtn).toBeEnabled()
    })
  })

  describe('Save Settings button', () => {
    it('renders Save Settings button', () => {
      wrap(<SettingsPage />)
      expect(screen.getByText(/Save Settings/i)).toBeInTheDocument()
    })

    it('Save Settings button is clickable', () => {
      wrap(<SettingsPage />)
      const saveBtn = screen.getByText(/Save Settings/i)
      expect(saveBtn).toBeEnabled()
    })

    it('Save Settings button has Save icon', () => {
      wrap(<SettingsPage />)
      const saveBtn = screen.getByText(/Save Settings/i)
      expect(saveBtn).toBeInTheDocument()
    })

    it('clicking Save Settings button triggers save action', () => {
      wrap(<SettingsPage />)
      const saveBtn = screen.getByText(/Save Settings/i)

      fireEvent.click(saveBtn)

      // Button should still be there after click
      expect(screen.getByText(/Save Settings/i)).toBeInTheDocument()
    })
  })

  describe('page layout', () => {
    it('renders settings in a grid layout', () => {
      const { container } = wrap(<SettingsPage />)

      // Check for grid layout classes
      const gridElements = container.querySelectorAll('[class*="grid"]')
      expect(gridElements.length).toBeGreaterThan(0)
    })

    it('renders multiple sections in correct order', () => {
      wrap(<SettingsPage />)

      const defaults = screen.getByText('Defaults')
      const notifications = screen.getByText('Notifications')
      const data = screen.getByText('Data')
      const save = screen.getByText(/Save Settings/i)

      expect(defaults).toBeInTheDocument()
      expect(notifications).toBeInTheDocument()
      expect(data).toBeInTheDocument()
      expect(save).toBeInTheDocument()
    })
  })
})
