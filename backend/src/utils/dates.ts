// Calendar-day helpers that respect a user's IANA time zone, built on Intl so
// no date library is needed. A "date key" is a calendar day as YYYY-MM-DD.

const DAY_MS = 24 * 60 * 60 * 1000;

// Offset of `timeZone` from UTC (ms) at the given instant; positive east of UTC.
function timeZoneOffsetMs(instant: Date, timeZone: string): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(instant);
  const get = (type: Intl.DateTimeFormatPartTypes) => Number(parts.find(p => p.type === type)?.value);
  const wallClockAsUtc = Date.UTC(get('year'), get('month') - 1, get('day'), get('hour'), get('minute'), get('second'));
  return wallClockAsUtc - (instant.getTime() - instant.getUTCMilliseconds());
}

/** The calendar day `instant` falls on, as seen in `timeZone`. */
export function dateKeyInZone(instant: Date, timeZone: string): string {
  // en-CA formats dates as YYYY-MM-DD.
  return new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(instant);
}

/** The instant local midnight starts on `dateKey` in `timeZone`. */
export function startOfDayInZone(dateKey: string, timeZone: string): Date {
  return zonedTimeToInstant(dateKey, 0, timeZone);
}

/**
 * The instant the wall clock in `timeZone` shows `minutes` after midnight on
 * `dateKey`. Uses the offset in force at that time, so it stays correct on the
 * day clocks change.
 */
export function zonedTimeToInstant(dateKey: string, minutes: number, timeZone: string): Date {
  const [year, month, day] = dateKey.split('-').map(Number);
  const wallClockAsUtc = Date.UTC(year, month - 1, day) + minutes * 60_000;
  const offset = timeZoneOffsetMs(new Date(wallClockAsUtc), timeZone);
  // Re-evaluate once in case a DST transition falls between the guess and the answer.
  const correctedOffset = timeZoneOffsetMs(new Date(wallClockAsUtc - offset), timeZone);
  return new Date(wallClockAsUtc - correctedOffset);
}

export function addDays(dateKey: string, days: number): string {
  const [year, month, day] = dateKey.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Inclusive number of calendar days from `startKey` to `endKey`. */
export function daysBetween(startKey: string, endKey: string): number {
  return Math.round((Date.parse(endKey) - Date.parse(startKey)) / DAY_MS) + 1;
}

/** `@db.Date` columns are stored as UTC midnight of the calendar day. */
export function dateOnly(dateKey: string): Date {
  return new Date(`${dateKey}T00:00:00.000Z`);
}

export interface ResolvedRange {
  startKey: string;
  endKey: string;
  /** First instant of startKey in the user's zone. */
  start: Date;
  /** First instant *after* endKey in the user's zone (exclusive bound). */
  endExclusive: Date;
}

const MAX_RANGE_DAYS = 366;

/**
 * Turns optional YYYY-MM-DD query params into instants for the user's time
 * zone. Defaults to the last `defaultDays` days ending today; ranges are
 * clamped so they never end in the future or exceed a year.
 */
export function resolveRange(
  query: { startDate?: string; endDate?: string },
  timeZone: string,
  defaultDays: number
): ResolvedRange {
  const todayKey = dateKeyInZone(new Date(), timeZone);
  const endKey = query.endDate && query.endDate < todayKey ? query.endDate : todayKey;
  let startKey = query.startDate ?? addDays(endKey, -(defaultDays - 1));
  if (startKey > endKey) startKey = endKey;
  if (daysBetween(startKey, endKey) > MAX_RANGE_DAYS) startKey = addDays(endKey, -(MAX_RANGE_DAYS - 1));

  return {
    startKey,
    endKey,
    start: startOfDayInZone(startKey, timeZone),
    endExclusive: startOfDayInZone(addDays(endKey, 1), timeZone),
  };
}
