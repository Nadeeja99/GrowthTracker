import { defineConfig, devices } from '@playwright/test'

// End-to-end tests against a running API (seeded with the demo account via
// `npm run db:seed` in backend/). Playwright starts the frontend itself, in dev
// mode, so React's development-only warnings are caught too. The suite edits
// the demo data (e.g. deletes a task), so re-seed before running it again.
//
// E2E_PWA=1 runs e2e/pwa/ against a production build instead (`npm run
// test:e2e:pwa`), because the service worker only runs there.
const PWA = !!process.env.E2E_PWA
const PORT = Number(process.env.E2E_PORT ?? (PWA ? 3101 : 3100))

export default defineConfig({
  testDir: PWA ? './e2e/pwa' : './e2e',
  testIgnore: PWA ? undefined : '**/pwa/**',
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
    // Notifications need full Chromium: the default headless build always denies them.
    { name: 'chromium', use: { ...devices['Desktop Chrome'], channel: process.env.E2E_CHANNEL ?? (PWA ? 'chromium' : undefined) } },
  ],
  webServer: {
    command: `npx next ${PWA ? 'start' : 'dev'} -p ${PORT}`,
    url: `http://localhost:${PORT}/auth`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: { API_ORIGIN: process.env.API_ORIGIN ?? 'http://localhost:5000' },
  },
})
