// Error reporting to Sentry. Without SENTRY_DSN nothing is initialised and
// every call here does nothing. Events carry a stack trace and the context
// passed in, never request data: bodies hold passwords and journal entries,
// and headers hold tokens and the proxy secret.
import * as Sentry from '@sentry/node';
import { waitUntil } from '@vercel/functions';
import { env } from '../config/env';

/** Removes everything Sentry attaches on its own that could hold user data. */
export function scrubEvent<T extends Sentry.Event>(event: T): T {
  delete event.request;
  delete event.breadcrumbs;
  delete event.user; // Sentry fills in the client's IP address here
  delete event.server_name;
  return event;
}

if (env.SENTRY_DSN) {
  Sentry.init({
    dsn: env.SENTRY_DSN,
    environment: env.NODE_ENV,
    release: process.env.VERCEL_GIT_COMMIT_SHA,
    // Only exceptions: the defaults also hook every request, record bodies and
    // collect breadcrumbs, none of which should leave this server.
    defaultIntegrations: false,
    integrations: [
      Sentry.onUncaughtExceptionIntegration(),
      Sentry.onUnhandledRejectionIntegration(),
      Sentry.linkedErrorsIntegration(),
    ],
    beforeSend: scrubEvent,
  });
}

/** Reports a failure a developer should look at. Expected errors (4xx) don't belong here. */
export function reportError(error: unknown, context?: Record<string, unknown>): void {
  Sentry.captureException(error, { extra: context });
  // On Vercel the function can be paused once the response is sent, before the
  // report goes out; this keeps it running until then. Elsewhere it's a no-op.
  if (env.SENTRY_DSN) waitUntil(Sentry.flush(2_000));
}

/** Sends anything queued, for use just before the process exits. */
export async function flushErrors(): Promise<void> {
  await Sentry.close(2_000);
}
