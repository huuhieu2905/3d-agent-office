import { useEffect, useState } from 'react';
import type { City, DetailLevel, WeatherSnapshot } from '@shared/domain';
import { api } from '../api/client';
import { Park } from './park/Park';
import { Ambient } from './park/Ambient';
import { CitySkyline } from './city/CitySkyline';
import { Weather } from './weather/Weather';
import { useWeather } from '../state/weather';

// US6: everything outside the office. Weather is refreshed every 30 minutes (FR-063).

const CITY_SEED: Record<City, number> = { hanoi: 1, hcmc: 2, singapore: 3, tokyo: 4, newyork: 5 };

export function useCityWeather(city: City, enabled: boolean) {
  const set = useWeather((s) => s.set);
  useEffect(() => {
    if (!enabled) return;
    let alive = true;
    const load = () =>
      api<WeatherSnapshot>(`/api/weather?city=${city}`)
        .then((w) => alive && set(w))
        .catch(() => undefined);
    void load();
    const id = setInterval(load, 30 * 60_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [city, enabled, set]);
}

export function Surroundings({ city, detail, theme }: { city: City; detail: DetailLevel; theme: 'light' | 'dark' }) {
  const weather = useWeather((s) => (s.weather?.city === city ? s.weather : null));
  const condition = weather?.condition ?? 'clear';
  const rainy = condition === 'rain' || condition === 'storm';
  const [ready, setReady] = useState(false);
  // Defer the heavy background one frame so the office appears first.
  useEffect(() => {
    const id = requestAnimationFrame(() => setReady(true));
    return () => cancelAnimationFrame(id);
  }, []);
  return (
    <>
      <Weather condition={condition} theme={theme} detail={detail} />
      {ready && (
        <>
          <Park detail={detail} seed={CITY_SEED[city]} rainy={rainy} dark={theme === 'dark'} />
          <Ambient detail={detail} seed={CITY_SEED[city]} rainy={rainy} />
          <CitySkyline city={city} detail={detail} />
        </>
      )}
    </>
  );
}
