import { ZodType } from 'zod';
import { createGoalSchema, createTaskSchema, paginationSchema, registerSchema, reflectionSchema } from '../src/utils/validation';

const messageFor = (schema: ZodType, input: unknown) => {
  const result = schema.safeParse(input);
  if (result.success) throw new Error('expected validation to fail');
  return result.error.issues[0].message;
};

// The app shows these to users as they are.
describe('validation messages', () => {
  it('reads as plain English', () => {
    expect(messageFor(createGoalSchema, {})).toBe('This field is required');
    expect(messageFor(createGoalSchema, { title: '' })).toBe('This field is required');
    expect(messageFor(createGoalSchema, { title: 'x'.repeat(101) })).toBe('Use at most 100 characters');
    expect(messageFor(registerSchema, { email: 'a@example.test', username: 'ab', password: 'long-enough' })).toBe('Use at least 3 characters');
    expect(messageFor(reflectionSchema, { energy: 6 })).toBe('Must be at most 5');
    expect(messageFor(createTaskSchema, { title: 't', tags: Array(21).fill('a') })).toBe('Use at most 20 items');
  });

  it('keeps messages written on a schema', () => {
    expect(messageFor(registerSchema, { email: 'nope', username: 'abc', password: 'long-enough' })).toBe('Invalid email address');
  });
});

describe('pagination', () => {
  it('fills in defaults as numbers and parses query strings', () => {
    expect(paginationSchema.parse({})).toEqual({ page: 1, limit: 50 });
    expect(paginationSchema.parse({ page: '2', limit: '10' })).toEqual({ page: 2, limit: 10 });
  });

  it('rejects values out of range', () => {
    expect(paginationSchema.safeParse({ page: '0' }).success).toBe(false);
    expect(paginationSchema.safeParse({ limit: '501' }).success).toBe(false);
    expect(paginationSchema.safeParse({ page: 'abc' }).success).toBe(false);
  });
});

describe('configuration', () => {
  it('treats settings left empty on the host as not set', async () => {
    process.env.MAIL_PROVIDER = '';
    process.env.SENTRY_DSN = '';
    await jest.isolateModulesAsync(async () => {
      const { env } = await import('../src/config/env');
      expect(env.MAIL_PROVIDER).toBe('none');
      expect(env.SENTRY_DSN).toBeUndefined();
    });
    delete process.env.MAIL_PROVIDER;
    delete process.env.SENTRY_DSN;
  });
});
