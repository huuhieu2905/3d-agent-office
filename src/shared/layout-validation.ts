import { CATALOG, CELL, FRAME_HEIGHT_DEFAULT, FRAME_OUTER_H, footprintRect, isEdge, isMeetingTable, isWallMounted, rectsOverlap, seatPoint, seatPoints, WALL_HEIGHT, type Rect } from './catalog';
import { DOOR_WIDTH, FLOOR_MAX, FLOOR_MIN, FLOOR_STEP, POS_STEP, WALL_STEP, type OfficeLayout, type PlacedItem } from './domain';
import { OfficeGrid } from './nav-core';

// Layout v2 rules (specs/002-realistic-ui-refresh/data-model.md §3, "Quy tắc kiểm tra" 1–6).
// Pure and dependency-free so the server (PUT /api/layout) and the build-mode preview share it.

export interface ValidationResult {
  ok: boolean;
  invalidItems: string[];
  reasons: Record<string, string>;
}

const onStep = (v: number, step: number) => Math.abs(v / step - Math.round(v / step)) < 1e-6;

export function floorSizeValid(v: number): boolean {
  return v >= FLOOR_MIN && v <= FLOOR_MAX && onStep(v, FLOOR_STEP);
}

/** Item footprint inside the floor? */
export function insideFloor(layout: Pick<OfficeLayout, 'floor'>, item: PlacedItem): boolean {
  const r = footprintRect(item);
  const e = 1e-6;
  return r.x0 >= -e && r.z0 >= -e && r.x1 <= layout.floor.width + e && r.z1 <= layout.floor.depth + e;
}

/** A chair standing on its desk's seat belongs to that desk and may touch it. */
function chairOfDesk(chair: PlacedItem, desk: PlacedItem): boolean {
  if (chair.type !== 'chair' || desk.type !== 'desk') return false;
  const s = seatPoint(desk);
  const c = footprintRect(chair);
  return Math.abs((c.x0 + c.x1) / 2 - s.x) < 0.3 && Math.abs((c.z0 + c.z1) / 2 - s.z) < 0.3;
}

function solid(item: PlacedItem): boolean {
  return CATALOG[item.type].blocks === 'cell' || item.type === 'chair';
}

/** Keys of the 0.5 m edge segments an edge-grid item covers: `n:x,z` (east-west edge) or `w:x,z` (north-south). */
export function edgeSegments(item: Pick<PlacedItem, 'type' | 'pos' | 'rotation'>): string[] {
  const r = footprintRect(item);
  const ns = item.rotation === 0 || item.rotation === 180;
  const n = Math.round((ns ? r.x1 - r.x0 : r.z1 - r.z0) / CELL);
  const keys: string[] = [];
  for (let i = 0; i < n; i++) {
    const x = Math.round((ns ? r.x0 + i * CELL : r.x0) * 1000) / 1000;
    const z = Math.round((ns ? r.z0 : r.z0 + i * CELL) * 1000) / 1000;
    keys.push(`${ns ? 'n' : 'w'}:${x},${z}`);
  }
  return keys;
}

const WALL_TYPES = new Set(['wall', 'glass_wall', 'long_glass']);
const GLASS_TYPES = new Set(['glass_wall', 'long_glass']);
const EPS = 1e-6;

/** A frame's wall line and its span along it (008): `ns` = an east-west line at z = `c`, else north-south at x = `c`. */
function frameSpan(frame: Pick<PlacedItem, 'type' | 'pos' | 'rotation'>): { ns: boolean; c: number; a0: number; a1: number } {
  const ns = frame.rotation === 0 || frame.rotation === 180;
  const len = CATALOG[frame.type].footprint.w * CELL;
  const a0 = ns ? frame.pos.x : frame.pos.z;
  return { ns, c: ns ? frame.pos.z : frame.pos.x, a0, a1: a0 + len };
}

