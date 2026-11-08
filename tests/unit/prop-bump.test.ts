import { describe, expect, it } from 'vitest';
import type { OfficeLayout } from '../../src/shared/domain';
import { Crowd } from '../../src/web/scene/crowd/crowd';
import { jiggleOf, kickNearest } from '../../src/web/scene/furniture/PropJiggle';

// 002 T098 / US3-AC4 / FR-018, FR-019: walking into furniture is a bump (stop + reaction), and a light
// prop nearby wobbles for a moment without its saved position ever changing.

/** A grid where only the cell (0, 0) can be stood on: every step out of it hits furniture. */
const boxedIn = {
  width: 4,
  toCell: (x: number, z: number) => ({ x: Math.floor(x / 0.25), z: Math.floor(z / 0.25) }),
  toWorld: (c: { x: number; z: number }) => [c.x * 0.25 + 0.125, 0, c.z * 0.25 + 0.125] as [number, number, number],
  walkable: (x: number, z: number) => x === 0 && z === 0,
  canStep: () => false,
  inside: (x: number, z: number) => x >= 0 && z >= 0 && x < 4 && z < 4,
  neighbours: () => [],
};

describe('bumping into furniture', () => {
  it('stops the walker, emits one bump_object per cooldown, and never moves it into the furniture', () => {
    const crowd = new Crowd(boxedIn);
    crowd.place('w', 0.125, 0.125);
    const r = crowd.step('w', 2, 0.125, 0.3, 1 / 60, 0);
    expect(r.progress).toBe(0);
    expect([crowd.get('w')!.x, crowd.get('w')!.z]).toEqual([0.125, 0.125]);
    const ev = crowd.takeEvents('w');
    expect(ev).toHaveLength(1);
    expect(ev[0]!.kind).toBe('bump_object');
    // Still pushing a moment later: no second bump inside the cooldown, one again after it.
    crowd.step('w', 2, 0.125, 0.3, 1 / 60, 500);
    expect(crowd.takeEvents('w')).toHaveLength(0);
    crowd.step('w', 2, 0.125, 0.3, 1 / 60, 1600);
    expect(crowd.takeEvents('w').map((e) => e.kind)).toEqual(['bump_object']);
  });

  it('a gentle push (slower than a walk) is not a bump', () => {
    const crowd = new Crowd(boxedIn);
    crowd.place('w', 0.125, 0.125);
    crowd.step('w', 2, 0.125, 0.3, 2, 0); // 0.15 m/s
    expect(crowd.takeEvents('w')).toHaveLength(0);
  });
});

describe('light props wobble (PropJiggle)', () => {
  const layout: OfficeLayout = {
    schemaVersion: 2,
    floor: { width: 8, depth: 6 },
    shell: { glassSide: 'north', door: { side: 'south', offset: 3 } },
    items: [
      { id: 'desk', type: 'desk', pos: { x: 2, z: 2 }, rotation: 0 },
      { id: 'chair', type: 'chair', pos: { x: 2.5, z: 3 }, rotation: 0 },
      { id: 'plant', type: 'plant', pos: { x: 6, z: 1 }, rotation: 0 },
    ],
  };
  const saved = structuredClone(layout);

  it('picks the nearest light prop (chair or plant), never a desk, and nothing when out of reach', () => {
    expect(kickNearest(layout, 2.75, 3.3, 2.75, 4, 0)).toBe('chair');
    expect(kickNearest(layout, 2.75, 2.6, 2.75, 1, 0)).toBe('chair'); // the desk is closer but is not light
    expect(kickNearest(layout, 6.25, 1.6, 6.25, 3, 0)).toBe('plant');
    expect(kickNearest(layout, 4.5, 5.5, 4.5, 5, 0)).toBeNull();
  });

  it('wobbles a few centimetres, dies out within 0.8 s, and leaves the saved layout untouched', () => {
    kickNearest(layout, 6.25, 1.6, 6.25, 3, 1000);
    let maxShift = 0;
    for (let t = 1000; t < 1800; t += 10) {
      const j = jiggleOf('plant', t);
      if (j) maxShift = Math.max(maxShift, Math.hypot(j.dx, j.dz));
    }
    expect(maxShift).toBeGreaterThan(0.005);
    expect(maxShift).toBeLessThan(0.05);
    expect(jiggleOf('plant', 1801)).toBeNull();
    expect(layout).toEqual(saved);
  });
});
