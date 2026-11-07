import { describe, expect, it } from 'vitest';
import { PARK_RADIUS } from '../../src/web/scene/park/detail';
import { CLEAR, PATH_WIDTH, ellipseScale, exerciseSpots, parkFrame, treeAllowed, treeCandidates } from '../../src/web/scene/park/park-layout';

// 002 T055 — the park reflows around the office (FR-026, R2-05).

const SIZES = [
  { width: 6, depth: 6 },
  { width: 16, depth: 12 },
  { width: 28, depth: 20 },
  { width: 40, depth: 40 },
];

/** Distance from a point to the office rectangle (0 inside). */
const toOffice = (hw: number, hd: number, x: number, z: number) => Math.hypot(Math.max(0, Math.abs(x) - hw), Math.max(0, Math.abs(z) - hd));

describe.each(SIZES)('office $width × $depth m', (floor) => {
  const f = parkFrame(floor);
  const trees = treeCandidates(7, 600);

  it('keeps ≥ 5 m of lawn between the office and the loop path all the way round', () => {
    for (let a = 0; a < Math.PI * 2; a += Math.PI / 180) {
      const inner = { x: Math.cos(a) * (f.rx - PATH_WIDTH / 2), z: Math.sin(a) * (f.rz - PATH_WIDTH / 2) };
      expect(toOffice(f.hw, f.hd, inner.x, inner.z)).toBeGreaterThanOrEqual(5);
    }
  });

  it('shows no tree within 8 m of the office, on the path, or outside the park', () => {
    for (const t of trees.filter((t) => treeAllowed(f, t.x, t.z))) {
      expect(toOffice(f.hw, f.hd, t.x, t.z)).toBeGreaterThanOrEqual(CLEAR - 1e-9);
      expect(ellipseScale(f, t.x, t.z)).toBeGreaterThan(1);
      expect(Math.hypot(t.x, t.z)).toBeLessThan(PARK_RADIUS);
    }
  });

  it('puts the exercise group on open lawn outside the path, away from the office', () => {
    for (const p of exerciseSpots(f, 3)) {
      expect(ellipseScale(f, p.x, p.z)).toBeGreaterThan(1);
      expect(toOffice(f.hw, f.hd, p.x, p.z)).toBeGreaterThan(CLEAR - 1e-9);
    }
  });
});

describe('park reflow', () => {
  it('uses one fixed tree set: growing the office only hides trees, never moves them', () => {
    const a = treeCandidates(7, 600);
    const b = treeCandidates(7, 600);
    expect(a).toEqual(b);
    const shown = (floor: { width: number; depth: number }) => new Set(a.filter((t) => treeAllowed(parkFrame(floor), t.x, t.z)));
    const small = shown({ width: 16, depth: 12 });
    const big = shown({ width: 40, depth: 40 });
    for (const t of big) expect(small.has(t)).toBe(true);
    expect(big.size).toBeLessThan(small.size);
    expect(big.size).toBeGreaterThan(50); // still a park at the largest size
  });

  it('a 40 × 40 m office still has its loop path inside the park', () => {
    const f = parkFrame({ width: 40, depth: 40 });
    expect(Math.max(f.rx, f.rz) + PATH_WIDTH / 2 + 3).toBeLessThan(PARK_RADIUS);
  });
});
