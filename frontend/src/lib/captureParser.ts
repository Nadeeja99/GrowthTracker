// Turns a line of plain English into a task or a time block: "gym tomorrow 6pm
// for 45 min", "finish report by friday !high #work". It runs on the device with
// no AI, so it's instant, free, private and works offline. It only recognises
// fairly unambiguous phrasing and leaves the rest in the title, and the capture
// dialog previews the result, so a wrong guess is seen before anything is saved.
import { addDaysToKey, parseDateKey, toDateKey } from '@/lib/dates';

export type Priority = 'low' | 'medium' | 'high';

export interface ParsedCapture {
  kind: 'task' | 'activity';
  title: string;
  /** YYYY-MM-DD: the due date of a task, or the day of a time block. */
  date?: string;
  startTime?: string;
  endTime?: string;
  priority?: Priority;
  /** Minutes, for a task with a length but no time ("write report for 2h"). */
  estimate?: number;
  tags: string[];
  goalId?: string;
}

const DEFAULT_BLOCK_MINUTES = 60;
const LAST_MINUTE_OF_DAY = 24 * 60 - 1;
const DAYPARTS: Record<string, number> = { morning: 9 * 60, afternoon: 14 * 60, evening: 18 * 60, night: 20 * 60 };

const WEEKDAYS = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];

const WEEKDAY_FULL = WEEKDAYS.join('|');
const WEEKDAY_SHORT = 'sun|mon|tues?|wed|thurs?|fri|sat';
const MONTH_NAME = `${MONTHS.join('|')}|jan|feb|mar|apr|jun|jul|aug|sept?|oct|nov|dec`;
const MERIDIEM = '(am|pm|a\\.m\\.|p\\.m\\.)';
const CLOCK = `(\\d{1,2})(?::(\\d{2}))?\\s*${MERIDIEM}?`;
const COUNT_WORDS: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };

