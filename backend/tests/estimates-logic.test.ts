import fixture from './fixtures/estimate-cases.json';
import {
  featureVector,
  intervalFor,
  loadModel,
  logRatio,
  MODEL,
  predictDuration,
  roundMinutes,
  TaskInput,
  TimedTask,
} from '../src/services/estimates/calibration';
import rawModel from '../src/services/estimates/model.json';

// fixtures/estimate-cases.json is written by `uv run growthtracker-ml train`
// from the Python implementation. Matching it proves the API serves the same
// model that was evaluated.
type Case = { name: string; task: TaskInput; history: TimedTask[]; expected: Record<string, number> };
const cases = fixture.cases as Case[];

describe('parity with the Python model', () => {
  it('was generated for the model the API loads', () => {
    expect(fixture.modelVersion).toBe(MODEL.metadata.version);
    expect(cases.length).toBeGreaterThanOrEqual(25);
  });

  it.each(cases.map(c => [c.name, c] as const))('%s', (_name, c) => {
    const p = predictDuration(MODEL, c.task, c.history);
    for (const key of ['logMean', 'predictedMinutes', 'lowMinutes', 'highMinutes', 'userOffset', 'goalOffset'] as const) {
      expect(p[key]).toBeCloseTo(c.expected[key], 9);
    }
    expect(p.historyUsed).toBe(c.expected.historyUsed);
    expect(p.goalHistoryUsed).toBe(c.expected.goalHistoryUsed);
  });

  it('covers the edge cases, not just typical tasks', () => {
    const names = cases.map(c => c.name);
    for (const name of ['no history', 'more history than the limit', 'goal never seen before', 'task without a goal', 'estimate below the clamp', 'estimate above the clamp', 'history with extreme ratios']) {
      expect(names).toContain(name);
    }
    const long = cases.find(c => c.name === 'more history than the limit')!;
    expect(long.history.length).toBeGreaterThan(MODEL.historyLimit);
  });
});

describe('model behaviour', () => {
  const task: TaskInput = { estimateMinutes: 60, priority: 'MEDIUM', subtasks: 0, hasDueDate: false, goalId: 'g' };
  const timed = (estimate: number, actual: number, goalId: string | null = 'g'): TimedTask => ({ ...task, estimateMinutes: estimate, actualMinutes: actual, goalId });

  it('clamps inputs the way training did', () => {
    expect(featureVector(MODEL, { ...task, estimateMinutes: 1 })).toEqual(featureVector(MODEL, { ...task, estimateMinutes: MODEL.clamps.minEstimate }));
    expect(featureVector(MODEL, { ...task, subtasks: 500 })).toEqual(featureVector(MODEL, { ...task, subtasks: MODEL.clamps.maxSubtasks }));
    expect(logRatio(MODEL, 10, 10_000)).toBeCloseTo(MODEL.clamps.maxLogRatio, 12);
  });

  it('learns from someone who always overruns, and more with more history', () => {
    const none = predictDuration(MODEL, task, []);
    const few = predictDuration(MODEL, task, Array.from({ length: 3 }, () => timed(60, 150)));
    const many = predictDuration(MODEL, task, Array.from({ length: 40 }, () => timed(60, 150)));
    expect(none.predictedMinutes).toBeLessThan(few.predictedMinutes);
    expect(few.predictedMinutes).toBeLessThan(many.predictedMinutes);
    expect(many.predictedMinutes).toBeLessThan(150 * 1.05);
    expect(many.lowMinutes).toBeLessThan(many.predictedMinutes);
    expect(many.highMinutes).toBeGreaterThan(many.predictedMinutes);
  });

  it('learns that someone finishes early, too', () => {
    const early = predictDuration(MODEL, task, Array.from({ length: 20 }, () => timed(60, 30)));
    expect(early.predictedMinutes).toBeLessThan(60);
  });

  it('uses only the most recent tasks', () => {
    const recent = Array.from({ length: MODEL.historyLimit }, () => timed(60, 60));
    const old = Array.from({ length: 30 }, () => timed(60, 240));
    expect(predictDuration(MODEL, task, [...recent, ...old])).toEqual(predictDuration(MODEL, task, recent));
  });

  it('narrows the range once there is more history', () => {
    const width = (n: number) => intervalFor(MODEL, n).high - intervalFor(MODEL, n).low;
    expect(width(50)).toBeLessThan(width(0));
  });

  it('rounds the way people say durations', () => {
    expect(roundMinutes(0.2)).toBe(1);
    expect(roundMinutes(23.4)).toBe(23);
    expect(roundMinutes(31)).toBe(30);
    expect(roundMinutes(83)).toBe(85);
  });

  it('refuses a model file that does not match the code', () => {
    expect(() => loadModel({ ...rawModel, features: ['intercept'] })).toThrow();
    expect(() => loadModel({ ...rawModel, coefficients: [0.1] })).toThrow(/features/);
    expect(() => loadModel({ ...rawModel, variances: { user: 0, goal: 0.1, noise: 0.1 } })).toThrow();
  });
});