/** Intervals along a wall line covered by items of `types` lying on it. */
function itemIntervals(layout: Pick<OfficeLayout, 'items'>, ns: boolean, c: number, types: Set<string>): [number, number][] {
  const out: [number, number][] = [];
  for (const it of layout.items) {
    if (!types.has(it.type) || (it.rotation === 0 || it.rotation === 180) !== ns) continue;
    const r = footprintRect(it);
    if (Math.abs((ns ? r.z0 : r.x0) - c) > EPS) continue;
    out.push(ns ? [r.x0, r.x1] : [r.z0, r.z1]);
  }
  return out;
}

/** Is [a0, a1] fully covered by the union of `intervals`? */
function covered(intervals: [number, number][], a0: number, a1: number): boolean {
  let reach = a0;
  for (const [s, e] of [...intervals].sort((p, q) => p[0] - q[0])) {
    if (s > reach + EPS) break;
    reach = Math.max(reach, e);
    if (reach >= a1 - EPS) return true;
  }
  return reach >= a1 - EPS;
}

/**
 * Can this frame hang where it is? There must be wall behind its whole width (008 R8-06): wall / glass / long
 * glass on its line, or the inside of the office's outer wall facing into the office — the north glass façade
 * included (008 US3), the main door span excluded. Office doors never count as wall.
 * Facing: rotation 0 → south, 90 → east, 180 → north, 270 → west.
 */
export function frameSupported(layout: Pick<OfficeLayout, 'floor' | 'shell' | 'items'>, frame: Pick<PlacedItem, 'type' | 'pos' | 'rotation'>): boolean {
  const { ns, c, a0, a1 } = frameSpan(frame);
  const intervals = itemIntervals(layout, ns, c, WALL_TYPES);
  const { width: W, depth: D } = layout.floor;
  const { side, offset } = layout.shell.door;
  const eq = (a: number, b: number) => Math.abs(a - b) < EPS;
  const shell = (len: number, doorHere: boolean) => {
    if (!doorHere) intervals.push([0, len]);
    else intervals.push([0, offset], [offset + DOOR_WIDTH, len]);
  };
  if (ns && eq(c, 0) && frame.rotation === 0) shell(W, false); // north glass façade, facing in
  if (ns && eq(c, D) && frame.rotation === 180) shell(W, side === 'south');
  if (!ns && eq(c, 0) && frame.rotation === 90) shell(D, side === 'west');
  if (!ns && eq(c, W) && frame.rotation === 270) shell(D, side === 'east');
  return covered(intervals, a0, a1);
}

/** Does glass (glass wall or long glass) cover the middle of this frame? (overview: glass is never cut down) */
export function frameOnGlass(layout: Pick<OfficeLayout, 'items'>, frame: Pick<PlacedItem, 'type' | 'pos' | 'rotation'>): boolean {
  const { ns, c, a0, a1 } = frameSpan(frame);
  const mid = (a0 + a1) / 2;
  return itemIntervals(layout, ns, c, GLASS_TYPES).some(([s, e]) => s <= mid + EPS && mid <= e + EPS);
}

/** Centre height of a frame (m). */
export const frameHeight = (frame: Pick<PlacedItem, 'height'>): number => frame.height ?? FRAME_HEIGHT_DEFAULT;

/** Allowed centre heights for a frame type: 0.2 m above the floor up to the wall top. */
export function frameHeightRange(type: PlacedItem['type']): { min: number; max: number } {
  const h = FRAME_OUTER_H[type] ?? 0;
  return { min: Math.round((0.2 + h / 2) * 100) / 100, max: Math.round((WALL_HEIGHT - h / 2) * 100) / 100 };
}

/** Frames whose wall is gone (deleted, moved, rotated away) are removed with it (007 spec edge case). */
export function dropUnsupportedFrames(layout: OfficeLayout): OfficeLayout {
  const items = layout.items.filter((i) => !isWallMounted(i.type) || frameSupported(layout, i));
  return items.length === layout.items.length ? layout : { ...layout, items };
}

