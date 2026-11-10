import type { ItemType, PlacedItem, Rotation } from './domain';

// Furniture catalog (FR-050). Footprints are given in 0.5 m cells before rotation; positions are metres
// (layout v2). `edge` items (walls, glass) are 0.5 m segments that block movement across a line.

export const CELL = 0.5;

export interface CatalogEntry {
  type: ItemType;
  label: string;
  footprint: { w: number; d: number };
  blocks: 'cell' | 'edge' | 'none';
  /** For desks: where the seat is, relative to the unrotated footprint origin (in cells). */
  seat?: { x: number; z: number };
}

export const CATALOG: Record<ItemType, CatalogEntry> = {
  desk: { type: 'desk', label: 'Desk', footprint: { w: 3, d: 2 }, blocks: 'cell', seat: { x: 1, z: 2 } },
  chair: { type: 'chair', label: 'Chair', footprint: { w: 1, d: 1 }, blocks: 'none' },
  wall: { type: 'wall', label: 'Wall', footprint: { w: 1, d: 1 }, blocks: 'edge' },
  glass_wall: { type: 'glass_wall', label: 'Glass wall', footprint: { w: 1, d: 1 }, blocks: 'edge' },
  door: { type: 'door', label: 'Door', footprint: { w: 2, d: 1 }, blocks: 'none' },
  plant: { type: 'plant', label: 'Plant', footprint: { w: 1, d: 1 }, blocks: 'cell' },
  water_cooler: { type: 'water_cooler', label: 'Water cooler', footprint: { w: 1, d: 1 }, blocks: 'cell' },
  sofa: { type: 'sofa', label: 'Sofa', footprint: { w: 4, d: 2 }, blocks: 'cell' },
  wall_screen: { type: 'wall_screen', label: 'Wall screen', footprint: { w: 3, d: 1 }, blocks: 'none' },
};

export const isEdge = (type: ItemType): boolean => CATALOG[type].blocks === 'edge';

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
 * Floor-space rectangle of an item (metres). Edge items are a zero-width segment: rotation 0/180 runs
 * east from `pos` (a north edge), rotation 90/270 runs south from `pos` (a west edge).
 */
export function footprintRect(item: Pick<PlacedItem, 'type' | 'pos' | 'rotation'>): Rect {
  const { x, z } = item.pos;
  if (isEdge(item.type)) {
    return item.rotation === 0 || item.rotation === 180 ? { x0: x, z0: z, x1: x + CELL, z1: z } : { x0: x, z0: z, x1: x, z1: z + CELL };
  }
  const { w, d } = sizeM(item.type, item.rotation);
  return { x0: x, z0: z, x1: x + w, z1: z + d };
}

export function rectsOverlap(a: Rect, b: Rect, eps = 0.001): boolean {
  return a.x0 < b.x1 - eps && b.x0 < a.x1 - eps && a.z0 < b.z1 - eps && b.z0 < a.z1 - eps;
}

/** Centre (metres, floor space) of where an employee sits at a desk. */
export function seatPoint(desk: Pick<PlacedItem, 'pos' | 'rotation'>): { x: number; z: number } {
  const seat = CATALOG.desk.seat!;
  const { w, d } = CATALOG.desk.footprint;
  // Same rule as layout v1 (in cells), with a fractional origin so it works for any position.
  const cx = desk.pos.x / CELL;
  const cz = desk.pos.z / CELL;
  let c: { x: number; z: number };
  switch (desk.rotation) {
    case 0:
      c = { x: cx + seat.x, z: cz + seat.z };
      break;
    case 180:
      c = { x: cx + (w - 1 - seat.x), z: cz - 1 };
      break;
    case 90:
      c = { x: cx - 1, z: cz + seat.x };
      break;
    case 270:
      c = { x: cx + d, z: cz + (w - 1 - seat.x) };
      break;
  }
  return { x: (c.x + 0.5) * CELL, z: (c.z + 0.5) * CELL };
}

/** Round to a step without floating-point dust (0.05 → 2 decimals). */
export function snap(v: number, step: number): number {
  return Math.round(Math.round(v / step) * step * 1000) / 1000;
}
