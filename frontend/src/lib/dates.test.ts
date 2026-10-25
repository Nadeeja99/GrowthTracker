import { describe, expect, it } from 'vitest';
import { addDaysToKey, weekStartKey } from './dates';

describe('week helpers', () => {
  it('weeks start on Sunday, like the calendar', () => {
    expect(weekStartKey(new Date(2026, 9, 25))).toBe('2026-10-25'); // Sunday
    expect(weekStartKey(new Date(2026, 9, 31, 23, 59))).toBe('2026-10-25'); // Saturday night
    expect(weekStartKey(new Date(2026, 10, 1))).toBe('2026-11-01');
  });

  it('adds days across month and year ends', () => {
    expect(addDaysToKey('2026-10-25', 7)).toBe('2026-11-01');
    expect(addDaysToKey('2027-01-03', -7)).toBe('2026-12-27');
  });
});
