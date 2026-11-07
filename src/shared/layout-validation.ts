import { CATALOG, footprintRect, isEdge, rectsOverlap, seatPoint, type Rect } from './catalog';
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

export function validateLayout(layout: OfficeLayout): ValidationResult {
  const reasons: Record<string, string> = {};
  if (!floorSizeValid(layout.floor.width) || !floorSizeValid(layout.floor.depth)) {
    reasons['__floor__'] = `Kích thước văn phòng phải từ ${FLOOR_MIN} đến ${FLOOR_MAX} m, bước ${FLOOR_STEP} m`;
  }
  const ids = new Set<string>();
  for (const it of layout.items) {
    if (ids.has(it.id)) reasons[it.id] = 'Trùng mã đồ vật';
    ids.add(it.id);
    if (it.type === 'door') reasons[it.id] ??= 'Cửa chính thuộc vỏ văn phòng, không đặt như đồ vật';
    const step = isEdge(it.type) ? WALL_STEP : POS_STEP;
    if (!onStep(it.pos.x, step) || !onStep(it.pos.z, step)) reasons[it.id] ??= isEdge(it.type) ? 'Tường phải nằm trên lưới 0,5 m' : 'Vị trí phải theo bước 5 cm';
    if (!insideFloor(layout, it)) reasons[it.id] ??= 'Nằm ngoài mặt bằng';
  }

  // Overlap between solid items (desks, plants, sofas, cooler, chairs); a chair may sit at its own desk.
  const solids = layout.items.filter(solid);
  for (let i = 0; i < solids.length; i++)
    for (let j = i + 1; j < solids.length; j++) {
      const a = solids[i]!;
      const b = solids[j]!;
      if (chairOfDesk(a, b) || chairOfDesk(b, a)) continue;
      if (rectsOverlap(footprintRect(a), footprintRect(b))) reasons[b.id] ??= 'Chồng lên đồ vật khác';
    }

  // Edge items: one per edge segment.
  const edges = new Set<string>();
  for (const it of layout.items) {
    if (!isEdge(it.type)) continue;
    const k = `${it.rotation === 0 || it.rotation === 180 ? 'n' : 'w'}:${it.pos.x},${it.pos.z}`;
    if (edges.has(k)) reasons[it.id] ??= 'Trùng vị trí tường';
    else edges.add(k);
  }

  // Door within its side, and every desk seat reachable from it.
  const { side, offset } = layout.shell.door;
  const sideLen = side === 'south' ? layout.floor.width : layout.floor.depth;
  if (offset < 0 || offset > sideLen - DOOR_WIDTH) reasons['__door__'] = 'Cửa chính nằm ngoài cạnh văn phòng';
  else if (!reasons['__floor__']) {
    const grid = new OfficeGrid(layout);
    const { door } = grid.entrance();
    if (!grid.walkable(door.x, door.z)) reasons['__door__'] = 'Lối vào cửa chính bị chắn';
    else {
      const reach = reachable(grid, door);
      for (const desk of layout.items.filter((i) => i.type === 'desk')) {
        const s = grid.seatOf(desk.id)!;
        if (!grid.walkable(s.x, s.z)) reasons[desk.id] ??= 'Chỗ ngồi của bàn bị chắn';
        else if (!reach.has(s.z * grid.width + s.x)) reasons[desk.id] ??= 'Không có lối đi từ cửa tới bàn';
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
      const r = footprintRect(it);
      return r.x1 + 0.5 > width + 1e-6 || r.z1 + 0.5 > depth + 1e-6;
    })
    .map((it) => it.id);
}

