import winston from 'winston';
import { env } from '../config/env';

// Logs go to stdout only: hosting platforms (Render, Fly, Docker) collect
// stdout, while local log files are lost on every deploy or restart.
// Production emits one JSON object per line so log search can index fields.
const logger = winston.createLogger({
  level: env.LOG_LEVEL,
  defaultMeta: { service: 'growthtracker-backend' },
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.Console({
      silent: env.NODE_ENV === 'test',
      format: env.isProduction
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.printf(({ timestamp, level, message, service: _service, ...meta }) => {
              return `${timestamp} [${level}]: ${message} ${
                Object.keys(meta).length ? JSON.stringify(meta) : ''
              }`;
            })
          ),
    }),
  ],
});

export { logger };
