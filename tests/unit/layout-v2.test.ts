import { describe, expect, it } from 'vitest';
import { dropUnsupportedFrames, edgeSegments, frameHeightRange, minFloorSize, resizeBlockers, validateLayout } from '../../src/shared/layout-validation';
import { resizeLayout } from '../../src/shared/layout-resize';
import { defaultLayout } from '../../src/server/services/default-layout';
import { OfficeGrid } from '../../src/shared/nav-core';
import { footprintRect, seatPoint, seatPoints } from '../../src/shared/catalog';
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

// 007 US2: long glass (2 m) and the office door (1 m) on the 0.5 m edge grid.
describe('007 rooms: long glass + office door', () => {
  const base: OfficeLayout = { schemaVersion: 2, floor: { width: 10, depth: 8 }, shell: { glassSide: 'north', door: { side: 'south', offset: 4 } }, items: [] };
  const it_ = (id: string, type: PlacedItem['type'], x: number, z: number, rotation: PlacedItem['rotation'] = 0): PlacedItem => ({ id, type, pos: { x, z }, rotation });
  // A 4 m × 3 m room in the north-west corner with a desk inside.
  const room = (door: PlacedItem[]): OfficeLayout => ({
    ...base,
    items: [it_('desk', 'desk', 1, 0.5), it_('g1', 'long_glass', 0, 3), it_('g2', 'long_glass', 2, 3), it_('g3', 'long_glass', 4, 0, 90), ...door],
  });

  it('a long glass wall covers four 0.5 m segments', () => {
    expect(edgeSegments(it_('g', 'long_glass', 1, 2))).toEqual(['n:1,2', 'n:1.5,2', 'n:2,2', 'n:2.5,2']);
    expect(edgeSegments(it_('d', 'office_door', 3, 1, 90))).toEqual(['w:3,1', 'w:3,1.5']);
  });

  it('rejects a long glass wall overlapping a short glass piece on any segment', () => {
    const v = validateLayout({ ...base, items: [it_('short', 'glass_wall', 3.5, 5), it_('long', 'long_glass', 2, 5)] });
    expect(v.invalidItems).toContain('long');
  });

  it('a room with an office door is valid and the door is walkable', () => {
    const l = room([it_('door', 'office_door', 4, 2, 90)]);
    expect(validateLayout(l)).toMatchObject({ ok: true });
    const g = new OfficeGrid(l);
    // Crossing the doorway (x = 4 m, z ≈ 2.5 m) is allowed; crossing the long glass next to it is not.
    expect(g.canStep({ x: 15, z: 10 }, { x: 16, z: 10 })).toBe(true);
    expect(g.canStep({ x: 15, z: 4 }, { x: 16, z: 4 })).toBe(false);
  });

  it('the same room closed with glass instead of a door cuts its desk off', () => {
    const l = room([it_('w1', 'glass_wall', 4, 2, 90), it_('w2', 'glass_wall', 4, 2.5, 90)]);
    expect(validateLayout(l).reasons['desk']).toBe('No path from the door to this desk');
  });
});

// 007 US3: one generic seat rule for desks and meeting tables.
describe('007 seats', () => {
  // The desk-only rule from before 007, kept here to prove desks did not move.
  const oldSeatPoint = (pos: { x: number; z: number }, rotation: 0 | 90 | 180 | 270) => {
    const cx = pos.x / 0.5;
    const cz = pos.z / 0.5;
    const c =
      rotation === 0 ? { x: cx + 1, z: cz + 2 } : rotation === 180 ? { x: cx + 1, z: cz - 1 } : rotation === 90 ? { x: cx - 1, z: cz + 1 } : { x: cx + 2, z: cz + 1 };
    return { x: (c.x + 0.5) * 0.5, z: (c.z + 0.5) * 0.5 };
  };

  it('seatPoint(desk) is unchanged for every rotation', () => {
    for (const rotation of [0, 90, 180, 270] as const)
      for (const pos of [{ x: 2, z: 2 }, { x: 3.35, z: 7.15 }]) {
        const now = seatPoint({ pos, rotation });
        const old = oldSeatPoint(pos, rotation);
        expect(now.x).toBeCloseTo(old.x, 6);
        expect(now.z).toBeCloseTo(old.z, 6);
      }
  });

  it('an 8-seat table has 8 distinct seats outside the table for every rotation', () => {
    for (const rotation of [0, 90, 180, 270] as const) {
      const t: PlacedItem = { id: 'mt', type: 'meeting_table_8', pos: { x: 4, z: 4 }, rotation };
      const seats = seatPoints(t);
      expect(seats.map((s) => s.id)).toEqual(['mt#0', 'mt#1', 'mt#2', 'mt#3', 'mt#4', 'mt#5', 'mt#6', 'mt#7']);
      expect(new Set(seats.map((s) => `${s.x},${s.z}`)).size).toBe(8);
      const r = footprintRect(t);
      for (const s of seats) expect(s.x > r.x0 && s.x < r.x1 && s.z > r.z0 && s.z < r.z1).toBe(false);
    }
  });

  it('meeting table seats are walkable and reachable; a blocked seat is reported', () => {
    const t: PlacedItem = { id: 'mt', type: 'meeting_table_4', pos: { x: 13, z: 4 }, rotation: 0 };
    const l = withItems([t]);
    expect(validateLayout(l).ok).toBe(true);
    const g = new OfficeGrid(l);
    for (const s of seatPoints(t)) expect(g.seatOf(s.id)).not.toBeNull();
    // A plant on the north-west seat.
    expect(validateLayout(withItems([t, plant('p', 13, 3.25)])).reasons['mt']).toBe('A seat of this table is blocked');
  });
});

