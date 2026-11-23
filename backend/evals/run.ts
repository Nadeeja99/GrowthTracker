// Runs the evaluation set and prints a report.
//
//   TEST_DATABASE_URL=postgresql://…/growthtracker_test npm run eval                    # fake provider
//   TEST_DATABASE_URL=… OPENAI_API_KEY=sk-… npm run eval -- --provider openai --out report.json
//
// The database must be a disposable one whose name ends in "_test": it's wiped.
// With the fake provider, only keyword retrieval measures anything real; the
// rest checks that the harness works. With OpenAI it costs roughly 30 model
// requests and a few thousand embedding tokens.
import fs from 'fs';

type Provider = 'fake' | 'openai';

function args() {
  const argv = process.argv.slice(2);
  const value = (name: string) => {
    const i = argv.indexOf(`--${name}`);
    return i === -1 ? undefined : argv[i + 1];
  };
  const provider = (value('provider') ?? 'fake') as Provider;
  const suite = value('suite') ?? 'all';
  if (!['fake', 'openai'].includes(provider) || !['all', 'journal', 'week-plan'].includes(suite)) {
    throw new Error('Usage: npm run eval -- [--provider fake|openai] [--suite all|journal|week-plan] [--out file.json]');
  }
  return { provider, suite, out: value('out') };
}

async function main() {
  const { provider, suite, out } = args();
  // Read before the test environment clears it; it's only ever passed in explicitly.
  const realKey = process.env.OPENAI_API_KEY;
  if (provider === 'openai' && !realKey) throw new Error('Set OPENAI_API_KEY to use --provider openai');

  await import('../tests/setup-env');
  process.env.AI_DAILY_LIMIT = '1000';
  process.env.AI_GLOBAL_DAILY_LIMIT = '1000';
  let fake: { url: string; close(): Promise<void> } | undefined;
  if (provider === 'openai') {
    process.env.OPENAI_API_KEY = realKey;
  } else {
    const { startFakeOpenAI } = await import('../tests/fake-openai');
    const { fakeReply } = await import('../tests/fake-openai-replies');
    const server = await startFakeOpenAI();
    // The browser tests' scripted answers, without their typing delay.
    server.script = body => ({ ...fakeReply(body), delayMs: 0 });
    fake = server;
    process.env.OPENAI_API_KEY = 'sk-fake-eval-0123456789abcdef';
    process.env.OPENAI_BASE_URL = fake.url;
  }
  (await import('../tests/global-setup')).default();

  const { evaluateJournal } = await import('./journal');
  const { evaluateWeekPlans } = await import('./weekPlan');
  const { formatReport } = await import('./report');
  const { prisma } = await import('../src/config/database');
  try {
    const report = {
      provider,
      ranAt: new Date().toISOString(),
      journal: suite === 'week-plan' ? null : await evaluateJournal(),
      weekPlan: suite === 'journal' ? null : await evaluateWeekPlans(),
    };
    console.log(formatReport(report));
    if (out) {
      fs.writeFileSync(out, JSON.stringify(report, null, 2));
      console.log(`\nFull results: ${out}`);
    }
  } finally {
    await prisma.$disconnect();
    await fake?.close();
  }
}

main().catch(error => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
