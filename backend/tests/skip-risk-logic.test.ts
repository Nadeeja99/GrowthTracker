import fixture from './fixtures/skip-risk-cases.json';
import { BlockInput, featureVector, loadModel, MODEL, Outcome, personalStats, reasons, skipProbability } from '../src/services/skipRisk/risk';
import rawModel from '../src/services/skipRisk/model.json';

// fixtures/skip-risk-cases.json is written by `uv run growthtracker-ml train`
// from the Python implementation. Matching it proves the API serves the same
// model that was evaluated.
type Case = { name: string; block: BlockInput; history: Outcome[]; expected: { features: number[]; probability: number } };
const cases = fixture.cases as Case[];

describe('parity with the Python model', () => {
  it('was generated for the model the API loads', () => {
    expect(fixture.modelVersion).toBe(MODEL.metadata.version);
    expect(cases.length).toBeGreaterThanOrEqual(25);
  });

  it.each(cases.map(c => [c.name, c] as const))('%s', (_name, c) => {
    const x = featureVector(MODEL, c.block, c.history);
    x.forEach((value, i) => expect(value).toBeCloseTo(c.expected.features[i], 10));
    expect(skipProbability(MODEL, c.block, c.history)).toBeCloseTo(c.expected.probability, 10);
  });

  it('covers the edge cases, not just typical blocks', () => {
    const names = cases.map(c => c.name);
    for (const name of ['no history', 'more history than the limit', 'goal never seen before', 'block without a goal', 'band edges', 'planned after it started']) {
      expect(names).toContain(name);
    }
    expect(cases.find(c => c.name === 'more history than the limit')!.history.length).toBeGreaterThan(MODEL.shrinkage.historyLimit);
  });
});

describe('model behaviour', () => {
  const block: BlockInput = { startMinutes: 10 * 60, weekday: 2, durationMinutes: 60, leadHours: 2, dayLoad: 0, goalId: 'g' };
  const outcomes = (band: Outcome['band'], missed: boolean, n: number): Outcome[] => Array.from({ length: n }, () => ({ band, goalId: 'g', missed }));

  it('with no history, gives everyone the population rates', () => {
    const stats = personalStats(MODEL, [], 'evening', 'g');
    expect(stats.userRate).toBeCloseTo(MODEL.shrinkage.priorMean, 12);
    expect(stats.bandRate).toBeCloseTo(MODEL.shrinkage.priorMean, 12);
  });

  it('rises for someone who misses blocks at that time of day', () => {
    const evening = { ...block, startMinutes: 19 * 60 };
    const history = [...outcomes('evening', true, 10), ...outcomes('morning', false, 10)];
    expect(skipProbability(MODEL, evening, history)).toBeGreaterThan(skipProbability(MODEL, block, history) + 0.2);
  });

  it('is higher for long, crowded, far-ahead weekend blocks', () => {
    const risky = { ...block, durationMinutes: 180, dayLoad: 5, leadHours: 24 * 14, weekday: 6 };
    expect(skipProbability(MODEL, risky, [])).toBeGreaterThan(skipProbability(MODEL, block, []));
  });

  it('explains a risky block in plain words, biggest reason first', () => {
    const evening = { ...block, startMinutes: 19 * 60 };
    const history = [...outcomes('evening', true, 10), ...outcomes('morning', false, 10)];
    expect(reasons(MODEL, evening, history)[0]).toBe('You often miss evening blocks');
    const long = reasons(MODEL, { ...block, durationMinutes: 240, dayLoad: 6 }, outcomes('morning', false, 10));
    expect(long).toEqual(expect.arrayContaining(["It's a long block (240 min)"]));
    expect(long.length).toBeLessThanOrEqual(2);
  });

  it('gives no reasons for a low-risk block', () => {
    expect(reasons(MODEL, block, outcomes('morning', false, 30))).toEqual([]);
  });

  it('refuses a model file that does not match the code', () => {
    expect(() => loadModel({ ...rawModel, features: ['intercept'] })).toThrow();
    expect(() => loadModel({ ...rawModel, coefficients: [0.1] })).toThrow(/features/);
    expect(() => loadModel({ ...rawModel, bands: rawModel.bands.slice(1) })).toThrow(/bands/);
    expect(() => loadModel({ ...rawModel, threshold: 1.5 })).toThrow();
  });
});
