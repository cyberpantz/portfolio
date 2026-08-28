import { useState, useEffect, useRef, useCallback } from 'react';
import { wmoToState, type WeatherData } from './conditions';
import { elevationGrid, reliefFromElevations } from './cityTerrain';

type Status = 'locating' | 'fetching' | 'ready' | 'error';

interface UseWeatherResult {
  weather: WeatherData | null;
  status: Status;
  setCity: (city: string) => Promise<void>;
  setLocation: (lat: number, lng: number, label?: string, population?: number) => Promise<void>;
}

export interface ReverseGeocodeResponse {
  locality?: string;
  city?: string;
  principalSubdivision?: string;
  countryName?: string;
  countryCode?: string;
  principalSubdivisionCode?: string;
  localityInfo?: {
    administrative?: { description?: string }[];
    informative?: { name?: string; description?: string }[];
  };
}

const CACHE_KEY = 'weather-vibe:cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
const GEOLOCATION_TIMEOUT_MS = 10_000;

const FALLBACK: WeatherData = {
  state: 'clear-night',
  temperature: 18,
  windspeed: 5,
  winddirection: 0,
  latitude: 0,
  longitude: 0,
};

function compactLocationParts(parts: Array<string | undefined>): string | undefined {
  const compacted = parts
    .map((part) => part?.trim())
    .filter((part): part is string => Boolean(part));
  const deduped = compacted.filter((part, index) => {
    const normalized = part.toLowerCase();
    return compacted.findIndex((candidate) => candidate.toLowerCase() === normalized) === index;
  });
  return deduped.length ? deduped.join(', ') : undefined;
}

export function formatReverseGeocodeLabel(geo: ReverseGeocodeResponse): string | undefined {
  return compactLocationParts([
    geo.city ?? geo.locality,
    geo.principalSubdivision,
    geo.countryName ?? geo.countryCode,
  ]);
}

function readCache(): WeatherData | null {
  try {
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const { data, ts } = JSON.parse(raw);
    if (Date.now() - ts > CACHE_TTL) return null;
    return data as WeatherData;
  } catch {
    return null;
  }
}

function writeCache(data: WeatherData) {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify({ data, ts: Date.now() }));
  } catch {}
}

// Simple astronomical sunrise/sunset (Spencer formula, ±few-minute accuracy).
// Returns UTC timestamps for today's sunrise and sunset at the given coordinates.
function getSunriseSunsetUTC(lat: number, lng: number): { sunriseUTC: number; sunsetUTC: number } {
  const now = new Date();
  const startOfYear = Date.UTC(now.getUTCFullYear(), 0, 1);
  const dayOfYear   = Math.ceil((Date.now() - startOfYear) / 86_400_000);

  const declDeg = 23.45 * Math.sin((360 / 365) * (dayOfYear - 81) * (Math.PI / 180));
  const cosHA   = -Math.tan(lat * (Math.PI / 180)) * Math.tan(declDeg * (Math.PI / 180));

  // Polar day / polar night
  if (cosHA <= -1) return { sunriseUTC: -Infinity, sunsetUTC: Infinity  };
  if (cosHA >=  1) return { sunriseUTC:  Infinity, sunsetUTC: -Infinity };

  const haDeg        = Math.acos(cosHA) * (180 / Math.PI);
  const solarNoon_h  = 12 - lng / 15;                           // solar noon in UTC hours
  const sunriseHours = solarNoon_h - haDeg / 15;
  const sunsetHours  = solarNoon_h + haDeg / 15;

  const startOfDayUTC = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return {
    sunriseUTC: startOfDayUTC + sunriseHours * 3_600_000,
    sunsetUTC:  startOfDayUTC + sunsetHours  * 3_600_000,
  };
}

/**
 * Open-Meteo returns admin1 as a full name ("California") and never
 * sends an admin1_code, so a two-letter state has to be expanded here
 * before it can be compared.
 */
