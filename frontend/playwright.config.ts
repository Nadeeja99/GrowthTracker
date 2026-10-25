import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against a running API (seeded with the demo account via
// `npm run db:seed` in backend/). Playwright starts the frontend itself, in dev
// mode, so React's development-only warnings are caught too. The suite edits
// the demo data (e.g. deletes a task), so re-seed before running it again.
const PORT = Number(process.env.E2E_PORT ?? 3100)

export default defineConfig({
  testDir: './e2e',
  // Tests share the demo account, so they run one at a time.
  workers: 1,
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  timeout: 60_000,
  use: {
    baseURL: `http://localhost:${PORT}`,
    // The demo data is seeded in UTC; a matching browser zone keeps times predictable.
    timezoneId: process.env.E2E_TIMEZONE ?? 'UTC',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [
    // E2E_CHANNEL=chrome uses an installed Chrome instead of Playwright's Chromium.
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.E2E_CHANNEL } },
  ],
  webServer: {
    command: `npx next dev -p ${PORT}`,
    url: `http://localhost:${PORT}/auth`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { API_ORIGIN: process.env.API_ORIGIN ?? 'http://localhost:5000' },
  },
})
