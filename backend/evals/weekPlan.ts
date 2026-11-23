// "Plan my week" over fixed scenarios, each graded on what a good plan needs:
//   valid       share of the model's blocks that survived the server's rules
//   goals       how close each goal's planned hours came to what it still needed
//   risk        the plan's average skip risk, against blocks placed at random
//               in the same free time (only once there's a record to judge by)
//   sizing      task blocks sized from how long tasks really take this person
import request from 'supertest';
import { app } from '../src/app';
import { prisma } from '../src/config/database';
import { AiModel, getAiModel, setAiModelForTests } from '../src/services/ai/model';
import { weekStartKey } from '../src/services/ai/time';
import { MODEL as ESTIMATES, predictDuration } from '../src/services/estimates/calibration';
import { timedHistory } from '../src/services/estimates/history';
import { generateWeekPlan } from '../src/services/features/weekPlan';
import { blockRisks } from '../src/services/skipRisk/blocks';
import { addDays, dateKeyInZone } from '../src/utils/dates';
import { auth, registerUser, resetDatabase } from '../tests/helpers';

type Priority = 'LOW' | 'MEDIUM' | 'HIGH';
interface Scenario {
  id: string;
  about: string;
  window: { start: string; end: string };
  goals: Array<{ key: string; title: string; targetHoursWeekly: number; priority: Priority }>;
  /** Next week's existing blocks: [day 0-6 (Sunday first), start, end, goal key or null]. */
  busy: Array<[number, string, string, string | null]>;
  /** Weeks of kept morning blocks and missed evening ones. */
  morningPerson?: boolean;
  /** Finished tasks: [estimate, actual] minutes. */
  timedTasks?: Array<[number, number]>;
  openTasks?: Array<{ title: string; goal: string; estimate: number }>;
}

export const SCENARIOS: Scenario[] = [
  {
    id: 'morning-person',
    about: 'Works 9-5 on weekdays, keeps early blocks and misses evening ones, and underestimates tasks',
    window: { start: '06:00', end: '22:00' },
    goals: [
      { key: 'thesis', title: 'Finish thesis draft', targetHoursWeekly: 8, priority: 'HIGH' },
      { key: 'gym', title: 'Strength training', targetHoursWeekly: 3, priority: 'MEDIUM' },
    ],
    busy: [1, 2, 3, 4, 5].map(d => [d, '09:00', '17:00', null] as [number, string, string, null]),
    morningPerson: true,
    timedTasks: [[30, 50], [60, 95], [45, 70], [30, 55]],
    openTasks: [{ title: 'Write literature review', goal: 'thesis', estimate: 60 }],
  },
  {
    id: 'new-user',
    about: 'No history, one goal, a free week',
    window: { start: '09:00', end: '18:00' },
    goals: [{ key: 'spanish', title: 'Learn Spanish', targetHoursWeekly: 5, priority: 'MEDIUM' }],
    busy: [],
  },
  {
    id: 'nearly-planned',
    about: 'Most of the goal is already planned, so little should be added',
    window: { start: '18:00', end: '22:00' },
    goals: [{ key: 'reading', title: 'Read more', targetHoursWeekly: 4, priority: 'LOW' }],
    busy: [[1, '19:00', '20:10', 'reading'], [3, '19:00', '20:10', 'reading'], [5, '19:00', '20:10', 'reading']],
  },
  {
    id: 'packed-week',
    about: 'Only Saturday 10:00-12:00 is free',
    window: { start: '08:00', end: '20:00' },
    goals: [{ key: 'side', title: 'Side project', targetHoursWeekly: 6, priority: 'HIGH' }],
    busy: [0, 1, 2, 3, 4, 5].map(d => [d, '08:00', '20:00', null] as [number, string, string, null])
      .concat([[6, '08:00', '10:00', null], [6, '12:00', '20:00', null]]),
  },
];

export interface ScenarioReport {
  id: string;
  about: string;
  proposed: number;
  kept: number;
  goals: Array<{ goal: string; neededHours: number; plannedHours: number }>;
  goalScore: number;
  overshoot: boolean;
  risk: { plan: number; randomPlacement: number } | null;
  sizing: Array<{ task: string; usuallyTakesMinutes: number; blockMinutes: number }>;
  error?: string;
}

const at = (day: string, time: string) => new Date(`${day}T${time}:00.000Z`);
const minutes = (a: Date | string, b: Date | string) => (new Date(b).getTime() - new Date(a).getTime()) / 60_000;

/** The model behind the app, recording the raw plans it returns. */
function recording(base: AiModel, raw: unknown[]): AiModel {
  return {
    name: base.name,
    reply: r => base.reply(r),
    embed: r => base.embed(r),
    generate: async r => {
      const result = await base.generate(r);
      raw.push(JSON.parse(result.json));
      return result;
    },
  };
}

