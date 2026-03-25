import { Page } from '@playwright/test'

const API_KEY = 'e2e-test-key'
const API_BASE = 'http://localhost:3001/api'

/** Login by setting API key in localStorage then navigating */
export async function login(page: Page) {
  await page.goto('/')
  // Fill API key and submit
  await page.fill('input[type="password"]', API_KEY)
  await page.click('button[type="submit"]')
  // Wait for redirect to dashboard
  await page.waitForURL('/', { timeout: 10_000 })
}

/** Login via localStorage (faster, no UI interaction) */
export async function loginFast(page: Page) {
  await page.goto('/login')
  await page.evaluate((key) => localStorage.setItem('apiKey', key), API_KEY)
  await page.goto('/')
}

/** Seed test data via API */
export async function seedData() {
  const headers = { 'Content-Type': 'application/json', 'X-API-Key': API_KEY }

  // Seed allocations
  await fetch(`${API_BASE}/config/allocations`, {
    method: 'PUT',
    headers,
    body: JSON.stringify([
      { asset: 'BTC', targetPct: 35, exchange: 'binance', minTradeUsd: 10 },
      { asset: 'ETH', targetPct: 25, exchange: 'binance', minTradeUsd: 10 },
      { asset: 'SOL', targetPct: 15, exchange: 'binance', minTradeUsd: 10 },
      { asset: 'USDT', targetPct: 10, exchange: 'binance', minTradeUsd: 10 },
      { asset: 'AVAX', targetPct: 8, exchange: 'binance', minTradeUsd: 10 },
      { asset: 'LINK', targetPct: 7, exchange: 'binance', minTradeUsd: 10 },
    ]),
  })
}

/** Check if backend is healthy */
export async function waitForBackend() {
  for (let i = 0; i < 30; i++) {
    try {
      const res = await fetch(`${API_BASE}/health`)
      if (res.ok) return
    } catch {}
    await new Promise(r => setTimeout(r, 1000))
  }
  throw new Error('Backend not ready after 30s')
}
