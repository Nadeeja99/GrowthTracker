import { test, expect, type Page } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { registerViaUi, signOut } from '../helpers'

// Runs against a production build, with the browser's network really cut:
// the service worker only exists there (see playwright.config.ts).

const dateKey = (date = new Date()) => date.toISOString().slice(0, 10)

/** Calls the API as the signed-in user, for setting up data and checking what reached it. */
function api(page: Page, path: string, init: { method?: string; body?: unknown } = {}) {
  return page.evaluate(async ({ path, init }) => {
    const refreshed = await (await fetch('/api/auth/refresh', { method: 'POST' })).json()
    const response = await fetch(`/api${path}`, {
      method: init.method ?? 'GET',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${refreshed.data.accessToken}` },
      body: init.body ? JSON.stringify(init.body) : undefined,
    })
    return response.json()
  }, { path, init })
}

const readSavedCache = (page: Page) => page.evaluate(() => new Promise<unknown>(resolve => {
  const open = indexedDB.open('keyval-store')
  open.onerror = () => resolve(null)
  open.onsuccess = () => {
    const db = open.result
    if (!db.objectStoreNames.contains('keyval')) return resolve(null)
    const read = db.transaction('keyval').objectStore('keyval').get('growthtracker-cache')
    read.onsuccess = () => resolve(read.result ?? null)
    read.onerror = () => resolve(null)
  }
}))

/**
 * Waits for the service worker. `serviceWorker.ready` never settles if the file
 * is missing, so a build without it would otherwise wait out every test's
 * timeout with no clue why.
 */
async function workerReady(page: Page) {
  const worker = await page.request.get('/sw.js')
  expect(worker.status(), 'public/sw.js is missing from this build: is it committed?').toBe(200)
  await page.evaluate(() => navigator.serviceWorker.ready.then(() => undefined))
}

/** Waits until the pages and the plan are both saved on the device. */
async function readyForOffline(page: Page) {
  await workerReady(page)
  await expect.poll(() => page.evaluate(() => !!navigator.serviceWorker.controller)).toBe(true)
  await expect.poll(() => page.evaluate(async () => {
    const saved = (await Promise.all((await caches.keys()).map(async name => (await caches.open(name)).keys()))).flat()
    return saved.some(request => new URL(request.url).pathname === '/plan')
  })).toBe(true)
  await expect.poll(() => readSavedCache(page).then(cache => JSON.stringify(cache ?? '').includes('Write the report')), { timeout: 10_000 }).toBe(true)
}

async function userWithAPlan(page: Page) {
  const account = await registerViaUi(page)
  const today = dateKey()
  await api(page, '/habits', { method: 'POST', body: { name: 'Evening walk', frequency: 'DAILY', targetCount: 1 } })
  await api(page, '/tasks', { method: 'POST', body: { title: 'Write the report', dueDate: `${today}T12:00:00.000Z` } })
  await api(page, '/schedules', {
    method: 'POST',
    body: { title: 'Deep work', startTime: `${today}T22:00:00.000Z`, endTime: `${today}T23:00:00.000Z` },
  })
  await page.goto('/today')
  await expect(page.getByText('Write the report')).toBeVisible()
  await readyForOffline(page)
  return account
}

test('opens with no connection and shows the last saved plan', async ({ page, context }) => {
  await userWithAPlan(page)

  await context.setOffline(true)
  await page.reload()

  await expect(page.getByRole('status').filter({ hasText: 'You’re offline' }).or(page.getByText(/You're offline/))).toBeVisible()
  await expect(page.getByText('Write the report')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark Evening walk done for today' })).toBeVisible()
  await expect(page.getByText('Deep work')).toBeVisible()

  const { violations } = await new AxeBuilder({ page }).analyze()
  expect(violations.map(v => v.id)).toEqual([])
})

test('moves between every tab offline', async ({ page, context }) => {
  await userWithAPlan(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Write the report')).toBeVisible()

  for (const [link, url] of [['Plan', /\/plan$/], ['Goals', /\/goals$/], ['Habits', /\/habits$/], ['Insights', /\/insights$/], ['Today', /\/today$/]] as const) {
    await page.getByRole('navigation', { name: 'Primary' }).getByRole('link', { name: link }).click()
    await expect(page).toHaveURL(url)
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByText('Something went wrong')).toHaveCount(0)
  }
  await page.goto('/habits')
  await expect(page.getByRole('button', { name: 'Mark Evening walk done for today' })).toBeVisible()
})

test('keeps offline check-ins through a restart and syncs them on reconnecting', async ({ page, context }) => {
  await userWithAPlan(page)
  await context.setOffline(true)
  await page.reload()

  await page.getByRole('button', { name: 'Mark Evening walk done for today' }).click()
  await page.getByRole('button', { name: 'Mark done: Deep work' }).click()
  await page.getByRole('button', { name: /Write the report/ }).first().click()
  await expect(page.getByRole('button', { name: 'Evening walk: done today' })).toBeVisible()
  await expect(page.getByText(/3 check-ins waiting to sync/)).toBeVisible()

  // The phone closes the app while still offline.
  await page.reload()
  await expect(page.getByRole('button', { name: 'Evening walk: done today' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Mark done: Deep work' })).toHaveCount(0)
  await expect(page.getByText(/3 check-ins waiting to sync/)).toBeVisible()

  await page.waitForTimeout(5_500) // long enough that it's worth saying they got through
  await context.setOffline(false)
  await expect(page.getByText('Your check-ins are saved.')).toBeVisible({ timeout: 15_000 })
  await expect(page.getByText(/waiting to sync/)).toHaveCount(0)

  const habits = (await api(page, '/habits')).data.habits
  const tasks = (await api(page, '/tasks')).data.tasks
  const blocks = (await api(page, '/schedules')).data.schedules
  expect(habits[0].completions).toHaveLength(1)
  expect(tasks[0].status).toBe('COMPLETED')
  expect(blocks[0].status).toBe('COMPLETED')
})

test('explains itself instead of hanging on anything that needs a connection', async ({ page, context }) => {
  await userWithAPlan(page)
  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Write the report')).toBeVisible()

  await page.goto('/habits')
  await page.getByRole('button', { name: 'New habit' }).first().click()
  await page.getByLabel(/name/i).first().fill('Stretch')
  await page.getByRole('button', { name: /Create|Save|Add/ }).last().click()
  await expect(page.getByText(/offline/i).first()).toBeVisible()
})

test('signing out removes the saved plan from the device', async ({ page, context }) => {
  await userWithAPlan(page)
  await signOut(page)

  expect(await readSavedCache(page)).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('growthtracker-offline-user'))).toBeNull()

  await context.setOffline(true)
  await page.goto('/today')
  await expect(page).toHaveURL(/\/auth$/)
  await expect(page.getByText('Write the report')).toHaveCount(0)
})

test('won’t sign out without a connection', async ({ page, context }) => {
  await userWithAPlan(page)
  await context.setOffline(true)
  await page.getByRole('button', { name: 'Account menu' }).click()
  await page.getByRole('menuitem', { name: 'Sign out' }).click()
  await expect(page.getByText('You need a connection to sign out.')).toBeVisible()
  await expect(page).toHaveURL(/\/today$/)
})

test('the next person to sign in never sees the last one’s plan or check-ins', async ({ page, context }) => {
  await userWithAPlan(page)
  await signOut(page)
  await registerViaUi(page)
  await expect(page.getByText('Write the report')).toHaveCount(0)

  await context.setOffline(true)
  await page.reload()
  await expect(page.getByText('Write the report')).toHaveCount(0)
})

test('never stores API responses or reset links', async ({ page }) => {
  await userWithAPlan(page)
  await page.goto('/reset-password?token=abcdefghijklmnopqrstuvwxyz0123456789')
  await expect(page.getByRole('heading', { name: 'Choose a new password' })).toBeVisible()

  const saved = await page.evaluate(async () =>
    (await Promise.all((await caches.keys()).map(async name => (await caches.open(name)).keys())))
      .flat().map(request => new URL(request.url).pathname + new URL(request.url).search))
  expect(saved.length).toBeGreaterThan(10)
  expect(saved.filter(path => path.startsWith('/api/') || path.includes('reset-password') || path.includes('token='))).toEqual([])
})

test('a new deploy replaces the saved copy of the app', async ({ page, context }) => {
  await userWithAPlan(page)
  // Each release registers its own /sw.js?v=<commit>, as this does.
  await page.evaluate(async () => {
    const registration = await navigator.serviceWorker.register('/sw.js?v=next-release', { scope: '/', updateViaCache: 'none' })
    await new Promise<void>(resolve => {
      const installing = registration.installing
      if (!installing) return resolve()
      installing.addEventListener('statechange', () => {
        if (installing.state === 'installed' || installing.state === 'activated') resolve()
      })
    })
  })

  // It takes over once the old version's pages are closed, like reopening the app.
  await page.close()
  const reopened = await context.newPage()
  await reopened.goto('/auth')
  await expect.poll(() => reopened.evaluate(async () => (await caches.keys()).filter(name => name.startsWith('growthtracker-')).length), { timeout: 15_000 }).toBe(1)
})

test('the demo account stays online only', async ({ page }) => {
  await page.goto('/auth')
  await page.getByRole('button', { name: /Try the demo/i }).click()
  await expect(page).toHaveURL(/\/today$/)
  await page.waitForTimeout(1500)
  expect(await readSavedCache(page)).toBeNull()
  expect(await page.evaluate(() => localStorage.getItem('growthtracker-offline-user'))).toBeNull()
})

test.describe('notifications', () => {
  // Real subscriptions need Google's or Apple's servers, so the browser's side is
  // stood in for; the notification itself is delivered by DevTools below.
  async function fakeBrowserPush(page: Page) {
    await page.context().grantPermissions(['notifications'])
    await page.addInitScript(() => {
      let current: PushSubscription | null = null
      const fake = () => ({
        endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-device',
        toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/e2e-device', keys: { p256dh: 'e2e-key', auth: 'e2e-auth' } }),
        unsubscribe: async () => { current = null; return true },
      }) as unknown as PushSubscription
      PushManager.prototype.subscribe = async () => (current = fake())
      PushManager.prototype.getSubscription = async () => current
    })
  }

  test('turns on from Settings with sensible times, and turns off again', async ({ page }) => {
    await fakeBrowserPush(page)
    await registerViaUi(page)
    await page.goto('/settings')
    await workerReady(page)

    await page.getByRole('button', { name: 'Turn on notifications' }).click()
    await expect(page.getByText('Notifications are on for this device.')).toBeVisible()
    await expect(page.getByLabel('Morning digest time')).toHaveValue('07:00')
    await expect(page.getByLabel('Evening check-in time')).toHaveValue('20:00')

    await page.getByLabel('Morning digest time').selectOption('06:30')
    await page.getByRole('checkbox', { name: /Evening check-in/ }).uncheck()
    await expect.poll(async () => (await api(page, '/push/settings')).data).toMatchObject({ morning: '06:30', evening: null })

    const { violations } = await new AxeBuilder({ page }).include('[aria-labelledby="notifications-title"]').analyze()
    expect(violations.map(v => v.id)).toEqual([])

    await page.getByRole('button', { name: 'Turn off on this device' }).click()
    await expect(page.getByRole('button', { name: 'Turn on notifications' })).toBeVisible()
  })

  test('shows a pushed digest', async ({ page, context }) => {
    await page.context().grantPermissions(['notifications'])
    await registerViaUi(page)
    await page.goto('/settings')
    await workerReady(page)

    const cdp = await context.newCDPSession(page)
    const registrationId = new Promise<string>(resolve => {
      cdp.on('ServiceWorker.workerRegistrationUpdated', ({ registrations }) => {
        if (registrations[0]) resolve(registrations[0].registrationId)
      })
    })
    await cdp.send('ServiceWorker.enable')
    await cdp.send('ServiceWorker.deliverPushMessage', {
      origin: new URL(page.url()).origin,
      registrationId: await registrationId,
      data: JSON.stringify({ title: 'Your day ahead', body: '2 time blocks, starting with AWS study at 07:00.', url: '/today', tag: 'digest-morning' }),
    })

    await expect.poll(() => page.evaluate(async () => {
      const registration = await navigator.serviceWorker.ready
      return (await registration.getNotifications()).map(n => `${n.title}: ${n.body}`)
    })).toEqual(['Your day ahead: 2 time blocks, starting with AWS study at 07:00.'])
  })

  test('is unavailable on the shared demo account', async ({ page }) => {
    await page.goto('/auth')
    await page.getByRole('button', { name: /Try the demo/i }).click()
    await expect(page).toHaveURL(/\/today$/)
    await page.goto('/settings')
    await expect(page.getByText('Notifications aren’t available on the shared demo account.')).toBeVisible()
  })
})
