// Runs the fake OpenAI server on its own, for end-to-end tests and local UI
// work without an API key:
//   npx ts-node --transpile-only tests/fake-openai-server.ts   (port 5100)
// then start the API with OPENAI_API_KEY=sk-fake-... and
// OPENAI_BASE_URL=http://127.0.0.1:5100/v1.
import { startFakeOpenAI } from './fake-openai';

const port = Number(process.env.FAKE_OPENAI_PORT ?? 5100);

// Pulls a goal id and "now" out of the coach's data block so the suggestion is valid.
function reply(body: Record<string, unknown>) {
  const instructions = String(body.instructions ?? '');
  const block = instructions.slice(instructions.lastIndexOf('<data>') + '<data>'.length, instructions.lastIndexOf('</data>'));
  const data = JSON.parse(block.trim() || '{}');
  const goal = data.goals?.[0];
  const tomorrow = new Date(Date.parse(`${data.now?.date ?? '2026-01-01'}T00:00:00Z`) + 86_400_000).toISOString().slice(0, 10);
  const words = `You have ${data.goals?.length ?? 0} active goals. ${goal ? `${goal.title} has ${goal.hoursLast7Days} h this week against a ${goal.targetHoursPerWeek} h target.` : ''}\n\n- Protect one focused block a day.\n- Review your plan each evening.\n\nI suggested a block for tomorrow evening.`;
  return {
    delayMs: 40,
    text: words.match(/\S+\s*/g) ?? [],
    toolArgs: JSON.stringify({
      actions: [{
        type: 'time_block', title: 'Focused session', reason: 'Keeps your top goal moving.',
        goalId: goal?.id ?? null, priority: null, dueDate: null,
        date: tomorrow, startTime: '19:00', durationMinutes: 45, frequency: null,
      }],
    }),
  };
}

startFakeOpenAI(port).then(fake => {
  fake.script = reply;
  console.log(`Fake OpenAI listening on ${fake.url}`);
});
