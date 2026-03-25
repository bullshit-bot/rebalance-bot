import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { DashboardLayout } from './DashboardLayout'

// Mock sub-components to avoid deep rendering
vi.mock('@/components/AppSidebar', () => ({
  AppSidebar: () => <nav data-testid="sidebar">Sidebar</nav>,
}))

vi.mock('@/components/DashboardHeader', () => ({
  DashboardHeader: () => <header data-testid="header">Header</header>,
}))

function renderLayout() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter initialEntries={['/']}>
        <Routes>
          <Route element={<DashboardLayout />}>
            <Route index element={<div>Page Content</div>} />
          </Route>
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>
  )
}

describe('DashboardLayout', () => {
  it('renders sidebar', () => {
    renderLayout()
    expect(screen.getByTestId('sidebar')).toBeInTheDocument()
  })

  it('renders header', () => {
    renderLayout()
    expect(screen.getByTestId('header')).toBeInTheDocument()
  })

  it('renders outlet content', () => {
    renderLayout()
    expect(screen.getByText('Page Content')).toBeInTheDocument()
  })

  it('has correct layout structure', () => {
    const { container } = renderLayout()
    // Root flex container
    const root = container.firstElementChild
    expect(root?.className).toContain('flex')
    expect(root?.className).toContain('min-h-screen')
  })
})
