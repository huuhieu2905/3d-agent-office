import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { mapWmo, WeatherService } from '../../src/server/services/weather';
import { createLogger } from '../../src/server/log';

describe('weather (FR-063, R14)', () => {
  it('maps WMO codes to scene conditions', () => {
    expect([0, 1, 2, 3, 45, 61, 81, 95, 73].map(mapWmo)).toEqual(['clear', 'clear', 'cloudy', 'cloudy', 'fog_snow', 'rain', 'rain', 'storm', 'fog_snow']);
  });

  it('only calls Open-Meteo, caches for 30 minutes, and falls back to clear when offline', async () => {
    const urls: string[] = [];
    let online = true;
    const fake = (async (url: string) => {
      urls.push(url);
      if (!online) throw new Error('offline');
      return new Response(JSON.stringify({ current: { weather_code: 61, temperature_2m: 27.5, is_day: 1 } }));
    }) as typeof fetch;
    const svc = new WeatherService(await mkdtemp(join(tmpdir(), 'ao-w-')), createLogger(), fake);
    const t0 = Date.parse('2026-11-07T08:00:00Z');
    const a = await svc.get('hanoi', t0);
    expect(a).toMatchObject({ condition: 'rain', temperatureC: 27.5, isDay: true });
    await svc.get('hanoi', t0 + 10 * 60_000);
    expect(urls).toHaveLength(1);
    expect(urls[0]).toMatch(/^https:\/\/api\.open-meteo\.com\/v1\/forecast\?latitude=21\.0285/);
    online = false;
    const stale = await svc.get('hanoi', t0 + 31 * 60_000);
    expect(stale.condition).toBe('rain'); // keeps last known
    const fresh = await svc.get('tokyo', t0);
    expect(fresh.condition).toBe('clear'); // no data at all → clear, no error
  });
});
