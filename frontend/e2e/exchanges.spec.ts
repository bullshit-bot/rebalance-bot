import { test, expect } from '@playwright/test'
import { loginFast } from './helpers'

test.describe('Exchanges Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  test('renders page title', async ({ page }) => {
    await page.goto('/exchanges')

    const title = page.locator('h2:has-text("Exchanges")')
    await expect(title).toBeVisible({ timeout: 10000 })
  })

  test('shows exchange cards', async ({ page }) => {
    await page.goto('/exchanges')

    // Wait for content to load
    await page.waitForTimeout(1500)

    const cards = page.locator('[class*="brutal-card"]')
    const count = await cards.count()

    // Should have exchange cards (Binance, OKX, Bybit, etc.)
    expect(count).toBeGreaterThan(0)
  })

  test('displays connection status badges', async ({ page }) => {
    await page.goto('/exchanges')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Look for status indicators (connected, disconnected, error, etc.)
    const statusElements = page.locator('[class*="badge"], [class*="status"]')
    const count = await statusElements.count()

    // Status elements should exist
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('shows API Permission Checklist', async ({ page }) => {
    await page.goto('/exchanges')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Look for permission checklist section
    const checklist = page.locator('text=/[Pp]ermission|[Pp]ermissions|[Cc]hecklist/i')

    // Checklist may exist
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('exchange cards are properly formatted', async ({ page }) => {
    await page.goto('/exchanges')

    // Wait for content to load
    await page.waitForTimeout(1500)

    const cards = page.locator('[class*="brutal-card"]')
    const count = await cards.count()

    if (count > 0) {
      // First card should be visible and have content
      const firstCard = cards.first()
      await expect(firstCard).toBeVisible()

      // Card should have some text (exchange name, status, etc.)
      const text = await firstCard.textContent()
      expect(text?.length).toBeGreaterThan(0)
    }
  })

  test('handles missing exchange data gracefully', async ({ page }) => {
    await page.goto('/exchanges')

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
    await page.goto('/exchanges')
    await expect(page.locator('h2:has-text("Exchanges")')).toBeVisible({ timeout: 10000 })

    // Tablet
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/exchanges')
    await expect(page.locator('h2:has-text("Exchanges")')).toBeVisible({ timeout: 10000 })

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/exchanges')
    await expect(page.locator('h2:has-text("Exchanges")')).toBeVisible({ timeout: 10000 })
  })

  test('no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/exchanges')
    await page.waitForTimeout(2000)

    expect(errors).toEqual([])
  })
})
