// Error reporting to Sentry. Without NEXT_PUBLIC_SENTRY_DSN nothing happens and
// the SDK is never downloaded; with it, the SDK loads in its own chunk so it
// doesn't slow the first page. Events carry a stack trace and the page's path,
// never query strings (reset links hold a token), breadcrumbs or user details.
import type { ErrorEvent } from '@sentry/browser'

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN

/** API errors are shown to the user and already reach the server's logs. */
const isExpected = (error: unknown) => (error as Error | undefined)?.name === 'ApiError'

export function scrubEvent(event: ErrorEvent): ErrorEvent {
  const url = event.request?.url?.split(/[?#]/)[0]
  delete event.request
  delete event.breadcrumbs
  delete event.user
  if (url) event.request = { url }
  return event
}

const sentry = dsn && typeof window !== 'undefined'
  ? import('./sentrySdk').then(Sentry => {
      Sentry.init({
        dsn,
        environment: process.env.NODE_ENV,
        release: process.env.NEXT_PUBLIC_RELEASE || undefined,
        // Connection drops on a phone aren't bugs, and extensions' errors aren't ours.
        ignoreErrors: ['Failed to fetch', 'Load failed', 'NetworkError'],
        allowUrls: [window.location.origin],
        defaultIntegrations: false,
        integrations: [
          Sentry.globalHandlersIntegration(),
          Sentry.eventFiltersIntegration(),
          Sentry.linkedErrorsIntegration(),
          Sentry.dedupeIntegration(),
          Sentry.httpContextIntegration(),
        ],
        beforeSend: (event, hint) => (isExpected(hint.originalException) ? null : scrubEvent(event)),
      })
      return Sentry
    })
  : null

/** Reports an error a developer should look at, such as one caught by an error boundary. */
export function reportError(error: unknown): void {
  if (isExpected(error)) return
  sentry?.then(Sentry => Sentry.captureException(error)).catch(() => undefined)
}
