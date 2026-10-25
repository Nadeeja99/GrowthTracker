// Seeds a demo account with realistic, invented data (goals, milestones, tasks,
// a week of time blocks, habits, reviews and focus sessions). Re-runnable: it
// deletes and recreates only the demo user.
//
//   npm run db:seed                  (development, via ts-node)
//   node dist/scripts/seed.js        (production build, e.g. on Render)
import bcrypt from 'bcryptjs';
import { env } from '../config/env';
import { prisma } from '../config/database';
import { addDays, dateKeyInZone, dateOnly, startOfDayInZone } from '../utils/dates';

export const DEMO_EMAIL = process.env.SEED_DEMO_EMAIL ?? 'demo@growthtracker.dev';
const DEMO_PASSWORD = process.env.SEED_DEMO_PASSWORD ?? 'demo-password-1';
const TIMEZONE = process.env.SEED_TIMEZONE ?? 'UTC';

export async function seedDemo() {
  const today = dateKeyInZone(new Date(), TIMEZONE);
  const day = (offset: number) => addDays(today, offset);
  // A wall-clock time on a calendar day in the demo user's zone.
  const at = (offset: number, hour: number, minute = 0) =>
    new Date(startOfDayInZone(day(offset), TIMEZONE).getTime() + (hour * 60 + minute) * 60_000);

  await prisma.user.deleteMany({ where: { email: DEMO_EMAIL } });
  const user = await prisma.user.create({
    data: {
      email: DEMO_EMAIL,
      username: 'demo',
      password: await bcrypt.hash(DEMO_PASSWORD, env.BCRYPT_ROUNDS),
      firstName: 'Alex',
      lastName: 'Morgan',
      timezone: TIMEZONE,
    },
  });
  const userId = user.id;

  const aws = await prisma.goal.create({
    data: {
      userId, title: 'AWS Solutions Architect cert', description: 'Pass the associate exam by March.',
      priority: 'HIGH', color: '#3B82F6', targetHoursWeekly: 6, targetHoursDaily: 1, progress: 50,
      milestones: { create: [
        { title: 'Finish practice exam 1', completed: true },
        { title: 'Networking module', completed: true },
        { title: 'Practice exam 2' },
        { title: 'Book exam slot' },
      ] },
    },
  });
  const run = await prisma.goal.create({
    data: {
      userId, title: 'Half marathon', description: 'Finish under 2 hours.', priority: 'MEDIUM',
      color: '#10B981', targetHoursWeekly: 4, targetHoursDaily: 1,
      milestones: { create: [{ title: 'Run 10k without stopping' }] },
    },
  });
  const read = await prisma.goal.create({
    data: { userId, title: 'Read 20 books', priority: 'LOW', color: '#F59E0B', targetHoursWeekly: 3, targetHoursDaily: 0.5 },
  });

  const exam = await prisma.task.create({
    data: {
      userId, goalId: aws.id, title: 'Practice exam 2 (timed)', priority: 'HIGH', estimatedTime: 120, dueDate: dateOnly(day(1)),
      subtasks: { create: [
        { title: 'Review VPC notes', completed: true, position: 0 },
        { title: 'Take the exam', position: 1 },
        { title: 'Log weak areas', position: 2 },
      ] },
      tags: { create: [{ name: 'exam', userId }, { name: 'aws', userId }] },
    },
  });
  await prisma.task.create({
    data: { userId, goalId: run.id, title: 'Buy new running shoes', priority: 'MEDIUM', tags: { create: [{ name: 'errand', userId }] } },
  });
  await prisma.task.create({ data: { userId, title: 'Write README for portfolio', priority: 'HIGH', dueDate: dateOnly(day(-1)) } });
  await prisma.task.create({ data: { userId, goalId: read.id, title: 'Finish "Deep Work" chapter 4', priority: 'LOW' } });

  const blocks = [];
  for (let d = -3; d <= 3; d++) {
    blocks.push({ userId, goalId: aws.id, title: 'AWS study', startTime: at(d, 7), endTime: at(d, 8, 30), status: d < 0 ? 'COMPLETED' as const : 'PENDING' as const });
    if (d % 2 === 0) {
      blocks.push({
        userId, goalId: run.id, title: 'Easy run', startTime: at(d, 18), endTime: at(d, 19),
        status: d < 0 ? (d === -2 ? 'SKIPPED' as const : 'COMPLETED' as const) : 'PENDING' as const,
      });
    }
  }
  blocks.push({ userId, goalId: aws.id, taskId: exam.id, title: 'Practice exam 2', startTime: at(0, 14), endTime: at(0, 16), status: 'PENDING' as const });
  await prisma.schedule.createMany({ data: blocks });

  const readHabit = await prisma.habit.create({ data: { userId, name: 'Read 20 pages', frequency: 'DAILY' } });
  const meditate = await prisma.habit.create({ data: { userId, name: 'Meditate', frequency: 'DAILY' } });
  await prisma.habit.create({ data: { userId, name: 'Weekly planning', frequency: 'WEEKLY' } });
  const completions = [];
  for (let d = -9; d <= 0; d++) {
    if (d !== -4) completions.push({ habitId: readHabit.id, date: dateOnly(day(d)) });
    if (d < 0 && d % 3 !== 0) completions.push({ habitId: meditate.id, date: dateOnly(day(d)) });
  }
  await prisma.habitCompletion.createMany({ data: completions });

  await prisma.reflection.createMany({
    data: [-6, -5, -4, -3, -2, -1].map(d => ({
      userId, date: dateOnly(day(d)), performance: d % 2 ? 4 : 3, energy: d === -2 ? 2 : 4, mood: 4,
      notes: d === -2 ? 'Slept badly, skipped the run.' : 'Solid day.',
    })),
  });

  await prisma.focusSession.createMany({
    data: [-3, -2, -1].map(d => ({
      userId, goalId: aws.id, taskId: exam.id, startedAt: at(d, 10), endedAt: at(d, 10, 25),
      durationSeconds: 1500, plannedSeconds: 1500, completed: true,
    })),
  });
  await prisma.task.update({ where: { id: exam.id }, data: { actualTime: 75 } });

  return { email: DEMO_EMAIL };
}

if (require.main === module) {
  seedDemo()
    .then(({ email }) => console.log(`Seeded demo account ${email}`))
    .catch(error => {
      console.error(error);
      process.exitCode = 1;
    })
    .finally(() => prisma.$disconnect());
}
