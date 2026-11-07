// Writes the plan as an iCalendar file (RFC 5545), which every calendar app can
// subscribe to. Times are in UTC, so no time zone definitions are needed.

export interface FeedBlock {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
  allDay: boolean;
  updatedAt: Date;
  goal: { title: string } | null;
}

export interface FeedTask {
  id: string;
  title: string;
  dueDate: Date;
  updatedAt: Date;
}

interface FeedOptions {
  appUrl: string;
  /** The user's calendar day an all-day block falls on, as YYYY-MM-DD. */
  dayOf: (instant: Date) => string;
}

const LINE_LIMIT_BYTES = 75;

export const escapeText = (text: string) =>
  text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\r\n|\r|\n/g, '\\n');

/** Lines over 75 bytes continue on the next line, which starts with a space. */
export function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  // Splits by character, so a multi-byte one is never cut in half.
  for (const char of line) {
    const size = Buffer.byteLength(char);
    if (bytes + size > LINE_LIMIT_BYTES) {
      parts.push(current);
      current = ' ';
      bytes = 1;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);
  return parts.join('\r\n');
}

const utcStamp = (date: Date) => date.toISOString().replace(/[-:]|\.\d{3}/g, '');
const dayStamp = (dateKey: string) => dateKey.replace(/-/g, '');

const nextDay = (dateKey: string) => new Date(Date.parse(dateKey) + 86_400_000).toISOString().slice(0, 10);

function event(uid: string, updatedAt: Date, lines: string[]): string[] {
  return ['BEGIN:VEVENT', `UID:${uid}@growthtracker`, `DTSTAMP:${utcStamp(updatedAt)}`, ...lines, 'END:VEVENT'];
}

export function buildCalendar(blocks: FeedBlock[], tasks: FeedTask[], { appUrl, dayOf }: FeedOptions): string {
  const blockEvents = blocks.flatMap(block => {
    const day = dayOf(block.startTime);
    return event(`block-${block.id}`, block.updatedAt, [
      ...(block.allDay
        ? [`DTSTART;VALUE=DATE:${dayStamp(day)}`, `DTEND;VALUE=DATE:${dayStamp(nextDay(day))}`]
        : [`DTSTART:${utcStamp(block.startTime)}`, `DTEND:${utcStamp(block.endTime)}`]),
      `SUMMARY:${escapeText(block.title)}`,
      ...(block.goal ? [`DESCRIPTION:${escapeText(`Goal: ${block.goal.title}`)}`] : []),
      `URL:${appUrl}/plan`,
    ]);
  });

  // Due dates are calendar days stored as UTC midnight, so the UTC date is the day.
  const taskEvents = tasks.flatMap(task => {
    const day = task.dueDate.toISOString().slice(0, 10);
    return event(`task-${task.id}`, task.updatedAt, [
      `DTSTART;VALUE=DATE:${dayStamp(day)}`,
      `DTEND;VALUE=DATE:${dayStamp(nextDay(day))}`,
      `SUMMARY:${escapeText(`Due: ${task.title}`)}`,
      'TRANSP:TRANSPARENT', // a deadline doesn't make the day busy
      `URL:${appUrl}/plan`,
    ]);
  });

  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//GrowthTracker//Calendar feed//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:GrowthTracker',
    'REFRESH-INTERVAL;VALUE=DURATION:PT1H',
    'X-PUBLISHED-TTL:PT1H',
    ...blockEvents,
    ...taskEvents,
    'END:VCALENDAR',
  ].map(foldLine).join('\r\n') + '\r\n';
}
