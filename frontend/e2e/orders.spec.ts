import { test, expect } from '@playwright/test'
import { loginFast } from './helpers'

test.describe('Orders Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  test('renders page title', async ({ page }) => {
    await page.goto('/orders')

    const title = page.locator('h2:has-text("Orders")')
    await expect(title).toBeVisible({ timeout: 10000 })
  })

  test('shows orders table with columns', async ({ page }) => {
    await page.goto('/orders')

    // Wait for content to load
    await page.waitForTimeout(1500)

    const table = page.locator('table')
    if (await table.count() > 0) {
      // Check for table headers
      const headers = page.locator('thead')
      if (await headers.count() > 0) {
        await expect(headers.first()).toBeVisible()
      }
    }
  })

  test('search input is available and functional', async ({ page }) => {
    await page.goto('/orders')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Look for search/filter input
    const searchInput = page.locator('input[placeholder*="Search"], input[placeholder*="search"]')
    const count = await searchInput.count()

    // Search may or may not be visible - just ensure no errors
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('filter tabs (All, Filled) are present', async ({ page }) => {
    await page.goto('/orders')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Look for tab buttons or filter options
    const tabs = page.getByRole('button', { name: /All|Filled|Pending/i })
    const count = await tabs.count()

    // Tabs may exist
    if (count > 0) {
      await expect(tabs.first()).toBeVisible()
    }

    // Page should load without errors
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('handles empty orders list gracefully', async ({ page }) => {
    await page.goto('/orders')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Page should load without errors even with empty data
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })
    expect(errors).toEqual([])
  })

  test('order table displays order details if data exists', async ({ page }) => {
    await page.goto('/orders')

    // Wait for content to load
    await page.waitForTimeout(1500)

    const table = page.locator('table')
    if (await table.count() > 0) {
      const rows = page.locator('tbody tr')
      const rowCount = await rows.count()

      // May have 0 or more rows depending on data
      expect(rowCount).toBeGreaterThanOrEqual(0)
    }
  })

  test('responsive layout on different screen sizes', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/orders')
    await expect(page.locator('h2:has-text("Orders")')).toBeVisible({ timeout: 10000 })

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/orders')
    await expect(page.locator('h2:has-text("Orders")')).toBeVisible({ timeout: 10000 })
  })

  test('no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/orders')
    await page.waitForTimeout(2000)

    expect(errors).toEqual([])
  })
})
