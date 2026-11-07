import { randomBytes } from 'crypto';
import { Request, Response, Router } from 'express';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { DEMO_EMAIL } from '../config/demo';
import { authenticate, AuthRequest } from '../middleware/auth-simple';
import { buildCalendar } from '../services/calendarFeed';
import { addDays, dateKeyInZone, dateOnly, startOfDayInZone } from '../utils/dates';
import { HttpError } from '../utils/httpError';

const DAYS_BACK = 30;
const DAYS_AHEAD = 180;
const MAX_ITEMS = 1000;

/**
 * The private feed calendar apps subscribe to. They can't sign in, so the long
 * random token in the URL is the only credential. It's stored as it is, not
 * hashed, because the user needs to see the link again, and it opens nothing
 * that someone reading the database couldn't already read.
 */
export async function calendarFeed(req: Request, res: Response): Promise<void> {
  const token = /^([\w-]{43})\.ics$/.exec(req.params.file)?.[1];
  const user = token && await prisma.user.findUnique({
    where: { calendarToken: token },
    select: { id: true, timezone: true },
  });
  if (!user) {
    res.status(404).type('text/plain').send('Not found');
    return;
  }

  const today = dateKeyInZone(new Date(), user.timezone);
  const from = addDays(today, -DAYS_BACK);
  const to = addDays(today, DAYS_AHEAD);

  const [blocks, tasks] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        userId: user.id,
        status: { in: ['PENDING', 'IN_PROGRESS', 'COMPLETED'] },
        startTime: { gte: startOfDayInZone(from, user.timezone), lt: startOfDayInZone(to, user.timezone) },
      },
      select: { id: true, title: true, startTime: true, endTime: true, allDay: true, updatedAt: true, goal: { select: { title: true } } },
      orderBy: { startTime: 'asc' },
      take: MAX_ITEMS,
    }),
    prisma.task.findMany({
      where: {
        userId: user.id,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        dueDate: { gte: dateOnly(from), lt: dateOnly(to) },
      },
      select: { id: true, title: true, dueDate: true, updatedAt: true },
      orderBy: { dueDate: 'asc' },
      take: MAX_ITEMS,
    }),
  ]);

  const dated = tasks.map(task => ({ ...task, dueDate: task.dueDate! }));
  res.set({
    'Content-Type': 'text/calendar; charset=utf-8',
    'Content-Disposition': 'inline; filename="growthtracker.ics"',
    'Cache-Control': 'private, max-age=300',
    'X-Robots-Tag': 'noindex',
  });
  res.send(buildCalendar(blocks, dated, { appUrl: env.appUrl, dayOf: instant => dateKeyInZone(instant, user.timezone) }));
}

const router = Router();

router.use(authenticate);

// The demo account is shared, so a link to it would be everyone's to reset.
const assertNotDemo = (req: AuthRequest) => {
  if (req.user!.email === DEMO_EMAIL) throw new HttpError(403, 'Not available on the shared demo account.');
};

router.get('/', async (req: AuthRequest, res) => {
  const { calendarToken } = await prisma.user.findUniqueOrThrow({
    where: { id: req.user!.id },
    select: { calendarToken: true },
  });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { token: calendarToken } });
});

// Turns the feed on, or replaces the link if it's on: the old link stops working.
router.post('/', async (req: AuthRequest, res) => {
  assertNotDemo(req);
  const token = randomBytes(32).toString('base64url');
  await prisma.user.update({ where: { id: req.user!.id }, data: { calendarToken: token } });
  res.set('Cache-Control', 'no-store');
  res.json({ success: true, data: { token } });
});

router.delete('/', async (req: AuthRequest, res) => {
  await prisma.user.update({ where: { id: req.user!.id }, data: { calendarToken: null } });
  res.json({ success: true, data: { token: null } });
});

export default router;
