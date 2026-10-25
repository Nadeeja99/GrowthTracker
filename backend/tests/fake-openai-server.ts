// Runs the fake OpenAI server on its own, for end-to-end tests and local UI
// work without an API key:
//   npx ts-node --transpile-only tests/fake-openai-server.ts   (port 5100)
// then start the API with OPENAI_API_KEY=sk-fake-... and
// OPENAI_BASE_URL=http://127.0.0.1:5100/v1.
/* eslint-disable @typescript-eslint/no-explicit-any -- reads arbitrary prompt data to fake answers */
import { startFakeOpenAI, Script } from './fake-openai';

const port = Number(process.env.FAKE_OPENAI_PORT ?? 5100);

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

function reply(body: Record<string, unknown>): Script {
  const data = dataOf(body);
  const format = (body.text as { format?: { name?: string } } | undefined)?.format?.name;
  const json = format === 'weekly_review' ? weeklyReview(data)
    : format === 'week_plan' ? weekPlan(data)
      : format === 'goal_breakdown' ? goalBreakdown(data)
        : null;
  return json ? { text: [JSON.stringify(json)] } : coachReply(data);
}

startFakeOpenAI(port).then(fake => {
  fake.script = reply;
  console.log(`Fake OpenAI listening on ${fake.url}`);
});
