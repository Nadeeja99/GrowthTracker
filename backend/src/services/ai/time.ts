// Wall-clock helpers for AI output, which speaks in the user's local dates and
// times ("2026-10-27", "19:00").
import { addDays } from '../../utils/dates';

const DATE_KEY = /^\d{4}-\d{2}-\d{2}$/;
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;

export const isDateKey = (value: unknown): value is string =>
  typeof value === 'string' && DATE_KEY.test(value) && !Number.isNaN(Date.parse(`${value}T00:00:00Z`));

/** Minutes after midnight for "HH:MM", or null. */
export function minutesOfDay(time: string | null | undefined): number | null {
  const match = time ? TIME.exec(time) : null;
  return match ? Number(match[1]) * 60 + Number(match[2]) : null;
}

/** Sunday that starts the week containing `dateKey` (the app's weeks run Sunday to Saturday). */
export function weekStartKey(dateKey: string): string {
  return addDays(dateKey, -new Date(`${dateKey}T00:00:00Z`).getUTCDay());
}

/** Strict JSON Schema helper: a value of `type` or null. */
export const nullable = (type: string, description: string, extra: object = {}) =>
  ({ type: [type, 'null'], description, ...extra });
