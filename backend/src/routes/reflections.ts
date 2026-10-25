import { Router } from 'express';
import { Reflection } from '@prisma/client';
import { prisma } from '../config/database';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { dateRangeSchema, importReflectionsSchema, reflectionDateParamSchema, reflectionSchema } from '../utils/validation';
import { logger } from '../utils/logger';
import { dateKeyInZone, dateOnly, resolveRange } from '../utils/dates';
import { HttpError } from '../utils/httpError';

const router = Router();

router.use(authenticate);

// `date` is a calendar day; send it as YYYY-MM-DD rather than a UTC timestamp.
const serialize = (reflection: Reflection) => ({ ...reflection, date: reflection.date.toISOString().slice(0, 10) });

// List reflections in a date range (defaults to the last year)
router.get('/', async (req: AuthRequest, res) => {
  const { id: userId, timezone } = req.user!;
  const range = resolveRange(dateRangeSchema.parse(req.query), timezone, 366);

  const reflections = await prisma.reflection.findMany({
    where: { userId, date: { gte: dateOnly(range.startKey), lte: dateOnly(range.endKey) } },
    orderBy: { date: 'asc' },
  });

  res.json({ success: true, data: { reflections: reflections.map(serialize) } });
});

// Create or replace the reflection for one day
router.put('/:date', async (req: AuthRequest, res) => {
  const { id: userId, timezone } = req.user!;
  const { date } = reflectionDateParamSchema.parse(req.params);
  const data = reflectionSchema.parse(req.body);

  if (date > dateKeyInZone(new Date(), timezone)) {
    throw new HttpError(400, 'Cannot write a reflection for a future day');
  }

  const reflection = await prisma.reflection.upsert({
    where: { userId_date: { userId, date: dateOnly(date) } },
    create: { userId, date: dateOnly(date), ...data },
    update: data,
  });

  logger.info('Reflection saved', { userId, date });

  res.json({ success: true, data: { reflection: serialize(reflection) } });
});

// Import reviews that older app versions stored only in the browser.
// Existing server-side reflections always win; nothing is overwritten.
router.post('/import', async (req: AuthRequest, res) => {
  const userId = req.user!.id;
  const { reflections } = importReflectionsSchema.parse(req.body);

  const rows = reflections
    .filter(r => r.performance != null || r.energy != null || r.mood != null || (r.notes ?? '').trim() !== '')
    .map(r => ({
      userId,
      date: dateOnly(r.date),
      performance: r.performance ?? null,
      energy: r.energy ?? null,
      mood: r.mood ?? null,
      notes: r.notes ?? null,
    }));

  const { count } = await prisma.reflection.createMany({ data: rows, skipDuplicates: true });

  logger.info('Reflections imported', { userId, received: reflections.length, imported: count });

  res.json({ success: true, data: { imported: count } });
});

export default router;
