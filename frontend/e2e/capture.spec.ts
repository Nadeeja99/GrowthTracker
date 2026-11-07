import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { registerViaUi, signIn } from './helpers'

function api(page: Page, path: string) {
  return page.evaluate(async path => {
    const refreshed = await (await fetch('/api/auth/refresh', { method: 'POST' })).json()
    const response = await fetch(`/api${path}`, { headers: { Authorization: `Bearer ${refreshed.data.accessToken}` } })
    return response.json()
  }, path)
}

const openCapture = (page: Page) => page.getByTitle('Quick Capture (⌘K)').click()
const capture = (page: Page) => page.getByRole('dialog', { name: 'Quick Capture' })
const box = (page: Page) => capture(page).getByRole('textbox', { name: 'What do you want to add?' })

test.describe('quick capture', () => {
  // Its own account: extra blocks in the shared demo data would crowd out the
  // items other tests look for in the calendar.
  test.beforeEach(async ({ page }) => { await registerViaUi(page) })

  test('turns a sentence into a time block, showing it first', async ({ page }) => {
    await openCapture(page)
    await expect(box(page)).toBeFocused()
    await box(page).fill('Physio tomorrow 6pm for 45 min')

    await expect(capture(page).getByRole('status')).toContainText('Physio')
    await expect(capture(page).getByRole('status')).toContainText('Time block')
    await expect(capture(page).getByRole('status')).toContainText('18:00–18:45')
    await expect(capture(page).getByLabel('Start time')).toHaveValue('18:00')
    const { violations } = await new AxeBuilder({ page }).include('[role="dialog"]').analyze()
    expect(violations.map(v => v.id)).toEqual([])

    await capture(page).getByRole('button', { name: 'Add Time Block' }).click()
    await expect(capture(page)).toHaveCount(0)

    const { schedules } = (await api(page, '/schedules')).data
    const block = schedules.find((s: { title: string }) => s.title === 'Physio')
    expect(new Date(block.endTime).getTime() - new Date(block.startTime).getTime()).toBe(45 * 60 * 1000)
  })

  test('turns a sentence into a task with its details', async ({ page }) => {
    await openCapture(page)
    await box(page).fill('Finish slides by next friday !high #work for 2h')
    await expect(capture(page).getByRole('status')).toContainText('high priority')
    await capture(page).getByRole('button', { name: 'Add Task' }).click()
    await expect(capture(page)).toHaveCount(0)

    const { tasks } = (await api(page, '/tasks?limit=500')).data
    const task = tasks.find((t: { title: string }) => t.title === 'Finish slides')
    expect(task).toMatchObject({ priority: 'HIGH', estimatedTime: 120 })
    expect(task.dueDate).toBeTruthy()
    expect(task.tags.map((t: { name: string }) => t.name)).toEqual(['work'])
  })

  test('lets a wrong guess be corrected before saving', async ({ page }) => {
    await openCapture(page)
    await box(page).fill('Dentist tomorrow 3pm')
    await expect(capture(page).getByRole('button', { name: 'Time block', exact: true })).toHaveAttribute('aria-pressed', 'true')

    await capture(page).getByRole('button', { name: 'Task', exact: true }).click()
    await expect(capture(page).getByLabel('Due date (optional)')).not.toHaveValue('')
    await capture(page).getByRole('button', { name: 'Add Task' }).click()
    await expect(capture(page)).toHaveCount(0)

    const { tasks } = (await api(page, '/tasks?limit=500')).data
    expect(tasks.some((t: { title: string }) => t.title === 'Dentist')).toBe(true)
  })

  test('won’t save without a title', async ({ page }) => {
    await openCapture(page)
    await box(page).fill('tomorrow 6pm')
    await expect(capture(page).getByText('Add a title.')).toBeVisible()
    await expect(capture(page).getByRole('button', { name: /^Add / })).toBeDisabled()
  })
})

test.describe('calendar link', () => {
  test('adds to a calendar, and stops working when replaced or turned off', async ({ page, request }) => {
    await registerViaUi(page)
    await openCapture(page)
    await box(page).fill('Physio tomorrow 6pm')
    await capture(page).getByRole('button', { name: 'Add Time Block' }).click()
    await expect(capture(page)).toHaveCount(0)

    await page.goto('/settings')
    await page.getByRole('button', { name: 'Turn on calendar link' }).click()
    const link = page.getByLabel('Your private link')
    await expect(link).toHaveValue(/\/calendar\/[\w-]{43}\.ics$/)
    const { violations } = await new AxeBuilder({ page }).include('[aria-labelledby="calendar-title"]').analyze()
    expect(violations.map(v => v.id)).toEqual([])

    // Fetched the way a calendar app would: no cookies, no proxy.
    const first = await link.inputValue()
    const feed = await request.get(first)
    expect(feed.status()).toBe(200)
    expect(feed.headers()['content-type']).toContain('text/calendar')
    expect(await feed.text()).toContain('SUMMARY:Physio')

    await page.getByRole('button', { name: 'Replace link' }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Replace' }).click()
    await expect(link).not.toHaveValue(first)
    expect((await request.get(first)).status()).toBe(404)

    const second = await link.inputValue()
    await page.getByRole('button', { name: 'Turn off', exact: true }).click()
    await page.getByRole('alertdialog').getByRole('button', { name: 'Turn off' }).click()
    await expect(page.getByRole('button', { name: 'Turn on calendar link' })).toBeVisible()
    expect((await request.get(second)).status()).toBe(404)
  })

  test('isn’t offered on the shared demo account', async ({ page }) => {
    await signIn(page)
    await page.goto('/settings')
    await expect(page.getByText('The calendar link isn’t available on the shared demo account.')).toBeVisible()
  })
})
