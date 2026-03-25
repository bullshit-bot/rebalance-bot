import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import {
  PageTitle, SectionTitle, BrutalLabel, StatCard, DriftBadge, ActionBadge,
  SeverityBadge, StatusBadge, LogLevelBadge, BrutalBadge, BrutalButton,
  BrutalCard, BrutalCardHeader, BrutalCardFooter, BrutalInput, BrutalTextarea,
  BrutalSelect, BrutalCheckbox, BrutalRadio, BrutalRadioGroup, BrutalToggle,
  BrutalSlider, BrutalTabs, BrutalAccordion, BrutalAlert, BrutalCallout,
  BrutalDialog, BrutalConfirmDialog, BrutalDrawer, BrutalTooltip, BrutalPopover,
  BrutalDropdownMenu, BrutalTable, BrutalProgress, BrutalSkeleton, BrutalAvatar,
  BrutalTag, BrutalEmptyState, BrutalDivider, BrutalBreadcrumb, BrutalKbd,
  BrutalCode, BrutalPagination, BrutalList, BrutalListItem, BrutalToolbar,
  BrutalStepper, BrutalDot, BrutalSpinner, BrutalToast, BrutalMarquee,
  BrutalFieldGroup,
} from './ui-brutal'

function wrap(ui: React.ReactNode) {
  return render(<MemoryRouter>{ui}</MemoryRouter>)
}

// ════════════════════════════════════════════════════
// TYPOGRAPHY
// ════════════════════════════════════════════════════

describe('PageTitle', () => {
  it('renders children in h2 tag', () => {
    wrap(<PageTitle>Test Title</PageTitle>)
    const heading = screen.getByRole('heading', { level: 2 })
    expect(heading).toHaveTextContent('Test Title')
  })

  it('applies bold and margin classes', () => {
    const { container } = wrap(<PageTitle>Title</PageTitle>)
    const h2 = container.querySelector('h2')
    expect(h2).toHaveClass('text-2xl', 'font-bold', 'mb-5')
  })
})

describe('SectionTitle', () => {
  it('renders children in h3 tag', () => {
    wrap(<SectionTitle>Section</SectionTitle>)
    const heading = screen.getByRole('heading', { level: 3 })
    expect(heading).toHaveTextContent('Section')
  })

  it('applies bold and margin classes', () => {
    const { container } = wrap(<SectionTitle>Section</SectionTitle>)
    const h3 = container.querySelector('h3')
    expect(h3).toHaveClass('text-lg', 'font-bold', 'mb-3')
  })
})

