import './coach-openai-env';
import { prisma } from './helpers';
import { FakeOpenAI, startFakeOpenAI } from './fake-openai';
import { fakeReply } from './fake-openai-replies';
import { evaluateJournal, recallAtK, reciprocalRank } from '../evals/journal';
import { evaluateWeekPlans, SCENARIOS } from '../evals/weekPlan';
import { formatReport } from '../evals/report';
import notesFile from '../evals/journal/notes.json';
import questionsFile from '../evals/journal/questions.json';

// The evaluation set's harness, run against the fake provider. Keyword search
// needs no AI, so its numbers are real; the rest only proves the harness works.
let fake: FakeOpenAI;

beforeAll(async () => {
  fake = await startFakeOpenAI();
  fake.script = body => ({ ...fakeReply(body), delayMs: 0 });
  process.env.OPENAI_BASE_URL = fake.url;
});
afterAll(async () => {
  await fake.close();
  await prisma.$disconnect();
});

describe('labelled data', () => {
  it('every question points at notes that exist, on distinct days', () => {
    const ids = new Set(notesFile.notes.map(n => n.id));
    expect(ids.size).toBe(notesFile.notes.length);
    expect(new Set(notesFile.notes.map(n => n.daysAgo)).size).toBe(notesFile.notes.length);
    for (const q of questionsFile.questions) {
      expect(q.relevant.length).toBeGreaterThan(0);
      for (const id of q.relevant) expect(ids).toContain(id);
    }
  });
});

describe('scores', () => {
  it('recall@k counts against at most k right notes', () => {
    expect(recallAtK(['a', 'x', 'b'], ['a', 'b'])).toBe(1);
    expect(recallAtK(['a', 'x'], ['a', 'b'])).toBe(0.5);
    expect(recallAtK(['a', 'b'], ['a', 'b', 'c'], 2)).toBe(1);
  });

  it('reciprocal rank is 1 over the first right position', () => {
    expect(reciprocalRank(['x', 'a'], ['a'])).toBe(0.5);
    expect(reciprocalRank(['x'], ['a'])).toBe(0);
  });
});

describe('journal search', () => {
  it('finds word and period questions by keywords alone, and misses most questions asked in other words', async () => {
    const report = await evaluateJournal({ ask: 3 });
    const keywords = report.retrieval.keywords;
    expect(keywords.words.recallAt8).toBe(1);
    expect(keywords.period.recallAt8).toBe(1);
    expect(keywords.meaning.recallAt8).toBeLessThan(0.5);
    expect(report.perQuestion).toHaveLength(questionsFile.questions.length);
    expect(report.answers).toMatchObject({ asked: 3, withCitations: 3 });
    expect(formatReport({ provider: 'fake', ranAt: new Date().toISOString(), journal: report, weekPlan: null })).toContain('| keywords | ');
  });
});

describe('plan my week', () => {
  it('grades every scenario', async () => {
    const reports = await evaluateWeekPlans();
    expect(reports.map(r => r.id)).toEqual(SCENARIOS.map(s => s.id));
    for (const r of reports) {
      expect(r.error).toBeUndefined();
      expect(r.kept).toBeLessThanOrEqual(r.proposed);
      expect(r.goalScore).toBeGreaterThanOrEqual(0);
      expect(r.goalScore).toBeLessThanOrEqual(1);
    }
    // The fake's 07:00 and 20:00 blocks are outside the new user's 09:00-18:00 window.
    expect(reports.find(r => r.id === 'new-user')).toMatchObject({ kept: 0, goalScore: 0, risk: null });
    // Only the person with a record gets a risk comparison.
    expect(reports.find(r => r.id === 'morning-person')!.risk).not.toBeNull();
    expect(reports.find(r => r.id === 'nearly-planned')!.goals[0].neededHours).toBeCloseTo(0.5, 5);
  });
});
