import type { OfficeLayout, PlacedItem } from '../../shared/domain';

// FR-054: a usable office on first launch — 12 desks + chairs, water cooler, sofa, wall screen (quota),
// plants, a glass wall facing the park, and one door. Floor is 32 × 24 cells (16 m × 12 m).

export function defaultLayout(): OfficeLayout {
  const items: PlacedItem[] = [];
  let n = 0;
  const add = (type: PlacedItem['type'], x: number, z: number, rotation: PlacedItem['rotation'] = 0) =>
    items.push({ id: `${type}-${++n}`, type, cell: { x, z }, rotation });

  // 3 rows × 4 desks. Each desk is 3×2 cells with the seat in front (z + 2).
  const xs = [4, 10, 16, 22];
  const zs = [4, 10, 16];
  for (const z of zs) {
    for (const x of xs) {
      add('desk', x, z);
      add('chair', x + 1, z + 2);
    }
  }

  // Glass wall along the park side (north edge, z = 0), solid walls elsewhere.
  for (let x = 0; x < 32; x++) add('glass_wall', x, 0);
  for (let z = 0; z < 24; z++) {
    add('wall', 0, z, 90);
    add('wall', 31, z, 90);
  }
  for (let x = 0; x < 32; x++) if (x < 14 || x > 15) add('wall', x, 23);
  add('door', 14, 23);

  add('wall_screen', 13, 1);
  add('water_cooler', 29, 20);
  add('sofa', 26, 1);
  for (const [x, z] of [
    [1, 1],
    [1, 21],
    [30, 1],
    [28, 21],
    [9, 21],
    [20, 21],
  ] as const) {
    add('plant', x, z);
  }

  return { schemaVersion: 1, floor: { widthCells: 32, depthCells: 24, cellSize: 0.5 }, items };
}

export const desks = (layout: OfficeLayout) => layout.items.filter((i) => i.type === 'desk');
