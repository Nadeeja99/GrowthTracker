// Finds the period a question is about ("last week", "in March"), because
// neither search method understands time: a note from March doesn't look like
// the word "March". Weeks run Sunday to Saturday, as everywhere in the app.
import { addDays } from '../../utils/dates';
import { weekStartKey } from '../ai/time';

export interface DateRange {
  start: string;
  end: string;
}

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const MONTH_NAMES = MONTHS.join('|');

const key = (year: number, month: number, day: number) => new Date(Date.UTC(year, month, day)).toISOString().slice(0, 10);
const monthRange = (year: number, month: number): DateRange => ({ start: key(year, month, 1), end: key(year, month + 1, 0) });
const yearRange = (year: number): DateRange => ({ start: `${year}-01-01`, end: `${year}-12-31` });

/** The period `question` refers to, or null if it doesn't name one. */
export function journalDateRange(question: string, today: string): DateRange | null {
  const text = question.toLowerCase();
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;

  if (/\byesterday\b/.test(text)) return { start: addDays(today, -1), end: addDays(today, -1) };
  if (/\btoday\b/.test(text)) return { start: today, end: today };

  const recent = /\b(?:last|past)\s+(\d{1,3})\s+(day|week|month)s?\b/.exec(text);
  if (recent) {
    const days = Number(recent[1]) * { day: 1, week: 7, month: 30 }[recent[2] as 'day' | 'week' | 'month'];
    return { start: addDays(today, -days), end: today };
  }

  if (/\bthis week\b/.test(text)) return { start: weekStartKey(today), end: today };
  if (/\blast week\b/.test(text)) {
    const start = addDays(weekStartKey(today), -7);
    return { start, end: addDays(start, 6) };
  }
  if (/\bthis month\b/.test(text)) return { start: key(year, month, 1), end: today };
  if (/\blast month\b/.test(text)) return monthRange(year, month - 1);
  if (/\bthis year\b/.test(text)) return { start: `${year}-01-01`, end: today };
  if (/\blast year\b/.test(text)) return yearRange(year - 1);

  // "in May" or "May 2026": a bare "may" or "march" is usually not a month.
  const named = new RegExp(`\\b(?:in|during)\\s+(${MONTH_NAMES})\\b(?:\\s+(\\d{4}))?|\\b(${MONTH_NAMES})\\s+(\\d{4})\\b`).exec(text);
  if (named) {
    const index = MONTHS.indexOf(named[1] ?? named[3]);
    const stated = named[2] ?? named[4];
    if (stated) return monthRange(Number(stated), index);
    return monthRange(index > month ? year - 1 : year, index);
  }

  const inYear = /\b(?:in|during)\s+(20\d{2})\b/.exec(text);
  return inYear ? yearRange(Number(inYear[1])) : null;
}
