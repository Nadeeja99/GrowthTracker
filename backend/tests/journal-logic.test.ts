import { journalDateRange } from '../src/services/journal/dateRange';
import { fuseRankings, JournalNote } from '../src/services/journal/search';
import { resolveCitations } from '../src/services/journal/answer';

// 2026-11-11 is a Wednesday; the week starts on Sunday 2026-11-08.
const TODAY = '2026-11-11';
const range = (question: string, today = TODAY) => journalDateRange(question, today);

describe('journalDateRange', () => {
  it.each([
    ['how was yesterday?', { start: '2026-11-10', end: '2026-11-10' }],
    ['what did I write today', { start: TODAY, end: TODAY }],
    ['how was this week?', { start: '2026-11-08', end: TODAY }],
    ['how was last week?', { start: '2026-11-01', end: '2026-11-07' }],
    ['this month so far', { start: '2026-11-01', end: TODAY }],
    ['What about LAST MONTH?', { start: '2026-10-01', end: '2026-10-31' }],
    ['over the past 10 days', { start: '2026-11-01', end: TODAY }],
    ['in the last 2 weeks', { start: '2026-10-28', end: TODAY }],
    ['in the last 3 months', { start: '2026-08-13', end: TODAY }],
    ['this year', { start: '2026-01-01', end: TODAY }],
    ['last year', { start: '2025-01-01', end: '2025-12-31' }],
    ['what happened in March?', { start: '2026-03-01', end: '2026-03-31' }],
    ['during february 2024', { start: '2024-02-01', end: '2024-02-29' }],
    ['June 2025 notes', { start: '2025-06-01', end: '2025-06-30' }],
    ['in 2025', { start: '2025-01-01', end: '2025-12-31' }],
  ])('%s', (question, expected) => expect(range(question)).toEqual(expected));

  it('takes a month that hasn’t come yet as last year’s', () => {
    expect(range('in December')).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });

  it('wraps "last month" across new year', () => {
    expect(range('last month', '2026-01-15')).toEqual({ start: '2025-12-01', end: '2025-12-31' });
  });

  it.each([
    'Why do I feel tired?',
    'may I ask about running',
    'should I march on with the plan',
    'what did I say about 2025 goals',
  ])('finds no period in: %s', question => expect(range(question)).toBeNull());
});

describe('fuseRankings', () => {
  const item = (id: string) => ({ id });
  const ids = (items: Array<{ id: string }>) => items.map(i => i.id);

  it('ranks what both lists agree on above what only one list liked', () => {
    expect(ids(fuseRankings([[item('a'), item('b')], [item('c'), item('b')]], 3))[0]).toBe('b');
  });

  it('keeps each note once and stops at the limit', () => {
    expect(ids(fuseRankings([[item('a'), item('b')], [item('a')], []], 5))).toEqual(['a', 'b']);
    expect(fuseRankings([[item('a'), item('b'), item('c')]], 2)).toHaveLength(2);
  });

  it('survives empty lists', () => expect(fuseRankings([[], []], 5)).toEqual([]));
});

describe('resolveCitations', () => {
  const note = (date: string): JournalNote => ({ date, notes: 'x', performance: null, energy: null, mood: null });
  const notes = [note('2026-03-01'), note('2026-03-05'), note('2026-03-09')];

  it('returns the cited notes, newest first', () => {
    const { answer, sources } = resolveCitations('You slept badly [2026-03-01] and ran [2026-03-05].', notes);
    expect(answer).toBe('You slept badly [2026-03-01] and ran [2026-03-05].');
    expect(sources.map(s => s.date)).toEqual(['2026-03-05', '2026-03-01']);
  });

  it('removes a date the model wasn’t given', () => {
    const { answer, sources } = resolveCitations('You felt great [2019-01-01] and ran [2026-03-05].', notes);
    expect(answer).toBe('You felt great and ran [2026-03-05].');
    expect(sources.map(s => s.date)).toEqual(['2026-03-05']);
  });

  it('splits one bracket with several dates, keeping only real ones', () => {
    const { answer, sources } = resolveCitations('Low energy [2026-03-01, 2019-01-01, 2026-03-09].', notes);
    expect(answer).toBe('Low energy [2026-03-01] [2026-03-09].');
    expect(sources).toHaveLength(2);
  });

  it('leaves other brackets and line breaks alone', () => {
    const text = 'See [this note].\n- First [2026-03-01]\n- Second';
    expect(resolveCitations(text, notes).answer).toBe(text);
  });

  it('cites nothing when the answer has no dates', () => {
    expect(resolveCitations('I couldn’t find that.', notes).sources).toEqual([]);
  });
});
