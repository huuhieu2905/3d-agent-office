import type { ItemType, PlacedItem, Rotation } from './domain';

// Furniture catalog (FR-050). Footprints are given in 0.5 m cells before rotation; positions are metres
// (layout v2). `edge` items (walls, glass) are 0.5 m segments that block movement across a line.

export const CELL = 0.5;

export interface CatalogEntry {
  type: ItemType;
  label: string;
  /** Cells before rotation. Edge and wall-mounted items: `w` is the length along the edge. */
  footprint: { w: number; d: number };
  /** 007: floor = stands on the floor; edge = sits on the 0.5 m edge grid and takes that edge; wall = hangs on an edge. */
  mount: 'floor' | 'edge' | 'wall';
  blocks: 'cell' | 'edge' | 'none';
  /** Desks and meeting tables: where the seats are, relative to the unrotated footprint origin (in cells, may be fractional). */
  seats?: { x: number; z: number }[];
}

export const CATALOG: Record<ItemType, CatalogEntry> = {
  desk: { type: 'desk', label: 'Desk', footprint: { w: 3, d: 2 }, mount: 'floor', blocks: 'cell', seats: [{ x: 1, z: 2 }] },
  chair: { type: 'chair', label: 'Chair', footprint: { w: 1, d: 1 }, mount: 'floor', blocks: 'none' },
  wall: { type: 'wall', label: 'Wall', footprint: { w: 1, d: 1 }, mount: 'edge', blocks: 'edge' },
  glass_wall: { type: 'glass_wall', label: 'Glass wall', footprint: { w: 1, d: 1 }, mount: 'edge', blocks: 'edge' },
  door: { type: 'door', label: 'Door', footprint: { w: 2, d: 1 }, mount: 'floor', blocks: 'none' },
  plant: { type: 'plant', label: 'Plant', footprint: { w: 1, d: 1 }, mount: 'floor', blocks: 'cell' },
  water_cooler: { type: 'water_cooler', label: 'Water cooler', footprint: { w: 1, d: 1 }, mount: 'floor', blocks: 'cell' },
  sofa: { type: 'sofa', label: 'Sofa', footprint: { w: 4, d: 2 }, mount: 'floor', blocks: 'cell' },
  wall_screen: { type: 'wall_screen', label: 'Wall screen', footprint: { w: 3, d: 1 }, mount: 'floor', blocks: 'none' },
  long_glass: { type: 'long_glass', label: 'Long glass wall', footprint: { w: 4, d: 1 }, mount: 'edge', blocks: 'edge' },
  office_door: { type: 'office_door', label: 'Office door', footprint: { w: 2, d: 1 }, mount: 'edge', blocks: 'none' },
  // Table seats sit 0.375 m outside the table edge: always the centre of a free 0.25 m nav cell, on every side.
  // Table 1.5 × 1 m: two seats outside each long side.
  meeting_table_4: {
    type: 'meeting_table_4',
    label: 'Meeting table (4)',
    footprint: { w: 3, d: 2 },
    mount: 'floor',
    blocks: 'cell',
    seats: [{ x: 0.25, z: -1.25 }, { x: 1.75, z: -1.25 }, { x: 0.25, z: 2.25 }, { x: 1.75, z: 2.25 }],
  },
  // Table 3 × 1 m: three seats per long side, one at each end.
  meeting_table_8: {
    type: 'meeting_table_8',
    label: 'Meeting table (8)',
    footprint: { w: 6, d: 2 },
    mount: 'floor',
    blocks: 'cell',
    seats: [
      { x: 0.5, z: -1.25 }, { x: 2.5, z: -1.25 }, { x: 4.5, z: -1.25 },
      { x: 0.5, z: 2.25 }, { x: 2.5, z: 2.25 }, { x: 4.5, z: 2.25 },
      { x: -1.25, z: 0.5 }, { x: 6.25, z: 0.5 },
    ],
  },
  painting: { type: 'painting', label: 'Painting', footprint: { w: 2, d: 1 }, mount: 'wall', blocks: 'none' },
  photo_frame: { type: 'photo_frame', label: 'Photo frame', footprint: { w: 1, d: 1 }, mount: 'wall', blocks: 'none' },
};