const clock = (total: number) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`;

/** Takes the first match out of the text, leaving a space. */
function take(state: { text: string }, pattern: RegExp): RegExpExecArray | null {
  const match = pattern.exec(state.text);
  if (match) state.text = `${state.text.slice(0, match.index)} ${state.text.slice(match.index + match[0].length)}`;
  return match;
}

/** Minutes after midnight for a clock time, or null if it isn't one. */
function toMinutes(hourText: string, minuteText: string | undefined, meridiem: string | undefined): number | null {
  const hour = Number(hourText);
  const minute = Number(minuteText ?? 0);
  if (minute > 59) return null;
  if (meridiem) {
    if (hour < 1 || hour > 12) return null;
    const afternoon = meridiem.toLowerCase().startsWith('p');
    return ((hour % 12) + (afternoon ? 12 : 0)) * 60 + minute;
  }
  return hour > 23 ? null : hour * 60 + minute;
}

function nextWeekday(today: string, weekday: number): string {
  return addDaysToKey(today, (weekday - parseDateKey(today).getDay() + 7) % 7);
}

function fromMonthAndDay(today: string, month: number, day: number, year?: number): string | null {
  const build = (y: number) => {
    const date = new Date(y, month, day);
    return date.getMonth() === month ? toDateKey(date) : null;
  };
  const thisYear = build(year ?? parseDateKey(today).getFullYear());
  if (!thisYear) return null;
  // "3 nov" said on 7 Nov means next year's, unless a year was given.
  return !year && thisYear < today ? build(parseDateKey(today).getFullYear() + 1) : thisYear;
}

const monthIndex = (name: string) => MONTHS.findIndex(month => month.startsWith(name.toLowerCase().slice(0, 3)));

interface DateResult {
  date: string;
  deadline: boolean;
  /** A bare weekday can roll on a week if its time has already gone by today. */
  rollable: boolean;
  defaultStart?: number;
}

function takeDate(state: { text: string }, today: string): DateResult | null {
  const lead = '(?:\\b(on|by|due(?:\\s+(?:on|by))?|before)\\s+)?';
  const part = '(?:\\s+(morning|afternoon|evening|night))?';

  const found = (date: string, words: string | undefined, daypart: string | undefined, rollable = false): DateResult => ({
    date,
    deadline: !!words && !words.toLowerCase().startsWith('on'),
    rollable,
    defaultStart: daypart ? DAYPARTS[daypart.toLowerCase()] : undefined,
  });

  let match = take(state, new RegExp(`${lead}\\b(\\d{4})-(\\d{2})-(\\d{2})\\b`, 'i'));
  if (match) {
    const date = new Date(Number(match[2]), Number(match[3]) - 1, Number(match[4]));
    if (date.getMonth() === Number(match[3]) - 1) return found(toDateKey(date), match[1], undefined);
  }

  match = take(state, new RegExp(`${lead}\\b(?:the\\s+)?day after (?:tomorrow|tmrw|tmr)\\b${part}`, 'i'));
  if (match) return found(addDaysToKey(today, 2), match[1], match[2]);

  match = take(state, new RegExp(`${lead}\\b(?:tomorrow|tmrw|tmr)\\b${part}`, 'i'));
  if (match) return found(addDaysToKey(today, 1), match[1], match[2]);

  match = take(state, /\btonight\b/i);
  if (match) return found(today, undefined, 'night');

  match = take(state, new RegExp(`${lead}\\b(?:today)\\b${part}`, 'i'));
  if (match) return found(today, match[1], match[2]);

  match = take(state, /\bthis (morning|afternoon|evening)\b/i);
  if (match) return found(today, undefined, match[1]);

  match = take(state, new RegExp(`${lead}\\bin\\s+(\\d+|a|an|one|two|three|four|five|six)\\s+(day|week)s?\\b`, 'i'));
  if (match) {
    const count = COUNT_WORDS[match[2].toLowerCase()] ?? Number(match[2]);
    return found(addDaysToKey(today, count * (match[3].toLowerCase() === 'week' ? 7 : 1)), match[1], undefined);
  }

  match = take(state, new RegExp(`${lead}\\bnext week\\b`, 'i'));
  if (match) return found(addDaysToKey(today, (8 - parseDateKey(today).getDay()) % 7 || 7), match[1], undefined); // the coming Monday

  // Whole weekday names are safe anywhere. Short ones are ordinary words ("sit
  // in the sun"), so they need a word in front of them or a time right after.
  match = take(state, new RegExp(`${lead}\\b(this\\s+|next\\s+)?(${WEEKDAY_FULL})\\b${part}`, 'i'))
    ?? take(state, new RegExp(`${lead}\\b(this\\s+|next\\s+)(${WEEKDAY_SHORT})\\b${part}`, 'i'))
    ?? take(state, new RegExp(`\\b(on|by|due(?:\\s+(?:on|by))?|before)\\s+()(${WEEKDAY_SHORT})\\b${part}`, 'i'));
  if (match) {
    const [, words, which, name, daypart] = match;
    const coming = nextWeekday(today, WEEKDAYS.findIndex(day => day.startsWith(name.toLowerCase().slice(0, 3))));
    if (which?.trim().toLowerCase() === 'next') {
      // "next friday" is in next week: the week after the one we're in.
      const weekEnd = addDaysToKey(today, 6 - parseDateKey(today).getDay());
      return found(coming > weekEnd ? coming : addDaysToKey(coming, 7), words, daypart);
    }
    return found(coming, words, daypart, true);
  }

  match = take(state, new RegExp(`${lead}\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(?:of\\s+)?(${MONTH_NAME})\\b\\.?(?:,?\\s+(\\d{4}))?`, 'i'));
  if (match) {
    const date = fromMonthAndDay(today, monthIndex(match[3]), Number(match[2]), match[4] ? Number(match[4]) : undefined);
    if (date) return found(date, match[1], undefined);
  }

  match = take(state, new RegExp(`${lead}\\b(${MONTH_NAME})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b(?!:|\\s*(?:am|pm))(?:,?\\s+(\\d{4}))?`, 'i'));
  if (match) {
    const date = fromMonthAndDay(today, monthIndex(match[2]), Number(match[3]), match[4] ? Number(match[4]) : undefined);
    if (date) return found(date, match[1], undefined);
  }

  return null;
}

interface TimeResult {
  start: number;
  end?: number;
  /** Written with no am/pm and could be either, like "at 7". */
  unclear: boolean;
}

function takeTime(state: { text: string }): TimeResult | null {
  const before = '(?:\\b(?:at|from)\\s+)?';

  // A range needs an am/pm, a colon, or "from": "6-7pm", not "chapters 3-5".
  let match = take(state, new RegExp(`(\\bfrom\\s+)?\\b${CLOCK}\\s*(?:-|–|to|until|till)\\s*${CLOCK}(?=\\s|$|[,.])`, 'i'));
  if (match && !(match[1] || match[3] || match[4] || match[6] || match[7])) {
    state.text = `${state.text.slice(0, match.index)}${match[0]}${state.text.slice(match.index + 1)}`;
    match = null;
  }
  if (match) {
    const end = toMinutes(match[5], match[6], match[7]);
    let start = toMinutes(match[2], match[3], match[4]);
    // "6-7pm": the am/pm of the end belongs to the start too, unless that puts
    // the start after the end ("11-1pm").
    if (start !== null && end !== null && !match[4] && match[7]) {
      const shared = toMinutes(match[2], match[3], match[7]);
      if (shared !== null) start = shared <= end ? shared : start;
    }
    if (start !== null && end !== null && end > start) return { start, end, unclear: false };
    state.text = `${state.text.slice(0, match.index)}${match[0]}${state.text.slice(match.index + 1)}`;
  }

  match = take(state, new RegExp(`${before}\\b(noon|midday|midnight)\\b`, 'i'));
  if (match) return { start: match[1].toLowerCase() === 'midnight' ? 0 : 12 * 60, unclear: false };

  match = take(state, new RegExp(`${before}\\b(\\d{1,2})(?::(\\d{2}))?\\s*${MERIDIEM}(?=\\s|$|[,.])`, 'i'));
  if (match) {
    const start = toMinutes(match[1], match[2], match[3]);
    if (start !== null) return { start, unclear: false };
  }

  match = take(state, new RegExp(`${before}\\b(\\d{1,2}):(\\d{2})\\b`, 'i'));
  if (match) {
    const start = toMinutes(match[1], match[2], undefined);
    if (start !== null) return { start, unclear: !match[1].startsWith('0') && Number(match[1]) <= 12 };
  }

  match = take(state, /\bat\s+(\d{1,2})\b(?![:\d]|\s*(?:%|percent|km|mi|miles|kg|lbs?)\b)/i);
  if (match) {
    const start = toMinutes(match[1], undefined, undefined);
    if (start !== null) return { start, unclear: Number(match[1]) <= 12 };
  }
  return null;
}

function takeDuration(state: { text: string }): number | null {
  const named = take(state, /\bfor\s+(half an hour|an hour|a quarter of an hour|a couple of hours)\b/i);
  if (named) return { 'half an hour': 30, 'an hour': 60, 'a quarter of an hour': 15, 'a couple of hours': 120 }[named[1].toLowerCase()] ?? null;

  // "1h30"; "2 hours"; "90 min". A bare "5m" could be metres, so it needs "for".
  const mixed = take(state, /(?:\bfor\s+)?\b(\d+)\s*h(?:rs?|ours?)?\s*(\d+)\s*(?:m|mins?|minutes?)?\b/i);
  if (mixed) return Number(mixed[1]) * 60 + Number(mixed[2]);
  const hours = take(state, /(?:\bfor\s+)?\b(\d+(?:\.\d+)?)\s*(?:h|hrs?|hours?)\b/i);
  if (hours) return Math.round(Number(hours[1]) * 60);
  const mins = take(state, /(?:\bfor\s+(\d+)\s*(?:m|mins?|minutes?)\b)|(?:\b(\d+)\s*(?:mins?|minutes?)\b)/i);
  if (mins) return Number(mins[1] ?? mins[2]);
  return null;
}

function takePriority(state: { text: string }): Priority | undefined {
  const match = take(state, /(?:^|\s)!(high|h|urgent|medium|med|m|low|l)\b/i)
    ?? take(state, /\b(high|medium|low)[ -]priority\b/i)
    ?? take(state, /\bpriority[ :]+(high|medium|low)\b/i)
    ?? take(state, /\b(urgent|asap)\s*$/i);
  if (!match) return undefined;
  const word = match[1].toLowerCase();
  if (word.startsWith('l')) return 'low';
  return word === 'medium' || word === 'med' || word === 'm' ? 'medium' : 'high';
}

function matchGoal(word: string, goals: Array<{ id: string; name: string }>) {
  const wanted = word.toLowerCase().replace(/[-_]/g, ' ');
  return goals.find(goal => goal.name.toLowerCase().startsWith(wanted)) ?? goals.find(goal => goal.name.toLowerCase().includes(wanted));
}

const tidyTitle = (text: string) =>
  text
    .replace(/\s+/g, ' ')
    .replace(/(?:[\s,;:-]+|\s(?:at|on|by|for|from|to|in|due|before))+$/i, '')
    .replace(/^[\s,;:-]+/, '')
    .trim();

/** Reads a line of text. `goals` are the ones `@name` can refer to. */
export function parseCapture(input: string, { now = new Date(), goals = [] }: { now?: Date; goals?: Array<{ id: string; name: string }> } = {}): ParsedCapture {
  const today = toDateKey(now);
  const quoted: string[] = [];
  // Quotes keep text literal: "Meet at 6pm" stays a title. Stand-ins are
  // private-use characters, so no pattern can match them.
  const state = {
    text: input.replace(/"([^"]*)"/g, (_all, inner: string) => {
      quoted.push(inner);
      return String.fromCharCode(0xe000 + quoted.length - 1);
    }),
  };

  const explicit = take(state, /^\s*(task|todo|block|event)\s*:/i)?.[1].toLowerCase();

  const tags: string[] = [];
  for (let tag = take(state, /(?:^|\s)#([\w-]+)/); tag; tag = take(state, /(?:^|\s)#([\w-]+)/)) {
    if (!tags.some(name => name.toLowerCase() === tag![1].toLowerCase())) tags.push(tag[1]);
  }

  let goalId: string | undefined;
  const mention = /(?:^|\s)@([\w-]+)/.exec(state.text);
  const goal = mention && matchGoal(mention[1], goals);
  if (goal) {
    goalId = goal.id;
    take(state, /(?:^|\s)@[\w-]+/);
  }

  const priority = takePriority(state);
  // "fri 9am": a short day name counts when a time follows, so mark it before
  // the time is taken out. Alone it may be an ordinary word (see takeDate).
  state.text = state.text.replace(new RegExp(`(?<!\\b(?:on|by|due|before|this|next)\\s)\\b(${WEEKDAY_SHORT})\\b(?=\\s+\\d)`, 'gi'), 'on $1');
  const time = takeTime(state);
  const dated = takeDate(state, today);
  const duration = takeDuration(state);

  const start = time?.start ?? (dated?.deadline ? undefined : dated?.defaultStart);
  const wantsBlock = explicit ? explicit === 'block' || explicit === 'event' : start !== undefined && !dated?.deadline;

  let date = dated?.date;
  let startTime: string | undefined;
  let endTime: string | undefined;

  if (wantsBlock && start !== undefined) {
    const nowMinutes = now.getHours() * 60 + now.getMinutes();
    let resolved = start;
    // "at 7": morning from 7 to 12, afternoon from 1 to 6. If that's already
    // gone by today, it must mean the evening.
    if (time?.unclear) {
      if (start < 7 * 60 && start >= 60) resolved = start + 12 * 60;
      if ((date ?? today) === today && resolved <= nowMinutes && resolved + 12 * 60 <= LAST_MINUTE_OF_DAY && resolved < 12 * 60) resolved += 12 * 60;
    }
    const hasGone = resolved <= nowMinutes;
    if (!date) date = hasGone ? addDaysToKey(today, 1) : today;
    else if (dated?.rollable && date === today && hasGone) date = addDaysToKey(today, 7);

    const end = time?.end ?? resolved + (duration ?? DEFAULT_BLOCK_MINUTES);
    startTime = clock(resolved);
    endTime = clock(Math.min(end, LAST_MINUTE_OF_DAY));
  }

  const title = tidyTitle(state.text).replace(/[-]/g, stand => quoted[stand.charCodeAt(0) - 0xe000] ?? '');

  return {
    kind: wantsBlock ? 'activity' : 'task',
    title,
    date,
    startTime,
    endTime,
    priority,
    estimate: !wantsBlock && duration ? duration : undefined,
    tags,
    goalId,
  };
}

