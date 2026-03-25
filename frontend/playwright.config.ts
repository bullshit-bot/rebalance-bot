import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: [['html', { open: 'never' }], ['list']],
  timeout: 30_000,
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: [
    {
      // Backend
      command: 'cd .. && bun run dev',
      port: 3001,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
      env: {
        API_KEY: 'e2e-test-key',
        ENCRYPTION_KEY: 'abcdefghijklmnopqrstuvwxyz123456',
        PAPER_TRADING: 'true',
        DATABASE_URL: 'file:data/e2e-test.db',
        API_PORT: '3001',
      },
    },
    {
      // Frontend
      command: 'npx vite --port 5173',
      port: 5173,
      timeout: 15_000,
      reuseExistingServer: !process.env.CI,
    },
  ],
})
