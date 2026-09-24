/**
 * Calendar export. Pure functions, no React, no scenario knowledge.
 *
 * Split out from the component so it can be tested without a DOM and
 * reused by anything that needs to hand someone an event — a therapy
 * appointment, a vet visit, a video call. Nothing in here knows what the
 * appointment is for.
 */

export type CalendarEvent = {
  title: string;
  start: Date;
  end: Date;
  /** Omitted for anything that does not happen somewhere — a video call. */
  location?: string;
  description?: string;
};

/**
 * Resolve a relative time to a real one.
 *
 * Scripts say "tomorrow at 08:00" rather than a date, because a demo that
 * hands you an appointment in the past is worse than handing you none.
 */
export function resolve(
  day: 'today' | 'tomorrow',
  time: string,
  minutes: number,
  now: Date = new Date()
): { start: Date; end: Date } {
  const start = new Date(now);
  if (day === 'tomorrow') start.setDate(start.getDate() + 1);
  const [h, m] = time.split(':').map(Number);
  start.setHours(h, m ?? 0, 0, 0);
  return { start, end: new Date(start.getTime() + minutes * 60_000) };
}

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Floating local time — no Z, no VTIMEZONE.
 *
 * Deliberate: the appointment is "8am where you are", not an instant on a
 * global timeline. Stamping it UTC would move it for anyone who travels,
 * which is the wrong semantics for a clinic visit.
 */
export function stamp(d: Date): string {
  return (
    `${d.getFullYear()}${pad(d.getMonth() + 1)}${pad(d.getDate())}` +
    `T${pad(d.getHours())}${pad(d.getMinutes())}00`
  );
}

/** RFC 5545 requires CRLF line breaks and escaped separators. */
const esc = (s: string) => s.replace(/([,;\\])/g, '\\$1').replace(/\n/g, '\\n');

export function toICS(e: CalendarEvent): string {
  const uid = `${stamp(e.start)}-${Math.random().toString(36).slice(2, 10)}@chatbots`;
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Chatbots//Care Navigator//EN',
    'CALSCALE:GREGORIAN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${stamp(new Date())}`,
    `DTSTART:${stamp(e.start)}`,
    `DTEND:${stamp(e.end)}`,
    `SUMMARY:${esc(e.title)}`,
    ...(e.location ? [`LOCATION:${esc(e.location)}`] : []),
    ...(e.description ? [`DESCRIPTION:${esc(e.description)}`] : []),
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  return lines.join('\r\n');
}

export function googleUrl(e: CalendarEvent): string {
  const p = new URLSearchParams({
    action: 'TEMPLATE',
    text: e.title,
    dates: `${stamp(e.start)}/${stamp(e.end)}`,
  });
  if (e.location) p.set('location', e.location);
  if (e.description) p.set('details', e.description);
  return `https://calendar.google.com/calendar/render?${p.toString()}`;
}

/** e.g. "Sat 8:00 – 8:30 AM". Tabular-safe, no seconds. */
export function formatRange(start: Date, end: Date): string {
  const t = (d: Date) =>
    d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  return `${t(start)} – ${t(end)}`;
}
