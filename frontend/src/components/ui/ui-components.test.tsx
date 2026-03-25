import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import * as React from 'react'

// Simple components
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Badge } from '@/components/ui/badge'
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card'
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableCaption,
  TableFooter,
} from '@/components/ui/table'
import { Skeleton } from '@/components/ui/skeleton'
import { Separator } from '@/components/ui/separator'
import { Progress } from '@/components/ui/progress'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion'
import { Switch } from '@/components/ui/switch'
import { Checkbox } from '@/components/ui/checkbox'
import { Slider } from '@/components/ui/slider'
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert'
import { Tooltip, TooltipTrigger, TooltipContent, TooltipProvider } from '@/components/ui/tooltip'
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Popover, PopoverTrigger, PopoverContent } from '@/components/ui/popover'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
} from '@/components/ui/dropdown-menu'
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationPrevious,
  PaginationNext,
} from '@/components/ui/pagination'
import {
  Breadcrumb,
  BreadcrumbList,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbSeparator,
} from '@/components/ui/breadcrumb'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet'
import { HoverCard, HoverCardTrigger, HoverCardContent } from '@/components/ui/hover-card'
import { Toggle } from '@/components/ui/toggle'
import { ToggleGroup, ToggleGroupItem } from '@/components/ui/toggle-group'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import { AspectRatio } from '@/components/ui/aspect-ratio'
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from '@/components/ui/alert-dialog'

