// Actions the coach can propose ("add a 45-minute study block tomorrow at 7")
// and apply on the user's behalf. The model's output is never trusted as is:
// arguments are validated, clamped, and checked against the user's own data.
import { randomUUID } from 'crypto';
import { z } from 'zod';
import { Prisma } from '@prisma/client';
import { prisma } from '../../config/database';
import { HttpError } from '../../utils/httpError';
import { addDays, dateOnly, zonedTimeToInstant } from '../../utils/dates';
import { isDateKey, minutesOfDay, nullable } from '../ai/time';
import type { ToolDefinition } from '../ai/model';

// Arguments the model must produce for `suggest_actions`. Strict structured
// output requires every field, so fields that don't apply to a kind are null.
// The JSON Schema is sent to the model; the zod schema validates what comes back.
export const suggestActionsJsonSchema = {
  type: 'object',
  properties: {
    actions: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          type: { type: 'string', enum: ['task', 'time_block', 'habit'] },
          title: { type: 'string', description: 'Short, specific title, e.g. "Practice exam 2 (timed)"' },
          reason: { type: 'string', description: 'One sentence: why this helps, referring to the user\'s data' },
          goalId: nullable('string', 'id of one of the user\'s goals, or null'),
          priority: nullable('string', 'task only', { enum: ['LOW', 'MEDIUM', 'HIGH', null] }),
          dueDate: nullable('string', 'task only: YYYY-MM-DD'),
          date: nullable('string', 'time_block only: YYYY-MM-DD'),
          startTime: nullable('string', 'time_block only: 24h HH:MM in the user\'s time zone'),
          durationMinutes: nullable('integer', 'time_block only: 15 to 240'),
          frequency: nullable('string', 'habit only', { enum: ['DAILY', 'WEEKLY', 'MONTHLY', null] }),
        },
        required: ['type', 'title', 'reason', 'goalId', 'priority', 'dueDate', 'date', 'startTime', 'durationMinutes', 'frequency'],
        additionalProperties: false,
      },
    },
  },
  required: ['actions'],
  additionalProperties: false,
} as const;

/** The function the coach may call to propose actions. */
export const suggestActionsTool: ToolDefinition = {
  name: 'suggest_actions',
  description:
    'Propose up to 3 concrete actions the user can add to their plan with one click. ' +
    'Call this only when a specific task, time block or habit would clearly help; never for general advice.',
  parameters: suggestActionsJsonSchema as unknown as Record<string, unknown>,
};

export const suggestActionsSchema = z.object({
  actions: z.array(z.object({
    type: z.enum(['task', 'time_block', 'habit']),
    title: z.string(),
    reason: z.string(),
    goalId: z.string().nullable(),
    priority: z.enum(['LOW', 'MEDIUM', 'HIGH']).nullable(),
    dueDate: z.string().nullable(),
    date: z.string().nullable(),
    startTime: z.string().nullable(),
    durationMinutes: z.number().int().nullable(),
    frequency: z.enum(['DAILY', 'WEEKLY', 'MONTHLY']).nullable(),
  })),
});

interface SuggestionBase {
  id: string;
  title: string;
  reason: string;
  /** Set once the user has added it: the id of the record that was created. */
  appliedId?: string;
}

export type CoachSuggestion =
  | SuggestionBase & { kind: 'task'; goalId: string | null; priority: 'LOW' | 'MEDIUM' | 'HIGH'; dueDate: string | null }
  | SuggestionBase & { kind: 'time_block'; goalId: string | null; startTime: string; endTime: string }
  | SuggestionBase & { kind: 'habit'; frequency: 'DAILY' | 'WEEKLY' | 'MONTHLY' };

const MAX_SUGGESTIONS = 3;
/** Blocks and due dates can be proposed for at most this far ahead. */
const HORIZON_DAYS = 14;

const clip = (text: string, max: number) => text.trim().replace(/\s+/g, ' ').slice(0, max);

interface NormalizeContext {
  todayKey: string;
  timezone: string;
  goalIds: Set<string>;
  now?: Date;
}

/**
 * Turns the model's raw tool arguments into suggestions that can be applied
 * safely. Anything malformed, in the past, too far ahead, or pointing at a goal
 * the user doesn't own is dropped or unlinked rather than trusted.
 */
