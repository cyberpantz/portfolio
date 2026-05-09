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

async function geocodeCity(city: string): Promise<{ latitude: number; longitude: number; name: string } | null> {
  const res = await fetch(
    `https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(city)}&count=1&language=en&format=json`,
  );
  const data = await res.json();
  const r = data.results?.[0];
  if (!r) return null;
  // Build a readable label: "Austin, TX" or "London, GB"
  const suffix = r.admin1 ?? r.country_code ?? r.country ?? '';
  const name = suffix ? `${r.name}, ${suffix}` : r.name;
  return { latitude: r.latitude, longitude: r.longitude, name };
}

async function fetchWeatherData(
  latitude: number,
  longitude: number,
  existingCity?: string,
): Promise<WeatherData> {
  const requests: Promise<Response>[] = [
    fetch(`https://api.open-meteo.com/v1/forecast?latitude=${latitude}&longitude=${longitude}&current_weather=true&timezone=auto`),
  ];
  if (!existingCity) {
    requests.push(
      fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?latitude=${latitude}&longitude=${longitude}&localityLanguage=en`),
    );
  }

  const [weatherRes, geoRes] = await Promise.all(requests);
  const data = await weatherRes.json();
  const cw = data.current_weather;
  const geo = geoRes ? await geoRes.json().catch(() => ({})) : {};
  const city = existingCity ?? geo.city ?? geo.locality ?? undefined;

  return {
    state: wmoToState(cw.weathercode, cw.is_day === 1),
    temperature: cw.temperature,
    windspeed: cw.windspeed,
    winddirection: cw.winddirection ?? 0,
    latitude,
    longitude,
    city,
  };
}

export function useWeather(): UseWeatherResult {
  const [weather, setWeather] = useState<WeatherData | null>(() => readCache());
  const [status, setStatus] = useState<Status>(() => readCache() ? 'ready' : 'locating');
  const coordsRef = useRef<{ latitude: number; longitude: number } | null>(null);

  useEffect(() => {
    async function doFetch(latitude: number, longitude: number, existingCity?: string) {
      try {
        const result = await fetchWeatherData(latitude, longitude, existingCity);
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
      doFetch(latitude, longitude, city);
    }, CACHE_TTL);

    return () => clearInterval(intervalId);
  }, []);

  const setCity = useCallback(async (city: string) => {
    setStatus('fetching');
    try {
      const geo = await geocodeCity(city);
      if (!geo) { setStatus('ready'); return; }
      coordsRef.current = { latitude: geo.latitude, longitude: geo.longitude };
      const result = await fetchWeatherData(geo.latitude, geo.longitude, geo.name);
      writeCache(result);
      setWeather(result);
      setStatus('ready');
    } catch {
      setStatus('ready');
    }
  }, []);

  return { weather, status, setCity };
}
