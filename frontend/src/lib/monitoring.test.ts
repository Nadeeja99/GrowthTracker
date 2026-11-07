import { describe, expect, it, vi } from 'vitest'
import type { ErrorEvent } from '@sentry/browser'
import { reportError, scrubEvent } from './monitoring'

describe('scrubEvent', () => {
  it('keeps the page path but drops query strings, breadcrumbs and user details', () => {
    const scrubbed = scrubEvent({
      type: undefined,
      request: {
        url: 'https://app.example/reset-password?token=secret#x',
        headers: { Referer: 'https://app.example/reset-password?token=secret', 'User-Agent': 'test' },
      },
      breadcrumbs: [{ message: 'typed something private' }],
      user: { ip_address: '10.0.0.1' },
      exception: { values: [{ type: 'TypeError', value: 'boom' }] },
    } as ErrorEvent)

    expect(scrubbed.request).toEqual({ url: 'https://app.example/reset-password' })
    expect(scrubbed.breadcrumbs).toBeUndefined()
    expect(scrubbed.user).toBeUndefined()
    expect(scrubbed.exception?.values?.[0].value).toBe('boom')
    expect(JSON.stringify(scrubbed)).not.toContain('secret')
  })

  it('copes with an event that has no request', () => {
    expect(scrubEvent({ type: undefined, message: 'boom' } as ErrorEvent).request).toBeUndefined()
  })
})

describe('reportError', () => {
  it('does nothing when no DSN is configured', () => {
    const fetchSpy = vi.spyOn(globalThis, 'fetch')
    expect(() => reportError(new Error('boom'))).not.toThrow()
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})