export function validateLayout(layout: OfficeLayout): ValidationResult {
  const reasons: Record<string, string> = {};
  if (!floorSizeValid(layout.floor.width) || !floorSizeValid(layout.floor.depth)) {
    reasons['__floor__'] = `Office size must be ${FLOOR_MIN}–${FLOOR_MAX} m in steps of ${FLOOR_STEP} m`;
  }
  const ids = new Set<string>();
  for (const it of layout.items) {
    if (ids.has(it.id)) reasons[it.id] = 'Duplicate item id';
    ids.add(it.id);
    if (it.type === 'door') reasons[it.id] ??= 'The main door is part of the office shell and cannot be placed as an item';
    if (isWallMounted(it.type)) {
      // 008: frames sit on a 0.5 m wall line but slide along it in 5 cm steps.
      const ns = it.rotation === 0 || it.rotation === 180;
      const [across, along] = ns ? [it.pos.z, it.pos.x] : [it.pos.x, it.pos.z];
      if (!onStep(across, WALL_STEP) || !onStep(along, POS_STEP)) reasons[it.id] ??= 'Position must be in 5 cm steps';
    } else {
      const step = isEdge(it.type) ? WALL_STEP : POS_STEP;
      if (!onStep(it.pos.x, step) || !onStep(it.pos.z, step)) reasons[it.id] ??= isEdge(it.type) ? 'Walls must sit on the 0.5 m grid' : 'Position must be in 5 cm steps';
    }
    if (!insideFloor(layout, it)) reasons[it.id] ??= 'Outside the floor';
  }

  // Overlap between solid items (desks, plants, sofas, cooler, chairs); a chair may sit at its own desk.
  const solids = layout.items.filter(solid);
  for (let i = 0; i < solids.length; i++)
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i]!;
      const b = solids[j]!;
      if (chairOfDesk(a, b) || chairOfDesk(b, a)) continue;
      if (rectsOverlap(footprintRect(a), footprintRect(b))) reasons[b.id] ??= 'Overlaps another item';
    }

  // Edge items: one per 0.5 m edge segment (a long glass wall covers 4, an office door 2).
  const edges = new Set<string>();
  for (const it of layout.items) {
    if (!isEdge(it.type)) continue;
    for (const k of edgeSegments(it)) {
      if (edges.has(k)) reasons[it.id] ??= 'Another wall is already here';
      else edges.add(k);
    }
  }

  // 007/008: frames hang on a wall, glass or the inside of the outer wall, at an allowed height, not behind a
  // wall screen, and do not overlap another frame on the same side of the same wall.
  const frames = layout.items.filter((i) => isWallMounted(i.type));
  const screens = layout.items.filter((i) => i.type === 'wall_screen').map((i) => footprintRect(i));
  for (const it of layout.items) {
    if (it.picture !== undefined && !isWallMounted(it.type)) reasons[it.id] ??= 'Only picture frames can show a picture';
    if (it.height !== undefined && !isWallMounted(it.type)) reasons[it.id] ??= 'Only picture frames have a height';
  }
  for (let i = 0; i < frames.length; i++) {
    const it = frames[i]!;
    if (!frameSupported(layout, it)) reasons[it.id] ??= 'A picture must hang on a wall';
    const s = frameSpan(it);
    if (s.ns && it.rotation === 0 && Math.abs(s.c) < EPS && screens.some((r) => r.z0 < 1 && r.x0 < s.a1 - EPS && s.a0 < r.x1 - EPS)) {
      reasons[it.id] ??= 'Hidden behind the wall screen';
    }
    const h = frameHeight(it);
    const range = frameHeightRange(it.type);
    if (!onStep(h, POS_STEP) || h < range.min - EPS || h > range.max + EPS) reasons[it.id] ??= 'The picture is too high or too low';
    for (let j = 0; j < i; j++) {
      const o = frames[j]!;
      const t = frameSpan(o);
      if (o.rotation !== it.rotation || t.ns !== s.ns || Math.abs(t.c - s.c) > EPS) continue;
      const alongOverlap = s.a0 < t.a1 - EPS && t.a0 < s.a1 - EPS;
      const heightOverlap = Math.abs(frameHeight(o) - h) < ((FRAME_OUTER_H[o.type] ?? 0) + (FRAME_OUTER_H[it.type] ?? 0)) / 2 - EPS;
      if (alongOverlap && heightOverlap) reasons[it.id] ??= 'Another picture is already here';
    }
  }

  // Door within its side, and every desk seat reachable from it.
  const { side, offset } = layout.shell.door;
  const sideLen = side === 'south' ? layout.floor.width : layout.floor.depth;
  if (offset < 0 || offset > sideLen - DOOR_WIDTH) reasons['__door__'] = 'The main door is off the office edge';
  else if (!reasons['__floor__']) {
    const grid = new OfficeGrid(layout);
    const { door } = grid.entrance();
    if (!grid.walkable(door.x, door.z)) reasons['__door__'] = 'The main door entrance is blocked';
    else {
      const reach = reachable(grid, door);
      // Every seat of every desk and meeting table (007 FR-007).
      for (const item of layout.items.filter((i) => i.type === 'desk' || isMeetingTable(i.type))) {
        const desk = item.type === 'desk';
        for (const seat of seatPoints(item)) {
          const s = grid.seatOf(seat.id);
          if (!s || !grid.walkable(s.x, s.z)) reasons[item.id] ??= desk ? 'The desk seat is blocked' : 'A seat of this table is blocked';
          else if (!reach.has(s.z * grid.width + s.x)) reasons[item.id] ??= desk ? 'No path from the door to this desk' : 'No path from the door to this table';
        }
      }
    }
  }
  const invalidItems = Object.keys(reasons).filter((k) => !k.startsWith('__'));
  return { ok: Object.keys(reasons).length === 0, invalidItems, reasons };
}

