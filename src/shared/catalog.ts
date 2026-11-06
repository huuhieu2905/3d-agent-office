import type { ItemType, PlacedItem, Rotation } from './domain';

// Furniture catalog (FR-050). Footprints are in 0.5 m cells, before rotation.
// `edge` items (walls) block movement across one cell edge instead of occupying the cell.

export interface CatalogEntry {
  type: ItemType;
  label: string;
  footprint: { w: number; d: number };
  blocks: 'cell' | 'edge' | 'none';
  /** For desks: where the seat is, relative to the unrotated footprint origin. */
  seat?: { x: number; z: number };
}

export const CATALOG: Record<ItemType, CatalogEntry> = {
  desk: { type: 'desk', label: 'Bàn làm việc', footprint: { w: 3, d: 2 }, blocks: 'cell', seat: { x: 1, z: 2 } },
  chair: { type: 'chair', label: 'Ghế', footprint: { w: 1, d: 1 }, blocks: 'none' },
  wall: { type: 'wall', label: 'Tường', footprint: { w: 1, d: 1 }, blocks: 'edge' },
  glass_wall: { type: 'glass_wall', label: 'Vách kính', footprint: { w: 1, d: 1 }, blocks: 'edge' },
  door: { type: 'door', label: 'Cửa', footprint: { w: 2, d: 1 }, blocks: 'none' },
  plant: { type: 'plant', label: 'Cây cảnh', footprint: { w: 1, d: 1 }, blocks: 'cell' },
  water_cooler: { type: 'water_cooler', label: 'Máy nước', footprint: { w: 1, d: 1 }, blocks: 'cell' },
  sofa: { type: 'sofa', label: 'Ghế sofa', footprint: { w: 4, d: 2 }, blocks: 'cell' },
  wall_screen: { type: 'wall_screen', label: 'Màn hình treo tường', footprint: { w: 3, d: 1 }, blocks: 'none' },
};

export function rotatedSize(type: ItemType, rotation: Rotation): { w: number; d: number } {
  const { w, d } = CATALOG[type].footprint;
  return rotation === 90 || rotation === 270 ? { w: d, d: w } : { w, d };
}

/** All cells covered by an item's footprint. */
export function footprintCells(item: PlacedItem): { x: number; z: number }[] {
  const { w, d } = rotatedSize(item.type, item.rotation);
  const cells: { x: number; z: number }[] = [];
  for (let dx = 0; dx < w; dx++) for (let dz = 0; dz < d; dz++) cells.push({ x: item.cell.x + dx, z: item.cell.z + dz });
  return cells;
}

/** The cell where an employee sits at a desk, after rotation. */
export function seatCell(desk: PlacedItem): { x: number; z: number } {
  const seat = CATALOG.desk.seat!;
  const { w, d } = CATALOG.desk.footprint;
  const { x, z } = desk.cell;
  switch (desk.rotation) {
    case 0:
      return { x: x + seat.x, z: z + seat.z };
    case 180:
      return { x: x + (w - 1 - seat.x), z: z - 1 };
    case 90:
      return { x: x - 1, z: z + seat.x };
    case 270:
      return { x: x + d, z: z + (w - 1 - seat.x) };
  }
}
