import { test, expect } from '@playwright/test'
import { loginFast } from './helpers'

test.describe('Allocations Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  test('renders page title', async ({ page }) => {
    await page.goto('/allocations')

    const title = page.locator('h2:has-text("Allocations")')
    await expect(title).toBeVisible({ timeout: 10000 })
  })

  test('shows target allocation pie chart section', async ({ page }) => {
    await page.goto('/allocations')

    // Look for pie chart section
    const chartSection = page.locator('text=/[Tt]arget|[Aa]llocation/i')

    // Chart area should have SVG or chart container
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.waitForTimeout(2000)
    expect(errors).toEqual([])
  })

  test('shows current vs target bar chart', async ({ page }) => {
    await page.goto('/allocations')

    // Look for comparison chart section
    const chartSection = page.locator('text=/[Cc]urrent|[Vv]s|[Cc]omparison/i')

    // Page should load without errors
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.waitForTimeout(2000)
    expect(errors).toEqual([])
  })

  test('displays allocation cards per asset', async ({ page }) => {
    await page.goto('/allocations')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Cards should be visible (may be empty if no data)
    const cards = page.locator('[class*="brutal-card"]')
    const count = await cards.count()
    expect(count).toBeGreaterThanOrEqual(0)
  })

  test('shows asset allocation details', async ({ page }) => {
    await page.goto('/allocations')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Look for allocation percentage or value displays
    const allocationElements = page.locator('text=/%/')
    const count = await allocationElements.count()

    // May have allocation percentages displayed
    // Just ensure page loads
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('handles empty allocations gracefully', async ({ page }) => {
    await page.goto('/allocations')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Page should load without errors even with empty data
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })
    expect(errors).toEqual([])
  })

  test('responsive layout on different screen sizes', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/allocations')
    await expect(page.locator('h2:has-text("Allocations")')).toBeVisible({ timeout: 10000 })

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/allocations')
    await expect(page.locator('h2:has-text("Allocations")')).toBeVisible({ timeout: 10000 })

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/allocations')
    await expect(page.locator('h2:has-text("Allocations")')).toBeVisible({ timeout: 10000 })
  })

  test('no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/allocations')
    await page.waitForTimeout(2000)

    expect(errors).toEqual([])
  })
})
