import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signIn } from './helpers'

// Like coach.spec.ts, these run against the fake OpenAI server.
test.beforeEach(async ({ page }) => signIn(page))

async function expectAccessible(page: Page, selector: string) {
  const { violations } = await new AxeBuilder({ page }).include(selector).analyze()
  expect(violations.map(v => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([])
}

test('weekly review: write it, then add a priority as a task', async ({ page }) => {
  await page.goto('/insights')
  const card = page.getByRole('region', { name: 'Weekly review' })
  await card.getByRole('button', { name: 'Write my review' }).click()
  await expect(card.getByText(/blocks completed across/)).toBeVisible()
  await expect(card.getByRole('heading', { name: 'Patterns' })).toBeVisible()
  await expectAccessible(page, 'section[aria-labelledby="weekly-review-title"]')

  await card.getByRole('button', { name: 'Add as task: Book two runs before Wednesday' }).click()
  await expect(card.getByText('Added')).toBeVisible()

  // Stored: still there after a reload, without another AI call.
  await page.reload()
  await expect(page.getByRole('region', { name: 'Weekly review' }).getByText(/blocks completed across/)).toBeVisible()
  await page.goto('/plan')
  await expect(page.getByText('Book two runs before Wednesday').first()).toBeVisible()
})

test('plan my week: suggests blocks that avoid existing ones and adds the chosen', async ({ page }) => {
  await page.goto('/plan')
  await page.getByRole('button', { name: 'Plan my week' }).click()
  const dialog = page.getByRole('dialog', { name: 'Plan my week' })
  await dialog.getByRole('button', { name: 'Suggest blocks' }).click()

  const options = dialog.getByRole('checkbox')
  await expect(options.first()).toBeVisible()
  // The 07:00 suggestions clash with the demo's daily 07:00 study block and are dropped.
  await expect(dialog.getByText('Evening review').first()).toBeVisible()
  await expectAccessible(page, '[role="dialog"]')

  const count = await options.count()
  await options.first().uncheck()
  await dialog.getByRole('button', { name: `Add ${count - 1} ${count - 1 === 1 ? 'block' : 'blocks'}` }).click()
  await expect(dialog).toHaveCount(0)
  await expect(page.getByText(/Added \d+ blocks? to your week/)).toBeVisible()
})

test('goal breakdown: suggest milestones and add them', async ({ page }) => {
  await page.goto('/goals')
  await page.getByRole('button', { name: 'Suggest milestones for Half marathon' }).click()
  await expect(page.getByText('Outline a plan for Half marathon')).toBeVisible()
  await page.getByRole('checkbox', { name: /Final dress rehearsal/ }).uncheck()
  await page.getByRole('button', { name: 'Add 2' }).click()
  await expect(page.getByText('Reach the halfway checkpoint')).toBeVisible()
  await expect(page.getByText('Suggested milestones')).toHaveCount(0)
})