// 007 US5: frames hang on walls, glass or the inside of the outer wall.
describe('007 frames', () => {
  const base: OfficeLayout = { schemaVersion: 2, floor: { width: 10, depth: 8 }, shell: { glassSide: 'north', door: { side: 'south', offset: 4 } }, items: [] };
  const item = (id: string, type: PlacedItem['type'], x: number, z: number, rotation: PlacedItem['rotation'] = 0, extra: Partial<PlacedItem> = {}): PlacedItem => ({ id, type, pos: { x, z }, rotation, ...extra });
  const glass = item('g', 'long_glass', 2, 3); // z = 3, x 2–4
  const v = (items: PlacedItem[]) => validateLayout({ ...base, items });

  it('hangs on glass (either side) but not on the open floor or an office door', () => {
    expect(v([glass, item('f', 'painting', 2.5, 3, 0)]).ok).toBe(true);
    expect(v([glass, item('f', 'painting', 2.5, 3, 180)]).ok).toBe(true);
    expect(v([item('f', 'photo_frame', 6, 5)]).reasons['f']).toBe('A picture must hang on a wall');
    expect(v([item('d', 'office_door', 6, 3), item('f', 'photo_frame', 6, 3)]).reasons['f']).toBe('A picture must hang on a wall');
  });

  it('hangs on the inside of the outer wall (008: the north façade too), never facing out or on the main door', () => {
    expect(v([item('f', 'painting', 0, 2, 90)]).ok).toBe(true); // west wall, facing east
    expect(v([item('f', 'painting', 0, 2, 270)]).ok).toBe(false); // facing out
    expect(v([item('f', 'painting', 3, 0, 0)]).ok).toBe(true); // north glass façade, facing in (008 US3)
    expect(v([item('f', 'painting', 3, 0, 180)]).ok).toBe(false); // north façade, facing the park
    expect(v([item('f', 'photo_frame', 4.5, 8, 180)]).ok).toBe(false); // main door span (x 4–5)
    expect(v([item('f', 'photo_frame', 6, 8, 180)]).ok).toBe(true); // south wall
  });

  it('one frame per side of a segment; a picture only on frames', () => {
    expect(v([glass, item('a', 'painting', 2, 3, 0), item('b', 'photo_frame', 2.5, 3, 0)]).reasons['b']).toBe('Another picture is already here');
    expect(v([glass, item('a', 'painting', 2, 3, 0), item('b', 'photo_frame', 2.5, 3, 180)]).ok).toBe(true);
    expect(v([item('s', 'sofa', 6, 5, 0, { picture: `${'a'.repeat(32)}.webp` })]).reasons['s']).toBe('Only picture frames can show a picture');
  });

  it('a frame on the outer wall moves with it on resize, and is never a resize blocker', () => {
    const l: OfficeLayout = { ...base, items: [item('e', 'painting', 10, 2, 270), item('s', 'photo_frame', 8, 8, 180)] };
    expect(resizeBlockers(l, 8, 6)).toEqual([]);
    const grown = resizeLayout(l, 12, 9);
    expect(grown.ok && grown.layout.items.map((i) => i.pos)).toEqual([{ x: 12, z: 2 }, { x: 8, z: 9 }]);
    const shrunk = resizeLayout(l, 8, 6);
    expect(shrunk.ok && shrunk.layout.items.map((i) => i.pos)).toEqual([{ x: 8, z: 2 }, { x: 7.5, z: 6 }]);
    expect(shrunk.ok && validateLayout(shrunk.layout).ok).toBe(true);
  });

  it('dropUnsupportedFrames removes a frame whose glass is gone', () => {
    const l: OfficeLayout = { ...base, items: [glass, item('f', 'painting', 2.5, 3, 0)] };
    expect(dropUnsupportedFrames({ ...l, items: [l.items[1]!] }).items).toEqual([]);
    expect(dropUnsupportedFrames(l)).toBe(l);
  });
});

