// The parts of Sentry the app uses. Importing the package dynamically would
// bundle all of it (replay, feedback and more), about 140 KB; going through
// named exports here lets the bundler leave the rest out.
export {
  captureException,
  dedupeIntegration,
  eventFiltersIntegration,
  globalHandlersIntegration,
  httpContextIntegration,
  init,
  linkedErrorsIntegration,
} from '@sentry/browser'
