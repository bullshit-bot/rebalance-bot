import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as React from 'react'
import {
  ChartContainer,
  ChartTooltipContent,
  ChartLegendContent,
  ChartStyle,
} from './chart'
import type { ChartConfig } from './chart'

// Minimal recharts child that satisfies ResponsiveContainer
function FakeChart() {
  return <div data-testid="fake-chart">chart</div>
}

const config: ChartConfig = {
  revenue: { label: 'Revenue', color: '#ff0000' },
  profit: { label: 'Profit', theme: { light: '#00ff00', dark: '#008800' } },
}

describe('ChartContainer', () => {
  it('renders children inside a data-chart container', () => {
    const { container } = render(
      <ChartContainer config={config}>
        <FakeChart />
      </ChartContainer>
    )
    expect(container.querySelector('[data-chart]')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = render(
      <ChartContainer config={config} className="my-chart">
        <FakeChart />
      </ChartContainer>
    )
    expect(container.querySelector('.my-chart')).toBeInTheDocument()
  })

  it('uses custom id', () => {
    const { container } = render(
      <ChartContainer config={config} id="test-id">
        <FakeChart />
      </ChartContainer>
    )
    expect(container.querySelector('[data-chart="chart-test-id"]')).toBeInTheDocument()
  })
})

describe('ChartStyle', () => {
  it('renders style tag with color CSS vars', () => {
    const { container } = render(<ChartStyle id="test" config={config} />)
    const style = container.querySelector('style')
    expect(style).toBeInTheDocument()
    expect(style?.innerHTML).toContain('--color-revenue')
    expect(style?.innerHTML).toContain('#ff0000')
  })

  it('renders theme-based colors', () => {
    const { container } = render(<ChartStyle id="test" config={config} />)
    const style = container.querySelector('style')
    expect(style?.innerHTML).toContain('--color-profit')
    expect(style?.innerHTML).toContain('#00ff00')
  })

  it('returns null when no color config', () => {
    const emptyConfig: ChartConfig = { item: { label: 'No color' } }
    const { container } = render(<ChartStyle id="test" config={emptyConfig} />)
    expect(container.querySelector('style')).not.toBeInTheDocument()
  })
})

describe('ChartTooltipContent', () => {
  // Must be rendered inside ChartContainer for ChartContext
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <ChartContainer config={config}>{children as any}</ChartContainer>
  }

  it('returns null when not active', () => {
    const { container } = render(
      <Wrapper>
        <ChartTooltipContent active={false} payload={[]} />
      </Wrapper>
    )
    // No tooltip content rendered (just the chart wrapper)
    expect(container.querySelector('.grid.min-w-\\[8rem\\]')).not.toBeInTheDocument()
  })

  it('returns null when payload is empty', () => {
    const { container } = render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={[]} />
      </Wrapper>
    )
    expect(container.querySelector('.grid.min-w-\\[8rem\\]')).not.toBeInTheDocument()
  })

  it('renders tooltip with payload', () => {
    const payload = [
      { name: 'revenue', value: 1000, dataKey: 'revenue', color: '#ff0000', payload: { fill: '#ff0000' } },
    ]
    render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={payload} label="Jan" />
      </Wrapper>
    )
    expect(screen.getByText('1,000')).toBeInTheDocument()
    expect(screen.getByText('Revenue')).toBeInTheDocument()
  })

  it('renders with hideLabel', () => {
    const payload = [
      { name: 'revenue', value: 500, dataKey: 'revenue', color: '#ff0000', payload: { fill: '#ff0000' } },
    ]
    render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={payload} label="Jan" hideLabel />
      </Wrapper>
    )
    expect(screen.getByText('500')).toBeInTheDocument()
  })

  it('renders with hideIndicator', () => {
    const payload = [
      { name: 'revenue', value: 200, dataKey: 'revenue', color: '#ff0000', payload: { fill: '#ff0000' } },
    ]
    render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={payload} hideIndicator />
      </Wrapper>
    )
    expect(screen.getByText('200')).toBeInTheDocument()
  })

  it('renders line indicator', () => {
    const payload = [
      { name: 'revenue', value: 300, dataKey: 'revenue', color: '#ff0000', payload: { fill: '#ff0000' } },
    ]
    const { container } = render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={payload} indicator="line" label="Q1" />
      </Wrapper>
    )
    expect(container.querySelector('.w-1')).toBeInTheDocument()
  })

  it('renders dashed indicator', () => {
    const payload = [
      { name: 'revenue', value: 400, dataKey: 'revenue', color: '#ff0000', payload: { fill: '#ff0000' } },
    ]
    const { container } = render(
      <Wrapper>
        <ChartTooltipContent active={true} payload={payload} indicator="dashed" label="Q2" />
      </Wrapper>
    )
    expect(container.querySelector('.border-dashed')).toBeInTheDocument()
  })

  it('renders with labelFormatter', () => {
    const payload = [
      { name: 'revenue', value: 100, dataKey: 'revenue', color: '#ff0000', payload: { fill: '#ff0000' } },
    ]
    render(
      <Wrapper>
        <ChartTooltipContent
          active={true}
          payload={payload}
          label="Jan"
          labelFormatter={(val) => `Formatted: ${val}`}
        />
      </Wrapper>
    )
    expect(screen.getByText('Formatted: Jan')).toBeInTheDocument()
  })

  it('renders with custom formatter', () => {
    const payload = [
      { name: 'revenue', value: 999, dataKey: 'revenue', color: '#ff0000', payload: { fill: '#ff0000' } },
    ]
    render(
      <Wrapper>
        <ChartTooltipContent
          active={true}
          payload={payload}
          formatter={(value, name) => <span data-testid="custom">{`${name}: ${value}`}</span>}
        />
      </Wrapper>
    )
    expect(screen.getByTestId('custom')).toHaveTextContent('revenue: 999')
  })

  it('renders with icon from config', () => {
    const iconConfig: ChartConfig = {
      revenue: { label: 'Revenue', color: '#ff0000', icon: () => <svg data-testid="icon" /> },
    }
    const payload = [
      { name: 'revenue', value: 50, dataKey: 'revenue', color: '#ff0000', payload: { fill: '#ff0000' } },
    ]
    render(
      <ChartContainer config={iconConfig}>
        <ChartTooltipContent active={true} payload={payload} />
      </ChartContainer>
    )
    expect(screen.getByTestId('icon')).toBeInTheDocument()
  })
})