describe('BrutalLabel', () => {
  it('renders label with children', () => {
    wrap(<BrutalLabel>Name</BrutalLabel>)
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('sets htmlFor attribute', () => {
    const { container } = wrap(<BrutalLabel htmlFor="input-id">Label</BrutalLabel>)
    const label = container.querySelector('label')
    // React converts htmlFor to for in the DOM
    expect(label?.getAttribute('for')).toBe('input-id')
  })

  it('displays required asterisk when required is true', () => {
    wrap(<BrutalLabel required>Name</BrutalLabel>)
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('does not display asterisk when required is false', () => {
    const { container } = wrap(<BrutalLabel required={false}>Name</BrutalLabel>)
    expect(container.querySelector('.text-destructive')).not.toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// STAT CARD
// ════════════════════════════════════════════════════

describe('StatCard', () => {
  it('renders label and value', () => {
    wrap(<StatCard label="Revenue" value="$1000" />)
    expect(screen.getByText('Revenue')).toBeInTheDocument()
    expect(screen.getByText('$1000')).toBeInTheDocument()
  })

  it('renders subValue when provided', () => {
    wrap(<StatCard label="Revenue" value="$1000" subValue="Last month" />)
    expect(screen.getByText('Last month')).toBeInTheDocument()
  })

  it('does not render subValue when not provided', () => {
    const { container } = wrap(<StatCard label="Revenue" value="$1000" />)
    expect(container.textContent).not.toContain('Last month')
  })

  it('applies variant class', () => {
    const { container } = wrap(<StatCard label="Revenue" value="$1000" variant="success" />)
    const card = container.querySelector('.brutal-card')
    expect(card).toHaveClass('bg-success/10', 'border-success')
  })

  it('renders icon when provided', () => {
    wrap(<StatCard label="Revenue" value="$1000" icon={<span>icon</span>} />)
    expect(screen.getByText('icon')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// BADGES (Domain-specific)
// ════════════════════════════════════════════════════

describe('DriftBadge', () => {
  it('shows positive drift with plus sign', () => {
    wrap(<DriftBadge drift={2.5} />)
    expect(screen.getByText('+2.5%')).toBeInTheDocument()
  })

  it('shows negative drift without plus', () => {
    wrap(<DriftBadge drift={-1.5} />)
    expect(screen.getByText('-1.5%')).toBeInTheDocument()
  })

  it('applies success class for small positive drift', () => {
    const { container } = wrap(<DriftBadge drift={1.0} />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-success/15', 'text-success')
  })

  it('applies warning class for medium drift', () => {
    const { container } = wrap(<DriftBadge drift={-2.0} />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-warning/15', 'text-warning-foreground')
  })

  it('applies danger class for large drift', () => {
    const { container } = wrap(<DriftBadge drift={-3.5} />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-destructive/15', 'text-destructive')
  })
})

describe('ActionBadge', () => {
  it('renders action text in uppercase', () => {
    wrap(<ActionBadge action="buy" />)
    expect(screen.getByText('buy')).toHaveClass('uppercase')
  })

  it('applies success class for buy action', () => {
    const { container } = wrap(<ActionBadge action="buy" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-success/15', 'text-success')
  })

  it('applies danger class for sell action', () => {
    const { container } = wrap(<ActionBadge action="sell" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-destructive/15', 'text-destructive')
  })

  it('applies warning class for reduce action', () => {
    const { container } = wrap(<ActionBadge action="reduce" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-warning/15', 'text-warning-foreground')
  })

  it('defaults to hold class for unknown action', () => {
    const { container } = wrap(<ActionBadge action="unknown" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-secondary', 'text-muted-foreground')
  })
})

describe('SeverityBadge', () => {
  it('renders severity text', () => {
    wrap(<SeverityBadge severity="critical" />)
    expect(screen.getByText('critical')).toBeInTheDocument()
  })

  it('applies critical class for critical severity', () => {
    const { container } = wrap(<SeverityBadge severity="critical" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-destructive', 'text-destructive-foreground')
  })

  it('applies warning class for warning severity', () => {
    const { container } = wrap(<SeverityBadge severity="warning" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-warning', 'text-warning-foreground')
  })

  it('applies info class for info severity', () => {
    const { container } = wrap(<SeverityBadge severity="info" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-primary/15', 'text-primary')
  })
})

describe('StatusBadge', () => {
  it('renders status text', () => {
    wrap(<StatusBadge status="connected" />)
    expect(screen.getByText('connected')).toBeInTheDocument()
  })

  it('applies success class for filled status', () => {
    const { container } = wrap(<StatusBadge status="filled" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-success/15', 'text-success')
  })

  it('applies danger class for failed status', () => {
    const { container } = wrap(<StatusBadge status="failed" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-destructive/15', 'text-destructive')
  })

  it('applies warning class for open status', () => {
    const { container } = wrap(<StatusBadge status="open" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-warning/15', 'text-warning-foreground')
  })
})

describe('LogLevelBadge', () => {
  it('renders log level text', () => {
    wrap(<LogLevelBadge level="error" />)
    expect(screen.getByText('error')).toBeInTheDocument()
  })

  it('applies danger class for error level', () => {
    const { container } = wrap(<LogLevelBadge level="error" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-destructive/15', 'text-destructive')
  })

  it('applies success class for execution level', () => {
    const { container } = wrap(<LogLevelBadge level="execution" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-success/15', 'text-success')
  })

  it('applies muted class for sync level', () => {
    const { container } = wrap(<LogLevelBadge level="sync" />)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-secondary', 'text-muted-foreground')
  })
})

// ════════════════════════════════════════════════════
// GENERIC BADGE
// ════════════════════════════════════════════════════

describe('BrutalBadge', () => {
  it('renders children', () => {
    wrap(<BrutalBadge>Badge Text</BrutalBadge>)
    expect(screen.getByText('Badge Text')).toBeInTheDocument()
  })

  it('applies default variant by default', () => {
    const { container } = wrap(<BrutalBadge>Badge</BrutalBadge>)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-card', 'text-foreground')
  })

  it('applies primary variant', () => {
    const { container } = wrap(<BrutalBadge variant="primary">Badge</BrutalBadge>)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-primary/15', 'text-primary')
  })

  it('applies success variant', () => {
    const { container } = wrap(<BrutalBadge variant="success">Badge</BrutalBadge>)
    expect(container.querySelector('.brutal-badge')).toHaveClass('bg-success/15', 'text-success')
  })

  it('applies md size by default', () => {
    const { container } = wrap(<BrutalBadge>Badge</BrutalBadge>)
    expect(container.querySelector('.brutal-badge')).toBeInTheDocument()
  })

  it('applies sm size', () => {
    const { container } = wrap(<BrutalBadge size="sm">Badge</BrutalBadge>)
    expect(container.querySelector('.brutal-badge-sm')).toBeInTheDocument()
  })

  it('applies lg size', () => {
    const { container } = wrap(<BrutalBadge size="lg">Badge</BrutalBadge>)
    expect(container.querySelector('.brutal-badge-lg')).toBeInTheDocument()
  })

  it('applies pill size', () => {
    const { container } = wrap(<BrutalBadge size="pill">Badge</BrutalBadge>)
    expect(container.querySelector('.brutal-badge-pill')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalBadge className="custom-class">Badge</BrutalBadge>)
    expect(container.querySelector('.brutal-badge')).toHaveClass('custom-class')
  })
})

// ════════════════════════════════════════════════════
// BUTTON
// ════════════════════════════════════════════════════

describe('BrutalButton', () => {
  it('renders children', () => {
    wrap(<BrutalButton>Click Me</BrutalButton>)
    expect(screen.getByRole('button', { name: /Click Me/i })).toBeInTheDocument()
  })

  it('applies primary variant by default', () => {
    const { container } = wrap(<BrutalButton>Click</BrutalButton>)
    expect(container.querySelector('button')).toHaveClass('brutal-btn-primary')
  })

  it('applies variant class', () => {
    const { container } = wrap(<BrutalButton variant="danger">Delete</BrutalButton>)
    expect(container.querySelector('button')).toHaveClass('brutal-btn-danger')
  })

  it('disables button when disabled prop is true', () => {
    wrap(<BrutalButton disabled>Click</BrutalButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('disables button when loading is true', () => {
    wrap(<BrutalButton loading>Click</BrutalButton>)
    expect(screen.getByRole('button')).toBeDisabled()
  })

  it('shows loading spinner when loading is true', () => {
    const { container } = wrap(<BrutalButton loading>Click</BrutalButton>)
    expect(container.querySelector('.animate-spin')).toBeInTheDocument()
  })

  it('handles click events', () => {
    const handleClick = vi.fn()
    wrap(<BrutalButton onClick={handleClick}>Click</BrutalButton>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClick).toHaveBeenCalled()
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalButton className="custom">Click</BrutalButton>)
    expect(container.querySelector('button')).toHaveClass('custom')
  })
})

// ════════════════════════════════════════════════════
// CARD
// ════════════════════════════════════════════════════

describe('BrutalCard', () => {
  it('renders children', () => {
    wrap(<BrutalCard>Content</BrutalCard>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('applies default variant by default', () => {
    const { container } = wrap(<BrutalCard>Content</BrutalCard>)
    expect(container.querySelector('.brutal-card')).toBeInTheDocument()
  })

  it('applies static variant', () => {
    const { container } = wrap(<BrutalCard variant="static">Content</BrutalCard>)
    expect(container.querySelector('.brutal-card-static')).toBeInTheDocument()
  })

  it('applies purple variant', () => {
    const { container } = wrap(<BrutalCard variant="purple">Content</BrutalCard>)
    expect(container.querySelector('.brutal-card-purple')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalCard className="custom">Content</BrutalCard>)
    expect(container.querySelector('.brutal-card')).toHaveClass('custom')
  })

  it('calls onClick when clicked', async () => {
    
    const handleClick = vi.fn()
    const { container } = wrap(<BrutalCard onClick={handleClick}>Content</BrutalCard>)
    fireEvent.click(container.querySelector('.brutal-card')!)
    expect(handleClick).toHaveBeenCalled()
  })
})

describe('BrutalCardHeader', () => {
  it('renders children', () => {
    wrap(<BrutalCardHeader>Header</BrutalCardHeader>)
    expect(screen.getByText('Header')).toBeInTheDocument()
  })

  it('applies margin class', () => {
    const { container } = wrap(<BrutalCardHeader>Header</BrutalCardHeader>)
    const div = container.firstChild
    expect(div).toHaveClass('mb-3')
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalCardHeader className="custom">Header</BrutalCardHeader>)
    expect(container.firstChild).toHaveClass('custom')
  })
})

describe('BrutalCardFooter', () => {
  it('renders children', () => {
    wrap(<BrutalCardFooter>Footer</BrutalCardFooter>)
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('applies border class', () => {
    const { container } = wrap(<BrutalCardFooter>Footer</BrutalCardFooter>)
    const div = container.firstChild
    expect(div).toHaveClass('border-t-[2px]', 'border-foreground/15')
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalCardFooter className="custom">Footer</BrutalCardFooter>)
    expect(container.firstChild).toHaveClass('custom')
  })
})

// ════════════════════════════════════════════════════
// FORM CONTROLS
// ════════════════════════════════════════════════════

describe('BrutalInput', () => {
  it('renders input element', () => {
    wrap(<BrutalInput placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('applies input class', () => {
    const { container } = wrap(<BrutalInput />)
    expect(container.querySelector('.brutal-input')).toBeInTheDocument()
  })

  it('displays error message when error prop provided', () => {
    wrap(<BrutalInput error="Field is required" />)
    expect(screen.getByText('Field is required')).toBeInTheDocument()
  })

  it('applies error ring when error exists', () => {
    const { container } = wrap(<BrutalInput error="Error" />)
    expect(container.querySelector('.brutal-input')).toHaveClass('ring-2', 'ring-destructive')
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalInput className="custom" />)
    expect(container.querySelector('.brutal-input')).toHaveClass('custom')
  })

  it('handles change events', () => {
    const handleChange = vi.fn()
    const { container } = wrap(<BrutalInput onChange={handleChange} />)
    const input = container.querySelector('input')
    fireEvent.change(input!, { target: { value: 'test' } })
    expect(handleChange).toHaveBeenCalled()
  })
})

describe('BrutalTextarea', () => {
  it('renders textarea element', () => {
    wrap(<BrutalTextarea placeholder="Enter text" />)
    expect(screen.getByPlaceholderText('Enter text')).toBeInTheDocument()
  })

  it('applies textarea class', () => {
    const { container } = wrap(<BrutalTextarea />)
    expect(container.querySelector('.brutal-textarea')).toBeInTheDocument()
  })

  it('displays error message when error prop provided', () => {
    wrap(<BrutalTextarea error="Invalid input" />)
    expect(screen.getByText('Invalid input')).toBeInTheDocument()
  })

  it('applies error ring when error exists', () => {
    const { container } = wrap(<BrutalTextarea error="Error" />)
    expect(container.querySelector('.brutal-textarea')).toHaveClass('ring-2', 'ring-destructive')
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalTextarea className="custom" />)
    expect(container.querySelector('.brutal-textarea')).toHaveClass('custom')
  })
})

describe('BrutalSelect', () => {
  const options = [
    { value: '1', label: 'Option 1' },
    { value: '2', label: 'Option 2' },
  ]

  it('renders select element', () => {
    wrap(<BrutalSelect options={options} />)
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('applies select class', () => {
    const { container } = wrap(<BrutalSelect options={options} />)
    expect(container.querySelector('.brutal-select')).toBeInTheDocument()
  })

  it('renders options', () => {
    wrap(<BrutalSelect options={options} />)
    expect(screen.getByText('Option 1')).toBeInTheDocument()
    expect(screen.getByText('Option 2')).toBeInTheDocument()
  })

  it('renders placeholder option', () => {
    wrap(<BrutalSelect options={options} placeholder="Choose..." />)
    expect(screen.getByText('Choose...')).toBeInTheDocument()
  })

  it('handles change events', async () => {
    
    const handleChange = vi.fn()
    wrap(<BrutalSelect options={options} onChange={handleChange} />)
    fireEvent.change(screen.getByRole('combobox'), '1')
    expect(handleChange).toHaveBeenCalled()
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalSelect options={options} className="custom" />)
    expect(container.querySelector('.brutal-select')).toHaveClass('custom')
  })
})

describe('BrutalCheckbox', () => {
  it('renders checkbox input', () => {
    wrap(<BrutalCheckbox id="check" />)
    expect(screen.getByRole('checkbox')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    wrap(<BrutalCheckbox label="Accept" id="check" />)
    expect(screen.getByText('Accept')).toBeInTheDocument()
  })

  it('sets checked state', () => {
    wrap(<BrutalCheckbox checked={true} id="check" />)
    expect(screen.getByRole('checkbox')).toBeChecked()
  })

  it('disables checkbox when disabled is true', () => {
    wrap(<BrutalCheckbox disabled id="check" />)
    expect(screen.getByRole('checkbox')).toBeDisabled()
  })

  it('calls onChange with checked value', async () => {
    
    const handleChange = vi.fn()
    wrap(<BrutalCheckbox onChange={handleChange} id="check" />)
    fireEvent.click(screen.getByRole('checkbox'))
    expect(handleChange).toHaveBeenCalledWith(true)
  })
})

describe('BrutalRadio', () => {
  it('renders radio input', () => {
    wrap(<BrutalRadio name="color" value="red" label="Red" />)
    expect(screen.getByRole('radio')).toBeInTheDocument()
  })

  it('renders label', () => {
    wrap(<BrutalRadio name="color" value="red" label="Red" />)
    expect(screen.getByText('Red')).toBeInTheDocument()
  })

  it('sets checked state', () => {
    wrap(<BrutalRadio name="color" value="red" label="Red" checked={true} />)
    expect(screen.getByRole('radio')).toBeChecked()
  })

  it('disables radio when disabled is true', () => {
    wrap(<BrutalRadio name="color" value="red" label="Red" disabled />)
    expect(screen.getByRole('radio')).toBeDisabled()
  })

  it('calls onChange with value', async () => {
    
    const handleChange = vi.fn()
    wrap(<BrutalRadio name="color" value="red" label="Red" onChange={handleChange} />)
    fireEvent.click(screen.getByRole('radio'))
    expect(handleChange).toHaveBeenCalledWith('red')
  })
})

describe('BrutalRadioGroup', () => {
  const options = [
    { value: 'red', label: 'Red' },
    { value: 'blue', label: 'Blue' },
  ]

  it('renders multiple radio options', () => {
    wrap(<BrutalRadioGroup name="color" options={options} />)
    expect(screen.getByLabelText('Red')).toBeInTheDocument()
    expect(screen.getByLabelText('Blue')).toBeInTheDocument()
  })

  it('sets selected value', () => {
    wrap(<BrutalRadioGroup name="color" options={options} value="red" />)
    expect(screen.getByLabelText('Red')).toBeChecked()
    expect(screen.getByLabelText('Blue')).not.toBeChecked()
  })

  it('calls onChange when selection changes', async () => {
    
    const handleChange = vi.fn()
    wrap(<BrutalRadioGroup name="color" options={options} onChange={handleChange} />)
    fireEvent.click(screen.getByLabelText('Blue'))
    expect(handleChange).toHaveBeenCalledWith('blue')
  })
})

// ════════════════════════════════════════════════════
// TOGGLE / SWITCH
// ════════════════════════════════════════════════════

describe('BrutalToggle', () => {
  it('renders toggle button with switch role', () => {
    wrap(<BrutalToggle />)
    expect(screen.getByRole('switch')).toBeInTheDocument()
  })

  it('renders label when provided', () => {
    wrap(<BrutalToggle label="Dark Mode" />)
    expect(screen.getByText('Dark Mode')).toBeInTheDocument()
  })

  it('sets aria-checked attribute correctly', () => {
    wrap(<BrutalToggle checked={true} />)
    expect(screen.getByRole('switch')).toHaveAttribute('aria-checked', 'true')
  })

  it('disables when disabled is true', () => {
    wrap(<BrutalToggle disabled />)
    expect(screen.getByRole('switch')).toBeDisabled()
  })

  it('calls onChange with new state', async () => {
    
    const handleChange = vi.fn()
    wrap(<BrutalToggle onChange={handleChange} />)
    fireEvent.click(screen.getByRole('switch'))
    expect(handleChange).toHaveBeenCalledWith(true)
  })

  it('does not toggle when disabled', async () => {
    
    const handleChange = vi.fn()
    wrap(<BrutalToggle onChange={handleChange} disabled />)
    fireEvent.click(screen.getByRole('switch'))
    expect(handleChange).not.toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════
// SLIDER
// ════════════════════════════════════════════════════

describe('BrutalSlider', () => {
  it('renders slider with default value', () => {
    const { container } = wrap(<BrutalSlider value={50} />)
    expect(container.querySelector('.brutal-slider-track')).toBeInTheDocument()
  })

  it('displays label when provided', () => {
    wrap(<BrutalSlider value={50} label="Volume" />)
    expect(screen.getByText(/Volume/)).toBeInTheDocument()
  })

  it('displays current value in label', () => {
    wrap(<BrutalSlider value={75} label="Volume" />)
    expect(screen.getByText('75')).toBeInTheDocument()
  })

  it('calls onChange on pointer movement', () => {
    const handleChange = vi.fn()
    const { container } = wrap(<BrutalSlider value={50} onChange={handleChange} min={0} max={100} />)
    const track = container.querySelector('.brutal-slider-track') as HTMLElement
    fireEvent.pointerDown(track, { clientX: 50 })
    expect(handleChange).toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════
// TABS
// ════════════════════════════════════════════════════

describe('BrutalTabs', () => {
  const tabs = [
    { id: 'tab1', label: 'Tab 1', content: 'Content 1' },
    { id: 'tab2', label: 'Tab 2', content: 'Content 2' },
  ]

  it('renders all tab labels', () => {
    wrap(<BrutalTabs tabs={tabs} />)
    expect(screen.getByText('Tab 1')).toBeInTheDocument()
    expect(screen.getByText('Tab 2')).toBeInTheDocument()
  })

  it('displays content of active tab', () => {
    wrap(<BrutalTabs tabs={tabs} />)
    expect(screen.getByText('Content 1')).toBeInTheDocument()
  })

  it('switches content on tab click', async () => {
    
    wrap(<BrutalTabs tabs={tabs} />)
    fireEvent.click(screen.getByText('Tab 2'))
    expect(screen.getByText('Content 2')).toBeInTheDocument()
  })

  it('sets default tab when provided', () => {
    wrap(<BrutalTabs tabs={tabs} defaultTab="tab2" />)
    expect(screen.getByText('Content 2')).toBeInTheDocument()
  })

  it('marks active tab with data-active attribute', async () => {
    
    const { container } = wrap(<BrutalTabs tabs={tabs} />)
    let buttons = container.querySelectorAll('[data-active="true"]')
    expect(buttons).toHaveLength(1)
    fireEvent.click(screen.getByText('Tab 2'))
    buttons = container.querySelectorAll('[data-active="true"]')
    expect(buttons).toHaveLength(1)
  })
})

// ════════════════════════════════════════════════════
// ACCORDION
// ════════════════════════════════════════════════════

describe('BrutalAccordion', () => {
  const items = [
    { id: 'item1', title: 'Item 1', content: 'Content 1' },
    { id: 'item2', title: 'Item 2', content: 'Content 2' },
  ]

  it('renders all item titles', () => {
    wrap(<BrutalAccordion items={items} />)
    expect(screen.getByText('Item 1')).toBeInTheDocument()
    expect(screen.getByText('Item 2')).toBeInTheDocument()
  })

  it('does not show content initially', () => {
    wrap(<BrutalAccordion items={items} />)
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
  })

  it('shows content when item is clicked', async () => {
    
    wrap(<BrutalAccordion items={items} />)
    fireEvent.click(screen.getByText('Item 1'))
    expect(screen.getByText('Content 1')).toBeInTheDocument()
  })

  it('hides content when item is clicked again', async () => {
    
    wrap(<BrutalAccordion items={items} />)
    fireEvent.click(screen.getByText('Item 1'))
    fireEvent.click(screen.getByText('Item 1'))
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
  })

  it('allows multiple items open when multiple is true', async () => {
    
    wrap(<BrutalAccordion items={items} multiple={true} />)
    fireEvent.click(screen.getByText('Item 1'))
    fireEvent.click(screen.getByText('Item 2'))
    expect(screen.getByText('Content 1')).toBeInTheDocument()
    expect(screen.getByText('Content 2')).toBeInTheDocument()
  })

  it('closes other items when multiple is false', async () => {
    
    wrap(<BrutalAccordion items={items} multiple={false} />)
    fireEvent.click(screen.getByText('Item 1'))
    fireEvent.click(screen.getByText('Item 2'))
    expect(screen.queryByText('Content 1')).not.toBeInTheDocument()
    expect(screen.getByText('Content 2')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// ALERT
// ════════════════════════════════════════════════════

describe('BrutalAlert', () => {
  it('renders children content', () => {
    wrap(<BrutalAlert>Alert message</BrutalAlert>)
    expect(screen.getByText('Alert message')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    wrap(<BrutalAlert title="Warning">Content</BrutalAlert>)
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })

  it('applies info variant by default', () => {
    const { container } = wrap(<BrutalAlert>Content</BrutalAlert>)
    expect(container.querySelector('.brutal-alert-info')).toBeInTheDocument()
  })

  it('applies success variant', () => {
    const { container } = wrap(<BrutalAlert variant="success">Content</BrutalAlert>)
    expect(container.querySelector('.brutal-alert-success')).toBeInTheDocument()
  })

  it('applies warning variant', () => {
    const { container } = wrap(<BrutalAlert variant="warning">Content</BrutalAlert>)
    expect(container.querySelector('.brutal-alert-warning')).toBeInTheDocument()
  })

  it('applies danger variant', () => {
    const { container } = wrap(<BrutalAlert variant="danger">Content</BrutalAlert>)
    expect(container.querySelector('.brutal-alert-danger')).toBeInTheDocument()
  })

  it('renders dismiss button when onDismiss provided', () => {
    wrap(<BrutalAlert onDismiss={() => {}}>Content</BrutalAlert>)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('calls onDismiss when dismiss button clicked', async () => {
    
    const handleDismiss = vi.fn()
    wrap(<BrutalAlert onDismiss={handleDismiss}>Content</BrutalAlert>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleDismiss).toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════
// CALLOUT
// ════════════════════════════════════════════════════

describe('BrutalCallout', () => {
  it('renders children', () => {
    wrap(<BrutalCallout>Message</BrutalCallout>)
    expect(screen.getByText('Message')).toBeInTheDocument()
  })

  it('applies info variant by default', () => {
    const { container } = wrap(<BrutalCallout>Message</BrutalCallout>)
    expect(container.querySelector('.brutal-callout-info')).toBeInTheDocument()
  })

  it('applies success variant', () => {
    const { container } = wrap(<BrutalCallout variant="success">Message</BrutalCallout>)
    expect(container.querySelector('.brutal-callout-success')).toBeInTheDocument()
  })

  it('applies warning variant', () => {
    const { container } = wrap(<BrutalCallout variant="warning">Message</BrutalCallout>)
    expect(container.querySelector('.brutal-callout-warning')).toBeInTheDocument()
  })

  it('applies danger variant', () => {
    const { container } = wrap(<BrutalCallout variant="danger">Message</BrutalCallout>)
    expect(container.querySelector('.brutal-callout-danger')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalCallout className="custom">Message</BrutalCallout>)
    expect(container.querySelector('.brutal-callout-info')).toHaveClass('custom')
  })
})

// ════════════════════════════════════════════════════
// DIALOG
// ════════════════════════════════════════════════════

describe('BrutalDialog', () => {
  it('does not render when open is false', () => {
    const { container } = wrap(<BrutalDialog open={false} onClose={() => {}}>Content</BrutalDialog>)
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
  })

  it('renders when open is true', () => {
    wrap(<BrutalDialog open={true} onClose={() => {}}>Content</BrutalDialog>)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders content', () => {
    wrap(<BrutalDialog open={true} onClose={() => {}}>Content</BrutalDialog>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    wrap(<BrutalDialog open={true} onClose={() => {}} title="Dialog Title">Content</BrutalDialog>)
    expect(screen.getByText('Dialog Title')).toBeInTheDocument()
  })

  it('renders footer when provided', () => {
    wrap(<BrutalDialog open={true} onClose={() => {}} footer={<div>Footer</div>}>Content</BrutalDialog>)
    expect(screen.getByText('Footer')).toBeInTheDocument()
  })

  it('calls onClose when overlay clicked', async () => {
    
    const handleClose = vi.fn()
    const { container } = wrap(<BrutalDialog open={true} onClose={handleClose}>Content</BrutalDialog>)
    fireEvent.click(container.querySelector('.brutal-overlay')!)
    expect(handleClose).toHaveBeenCalled()
  })

  it('calls onClose when close button clicked', async () => {
    
    const handleClose = vi.fn()
    wrap(<BrutalDialog open={true} onClose={handleClose} title="Title">Content</BrutalDialog>)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClose).toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════
// CONFIRM DIALOG
// ════════════════════════════════════════════════════

describe('BrutalConfirmDialog', () => {
  it('does not render when open is false', () => {
    const { container } = wrap(
      <BrutalConfirmDialog open={false} onClose={() => {}} onConfirm={() => {}} message="Confirm?" />
    )
    expect(container.querySelector('[role="dialog"]')).not.toBeInTheDocument()
  })

  it('renders when open is true', () => {
    wrap(<BrutalConfirmDialog open={true} onClose={() => {}} onConfirm={() => {}} message="Confirm?" />)
    expect(screen.getByRole('dialog')).toBeInTheDocument()
  })

  it('renders message', () => {
    wrap(<BrutalConfirmDialog open={true} onClose={() => {}} onConfirm={() => {}} message="Delete item?" />)
    expect(screen.getByText('Delete item?')).toBeInTheDocument()
  })

  it('renders confirm and cancel buttons', () => {
    wrap(<BrutalConfirmDialog open={true} onClose={() => {}} onConfirm={() => {}} message="Confirm?" confirmLabel="Yes" cancelLabel="No" />)
    expect(screen.getByRole('button', { name: /Yes/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /No/i })).toBeInTheDocument()
  })

  it('calls onConfirm and onClose when confirm clicked', async () => {
    
    const handleConfirm = vi.fn()
    const handleClose = vi.fn()
    wrap(<BrutalConfirmDialog open={true} onClose={handleClose} onConfirm={handleConfirm} message="Confirm?" confirmLabel="Yes" />)
    fireEvent.click(screen.getByRole('button', { name: /Yes/i }))
    expect(handleConfirm).toHaveBeenCalled()
    expect(handleClose).toHaveBeenCalled()
  })

  it('calls onClose when cancel clicked', async () => {
    
    const handleClose = vi.fn()
    wrap(<BrutalConfirmDialog open={true} onClose={handleClose} onConfirm={() => {}} message="Confirm?" cancelLabel="No" />)
    fireEvent.click(screen.getByRole('button', { name: /No/i }))
    expect(handleClose).toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════
// DRAWER
// ════════════════════════════════════════════════════

describe('BrutalDrawer', () => {
  it('does not render when open is false', () => {
    const { container } = wrap(<BrutalDrawer open={false} onClose={() => {}}>Content</BrutalDrawer>)
    expect(container.querySelector('.brutal-drawer')).not.toBeInTheDocument()
    expect(container.querySelector('.brutal-drawer-side')).not.toBeInTheDocument()
  })

  it('renders when open is true', () => {
    const { container } = wrap(<BrutalDrawer open={true} onClose={() => {}}>Content</BrutalDrawer>)
    expect(container.querySelector('.brutal-drawer-side')).toBeInTheDocument()
  })

  it('renders right side drawer by default', () => {
    const { container } = wrap(<BrutalDrawer open={true} onClose={() => {}}>Content</BrutalDrawer>)
    expect(container.querySelector('.brutal-drawer-side')).toBeInTheDocument()
  })

  it('renders bottom drawer when side is bottom', () => {
    const { container } = wrap(<BrutalDrawer open={true} onClose={() => {}} side="bottom">Content</BrutalDrawer>)
    expect(container.querySelector('.brutal-drawer')).toBeInTheDocument()
  })

  it('renders content', () => {
    wrap(<BrutalDrawer open={true} onClose={() => {}}>Content</BrutalDrawer>)
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    wrap(<BrutalDrawer open={true} onClose={() => {}} title="Drawer Title">Content</BrutalDrawer>)
    expect(screen.getByText('Drawer Title')).toBeInTheDocument()
  })

  it('calls onClose when overlay clicked', async () => {
    
    const handleClose = vi.fn()
    const { container } = wrap(<BrutalDrawer open={true} onClose={handleClose}>Content</BrutalDrawer>)
    fireEvent.click(container.querySelector('.brutal-overlay')!)
    expect(handleClose).toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════
// TOOLTIP
// ════════════════════════════════════════════════════

describe('BrutalTooltip', () => {
  it('renders children', () => {
    wrap(<BrutalTooltip content="Tooltip">Hover me</BrutalTooltip>)
    expect(screen.getByText('Hover me')).toBeInTheDocument()
  })

  it('does not show tooltip initially', () => {
    wrap(<BrutalTooltip content="Tooltip">Hover me</BrutalTooltip>)
    expect(screen.queryByText('Tooltip')).not.toBeInTheDocument()
  })

  it('shows tooltip on mouseenter', async () => {
    
    wrap(<BrutalTooltip content="Tooltip">Hover me</BrutalTooltip>)
    fireEvent.mouseEnter(screen.getByText('Hover me'))
    expect(screen.getByText('Tooltip')).toBeInTheDocument()
  })

  it('hides tooltip on mouseleave', async () => {
    
    wrap(<BrutalTooltip content="Tooltip">Hover me</BrutalTooltip>)
    fireEvent.mouseEnter(screen.getByText('Hover me'))
    fireEvent.mouseLeave(screen.getByText('Hover me'))
    expect(screen.queryByText('Tooltip')).not.toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// POPOVER
// ════════════════════════════════════════════════════

describe('BrutalPopover', () => {
  it('renders trigger', () => {
    wrap(<BrutalPopover trigger={<button>Open</button>}>Content</BrutalPopover>)
    expect(screen.getByRole('button', { name: /Open/i })).toBeInTheDocument()
  })

  it('does not show content initially', () => {
    wrap(<BrutalPopover trigger={<button>Open</button>}>Content</BrutalPopover>)
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('shows content when trigger clicked', async () => {
    
    wrap(<BrutalPopover trigger={<button>Open</button>}>Content</BrutalPopover>)
    fireEvent.click(screen.getByRole('button'))
    expect(screen.getByText('Content')).toBeInTheDocument()
  })

  it('hides content when trigger clicked again', async () => {
    
    wrap(<BrutalPopover trigger={<button>Open</button>}>Content</BrutalPopover>)
    fireEvent.click(screen.getByRole('button'))
    fireEvent.click(screen.getByRole('button'))
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })

  it('closes when clicking outside', () => {
    wrap(
      <div>
        <BrutalPopover trigger={<button>Open</button>}>Content</BrutalPopover>
        <button>Outside</button>
      </div>
    )
    fireEvent.click(screen.getByRole('button', { name: /Open/i }))
    expect(screen.getByText('Content')).toBeInTheDocument()
    // Simulate click outside using mousedown on body
    fireEvent.mouseDown(document.body)
    expect(screen.queryByText('Content')).not.toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// DROPDOWN MENU
// ════════════════════════════════════════════════════

describe('BrutalDropdownMenu', () => {
  const items = [
    { label: 'Edit', onClick: vi.fn() },
    { label: 'Delete', onClick: vi.fn(), danger: true },
  ]

  it('renders trigger', () => {
    wrap(<BrutalDropdownMenu trigger={<button>Menu</button>} items={items} />)
    expect(screen.getByRole('button', { name: /Menu/i })).toBeInTheDocument()
  })

  it('does not show items initially', () => {
    wrap(<BrutalDropdownMenu trigger={<button>Menu</button>} items={items} />)
    expect(screen.queryByText('Edit')).not.toBeInTheDocument()
  })

  it('shows items when trigger clicked', async () => {
    
    wrap(<BrutalDropdownMenu trigger={<button>Menu</button>} items={items} />)
    fireEvent.click(screen.getByRole('button', { name: /Menu/i }))
    expect(screen.getByText('Edit')).toBeInTheDocument()
    expect(screen.getByText('Delete')).toBeInTheDocument()
  })

  it('calls item onClick when clicked', async () => {
    
    const onClick = vi.fn()
    wrap(<BrutalDropdownMenu trigger={<button>Menu</button>} items={[{ label: 'Action', onClick }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Menu/i }))
    fireEvent.click(screen.getByText('Action'))
    expect(onClick).toHaveBeenCalled()
  })

  it('closes after item click', async () => {
    
    wrap(<BrutalDropdownMenu trigger={<button>Menu</button>} items={items} />)
    fireEvent.click(screen.getByRole('button', { name: /Menu/i }))
    fireEvent.click(screen.getByText('Edit'))
    expect(screen.queryByText('Delete')).not.toBeInTheDocument()
  })

  it('renders separator', async () => {
    
    const { container } = wrap(
      <BrutalDropdownMenu trigger={<button>Menu</button>} items={['separator']} />
    )
    fireEvent.click(screen.getByRole('button', { name: /Menu/i }))
    expect(container.querySelector('.brutal-dropdown-separator')).toBeInTheDocument()
  })

  it('renders label item', async () => {
    
    wrap(<BrutalDropdownMenu trigger={<button>Menu</button>} items={[{ type: 'label', text: 'Actions' }]} />)
    fireEvent.click(screen.getByRole('button', { name: /Menu/i }))
    expect(screen.getByText('Actions')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// TABLE
// ════════════════════════════════════════════════════

describe('BrutalTable', () => {
  const columns = [
    { key: 'name', header: 'Name' },
    { key: 'age', header: 'Age' },
  ]
  const data = [
    { name: 'John', age: 30 },
    { name: 'Jane', age: 25 },
  ]

  it('renders table', () => {
    wrap(<BrutalTable columns={columns} data={data} />)
    expect(screen.getByRole('table')).toBeInTheDocument()
  })

  it('renders headers', () => {
    wrap(<BrutalTable columns={columns} data={data} />)
    expect(screen.getByText('Name')).toBeInTheDocument()
    expect(screen.getByText('Age')).toBeInTheDocument()
  })

  it('renders data rows', () => {
    wrap(<BrutalTable columns={columns} data={data} />)
    expect(screen.getByText('John')).toBeInTheDocument()
    expect(screen.getByText('Jane')).toBeInTheDocument()
  })

  it('calls onRowClick when row clicked', async () => {
    
    const handleRowClick = vi.fn()
    const { container } = wrap(<BrutalTable columns={columns} data={data} onRowClick={handleRowClick} />)
    const rows = container.querySelectorAll('tbody tr')
    fireEvent.click(rows[0])
    expect(handleRowClick).toHaveBeenCalledWith(data[0])
  })

  it('applies striped variant', () => {
    const { container } = wrap(<BrutalTable columns={columns} data={data} variant="striped" />)
    expect(container.querySelector('.brutal-table-striped')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// PROGRESS
// ════════════════════════════════════════════════════

describe('BrutalProgress', () => {
  it('renders progress bar', () => {
    const { container } = wrap(<BrutalProgress value={50} max={100} />)
    expect(container.querySelector('.brutal-progress')).toBeInTheDocument()
  })

  it('calculates correct width', () => {
    const { container } = wrap(<BrutalProgress value={50} max={100} />)
    const bar = container.querySelector('.brutal-progress-bar') as HTMLElement
    expect(bar.style.width).toBe('50%')
  })

  it('renders label when provided', () => {
    wrap(<BrutalProgress value={50} max={100} label="Progress" />)
    expect(screen.getByText('Progress')).toBeInTheDocument()
  })

  it('displays percentage in label', () => {
    wrap(<BrutalProgress value={75} max={100} label="Progress" />)
    expect(screen.getByText('75%')).toBeInTheDocument()
  })

  it('applies variant class', () => {
    const { container } = wrap(<BrutalProgress value={50} max={100} variant="success" />)
    expect(container.querySelector('.bg-success')).toBeInTheDocument()
  })

  it('applies striped class when striped is true', () => {
    const { container } = wrap(<BrutalProgress value={50} max={100} striped />)
    expect(container.querySelector('.brutal-progress-striped')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// SKELETON
// ════════════════════════════════════════════════════

describe('BrutalSkeleton', () => {
  it('renders rect skeleton by default', () => {
    const { container } = wrap(<BrutalSkeleton />)
    expect(container.querySelector('.brutal-skeleton')).toBeInTheDocument()
  })

  it('renders text skeleton', () => {
    const { container } = wrap(<BrutalSkeleton variant="text" />)
    expect(container.querySelector('.brutal-skeleton-text')).toBeInTheDocument()
  })

  it('renders circle skeleton', () => {
    const { container } = wrap(<BrutalSkeleton variant="circle" />)
    expect(container.querySelector('.brutal-skeleton-circle')).toBeInTheDocument()
  })

  it('applies width and height styles', () => {
    const { container } = wrap(<BrutalSkeleton width={100} height={50} />)
    const skeleton = container.querySelector('.brutal-skeleton') as HTMLElement
    expect(skeleton.style.width).toBe('100px')
    expect(skeleton.style.height).toBe('50px')
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalSkeleton className="custom" />)
    expect(container.querySelector('.brutal-skeleton')).toHaveClass('custom')
  })
})

// ════════════════════════════════════════════════════
// AVATAR
// ════════════════════════════════════════════════════

describe('BrutalAvatar', () => {
  it('renders image when src provided', () => {
    wrap(<BrutalAvatar src="/avatar.png" alt="User" />)
    expect(screen.getByAltText('User')).toBeInTheDocument()
  })

  it('renders initials when src not provided', () => {
    wrap(<BrutalAvatar initials="AB" />)
    expect(screen.getByText('AB')).toBeInTheDocument()
  })

  it('applies size class', () => {
    const { container } = wrap(<BrutalAvatar initials="AB" size="lg" />)
    expect(container.querySelector('.brutal-avatar-lg')).toBeInTheDocument()
  })

  it('applies square class when square is true', () => {
    const { container } = wrap(<BrutalAvatar initials="AB" square />)
    expect(container.querySelector('.brutal-avatar-square')).toBeInTheDocument()
  })

  it('applies circular class by default', () => {
    const { container } = wrap(<BrutalAvatar initials="AB" />)
    expect(container.querySelector('.brutal-avatar')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// TAG
// ════════════════════════════════════════════════════

describe('BrutalTag', () => {
  it('renders children', () => {
    wrap(<BrutalTag>Tag</BrutalTag>)
    expect(screen.getByText('Tag')).toBeInTheDocument()
  })

  it('applies default tag class when not removable', () => {
    const { container } = wrap(<BrutalTag>Tag</BrutalTag>)
    expect(container.querySelector('.brutal-tag')).toBeInTheDocument()
  })

  it('applies removable tag class when onRemove provided', () => {
    const { container } = wrap(<BrutalTag onRemove={() => {}}>Tag</BrutalTag>)
    expect(container.querySelector('.brutal-tag-removable')).toBeInTheDocument()
  })

  it('shows remove icon when onRemove provided', () => {
    const { container } = wrap(<BrutalTag onRemove={() => {}}>Tag</BrutalTag>)
    expect(container.querySelector('svg')).toBeInTheDocument()
  })

  it('calls onRemove when clicked', () => {
    const handleRemove = vi.fn()
    const { container } = wrap(<BrutalTag onRemove={handleRemove}>Tag</BrutalTag>)
    const tag = container.querySelector('.brutal-tag-removable')
    fireEvent.click(tag!)
    expect(handleRemove).toHaveBeenCalled()
  })

  it('applies variant class', () => {
    const { container } = wrap(<BrutalTag variant="success">Tag</BrutalTag>)
    expect(container.querySelector('.brutal-tag')).toHaveClass('bg-success/15', 'text-success')
  })
})

// ════════════════════════════════════════════════════
// EMPTY STATE
// ════════════════════════════════════════════════════

describe('BrutalEmptyState', () => {
  it('renders title', () => {
    wrap(<BrutalEmptyState title="No data" />)
    expect(screen.getByText('No data')).toBeInTheDocument()
  })

  it('renders description when provided', () => {
    wrap(<BrutalEmptyState title="No data" description="Try again later" />)
    expect(screen.getByText('Try again later')).toBeInTheDocument()
  })

  it('renders icon when provided', () => {
    wrap(<BrutalEmptyState title="No data" icon={<span>icon</span>} />)
    expect(screen.getByText('icon')).toBeInTheDocument()
  })

  it('renders action when provided', () => {
    wrap(<BrutalEmptyState title="No data" action={<button>Retry</button>} />)
    expect(screen.getByRole('button', { name: /Retry/i })).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// DIVIDER
// ════════════════════════════════════════════════════

describe('BrutalDivider', () => {
  it('renders default divider', () => {
    const { container } = wrap(<BrutalDivider />)
    expect(container.querySelector('.brutal-divider')).toBeInTheDocument()
  })

  it('renders light divider', () => {
    const { container } = wrap(<BrutalDivider variant="light" />)
    expect(container.querySelector('.brutal-divider-light')).toBeInTheDocument()
  })

  it('renders vertical divider', () => {
    const { container } = wrap(<BrutalDivider variant="vertical" />)
    expect(container.querySelector('.brutal-divider-vertical')).toBeInTheDocument()
  })

  it('renders divider with label', () => {
    wrap(<BrutalDivider label="OR" />)
    expect(screen.getByText('OR')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// BREADCRUMB
// ════════════════════════════════════════════════════

describe('BrutalBreadcrumb', () => {
  const items = [
    { label: 'Home' },
    { label: 'Products' },
    { label: 'Current' },
  ]

  it('renders all breadcrumb items', () => {
    wrap(<BrutalBreadcrumb items={items} />)
    expect(screen.getByText('Home')).toBeInTheDocument()
    expect(screen.getByText('Products')).toBeInTheDocument()
    expect(screen.getByText('Current')).toBeInTheDocument()
  })

  it('marks last item as active', () => {
    const { container } = wrap(<BrutalBreadcrumb items={items} />)
    const activeItems = container.querySelectorAll('.brutal-breadcrumb-active')
    expect(activeItems).toHaveLength(1)
    expect(activeItems[0]).toHaveTextContent('Current')
  })

  it('calls onClick for breadcrumb items', async () => {
    
    const onClick = vi.fn()
    wrap(<BrutalBreadcrumb items={[{ label: 'Home', onClick }, { label: 'Current' }]} />)
    fireEvent.click(screen.getByText('Home'))
    expect(onClick).toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════
// KBD
// ════════════════════════════════════════════════════

describe('BrutalKbd', () => {
  it('renders children in kbd tag', () => {
    wrap(<BrutalKbd>Ctrl+S</BrutalKbd>)
    expect(screen.getByText('Ctrl+S')).toBeInTheDocument()
  })

  it('applies kbd class', () => {
    const { container } = wrap(<BrutalKbd>Ctrl+S</BrutalKbd>)
    expect(container.querySelector('.brutal-kbd')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// CODE
// ════════════════════════════════════════════════════

describe('BrutalCode', () => {
  it('renders inline code', () => {
    const { container } = wrap(<BrutalCode inline>const x = 1</BrutalCode>)
    expect(container.querySelector('.brutal-code-inline')).toBeInTheDocument()
  })

  it('renders code block when inline is false', () => {
    const { container } = wrap(<BrutalCode>const x = 1</BrutalCode>)
    expect(container.querySelector('.brutal-code')).toBeInTheDocument()
  })

  it('renders code content', () => {
    wrap(<BrutalCode>console.log()</BrutalCode>)
    expect(screen.getByText('console.log()')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// PAGINATION
// ════════════════════════════════════════════════════

describe('BrutalPagination', () => {
  it('renders pagination controls', () => {
    wrap(<BrutalPagination current={1} total={3} onChange={() => {}} />)
    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.getByText('3')).toBeInTheDocument()
  })

  it('disables prev button on first page', () => {
    const { container } = wrap(<BrutalPagination current={1} total={3} onChange={() => {}} />)
    const prevBtn = container.querySelector('button:first-of-type') as HTMLButtonElement
    expect(prevBtn).toBeDisabled()
  })

  it('disables next button on last page', () => {
    const { container } = wrap(<BrutalPagination current={3} total={3} onChange={() => {}} />)
    const nextBtn = container.querySelector('button:last-of-type') as HTMLButtonElement
    expect(nextBtn).toBeDisabled()
  })

  it('calls onChange when page clicked', async () => {
    
    const handleChange = vi.fn()
    wrap(<BrutalPagination current={1} total={3} onChange={handleChange} />)
    fireEvent.click(screen.getByText('2'))
    expect(handleChange).toHaveBeenCalledWith(2)
  })

  it('marks current page as active', () => {
    const { container } = wrap(<BrutalPagination current={2} total={3} onChange={() => {}} />)
    const activeButtons = container.querySelectorAll('[data-active="true"]')
    expect(activeButtons).toHaveLength(1)
    expect(activeButtons[0]).toHaveTextContent('2')
  })
})

// ════════════════════════════════════════════════════
// LIST
// ════════════════════════════════════════════════════

describe('BrutalList', () => {
  it('renders children', () => {
    wrap(<BrutalList><div>Item 1</div></BrutalList>)
    expect(screen.getByText('Item 1')).toBeInTheDocument()
  })

  it('applies list class', () => {
    const { container } = wrap(<BrutalList><div>Item</div></BrutalList>)
    expect(container.querySelector('.brutal-list')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalList className="custom"><div>Item</div></BrutalList>)
    expect(container.querySelector('.brutal-list')).toHaveClass('custom')
  })
})

describe('BrutalListItem', () => {
  it('renders children', () => {
    wrap(<BrutalListItem>Item</BrutalListItem>)
    expect(screen.getByText('Item')).toBeInTheDocument()
  })

  it('applies list-item class when not interactive', () => {
    const { container } = wrap(<BrutalListItem>Item</BrutalListItem>)
    expect(container.querySelector('.brutal-list-item')).toBeInTheDocument()
  })

  it('applies interactive class when onClick provided', () => {
    const { container } = wrap(<BrutalListItem onClick={() => {}}>Item</BrutalListItem>)
    expect(container.querySelector('.brutal-list-item-interactive')).toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    
    const handleClick = vi.fn()
    wrap(<BrutalListItem onClick={handleClick}>Item</BrutalListItem>)
    fireEvent.click(screen.getByText('Item'))
    expect(handleClick).toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════
// TOOLBAR
// ════════════════════════════════════════════════════

describe('BrutalToolbar', () => {
  const items = [
    { id: '1', label: 'Bold', active: false, onClick: vi.fn() },
    { id: '2', label: 'Italic', active: true, onClick: vi.fn() },
  ]

  it('renders all toolbar items', () => {
    wrap(<BrutalToolbar items={items} />)
    expect(screen.getByText('Bold')).toBeInTheDocument()
    expect(screen.getByText('Italic')).toBeInTheDocument()
  })

  it('marks active item', () => {
    const { container } = wrap(<BrutalToolbar items={items} />)
    const activeItems = container.querySelectorAll('[data-active="true"]')
    expect(activeItems).toHaveLength(1)
    expect(activeItems[0]).toHaveTextContent('Italic')
  })

  it('calls onClick when item clicked', async () => {
    
    const onClick = vi.fn()
    wrap(<BrutalToolbar items={[{ id: '1', label: 'Bold', onClick }]} />)
    fireEvent.click(screen.getByText('Bold'))
    expect(onClick).toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════
// STEPPER
// ════════════════════════════════════════════════════

describe('BrutalStepper', () => {
  const steps = ['Step 1', 'Step 2', 'Step 3']

  it('renders all steps', () => {
    wrap(<BrutalStepper steps={steps} currentStep={0} />)
    expect(screen.getByText('Step 1')).toBeInTheDocument()
    expect(screen.getByText('Step 2')).toBeInTheDocument()
    expect(screen.getByText('Step 3')).toBeInTheDocument()
  })

  it('marks current step as active', () => {
    const { container } = wrap(<BrutalStepper steps={steps} currentStep={1} />)
    const activeSteps = container.querySelectorAll('.brutal-step-active')
    expect(activeSteps).toHaveLength(1)
  })

  it('marks completed steps', () => {
    const { container } = wrap(<BrutalStepper steps={steps} currentStep={2} />)
    const doneSteps = container.querySelectorAll('.brutal-step-done')
    expect(doneSteps).toHaveLength(2)
  })

  it('displays checkmark for completed steps', () => {
    const { container } = wrap(<BrutalStepper steps={steps} currentStep={2} />)
    const doneSteps = container.querySelectorAll('.brutal-step-done')
    expect(doneSteps[0]).toHaveTextContent('✓')
  })
})

// ════════════════════════════════════════════════════
// DOT
// ════════════════════════════════════════════════════

describe('BrutalDot', () => {
  it('renders default dot', () => {
    const { container } = wrap(<BrutalDot />)
    expect(container.querySelector('.brutal-dot')).toBeInTheDocument()
  })

  it('applies active variant', () => {
    const { container } = wrap(<BrutalDot variant="active" />)
    expect(container.querySelector('.brutal-dot-active')).toBeInTheDocument()
  })

  it('applies success variant', () => {
    const { container } = wrap(<BrutalDot variant="success" />)
    expect(container.querySelector('.brutal-dot-success')).toBeInTheDocument()
  })

  it('applies danger variant', () => {
    const { container } = wrap(<BrutalDot variant="danger" />)
    expect(container.querySelector('.brutal-dot-danger')).toBeInTheDocument()
  })

  it('applies warning variant', () => {
    const { container } = wrap(<BrutalDot variant="warning" />)
    expect(container.querySelector('.brutal-dot-warning')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// SPINNER
// ════════════════════════════════════════════════════

describe('BrutalSpinner', () => {
  it('renders spinner', () => {
    const { container } = wrap(<BrutalSpinner />)
    expect(container.querySelector('.brutal-spinner')).toBeInTheDocument()
  })

  it('applies sm size', () => {
    const { container } = wrap(<BrutalSpinner size="sm" />)
    expect(container.querySelector('.brutal-spinner-sm')).toBeInTheDocument()
  })

  it('applies lg size', () => {
    const { container } = wrap(<BrutalSpinner size="lg" />)
    expect(container.querySelector('.brutal-spinner-lg')).toBeInTheDocument()
  })
})

// ════════════════════════════════════════════════════
// TOAST
// ════════════════════════════════════════════════════

describe('BrutalToast', () => {
  it('renders message', () => {
    wrap(<BrutalToast message="Success" />)
    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('renders title when provided', () => {
    wrap(<BrutalToast title="Success" message="Operation completed" />)
    expect(screen.getByText('Success')).toBeInTheDocument()
  })

  it('applies variant class', () => {
    const { container } = wrap(<BrutalToast variant="success" message="Success" />)
    expect(container.querySelector('.brutal-toast')).toBeInTheDocument()
  })

  it('renders close button when onClose provided', () => {
    wrap(<BrutalToast message="Success" onClose={() => {}} />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })

  it('calls onClose when close button clicked', async () => {
    
    const handleClose = vi.fn()
    wrap(<BrutalToast message="Success" onClose={handleClose} />)
    fireEvent.click(screen.getByRole('button'))
    expect(handleClose).toHaveBeenCalled()
  })
})

// ════════════════════════════════════════════════════
// MARQUEE
// ════════════════════════════════════════════════════

describe('BrutalMarquee', () => {
  it('renders children', () => {
    const { container } = wrap(<BrutalMarquee>Scrolling text</BrutalMarquee>)
    expect(container.textContent).toContain('Scrolling text')
  })

  it('applies marquee class', () => {
    const { container } = wrap(<BrutalMarquee>Scrolling text</BrutalMarquee>)
    expect(container.querySelector('.brutal-marquee')).toBeInTheDocument()
  })

  it('applies custom className', () => {
    const { container } = wrap(<BrutalMarquee className="custom">Scrolling text</BrutalMarquee>)
    expect(container.querySelector('.brutal-marquee')).toHaveClass('custom')
  })

  it('duplicates children for continuous scroll', () => {
    const { container } = wrap(<BrutalMarquee><span>Text</span></BrutalMarquee>)
    const elements = container.querySelectorAll('span')
    expect(elements).toHaveLength(2)
  })
})

// ════════════════════════════════════════════════════
// FIELD GROUP
// ════════════════════════════════════════════════════

describe('BrutalFieldGroup', () => {
  it('renders label', () => {
    wrap(<BrutalFieldGroup label="Name"><input /></BrutalFieldGroup>)
    expect(screen.getByText('Name')).toBeInTheDocument()
  })

  it('renders children', () => {
    wrap(<BrutalFieldGroup label="Name"><input placeholder="Name" /></BrutalFieldGroup>)
    expect(screen.getByPlaceholderText('Name')).toBeInTheDocument()
  })

  it('displays required asterisk when required is true', () => {
    wrap(<BrutalFieldGroup label="Name" required><input /></BrutalFieldGroup>)
    expect(screen.getByText('*')).toBeInTheDocument()
  })

  it('renders hint when provided and no error', () => {
    wrap(<BrutalFieldGroup label="Name" hint="Enter full name"><input /></BrutalFieldGroup>)
    expect(screen.getByText('Enter full name')).toBeInTheDocument()
  })

  it('renders error message when provided', () => {
    wrap(<BrutalFieldGroup label="Name" error="Required"><input /></BrutalFieldGroup>)
    expect(screen.getByText('Required')).toBeInTheDocument()
  })

  it('hides hint when error exists', () => {
    wrap(<BrutalFieldGroup label="Name" hint="Hint" error="Error"><input /></BrutalFieldGroup>)
    expect(screen.queryByText('Hint')).not.toBeInTheDocument()
    expect(screen.getByText('Error')).toBeInTheDocument()
  })
})
