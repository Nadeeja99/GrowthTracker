// A "date key" is a calendar day in the user's local time zone as YYYY-MM-DD.
// Never derive one with `toISOString()`: that yields the UTC day, which is a
// different day for part of every day anywhere outside UTC.

const pad = (n: number) => String(n).padStart(2, '0');

export function toDateKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

// `new Date('YYYY-MM-DD')` parses as UTC midnight; this returns local midnight.
export function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number);
  return new Date(year, month - 1, day);
}

/** The Sunday that starts the week containing `date` (weeks run Sunday to Saturday). */
export function weekStartKey(date: Date = new Date()): string {
  return toDateKey(new Date(date.getFullYear(), date.getMonth(), date.getDate() - date.getDay()));
}

/** `key` moved by whole days. */
export function addDaysToKey(key: string, days: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + days);
  return toDateKey(date);
}