// 008 US3 + US4: façade next to the wall screen; free placement along the wall and in height.
describe('008 frames', () => {
  const base: OfficeLayout = { schemaVersion: 2, floor: { width: 10, depth: 8 }, shell: { glassSide: 'north', door: { side: 'south', offset: 4 } }, items: [] };
  const item = (id: string, type: PlacedItem['type'], x: number, z: number, rotation: PlacedItem['rotation'] = 0, extra: Partial<PlacedItem> = {}): PlacedItem => ({ id, type, pos: { x, z }, rotation, ...extra });
  const v = (items: PlacedItem[]) => validateLayout({ ...base, items });
  const screen = item('ws', 'wall_screen', 4, 0.5); // x 4–5.5, standing 0.5 m in front of the façade

  it('not behind the wall screen; next to it is fine; moving the screen in front flags the frame, never drops it', () => {
    expect(v([screen, item('f', 'painting', 4.5, 0)]).reasons['f']).toBe('Hidden behind the wall screen');
    expect(v([screen, item('f', 'painting', 2.5, 0)]).ok).toBe(true);
    const l: OfficeLayout = { ...base, items: [item('ws', 'wall_screen', 2, 0.5), item('f', 'painting', 2.5, 0)] };
    expect(validateLayout(l).reasons['f']).toBe('Hidden behind the wall screen');
    expect(dropUnsupportedFrames(l)).toBe(l);
  });

  it('slides along the wall in 5 cm steps; the wall line stays on 0.5 m', () => {
    const glass = item('g', 'long_glass', 2, 3);
    expect(v([glass, item('f', 'photo_frame', 2.15, 3)]).ok).toBe(true);
    expect(v([glass, item('f', 'photo_frame', 2.13, 3)]).reasons['f']).toBe('Position must be in 5 cm steps');
    expect(v([glass, item('f', 'photo_frame', 2.15, 3.05)]).ok).toBe(false);
  });

  it('needs wall behind its whole width: two glass pieces in one line are fine, a gap is not, an office door never counts', () => {
    const short = item('s', 'glass_wall', 1.5, 3);
    const long = item('l', 'long_glass', 2, 3);
    expect(v([short, long, item('f', 'painting', 1.7, 3)]).ok).toBe(true); // 1.7–2.7 across both pieces
    expect(v([item('s', 'glass_wall', 1, 3), long, item('f', 'painting', 1.2, 3)]).reasons['f']).toBe('A picture must hang on a wall'); // gap 1.5–2
    expect(v([long, item('d', 'office_door', 4, 3), item('f', 'painting', 3.5, 3)]).ok).toBe(false);
  });

  it('height: 5 cm steps between 0.2 m + half its height and the wall top − half its height', () => {
    const glass = item('g', 'long_glass', 2, 3);
    expect(frameHeightRange('painting')).toEqual({ min: 0.55, max: 2.25 });
    expect(v([glass, item('f', 'painting', 2, 3, 0, { height: 0.55 })]).ok).toBe(true);
    expect(v([glass, item('f', 'painting', 2, 3, 0, { height: 2.25 })]).ok).toBe(true);
    expect(v([glass, item('f', 'painting', 2, 3, 0, { height: 2.3 })]).reasons['f']).toBe('The picture is too high or too low');
    expect(v([glass, item('f', 'painting', 2, 3, 0, { height: 1.52 })]).ok).toBe(false);
    expect(v([item('s', 'sofa', 6, 5, 0, { height: 1 })]).reasons['s']).toBe('Only picture frames have a height');
  });

  it('two frames overlap only when both their spans and their heights overlap', () => {
    const glass = item('g', 'long_glass', 2, 3);
    const low = item('a', 'photo_frame', 2.5, 3, 0, { height: 1.0 });
    expect(v([glass, low, item('b', 'photo_frame', 2.5, 3, 0, { height: 1.8 })]).ok).toBe(true);
    expect(v([glass, low, item('b', 'photo_frame', 2.5, 3, 0, { height: 1.3 })]).reasons['b']).toBe('Another picture is already here');
  });

  it('a 007 frame without a height is valid at 1.5 m and resizes as before (SC-006)', () => {
    const l: OfficeLayout = { ...base, items: [item('e', 'painting', 10, 2, 270)] };
    expect(validateLayout(l).ok).toBe(true);
    const r = resizeLayout(l, 12, 9);
    expect(r.ok && r.layout.items[0]).toEqual({ id: 'e', type: 'painting', pos: { x: 12, z: 2 }, rotation: 270 });
  });
});
