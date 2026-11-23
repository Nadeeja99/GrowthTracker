// Scripted answers for every AI feature, shaped like the real ones and built
// from the data in each prompt. Used by the stand-alone fake server
// (fake-openai-server.ts, for the browser tests) and by the evaluation set's
// harness check (evals/run.ts --provider fake).
/* eslint-disable @typescript-eslint/no-explicit-any -- reads arbitrary prompt data to fake answers */
import type { Script } from './fake-openai';

// The data block every AI prompt ends with.
function dataOf(body: Record<string, unknown>) {
  const text = `${body.instructions ?? ''}\n${body.input ?? ''}`;
  const block = text.slice(text.lastIndexOf('<data>') + '<data>'.length, text.lastIndexOf('</data>'));
  return JSON.parse(block.trim() || '{}');
}

const addDays = (key: string, days: number) => new Date(Date.parse(`${key}T00:00:00Z`) + days * 86_400_000).toISOString().slice(0, 10);

function coachReply(data: any): Script {
  const goal = data.goals?.[0];
  const words = `You have ${data.goals?.length ?? 0} active goals. ${goal ? `${goal.title} has ${goal.hoursLast7Days} h this week against a ${goal.targetHoursPerWeek} h target.` : ''}\n\n- Protect one focused block a day.\n- Review your plan each evening.\n\nI suggested a block for tomorrow evening.`;
  return {
    delayMs: 40,
    text: words.match(/\S+\s*/g) ?? [],
    toolArgs: JSON.stringify({
      actions: [{
        type: 'time_block', title: 'Focused session', reason: 'Keeps your top goal moving.',
        goalId: goal?.id ?? null, priority: null, dueDate: null,
        date: addDays(data.now?.date ?? '2026-01-01', 1), startTime: '19:00', durationMinutes: 45, frequency: null,
      }],
    }),
  };
}

function weeklyReview(data: any) {
  const goal = data.goals?.[0];
  const reviewed = (data.days ?? []).filter((d: any) => d.review);
  return {
    headline: `${data.days?.reduce((n: number, d: any) => n + d.blocksCompleted, 0) ?? 0} blocks completed across ${data.week?.daysSoFar ?? 0} days.`,
    wins: [goal ? `${goal.title}: ${goal.hoursThisWeek} h logged` : 'You showed up', 'Daily reviews kept'],
    slips: ['A planned run was skipped'],
    patterns: [{ observation: 'Low-energy days line up with skipped blocks', evidence: `${reviewed.length} reviewed days this week` }],
    priorities: [{ title: 'Book two runs before Wednesday', why: 'Half marathon is behind target.', goalId: data.goals?.[1]?.id ?? null }],
  };
}

function weekPlan(data: any) {
  const goals = data.goals ?? [];
  const blocks = (data.plannableDays ?? []).slice(0, 3).flatMap((date: string, i: number) => [
    { title: `${goals[i % Math.max(goals.length, 1)]?.title ?? 'Deep work'} session`, goalId: goals[i % Math.max(goals.length, 1)]?.id ?? null, date, startTime: '07:00', durationMinutes: 60, reason: 'Morning focus before the day fills up.' },
    { title: 'Evening review', goalId: null, date, startTime: '20:00', durationMinutes: 30, reason: 'Close the day with a plan for tomorrow.' },
  ]);
  return { summary: 'Mornings for your top goal, short evening reviews to keep momentum.', blocks };
}

function goalBreakdown(data: any) {
  const title = data.goal?.title ?? 'the goal';
  return {
    milestones: [
      { title: `Outline a plan for ${title}`, targetDate: null, why: 'Know the steps.' },
      { title: 'Reach the halfway checkpoint', targetDate: null, why: 'Proves the pace works.' },
      { title: 'Final dress rehearsal', targetDate: null, why: 'Removes surprises.' },
    ],
  };
}

function journalReply(data: any): Script {
  const note = data.notes[0];
  return { delayMs: 40, text: `In the notes I found, you wrote: ${note.notes} [${note.date}]`.match(/\S+\s*/g) ?? [] };
}

/** Plausible answers for every AI feature, built from the prompt's data. */
export function fakeReply(body: Record<string, unknown>): Script {
  const data = dataOf(body);
  if (data.totalNotes) return journalReply(data);
  const format = (body.text as { format?: { name?: string } } | undefined)?.format?.name;
  const json = format === 'weekly_review' ? weeklyReview(data)
    : format === 'week_plan' ? weekPlan(data)
      : format === 'goal_breakdown' ? goalBreakdown(data)
        : null;
  return json ? { text: [JSON.stringify(json)] } : coachReply(data);
}
