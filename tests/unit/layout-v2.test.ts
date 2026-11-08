import { describe, expect, it } from 'vitest';
import { minFloorSize, resizeBlockers, validateLayout } from '../../src/shared/layout-validation';
import { defaultLayout } from '../../src/server/services/default-layout';
import { OfficeGrid } from '../../src/shared/nav-core';
import { findPath } from '../../src/web/scene/grid/astar';
import type { OfficeLayout, PlacedItem } from '../../src/shared/domain';

// 002 T014 — layout v2 rules (data-model §3) and the derived 0.25 m navigation grid (R2-03).
// Replaces the v1 tests (layout-validation.test.ts, grid.test.ts).

const withItems = (extra: PlacedItem[], base = defaultLayout()): OfficeLayout => ({ ...base, items: [...base.items, ...extra] });
const plant = (id: string, x: number, z: number): PlacedItem => ({ id, type: 'plant', pos: { x, z }, rotation: 0 });
const firstDesk = (l = defaultLayout()) => l.items.find((i) => i.type === 'desk')!;

describe('validateLayout v2', () => {
  it('accepts the default layout', () => {
    expect(validateLayout(defaultLayout())).toMatchObject({ ok: true, invalidItems: [] });
  });

  it('accepts furniture off the old 0.5 m grid (0.05 m steps, FR-007)', () => {
    expect(validateLayout(withItems([plant('p-free', 3.35, 10.45)])).ok).toBe(true);
  });

  it('rejects positions that are not on the 0.05 m step', () => {
    expect(validateLayout(withItems([plant('p-step', 3.33, 10.4)])).invalidItems).toContain('p-step');
  });

  it('keeps walls on the 0.5 m edge grid', () => {
    const wall: PlacedItem = { id: 'w', type: 'wall', pos: { x: 4.25, z: 7 }, rotation: 0 };
    expect(validateLayout(withItems([wall])).invalidItems).toContain('w');
  });

  it('rejects items outside the floor', () => {
    expect(validateLayout(withItems([plant('p-out', 15.8, 5)])).invalidItems).toContain('p-out');
  });

  it('rejects overlapping solid items (1 mm tolerance) but allows touching edges', () => {
    const d = firstDesk();
    expect(validateLayout(withItems([plant('overlap', d.pos.x + 0.2, d.pos.z + 0.2)])).invalidItems).toContain('overlap');
    expect(validateLayout(withItems([plant('touch', d.pos.x - 0.5, d.pos.z)])).ok).toBe(true);
  });

  it('allows a desk with its own chair on the seat', () => {
    const l = defaultLayout();
    expect(l.items.some((i) => i.type === 'chair')).toBe(true);
    expect(validateLayout(l).ok).toBe(true);
  });

  it('rejects a desk whose seat is blocked', () => {
    const d = firstDesk();
    const r = validateLayout(withItems([plant('blocker', d.pos.x + 0.5, d.pos.z + 1.05)]));
    expect(r.invalidItems).toContain(d.id);
  });

  it('rejects a desk cut off from the door', () => {
    const d = firstDesk();
    const sx = d.pos.x + 0.5;
    const sz = d.pos.z + 1;
    const ring: PlacedItem[] = [
      { id: 'r1', type: 'glass_wall', pos: { x: sx, z: sz + 0.5 }, rotation: 0 },
      { id: 'r2', type: 'glass_wall', pos: { x: sx, z: sz }, rotation: 90 },
      { id: 'r3', type: 'glass_wall', pos: { x: sx + 0.5, z: sz }, rotation: 90 },
    ];
    expect(validateLayout(withItems(ring)).invalidItems).toContain(d.id);
  });

  it('rejects a door item and a floor outside 6–40 m or off the 0.5 m step', () => {
    const base = defaultLayout();
    expect(validateLayout(withItems([{ id: 'd', type: 'door', pos: { x: 1, z: 1 }, rotation: 0 }])).invalidItems).toContain('d');
    expect(validateLayout({ ...base, floor: { width: 41, depth: 12 } }).ok).toBe(false);
    expect(validateLayout({ ...base, floor: { width: 16, depth: 12.3 } }).ok).toBe(false);
  });

  it('rejects a door outside its side or blocked by furniture', () => {
    const base = defaultLayout();
    expect(validateLayout({ ...base, shell: { ...base.shell, door: { side: 'south', offset: 15.5 } } }).reasons.__door__).toBeTruthy();
    expect(validateLayout(withItems([plant('door-block', 7.25, 11.5)])).reasons.__door__).toBeTruthy();
  });
});

describe('minFloorSize / resizeBlockers (FR-024)', () => {
  it('is the far edge of the furthest item plus 0.5 m, rounded up to 0.5 m, at least 6 m', () => {
    const m = minFloorSize(defaultLayout());
    expect(m.width).toBe(16); // plant at x 15..15.5 → 16
    expect(m.depth).toBe(11.5); // plants/cooler end at z 11 → 11.5
    expect(m.blockers.length).toBeGreaterThan(0);
    expect(minFloorSize({ ...defaultLayout(), items: [] })).toMatchObject({ width: 6, depth: 6 });
  });

  it('lists the items that block a shrink', () => {
    const l = defaultLayout();
    const sofa = l.items.find((i) => i.type === 'sofa')!;
    expect(resizeBlockers(l, 14, 12)).toContain(sofa.id);
    expect(resizeBlockers(defaultLayout(), 16, 12)).toEqual([]);
  });
});

describe('navigation grid (0.25 m) + A*', () => {
  const layout = defaultLayout();
  const grid = new OfficeGrid(layout);

  it('every default desk seat is walkable and reachable from the door lobby', () => {
    const { lobby } = grid.entrance();
    for (const desk of layout.items.filter((i) => i.type === 'desk')) {
      const seat = grid.seatOf(desk.id)!;
      expect(grid.walkable(seat.x, seat.z), desk.id).toBe(true);
      expect(findPath(grid, lobby, seat), desk.id).not.toBeNull();
    }
  });

  it('the water cooler is reachable', () => {
    const spot = grid.approachOf('water_cooler')!;
    expect(spot).not.toBeNull();
    expect(findPath(grid, grid.entrance().lobby, spot)).not.toBeNull();
  });

  it('desks block cells (with the cell in front of the seat side blocked) and walls block edges', () => {
    const d = firstDesk(layout);
    const c = grid.floorToCell(d.pos.x + 0.75, d.pos.z + 0.5);
    expect(grid.walkable(c.x, c.z)).toBe(false);
    const wall: PlacedItem = { id: 'w', type: 'wall', pos: { x: 1, z: 11 }, rotation: 0 };
    const g2 = new OfficeGrid(withItems([wall]));
    const above = g2.floorToCell(1.1, 10.9);
    const below = g2.floorToCell(1.1, 11.1);
    expect(g2.canStep(above, below)).toBe(false);
    expect(g2.canStep(g2.floorToCell(2.1, 10.9), g2.floorToCell(2.1, 11.1))).toBe(true);
  });

  it('world/cell conversion round-trips', () => {
    const c = { x: 17, z: 23 };
    const [x, , z] = grid.toWorld(c);
    expect(grid.toCell(x, z)).toEqual(c);
  });

  it('finds paths across a 40 × 40 m office quickly', () => {
    const big = new OfficeGrid({ ...layout, floor: { width: 40, depth: 40 } });
    const t0 = performance.now();
    expect(findPath(big, { x: 0, z: 0 }, { x: 159, z: 159 })).not.toBeNull();
    expect(performance.now() - t0).toBeLessThan(200);
  });
});
