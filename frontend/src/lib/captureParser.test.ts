import { describe, expect, it } from 'vitest';
import { parseCapture } from './captureParser';

// Saturday 7 November 2026, 10:30 local time.
const now = new Date(2026, 10, 7, 10, 30);
const goals = [{ id: 'g1', name: 'AWS Certification' }, { id: 'g2', name: 'Run a half marathon' }];
const parse = (text: string, at = now) => parseCapture(text, { now: at, goals });

describe('time blocks', () => {
  it.each([
    ['gym tomorrow 6pm', 'gym', '2026-11-08', '18:00', '19:00'],
    ['gym tomorrow at 6pm for 45 min', 'gym', '2026-11-08', '18:00', '18:45'],
    ['tomorrow 6:30pm dentist', 'dentist', '2026-11-08', '18:30', '19:30'],
    ['Team call today at 14:00 for 1h', 'Team call', '2026-11-07', '14:00', '15:00'],
    ['deep work monday 9-11am', 'deep work', '2026-11-09', '09:00', '11:00'],
    ['deep work monday 9am to 10:30am', 'deep work', '2026-11-09', '09:00', '10:30'],
    ['lunch 11-1pm on tuesday', 'lunch', '2026-11-10', '11:00', '13:00'],
    ['workshop friday from 9 to 11', 'workshop', '2026-11-13', '09:00', '11:00'],
    ['yoga tomorrow morning', 'yoga', '2026-11-08', '09:00', '10:00'],
    ['call mum tonight', 'call mum', '2026-11-07', '20:00', '21:00'],
    ['review this evening', 'review', '2026-11-07', '18:00', '19:00'],
    ['lunch with Sam at noon', 'lunch with Sam', '2026-11-07', '12:00', '13:00'],
    ['study 1h30 tomorrow 7am', 'study', '2026-11-08', '07:00', '08:30'],
    ['read for half an hour tomorrow 8pm', 'read', '2026-11-08', '20:00', '20:30'],
    ['flight 12 nov 6am', 'flight', '2026-11-12', '06:00', '07:00'],
    ['party on Nov 20th at 7pm', 'party', '2026-11-20', '19:00', '20:00'],
    ['fri 9am standup', 'standup', '2026-11-13', '09:00', '10:00'],
  ])('%s', (text, title, date, startTime, endTime) => {
    expect(parse(text)).toMatchObject({ kind: 'activity', title, date, startTime, endTime });
  });

  it('assumes today for a time still to come, and tomorrow for one that’s gone', () => {
    expect(parse('gym 6pm')).toMatchObject({ date: '2026-11-07', startTime: '18:00' });
    expect(parse('gym 9am')).toMatchObject({ date: '2026-11-08', startTime: '09:00' });
  });

  it('reads an unclear hour sensibly', () => {
    expect(parse('call at 3 tomorrow').startTime).toBe('15:00');
    expect(parse('run at 8 tomorrow').startTime).toBe('08:00');
    expect(parse('dinner at 7').startTime).toBe('19:00'); // 7am has gone
    expect(parse('meet at 12 tomorrow').startTime).toBe('12:00');
    expect(parse('walk at 17:00').startTime).toBe('17:00');
    expect(parse('stretch 09:15 tomorrow').startTime).toBe('09:15');
  });

  it('moves a weekday with a passed time to next week', () => {
    expect(parse('class saturday 9am').date).toBe('2026-11-14');
    expect(parse('class saturday 6pm').date).toBe('2026-11-07');
  });

  it('never runs past midnight', () => {
    expect(parse('late shift tomorrow 11pm for 3h').endTime).toBe('23:59');
  });

  it('can be asked for by name', () => {
    expect(parse('block: focus')).toMatchObject({ kind: 'activity', title: 'focus' });
  });
});

