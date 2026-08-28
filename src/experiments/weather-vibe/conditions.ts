export type WeatherState =
  | 'clear-day'
  | 'clear-night'
  | 'partly-cloudy'
  | 'partly-cloudy-night'
  | 'overcast'
  | 'fog'
  | 'fog-night'
  | 'rain'
  | 'snow'
  | 'storm'
  | 'golden-hour';

export interface WeatherData {
  state: WeatherState;
  temperature: number;
  windspeed: number;
  winddirection: number;
  latitude: number;
  longitude: number;
  city?: string;
  timezone?: string;
  urbanDensity?: 'urban' | 'town' | 'rural';
  population?: number;
  terrain?: 'island' | 'coastal' | 'standard';
  /**
   * Terrain ruggedness around the city, 0..1, derived from a grid of real
   * elevation samples. Drives whether the skyline stands on hills. Absent
   * until the elevation lookup resolves, and absent forever if it fails —
   * both of which mean "flat", which is the safe default.
   */
  relief?: number;
}

/**
 * Whether a palette depicts night — which is NOT what `isDark` means.
 *
 * `isDark` is a HUD flag ("dark background, so drop-shadow the text"), and two
 * states abuse it: overcast is #7A7A7A and rain is #1A2A3A, both flagged true.
 * Overcast is a grey *afternoon*. Anything keying scene content off `isDark`
 * therefore lights up the windows of a city at 4pm on a cloudy day, which is
 * exactly what was happening.
 *
 * Relative luminance of the sky answers the real question directly, with no
 * new flag to keep in sync across eleven palettes. Overcast lands at 0.19 and
 * rain at 0.02, so the 0.12 threshold has comfortable margin on both sides.
 */
export function isNightPalette(palette: Palette): boolean {
  const hex = palette.background.replace('#', '');
  const toLinear = (c: number) => {
    const s = c / 255;
    return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  const r = toLinear(parseInt(hex.slice(0, 2), 16));
  const g = toLinear(parseInt(hex.slice(2, 4), 16));
  const b = toLinear(parseInt(hex.slice(4, 6), 16));
  return 0.2126 * r + 0.7152 * g + 0.0722 * b < 0.12;
}

export function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

/**
 * A palette describes THE SKY. Every colour in it is chosen relative to
 * `background`, and that is the only ground any of them are safe on.
 *
 * This caused the same bug four times in one session — a settings panel whose
 * text vanished on clear days, a hover fill at 1.16:1, a landmark that
 * dissolved into fog, a CTA nobody could read — every one of them a token
 * borrowed from here and painted onto something that was not the sky. Five of
 * the nine states were unreadable in the settings panel and had been from the
 * start; it only surfaced because the scene happened to sit in overcast,
 * whose textColor is near-white by coincidence.
 *
 * The rule: if it is drawn ON the sky, use these. If it sits on its own
 * ground — a panel, a pill, a glass button — use CHROME below.
 */
export interface Palette {
  /** The sky itself. Everything else here is chosen against this. */
  background: string;
  /** Emphasis that sits WITH the sky, so it cannot also stand out from it.
   *  Fine for HUD accents; measures as low as 1.16:1 on dark chrome. */
  accent: string;
  /** Readable ON THE SKY — dark on light states, light on dark ones.
   *  Never on chrome: on light-sky weather this is a dark navy. */
  textColor: string;
  /** True = dark sky, so sky-borne text wants a drop shadow. Not a
   *  time-of-day flag — see isNightPalette, which overcast breaks. */
  isDark: boolean;
  vibe: string;
}

/**
 * Colours for UI that sits on its own ground rather than on the sky.
 *
 * Fixed on purpose. The glass is dark in every weather, so its foreground can
 * be too — and a constant ground deserves a constant foreground. Chrome that
 * followed the palette is exactly what kept breaking.
 */
export const CHROME = {
  /** 13.47:1 on the panel ground, 5.06:1 on glass over the brightest sky. */
  fg: '#E8EDF2',
  /** Resting glass. Below ~0.5 alpha a bright sky washes the label out. */
  glass: 'rgba(0,0,0,0.58)',
  /** Hover / active glass. */
  glassStrong: 'rgba(0,0,0,0.68)',
  /** The portfolio's accent, matching --color-accent in explorations.css.
   *  Chrome belongs to the site, not to the forecast. */
  teal: '#6fd0c2',
} as const;

export const PALETTES: Record<WeatherState, Palette> = {
  'clear-day':     { background: '#87CEEB', accent: '#F5A623', textColor: '#1A3A5C', isDark: false, vibe: 'OPEN' },
  'clear-night':   { background: '#0A0A1A', accent: '#C8D8F0', textColor: '#C8D8F0', isDark: true,  vibe: 'STILL' },
  'partly-cloudy':       { background: '#B0C4D8', accent: '#7B9FC7', textColor: '#1E3550', isDark: false, vibe: 'DRIFTING' },
  'partly-cloudy-night': { background: '#0A0C18', accent: '#8898B0', textColor: '#B0C0D0', isDark: true,  vibe: 'VEILED'   },
  // Was 'MUTED', which renders next to the mute control and read as a stuck
  // audio indicator. 'CLOSED' is the deliberate opposite of clear-day's
  // 'OPEN' — the sky is one or the other — and needs no explaining, which
  // 'LEADEN' briefly did not manage.
  'overcast':      { background: '#7A7A7A', accent: '#9A9A9A', textColor: '#E8E8E8', isDark: true,  vibe: 'CLOSED' },
  'fog':           { background: '#C8CCBE', accent: '#A0B09A', textColor: '#2A3828', isDark: false, vibe: 'ADRIFT' },
  'fog-night':     { background: '#08090E', accent: '#7A8A98', textColor: '#B0C0CC', isDark: true,  vibe: 'MURK' },
  'rain':          { background: '#1A2A3A', accent: '#2A7A8A', textColor: '#7AC8D8', isDark: true,  vibe: 'INSIDE' },
  'snow':          { background: '#E8EEF4', accent: '#D0E0F0', textColor: '#2A3A50', isDark: false, vibe: 'HUSHED' },
  'storm':         { background: '#050810', accent: '#2244AA', textColor: '#6688DD', isDark: true,  vibe: 'ELECTRIC' },
  'golden-hour':   { background: '#E87020', accent: '#FFB030', textColor: '#F5D8A0', isDark: true,  vibe: 'GOLDEN'   },
};

// WMO weather interpretation code → WeatherState
export function wmoToState(code: number, isDay: boolean): WeatherState {
  if (code === 0) return isDay ? 'clear-day' : 'clear-night';
  if (code <= 2)  return isDay ? 'partly-cloudy' : 'partly-cloudy-night';
  if (code === 3) return 'overcast';
  if (code <= 48) return isDay ? 'fog' : 'fog-night';
  if (code <= 82) return 'rain';
  if (code <= 86) return 'snow';
  return 'storm';
}
