import { describe, expect, it } from 'vitest';
import { createTraffic, stepTraffic, vehicleLength, type Vehicle } from '../../src/web/scene/city/Traffic';
import { ROAD_RADIUS } from '../../src/web/scene/park/detail';

// 002 T081 — FR-042: cars, motorbikes and buses run both ways in their lanes and never overlap.

const arcGap = (a: Vehicle, b: Vehicle) => {
  let d = Math.abs(a.angle - b.angle) % (Math.PI * 2);
  if (d > Math.PI) d = Math.PI * 2 - d;
  return d * a.radius;
};

describe('traffic on the ring road', () => {
  it('has every kind of vehicle, both directions, on the road ring', () => {
    const v = createTraffic(3, 'medium');
    expect(new Set(v.map((x) => x.kind))).toEqual(new Set(['car', 'moto', 'bus']));
    expect(v.some((x) => x.dir > 0) && v.some((x) => x.dir < 0)).toBe(true);
    for (const x of v) expect(Math.abs(x.radius - ROAD_RADIUS)).toBeLessThan(2.4);
  });

  it('never lets two vehicles in a lane overlap during 5 simulated minutes', () => {
    const v = createTraffic(3, 'high');
    for (let s = 0; s < 5 * 60 * 30; s++) {
      stepTraffic(v, 1 / 30);
      if (s % 30) continue;
      const lanes = new Map<number, Vehicle[]>();
      for (const x of v) lanes.set(x.lane, [...(lanes.get(x.lane) ?? []), x]);
      for (const list of lanes.values())
        for (let i = 0; i < list.length; i++)
          for (let j = i + 1; j < list.length; j++) {
            expect(arcGap(list[i]!, list[j]!)).toBeGreaterThan((vehicleLength(list[i]!.kind) + vehicleLength(list[j]!.kind)) / 2);
          }
    }
  });

  it('scales with the detail level', () => {
    expect(createTraffic(1, 'low').length).toBeLessThan(createTraffic(1, 'high').length);
  });
});
