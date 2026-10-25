import { test, expect } from '@playwright/test'
import { PAGES, signIn } from './helpers'

// Fails on any React/Next.js console error or warning while using the app.
// Runs against `next dev`, where React reports problems production hides
// (e.g. unstable useSyncExternalStore snapshots).
test('no console errors or warnings across the app', async ({ page }) => {
  const problems: string[] = []
  page.on('console', message => {
    if (!['error', 'warning'].includes(message.type())) return
    const text = message.text()
    if (/status of 401/.test(text) && page.url().includes('/auth')) return // session probe before sign-in
    if (/Download the React DevTools/.test(text)) return
    problems.push(`${page.url()}: ${text}`)
  })
  page.on('pageerror', error => problems.push(`${page.url()}: ${error.message}`))

  await signIn(page)
  for (const path of PAGES) {
    await page.goto(path)
    await page.waitForLoadState('networkidle')
  }
  await page.goto('/plan')
  await page.getByRole('tab', { name: 'Day' }).click()
  await page.getByRole('button', { name: 'Time block', exact: true }).click()
  await page.keyboard.press('Escape')
  await page.goto('/today')
  await page.getByRole('radio', { name: 'Energy: 4 of 5' }).click()
  await page.getByRole('button', { name: /open focus timer/i }).click()
  await page.getByRole('button', { name: /start timer/i }).click()
  await page.getByRole('button', { name: /pause timer/i }).click()
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Open AI coach' }).click()
  await expect(page.getByLabel('Message the coach')).toBeVisible()
  await page.keyboard.press('Escape')

  expect(problems).toEqual([])
})
