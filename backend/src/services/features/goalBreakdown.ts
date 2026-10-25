// Goal breakdown: the AI suggests milestones for a goal. Nothing is saved
// here; the user picks which ones to add.
import { z } from 'zod';
import { prisma } from '../../config/database';
import { HttpError } from '../../utils/httpError';
import { dateKeyInZone } from '../../utils/dates';
import { clip, dataBlock } from '../ai/data';
import { assertAiReady } from '../ai/request';
import { generateStructured } from '../ai/structured';
import { isDateKey, nullable } from '../ai/time';

type User = { id: string; email: string; timezone: string };

const MAX_MILESTONES = 6;

export const goalBreakdownJsonSchema = {
  type: 'object',
  properties: {
    milestones: {
      type: 'array',
      description: `3 to ${MAX_MILESTONES} milestones, in the order they should be reached`,
      items: {
        type: 'object',
        properties: {
          title: { type: 'string', description: 'A checkpoint you can tick off, e.g. "Pass practice exam 2 with 75%"' },
          targetDate: nullable('string', 'YYYY-MM-DD, or null when the goal has no deadline'),
          why: { type: 'string', description: 'One short sentence' },
        },
        required: ['title', 'targetDate', 'why'],
        additionalProperties: false,
      },
    },
  },
  required: ['milestones'],
  additionalProperties: false,
} as const;

export const goalBreakdownSchema = z.object({
  milestones: z.array(z.object({ title: z.string(), targetDate: z.string().nullable(), why: z.string() })),
});

export interface SuggestedMilestone {
  title: string;
  targetDate: string | null;
  why: string;
}

/**
 * Drops empty titles and ones the goal already has, and keeps dates only if
 * they fall between today and the goal's deadline.
 */
export function normalizeMilestones(
  raw: z.infer<typeof goalBreakdownSchema>,
  rules: { todayKey: string; deadline: string | null; existing: string[] }
): SuggestedMilestone[] {
  const seen = new Set(rules.existing.map(t => t.trim().toLowerCase()));
  const result: SuggestedMilestone[] = [];
  for (const m of raw.milestones) {
    const title = clip(m.title, 200);
    if (!title || seen.has(title.toLowerCase())) continue;
    seen.add(title.toLowerCase());
    const dateOk = isDateKey(m.targetDate) && m.targetDate >= rules.todayKey && (!rules.deadline || m.targetDate <= rules.deadline);
    result.push({ title, targetDate: dateOk ? m.targetDate : null, why: clip(m.why, 200) ?? '' });
    if (result.length === MAX_MILESTONES) break;
  }
  return result;
}

const instructions = `You break a personal goal into milestones in GrowthTracker, a planning app.
- Suggest 3 to ${MAX_MILESTONES} milestones: concrete, verifiable checkpoints (not habits or vague intentions), in the order they should happen.
- Build on milestones the goal already has; don't repeat them.
- If the goal has a target date, spread target dates realistically between today and that date given the weekly hours. Otherwise use null.
- Titles are short (under 80 characters). Plain language, no emoji.`;

export async function suggestMilestones(user: User, goalId: string): Promise<SuggestedMilestone[]> {
  await assertAiReady(user.id);
  const goal = await prisma.goal.findFirst({
    where: { id: goalId, userId: user.id },
    include: {
      milestones: { select: { title: true, completed: true, targetDate: true }, orderBy: { createdAt: 'asc' } },
      tasks: { where: { status: { in: ['PENDING', 'IN_PROGRESS'] } }, select: { title: true }, take: 10 },
    },
  });
  if (!goal) throw new HttpError(404, 'Goal not found');

  const todayKey = dateKeyInZone(new Date(), user.timezone);
  const deadline = goal.targetDate ? goal.targetDate.toISOString().slice(0, 10) : null;
  const data = {
    today: todayKey,
    goal: {
      title: clip(goal.title, 100),
      description: clip(goal.description, 500),
      priority: goal.priority,
      targetDate: deadline ?? undefined,
      targetHoursPerWeek: goal.targetHoursWeekly,
      existingMilestones: goal.milestones.map(m => ({ title: clip(m.title, 100), done: m.completed })),
      openTasks: goal.tasks.map(t => clip(t.title, 80)),
    },
  };

  const { value } = await generateStructured({
    user,
    feature: 'goal_breakdown',
    instructions,
    input: dataBlock(data),
    schemaName: 'goal_breakdown',
    jsonSchema: goalBreakdownJsonSchema as unknown as Record<string, unknown>,
    validator: goalBreakdownSchema,
    maxOutputTokens: 1500,
  });
  return normalizeMilestones(value, { todayKey, deadline, existing: goal.milestones.map(m => m.title) });
}
