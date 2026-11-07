import type { DetailLevel } from '@shared/domain';

// Counts per detail level (FR-065, R4). The office and employees are never reduced.

export const DETAIL: Record<DetailLevel, { trees: number; flowers: number; walkers: number; cars: number; buildings: number; rain: number; clouds: number }> = {
  low: { trees: 60, flowers: 160, walkers: 6, cars: 4, buildings: 40, rain: 600, clouds: 6 },
  medium: { trees: 160, flowers: 500, walkers: 16, cars: 10, buildings: 90, rain: 1500, clouds: 12 },
  high: { trees: 320, flowers: 1200, walkers: 30, cars: 20, buildings: 160, rain: 3000, clouds: 20 },
};

/** Small deterministic PRNG (mulberry32) so the park and skyline are stable between visits. */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// 002 R2-05: the park must surround even a 40 × 40 m office (loop path ≈ 34 m out, then trees), so the
// road ring moved out from 44 m to 60 m. Paths and the lawn now follow the office: see park-layout.ts.
export const PARK_RADIUS = 54;
export const ROAD_RADIUS = 60;