function reachable(grid: OfficeGrid, start: { x: number; z: number }): Set<number> {
  const seen = new Set<number>([start.z * grid.width + start.x]);
  const queue = [start];
  while (queue.length) {
    const c = queue.pop()!;
    for (const n of grid.neighbours(c)) {
      const k = n.z * grid.width + n.x;
      if (!seen.has(k)) {
        seen.add(k);
        queue.push(n);
      }
    }
  }
  return seen;
}

/**
 * Smallest floor that still holds every item (FR-024): the far edge of the furthest item plus a 0.5 m
 * walkway, rounded up to 0.5 m and never below the minimum. `blockers` are the items that set the limit.
 */
export function minFloorSize(layout: OfficeLayout): { width: number; depth: number; blockers: string[] } {
  const ceilStep = (v: number) => Math.ceil(v / FLOOR_STEP - 1e-9) * FLOOR_STEP;
  let maxX = 0;
  let maxZ = 0;
  const rects = new Map<string, Rect>();
  for (const it of layout.items) {
    if (isWallMounted(it.type)) continue; // 007: frames on the outer wall move with it
    const r = footprintRect(it);
    rects.set(it.id, r);
    maxX = Math.max(maxX, r.x1);
    maxZ = Math.max(maxZ, r.z1);
  }
  const width = Math.max(FLOOR_MIN, ceilStep(maxX + 0.5));
  const depth = Math.max(FLOOR_MIN, ceilStep(maxZ + 0.5));
  const blockers = [...rects].filter(([, r]) => Math.abs(r.x1 - maxX) < 1e-6 || Math.abs(r.z1 - maxZ) < 1e-6).map(([id]) => id);
  return { width, depth, blockers };
}

/** Items that would end up outside (or without a walkway) if the floor became `width` × `depth`. */
export function resizeBlockers(layout: OfficeLayout, width: number, depth: number): string[] {
  return layout.items
    .filter((it) => {
      if (isWallMounted(it.type)) return false; // 007: frames on the outer wall move with it
      const r = footprintRect(it);
      return r.x1 + 0.5 > width + 1e-6 || r.z1 + 0.5 > depth + 1e-6;
    })
    .map((it) => it.id);
}

