// Error reporting to Sentry. Without SENTRY_DSN nothing is initialised and
// every call here does nothing. Events carry a stack trace and the context
// passed in, never request data: bodies hold passwords and journal entries,
// and headers hold tokens and the proxy secret.
import * as Sentry from '@sentry/node';
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
    release: process.env.RENDER_GIT_COMMIT,
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
}

/** Sends anything queued, for use just before the process exits. */
export async function flushErrors(): Promise<void> {
  await Sentry.close(2_000);
}
