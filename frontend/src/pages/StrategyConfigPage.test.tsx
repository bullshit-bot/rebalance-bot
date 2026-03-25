import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter } from 'react-router-dom'
import StrategyConfigPage from './StrategyConfigPage'

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

describe('StrategyConfigPage', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Clear localStorage before each test
    localStorage.clear()
  })

  it('renders page title', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText('Strategy Config')).toBeInTheDocument()
  })

  it('renders Parameters section', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText('Parameters')).toBeInTheDocument()
  })

  it('renders numeric input fields with default values', () => {
    wrap(<StrategyConfigPage />)

    // Check all numeric input fields exist
    const inputs = screen.getAllByRole('spinbutton')
    expect(inputs.length).toBeGreaterThan(0)
  })

  it('renders Threshold % input with default value', () => {
    wrap(<StrategyConfigPage />)
    const thresholdInputs = screen.getAllByDisplayValue('5')
    expect(thresholdInputs.length).toBeGreaterThan(0)
  })

  it('renders Min Trade (USDT) input with default value', () => {
    wrap(<StrategyConfigPage />)
    const minTradeInputs = screen.getAllByDisplayValue('15')
    expect(minTradeInputs.length).toBeGreaterThan(0)
  })

  it('renders Partial Factor input with default value', () => {
    wrap(<StrategyConfigPage />)
    const partialInputs = screen.getAllByDisplayValue('0.75')
    expect(partialInputs.length).toBeGreaterThan(0)
  })

  it('renders Cooldown (hours) input with default value', () => {
    wrap(<StrategyConfigPage />)
    const cooldownInputs = screen.getAllByDisplayValue('4')
    expect(cooldownInputs.length).toBeGreaterThan(0)
  })

  it('renders Max Daily Volume input with default value', () => {
    wrap(<StrategyConfigPage />)
    const maxVolumeInputs = screen.getAllByDisplayValue('50000')
    expect(maxVolumeInputs.length).toBeGreaterThan(0)
  })

  it('renders Base Asset input with default value', () => {
    wrap(<StrategyConfigPage />)
    const baseAssetInputs = screen.getAllByDisplayValue('USDT')
    expect(baseAssetInputs.length).toBeGreaterThan(0)
  })

  it('renders Toggles section', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText('Toggles')).toBeInTheDocument()
  })

  it('renders toggle switches for all toggle options', () => {
    wrap(<StrategyConfigPage />)

    expect(screen.getByText('Dynamic Threshold')).toBeInTheDocument()
    expect(screen.getByText('Trend-Aware Mode')).toBeInTheDocument()
    expect(screen.getByText('Fee-Aware Execution')).toBeInTheDocument()
    expect(screen.getByText('Auto Execute')).toBeInTheDocument()
  })

  it('renders Save Config button', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText(/Save Config/i)).toBeInTheDocument()
  })

  it('renders Restore Defaults button', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText(/Restore Defaults/i)).toBeInTheDocument()
  })

  it('renders Presets section', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText('Presets')).toBeInTheDocument()
  })

  it('renders all preset buttons', () => {
    wrap(<StrategyConfigPage />)

    expect(screen.getByText('Conservative')).toBeInTheDocument()
    expect(screen.getByText('Balanced')).toBeInTheDocument()
    expect(screen.getByText('Aggressive')).toBeInTheDocument()
  })

  it('renders How It Works section', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText('How It Works')).toBeInTheDocument()
  })

  it('applies Conservative preset when clicked', async () => {
    wrap(<StrategyConfigPage />)

    const conservativeBtn = screen.getByText('Conservative')
    fireEvent.click(conservativeBtn)

    // Threshold should change to 8 after applying Conservative preset
    const thresholdInputs = screen.getAllByDisplayValue('8')
    expect(thresholdInputs.length).toBeGreaterThan(0)
  })

  it('applies Balanced preset when clicked', async () => {
    wrap(<StrategyConfigPage />)

    // First apply Conservative to change state
    const conservativeBtn = screen.getByText('Conservative')
    fireEvent.click(conservativeBtn)

    // Then apply Balanced
    const balancedBtn = screen.getByText('Balanced')
    fireEvent.click(balancedBtn)

    // Threshold should be back to 5 (Balanced preset)
    const thresholdInputs = screen.getAllByDisplayValue('5')
    expect(thresholdInputs.length).toBeGreaterThan(0)
  })

  it('applies Aggressive preset when clicked', async () => {
    wrap(<StrategyConfigPage />)

    const aggressiveBtn = screen.getByText('Aggressive')
    fireEvent.click(aggressiveBtn)

    // Threshold should change to 2 after applying Aggressive preset
    const thresholdInputs = screen.getAllByDisplayValue('2')
    expect(thresholdInputs.length).toBeGreaterThan(0)
  })

  it('allows input field value changes', async () => {
    wrap(<StrategyConfigPage />)

    const inputs = screen.getAllByDisplayValue('5') // threshold input
    const thresholdInput = inputs[0] as HTMLInputElement

    // Change threshold value
    fireEvent.change(thresholdInput, { target: { value: '10' } })
    expect(thresholdInput.value).toBe('10')
  })

  it('persists config to localStorage on save', async () => {
    wrap(<StrategyConfigPage />)

    const saveBtn = screen.getByText(/Save Config/i)
    fireEvent.click(saveBtn)

    // Config should be saved to localStorage
    const stored = localStorage.getItem('rb_strategy_config')
    expect(stored).toBeTruthy()
    const config = JSON.parse(stored!)
    expect(config.thresholdPct).toBe(5.0)
  })

  it('loads config from localStorage on mount', () => {
    // Pre-populate localStorage with custom config
    const customConfig = {
      thresholdPct: 7.5,
      minTradeUSDT: 25,
      partialFactor: 0.9,
      cooldownHours: 6,
      maxDailyVolume: 75000,
      baseAsset: 'USDC',
      dynamicThreshold: false,
      trendAware: true,
      feeAware: false,
      autoExecute: true,
    }
    localStorage.setItem('rb_strategy_config', JSON.stringify(customConfig))

    wrap(<StrategyConfigPage />)

    // Check custom values are loaded
    const thresholdInputs = screen.getAllByDisplayValue('7.5')
    expect(thresholdInputs.length).toBeGreaterThan(0)
  })

  it('restores defaults when Restore Defaults button clicked', async () => {
    // First set a custom config
    const customConfig = {
      thresholdPct: 10,
      minTradeUSDT: 50,
      partialFactor: 1.0,
      cooldownHours: 2,
      maxDailyVolume: 100000,
      baseAsset: 'USDC',
      dynamicThreshold: false,
      trendAware: true,
      feeAware: false,
      autoExecute: true,
    }
    localStorage.setItem('rb_strategy_config', JSON.stringify(customConfig))

    wrap(<StrategyConfigPage />)

    const restoreBtn = screen.getByText(/Restore Defaults/i)
    fireEvent.click(restoreBtn)

    // After clicking restore, check localStorage was updated
    const stored = localStorage.getItem('rb_strategy_config')
    expect(stored).toBeTruthy()
    const config = JSON.parse(stored!)
    // Should have default threshold value
    expect(config.thresholdPct).toBe(5.0)
  })
})