describe('tasks', () => {
  it.each([
    ['buy milk', 'buy milk', undefined],
    ['finish report by friday', 'finish report', '2026-11-13'],
    ['finish report due friday', 'finish report', '2026-11-13'],
    ['pay rent by tomorrow', 'pay rent', '2026-11-08'],
    ['renew passport by 3 dec', 'renew passport', '2026-12-03'],
    ['file taxes monday', 'file taxes', '2026-11-09'],
    ['book flights in 3 days', 'book flights', '2026-11-10'],
    ['update CV in 2 weeks', 'update CV', '2026-11-21'],
    ['call bank next week', 'call bank', '2026-11-09'],
    ['send invoice on 2026-12-01', 'send invoice', '2026-12-01'],
    ['send invoice next friday', 'send invoice', '2026-11-13'],
  ])('%s', (text, title, date) => {
    expect(parse(text)).toMatchObject({ kind: 'task', title, date });
  });

  it('treats "by" as a deadline even with a time', () => {
    expect(parse('submit form by friday 5pm')).toMatchObject({ kind: 'task', date: '2026-11-13', startTime: undefined });
    expect(parse('submit form by next friday 5pm')).toMatchObject({ kind: 'task', date: '2026-11-13', startTime: undefined });
    expect(parse('submit form by fri 5pm')).toMatchObject({ kind: 'task', date: '2026-11-13', startTime: undefined });
  });

  it('doesn’t mistake "this" or "next" for a deadline', () => {
    expect(parse('plan this fri 9am')).toMatchObject({ kind: 'activity', date: '2026-11-13', startTime: '09:00' });
    expect(parse('plan next fri 9am')).toMatchObject({ kind: 'activity', date: '2026-11-13', startTime: '09:00' });
  });

  it('keeps a length with no time as an estimate', () => {
    expect(parse('write report for 2h')).toMatchObject({ kind: 'task', title: 'write report', estimate: 120 });
    expect(parse('tidy desk for 15 min by friday')).toMatchObject({ kind: 'task', estimate: 15 });
  });

  it('can be asked for by name, keeping the date', () => {
    expect(parse('task: dentist tomorrow 3pm')).toMatchObject({ kind: 'task', title: 'dentist', date: '2026-11-08', startTime: undefined });
  });
});

describe('dates', () => {
  it('rolls a date that’s passed to next year, unless a year is given', () => {
    expect(parse('renew on 3 nov').date).toBe('2027-11-03');
    expect(parse('renew on 3 nov 2026').date).toBe('2026-11-03');
  });

  it('reads "this" and "next" weekdays', () => {
    const wednesday = new Date(2026, 10, 11, 9);
    expect(parse('plan this friday', wednesday).date).toBe('2026-11-13');
    expect(parse('plan next friday', wednesday).date).toBe('2026-11-20');
    expect(parse('plan next monday', wednesday).date).toBe('2026-11-16');
  });

  it('crosses month and year ends', () => {
    expect(parse('party tomorrow', new Date(2026, 11, 31, 9)).date).toBe('2027-01-01');
  });

  it('leaves impossible dates in the title', () => {
    expect(parse('call on 31 feb').date).toBeUndefined();
  });
});

describe('details', () => {
  it.each([
    ['fix bug !high', 'high'], ['fix bug !h', 'high'], ['fix bug !urgent', 'high'], ['fix bug urgent', 'high'],
    ['fix bug high priority', 'high'], ['fix bug low priority', 'low'], ['fix bug !low', 'low'],
    ['fix bug priority: medium', 'medium'],
  ])('%s', (text, priority) => {
    expect(parse(text)).toMatchObject({ title: 'fix bug', priority });
  });

  it('collects tags without repeats', () => {
    expect(parse('read paper #study #ML #study')).toMatchObject({ title: 'read paper', tags: ['study', 'ML'] });
  });

  it('links a goal by the start of any part of its name', () => {
    expect(parse('practice exam @aws').goalId).toBe('g1');
    expect(parse('long run @half-marathon').goalId).toBe('g2');
  });

  it('leaves @words that match no goal in the title', () => {
    expect(parse('email @sam')).toMatchObject({ title: 'email @sam', goalId: undefined });
  });

  it('handles everything at once', () => {
    expect(parse('finish slides by friday !high #work @aws for 2h')).toEqual({
      kind: 'task', title: 'finish slides', date: '2026-11-13', startTime: undefined, endTime: undefined,
      priority: 'high', estimate: 120, tags: ['work'], goalId: 'g1',
    });
  });
});

describe('leaving ordinary words alone', () => {
  it.each([
    'sit in the sun',
    'read chapters 3-5',
    'buy 2 tickets',
    'run 5k',
    'run 5m sprints',
    'may the force be with you',
    'march in the parade',
    'call the sat nav people',
    'review section 12',
    'pay 20% deposit',
    'read 1984',
    'urgent care paperwork',
    'a morning walk',
    'evening walk',
  ])('%s', text => {
    expect(parse(text)).toMatchObject({ kind: 'task', title: text, date: undefined, startTime: undefined, estimate: undefined });
  });

  it('reads a whole weekday name as a date, which quotes can prevent', () => {
    expect(parse('watch Friday Night Lights')).toMatchObject({ date: '2026-11-13' });
    expect(parse('watch "Friday Night Lights"')).toMatchObject({ title: 'watch Friday Night Lights', date: undefined });
  });

  it('keeps text in quotes exactly as written', () => {
    expect(parse('"Meet at 6pm" book review tomorrow')).toMatchObject({ kind: 'task', title: 'Meet at 6pm book review', date: '2026-11-08' });
  });

  it('copes with nothing but details', () => {
    expect(parse('tomorrow 6pm').title).toBe('');
    expect(parse('').title).toBe('');
    expect(parse('   ').kind).toBe('task');
  });
});