describe('shadcn/ui Components', () => {
  // Button component
  describe('Button', () => {
    it('renders button with text', () => {
      render(<Button>Click me</Button>)
      expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument()
    })

    it('renders button with default variant', () => {
      const { container } = render(<Button>Default</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-primary')
    })

    it('renders button with destructive variant', () => {
      const { container } = render(<Button variant="destructive">Delete</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-destructive')
    })

    it('renders button with outline variant', () => {
      const { container } = render(<Button variant="outline">Outline</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('border')
    })

    it('renders button with ghost variant', () => {
      const { container } = render(<Button variant="ghost">Ghost</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('hover:bg-accent')
    })

    it('renders button with link variant', () => {
      const { container } = render(<Button variant="link">Link</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('text-primary')
    })

    it('renders button with sm size', () => {
      const { container } = render(<Button size="sm">Small</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('h-9')
    })

    it('renders button with lg size', () => {
      const { container } = render(<Button size="lg">Large</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('h-11')
    })

    it('renders button with icon size', () => {
      const { container } = render(<Button size="icon">I</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('h-10')
      expect(button).toHaveClass('w-10')
    })

    it('forwards custom className', () => {
      const { container } = render(<Button className="custom-class">Custom</Button>)
      const button = container.querySelector('button')
      expect(button).toHaveClass('custom-class')
    })

    it('handles disabled state', () => {
      render(<Button disabled>Disabled</Button>)
      expect(screen.getByRole('button', { name: 'Disabled' })).toBeDisabled()
    })
  })

  // Input component
  describe('Input', () => {
    it('renders input element', () => {
      render(<Input data-testid="input" />)
      expect(screen.getByTestId('input')).toBeInTheDocument()
    })

    it('renders input with type', () => {
      const input = render(<Input type="email" data-testid="email-input" />).container.querySelector('input')
      expect(input).toHaveAttribute('type', 'email')
    })

    it('forwards custom className', () => {
      const input = render(<Input className="custom-input" data-testid="input" />).container.querySelector('input')
      expect(input).toHaveClass('custom-input')
    })

    it('forwards placeholder prop', () => {
      const input = render(<Input placeholder="Enter text" data-testid="input" />).container.querySelector('input')
      expect(input).toHaveAttribute('placeholder', 'Enter text')
    })

    it('handles disabled state', () => {
      const input = render(<Input disabled data-testid="input" />).container.querySelector('input')
      expect(input).toBeDisabled()
    })
  })

  // Textarea component
  describe('Textarea', () => {
    it('renders textarea element', () => {
      render(<Textarea data-testid="textarea" />)
      expect(screen.getByTestId('textarea')).toBeInTheDocument()
    })

    it('forwards custom className', () => {
      const textarea = render(<Textarea className="custom-textarea" data-testid="textarea" />).container.querySelector(
        'textarea',
      )
      expect(textarea).toHaveClass('custom-textarea')
    })

    it('forwards placeholder prop', () => {
      const textarea = render(<Textarea placeholder="Enter text" data-testid="textarea" />).container.querySelector(
        'textarea',
      )
      expect(textarea).toHaveAttribute('placeholder', 'Enter text')
    })

    it('handles disabled state', () => {
      const textarea = render(<Textarea disabled data-testid="textarea" />).container.querySelector('textarea')
      expect(textarea).toBeDisabled()
    })
  })

  // Label component
  describe('Label', () => {
    it('renders label with text', () => {
      render(<Label>Username</Label>)
      expect(screen.getByText('Username')).toBeInTheDocument()
    })

    it('forwards htmlFor prop', () => {
      const label = render(<Label htmlFor="username-input">Username</Label>).container.querySelector('label')
      expect(label).toHaveAttribute('for', 'username-input')
    })

    it('forwards custom className', () => {
      const label = render(<Label className="custom-label">Label</Label>).container.querySelector('label')
      expect(label).toHaveClass('custom-label')
    })
  })

  // Badge component
  describe('Badge', () => {
    it('renders badge with text', () => {
      render(<Badge>New</Badge>)
      expect(screen.getByText('New')).toBeInTheDocument()
    })

    it('renders badge with default variant', () => {
      const badge = render(<Badge>Default</Badge>).container.querySelector('div')
      expect(badge).toHaveClass('bg-primary')
    })

    it('renders badge with secondary variant', () => {
      const badge = render(<Badge variant="secondary">Secondary</Badge>).container.querySelector('div')
      expect(badge).toHaveClass('bg-secondary')
    })

    it('renders badge with destructive variant', () => {
      const badge = render(<Badge variant="destructive">Danger</Badge>).container.querySelector('div')
      expect(badge).toHaveClass('bg-destructive')
    })

    it('forwards custom className', () => {
      const badge = render(<Badge className="custom-badge">Badge</Badge>).container.querySelector('div')
      expect(badge).toHaveClass('custom-badge')
    })
  })

  // Card components
  describe('Card', () => {
    it('renders Card', () => {
      const card = render(<Card>Content</Card>).container.querySelector('div')
      expect(card).toHaveClass('rounded-lg')
      expect(card).toHaveClass('border')
    })

    it('renders CardHeader', () => {
      const header = render(<CardHeader>Header</CardHeader>).container.querySelector('div')
      expect(header).toHaveClass('p-6')
    })

    it('renders CardTitle', () => {
      render(<CardTitle>Title</CardTitle>)
      expect(screen.getByText('Title')).toBeInTheDocument()
    })

    it('renders CardDescription', () => {
      render(<CardDescription>Description</CardDescription>)
      expect(screen.getByText('Description')).toBeInTheDocument()
    })

    it('renders CardContent', () => {
      const content = render(<CardContent>Content</CardContent>).container.querySelector('div')
      expect(content).toHaveClass('p-6')
    })

    it('renders CardFooter', () => {
      const footer = render(<CardFooter>Footer</CardFooter>).container.querySelector('div')
      expect(footer).toHaveClass('flex')
    })
  })

  // Table components
  describe('Table', () => {
    it('renders table structure', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>John</TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      )
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('John')).toBeInTheDocument()
    })

    it('renders TableCaption', () => {
      render(
        <Table>
          <TableCaption>Table caption</TableCaption>
        </Table>,
      )
      expect(screen.getByText('Table caption')).toBeInTheDocument()
    })

    it('renders TableFooter', () => {
      render(
        <Table>
          <TableFooter>
            <TableRow>
              <TableCell>Total</TableCell>
            </TableRow>
          </TableFooter>
        </Table>,
      )
      expect(screen.getByText('Total')).toBeInTheDocument()
    })
  })

  // Skeleton component
  describe('Skeleton', () => {
    it('renders skeleton', () => {
      const skeleton = render(<Skeleton data-testid="skeleton" />).container.querySelector('div')
      expect(skeleton).toHaveClass('animate-pulse')
    })

    it('forwards custom className', () => {
      const skeleton = render(<Skeleton className="custom-skeleton" data-testid="skeleton" />).container.querySelector('div')
      expect(skeleton).toHaveClass('custom-skeleton')
    })
  })

  // Separator component
  describe('Separator', () => {
    it('renders separator', () => {
      const { container } = render(<Separator data-testid="separator" />)
      expect(screen.getByTestId('separator')).toBeInTheDocument()
    })

    it('renders horizontal separator by default', () => {
      const { container } = render(<Separator data-testid="separator" />)
      expect(screen.getByTestId('separator')).toHaveClass('h-[1px]')
    })

    it('renders vertical separator', () => {
      const { container } = render(<Separator orientation="vertical" data-testid="separator" />)
      expect(screen.getByTestId('separator')).toHaveClass('h-full')
    })
  })

  // Progress component
  describe('Progress', () => {
    it('renders progress with value', () => {
      const { container } = render(<Progress value={50} data-testid="progress" />)
      expect(screen.getByTestId('progress')).toBeInTheDocument()
    })

    it('renders progress at 0%', () => {
      const { container } = render(<Progress value={0} data-testid="progress" />)
      expect(screen.getByTestId('progress')).toBeInTheDocument()
    })

    it('renders progress at 100%', () => {
      const { container } = render(<Progress value={100} data-testid="progress" />)
      expect(screen.getByTestId('progress')).toBeInTheDocument()
    })
  })

  // Avatar components
  describe('Avatar', () => {
    it('renders Avatar', () => {
      const { container } = render(
        <Avatar data-testid="avatar">
          <AvatarImage src="test.jpg" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>,
      )
      expect(screen.getByTestId('avatar')).toBeInTheDocument()
    })

    it('renders Avatar with Image and Fallback together', () => {
      render(
        <Avatar>
          <AvatarImage src="test.jpg" alt="test" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>,
      )
      expect(screen.getByText('JD')).toBeInTheDocument()
    })

    it('renders Avatar with Fallback text', () => {
      render(
        <Avatar>
          <AvatarFallback>AB</AvatarFallback>
        </Avatar>,
      )
      expect(screen.getByText('AB')).toBeInTheDocument()
    })
  })

  // Tabs components
  describe('Tabs', () => {
    it('renders Tabs with triggers and content', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList>
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Content 1</TabsContent>
          <TabsContent value="tab2">Content 2</TabsContent>
        </Tabs>,
      )
      expect(screen.getByText('Tab 1')).toBeInTheDocument()
      expect(screen.getByText('Tab 2')).toBeInTheDocument()
    })
  })

  // Accordion components
  describe('Accordion', () => {
    it('renders Accordion with items', () => {
      render(
        <Accordion type="single" collapsible>
          <AccordionItem value="item1">
            <AccordionTrigger>Section 1</AccordionTrigger>
            <AccordionContent>Content 1</AccordionContent>
          </AccordionItem>
          <AccordionItem value="item2">
            <AccordionTrigger>Section 2</AccordionTrigger>
            <AccordionContent>Content 2</AccordionContent>
          </AccordionItem>
        </Accordion>,
      )
      expect(screen.getByText('Section 1')).toBeInTheDocument()
      expect(screen.getByText('Section 2')).toBeInTheDocument()
    })
  })

  // Switch component
  describe('Switch', () => {
    it('renders switch', () => {
      const { container } = render(<Switch data-testid="switch" />)
      expect(screen.getByTestId('switch')).toBeInTheDocument()
    })

    it('renders switch with checked state', () => {
      render(<Switch defaultChecked data-testid="switch" />)
      expect(screen.getByTestId('switch')).toBeInTheDocument()
    })

    it('renders switch disabled', () => {
      render(<Switch disabled data-testid="switch" />)
      expect(screen.getByTestId('switch')).toBeDisabled()
    })
  })

  // Checkbox component
  describe('Checkbox', () => {
    it('renders checkbox', () => {
      const { container } = render(<Checkbox data-testid="checkbox" />)
      expect(screen.getByTestId('checkbox')).toBeInTheDocument()
    })

    it('renders checkbox with checked state', () => {
      render(<Checkbox defaultChecked data-testid="checkbox" />)
      expect(screen.getByTestId('checkbox')).toBeInTheDocument()
    })

    it('renders checkbox disabled', () => {
      render(<Checkbox disabled data-testid="checkbox" />)
      expect(screen.getByTestId('checkbox')).toBeDisabled()
    })
  })

  // Slider component
  describe('Slider', () => {
    it('renders slider', () => {
      const { container } = render(<Slider defaultValue={[50]} data-testid="slider" />)
      expect(screen.getByTestId('slider')).toBeInTheDocument()
    })

    it('renders slider with min/max', () => {
      const { container } = render(<Slider defaultValue={[50]} min={0} max={100} data-testid="slider" />)
      expect(screen.getByTestId('slider')).toBeInTheDocument()
    })
  })

  // Alert components
  describe('Alert', () => {
    it('renders Alert', () => {
      const alert = render(<Alert data-testid="alert">Alert content</Alert>).container.querySelector('div')
      expect(alert).toHaveAttribute('role', 'alert')
    })

    it('renders Alert with default variant', () => {
      render(<Alert data-testid="alert">Alert content</Alert>)
      expect(screen.getByTestId('alert')).toHaveClass('bg-background')
    })

    it('renders Alert with destructive variant', () => {
      render(<Alert variant="destructive" data-testid="alert">Danger</Alert>)
      const alert = screen.getByTestId('alert')
      expect(alert).toHaveClass('text-destructive')
    })

    it('renders AlertTitle', () => {
      render(<AlertTitle>Alert Title</AlertTitle>)
      expect(screen.getByText('Alert Title')).toBeInTheDocument()
    })

    it('renders AlertDescription', () => {
      render(<AlertDescription>Alert Description</AlertDescription>)
      expect(screen.getByText('Alert Description')).toBeInTheDocument()
    })
  })

  // Tooltip components
  describe('Tooltip', () => {
    it('renders Tooltip with provider', () => {
      render(
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger>Hover me</TooltipTrigger>
            <TooltipContent>Tooltip text</TooltipContent>
          </Tooltip>
        </TooltipProvider>,
      )
      expect(screen.getByText('Hover me')).toBeInTheDocument()
    })
  })

  // Dialog components
  describe('Dialog', () => {
    it('renders Dialog with trigger', () => {
      render(
        <Dialog>
          <DialogTrigger>Open Dialog</DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Dialog Title</DialogTitle>
              <DialogDescription>Dialog Description</DialogDescription>
            </DialogHeader>
            <DialogFooter>Footer</DialogFooter>
          </DialogContent>
        </Dialog>,
      )
      expect(screen.getByText('Open Dialog')).toBeInTheDocument()
    })
  })

  // Popover components
  describe('Popover', () => {
    it('renders Popover with trigger', () => {
      render(
        <Popover>
          <PopoverTrigger>Open Popover</PopoverTrigger>
          <PopoverContent>Popover content</PopoverContent>
        </Popover>,
      )
      expect(screen.getByText('Open Popover')).toBeInTheDocument()
    })
  })

  // Dropdown Menu components
  describe('DropdownMenu', () => {
    it('renders DropdownMenu with trigger', () => {
      render(
        <DropdownMenu>
          <DropdownMenuTrigger>Open Menu</DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem>Item 1</DropdownMenuItem>
            <DropdownMenuItem>Item 2</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>,
      )
      expect(screen.getByText('Open Menu')).toBeInTheDocument()
    })
  })

  // Pagination components
  describe('Pagination', () => {
    it('renders Pagination', () => {
      const pagination = render(
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious href="#" />
            </PaginationItem>
            <PaginationItem>
              <PaginationLink href="#">1</PaginationLink>
            </PaginationItem>
            <PaginationItem>
              <PaginationNext href="#" />
            </PaginationItem>
          </PaginationContent>
        </Pagination>,
      ).container.querySelector('nav')

      expect(pagination).toHaveAttribute('role', 'navigation')
    })
  })

  // Breadcrumb components
  describe('Breadcrumb', () => {
    it('renders Breadcrumb', () => {
      render(
        <Breadcrumb>
          <BreadcrumbList>
            <BreadcrumbItem>
              <BreadcrumbLink href="/">Home</BreadcrumbLink>
            </BreadcrumbItem>
            <BreadcrumbSeparator />
            <BreadcrumbItem>
              <BreadcrumbLink href="/about">About</BreadcrumbLink>
            </BreadcrumbItem>
          </BreadcrumbList>
        </Breadcrumb>,
      )
      expect(screen.getByText('Home')).toBeInTheDocument()
      expect(screen.getByText('About')).toBeInTheDocument()
    })
  })

  // ScrollArea component
  describe('ScrollArea', () => {
    it('renders ScrollArea with children', () => {
      render(
        <ScrollArea>
          <div>Scrollable content</div>
        </ScrollArea>,
      )
      expect(screen.getByText('Scrollable content')).toBeInTheDocument()
    })
  })

  // Sheet components
  describe('Sheet', () => {
    it('renders Sheet with trigger', () => {
      render(
        <Sheet>
          <SheetTrigger>Open Sheet</SheetTrigger>
          <SheetContent>
            <SheetHeader>
              <SheetTitle>Sheet Title</SheetTitle>
            </SheetHeader>
          </SheetContent>
        </Sheet>,
      )
      expect(screen.getByText('Open Sheet')).toBeInTheDocument()
    })
  })

  // HoverCard components
  describe('HoverCard', () => {
    it('renders HoverCard with trigger', () => {
      render(
        <HoverCard>
          <HoverCardTrigger>Hover me</HoverCardTrigger>
          <HoverCardContent>Hover card content</HoverCardContent>
        </HoverCard>,
      )
      expect(screen.getByText('Hover me')).toBeInTheDocument()
    })
  })

  // Toggle component
  describe('Toggle', () => {
    it('renders Toggle', () => {
      const toggle = render(<Toggle data-testid="toggle">Toggle</Toggle>).container.querySelector('button')
      expect(toggle).toBeInTheDocument()
    })

    it('renders Toggle with pressed state', () => {
      render(<Toggle defaultPressed data-testid="toggle">Toggle</Toggle>)
      expect(screen.getByTestId('toggle')).toBeInTheDocument()
    })
  })

  // ToggleGroup components
  describe('ToggleGroup', () => {
    it('renders ToggleGroup with items', () => {
      render(
        <ToggleGroup type="single" defaultValue="a">
          <ToggleGroupItem value="a">Option A</ToggleGroupItem>
          <ToggleGroupItem value="b">Option B</ToggleGroupItem>
        </ToggleGroup>,
      )
      expect(screen.getByText('Option A')).toBeInTheDocument()
      expect(screen.getByText('Option B')).toBeInTheDocument()
    })
  })

  // Collapsible components
  describe('Collapsible', () => {
    it('renders Collapsible with trigger', () => {
      render(
        <Collapsible>
          <CollapsibleTrigger>Click to expand</CollapsibleTrigger>
          <CollapsibleContent>Hidden content</CollapsibleContent>
        </Collapsible>,
      )
      expect(screen.getByText('Click to expand')).toBeInTheDocument()
    })
  })

  // RadioGroup components
  describe('RadioGroup', () => {
    it('renders RadioGroup with items', () => {
      render(
        <RadioGroup defaultValue="option1">
          <RadioGroupItem value="option1" id="option1" />
          <Label htmlFor="option1">Option 1</Label>
          <RadioGroupItem value="option2" id="option2" />
          <Label htmlFor="option2">Option 2</Label>
        </RadioGroup>,
      )
      expect(screen.getByText('Option 1')).toBeInTheDocument()
      expect(screen.getByText('Option 2')).toBeInTheDocument()
    })
  })

  // AspectRatio component
  describe('AspectRatio', () => {
    it('renders AspectRatio', () => {
      render(
        <AspectRatio ratio={16 / 9} data-testid="aspect-ratio">
          <div>Content</div>
        </AspectRatio>,
      )
      expect(screen.getByText('Content')).toBeInTheDocument()
    })
  })

  // AlertDialog components
  describe('AlertDialog', () => {
    it('renders AlertDialog with trigger', () => {
      render(
        <AlertDialog>
          <AlertDialogTrigger>Open Alert</AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogTitle>Alert Title</AlertDialogTitle>
            <AlertDialogDescription>Alert Description</AlertDialogDescription>
            <AlertDialogAction>Confirm</AlertDialogAction>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
          </AlertDialogContent>
        </AlertDialog>,
      )
      expect(screen.getByText('Open Alert')).toBeInTheDocument()
    })
  })

  // Multi-component integration tests
  describe('Component Compositions', () => {
    it('renders Button inside Card', () => {
      render(
        <Card>
          <CardHeader>
            <CardTitle>Card Title</CardTitle>
          </CardHeader>
          <CardContent>
            <Button>Action Button</Button>
          </CardContent>
        </Card>,
      )
      expect(screen.getByText('Card Title')).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Action Button' })).toBeInTheDocument()
    })

    it('renders Input with Label', () => {
      render(
        <>
          <Label htmlFor="username">Username</Label>
          <Input id="username" placeholder="Enter username" data-testid="username-input" />
        </>,
      )
      expect(screen.getByText('Username')).toBeInTheDocument()
      const input = screen.getByTestId('username-input') as HTMLInputElement
      expect(input.placeholder).toBe('Enter username')
    })

    it('renders Badge inside Button', () => {
      render(
        <Button>
          Notifications <Badge>5</Badge>
        </Button>,
      )
      expect(screen.getByText('Notifications')).toBeInTheDocument()
      expect(screen.getByText('5')).toBeInTheDocument()
    })

    it('renders multiple Table cells', () => {
      render(
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Email</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            <TableRow>
              <TableCell>John Doe</TableCell>
              <TableCell>john@example.com</TableCell>
              <TableCell>
                <Badge variant="secondary">Active</Badge>
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>,
      )
      expect(screen.getByText('Name')).toBeInTheDocument()
      expect(screen.getByText('john@example.com')).toBeInTheDocument()
      expect(screen.getByText('Active')).toBeInTheDocument()
    })
  })

  // Render tree and ref forwarding tests
  describe('Ref Forwarding', () => {
    it('forwards ref to Button', () => {
      const ref = React.createRef<HTMLButtonElement>()
      render(<Button ref={ref}>Ref Button</Button>)
      expect(ref.current).toBeInstanceOf(HTMLButtonElement)
    })

    it('forwards ref to Input', () => {
      const ref = React.createRef<HTMLInputElement>()
      render(<Input ref={ref} data-testid="input" />)
      expect(ref.current).toBeInstanceOf(HTMLInputElement)
    })

    it('forwards ref to Textarea', () => {
      const ref = React.createRef<HTMLTextAreaElement>()
      render(<Textarea ref={ref} data-testid="textarea" />)
      expect(ref.current).toBeInstanceOf(HTMLTextAreaElement)
    })

    it('forwards ref to Card', () => {
      const ref = React.createRef<HTMLDivElement>()
      render(<Card ref={ref}>Card</Card>)
      expect(ref.current).toBeInstanceOf(HTMLDivElement)
    })

    it('forwards ref to Label', () => {
      const ref = React.createRef<HTMLLabelElement>()
      render(<Label ref={ref}>Label</Label>)
      expect(ref.current).toBeInstanceOf(HTMLLabelElement)
    })
  })

  // Class name merging tests
  describe('ClassName Merging', () => {
    it('merges classNames in Button', () => {
      const { container } = render(
        <Button variant="outline" size="sm" className="custom-button">
          Merged
        </Button>,
      )
      const button = container.querySelector('button')
      expect(button).toHaveClass('border')
      expect(button).toHaveClass('h-9')
      expect(button).toHaveClass('custom-button')
    })

    it('merges classNames in Badge', () => {
      const badge = render(<Badge variant="secondary" className="custom-badge">Custom</Badge>).container.querySelector('div')
      expect(badge).toHaveClass('bg-secondary')
      expect(badge).toHaveClass('custom-badge')
    })

    it('merges classNames in Card', () => {
      const card = render(<Card className="custom-card">Card</Card>).container.querySelector('div')
      expect(card).toHaveClass('rounded-lg')
      expect(card).toHaveClass('custom-card')
    })

    it('merges classNames in Input', () => {
      const input = render(<Input className="custom-input" data-testid="input" />).container.querySelector('input')
      expect(input).toHaveClass('border')
      expect(input).toHaveClass('custom-input')
    })
  })

  // Accessibility tests
  describe('Accessibility', () => {
    it('Button has proper role', () => {
      render(<Button>Click</Button>)
      expect(screen.getByRole('button', { name: 'Click' })).toBeInTheDocument()
    })

    it('Input has proper type', () => {
      const input = render(<Input type="text" data-testid="input" />).container.querySelector('input')
      expect(input).toHaveAttribute('type', 'text')
    })

    it('Label has htmlFor attribute', () => {
      const label = render(<Label htmlFor="test-id">Label</Label>).container.querySelector('label')
      expect(label).toHaveAttribute('for', 'test-id')
    })

    it('Alert has role attribute', () => {
      const alert = render(<Alert>Alert</Alert>).container.querySelector('div')
      expect(alert).toHaveAttribute('role', 'alert')
    })

    it('Pagination has navigation role', () => {
      const pagination = render(
        <Pagination>
          <PaginationContent />
        </Pagination>,
      ).container.querySelector('nav')
      expect(pagination).toHaveAttribute('role', 'navigation')
    })
  })

  // Props forwarding tests
  describe('Props Forwarding', () => {
    it('Button forwards onClick handler', () => {
      const handleClick = vi.fn()
      render(<Button onClick={handleClick}>Click me</Button>)
      screen.getByRole('button').click()
      expect(handleClick).toHaveBeenCalled()
    })

    it('Input forwards value prop', () => {
      const input = render(<Input value="test value" onChange={() => {}} data-testid="input" />).container.querySelector(
        'input',
      ) as HTMLInputElement
      expect(input.value).toBe('test value')
    })

    it('Button forwards aria attributes', () => {
      const button = render(<Button aria-label="custom label">Button</Button>).container.querySelector('button')
      expect(button).toHaveAttribute('aria-label', 'custom label')
    })

    it('Input forwards data attributes', () => {
      const input = render(<Input data-custom="test" data-testid="input" />).container.querySelector('input')
      expect(input).toHaveAttribute('data-custom', 'test')
    })
  })
})
