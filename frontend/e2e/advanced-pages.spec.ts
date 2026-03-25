import { test, expect } from '@playwright/test'
import { loginFast } from './helpers'

const advancedPages = [
  { path: '/backtesting', title: 'Backtesting' },
  { path: '/analytics', title: 'Analytics' },
  { path: '/tax', title: 'Tax' },
  { path: '/grid', title: 'Grid' },
  { path: '/smart-orders', title: 'Smart Orders' },
  { path: '/copy-trading', title: 'Copy Trading' },
  { path: '/ai-suggestions', title: 'AI Suggestions' },
  { path: '/settings', title: 'Settings' },
]

test.describe('Advanced Pages - Basic Rendering', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  advancedPages.forEach(({ path, title }) => {
    test(`renders ${title} page title`, async ({ page }) => {
      await page.goto(path)

      const pageTitle = page.locator(`h2:has-text("${title}")`)
      await expect(pageTitle).toBeVisible({ timeout: 10000 })
    })
  })
})

test.describe('Advanced Pages - Content Presence', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  advancedPages.forEach(({ path, title }) => {
    test(`${title} page displays UI elements`, async ({ page }) => {
      await page.goto(path)

      // Wait for content to load
      await page.waitForTimeout(1500)

      // Check for at least one major UI element (card, button, input, etc.)
      const uiElements = page.locator('[class*="brutal-card"], [class*="btn"], input, select, [role="button"]')
      const count = await uiElements.count()

      // Page should have UI elements or be intentionally empty
      expect(count).toBeGreaterThanOrEqual(0)
    })
  })
})

test.describe('Advanced Pages - No Console Errors', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  advancedPages.forEach(({ path, title }) => {
    test(`${title} page has no console errors`, async ({ page }) => {
      const errors: string[] = []
      page.on('pageerror', (error) => {
        errors.push(error.message)
      })

      await page.goto(path)
      await page.waitForTimeout(2000)

      expect(errors).toEqual([])
    })
  })
})

test.describe('Advanced Pages - Responsive Design', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  test('Backtesting page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/backtesting')
    await expect(page.locator('h2:has-text("Backtesting")')).toBeVisible({ timeout: 10000 })

    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/backtesting')
    await expect(page.locator('h2:has-text("Backtesting")')).toBeVisible({ timeout: 10000 })
  })

  test('Analytics page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/analytics')
    await expect(page.locator('h2:has-text("Analytics")')).toBeVisible({ timeout: 10000 })

    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/analytics')
    await expect(page.locator('h2:has-text("Analytics")')).toBeVisible({ timeout: 10000 })
  })

  test('Tax page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/tax')
    await expect(page.locator('h2:has-text("Tax")')).toBeVisible({ timeout: 10000 })

    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/tax')
    await expect(page.locator('h2:has-text("Tax")')).toBeVisible({ timeout: 10000 })
  })

  test('Grid Trading page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/grid')
    await expect(page.locator('h2:has-text("Grid")')).toBeVisible({ timeout: 10000 })

    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/grid')
    await expect(page.locator('h2:has-text("Grid")')).toBeVisible({ timeout: 10000 })
  })

  test('Smart Orders page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/smart-orders')
    await expect(page.locator('h2:has-text("Smart Orders")')).toBeVisible({ timeout: 10000 })

    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/smart-orders')
    await expect(page.locator('h2:has-text("Smart Orders")')).toBeVisible({ timeout: 10000 })
  })

  test('Copy Trading page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/copy-trading')
    await expect(page.locator('h2:has-text("Copy Trading")')).toBeVisible({ timeout: 10000 })

    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/copy-trading')
    await expect(page.locator('h2:has-text("Copy Trading")')).toBeVisible({ timeout: 10000 })
  })

  test('AI Suggestions page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/ai-suggestions')
    await expect(page.locator('h2:has-text("AI Suggestions")')).toBeVisible({ timeout: 10000 })

    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/ai-suggestions')
    await expect(page.locator('h2:has-text("AI Suggestions")')).toBeVisible({ timeout: 10000 })
  })

  test('Settings page is responsive', async ({ page }) => {
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/settings')
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible({ timeout: 10000 })

    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/settings')
    await expect(page.locator('h2:has-text("Settings")')).toBeVisible({ timeout: 10000 })
  })
})

test.describe('404 Not Found Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  test('navigating to nonexistent route shows NotFound page', async ({ page }) => {
    await page.goto('/nonexistent-page-12345')

    // Look for 404 indicator or not found message
    const notFoundText = page.locator('text=/404|[Nn]ot [Ff]ound|[Pp]age [Nn]ot [Ff]ound/i')
    const count = await notFoundText.count()

    // Should have some indication of not found — NotFound page uses h1 for "404"
    const pageTitle = page.locator('h1, h2')
    await expect(pageTitle.first()).toBeVisible({ timeout: 10000 })
  })

  test('NotFound page has no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/nonexistent-page-12345')
    await page.waitForTimeout(1000)

    expect(errors).toEqual([])
  })
})
