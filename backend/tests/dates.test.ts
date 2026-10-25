import { addDays, dateKeyInZone, daysBetween, resolveRange, startOfDayInZone } from '../src/utils/dates';

// Pure unit tests (no database).
describe('time-zone calendar helpers', () => {
  it('finds the calendar day in a given zone', () => {
    const instant = new Date('2026-10-25T20:00:00Z');
    expect(dateKeyInZone(instant, 'UTC')).toBe('2026-10-25');
    expect(dateKeyInZone(instant, 'Asia/Colombo')).toBe('2026-10-26'); // UTC+5:30
    expect(dateKeyInZone(instant, 'America/Los_Angeles')).toBe('2026-10-25');
  });

  it('computes local midnight, including across a DST change', () => {
    expect(startOfDayInZone('2026-10-26', 'Asia/Colombo').toISOString()).toBe('2026-10-25T18:30:00.000Z');
    // Dublin leaves summer time on 25 Oct 2026: midnight is still +01:00 that morning.
    expect(startOfDayInZone('2026-10-25', 'Europe/Dublin').toISOString()).toBe('2026-10-24T23:00:00.000Z');
    expect(startOfDayInZone('2026-10-26', 'Europe/Dublin').toISOString()).toBe('2026-10-26T00:00:00.000Z');
  });

  it('adds days and counts inclusive ranges', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(daysBetween('2026-10-01', '2026-10-07')).toBe(7);
  });

  it('defaults, clamps future end dates and caps ranges at a year', () => {
    const today = dateKeyInZone(new Date(), 'UTC');
    const r = resolveRange({}, 'UTC', 30);
    expect(r.endKey).toBe(today);
    expect(daysBetween(r.startKey, r.endKey)).toBe(30);
    expect(resolveRange({ endDate: '2999-01-01' }, 'UTC', 7).endKey).toBe(today);
    expect(daysBetween(resolveRange({ startDate: '2000-01-01' }, 'UTC', 7).startKey, today)).toBe(366);
  });
});
