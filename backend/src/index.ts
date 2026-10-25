// `env` must load first: it reads .env and validates configuration before any
// other module captures values from process.env.
import { env } from './config/env';
import { Server } from 'http';
import { app } from './app';
import { logger } from './utils/logger';
import { connectDB, disconnectDB } from './config/database';

const SHUTDOWN_TIMEOUT_MS = 10_000;
let server: Server | undefined;
let shuttingDown = false;

// Stop accepting connections, let in-flight requests finish, close the
// database pool, then exit. Hosts send SIGTERM before replacing an instance.
const shutdown = (reason: string, exitCode = 0) => {
  if (shuttingDown) return;
  shuttingDown = true;
  logger.info('Shutting down', { reason });

  const forceExit = setTimeout(() => {
    logger.error('Graceful shutdown timed out; forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  const closeServer = server
    ? new Promise<void>(resolve => server!.close(() => resolve()))
    : Promise.resolve();

  closeServer
    .then(() => disconnectDB())
    .catch(error => logger.error('Error during shutdown', { error }))
    .finally(() => process.exit(exitCode));
};

const startServer = async () => {
  try {
    await connectDB();
    server = app.listen(env.PORT, () => {
      logger.info('Server started', { port: env.PORT, environment: env.NODE_ENV });
    });
  } catch (error) {
    logger.error('Failed to start server', { error });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  logger.error('Unhandled promise rejection', { reason });
  shutdown('unhandledRejection', 1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught exception', { error: error.message, stack: error.stack });
  shutdown('uncaughtException', 1);
});

startServer();
