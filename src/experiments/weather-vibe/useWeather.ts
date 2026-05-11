import { useState, useEffect, useRef, useCallback } from 'react';
import { wmoToState, type WeatherData } from './conditions';

type Status = 'locating' | 'fetching' | 'ready' | 'error';

interface UseWeatherResult {
  weather: WeatherData | null;
  status: Status;
  setCity: (city: string) => Promise<void>;
}

const CACHE_KEY = 'weather-vibe:cache';
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const FALLBACK: WeatherData = {
  state: 'clear-night',
  temperature: 18,
  windspeed: 5,
  winddirection: 0,
  latitude: 0,
  longitude: 0,
};

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

async function geocodeCity(city: string): Promise<{ latitude: number; longitude: number; name: string; population?: number } | null> {
  // Support "Austin, TX" or "London, UK": split on first comma so we can
  // query just the city name and then pick the candidate matching the hint.
  const commaIdx = city.indexOf(',');
  const queryName = commaIdx >= 0 ? city.slice(0, commaIdx).trim() : city.trim();
  const hint      = commaIdx >= 0 ? city.slice(commaIdx + 1).trim() : '';
  const count     = hint ? 5 : 1;

  const res  = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(queryName)}&count=${count}&language=en&format=json`,
  );
  const data = await res.json();
  const results: any[] = data.results ?? [];
  if (!results.length) return null;

  let r = results[0];
  if (hint) {
    const h = hint.toLowerCase();
    const match = results.find(c => {
      const a1code = (c.admin1_code  ?? '').toLowerCase();
      const cc     = (c.country_code ?? '').toLowerCase();
      const a1     = (c.admin1       ?? '').toLowerCase();
      const co     = (c.country      ?? '').toLowerCase();
      return a1code === h || cc === h || a1.includes(h) || co.includes(h);
    });
    if (match) r = match;
  }

  const suffix = r.admin1 ?? r.country_code ?? r.country ?? '';
  const name   = suffix ? `${r.name}, ${suffix}` : r.name;
  return { latitude: r.latitude, longitude: r.longitude, name, population: r.population };
}

async function fetchWeatherData(
  latitude: number,
  longitude: number,
  existingCity?: string,
  knownPopulation?: number,
): Promise<WeatherData> {
  // Always fetch BigDataCloud so urbanDensity is always fresh (geo.city = urban area)
  const [weatherRes, geoRes] = await Promise.all([
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`),
    fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`),
  ]);
  const data = await weatherRes.json();
  const cw = data.current_weather;
  const timezone: string | undefined = data.timezone ?? undefined;
  const geo = await geoRes.json().catch(() => ({}));
  const city = existingCity ?? geo.city ?? geo.locality ?? undefined;

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

  return {
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
    async function doFetch(latitude: number, longitude: number, existingCity?: string, population?: number) {
      try {
        const result = await fetchWeatherData(latitude, longitude, existingCity, population);
        writeCache(result);
        setWeather(result);
        setStatus('ready');
      } catch {
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
          doFetch(latitude, longitude);
        },
        () => {
          setWeather(FALLBACK);
          setStatus('ready');
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

  return { weather, status, setCity };
}
