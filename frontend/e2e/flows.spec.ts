import { test, expect } from '@playwright/test'
import { signIn } from './helpers'

test.beforeEach(async ({ page }) => signIn(page))

test('the first Tab stop is "Skip to content"', async ({ page }) => {
  await page.keyboard.press('Tab')
  await expect(page.getByRole('link', { name: 'Skip to content' })).toBeFocused()
})

test('a failed save shows a toast with what failed and why', async ({ page }) => {
  await page.goto('/plan')
  await page.route('**/api/tasks/*', route => route.request().method() === 'PUT'
    ? route.fulfill({ status: 500, contentType: 'application/json', body: '{"success":false,"error":"Internal Server Error"}' })
    : route.continue())
  await page.getByRole('button', { name: /mark "write readme for portfolio" as done/i }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'Couldn’t save the task. Internal Server Error' })).toBeVisible()
})

test('a network failure says you seem to be offline', async ({ page }) => {
  await page.goto('/plan')
  await page.route('**/api/tasks/*', route => route.request().method() === 'PUT' ? route.abort('internetdisconnected') : route.continue())
  await page.getByRole('button', { name: /mark "write readme for portfolio" as done/i }).click()
  await expect(page.getByRole('alert').filter({ hasText: 'offline' })).toBeVisible()
})

test('pages show a skeleton while loading', async ({ page }) => {
  await page.route('**/api/habits*', async route => { await new Promise(r => setTimeout(r, 1500)); await route.continue() })
  await page.goto('/habits')
  await expect(page.getByRole('status').filter({ hasText: 'Loading habits' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Habits', level: 1 })).toBeVisible()
})

test('unknown routes show the 404 page', async ({ page }) => {
  await page.goto('/does-not-exist')
  await expect(page.getByRole('heading', { name: 'Page not found' })).toBeVisible()
})

test('deleting asks for confirmation; Escape cancels, Delete confirms', async ({ page }) => {
  await page.goto('/plan')
  const task = page.getByText('Buy new running shoes').first()
  const remove = page.getByRole('button', { name: 'Delete Buy new running shoes' })

  await remove.click()
  const dialog = page.getByRole('alertdialog')
  await expect(dialog).toContainText('Buy new running shoes')
  await expect(dialog.getByRole('button', { name: 'Cancel' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(task).toBeVisible()

  await remove.click()
  await dialog.getByRole('button', { name: 'Delete' }).click()
  await expect(page.getByText('Buy new running shoes')).toHaveCount(0)
})
