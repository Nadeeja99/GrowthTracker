import fs from 'fs'
import path from 'path'
import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { registerViaUi, signIn, signInAs, signOut } from './helpers'

// The API must run with MAIL_PROVIDER=outbox and MAIL_OUTBOX_DIR set to this
// directory, so the test can open the email like a person would.
const OUTBOX = process.env.E2E_MAIL_OUTBOX

async function expectAccessible(page: Page) {
  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.map(v => `${v.id}: ${v.nodes[0]?.target.join(' ')}`)).toEqual([])
}

async function resetLinkFor(email: string): Promise<string> {
  for (let i = 0; i < 50; i++) {
    const files = fs.existsSync(OUTBOX!) ? fs.readdirSync(OUTBOX!).sort().reverse() : []
    for (const file of files) {
      const mail = JSON.parse(fs.readFileSync(path.join(OUTBOX!, file), 'utf8'))
      if (mail.to === email) return /https?:\/\/\S+reset-password\?token=[\w-]+/.exec(mail.text)![0]
    }
    await new Promise(r => setTimeout(r, 200))
  }
  throw new Error(`No reset email for ${email}`)
}

test('change password: wrong current password is explained; other devices are signed out', async ({ page, browser }) => {
  const { email, password } = await registerViaUi(page)
  const otherDevice = await (await browser.newContext()).newPage()
  await signInAs(otherDevice, email, password)
  await expect(otherDevice).toHaveURL(/\/today$/)

  await page.goto('/settings')
  const form = page.getByRole('form', { name: 'Change password' })
  await form.getByLabel('Current password').fill('not-my-password')
  await form.getByLabel('New password', { exact: true }).fill('a-new-password-1')
  await form.getByLabel('Confirm new password').fill('a-new-password-1')
  await form.getByRole('button', { name: 'Change password' }).click()
  await expect(form.getByRole('alert')).toHaveText('Your current password is incorrect.')

  await form.getByLabel('Current password').fill(password)
  await form.getByRole('button', { name: 'Change password' }).click()
  await expect(form.getByRole('status')).toContainText('Password changed')

  // This device stays signed in; the other one is sent back to sign-in.
  await page.goto('/goals')
  await expect(page).toHaveURL(/\/goals$/)
  await otherDevice.reload()
  await expect(otherDevice).toHaveURL(/\/auth$/)

  await signOut(page)
  await signInAs(page, email, 'a-new-password-1')
  await expect(page).toHaveURL(/\/today$/)
})

test('forgot password: email link sets a new password, signs in, and works only once', async ({ page }) => {
  test.skip(!OUTBOX, 'needs E2E_MAIL_OUTBOX (the API in outbox mail mode)')
  const { email } = await registerViaUi(page)
  await signOut(page)

  await page.getByLabel('Email').fill(email)
  await page.getByRole('button', { name: 'Forgot password?' }).click()
  await expect(page.getByLabel('Email')).toHaveValue(email) // carried over
  await expectAccessible(page)
  await page.getByRole('button', { name: 'Send reset link' }).click()
  await expect(page.getByRole('heading', { name: 'Check your email' })).toBeVisible()

  const link = await resetLinkFor(email)
  await page.goto(link)
  await expect(page).toHaveURL(/\/reset-password$/) // token removed from the address bar
  await expectAccessible(page)
  await page.getByLabel('New password', { exact: true }).fill('from-the-email-1')
  await page.getByLabel('Confirm new password').fill('from-the-email-2')
  await page.getByRole('button', { name: 'Save and sign in' }).click()
  // Scoped to the page: Next.js also renders a (hidden) route announcer with role="alert".
  await expect(page.getByRole('main').getByRole('alert')).toHaveText('The two passwords don’t match.')
  await page.getByLabel('Confirm new password').fill('from-the-email-1')
  await page.getByRole('button', { name: 'Save and sign in' }).click()
  await expect(page).toHaveURL(/\/today$/)

  await signOut(page)
  await page.goto(link)
  await page.getByLabel('New password', { exact: true }).fill('again-and-again-1')
  await page.getByLabel('Confirm new password').fill('again-and-again-1')
  await page.getByRole('button', { name: 'Save and sign in' }).click()
  await expect(page.getByRole('heading', { name: /This link doesn.t work any more/ })).toBeVisible()
  await page.getByRole('link', { name: 'Send a new link' }).click()
  await expect(page.getByRole('heading', { name: 'Forgot your password?' })).toBeVisible()

  await signInAs(page, email, 'from-the-email-1')
  await expect(page).toHaveURL(/\/today$/)
})

test('download my data, then delete the account', async ({ page }) => {
  const { email, password } = await registerViaUi(page)
  await page.goto('/settings')

  const [download] = await Promise.all([
    page.waitForEvent('download'),
    page.getByRole('button', { name: 'Download my data' }).click(),
  ])
  expect(download.suggestedFilename()).toMatch(/^growthtracker-export-\d{4}-\d{2}-\d{2}\.json$/)
  const exported = JSON.parse(fs.readFileSync((await download.path())!, 'utf8'))
  expect(exported.account.email).toBe(email)
  expect(JSON.stringify(exported)).not.toContain(password)

  await page.getByRole('button', { name: 'Delete account' }).click()
  const dialog = page.getByRole('dialog', { name: 'Delete your account?' })
  await expect(dialog.getByLabel('Enter your password to confirm')).toBeFocused()
  await expectAccessible(page)
  await dialog.getByLabel('Enter your password to confirm').fill('wrong-password')
  await dialog.getByRole('button', { name: 'Delete account' }).click()
  await expect(dialog.getByRole('alert')).toHaveText('That password is incorrect.')

  await dialog.getByLabel('Enter your password to confirm').fill(password)
  await dialog.getByRole('button', { name: 'Delete account' }).click()
  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.getByText('Your account and all its data were deleted.')).toBeVisible()

  await signInAs(page, email, password)
  await expect(page.getByRole('main').getByRole('alert')).toContainText('Invalid credentials')
})

test('the shared demo account can’t change its password or be deleted', async ({ page }) => {
  await signIn(page)
  await page.goto('/settings')
  await expect(page.getByRole('form', { name: 'Change password' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Delete account' })).toHaveCount(0)
  await expect(page.getByText(/demo account can.t be deleted/)).toBeVisible()
  await expect(page.getByRole('button', { name: 'Download my data' })).toBeVisible()
})