async function build(s: Scenario, weekStart: string) {
  const user = await registerUser(app, { timezone: 'UTC' });
  await request(app).put('/api/coach/settings').set(auth(user.token)).send({ enabled: true }).expect(200);
  const userId = user.user.id;
  const goalIds = new Map<string, string>();
  for (const g of s.goals) {
    goalIds.set(g.key, (await prisma.goal.create({ data: { userId, title: g.title, targetHoursWeekly: g.targetHoursWeekly, priority: g.priority } })).id);
  }
  for (const [d, start, end, goal] of s.busy) {
    const day = addDays(weekStart, d);
    await prisma.schedule.create({ data: { userId, title: goal ? 'Planned' : 'Work', startTime: at(day, start), endTime: at(day, end), goalId: goal ? goalIds.get(goal) : null } });
  }
  if (s.morningPerson) {
    const today = dateKeyInZone(new Date(), 'UTC');
    for (let d = 3; d < 17; d++) {
      const day = addDays(today, -d);
      await prisma.schedule.createMany({ data: [
        { userId, title: 'Early work', status: 'COMPLETED', startTime: at(day, '06:30'), endTime: at(day, '08:00') },
        { userId, title: 'Evening work', status: 'SKIPPED', startTime: at(day, '19:00'), endTime: at(day, '20:30') },
      ] });
    }
  }
  for (const [estimate, actual] of s.timedTasks ?? []) {
    await prisma.task.create({ data: { userId, title: 'Done', status: 'COMPLETED', estimatedTime: estimate, actualTime: actual, completedAt: new Date() } });
  }
  for (const t of s.openTasks ?? []) {
    await prisma.task.create({ data: { userId, title: t.title, estimatedTime: t.estimate, goalId: goalIds.get(t.goal) } });
  }
  return { user: { id: userId, email: user.email, timezone: 'UTC' }, goalIds };
}

/** Average risk of hour-long blocks placed on every free hour of the window. */
async function randomPlacementRisk(user: { id: string; timezone: string }, s: Scenario, weekStart: string) {
  const busy = s.busy.map(([d, a, b]) => ({ start: at(addDays(weekStart, d), a), end: at(addDays(weekStart, d), b) }));
  const slots = [];
  for (let d = 0; d < 7; d++) {
    const day = addDays(weekStart, d);
    for (let h = Number(s.window.start.slice(0, 2)); h + 1 <= Number(s.window.end.slice(0, 2)); h++) {
      const start = at(day, `${String(h).padStart(2, '0')}:00`);
      const end = new Date(start.getTime() + 3_600_000);
      if (!busy.some(b => b.start < end && start < b.end)) slots.push({ id: `${d}-${h}`, startTime: start, endTime: end, plannedAt: new Date(), goalId: null });
    }
  }
  const { risks } = await blockRisks(user, slots);
  return risks?.length ? risks.reduce((t, r) => t + r.probability, 0) / risks.length : null;
}

export async function evaluateWeekPlans(scenarios = SCENARIOS): Promise<ScenarioReport[]> {
  const base = getAiModel();
  if (!base) throw new Error('No AI model configured: set OPENAI_API_KEY, or use --provider fake');
  const weekStart = addDays(weekStartKey(dateKeyInZone(new Date(), 'UTC')), 7);
  const reports: ScenarioReport[] = [];
  try {
    for (const s of scenarios) {
      await resetDatabase();
      const raw: Array<{ blocks?: unknown[] }> = [];
      setAiModelForTests(recording(base, raw));
      const { user, goalIds } = await build(s, weekStart);
      try {
        const plan = await generateWeekPlan(user, weekStart, s.window);
        const goals = s.goals.map(g => {
          const id = goalIds.get(g.key);
          const already = s.busy.filter(([, , , goal]) => goal === g.key).reduce((t, [d, a, b]) => t + minutes(at(addDays(weekStart, d), a), at(addDays(weekStart, d), b)), 0) / 60;
          const planned = plan.blocks.filter(b => b.goalId === id).reduce((t, b) => t + minutes(b.startTime, b.endTime), 0) / 60;
          return { goal: g.title, neededHours: Math.max(g.targetHoursWeekly - already, 0), plannedHours: Math.round(planned * 10) / 10 };
        });
        const scores = goals.map(g => 1 - Math.min(Math.abs(g.plannedHours - g.neededHours) / Math.max(g.neededHours, 1), 1));
        const risks = plan.blocks.map(b => b.risk?.probability).filter((p): p is number => p != null);
        const random = risks.length ? await randomPlacementRisk(user, s, weekStart) : null;
        const timed = await timedHistory(user.id);
        const sizing = timed.length >= ESTIMATES.minHistory
          ? (s.openTasks ?? []).flatMap(t => {
            const usual = predictDuration(ESTIMATES, { estimateMinutes: t.estimate, priority: 'MEDIUM', subtasks: 0, hasDueDate: false, goalId: goalIds.get(t.goal) ?? null }, timed).predictedMinutes;
            return plan.blocks.filter(b => b.title.toLowerCase().includes(t.title.toLowerCase()))
              .map(b => ({ task: t.title, usuallyTakesMinutes: Math.round(usual), blockMinutes: minutes(b.startTime, b.endTime) }));
          })
          : [];
        reports.push({
          id: s.id,
          about: s.about,
          proposed: raw[0]?.blocks?.length ?? 0,
          kept: plan.blocks.length,
          goals,
          goalScore: Math.round((scores.reduce((a, b) => a + b, 0) / scores.length) * 100) / 100,
          overshoot: goals.some(g => g.plannedHours > g.neededHours + 1),
          risk: risks.length && random != null
            ? { plan: Math.round((risks.reduce((a, b) => a + b, 0) / risks.length) * 100) / 100, randomPlacement: Math.round(random * 100) / 100 }
            : null,
          sizing,
        });
      } catch (error) {
        reports.push({ id: s.id, about: s.about, proposed: raw[0]?.blocks?.length ?? 0, kept: 0, goals: [], goalScore: 0, overshoot: false, risk: null, sizing: [], error: (error as Error).message });
      }
    }
  } finally {
    setAiModelForTests(undefined);
  }
  return reports;
}
