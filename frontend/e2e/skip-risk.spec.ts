import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { registerViaUi, signIn } from './helpers'

// The demo seed has weeks of kept morning study and mostly missed evening runs.
test('an upcoming evening run is flagged as likely to slip, with the reason', async ({ page }) => {
  await signIn(page)
  await page.goto('/plan')
  const timeline = page.getByRole('region', { name: 'Timeline' })
  await timeline.getByRole('tab', { name: 'Day' }).click()
  // Two days ahead there's always a pending run at 18:00 and a study block at 07:00.
  await timeline.getByRole('button', { name: 'Next day' }).click()
  await timeline.getByRole('button', { name: 'Next day' }).click()

  const run = timeline.locator('div').filter({ has: page.getByRole('heading', { name: 'Easy run' }) }).last()
  await expect(run.getByText('Likely to slip')).toBeVisible()
  await expect(run).toContainText('You often miss evening blocks')
  const study = timeline.locator('div').filter({ has: page.getByRole('heading', { name: 'AWS study' }) }).last()
  await expect(study.getByText('Likely to slip')).toHaveCount(0)

  const results = await new AxeBuilder({ page }).include('section[aria-label="Timeline"]').analyze()
  expect(results.violations).toEqual([])
})

test('a new account sees no labels', async ({ page }) => {
  await registerViaUi(page)
  await page.goto('/plan')
  await expect(page.getByRole('region', { name: 'Timeline' })).toBeVisible()
  await expect(page.getByText('Likely to slip')).toHaveCount(0)
})
