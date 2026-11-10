import { describe, expect, it } from 'vitest';
import { CLEAR, kioskSpot, parkFrame, parkShops, PATH_WIDTH, treeAllowed, ellipseScale } from '../../src/web/scene/park/park-layout';

// 004 T025 (FR-026, data-model §5): four shops around the park, outside the lawn and the loop path.

describe('parkShops', () => {
  for (const floor of [
    { width: 10, depth: 8 },
    { width: 40, depth: 40 },
  ]) {
    it(`${floor.width}×${floor.depth} m office`, () => {
      const f = parkFrame(floor);
      const shops = parkShops(f);
      expect(shops.map((s) => s.id).sort()).toEqual(['banhmi', 'cafe', 'grocery', 'sugarcane']);
      const cafe = shops.find((s) => s.id === 'cafe')!;
      const k = kioskSpot(f);
      expect(cafe.x).toBeCloseTo(k.x, 6);
      expect(cafe.z).toBeCloseTo(k.z, 6);
      for (const s of shops) {
        expect(s.seats.length).toBeGreaterThanOrEqual(2);
        expect(s.seats.length).toBeLessThanOrEqual(4);
        expect(s.stands.length).toBeGreaterThanOrEqual(1);
        expect(s.stands.length).toBeLessThanOrEqual(2);
        // Not on the lawn kept free for resizing the office…
        expect(Math.abs(s.x) < f.hw + CLEAR && Math.abs(s.z) < f.hd + CLEAR).toBe(false);
        // …and the pavilion box is clear of the loop path.
        const margin = (PATH_WIDTH / 2) / Math.min(f.rx, f.rz);
        expect(Math.abs(ellipseScale(f, s.box.x, s.box.z) - 1)).toBeGreaterThan(margin);
        // No tree within 4 m.
        expect(treeAllowed(f, s.x + 1, s.z + 1)).toBe(false);
        // Unique spot ids.
        const ids = [...s.seats, ...s.stands].map((x) => x.id);
        expect(new Set(ids).size).toBe(ids.length);
      }
    });
  }
});
