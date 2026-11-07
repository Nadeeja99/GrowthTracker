// The morning and evening push digests. Each is a short summary of the user's
// day, sent at the time they chose, in their own time zone.
import { prisma } from '../config/database';
import { addDays, dateKeyInZone, dateOnly, minutesIntoDayInZone, startOfDayInZone } from '../utils/dates';
import { logger } from '../utils/logger';
import { PushMessage, sendToUser } from './push';
import { clip } from './ai/data';

export type DigestKind = 'morning' | 'evening';

// The job runs every half hour but can run late or miss a turn, so a digest may
// go out this long after its time. Later than that it would just be noise.
const SEND_WINDOW_MINUTES = 120;
const KEEP_DELIVERIES_DAYS = 30;

export interface DayOverview {
  /** Unfinished time blocks today, earliest first. */
  blocks: Array<{ title: string; time: string }>;
  /** Open tasks due today or overdue. */
  tasksDue: number;
  /** Daily habits not done yet today. */
  habitsLeft: string[];
  reviewed: boolean;
}

const count = (n: number, noun: string) => `${n} ${noun}${n === 1 ? '' : 's'}`;

/** Null when there's nothing worth interrupting someone for. */
export function buildDigest(kind: DigestKind, day: DayOverview): PushMessage | null {
  const parts: string[] = [];

  if (kind === 'morning') {
    const [first] = day.blocks;
    if (first) parts.push(`${count(day.blocks.length, 'time block')}, starting with ${clip(first.title, 60)} at ${first.time}.`);
    if (day.tasksDue) parts.push(`${count(day.tasksDue, 'task')} due.`);
    if (day.habitsLeft.length) parts.push(`${count(day.habitsLeft.length, 'habit')} to do.`);
  } else {
    if (day.habitsLeft.length) {
      const names = day.habitsLeft.slice(0, 2).map(name => clip(name, 30)).join(', ');
      parts.push(`${count(day.habitsLeft.length, 'habit')} left: ${names}${day.habitsLeft.length > 2 ? ' and more' : ''}.`);
    }
    if (!day.reviewed) parts.push('Take a minute to review your day.');
  }

  if (!parts.length) return null;
  return {
    title: kind === 'morning' ? 'Your day ahead' : 'Evening check-in',
    body: parts.join(' '),
    url: '/today',
    tag: `digest-${kind}`,
  };
}

async function dayOverview(userId: string, timezone: string, now: Date): Promise<DayOverview> {
  const todayKey = dateKeyInZone(now, timezone);
  const today = dateOnly(todayKey);
  const time = new Intl.DateTimeFormat('en-GB', { timeZone: timezone, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });

  const [blocks, tasksDue, habits, reflection] = await Promise.all([
    prisma.schedule.findMany({
      where: {
        userId,
        status: { in: ['PENDING', 'IN_PROGRESS'] },
        startTime: { gte: startOfDayInZone(todayKey, timezone), lt: startOfDayInZone(addDays(todayKey, 1), timezone) },
      },
      select: { title: true, startTime: true },
      orderBy: { startTime: 'asc' },
    }),
    prisma.task.count({
      where: { userId, status: { in: ['PENDING', 'IN_PROGRESS'] }, dueDate: { lt: dateOnly(addDays(todayKey, 1)) } },
    }),
    prisma.habit.findMany({
      where: { userId, frequency: 'DAILY', completions: { none: { date: today } } },
      select: { name: true },
      orderBy: { createdAt: 'asc' },
    }),
    prisma.reflection.findFirst({ where: { userId, date: today }, select: { id: true } }),
  ]);

  return {
    blocks: blocks.map(b => ({ title: b.title, time: time.format(b.startTime) })),
    tasksDue,
    habitsLeft: habits.map(h => h.name),
    reviewed: !!reflection,
  };
}

const toMinutes = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));

export function isDigestDue(at: string, now: Date, timezone: string): boolean {
  const elapsed = minutesIntoDayInZone(now, timezone) - toMinutes(at);
  return elapsed >= 0 && elapsed < SEND_WINDOW_MINUTES;
}

/** Records that today's digest is being handled; false if it already was. */
async function claim(userId: string, kind: DigestKind, date: Date): Promise<boolean> {
  const { count } = await prisma.digestDelivery.createMany({ data: [{ userId, kind, date }], skipDuplicates: true });
  return count === 1;
}

/** Sends every digest that's due. Safe to call repeatedly. */
export async function runDigests(now = new Date()): Promise<{ users: number; sent: number }> {
  const users = await prisma.user.findMany({
    where: {
      OR: [{ morningDigestAt: { not: null } }, { eveningDigestAt: { not: null } }],
      pushSubscriptions: { some: {} },
    },
    select: { id: true, timezone: true, morningDigestAt: true, eveningDigestAt: true },
  });

  let sent = 0;
  for (const user of users) {
    const due = ([['morning', user.morningDigestAt], ['evening', user.eveningDigestAt]] as const)
      .filter(([, at]) => at && isDigestDue(at, now, user.timezone));

    for (const [kind] of due) {
      const date = dateOnly(dateKeyInZone(now, user.timezone));
      if (!(await claim(user.id, kind, date))) continue;

      const message = buildDigest(kind, await dayOverview(user.id, user.timezone, now));
      if (!message) continue;

      const result = await sendToUser(user.id, message);
      sent += result.sent;
      // Nothing got through, so let the next run try again.
      if (!result.sent && result.failed) {
        await prisma.digestDelivery.deleteMany({ where: { userId: user.id, kind, date } });
      }
    }
  }

  const cutoff = new Date(now.getTime() - KEEP_DELIVERIES_DAYS * 24 * 60 * 60 * 1000);
  await prisma.digestDelivery.deleteMany({ where: { createdAt: { lt: cutoff } } });

  logger.info('Digests run', { users: users.length, sent });
  return { users: users.length, sent };
}
