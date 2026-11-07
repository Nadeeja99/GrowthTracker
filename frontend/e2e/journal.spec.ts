import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { api, registerViaUi } from './helpers'

// Uses its own accounts: the notes here shouldn't leak into other tests' demo
// data. Answers come from the fake OpenAI server, which cites the top note.

const dayKey = (daysAgo: number) => new Date(Date.now() - daysAgo * 86_400_000).toISOString().slice(0, 10)

async function writeNote(page: Page, daysAgo: number, notes: string) {
  await api(page, `/reflections/${dayKey(daysAgo)}`, { method: 'PUT', body: { performance: 4, energy: 2, mood: 3, notes } })
}

const box = (page: Page, name: RegExp | string) => page.getByRole('textbox', { name })
// The app's navigation has an "Ask" button of its own.
const card = (page: Page) => page.getByRole('region', { name: 'Your journal' })

test('someone with no notes is pointed to the daily review', async ({ page }) => {
  await registerViaUi(page)
  await page.goto('/insights')
  await expect(page.getByRole('link', { name: 'daily review' })).toHaveAttribute('href', '/today')
})

test('search finds notes without AI, by word forms', async ({ page }) => {
  await registerViaUi(page)
  await writeNote(page, 2, 'Skipped my run because of the rain.')
  await writeNote(page, 1, 'Quiet day at home.')
  await page.goto('/insights')

  await box(page, 'Search your journal').fill('running')
  await page.keyboard.press('Enter')

  await expect(page.getByText('1 note found')).toBeVisible()
  await expect(page.getByText('Skipped my run because of the rain.')).toBeVisible()
  await expect(page.getByText('Performance 4/5 · Energy 2/5 · Mood 3/5')).toBeVisible()
  await expect(card(page).getByRole('button', { name: 'Ask' })).toHaveCount(0)
  await expect(card(page).getByRole('button', { name: 'Turn on the AI Coach' })).toBeVisible()

  await box(page, 'Search your journal').fill('zebra')
  await page.getByRole('button', { name: 'Search' }).click()
  await expect(page.getByText('No notes match “zebra”.')).toBeVisible()
})

test('asking gives a streamed answer that links to its source note', async ({ page }) => {
  await registerViaUi(page)
  await writeNote(page, 3, 'Completely exhausted after the workshop.')
  await writeNote(page, 1, 'Lovely lunch with friends.')
  await api(page, '/coach/settings', { method: 'PUT', body: { enabled: true } })
  await page.goto('/insights')

  // "tired" isn't in the note: it can only be found by meaning.
  await box(page, 'Search or ask your journal').fill('tired')
  await card(page).getByRole('button', { name: 'Ask' }).click()

  await expect(page.getByRole('heading', { name: 'From your notes' })).toBeVisible()
  const citation = page.getByRole('link', { name: /^Note from/ })
  await expect(citation).toBeVisible()
  await citation.click()
  await expect(page).toHaveURL(new RegExp(`#journal-note-${dayKey(3)}$`))
  await expect(page.locator(`[id="journal-note-${dayKey(3)}"]`)).toContainText('Completely exhausted')

  const { violations } = await new AxeBuilder({ page }).include('section[aria-labelledby="journal-title"]').withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze()
  expect(violations.map(v => v.id)).toEqual([])

  const status = await api(page, '/coach')
  expect(status.data.usage.used).toBe(1)
})

test('fits a phone screen, and understands a question about a day', async ({ page }) => {
  await registerViaUi(page)
  await writeNote(page, 1, 'Felt drained after back-to-back meetings.')
  await api(page, '/coach/settings', { method: 'PUT', body: { enabled: true } })
  await page.setViewportSize({ width: 375, height: 700 })
  await page.goto('/insights')

  await box(page, 'Search or ask your journal').fill('How was yesterday?')
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: 'From your notes' })).toBeVisible()
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
  expect(overflow).toBeLessThanOrEqual(0)
})
