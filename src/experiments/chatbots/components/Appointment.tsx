import { useEffect, useMemo, useState } from 'react';
import { formatRange, googleUrl, resolve, toICS, type CalendarEvent } from './calendar';
import s from './product.module.css';

/**
 * A booked appointment, as a calendar entry you can actually keep.
 *
 * Scenario-agnostic by design: it knows a title, a time, optionally a
 * place, and optionally a few things to bring. Nothing about clinics. A
 * therapy appointment, a vet visit or a video call all render through it
 * unchanged — which is the test of whether it is a component or a screen
 * with a costume on.
 *
 * The appointment is fictional and the export is real. That asymmetry is
 * deliberate: the .ics genuinely imports, so the interaction can be
 * judged rather than imagined, and the event's own description says where
 * it came from so nobody is confused by it three weeks later.
 */
export function Appointment({
  title,
  day,
  time,
  minutes,
  location,
  prep,
}: {
  title: string;
  day: 'today' | 'tomorrow';
  time: string;
  minutes: number;
  location?: string;
  prep?: [string, string][];
}) {
  /*
   * Resolved once on mount, not per render.
   *
   * `new Date()` during render makes the component impure and, worse,
   * makes the server and client markup disagree — the classic hydration
   * mismatch. A state initialiser runs once, on the client, after mount.
   */
  const [when, setWhen] = useState<{ start: Date; end: Date } | null>(null);
  useEffect(() => setWhen(resolve(day, time, minutes)), [day, time, minutes]);

  const event: CalendarEvent | null = useMemo(
    () =>
      when && {
        title,
        start: when.start,
        end: when.end,
        location,
        description: 'Added from a portfolio demo — this appointment is not real.',
      },
    [when, title, location]
  );

  /* Blob URL for the .ics, revoked when it changes or unmounts. */
  const [ics, setIcs] = useState<string | null>(null);
  useEffect(() => {
    if (!event) return;
    const url = URL.createObjectURL(new Blob([toICS(event)], { type: 'text/calendar' }));
    setIcs(url);
    return () => URL.revokeObjectURL(url);
  }, [event]);

  return (
    <div className={s.card} data-card>
      <div className={s.appt}>
        {/* The torn-off date block. The single most recognisable thing
            about a calendar entry, and the reason this reads as one
            before anybody has read a word of it. */}
        <div className={s.apptDate} aria-hidden="true">
          <span>{when ? when.start.toLocaleDateString(undefined, { month: 'short' }) : '—'}</span>
          <b>{when ? when.start.getDate() : '—'}</b>
        </div>
        <div className={s.apptBody}>
          <p className={s.apptTitle}>{title}</p>
          <p className={s.apptMeta}>
            {when ? (
              <>
                {when.start.toLocaleDateString(undefined, { weekday: 'long' })} ·{' '}
                {formatRange(when.start, when.end)}
              </>
            ) : (
              ' '
            )}
          </p>
          {location && <p className={s.apptMeta}>{location}</p>}
        </div>
      </div>

      <div className={s.apptActions}>
        {/* Named by outcome, not mechanism — "Add to Google Calendar",
            not "Export". */}
        <a
          className={s.apptBtn}
          href={event ? googleUrl(event) : undefined}
          target="_blank"
          rel="noopener noreferrer"
          aria-disabled={!event}
        >
          Add to Google Calendar
        </a>
        <a
          className={s.apptBtn}
          href={ics ?? undefined}
          download="appointment.ics"
          aria-disabled={!ics}
        >
          Download .ics
        </a>
      </div>

      {prep && prep.length > 0 && (
        <>
          <p className={s.cardTitle} style={{ marginTop: 14 }}>
            Worth having ready
          </p>
          {prep.map(([k, v]) => (
            <div key={k} className={s.row}>
              <b>{k}</b>
              <span>{v}</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}
