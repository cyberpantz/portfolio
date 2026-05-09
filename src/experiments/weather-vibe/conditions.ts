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
  | 'storm';

export interface WeatherData {
  state: WeatherState;
  temperature: number;
  windspeed: number;
  winddirection: number;
  latitude: number;
  longitude: number;
  city?: string;
  urbanDensity?: 'urban' | 'rural';
}

export function degreesToCompass(deg: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round(deg / 45) % 8];
}

export interface Palette {
  background: string;
  accent: string;
  // textColor: readable HUD color — dark for light-background states, light for dark ones
  textColor: string;
  // isDark: true = dark bg (apply drop shadow), false = light bg (no shadow, dark text is crisp)
  isDark: boolean;
  vibe: string;
}

export const PALETTES: Record<WeatherState, Palette> = {
  'clear-day':     { background: '#87CEEB', accent: '#F5A623', textColor: '#1A3A5C', isDark: false, vibe: 'OPEN' },
  'clear-night':   { background: '#0A0A1A', accent: '#C8D8F0', textColor: '#C8D8F0', isDark: true,  vibe: 'STILL' },
  'partly-cloudy':       { background: '#B0C4D8', accent: '#7B9FC7', textColor: '#1E3550', isDark: false, vibe: 'DRIFTING' },
  'partly-cloudy-night': { background: '#0A0C18', accent: '#8898B0', textColor: '#B0C0D0', isDark: true,  vibe: 'VEILED'   },
  'overcast':      { background: '#7A7A7A', accent: '#9A9A9A', textColor: '#E8E8E8', isDark: true,  vibe: 'MUTED' },
  'fog':           { background: '#C8CCBE', accent: '#A0B09A', textColor: '#2A3828', isDark: false, vibe: 'ADRIFT' },
  'fog-night':     { background: '#08090E', accent: '#7A8A98', textColor: '#B0C0CC', isDark: true,  vibe: 'MURK' },
  'rain':          { background: '#1A2A3A', accent: '#2A7A8A', textColor: '#7AC8D8', isDark: true,  vibe: 'INSIDE' },
  'snow':          { background: '#E8EEF4', accent: '#D0E0F0', textColor: '#2A3A50', isDark: false, vibe: 'HUSHED' },
  'storm':         { background: '#050810', accent: '#2244AA', textColor: '#6688DD', isDark: true,  vibe: 'ELECTRIC' },
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
