import type { OfficeLayout, PlacedItem } from '@shared/domain';

// Default office plus 8 extra desks so all 20 benchmark employees are seated (SC-004 scenario).
// Mirrors src/server/services/default-layout.ts (the web bundle must not import server code).

export function defaultBenchLayout(): OfficeLayout {
  const items: PlacedItem[] = [];
  let n = 0;
  const add = (type: PlacedItem['type'], x: number, z: number, rotation: PlacedItem['rotation'] = 0) =>
    items.push({ id: `${type}-${++n}`, type, cell: { x, z }, rotation });
  const xs = [2, 7, 12, 17, 22, 27];
  const zs = [3, 8, 13, 18];
  let desks = 0;
  for (const z of zs)
    for (const x of xs) {
      if (desks >= 20) break;
      add('desk', x, z);
      add('chair', x + 1, z + 2);
      desks++;
    }
  for (let x = 0; x < 32; x++) add('glass_wall', x, 0);
  for (let z = 0; z < 24; z++) {
    add('wall', 0, z, 90);
    add('wall', 31, z, 90);
  }
  for (let x = 0; x < 32; x++) if (x < 14 || x > 15) add('wall', x, 23);
  add('door', 14, 23);
  add('wall_screen', 13, 1);
  add('water_cooler', 29, 21);
  for (const [x, z] of [
    [1, 1],
    [30, 1],
    [1, 21],
  ] as const)
    add('plant', x, z);
  return { schemaVersion: 1, floor: { widthCells: 32, depthCells: 24, cellSize: 0.5 }, items };
}
