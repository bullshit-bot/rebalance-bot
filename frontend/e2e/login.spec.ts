import { test, expect } from '@playwright/test'

test.describe('Login Page', () => {
  test('shows login form with API key input', async ({ page }) => {
    await page.goto('/login')

    const heading = page.locator('h1').filter({ hasText: 'Operator Console' })
    await expect(heading).toBeVisible({ timeout: 10000 })

    const apiKeyInput = page.locator('input[type="password"]')
    await expect(apiKeyInput).toBeVisible()
    await expect(apiKeyInput).toHaveAttribute('placeholder', 'Enter your API key')
  })

  test('rejects invalid API key', async ({ page }) => {
    await page.goto('/login')

    const apiKeyInput = page.locator('input[type="password"]')
    const submitButton = page.locator('button[type="submit"]')

    await apiKeyInput.fill('invalid-key-12345')
    await submitButton.click()

    // Should show error OR stay on login page (not redirect to dashboard)
    await page.waitForTimeout(3000)
    const url = page.url()
    expect(url).toContain('/login')
  })

  test('accepts valid API key and redirects', async ({ page }) => {
    await page.goto('/login')

    const apiKeyInput = page.locator('input[type="password"]')
    const submitButton = page.locator('button[type="submit"]')

    await apiKeyInput.fill('e2e-test-key')
    await submitButton.click()

    // Should redirect to dashboard
    await page.waitForURL('http://localhost:5173/', { timeout: 20000 })
    const overviewTitle = page.locator('h2:has-text("Overview")')
    await expect(overviewTitle).toBeVisible({ timeout: 10000 })
  })

  test('shows error on empty API key submission', async ({ page }) => {
    await page.goto('/login')

    // Fill whitespace only — bypasses HTML5 required but JS trim() rejects it
    const apiKeyInput = page.locator('input[type="password"]')
    await apiKeyInput.fill('   ')

    const submitButton = page.locator('button[type="submit"]')
    await submitButton.click()

    // Wait for validation error
    await page.waitForTimeout(500)
    const errorMsg = page.locator('text=API key is required')
    await expect(errorMsg).toBeVisible({ timeout: 5000 })
  })

  test('displays RBBot branding', async ({ page }) => {
    await page.goto('/login')

    const branding = page.locator('text=RBBot')
    await expect(branding).toBeVisible()

    const version = page.locator('text=v3.1.0')
    await expect(version).toBeVisible()
  })

  test('has no console errors on page load', async ({ page }) => {
    const errors: string[] = []
    page.on('pageerror', (error) => {
      errors.push(error.message)
    })

    await page.goto('/login')
    await page.waitForTimeout(1000)

    expect(errors).toEqual([])
  })
})
