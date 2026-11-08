import type { OfficeLayout, PlacedItem } from '../../shared/domain';

// FR-054 (001) in layout v2: a usable office on first launch — 12 desks + chairs, water cooler, sofa,
// wall screen (quota) and plants. 16 m × 12 m; glass façade to the north, door on the south side.

export function defaultLayout(): OfficeLayout {
  const items: PlacedItem[] = [];
  let n = 0;
  const add = (type: PlacedItem['type'], x: number, z: number, rotation: PlacedItem['rotation'] = 0) =>
    items.push({ id: `${type}-${++n}`, type, pos: { x, z }, rotation });

  // 3 rows × 4 desks. Each desk is 1.5 × 1 m with the seat (and chair) in front of it.
  for (const z of [2, 5, 8]) {
    for (const x of [2, 5, 8, 11]) {
      add('desk', x, z);
      add('chair', x + 0.5, z + 1);
    }
  }
  add('wall_screen', 6.5, 0.5);
  add('water_cooler', 14.5, 10);
  add('sofa', 13, 0.5);
  for (const [x, z] of [
    [0.5, 0.5],
    [0.5, 10.5],
    [15, 0.5],
    [14, 10.5],
    [4.5, 10.5],
    [10, 10.5],
  ] as const) {
    add('plant', x, z);
  }

  return { schemaVersion: 2, floor: { width: 16, depth: 12 }, shell: { glassSide: 'north', door: { side: 'south', offset: 7 } }, items };
}

export const desks = (layout: OfficeLayout) => layout.items.filter((i) => i.type === 'desk');
