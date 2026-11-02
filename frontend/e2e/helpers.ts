import { expect, type Page } from '@playwright/test'

export const DEMO = {
  email: process.env.E2E_EMAIL ?? 'demo@growthtracker.dev',
  password: process.env.E2E_PASSWORD ?? 'demo-password-1',
}

export async function signIn(page: Page) {
  await page.goto('/auth')
  await page.getByLabel('Email').fill(DEMO.email)
  await page.getByLabel('Password').fill(DEMO.password)
  await page.getByRole('button', { name: 'Sign In' }).click()
  await expect(page).toHaveURL(/\/today$/)
}

export const PAGES = ['/today', '/plan', '/goals', '/habits', '/insights', '/settings'] as const

/** Signs up a fresh account through the UI and lands on Today. */
export async function registerViaUi(page: Page, password = 'correct-horse-9') {
  const email = `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}@example.test`
  await page.goto('/auth')
  await page.getByRole('button', { name: /sign up/i }).click()
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Username').fill(`u${Date.now() % 1e8}`)
  await page.getByLabel(/^Password/).fill(password)
  await page.getByLabel(/confirm password/i).fill(password)
  await page.getByRole('button', { name: 'Create Account' }).click()
  await expect(page).toHaveURL(/\/today$/)
  return { email, password }
}

export async function signInAs(page: Page, email: string, password: string) {
  await page.goto('/auth')
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill(password)
  await page.getByRole('button', { name: 'Sign In' }).click()
}

export async function signOut(page: Page) {
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page).toHaveURL(/\/auth$/)
}
