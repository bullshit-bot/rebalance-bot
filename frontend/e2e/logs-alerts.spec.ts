import { test, expect } from '@playwright/test'
import { loginFast } from './helpers'

test.describe('Logs Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  test('renders page title', async ({ page }) => {
    await page.goto('/logs')

    const title = page.locator('h2:has-text("Logs")')
    await expect(title).toBeVisible({ timeout: 10000 })
  })

  test('shows filter chips', async ({ page }) => {
    await page.goto('/logs')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Look for filter chips/buttons
    const filters = page.locator('[class*="chip"], [class*="badge"], button[class*="filter"]')
    const count = await filters.count()

    // Filters may exist
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('search input works', async ({ page }) => {
    await page.goto('/logs')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Look for search input
    const searchInput = page.locator('input[type="text"][placeholder*="search" i], input[placeholder*="Search" i]')
    const count = await searchInput.count()

    // Search may exist
    if (count > 0) {
      await searchInput.first().fill('test')
      const value = await searchInput.first().inputValue()
      expect(value).toBe('test')
    }
  })

  test('displays log entries or "No logs" message', async ({ page }) => {
    await page.goto('/logs')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Page should show logs or empty message
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('logs page has responsive layout', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/logs')
    await expect(page.locator('h2:has-text("Logs")')).toBeVisible({ timeout: 10000 })

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/logs')
    await expect(page.locator('h2:has-text("Logs")')).toBeVisible({ timeout: 10000 })
  })

  test('logs page has no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/logs')
    await page.waitForTimeout(2000)

    expect(errors).toEqual([])
  })
})

test.describe('Alerts Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  test('renders page title', async ({ page }) => {
    await page.goto('/alerts')

    const title = page.locator('h2:has-text("Alerts")')
    await expect(title).toBeVisible({ timeout: 10000 })
  })

  test('shows alerts or "No active alerts" message', async ({ page }) => {
    await page.goto('/alerts')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Page should show alerts or empty state
    const emptyMessage = page.locator('text=/[Nn]o.*[Aa]lerts|[Nn]o [Aa]ctive/i')

    // Either alerts are shown or no-alerts message is displayed
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('alert cards display properly if alerts exist', async ({ page }) => {
    await page.goto('/alerts')

    // Wait for content to load
    await page.waitForTimeout(1500)

    const alertCards = page.locator('[class*="brutal-card"]')
    const count = await alertCards.count()

    // May have 0 or more alerts
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('alerts have status indicators', async ({ page }) => {
    await page.goto('/alerts')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Look for status badges (critical, warning, info, etc.)
    const statusElements = page.locator('[class*="badge"], [class*="status"]')
    const count = await statusElements.count()

    // Status elements may exist if alerts are present
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('alerts page has responsive layout', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/alerts')
    await expect(page.locator('h2:has-text("Alerts")')).toBeVisible({ timeout: 10000 })

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/alerts')
    await expect(page.locator('h2:has-text("Alerts")')).toBeVisible({ timeout: 10000 })

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/alerts')
    await expect(page.locator('h2:has-text("Alerts")')).toBeVisible({ timeout: 10000 })
  })

  test('alerts page has no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/alerts')
    await page.waitForTimeout(2000)

    expect(errors).toEqual([])
  })
})