const US_STATES: Record<string, string> = {
  al: 'alabama', ak: 'alaska', az: 'arizona', ar: 'arkansas', ca: 'california',
  co: 'colorado', ct: 'connecticut', de: 'delaware', fl: 'florida', ga: 'georgia',
  hi: 'hawaii', id: 'idaho', il: 'illinois', in: 'indiana', ia: 'iowa',
  ks: 'kansas', ky: 'kentucky', la: 'louisiana', me: 'maine', md: 'maryland',
  ma: 'massachusetts', mi: 'michigan', mn: 'minnesota', ms: 'mississippi',
  mo: 'missouri', mt: 'montana', ne: 'nebraska', nv: 'nevada',
  nh: 'new hampshire', nj: 'new jersey', nm: 'new mexico', ny: 'new york',
  nc: 'north carolina', nd: 'north dakota', oh: 'ohio', ok: 'oklahoma',
  or: 'oregon', pa: 'pennsylvania', ri: 'rhode island', sc: 'south carolina',
  sd: 'south dakota', tn: 'tennessee', tx: 'texas', ut: 'utah', vt: 'vermont',
  va: 'virginia', wa: 'washington', wv: 'west virginia', wi: 'wisconsin',
  wy: 'wyoming', dc: 'district of columbia',
};

export async function geocodeCity(city: string): Promise<{ latitude: number; longitude: number; name: string; population?: number } | null> {
  // Support "Austin, TX" or "London, UK": split on the first comma, query
  // the bare city name, then pick the candidate matching the hint.
  const commaIdx = city.indexOf(',');
  const queryName = commaIdx >= 0 ? city.slice(0, commaIdx).trim() : city.trim();
  const hint      = commaIdx >= 0 ? city.slice(commaIdx + 1).trim() : '';

  // Results come back ordered by population, so a small count silently
  // drops smaller places. "Albany" put Albany CA (pop 19,735) at index
  // 7 — with count=5 it was never a candidate and the old code fell
  // through to results[0], Albany NY. Ask for the full set instead.
  const count = hint ? 100 : 1;

  const res  = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(queryName)}&count=${count}&language=en&format=json`,
  );
  const data = await res.json();
  const results: any[] = data.results ?? [];
  if (!results.length) return null;

  let r = results[0];
  if (hint) {
    const h = hint.toLowerCase();
    const expanded = US_STATES[h] ?? h;

    /*
     * Scored rather than first-substring-wins. The old test was
     * `admin1.includes(hint)`, which matches far too much: "OR" is
     * inside "North Carolina" and "Florida", so "Albany, OR" could
     * resolve to either. It also compared the hint against
     * country_code, where "CA" is Canada — so "CA" could pick a
     * Canadian result over California depending on population order.
     *
     * An exact state match therefore outranks a country match, and
     * loose matches only apply when nothing better exists.
     */
    const score = (c: any): number => {
      const a1 = (c.admin1 ?? '').toLowerCase();
      const co = (c.country ?? '').toLowerCase();
      const cc = (c.country_code ?? '').toLowerCase();

      if (a1 && a1 === expanded) return 100;   // California === california
      if (a1 && a1 === h) return 100;          // typed the state in full
      if (co && co === expanded) return 80;    // "Albany, Australia"
      if (cc && cc === h && !US_STATES[h]) return 70; // "Paris, FR"
      if (a1 && a1.startsWith(h)) return 40;   // "Albany, Cal"
      if (cc && cc === h) return 30;           // ambiguous: CA as Canada
      if (co && co.includes(h)) return 20;
      return 0;
    };

    let best = 0;
    for (const c of results) {
      const s = score(c);
      // Strictly greater keeps the first of any tie, which preserves
      // the population ordering the API already applied.
      if (s > best) { best = s; r = c; }
    }
  }

  const admin1 = (r.admin1 ?? '').toLowerCase() !== r.name.toLowerCase() ? r.admin1 : null;
  const suffix = admin1 ?? r.country ?? r.country_code ?? '';
  const name   = suffix ? `${r.name}, ${suffix}` : r.name;
  return { latitude: r.latitude, longitude: r.longitude, name, population: r.population };
}

/**
 * Terrain ruggedness around a point, from real elevation data.
 *
 * One request for a 5x5 grid — Open-Meteo's elevation endpoint takes up to
 * 100 coordinate pairs at once, so sampling the shape of the land costs the
 * same as sampling a single point.
 *
 * Never throws and never blocks the scene on failure: any problem resolves to
 * 0, which means flat, which is exactly how every city rendered before this
 * existed. A missing hill is a non-event; a scene that will not load is not.
 */
async function fetchRelief(latitude: number, longitude: number): Promise<number> {
  try {
    const { lats, lons } = elevationGrid(latitude, longitude);
    const res = await fetch(
      `https://api.open-meteo.com/v1/elevation?latitude=${lats.join(',')}&longitude=${lons.join(',')}`,
    );
    if (!res.ok) return 0;
    const data = await res.json();
    if (!Array.isArray(data?.elevation)) return 0;

    const relief = reliefFromElevations(data.elevation as number[]);

    // Surfaced deliberately: the thresholds in reliefFromElevations are
    // reasoned rather than measured, and this is the cheapest way to find out
    // what real cities actually score.
    if (typeof console !== 'undefined') {
      console.info(
        `[weather-vibe] relief ${relief.toFixed(2)} from ${data.elevation.length} elevation samples`,
      );
    }
    return relief;
  } catch {
    return 0;
  }
}