/** On the 0.5 m edge grid, taking the edge (walls, glass, office doors). */
export const isEdge = (type: ItemType): boolean => CATALOG[type].mount === 'edge';
/** Hangs on an edge (paintings, photo frames). */
export const isWallMounted = (type: ItemType): boolean => CATALOG[type].mount === 'wall';
/** Edge-grid items of either kind: positioned in 0.5 m steps, footprint is a zero-width segment. */
export const onEdgeGrid = (type: ItemType): boolean => CATALOG[type].mount !== 'floor';

/** Footprint size in cells after rotation. */
export function rotatedSize(type: ItemType, rotation: Rotation): { w: number; d: number } {
  const { w, d } = CATALOG[type].footprint;
  return rotation === 90 || rotation === 270 ? { w: d, d: w } : { w, d };
}

/** Footprint size in metres after rotation. */
export function sizeM(type: ItemType, rotation: Rotation): { w: number; d: number } {
  const { w, d } = rotatedSize(type, rotation);
  return { w: w * CELL, d: d * CELL };
}

export interface Rect {
  x0: number;
  z0: number;
  x1: number;
  z1: number;
}

/**
 * Floor-space rectangle of an item (metres). Edge and wall-mounted items are a zero-width segment of
 * `footprint.w` cells: rotation 0/180 runs east from `pos` (a north edge), 90/270 runs south (a west edge).
 */
export function footprintRect(item: Pick<PlacedItem, 'type' | 'pos' | 'rotation'>): Rect {
  const { x, z } = item.pos;
  if (onEdgeGrid(item.type)) {
    const len = CATALOG[item.type].footprint.w * CELL;
    return item.rotation === 0 || item.rotation === 180 ? { x0: x, z0: z, x1: x + len, z1: z } : { x0: x, z0: z, x1: x, z1: z + len };
  }
  const { w, d } = sizeM(item.type, item.rotation);
  return { x0: x, z0: z, x1: x + w, z1: z + d };
}

export function rectsOverlap(a: Rect, b: Rect, eps = 0.001): boolean {
  return a.x0 < b.x1 - eps && b.x0 < a.x1 - eps && a.z0 < b.z1 - eps && b.z0 < a.z1 - eps;
}

export interface SeatPoint {
  /** Desk: the desk id. Meeting table: `<tableId>#<n>`. */
  id: string;
  /** Centre (metres, floor space) of where an employee sits. */
  x: number;
  z: number;
  /** Offset from the item's centre in its own (unrotated) frame, metres — where its 3D chair goes. */
  local: { x: number; z: number };
}

export const isMeetingTable = (type: ItemType): boolean => type === 'meeting_table_4' || type === 'meeting_table_8';

/** Seats of a desk or meeting table: seat cell centres rotated about the footprint centre (007 R7-03). */
export function seatPoints(item: Pick<PlacedItem, 'id' | 'type' | 'pos' | 'rotation'>): SeatPoint[] {
  const { w, d } = CATALOG[item.type].footprint;
  const seats = CATALOG[item.type].seats ?? [];
  const r = footprintRect(item);
  const cx = (r.x0 + r.x1) / 2;
  const cz = (r.z0 + r.z1) / 2;
  const a = (item.rotation * Math.PI) / 180;
  const cos = Math.round(Math.cos(a));
  const sin = Math.round(Math.sin(a));
  return seats.map((s, n) => {
    const u = (s.x + 0.5 - w / 2) * CELL;
    const v = (s.z + 0.5 - d / 2) * CELL;
    const x = Math.round((cx + u * cos - v * sin) * 1000) / 1000;
    const z = Math.round((cz + u * sin + v * cos) * 1000) / 1000;
    return { id: item.type === 'desk' ? item.id : `${item.id}#${n}`, x, z, local: { x: u, z: v } };
  });
}

/** Centre (metres, floor space) of where an employee sits at a desk. */
export function seatPoint(desk: Pick<PlacedItem, 'pos' | 'rotation'>): { x: number; z: number } {
  const s = seatPoints({ id: '', type: 'desk', ...desk })[0]!;
  return { x: s.x, z: s.z };
}

/** Round to a step without floating-point dust (0.05 → 2 decimals). */
export function snap(v: number, step: number): number {
  return Math.round(Math.round(v / step) * step * 1000) / 1000;
}
