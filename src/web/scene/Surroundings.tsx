import { memo, useEffect, useMemo, useState } from 'react';
import type { City, DetailLevel, WeatherSnapshot } from '@shared/domain';
import { api } from '../api/client';
import { Park } from './park/Park';
import { Ambient } from './park/Ambient';
import { CitySkyline } from './city/CitySkyline';
import { Kiosk } from './city/Shops';
import { TrafficView } from './city/TrafficView';
import { SHOP_NAMES } from './city/city-layout';
import { kioskSpot, parkFrame } from './park/park-layout';
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

/** Memoised: employee updates re-render the office every second; the background must not follow. */
export const Surroundings = memo(function Surroundings({
  city,
  detail,
  theme,
  floor = { width: 16, depth: 12 },
}: {
  city: City;
  detail: DetailLevel;
  theme: 'light' | 'dark';
  /** Office size: the park reflows around it (002 T055). */
  floor?: { width: number; depth: number };
}) {
  const weather = useWeather((s) => (s.weather?.city === city ? s.weather : null));
  const condition = weather?.condition ?? 'clear';
  const rainy = condition === 'rain' || condition === 'storm';
  const [ready, setReady] = useState(false);
  // Bench only (/bench?off=trees,traffic,people,city,kiosk): switch parts off to find what costs frames.
  const off = useMemo(() => (typeof location !== 'undefined' && location.pathname.startsWith('/bench') ? new Set((new URLSearchParams(location.search).get('off') ?? '').split(',')) : new Set<string>()), []);
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
          <Park detail={detail} seed={CITY_SEED[city]} rainy={rainy} dark={theme === 'dark'} floor={floor} city={city} noTrees={off.has('trees')} />
          {!off.has('people') && <Ambient detail={detail} seed={CITY_SEED[city]} rainy={rainy} floor={floor} />}
          {!off.has('city') && <CitySkyline city={city} detail={detail} night={theme === 'dark'} />}
          {!off.has('kiosk') && <Kiosk {...kioskSpot(parkFrame(floor))} name={SHOP_NAMES[city].kiosk} night={theme === 'dark'} />}
          {!off.has('traffic') && <TrafficView seed={CITY_SEED[city]} detail={detail} night={theme === 'dark'} />}
        </>
      )}
    </>
  );
});
