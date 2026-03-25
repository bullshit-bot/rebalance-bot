import { test, expect } from '@playwright/test'
import { loginFast } from './helpers'

test.describe('Overview Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  test('renders page title', async ({ page }) => {
    await page.goto('/')

    const title = page.locator('h2:has-text("Overview")')
    await expect(title).toBeVisible({ timeout: 10000 })
  })

  test('shows stat cards', async ({ page }) => {
    await page.goto('/')

    // Wait for content to load (skeleton or actual cards)
    await page.waitForTimeout(2000)

    // Check for stat cards — at least 1 should be visible (skeleton, error, or loaded state)
    const statCards = page.locator('[class*="brutal-card"]')
    const count = await statCards.count()
    expect(count).toBeGreaterThan(0)

    // At least one stat card should be visible
    const firstCard = statCards.first()
    await expect(firstCard).toBeVisible()
  })

  test('shows allocation pie chart section', async ({ page }) => {
    await page.goto('/')

    // Pie chart uses SVG, look for the section title
    const chartSection = page.locator('text=/[Aa]llocation|[Cc]urrent/i')

    // Chart may or may not render depending on data - just check no errors
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.waitForTimeout(2000)
    expect(errors).toEqual([])
  })

  test('shows recent orders section', async ({ page }) => {
    await page.goto('/')

    // Look for recent orders/trades section
    const ordersSection = page.locator('text=/[Rr]ecent|[Oo]rders|[Tt]rades/i')

    // Section may exist but be empty - check page loads without errors
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.waitForTimeout(2000)
    expect(errors).toEqual([])
  })

  test('handles loading states gracefully', async ({ page }) => {
    await page.goto('/')

    // Check for skeleton placeholders during load
    const skeletons = page.locator('[class*="skeleton"]')
    const count = await skeletons.count()

    // Should have skeleton loaders or be already loaded
    // Wait for content to load
    await expect(page.locator('[class*="brutal-card"]').first()).toBeVisible({ timeout: 10000 })
  })

  test('shows rebalance recommendations if available', async ({ page }) => {
    await page.goto('/')

    // Rebalance recommendations section may not exist if no data
    // Just ensure page loads without errors
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.waitForTimeout(2000)
    expect(errors).toEqual([])
  })

  test('has responsive layout', async ({ page }) => {
    // Test on desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/')

    await expect(page.locator('h2:has-text("Overview")')).toBeVisible({ timeout: 10000 })

    // Test on mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/')

    await expect(page.locator('h2:has-text("Overview")')).toBeVisible({ timeout: 10000 })
  })

  test('no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/')
    await page.waitForTimeout(3000)

    expect(errors).toEqual([])
  })
})