describe('ChartLegendContent', () => {
  function Wrapper({ children }: { children: React.ReactNode }) {
    return <ChartContainer config={config}>{children as any}</ChartContainer>
  }

  it('returns null when payload is empty', () => {
    const { container } = render(
      <Wrapper>
        <ChartLegendContent payload={[]} />
      </Wrapper>
    )
    // Only chart wrapper, no legend div
    expect(container.querySelectorAll('.flex.items-center.justify-center').length).toBe(0)
  })

  it('renders legend items from payload', () => {
    const payload = [
      { value: 'revenue', dataKey: 'revenue', color: '#ff0000' },
      { value: 'profit', dataKey: 'profit', color: '#00ff00' },
    ]
    render(
      <Wrapper>
        <ChartLegendContent payload={payload as any} />
      </Wrapper>
    )
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('Profit')).toBeInTheDocument()
  })

  it('renders with verticalAlign top', () => {
    const payload = [{ value: 'revenue', dataKey: 'revenue', color: '#ff0000' }]
    const { container } = render(
      <Wrapper>
        <ChartLegendContent payload={payload as any} verticalAlign="top" />
      </Wrapper>
    )
    expect(container.querySelector('.pb-3')).toBeInTheDocument()
  })

  it('renders icon from config when available', () => {
    const iconConfig: ChartConfig = {
      revenue: { label: 'Rev', color: '#f00', icon: () => <svg data-testid="legend-icon" /> },
    }
    const payload = [{ value: 'revenue', dataKey: 'revenue', color: '#ff0000' }]
    render(
      <ChartContainer config={iconConfig}>
        <ChartLegendContent payload={payload as any} />
      </ChartContainer>
    )
    expect(screen.getByTestId('legend-icon')).toBeInTheDocument()
  })

  it('hides icon when hideIcon is true', () => {
    const iconConfig: ChartConfig = {
      revenue: { label: 'Rev', color: '#f00', icon: () => <svg data-testid="hidden-icon" /> },
    }
    const payload = [{ value: 'revenue', dataKey: 'revenue', color: '#ff0000' }]
    render(
      <ChartContainer config={iconConfig}>
        <ChartLegendContent payload={payload as any} hideIcon />
      </ChartContainer>
    )
    expect(screen.queryByTestId('hidden-icon')).not.toBeInTheDocument()
  })

  it('uses nameKey for config lookup', () => {
    const payload = [{ value: 'revenue', dataKey: 'rev', color: '#ff0000', revenue: 'revenue' }]
    render(
      <Wrapper>
        <ChartLegendContent payload={payload as any} nameKey="revenue" />
      </Wrapper>
    )
    expect(screen.getByText('Revenue')).toBeInTheDocument()
  })
})
