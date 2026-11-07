import { timingSafeEqual } from 'crypto';
import { Request, Response, NextFunction } from 'express';
import { env } from '../config/env';

const expected = env.DIGEST_CRON_SECRET ? Buffer.from(`Bearer ${env.DIGEST_CRON_SECRET}`) : null;

/** For scheduled jobs, which can't come through the app's proxy. Hidden unless configured. */
export const requireCronSecret = (req: Request, res: Response, next: NextFunction): void => {
  if (!expected) {
    res.status(404).json({ success: false, error: 'Not found' });
    return;
  }
  const given = Buffer.from(req.get('authorization') ?? '');
  if (given.length === expected.length && timingSafeEqual(given, expected)) return next();
  res.status(401).json({ success: false, error: 'Unauthorized' });
};
