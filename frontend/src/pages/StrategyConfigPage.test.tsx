import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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
    vi.restoreAllMocks()
  })

  it('renders page title', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText('Strategy Config')).toBeTruthy()
  })

  it('renders strategy section', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText('Strategy')).toBeTruthy()
  })

  it('renders strategy type select', () => {
    wrap(<StrategyConfigPage />)
    const select = screen.getByDisplayValue('threshold')
    expect(select).toBeTruthy()
  })

  it('renders threshold input', () => {
    wrap(<StrategyConfigPage />)
    const input = screen.getByDisplayValue('8')
    expect(input).toBeTruthy()
  })

  it('renders settings guide', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText('Settings Guide')).toBeTruthy()
  })

  it('renders active config summary', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText('Active Config')).toBeTruthy()
  })

  it('renders save button', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText(/Save Config/i)).toBeTruthy()
  })

  it('renders fee-aware toggle', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText('Fee-Aware Execution')).toBeTruthy()
  })

  it('renders global settings section', () => {
    wrap(<StrategyConfigPage />)
    expect(screen.getByText('Global Settings')).toBeTruthy()
  })
})