async function fetchWeatherData(
  latitude: number,
  longitude: number,
  existingCity?: string,
  knownPopulation?: number,
): Promise<WeatherData> {
  const weatherRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`);
  if (!weatherRes.ok) throw new Error('Weather fetch failed');
  const data = await weatherRes.json();
  const cw = data.current_weather;
  if (!cw) throw new Error('Weather payload missing current conditions');
  const timezone: string | undefined = data.timezone ?? undefined;
  const geo: ReverseGeocodeResponse = await fetch(
    `https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`,
  )
    .then((res) => (res.ok ? res.json() : {}))
    .catch(() => ({}));
  const city = existingCity ?? formatReverseGeocodeLabel(geo);

  // When population is known (city search via Open-Meteo geocoding), use tiered thresholds:
  // < 30k  → rural, 30k–200k → town (low-rise), ≥ 200k → urban (skyscrapers).
  // For GPS-based location, fall back to BigDataCloud admin description check (rural vs urban only).
  let urbanDensity: WeatherData['urbanDensity'];
  if (knownPopulation !== undefined) {
    if (knownPopulation >= 200_000)      urbanDensity = 'urban';
    else if (knownPopulation >= 30_000)  urbanDensity = 'town';
    else                                  urbanDensity = 'rural';
  } else {
    const adminEntries: { description?: string }[] =
      geo.localityInfo?.administrative ?? [];
    const isActualCity = adminEntries.some((e) =>
      /\bcity\b/i.test(e.description ?? ''),
    );
    urbanDensity = isActualCity ? 'urban' : 'rural';
  }

  // Terrain detection: is this a tropical island?
  const isTropicalLat = Math.abs(latitude) <= 28;
  const ISLAND_COUNTRY_CODES = new Set([
    // Pacific
    'PF', 'CK', 'NU', 'TO', 'WS', 'AS', 'FJ', 'VU', 'SB', 'KI', 'NR', 'TV',
    'MH', 'FM', 'PW', 'GU', 'MP',
    // Indian Ocean
    'MV', 'SC', 'MU', 'RE', 'YT', 'CC', 'CX',
    // Caribbean
    'CU', 'JM', 'HT', 'DO', 'PR', 'VI', 'VG', 'AI', 'KN', 'AG', 'DM', 'LC',
    'BB', 'VC', 'GD', 'TT', 'TC', 'BS', 'KY', 'AW', 'CW', 'BQ', 'GP', 'MQ',
    'MF', 'BL',
    // Atlantic
    'CV', 'ST',
    // Southeast Asia island nations
    'SG', 'LK',
  ]);
  const isIslandCountry = ISLAND_COUNTRY_CODES.has(geo.countryCode ?? '');
  const isUSTropicalTerritory = ['US-HI', 'US-PR', 'US-GU', 'US-AS', 'US-VI'].includes(
    geo.principalSubdivisionCode ?? '',
  );

  // Coastal detection: BigDataCloud's informative entries include the nearby
  // ocean/sea/bay for cities close to the coast (e.g. Pacific Ocean for SF).
  const COASTAL_RE = /\b(ocean|sea|bay|gulf|strait|channel|sound|fjord|cove|inlet|harbor|harbour|lagoon|estuary|bight)\b/i;
  const informative: { name?: string; description?: string }[] =
    geo.localityInfo?.informative ?? [];
  const isCoastalArea = informative.some(
    (e) => COASTAL_RE.test(e.description ?? '') || COASTAL_RE.test(e.name ?? ''),
  );

  const terrain: WeatherData['terrain'] =
    isTropicalLat && (isIslandCountry || isUSTropicalTerritory) ? 'island' :
    isCoastalArea ? 'coastal' :
    'standard';

  // Golden hour: within 45 min of sunrise or sunset, clear or partly cloudy.
  const GOLDEN_WINDOW = 45 * 60_000;
  const { sunriseUTC, sunsetUTC } = getSunriseSunsetUTC(latitude, longitude);
  const baseState = wmoToState(cw.weathercode, cw.is_day === 1);
  const nearTransition =
    Math.abs(Date.now() - sunriseUTC) <= GOLDEN_WINDOW ||
    Math.abs(Date.now() - sunsetUTC)  <= GOLDEN_WINDOW;
  const state = nearTransition && (baseState === 'clear-day' || baseState === 'partly-cloudy')
    ? 'golden-hour' as const
    : baseState;

  // Only cities render hills, so only cities pay for the lookup. Everywhere
  // else this is skipped entirely rather than fetched and discarded.
  const relief = urbanDensity === 'urban' ? await fetchRelief(latitude, longitude) : 0;

  return {
    relief,
    state,
    temperature: cw.temperature,
    windspeed: cw.windspeed,
    winddirection: cw.winddirection ?? 0,
    latitude,
    longitude,
    city,
    timezone,
    urbanDensity,
    population: knownPopulation,
    terrain,
  };
}

export function useWeather(): UseWeatherResult {
  const [weather, setWeather] = useState<WeatherData | null>(() => readCache());
  const [status, setStatus] = useState<Status>(() => readCache() ? 'ready' : 'locating');
  const coordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    async function doFetch(
      latitude: number,
      longitude: number,
      existingCity?: string,
      population?: number,
      options: { fallbackOnError?: boolean } = {},
    ) {
      try {
        const result = await fetchWeatherData(latitude, longitude, existingCity, population);
        writeCache(result);
        setWeather(result);
        setStatus('ready');
      } catch {
        if (options.fallbackOnError) {
          setWeather({ ...FALLBACK, latitude, longitude, city: existingCity });
        }
        setStatus('ready');
      }
    }

    const cached = readCache();
    if (cached) {
      // Seed coords from cache so the interval can refetch, then immediately
      // re-fetch in the background so is_day / conditions are never stale.
      coordsRef.current = { latitude: cached.latitude, longitude: cached.longitude };
      doFetch(cached.latitude, cached.longitude, cached.city);
    } else {
      if (!navigator.geolocation) {
        setWeather(FALLBACK);
        setStatus('ready');
        return;
      }
      setStatus('locating');
      navigator.geolocation.getCurrentPosition(
        ({ coords }) => {
          const { latitude, longitude } = coords;
          coordsRef.current = { latitude, longitude };
          setStatus('fetching');
          doFetch(latitude, longitude, undefined, undefined, { fallbackOnError: true });
        },
        () => {
          setWeather(FALLBACK);
          setStatus('ready');
        },
        {
          maximumAge: CACHE_TTL,
          timeout: GEOLOCATION_TIMEOUT_MS,
        },
      );
    }

    const intervalId = setInterval(() => {
      if (!coordsRef.current) return;
      const { latitude, longitude } = coordsRef.current;
      const city = weather?.city;
      const population = weather?.population;
      doFetch(latitude, longitude, city, population);
    }, CACHE_TTL);

    return () => clearInterval(intervalId);
  }, []);

  const setCity = useCallback(async (city: string) => {
    setStatus('fetching');
    try {
      const geo = await geocodeCity(city);
      if (!geo) { setStatus('ready'); return; }
      coordsRef.current = { latitude: geo.latitude, longitude: geo.longitude };
      const result = await fetchWeatherData(geo.latitude, geo.longitude, geo.name, geo.population);
      writeCache(result);
      setWeather(result);
      setStatus('ready');
    } catch {
      setStatus('ready');
    }
  }, []);

  const setLocation = useCallback(async (lat: number, lng: number, label?: string, population?: number) => {
    setStatus('fetching');
    try {
      coordsRef.current = { latitude: lat, longitude: lng };
      const result = await fetchWeatherData(lat, lng, label, population);
      writeCache(result);
      setWeather(result);
      setStatus('ready');
    } catch {
      setStatus('ready');
    }
  }, []);

  return { weather, status, setCity, setLocation };
}
