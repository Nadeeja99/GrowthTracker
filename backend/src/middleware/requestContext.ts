import { randomUUID } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { logger } from '../utils/logger';
import { AuthRequest } from './auth-simple';

declare module 'express-serve-static-core' {
  interface Request {
    id: string;
  }
}

const REQUEST_ID_HEADER = 'x-request-id';
const VALID_REQUEST_ID = /^[\w-]{1,64}$/;

// Tags every request with an id (reusing a well-formed upstream one, e.g. from
// a proxy), echoes it in the response, and logs one line per request on finish.
export const requestContext = (req: Request, res: Response, next: NextFunction): void => {
  const incoming = req.get(REQUEST_ID_HEADER);
  req.id = incoming && VALID_REQUEST_ID.test(incoming) ? incoming : randomUUID();
  res.setHeader(REQUEST_ID_HEADER, req.id);

  const startedAt = process.hrtime.bigint();
  res.on('finish', () => {
    const durationMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
    logger.info('request', {
      requestId: req.id,
      method: req.method,
      path: req.originalUrl.split('?')[0],
      status: res.statusCode,
      durationMs: Math.round(durationMs),
      userId: (req as AuthRequest).user?.id,
    });
  });

  next();
};
