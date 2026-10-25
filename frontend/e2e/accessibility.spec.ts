import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { PAGES, signIn } from './helpers'

const WCAG = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'best-practice']

async function expectNoViolations(page: Page) {
  const { violations } = await new AxeBuilder({ page }).withTags(WCAG).analyze()
  const summary = violations.map(v => `${v.id} (${v.nodes.length}): ${v.nodes[0]?.target.join(' ')}`)
  expect(summary).toEqual([])
}

for (const colorScheme of ['light', 'dark'] as const) {
  test.describe(`${colorScheme} theme`, () => {
    test.use({ colorScheme })

    test('sign-in page has no accessibility violations', async ({ page }) => {
      await page.goto('/auth')
      await expectNoViolations(page)
    })

    test('every app page has no accessibility violations', async ({ page }) => {
      await signIn(page)
      for (const path of PAGES) {
        await page.goto(path)
        await page.waitForLoadState('networkidle')
        await expectNoViolations(page)
      }
    })
  })
}

test.describe('dialogs', () => {
  const dialogs: Array<{ name: string; path: string; opener: RegExp }> = [
    { name: 'task form', path: '/plan', opener: /add task/i },
    { name: 'time block form', path: '/plan', opener: /time block/i },
    { name: 'recurring form', path: '/plan', opener: /recurring/i },
    { name: 'habit form', path: '/habits', opener: /new habit/i },
    { name: 'focus panel', path: '/today', opener: /focus timer/i },
    { name: 'coach panel', path: '/today', opener: /open ai coach/i },
    { name: 'plan my week', path: '/plan', opener: /plan my week/i },
  ]

  for (const { name, path, opener } of dialogs) {
    test(`${name}: accessible, traps focus, closes on Escape, restores focus`, async ({ page }) => {
      await signIn(page)
      await page.goto(path)
      await page.waitForLoadState('networkidle')
      const button = page.getByRole('button', { name: opener }).first()
      await button.focus()
      await button.click()

      const dialog = page.locator('[role="dialog"][aria-modal="true"]').last()
      await expect(dialog).toBeVisible()
      await expectNoViolations(page)

      for (let i = 0; i < 25; i++) {
        await page.keyboard.press('Tab')
        expect(await page.evaluate(() => !!document.activeElement?.closest('[role="dialog"]'))).toBe(true)
      }
      await page.keyboard.press('Escape')
      await expect(page.locator('[role="dialog"]')).toHaveCount(0)
      await expect(button).toBeFocused()
    })
  }
})
