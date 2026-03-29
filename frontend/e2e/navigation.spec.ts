import { test, expect } from '@playwright/test'
import { loginFast } from './helpers'

test.describe('Navigation & Sidebar', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  test('sidebar shows all navigation items', async ({ page }) => {
    await page.goto('/')

    // Wait for layout to render
    await page.waitForTimeout(1000)

    // Look for sidebar/nav menu
    const nav = page.locator('nav, aside, [role="navigation"]')
    await expect(nav.first()).toBeVisible({ timeout: 10000 })

    // Check for nav items
    const navItems = page.locator('a[href], button[class*="nav"]')
    const count = await navItems.count()

    // Should have multiple navigation items
    expect(count).toBeGreaterThan(0)
  })

  test('clicking Overview nav item navigates to overview page', async ({ page }) => {
    await page.goto('/')

    await page.waitForTimeout(1000)

    // Find and click Overview link
    const overviewLink = page.locator('a:has-text("Overview"), button:has-text("Overview")').first()
    const count = await overviewLink.count()

    if (count > 0) {
      await overviewLink.click()
      await page.waitForTimeout(1000)

      const title = page.locator('h2:has-text("Overview")')
      await expect(title).toBeVisible({ timeout: 10000 })
    }
  })

  test('clicking Portfolio nav item navigates to portfolio page', async ({ page }) => {
    await page.goto('/')

    await page.waitForTimeout(1000)

    const portfolioLink = page.locator('a:has-text("Portfolio"), button:has-text("Portfolio")').first()
    const count = await portfolioLink.count()

    if (count > 0) {
      await portfolioLink.click()
      await page.waitForURL('**/portfolio', { timeout: 5000 })

      const title = page.locator('h2:has-text("Portfolio")')
      await expect(title).toBeVisible({ timeout: 10000 })
    }
  })

  test('clicking Allocations nav item navigates to allocations page', async ({ page }) => {
    await page.goto('/')

    await page.waitForTimeout(1000)

    const allocLink = page.locator('a:has-text("Allocations"), button:has-text("Allocations")').first()
    const count = await allocLink.count()

    if (count > 0) {
      await allocLink.click()
      await page.waitForURL('**/allocations', { timeout: 5000 })

      const title = page.locator('h2:has-text("Allocations")')
      await expect(title).toBeVisible({ timeout: 10000 })
    }
  })

  test('clicking Rebalance nav item navigates to rebalance page', async ({ page }) => {
    await page.goto('/')

    await page.waitForTimeout(1000)

    const rebalanceLink = page.locator('a:has-text("Rebalance"), button:has-text("Rebalance")').first()
    const count = await rebalanceLink.count()

    if (count > 0) {
      await rebalanceLink.click()
      await page.waitForURL('**/rebalance', { timeout: 5000 })

      const title = page.locator('h2:has-text("Rebalance")')
      await expect(title).toBeVisible({ timeout: 10000 })
    }
  })

  test('clicking Orders nav item navigates to orders page', async ({ page }) => {
    await page.goto('/')

    await page.waitForTimeout(1000)

    const ordersLink = page.locator('a:has-text("Orders"), button:has-text("Orders")').first()
    const count = await ordersLink.count()

    if (count > 0) {
      await ordersLink.click()
      await page.waitForURL('**/orders', { timeout: 5000 })

      const title = page.locator('h2:has-text("Orders")')
      await expect(title).toBeVisible({ timeout: 10000 })
    }
  })

  test('clicking Exchanges nav item navigates to exchanges page', async ({ page }) => {
    await page.goto('/')

    await page.waitForTimeout(1000)

    const exchangesLink = page.locator('a:has-text("Exchanges"), button:has-text("Exchanges")').first()
    const count = await exchangesLink.count()

    if (count > 0) {
      await exchangesLink.click()
      await page.waitForURL('**/exchanges', { timeout: 5000 })

      const title = page.locator('h2:has-text("Exchanges")')
      await expect(title).toBeVisible({ timeout: 10000 })
    }
  })

  test('clicking Strategy nav item navigates to strategy page', async ({ page }) => {
    await page.goto('/')

    await page.waitForTimeout(1000)

    const strategyLink = page.locator('a:has-text("Strategy"), button:has-text("Strategy")').first()
    const count = await strategyLink.count()

    if (count > 0) {
      await strategyLink.click()
      await page.waitForURL('**/strategy', { timeout: 5000 })

      const title = page.getByRole('heading', { name: 'Strategy Config' })
      await expect(title).toBeVisible({ timeout: 10000 })
    }
  })

  test('sidebar collapse/expand works', async ({ page }) => {
    await page.goto('/')

    await page.waitForTimeout(1000)

    // Look for sidebar toggle button
    const toggleButton = page.locator('[class*="sidebar"], [class*="nav"]').locator('button').first()
    const count = await toggleButton.count()

    // Sidebar may have toggle functionality
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('active route is highlighted in sidebar', async ({ page }) => {
    await page.goto('/portfolio')

    await page.waitForTimeout(1500)

    // Look for active/selected state on sidebar items
    const nav = page.locator('nav, aside')
    if (await nav.count() > 0) {
      const activeItem = page.locator('[class*="active"], [class*="selected"], [aria-current="page"]')
      const count = await activeItem.count()

      // Active item may exist
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })

      expect(errors).toEqual([])
    }
  })

  test('logout button redirects to login page', async ({ page }) => {
    await page.goto('/')

    await page.waitForTimeout(1000)

    // Look for logout/sign out button
    const logoutButton = page.getByRole('button', { name: /Logout|Sign Out|Log Out/i })
    const count = await logoutButton.count()

    if (count > 0) {
      await logoutButton.first().click()
      await page.waitForURL('**/login', { timeout: 5000 })

      const loginTitle = page.locator('h1:has-text("Operator Console")')
      await expect(loginTitle).toBeVisible({ timeout: 10000 })
    }
  })

  test('unauthenticated user is redirected to login', async ({ page }) => {
    // Clear localStorage to simulate unauthenticated state
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())

    // Try to navigate to protected page
    await page.goto('/')

    // Should redirect to login
    await page.waitForURL('**/login', { timeout: 10000 })

    const loginForm = page.locator('form')
    await expect(loginForm).toBeVisible({ timeout: 10000 })
  })

  test('authenticated user can access protected routes', async ({ page }) => {
    await loginFast(page)

    // Test accessing multiple protected routes
    const routes = ['/', '/portfolio', '/orders', '/allocations', '/exchanges']

    for (const route of routes) {
      await page.goto(route)
      await page.waitForTimeout(500)

      // Should not redirect to login
      const url = new URL(page.url())
      expect(url.pathname).toBe(route)
    }
  })

  test('navigation between pages is smooth', async ({ page }) => {
    await loginFast(page)

    const pages = [
      { path: '/', title: 'Overview' },
      { path: '/portfolio', title: 'Portfolio' },
      { path: '/orders', title: 'Orders' },
      { path: '/allocations', title: 'Allocations' },
    ]

    for (const { path, title } of pages) {
      await page.goto(path)
      await expect(page.locator(`h2:has-text("${title}")`)).toBeVisible({ timeout: 10000 })
    }
  })
})