export function normalizeSuggestions(rawArgs: string | null, ctx: NormalizeContext): CoachSuggestion[] {
  if (!rawArgs) return [];
  let parsed: z.infer<typeof suggestActionsSchema>;
  try {
    parsed = suggestActionsSchema.parse(JSON.parse(rawArgs));
  } catch {
    return [];
  }

  const now = ctx.now ?? new Date();
  const lastDayKey = addDays(ctx.todayKey, HORIZON_DAYS);
  const inHorizon = (key: string | null): key is string =>
    isDateKey(key) && key >= ctx.todayKey && key <= lastDayKey;
  const ownGoal = (id: string | null) => (id && ctx.goalIds.has(id) ? id : null);

  const suggestions: CoachSuggestion[] = [];
  for (const action of parsed.actions) {
    const title = clip(action.title, 100);
    if (!title) continue;
    const base = { id: randomUUID(), title, reason: clip(action.reason, 240) };

    if (action.type === 'task') {
      suggestions.push({
        ...base,
        kind: 'task',
        goalId: ownGoal(action.goalId),
        priority: action.priority ?? 'MEDIUM',
        dueDate: inHorizon(action.dueDate) ? action.dueDate : null,
      });
    } else if (action.type === 'time_block') {
      const minutes = minutesOfDay(action.startTime);
      if (!inHorizon(action.date) || minutes === null || action.durationMinutes == null) continue;
      const duration = Math.min(Math.max(action.durationMinutes, 15), 240);
      const start = zonedTimeToInstant(action.date, minutes, ctx.timezone);
      if (start <= now) continue;
      suggestions.push({
        ...base,
        kind: 'time_block',
        goalId: ownGoal(action.goalId),
        startTime: start.toISOString(),
        endTime: new Date(start.getTime() + duration * 60_000).toISOString(),
      });
    } else {
      suggestions.push({ ...base, kind: 'habit', frequency: action.frequency ?? 'DAILY' });
    }
    if (suggestions.length === MAX_SUGGESTIONS) break;
  }
  return suggestions;
}

/**
 * Creates the record a suggestion describes and marks it as applied, so it
 * can't be added twice. Returns the updated suggestion.
 */
export async function applySuggestion(userId: string, messageId: string, suggestionId: string): Promise<CoachSuggestion> {
  return prisma.$transaction(async tx => {
    // Lock the message row so two concurrent clicks can't both apply.
    const locked = await tx.$queryRaw<Array<{ suggestions: unknown }>>`
      SELECT "suggestions" FROM "coach_messages"
      WHERE "id" = ${messageId} AND "userId" = ${userId} AND "role" = 'ASSISTANT'
      FOR UPDATE`;
    const suggestions = (locked[0]?.suggestions ?? null) as CoachSuggestion[] | null;
    const suggestion = suggestions?.find(s => s.id === suggestionId);
    if (!suggestions || !suggestion) throw new HttpError(404, 'Suggestion not found');
    if (suggestion.appliedId) throw new HttpError(409, 'This suggestion was already added');

    // The goal may have been deleted since the suggestion was made.
    const goalId = 'goalId' in suggestion && suggestion.goalId
      ? (await tx.goal.findFirst({ where: { id: suggestion.goalId, userId }, select: { id: true } }))?.id ?? null
      : null;

    let appliedId: string;
    if (suggestion.kind === 'task') {
      appliedId = (await tx.task.create({
        data: {
          userId,
          goalId,
          title: suggestion.title,
          priority: suggestion.priority,
          dueDate: suggestion.dueDate ? dateOnly(suggestion.dueDate) : null,
        },
        select: { id: true },
      })).id;
    } else if (suggestion.kind === 'time_block') {
      appliedId = (await tx.schedule.create({
        data: {
          userId,
          goalId,
          title: suggestion.title,
          startTime: new Date(suggestion.startTime),
          endTime: new Date(suggestion.endTime),
        },
        select: { id: true },
      })).id;
    } else {
      appliedId = (await tx.habit.create({
        data: { userId, name: suggestion.title, frequency: suggestion.frequency },
        select: { id: true },
      })).id;
    }

    const updated = suggestions.map(s => (s.id === suggestionId ? { ...s, appliedId } : s));
    await tx.coachMessage.update({
      where: { id: messageId },
      data: { suggestions: updated as unknown as Prisma.InputJsonValue },
    });
    return { ...suggestion, appliedId };
  });
}
