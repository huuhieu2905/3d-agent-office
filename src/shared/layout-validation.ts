import { CATALOG, footprintCells, seatCell } from './catalog';
import type { OfficeLayout, PlacedItem } from './domain';

// T099 — data-model.md §5 rules, verbatim:
//  - "Mọi ô trong footprint đều nằm trong `floor`".
//  - "Không có hai vật chặn nhau chiếm cùng một ô. Tường và vách kính chỉ chặn cạnh ô".
//  - "Mỗi `desk` có đúng một ô ngồi đi tới được từ cửa (kiểm tra bằng A*)".
// Pure and dependency-free so the server (PUT /api/layout) and the build mode preview share it.

export interface ValidationResult {
  ok: boolean;
  invalidItems: string[];
  reasons: Record<string, string>;
}

const key = (x: number, z: number) => `${x},${z}`;

/** Item footprint inside the floor? */
export function insideFloor(layout: OfficeLayout, item: PlacedItem): boolean {
  const { widthCells: w, depthCells: d } = layout.floor;
  return footprintCells(item).every((c) => c.x >= 0 && c.z >= 0 && c.x < w && c.z < d);
}

/** Cells blocked by `cell` items (desks, plants, sofas, water cooler). */
function occupancy(items: PlacedItem[]): Map<string, string> {
  const m = new Map<string, string>();
  for (const it of items) {
    const kind = CATALOG[it.type].blocks;
    if (kind !== 'cell' && it.type !== 'chair') continue;
    for (const c of footprintCells(it)) if (!m.has(key(c.x, c.z))) m.set(key(c.x, c.z), it.id);
  }
  return m;
}

function edgeBlocked(items: PlacedItem[]) {
  const north = new Set<string>();
  const west = new Set<string>();
  for (const it of items) {
    if (CATALOG[it.type].blocks !== 'edge') continue;
    (it.rotation === 0 || it.rotation === 180 ? north : west).add(key(it.cell.x, it.cell.z));
  }
  return { north, west };
}

/** Breadth-first reachability from the door over walkable cells (equivalent to A* reachability). */
function reachable(layout: OfficeLayout, start: { x: number; z: number }): Set<string> {
  const { widthCells: w, depthCells: d } = layout.floor;
  const blocking = layout.items.filter((i) => CATALOG[i.type].blocks === 'cell');
  const blocked = new Set<string>();
  for (const it of blocking) for (const c of footprintCells(it)) blocked.add(key(c.x, c.z));
  const { north, west } = edgeBlocked(layout.items);
  const seen = new Set<string>([key(start.x, start.z)]);
  const queue = [start];
  while (queue.length) {
    const c = queue.shift()!;
    const steps: [number, number, boolean][] = [
      [1, 0, !west.has(key(c.x + 1, c.z))],
      [-1, 0, !west.has(key(c.x, c.z))],
      [0, 1, !north.has(key(c.x, c.z + 1))],
      [0, -1, !north.has(key(c.x, c.z))],
    ];
    for (const [dx, dz, open] of steps) {
      const n = { x: c.x + dx, z: c.z + dz };
      const k = key(n.x, n.z);
      if (!open || n.x < 0 || n.z < 0 || n.x >= w || n.z >= d || blocked.has(k) || seen.has(k)) continue;
      seen.add(k);
      queue.push(n);
    }
  }
  return seen;
}

export function validateLayout(layout: OfficeLayout): ValidationResult {
  const reasons: Record<string, string> = {};
  const ids = new Set<string>();
  for (const it of layout.items) {
    if (ids.has(it.id)) reasons[it.id] = 'Trùng mã đồ vật';
    ids.add(it.id);
    if (!insideFloor(layout, it)) reasons[it.id] = 'Nằm ngoài mặt bằng';
  }

  // Overlap: cell-blocking items (and chairs) may not share a cell.
  const seen = new Map<string, string>();
  for (const it of layout.items) {
    const kind = CATALOG[it.type].blocks;
    if (kind !== 'cell' && it.type !== 'chair') continue;
    for (const c of footprintCells(it)) {
      const k = key(c.x, c.z);
      const other = seen.get(k);
      if (other && other !== it.id) {
        reasons[it.id] ??= 'Chồng lên đồ vật khác';
      } else seen.set(k, it.id);
    }
  }
  // Edge items: one per edge.
  const edges = new Map<string, string>();
  for (const it of layout.items) {
    if (CATALOG[it.type].blocks !== 'edge') continue;
    const k = `${it.rotation === 0 || it.rotation === 180 ? 'n' : 'w'}:${key(it.cell.x, it.cell.z)}`;
    if (edges.has(k)) reasons[it.id] ??= 'Trùng vị trí tường';
    else edges.set(k, it.id);
  }

  // Doors and desk seats.
  const door = layout.items.find((i) => i.type === 'door');
  if (!door) reasons['__layout__'] = 'Văn phòng cần một cửa ra vào';
  else {
    const reach = reachable(layout, { x: door.cell.x, z: door.cell.z });
    const occ = occupancy(layout.items.filter((i) => i.type !== 'chair'));
    for (const desk of layout.items.filter((i) => i.type === 'desk')) {
      const s = seatCell(desk);
      const k = key(s.x, s.z);
      if (s.x < 0 || s.z < 0 || s.x >= layout.floor.widthCells || s.z >= layout.floor.depthCells || occ.has(k)) {
        reasons[desk.id] ??= 'Chỗ ngồi của bàn bị chắn';
      } else if (!reach.has(k)) {
        reasons[desk.id] ??= 'Không có lối đi từ cửa tới bàn';
      }
    }
  }
  const invalidItems = Object.keys(reasons).filter((k) => k !== '__layout__');
  return { ok: Object.keys(reasons).length === 0, invalidItems, reasons };
}
