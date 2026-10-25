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
