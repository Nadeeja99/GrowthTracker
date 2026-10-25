import { test, expect } from '@playwright/test'

// Needs NEXT_PUBLIC_DEMO_LOGIN=true (app) and DEMO_LOGIN_ENABLED=true (API).
test('"Try the demo" opens the seeded account without a password', async ({ page }) => {
  await page.goto('/auth')
  await page.getByRole('button', { name: 'Try the demo' }).click()
  await expect(page).toHaveURL(/\/today$/)
  await expect(page.getByText('Demo', { exact: true })).toBeVisible()

  await page.goto('/settings')
  await expect(page.getByText(/shared demo account/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out everywhere' })).toHaveCount(0)
})

test('offers to switch when the device is in another time zone', async ({ browser }) => {
  const email = `tz-${Date.now()}@example.test`
  // Sign up from Tokyo: the account takes the browser's zone.
  const tokyo = await (await browser.newContext({ timezoneId: 'Asia/Tokyo' })).newPage()
  await tokyo.goto('/auth')
  await tokyo.getByRole('button', { name: /sign up/i }).click()
  await tokyo.getByLabel('Email').fill(email)
  await tokyo.getByLabel('Username').fill(`tz${Date.now() % 1e6}`)
  await tokyo.getByLabel(/^Password/).fill('correct-horse-9')
  await tokyo.getByLabel(/confirm password/i).fill('correct-horse-9')
  await tokyo.getByRole('button', { name: 'Create Account' }).click()
  await expect(tokyo).toHaveURL(/\/today$/)
  await expect(tokyo.getByRole('region', { name: 'Time zone' })).toHaveCount(0)

  // Later, signed in from Dublin.
  const dublin = await (await browser.newContext({ timezoneId: 'Europe/Dublin' })).newPage()
  await dublin.goto('/auth')
  await dublin.getByLabel('Email').fill(email)
  await dublin.getByLabel('Password').fill('correct-horse-9')
  await dublin.getByRole('button', { name: 'Sign In' }).click()
  const notice = dublin.getByRole('region', { name: 'Time zone' })
  await expect(notice).toContainText('Asia/Tokyo')
  await notice.getByRole('button', { name: 'Use Dublin time' }).click()
  await expect(notice).toHaveCount(0)
  await dublin.goto('/settings')
  await expect(dublin.getByLabel('Timezone')).toHaveValue('Europe/Dublin')
})
