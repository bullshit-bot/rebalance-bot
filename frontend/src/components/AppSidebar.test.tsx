import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { AppSidebar } from './AppSidebar'

function renderSidebar(route = '/') {
  return render(
    <MemoryRouter initialEntries={[route]}>
      <AppSidebar />
    </MemoryRouter>
  )
}

describe('AppSidebar', () => {
  it('renders brand name', () => {
    renderSidebar()
    expect(screen.getByText(/RBBot/)).toBeInTheDocument()
  })

  it('renders all main nav items', () => {
    renderSidebar()
    expect(screen.getByText('Overview')).toBeInTheDocument()
    expect(screen.getByText('Portfolio')).toBeInTheDocument()
    expect(screen.getByText('Orders')).toBeInTheDocument()
    expect(screen.getByText('Exchanges')).toBeInTheDocument()
    expect(screen.getByText('Settings')).toBeInTheDocument()
  })

  it('renders advanced section separator', () => {
    renderSidebar()
    expect(screen.getByText('Advanced')).toBeInTheDocument()
  })

  it('renders advanced nav items', () => {
    renderSidebar()
    expect(screen.getByText('Backtesting')).toBeInTheDocument()
    expect(screen.getByText('Analytics')).toBeInTheDocument()
    expect(screen.getByText('Grid Trading')).toBeInTheDocument()
    expect(screen.getByText('Smart Orders')).toBeInTheDocument()
    expect(screen.getByText('AI Suggestions')).toBeInTheDocument()
  })

  it('highlights active route', () => {
    renderSidebar('/portfolio')
    const portfolioLink = screen.getByText('Portfolio').closest('a')
    expect(portfolioLink?.className).toContain('bg-primary')
  })

  it('collapses sidebar on toggle click', () => {
    const { container } = renderSidebar()
    const toggleBtn = container.querySelector('button')!
    fireEvent.click(toggleBtn)
    // After collapse, brand text should be hidden
    expect(screen.queryByText(/RBBot/)).not.toBeInTheDocument()
    // Section separator should be hidden
    expect(screen.queryByText('Advanced')).not.toBeInTheDocument()
  })

  it('expands sidebar on second toggle click', () => {
    const { container } = renderSidebar()
    const toggleBtn = container.querySelector('button')!
    fireEvent.click(toggleBtn) // collapse
    fireEvent.click(toggleBtn) // expand
    expect(screen.getByText(/RBBot/)).toBeInTheDocument()
  })

  it('shows version footer when expanded', () => {
    renderSidebar()
    expect(screen.getByText(/v3.1.0/)).toBeInTheDocument()
  })

  it('hides version footer when collapsed', () => {
    const { container } = renderSidebar()
    fireEvent.click(container.querySelector('button')!)
    expect(screen.queryByText(/v3.1.0/)).not.toBeInTheDocument()
  })

  it('nav links have correct hrefs', () => {
    renderSidebar()
    const overviewLink = screen.getByText('Overview').closest('a')
    expect(overviewLink?.getAttribute('href')).toBe('/')
    const portfolioLink = screen.getByText('Portfolio').closest('a')
    expect(portfolioLink?.getAttribute('href')).toBe('/portfolio')
  })
})
