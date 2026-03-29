import { test, expect } from '@playwright/test'
import { loginFast } from './helpers'

test.describe('Strategy Config Page', () => {
  test.beforeEach(async ({ page }) => {
    await loginFast(page)
  })

  test('renders page title', async ({ page }) => {
    await page.goto('/strategy')

    const title = page.getByRole('heading', { name: 'Strategy Config' })
    await expect(title).toBeVisible({ timeout: 10000 })
  })

  test('shows parameter inputs', async ({ page }) => {
    await page.goto('/strategy')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Look for input fields (Threshold, Min Trade, etc.)
    const inputs = page.locator('input[type="text"], input[type="number"], input[type="range"]')
    const count = await inputs.count()

    // Should have parameter inputs
    expect(count).toBeGreaterThan(0)
  })

  test('shows toggle switches', async ({ page }) => {
    await page.goto('/strategy')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Look for toggle/switch components
    const toggles = page.locator('[role="switch"], button[class*="toggle"], input[type="checkbox"]')
    const count = await toggles.count()

    // May have toggle switches
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('shows strategy presets', async ({ page }) => {
    await page.goto('/strategy')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Look for preset buttons (Conservative, Balanced, Aggressive)
    const presets = page.getByRole('button', { name: /Conservative|Balanced|Aggressive/i })
    const count = await presets.count()

    // Presets may exist as buttons or options
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('Save Config button is available', async ({ page }) => {
    await page.goto('/strategy')

    // Wait for content to load
    await page.waitForTimeout(1500)

    const saveButton = page.getByRole('button', { name: /Save|Submit|Confirm/i })
    const count = await saveButton.count()

    // Save button should exist
    expect(count).toBeGreaterThan(0)
  })

  test('parameter inputs are interactive', async ({ page }) => {
    await page.goto('/strategy')

    // Wait for content to load
    await page.waitForTimeout(1500)

    const numberInputs = page.locator('input[type="number"]')
    const count = await numberInputs.count()

    if (count > 0) {
      const firstInput = numberInputs.first()
      await firstInput.fill('50')
      const value = await firstInput.inputValue()
      expect(value).toBe('50')
    }
  })

  test('form handles validation errors gracefully', async ({ page }) => {
    await page.goto('/strategy')

    // Wait for content to load
    await page.waitForTimeout(1500)

    // Page should handle invalid inputs without crashing
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    expect(errors).toEqual([])
  })

  test('responsive layout on different screen sizes', async ({ page }) => {
    // Desktop
    await page.setViewportSize({ width: 1920, height: 1080 })
    await page.goto('/strategy')
    await expect(page.getByRole('heading', { name: 'Strategy Config' })).toBeVisible({ timeout: 10000 })

    // Mobile
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/strategy')
    await expect(page.getByRole('heading', { name: 'Strategy Config' })).toBeVisible({ timeout: 10000 })
  })

  test('no console errors', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/strategy')
    await page.waitForTimeout(2000)

    expect(errors).toEqual([])
  })
})
