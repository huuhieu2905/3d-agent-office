import type { City, WeatherCondition, WeatherSnapshot } from '../../shared/domain';
import { z } from 'zod';
import { JsonStore } from '../storage/json-store';
import type { Logger } from '../log';

// T105 / FR-063 / R14: Open-Meteo current weather for the 5 fixed cities, cached 30 min per city.
// The ONLY outbound Internet call of the system (FR-082). Failures fall back to clear weather silently.

export const CITY_COORDS: Record<City, { lat: number; lon: number; name: string; tz: string }> = {
  hanoi: { lat: 21.0285, lon: 105.8542, name: 'Hà Nội', tz: 'Asia/Ho_Chi_Minh' },
  hcmc: { lat: 10.7769, lon: 106.7009, name: 'TP. Hồ Chí Minh', tz: 'Asia/Ho_Chi_Minh' },
  singapore: { lat: 1.2903, lon: 103.852, name: 'Singapore', tz: 'Asia/Singapore' },
  tokyo: { lat: 35.6762, lon: 139.6503, name: 'Tokyo', tz: 'Asia/Tokyo' },
  newyork: { lat: 40.7128, lon: -74.006, name: 'New York', tz: 'America/New_York' },
};

const TTL_MS = 30 * 60_000;

/** WMO weather interpretation codes → our 5 scene conditions. */
export function mapWmo(code: number): WeatherCondition {
  if (code <= 1) return 'clear';
  if (code <= 3) return 'cloudy';
  if (code === 45 || code === 48 || (code >= 71 && code <= 77) || code === 85 || code === 86) return 'fog_snow';
  if (code >= 95) return 'storm';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82)) return 'rain';
  return 'cloudy';
}

const snapshotSchema = z.object({
  city: z.enum(['hanoi', 'hcmc', 'singapore', 'tokyo', 'newyork']),
  condition: z.enum(['clear', 'cloudy', 'rain', 'storm', 'fog_snow']),
  isDay: z.boolean(),
  temperatureC: z.number().nullable(),
  fetchedAt: z.string(),
  source: z.literal('open-meteo'),
});
const cacheSchema = z.object({ schemaVersion: z.literal(1), cities: z.record(z.string(), snapshotSchema) });
type CacheFile = z.infer<typeof cacheSchema>;

export class WeatherService {
  private store: JsonStore<CacheFile>;
  private inflight = new Map<City, Promise<WeatherSnapshot>>();

  constructor(
    dataDir: string,
    private readonly log: Logger,
    private readonly fetchImpl: typeof fetch = fetch,
  ) {
    this.store = new JsonStore<CacheFile>(dataDir, {
      file: 'weather-cache.json',
      schema: cacheSchema as never,
      defaults: () => ({ schemaVersion: 1, cities: {} }),
    });
  }

  async get(city: City, now = Date.now()): Promise<WeatherSnapshot> {
    const cache = await this.store.read();
    const hit = cache.cities[city] as WeatherSnapshot | undefined;
    if (hit && now - Date.parse(hit.fetchedAt) < TTL_MS) return hit;
    let p = this.inflight.get(city);
    if (!p) {
      p = this.fetchCity(city, hit, now).finally(() => this.inflight.delete(city));
      this.inflight.set(city, p);
    }
    return p;
  }

  private async fetchCity(city: City, stale: WeatherSnapshot | undefined, now: number): Promise<WeatherSnapshot> {
    const c = CITY_COORDS[city];
    const url =
      `https://api.open-meteo.com/v1/forecast?latitude=${c.lat}&longitude=${c.lon}` +
      `&current=temperature_2m,weather_code,cloud_cover,precipitation,wind_speed_10m,is_day&timezone=auto`;
    try {
      const res = await this.fetchImpl(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const j = (await res.json()) as { current?: { weather_code?: number; temperature_2m?: number; is_day?: number } };
      const cur = j.current ?? {};
      const snap: WeatherSnapshot = {
        city,
        condition: mapWmo(Number(cur.weather_code ?? 0)),
        isDay: cur.is_day !== 0,
        temperatureC: typeof cur.temperature_2m === 'number' ? cur.temperature_2m : null,
        fetchedAt: new Date(now).toISOString(),
        source: 'open-meteo',
      };
      const cache = await this.store.read();
      cache.cities[city] = snap;
      await this.store.write(cache);
      return snap;
    } catch (err) {
      this.log.info({ err: { message: (err as Error).message } }, 'weather unavailable, using fallback');
      // Edge case: no Internet → keep the last known weather, else clear sky (never an error for the user).
      return stale ?? { city, condition: 'clear', isDay: true, temperatureC: null, fetchedAt: new Date(now).toISOString(), source: 'open-meteo' };
    }
  }
}
