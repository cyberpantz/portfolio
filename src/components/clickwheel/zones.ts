/**
 * The cities shown in Extras > Clock.
 *
 * Cities, not IANA identifiers. "America/Los_Angeles" does not fit a
 * 176px row and was never what the device showed anyway — the real Clock
 * named cities, because a city is the thing a person actually means when
 * they think about a time somewhere else.
 *
 * Deliberately short. This is an exhibit, not a travel clock: two US
 * coasts, two European offsets (London is not on Berlin's), and two for
 * the rest of the world are enough to show the idea. The real device let
 * you add clocks through New Clock > Region > City; that is three more
 * menu levels to end up with a row this list already shows.
 *
 * `tz: null` is the visitor's own zone rather than a hardcoded default,
 * and it is first because it is the anchor — the photo's top row was the
 * owner's own city too. Everything below it is read as an offset from
 * wherever you happen to be.
 */

export type Zone = {
  /** Shown on the row. */
  label: string;
  /** IANA identifier, or null for whatever the browser is set to. */
  tz: string | null;
};

export const ZONES: Zone[] = [
  { label: 'Local', tz: null },
  { label: 'Los Angeles', tz: 'America/Los_Angeles' },
  { label: 'New York', tz: 'America/New_York' },
  { label: 'London', tz: 'Europe/London' },
  { label: 'Berlin', tz: 'Europe/Berlin' },
  { label: 'Tokyo', tz: 'Asia/Tokyo' },
  { label: 'Sydney', tz: 'Australia/Sydney' },
];
