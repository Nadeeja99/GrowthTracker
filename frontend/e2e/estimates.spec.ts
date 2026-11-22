import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { api, registerViaUi } from './helpers'

// Uses its own accounts, so the finished tasks here don't change the demo's data.

async function finishTimedTasks(page: Page, goalId: string, pairs: Array<[estimate: number, actual: number]>) {
  for (const [i, [estimatedTime, actualTime]] of pairs.entries()) {
    const { data } = await api(page, '/tasks', { method: 'POST', body: { title: `Earlier task ${i}`, goalId, estimatedTime } })
    await api(page, `/tasks/${data.task.id}`, { method: 'PUT', body: { status: 'COMPLETED', actualTime } })
  }
}

async function openNewTask(page: Page) {
  await page.goto('/plan')
  await page.getByRole('region', { name: 'Tasks' }).getByRole('button', { name: 'Add Task' }).click()
  return page.getByRole('dialog', { name: 'Create Task' })
}

test('suggests a longer estimate to someone whose tasks run over, and uses it', async ({ page }) => {
  await registerViaUi(page)
  const { data } = await api(page, '/goals', { method: 'POST', body: { title: 'Ship the portfolio' } })
  await finishTimedTasks(page, data.goal.id, [[30, 60], [60, 110], [45, 80], [60, 120], [30, 55]])

  const dialog = await openNewTask(page)
  await dialog.getByLabel('Task title').fill('Record the demo video')
  await dialog.getByLabel('Estimate in minutes (Optional)').fill('60')

  const hint = dialog.getByRole('status')
  await expect(hint).toContainText('Tasks like this usually take you about')
  await expect(hint).toContainText('8 in 10 take between')
  await expect(hint).toContainText('Based on your last 5 finished timed tasks, 5 for this goal.')
  const results = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
  expect(results.violations).toEqual([])

  const use = hint.getByRole('button', { name: /^Use / })
  const label = (await use.textContent())!.replace('Use ', '')
  await use.click()
  const minutes = Number(await dialog.getByLabel('Estimate in minutes (Optional)').inputValue())
  expect(minutes).toBeGreaterThan(90)
  expect(label).toMatch(/^\dh( \d+m)?$/)

  await dialog.getByRole('button', { name: 'Create Task' }).click()
  await expect(dialog).toHaveCount(0)
  const tasks = (await api(page, '/tasks')).data.tasks as Array<{ title: string; estimatedTime: number }>
  expect(tasks.find(t => t.title === 'Record the demo video')?.estimatedTime).toBe(minutes)
})

test('tells a new user how to get suggestions', async ({ page }) => {
  await registerViaUi(page)
  await api(page, '/goals', { method: 'POST', body: { title: 'Learn Python' } })
  const dialog = await openNewTask(page)
  await dialog.getByLabel('Estimate in minutes (Optional)').fill('30')
  await expect(dialog.getByRole('status')).toContainText('Finish 3 more timed tasks')
})

test('explains an estimate that isn’t whole minutes', async ({ page }) => {
  await registerViaUi(page)
  await api(page, '/goals', { method: 'POST', body: { title: 'Learn Python' } })
  const dialog = await openNewTask(page)
  await dialog.getByLabel('Task title').fill('Read chapter 2')
  await dialog.getByLabel('Estimate in minutes (Optional)').fill('1.5')
  await dialog.getByRole('button', { name: 'Create Task' }).click()
  await expect(dialog.getByText('Enter whole minutes, from 1 to 1440')).toBeVisible()
  await expect(dialog.getByLabel('Estimate in minutes (Optional)')).toHaveAttribute('aria-invalid', 'true')
})
