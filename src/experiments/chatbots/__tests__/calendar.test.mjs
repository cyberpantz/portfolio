/**
 * The calendar export, tested without a DOM — which is the point of
 * keeping it out of the component.
 */
import { resolve, toICS, googleUrl, stamp, formatRange } from '../components/calendar.ts';
const now = new Date(2026, 8, 26, 19, 4);   // Sat 26 Sep 2026, 7:04pm
let fails = 0;
const ok = (c, m) => { if (!c) { fails++; console.error('  FAIL ' + m); } };

const t = resolve('today', '19:16', 20, now);
ok(stamp(t.start) === '20260926T191600', 'today start: ' + stamp(t.start));
ok(stamp(t.end) === '20260926T193600', 'today end: ' + stamp(t.end));

const m = resolve('tomorrow', '08:00', 30, now);
ok(stamp(m.start) === '20260927T080000', 'tomorrow start: ' + stamp(m.start));
ok(m.start > now, 'a booked appointment must be in the future');

const ics = toICS({ title: 'Urgent care — ear pain', start: m.start, end: m.end, location: 'Grand Street; Suite 2', description: 'a, b' });
ok(ics.includes('\r\n'), 'ICS must use CRLF');
ok(ics.includes('LOCATION:Grand Street\\; Suite 2'), 'semicolon must be escaped');
ok(ics.includes('DESCRIPTION:a\\, b'), 'comma must be escaped');
ok(!/DTSTART:[^\r]*Z/.test(ics), 'floating local time, never UTC');
ok(ics.startsWith('BEGIN:VCALENDAR') && ics.trimEnd().endsWith('END:VCALENDAR'), 'ICS envelope');

const g = googleUrl({ title: 'Video visit', start: t.start, end: t.end });
ok(g.includes('dates=20260926T191600%2F20260926T193600'), 'google dates: ' + g);
ok(!g.includes('location='), 'no location key when there is no location');

console.log(fails ? `\n${fails} FAILED` : '  all calendar assertions pass');
process.exit(fails ? 1 : 0);
