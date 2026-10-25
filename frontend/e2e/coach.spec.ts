import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { signIn } from './helpers'

// Needs the API started with OPENAI_BASE_URL pointing at the fake OpenAI
// server (backend/tests/fake-openai-server.ts), so no real key is used.
test.beforeEach(async ({ page }) => signIn(page))

test('streams a reply and adds a suggested block to the plan', async ({ page }) => {
  await page.getByRole('button', { name: 'Open AI coach' }).click()
  const panel = page.getByRole('dialog', { name: 'Coach' })

  // The seeded conversation is there, with its suggestion.
  await expect(panel.getByText('How am I doing this week?')).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Add to plan: Easy run' })).toBeVisible()
  const { violations } = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
  expect(violations.map(v => v.id)).toEqual([])

  const input = panel.getByLabel('Message the coach')
  await expect(input).toBeFocused()
  await input.fill('How is my week going?')
  await input.press('Enter')

  // Text arrives in pieces: the Stop button shows while the reply is partial.
  await expect(panel.getByRole('button', { name: 'Stop the reply' })).toBeVisible()
  // .first(): the finished reply is also in the screen-reader announcement.
  await expect(panel.getByText(/You have 3 active goals/).first()).toBeVisible()
  await expect(panel.getByText('I suggested a block for tomorrow evening.').first()).toBeVisible()
  await expect(panel.getByRole('button', { name: 'Stop the reply' })).toHaveCount(0)
  // The budget is shared with the other AI features, so only check it's shown.
  await expect(panel.getByText(/\d+ AI requests left today/)).toBeVisible()

  await panel.getByRole('button', { name: 'Add to plan: Focused session' }).click()
  await expect(panel.getByText('Added').last()).toBeVisible()
  await expect(page.getByRole('status').or(page.getByRole('alert')).filter({ hasText: 'Added “Focused session”' })).toBeVisible()

  await page.keyboard.press('Escape')
  await page.goto('/plan')
  await expect(page.getByText('Focused session').first()).toBeVisible()
})

test('stopping a reply puts the question back in the input', async ({ page }) => {
  await page.getByRole('button', { name: 'Open AI coach' }).click()
  const panel = page.getByRole('dialog', { name: 'Coach' })
  const input = panel.getByLabel('Message the coach')
  await input.fill('Plan tomorrow for me')
  await input.press('Enter')
  await panel.getByRole('button', { name: 'Stop the reply' }).click()
  await expect(input).toHaveValue('Plan tomorrow for me')
})

test('the coach can be switched off in Settings', async ({ page }) => {
  await page.goto('/settings')
  const toggle = page.getByRole('switch', { name: 'Use AI Coach' })
  await expect(toggle).toHaveAttribute('aria-checked', 'true')
  await toggle.click()
  await expect(toggle).toHaveAttribute('aria-checked', 'false')

  await page.getByRole('button', { name: 'Open AI coach' }).click()
  const panel = page.getByRole('dialog', { name: 'Coach' })
  await expect(panel.getByRole('button', { name: 'Turn on AI Coach' })).toBeVisible()
  await panel.getByRole('button', { name: 'Turn on AI Coach' }).click()
  await expect(panel.getByLabel('Message the coach')).toBeVisible()
})
